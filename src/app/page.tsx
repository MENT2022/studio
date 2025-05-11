
"use client"; // This page orchestrates client components

import type { MqttClient, IClientOptions, IPublishPacket } from 'mqtt';
import { useEffect, useState, useCallback, useRef } from 'react';

import { useToast } from "@/hooks/use-toast";
import { MqttConnectForm } from "@/components/mqtt-connect-form";
import type { ConnectFormValues } from "@/components/mqtt-connect-form";
import type { GraphConfig } from "@/components/graph-customization-controls";
import { GraphCustomizationControls } from "@/components/graph-customization-controls";
import type { DataPoint } from "@/components/real-time-chart";
import { RealTimeChart } from "@/components/real-time-chart";
import type { MqttConnectionStatus } from "@/components/mqtt-status-indicator";
import { MqttStatusIndicator } from "@/components/mqtt-status-indicator";
import { Icons } from "@/components/icons";
import { saveMqttData, type MqttDataPayload } from '@/services/firebase-service';


const MAX_DATA_POINTS = 200; // Keep the last N data points

export default function MqttVisualizerPage() {
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

  useEffect(() => {
    import('mqtt').then(module => {
      mqttModuleRef.current = module;
    });

    return () => {
      if (mqttClient) {
        mqttClient.end(true); 
      }
    };
  }, [mqttClient]);

  const handleConnect = useCallback(async ({ brokerUrl, topic, username, password }: ConnectFormValues) => {
    if (!mqttModuleRef.current) {
      toast({ title: "MQTT Error", description: "MQTT library not loaded yet.", variant: "destructive" });
      return;
    }
    if (mqttClient) {
      mqttClient.end(true, () => {
        setMqttClient(null); 
      });
    }

    setConnectionStatus("connecting");
    setDataPoints([]); 
    setCurrentTopic(topic);

    const options: IClientOptions = {
      keepalive: 60,
      reconnectPeriod: 5000, 
      connectTimeout: 20 * 1000,
      clean: true,
      protocolVersion: 5,
      username: username,
      password: password,
      protocol: brokerUrl.startsWith('wss') ? 'wss' : 
                brokerUrl.startsWith('ws') ? 'ws' : 
                brokerUrl.startsWith('mqtts') ? 'mqtts' : 'mqtt', // Deduce protocol for MQTT.js
    };
    
    // MQTT.js expects host and port separately for non-ws protocols
    // For ws/wss, it expects the full URL.
    let connectUrl = brokerUrl;
    if (!brokerUrl.startsWith('ws') && !brokerUrl.startsWith('wss')) {
      try {
        const urlParts = new URL(brokerUrl); // Handles mqtt://, mqtts://
        options.host = urlParts.hostname;
        options.port = parseInt(urlParts.port, 10);
        // For non-ws connections, MQTT.js takes protocol, host, port in options.
        // The connectUrl is not used by mqtt.connect(url, options) if options.host is set.
        // However, to be safe, we'll pass a minimal valid URL string if options.host is present.
        connectUrl = `${options.protocol}://${options.host}:${options.port}`;
      } catch (e) {
         toast({ title: "Connection Failed", description: "Invalid broker URL format for non-websocket connection.", variant: "destructive" });
         setConnectionStatus("error");
         return;
      }
    }


    try {
      // Pass connectUrl only if options.host is not set (i.e. for ws/wss)
      // otherwise, options will contain host, port, protocol etc.
      const client = options.host ? mqttModuleRef.current.connect(options) : mqttModuleRef.current.connect(connectUrl, options);
      setMqttClient(client);

      client.on("connect", () => {
        setConnectionStatus("connected");
        toast({ title: "MQTT Status", description: `Connected to ${brokerUrl}`});
        client.subscribe(topic, { qos: 0 }, (err) => { 
          if (err) {
            toast({ title: "Subscription Error", description: `Failed to subscribe to ${topic}: ${err.message}`, variant: "destructive" });
            setConnectionStatus("error");
          } else {
            toast({ title: "MQTT Status", description: `Subscribed to ${topic}` });
          }
        });
      });

      client.on("message", async (_topic: string, payload: Buffer, _packet: IPublishPacket) => {
        const messageStr = payload.toString();
        let valueForChart: number | undefined;
        let parsedPayload: MqttDataPayload | null = null;

        try {
          const jsonData = JSON.parse(messageStr);
          
          if (jsonData && typeof jsonData.device_serial === 'string' && typeof jsonData.tftvalue === 'object') {
            parsedPayload = jsonData as MqttDataPayload;

            // Try to find a numerical value in tftvalue for the chart
            const tftValues = Object.values(parsedPayload.tftvalue);
            const numericTftValue = tftValues.find(v => typeof parseFloat(String(v)) === 'number' && !isNaN(parseFloat(String(v))));
            if (numericTftValue !== undefined) {
              valueForChart = parseFloat(String(numericTftValue));
            }
          } else {
            // Fallback for simpler JSON or plain number
             if (typeof jsonData.value === 'number') {
                valueForChart = jsonData.value;
             } else if (Object.values(jsonData).some(v => typeof v === 'number')) {
                valueForChart = Object.values(jsonData).find(v => typeof v === 'number') as number;
             } else {
                valueForChart = parseFloat(messageStr); 
             }
          }
        } catch (e) {
          valueForChart = parseFloat(messageStr); 
        }
        
        if (valueForChart !== undefined && !isNaN(valueForChart)) {
          setDataPoints((prevData) => {
            const newDataPoint = { timestamp: Date.now(), value: valueForChart as number };
            const updatedData = [...prevData, newDataPoint];
            return updatedData.length > MAX_DATA_POINTS ? updatedData.slice(-MAX_DATA_POINTS) : updatedData;
          });
        } else {
             toast({ title: "Data Warning", description: `Received unparsable or non-numeric primary value: ${messageStr.substring(0,50)}...`, variant: "default" });
        }

        // Save to Firebase if valid structure
        if (parsedPayload && currentTopic) {
          try {
            await saveMqttData(currentTopic, parsedPayload);
            // Optional: toast success for saving, can be noisy
            // toast({ title: "Firebase", description: `Data saved for ${parsedPayload.device_serial}` });
          } catch (error: any) {
            toast({ title: "Firebase Error", description: `Failed to save data: ${error.message}`, variant: "destructive" });
          }
        }
      });

      client.on("error", (err) => {
        setConnectionStatus("error");
        toast({ title: "MQTT Error", description: err.message, variant: "destructive" });
        client.end(true); 
      });

      client.on("close", () => {
        if (connectionStatusRef.current !== "error" && connectionStatusRef.current !== "connecting") {
          setConnectionStatus("disconnected");
          toast({ title: "MQTT Status", description: "Disconnected from broker.", variant: "destructive" });
        }
      });

      client.on('offline', () => {
        setConnectionStatus("disconnected"); 
        toast({ title: "MQTT Status", description: "Broker is offline.", variant: "destructive" });
      });

    } catch (error: any) {
      setConnectionStatus("error");
      toast({ title: "Connection Failed", description: error.message || "Unknown error.", variant: "destructive" });
    }
  }, [toast, mqttClient]); // Added mqttClient back

  const connectionStatusRef = useRef(connectionStatus);
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);


  const handleDisconnect = useCallback(() => {
    if (mqttClient) {
      mqttClient.end(true, () => { 
          toast({ title: "MQTT Status", description: "Disconnected by user." });
          setConnectionStatus("disconnected");
          setMqttClient(null);
          setCurrentTopic(null);
      });
    }
  }, [mqttClient, toast]);

  const handleGraphConfigChange = useCallback((newConfig: Partial<GraphConfig>) => {
    setGraphConfig((prevConfig) => ({ ...prevConfig, ...newConfig }));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="p-4 md:p-6 border-b border-border shadow-md sticky top-0 bg-background z-50">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                 <Icons.LineChart className="h-8 w-8 text-primary" />
                <h1 className="text-2xl md:text-3xl font-bold text-primary">MQTT Data Visualizer</h1>
            </div>
            <MqttStatusIndicator status={connectionStatus} />
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-4 space-y-6">
            <MqttConnectForm
              onConnect={handleConnect}
              isConnecting={connectionStatus === "connecting"}
              isConnected={connectionStatus === "connected"}
              onDisconnect={handleDisconnect}
            />
            {connectionStatus === "connected" && (
              <GraphCustomizationControls config={graphConfig} onConfigChange={handleGraphConfigChange} />
            )}
          </div>
          <div className="lg:col-span-8">
            <RealTimeChart data={dataPoints} config={graphConfig} topic={currentTopic} />
          </div>
        </div>
      </main>

      <footer className="p-4 md:p-6 border-t border-border text-center mt-auto">
        <p className="text-sm text-muted-foreground">
          MQTT Data Visualizer &copy; {new Date().getFullYear()}. Built with Firebase & Next.js.
        </p>
      </footer>
    </div>
  );
}
