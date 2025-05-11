"use client";

import type { MqttClient, IClientOptions, IPublishPacket } from 'mqtt';
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { ConnectFormValues } from "@/components/mqtt-connect-form";
import type { GraphConfig } from "@/components/graph-customization-controls";
import type { MqttConnectionStatus } from "@/components/mqtt-status-indicator";
// Import the new RTDB save function
import { saveStructuredMqttDataToRTDB, type MqttJsonPayload } from '@/services/firebase-service';


const MAX_DATA_POINTS = 200; // Max points per device *or* total? Let's assume total for now to keep UI responsive.
                              // If per device, this logic needs to be more complex.
const HARDCODED_TOPIC = "/TFT/Response";

export interface DataPoint {
  timestamp: number;
  deviceSerial: string; // Added for multi-device support
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
    lineColor: "hsl(var(--primary))", // This might be used for general chart elements like Brush
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
        isManuallyDisconnectingRef.current = true; 
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
      await new Promise<void>((resolve) => {
        mqttClient.end(true, {}, () => resolve());
      });
      isManuallyDisconnectingRef.current = false;
    }
    setMqttClient(null); 

    setConnectionStatus("connecting");
    setDataPoints([]); // Clear data points on new connection
    setCurrentTopic(HARDCODED_TOPIC);
    isManuallyDisconnectingRef.current = false;

    const connectOptions: IClientOptions = {
      keepalive: 60,
      reconnectPeriod: 1000, 
      connectTimeout: 20 * 1000,
      clean: true,
      protocolVersion: 4, // MQTT 3.1.1
      username: username,
      password: password,
      clientId: `mqtt_visualizer_${Math.random().toString(16).substr(2, 8)}`
    };

    try {
      const client = mqttModuleRef.current.connect(brokerUrl, connectOptions);
      setMqttClient(client);

      client.on("connect", () => {
        if (connectionStatusRef.current !== "connected") { 
          setConnectionStatus("connected");
          toast({ title: "MQTT Status", description: `Connected to ${brokerUrl}` });
        }
        client.subscribe(HARDCODED_TOPIC, { qos: 0 }, (err) => {
          if (err) {
            console.error("MQTT Subscription Error:", err);
            toast({ title: "Subscription Error", description: `Failed to subscribe to ${HARDCODED_TOPIC}: ${err.message}`, variant: "destructive" });
            setConnectionStatus("error");
            client.end(true);
          }
        });
      });

      client.on("message", async (topic: string, payload: Buffer, _packet: IPublishPacket) => {
        const messageStr = payload.toString();
        let jsonData: MqttJsonPayload | any;
        let parsedForChart = false;

        try {
          jsonData = JSON.parse(messageStr);
          
          const deviceSerial = jsonData?.device_serial;

          if (jsonData && typeof deviceSerial === 'string' && typeof jsonData.tftvalue === 'object' && jsonData.tftvalue !== null) {
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
                const newDataPoint: DataPoint = { 
                  timestamp: Date.now(), 
                  deviceSerial: deviceSerial, // Store deviceSerial
                  values: sensorValues 
                };
                const updatedData = [...prevData, newDataPoint];
                // Simple trim for total data points. More sophisticated per-device trimming could be added.
                return updatedData.length > MAX_DATA_POINTS ? updatedData.slice(-MAX_DATA_POINTS) : updatedData;
              });
              parsedForChart = true;
            }
          }
          
          if (topic === HARDCODED_TOPIC && jsonData && typeof jsonData.device_serial === 'string' && typeof jsonData.tftvalue === 'object') {
            await saveStructuredMqttDataToRTDB(jsonData as MqttJsonPayload);
          }

        } catch (e) { 
          // console.warn("MQTT message payload is not valid JSON or parsing failed:", messageStr, e);
          // For non-JSON or simple numeric payloads, we might not have a device_serial easily.
          // This part needs to be decided: how to handle such messages for multi-device charts.
          // For now, assuming conforming JSON payload for multi-device.
          // If we want to chart raw numeric values, they would need a default/placeholder deviceSerial or be handled separately.
        }
        
        if (!parsedForChart) {
            // console.log("Message received but not suitable for chart: ", messageStr);
        }
      });

      client.on("error", (err) => {
        if (connectionStatusRef.current !== "error" && !isManuallyDisconnectingRef.current) {
          console.error("MQTT Client Error:", err);
          setConnectionStatus("error");
          toast({ title: "MQTT Error", description: err.message || "An unknown MQTT error occurred.", variant: "destructive" });
        }
      });

      client.on("close", () => {
        if (isManuallyDisconnectingRef.current) {
          if (connectionStatusRef.current !== "disconnected") setConnectionStatus("disconnected");
          return;
        }
        if (connectionStatusRef.current !== "error" && connectionStatusRef.current !== "disconnected") {
            setConnectionStatus("disconnected");
            toast({ title: "MQTT Status", description: "Connection closed.", variant: "destructive" });
        }
      });

       client.on('offline', () => {
        if (connectionStatusRef.current === "connected" && !isManuallyDisconnectingRef.current) {
            setConnectionStatus("disconnected"); 
            toast({ title: "MQTT Status", description: "Broker is offline. Attempting to reconnect...", variant: "destructive" });
        }
      });

       client.on('reconnect', () => {
        if (!isManuallyDisconnectingRef.current && connectionStatusRef.current !== "connecting") {
            setConnectionStatus("connecting");
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
  }, [toast, mqttClient]); 

  const disconnectMqtt = useCallback(async () => {
    if (mqttClient) {
      isManuallyDisconnectingRef.current = true;
      await new Promise<void>((resolve) => {
        mqttClient.end(true, {}, () => {
          resolve();
        });
      });
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

