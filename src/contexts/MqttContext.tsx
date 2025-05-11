"use client";

import type { MqttClient, IClientOptions, IPublishPacket } from 'mqtt';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { ConnectFormValues } from "@/components/mqtt-connect-form";
import type { GraphConfig } from "@/components/graph-customization-controls";
import type { MqttConnectionStatus } from "@/components/mqtt-status-indicator";
import { saveMqttData } from '@/services/firebase-service';

const MAX_DATA_POINTS = 200;
const HARDCODED_TOPIC = "/TFT/Response";

export interface DataPoint {
  timestamp: number;
  values: Record<string, number>; 
}

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
        isManuallyDisconnectingRef.current = true; // Ensure cleanup doesn't trigger reconnect/error logic
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

    if (mqttClient && mqttClient.connected) {
      isManuallyDisconnectingRef.current = true;
      await new Promise<void>((resolve) => mqttClient.end(true, resolve));
      isManuallyDisconnectingRef.current = false;
    }
    setMqttClient(null); // Clear previous client instance

    setConnectionStatus("connecting");
    setDataPoints([]);
    setCurrentTopic(HARDCODED_TOPIC);
    isManuallyDisconnectingRef.current = false;

    const connectOptions: IClientOptions = {
      keepalive: 60,
      reconnectPeriod: 1000, // Try to reconnect faster if disconnected
      connectTimeout: 20 * 1000,
      clean: true,
      protocolVersion: 4,
      username: username,
      password: password,
      clientId: `mqtt_visualizer_${Math.random().toString(16).substr(2, 8)}` // Unique client ID
    };

    try {
      const client = mqttModuleRef.current.connect(brokerUrl, connectOptions);
      setMqttClient(client);

      client.on("connect", () => {
        if (connectionStatusRef.current !== "connected") { // Avoid multiple toasts if reconnected quickly
          setConnectionStatus("connected");
          toast({ title: "MQTT Status", description: `Connected to ${brokerUrl}` });
        }
        client.subscribe(HARDCODED_TOPIC, { qos: 0 }, (err) => {
          if (err) {
            console.error("MQTT Subscription Error:", err);
            toast({ title: "Subscription Error", description: `Failed to subscribe to ${HARDCODED_TOPIC}: ${err.message}`, variant: "destructive" });
            setConnectionStatus("error");
            client.end(true);
          } else {
            // toast({ title: "MQTT Status", description: `Subscribed to ${HARDCODED_TOPIC}` }); // Can be noisy
          }
        });
      });

      client.on("message", async (_topic: string, payload: Buffer, _packet: IPublishPacket) => {
        const messageStr = payload.toString();
        
        try {
          const jsonData = JSON.parse(messageStr);
          
          if (jsonData && typeof jsonData.tftvalue === 'object' && jsonData.tftvalue !== null) {
            const sensorValues: Record<string, number> = {};
            let hasNumericValue = false;
            for (const key in jsonData.tftvalue) {
              if (Object.prototype.hasOwnProperty.call(jsonData.tftvalue, key)) {
                const numericValue = parseFloat(String(jsonData.tftvalue[key]));
                if (!isNaN(numericValue)) {
                  sensorValues[key] = numericValue;
                  hasNumericValue = true;
                }
              }
            }

            if (hasNumericValue) {
              setDataPoints((prevData) => {
                const newDataPoint: DataPoint = { timestamp: Date.now(), values: sensorValues };
                const updatedData = [...prevData, newDataPoint];
                return updatedData.length > MAX_DATA_POINTS ? updatedData.slice(-MAX_DATA_POINTS) : updatedData;
              });
            }
          } else {
            let singleValueForChart: number | undefined;
            if (typeof jsonData.value === 'number') {
              singleValueForChart = jsonData.value;
            } else if (typeof jsonData === 'number') {
              singleValueForChart = jsonData;
            } else if (typeof jsonData === 'object' && jsonData !== null && Object.values(jsonData).some(v => typeof v === 'number')) {
              singleValueForChart = Object.values(jsonData).find(v => typeof v === 'number') as number;
            }

            if (singleValueForChart !== undefined && !isNaN(singleValueForChart)) {
               setDataPoints((prevData) => {
                const newDataPoint: DataPoint = { timestamp: Date.now(), values: { value: singleValueForChart! } };
                const updatedData = [...prevData, newDataPoint];
                return updatedData.length > MAX_DATA_POINTS ? updatedData.slice(-MAX_DATA_POINTS) : updatedData;
              });
            }
          }
        } catch (e) {
          const valueForChart = parseFloat(messageStr);
          if (!isNaN(valueForChart)) {
             setDataPoints((prevData) => {
              const newDataPoint: DataPoint = { timestamp: Date.now(), values: { value: valueForChart } };
              const updatedData = [...prevData, newDataPoint];
              return updatedData.length > MAX_DATA_POINTS ? updatedData.slice(-MAX_DATA_POINTS) : updatedData;
            });
          }
        }
        
        if (HARDCODED_TOPIC) { // This check is a bit redundant as HARDCODED_TOPIC is a const string
          try {
            await saveMqttData(HARDCODED_TOPIC, messageStr);
          } catch (error: any) {
            console.error("MqttContext: Firebase save error:", error); // Log the actual error object
            let description = "Failed to save MQTT data to Firebase.";
            if (error && typeof error.message === 'string') {
              // Use the message from the error thrown by the server action
              description = error.message;
            }
            toast({
              title: "Firebase Error",
              description: description,
              variant: "destructive",
            });
          }
        }
      });

      client.on("error", (err) => {
        // Check connectionStatusRef to avoid setting to "error" if already disconnected manually or if already in error state from a previous event.
        if (connectionStatusRef.current !== "error" && !isManuallyDisconnectingRef.current) {
          console.error("MQTT Client Error:", err);
          setConnectionStatus("error");
          toast({ title: "MQTT Error", description: err.message || "An unknown MQTT error occurred.", variant: "destructive" });
        }
        // Don't client.end() here if reconnectPeriod is set, allow it to try to reconnect.
        // If it's a fatal error, 'close' will eventually be emitted.
      });

      client.on("close", () => {
        if (isManuallyDisconnectingRef.current) {
          if (connectionStatusRef.current !== "disconnected") setConnectionStatus("disconnected");
          return;
        }
        // If not manually disconnecting and current status is not already 'error' or 'disconnected'
        if (connectionStatusRef.current !== "error" && connectionStatusRef.current !== "disconnected") {
            setConnectionStatus("disconnected"); // Or "error" if it was an unexpected close
            toast({ title: "MQTT Status", description: "Connection closed.", variant: "destructive" });
        }
      });

      client.on('offline', () => {
        if (connectionStatusRef.current === "connected" && !isManuallyDisconnectingRef.current) {
            setConnectionStatus("disconnected"); // Treat offline as disconnected, allowing reconnect attempts
            toast({ title: "MQTT Status", description: "Broker is offline. Attempting to reconnect...", variant: "destructive" });
        }
      });

       client.on('reconnect', () => {
        if (!isManuallyDisconnectingRef.current && connectionStatusRef.current !== "connecting") {
            setConnectionStatus("connecting");
            // toast({ title: "MQTT Status", description: "Attempting to reconnect..." }); // Can be noisy
        }
      });


    } catch (error: any) {
      console.error("MQTT Connection Setup Error:", error);
      if (connectionStatusRef.current !== "error") {
        setConnectionStatus("error");
        toast({ title: "Connection Failed", description: error.message || "Unknown error during connection setup.", variant: "destructive" });
      }
      if (mqttClient && mqttClient.end) {
        mqttClient.end(true);
      }
      setMqttClient(null);
    }
  }, [toast, mqttClient]); // mqttClient dependency is important here

  const disconnectMqtt = useCallback(async () => {
    if (mqttClient) {
      isManuallyDisconnectingRef.current = true;
      // mqtt.end() can take a callback which is called when the client is fully closed.
      await new Promise<void>((resolve) => mqttClient.end(true, resolve));
      toast({ title: "MQTT Status", description: "Disconnected by user." });
      setConnectionStatus("disconnected");
      setMqttClient(null);
      setCurrentTopic(null);
      setDataPoints([]);
      isManuallyDisconnectingRef.current = false;
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
