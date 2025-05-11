
"use client";

import type { MqttClient, IClientOptions, IPublishPacket } from 'mqtt';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { ConnectFormValues } from "@/components/mqtt-connect-form";
import type { GraphConfig } from "@/components/graph-customization-controls";
import type { DataPoint } from "@/components/real-time-chart";
import type { MqttConnectionStatus } from "@/components/mqtt-status-indicator";
import { saveMqttData } from '@/services/firebase-service'; // No longer need MqttDataPayload here

const MAX_DATA_POINTS = 200;
const HARDCODED_TOPIC = "/TFT/Response";

interface MqttContextType {
  mqttClient: MqttClient | null;
  connectionStatus: MqttConnectionStatus;
  currentTopic: string | null;
  dataPoints: DataPoint[];
  graphConfig: GraphConfig;
  connectMqtt: (values: ConnectFormValues) => Promise<void>;
  disconnectMqtt: () => void;
  handleGraphConfigChange: (newConfig: Partial<GraphConfig>) => void;
}

const MqttContext = createContext<MqttContextType | undefined>(undefined);

export const MqttProvider = ({ children }: { children: ReactNode }) => {
  const [mqttClient, setMqttClient] = useState<MqttClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<MqttConnectionStatus>("disconnected");
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const { toast } = useToast();

  const [graphConfig, setGraphConfig] = useState<GraphConfig>({
    lineColor: "hsl(var(--primary))",
    lineThickness: 2,
    showXAxis: true,
    showYAxis: true,
    showGrid: true,
  });

  const mqttModuleRef = useRef<typeof import('mqtt') | null>(null);
  const connectionStatusRef = useRef(connectionStatus);
  const isManuallyDisconnectingRef = useRef<boolean>(false);

  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    let isMounted = true;
    import('mqtt')
      .then(module => {
        if (isMounted) {
          if (module && typeof module.connect === 'function') {
            mqttModuleRef.current = module;
          } else if (module && module.default && typeof (module.default as any).connect === 'function') {
            mqttModuleRef.current = module.default as typeof import('mqtt');
          } else {
            console.error("MQTT module loaded, but 'connect' function not found in expected locations.", module);
            toast({ title: "MQTT Error", description: "Could not initialize MQTT 'connect' function.", variant: "destructive" });
          }
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error("Error importing MQTT module:", err);
          toast({ title: "MQTT Error", description: `Failed to load MQTT library: ${err.message}`, variant: "destructive" });
        }
      });
    return () => { isMounted = false; };
  }, [toast]);

  useEffect(() => {
    return () => {
      if (mqttClient) {
        mqttClient.end(true);
      }
    };
  }, [mqttClient]);

  const connectMqtt = useCallback(async ({ brokerUrl, username, password }: ConnectFormValues) => {
    if (!mqttModuleRef.current) {
      toast({ title: "MQTT Error", description: "MQTT library not loaded yet. Please wait and try again.", variant: "destructive" });
      return;
    }
    if (typeof mqttModuleRef.current.connect !== 'function') {
      toast({ title: "MQTT Error", description: "MQTT 'connect' method is not available.", variant: "destructive" });
      return;
    }

    if (mqttClient) {
      isManuallyDisconnectingRef.current = true;
      mqttClient.end(true, () => { isManuallyDisconnectingRef.current = false; });
    }

    setConnectionStatus("connecting");
    setDataPoints([]);
    setCurrentTopic(HARDCODED_TOPIC);
    isManuallyDisconnectingRef.current = false;

    const connectOptions: IClientOptions = {
      keepalive: 60,
      reconnectPeriod: 5000,
      connectTimeout: 20 * 1000,
      clean: true,
      protocolVersion: 4, // MQTT v3.1.1
      username: username,
      password: password,
    };

    try {
      const client = mqttModuleRef.current.connect(brokerUrl, connectOptions);
      setMqttClient(client);

      client.on("connect", () => {
        setConnectionStatus("connected");
        toast({ title: "MQTT Status", description: `Connected to ${brokerUrl}` });
        client.subscribe(HARDCODED_TOPIC, { qos: 0 }, (err) => {
          if (err) {
            toast({ title: "Subscription Error", description: `Failed to subscribe to ${HARDCODED_TOPIC}: ${err.message}`, variant: "destructive" });
            setConnectionStatus("error");
            client.end(true);
          } else {
            toast({ title: "MQTT Status", description: `Subscribed to ${HARDCODED_TOPIC}` });
          }
        });
      });

      client.on("message", async (_topic: string, payload: Buffer, _packet: IPublishPacket) => {
        const messageStr = payload.toString();
        let valueForChart: number | undefined;

        // Logic to extract a numeric value for the chart
        try {
          const jsonData = JSON.parse(messageStr);
          if (jsonData && typeof jsonData.device_serial === 'string' && typeof jsonData.tftvalue === 'object' && jsonData.tftvalue !== null) {
            const tftValues = Object.values(jsonData.tftvalue as Record<string, string | number>);
            const numericTftValue = tftValues.find(v => typeof parseFloat(String(v)) === 'number' && !isNaN(parseFloat(String(v))));
            if (numericTftValue !== undefined) valueForChart = parseFloat(String(numericTftValue));
          } else if (typeof jsonData.value === 'number') {
            valueForChart = jsonData.value;
          } else if (typeof jsonData === 'number') {
            valueForChart = jsonData;
          } else if (typeof jsonData === 'object' && jsonData !== null && Object.values(jsonData).some(v => typeof v === 'number')) {
            valueForChart = Object.values(jsonData).find(v => typeof v === 'number') as number;
          } else {
            valueForChart = parseFloat(messageStr);
          }
        } catch (e) {
          valueForChart = parseFloat(messageStr); // Fallback for non-JSON messages or parsing errors
        }
        
        if (valueForChart !== undefined && !isNaN(valueForChart)) {
          setDataPoints((prevData) => {
            const newDataPoint = { timestamp: Date.now(), value: valueForChart as number };
            const updatedData = [...prevData, newDataPoint];
            return updatedData.length > MAX_DATA_POINTS ? updatedData.slice(-MAX_DATA_POINTS) : updatedData;
          });
        }
        
        // Save all received data to Firebase
        if (currentTopic) { // currentTopic is HARDCODED_TOPIC
          try {
            await saveMqttData(currentTopic, messageStr);
          } catch (error: any) {
            console.error("Firebase save error in MqttContext:", error);
            toast({
              title: "Firebase Error",
              description: `Failed to save data: ${error.message}`,
              variant: "destructive",
            });
          }
        }
      });

      client.on("error", (err) => {
        if (connectionStatusRef.current !== "error") {
          setConnectionStatus("error");
          toast({ title: "MQTT Error", description: err.message || "An unknown MQTT error occurred.", variant: "destructive" });
        }
        client.end(true);
      });

      client.on("close", () => {
        if (isManuallyDisconnectingRef.current) {
          if (connectionStatusRef.current !== "disconnected") setConnectionStatus("disconnected");
          return;
        }
        if (connectionStatusRef.current === "disconnected") return;

        if (connectionStatusRef.current === "connected") {
          setConnectionStatus("disconnected");
          toast({ title: "MQTT Status", description: "Disconnected from broker.", variant: "destructive" });
        } else if (connectionStatusRef.current === "connecting") {
          if (connectionStatusRef.current !== "error") {
            setConnectionStatus("error");
            toast({ title: "Connection Failed", description: "Could not connect. Connection closed.", variant: "destructive" });
          }
        }
      });

      client.on('offline', () => {
        if (connectionStatusRef.current !== "disconnected" && connectionStatusRef.current !== "error") {
            setConnectionStatus("disconnected");
            toast({ title: "MQTT Status", description: "Broker is offline. Connection lost.", variant: "destructive" });
        }
      });

    } catch (error: any) {
      if (connectionStatusRef.current !== "error") {
        setConnectionStatus("error");
        toast({ title: "Connection Failed", description: error.message || "Unknown error during connection setup.", variant: "destructive" });
      }
      if (mqttClient && mqttClient.end) {
        mqttClient.end(true);
        setMqttClient(null);
      }
    }
  }, [toast, mqttClient, currentTopic]); // currentTopic is stable (HARDCODED_TOPIC) or null

  const disconnectMqtt = useCallback(() => {
    if (mqttClient) {
      isManuallyDisconnectingRef.current = true;
      mqttClient.end(true, () => {
        toast({ title: "MQTT Status", description: "Disconnected by user." });
        setConnectionStatus("disconnected");
        setMqttClient(null);
        setCurrentTopic(null); // Clear topic on disconnect
        setDataPoints([]); // Clear data points on disconnect
        isManuallyDisconnectingRef.current = false;
      });
    } else {
      if (connectionStatus !== "disconnected") setConnectionStatus("disconnected");
    }
  }, [mqttClient, toast, connectionStatus]);

  const handleGraphConfigChange = useCallback((newConfig: Partial<GraphConfig>) => {
    setGraphConfig((prevConfig) => ({ ...prevConfig, ...newConfig }));
  }, []);

  return (
    <MqttContext.Provider value={{
      mqttClient,
      connectionStatus,
      currentTopic,
      dataPoints,
      graphConfig,
      connectMqtt,
      disconnectMqtt,
      handleGraphConfigChange
    }}>
      {children}
    </MqttContext.Provider>
  );
};

export const useMqtt = (): MqttContextType => {
  const context = useContext(MqttContext);
  if (context === undefined) {
    throw new Error('useMqtt must be used within a MqttProvider');
  }
  return context;
};
