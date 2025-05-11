
"use client"; // This page orchestrates client components

import type { MqttClient, IClientOptions, IPublishPacket } from 'mqtt';
import { useEffect, useState, useCallback, useRef } from 'react';

import { useToast } from "@/hooks/use-toast";
import { MqttConnectForm } from "@/components/mqtt-connect-form";
import type { GraphConfig } from "@/components/graph-customization-controls";
import { GraphCustomizationControls } from "@/components/graph-customization-controls";
import type { DataPoint } from "@/components/real-time-chart";
import { RealTimeChart } from "@/components/real-time-chart";
import type { MqttConnectionStatus } from "@/components/mqtt-status-indicator";
import { MqttStatusIndicator } from "@/components/mqtt-status-indicator";
import { Icons } from "@/components/icons";

const MAX_DATA_POINTS = 200; // Keep the last N data points

export default function MqttVisualizerPage() {
  const [mqttClient, setMqttClient] = useState<MqttClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<MqttConnectionStatus>("disconnected");
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const { toast } = useToast();

  const [graphConfig, setGraphConfig] = useState<GraphConfig>({
    lineColor: "hsl(var(--primary))", // Use HSL variable for Teal
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
        mqttClient.end(true); // force close connection when component unmounts
      }
    };
  }, [mqttClient]);

  const handleConnect = useCallback(async ({ brokerUrl, topic }: { brokerUrl: string; topic: string }) => {
    if (!mqttModuleRef.current) {
      toast({ title: "MQTT Error", description: "MQTT library not loaded yet.", variant: "destructive" });
      return;
    }
    if (mqttClient) {
       // End previous client gracefully before creating a new one
      mqttClient.end(true, () => {
        setMqttClient(null); 
      });
    }

    setConnectionStatus("connecting");
    setDataPoints([]); 
    setCurrentTopic(topic);

    const options: IClientOptions = {
      keepalive: 60,
      reconnectPeriod: 5000, // Try to reconnect every 5 seconds
      connectTimeout: 20 * 1000, // 20 seconds
      clean: true, // Clean session
      protocolVersion: 5, // Using MQTT 5 for better error reporting if supported by broker
    };

    try {
      const client = mqttModuleRef.current.connect(brokerUrl, options);
      setMqttClient(client);

      client.on("connect", () => {
        setConnectionStatus("connected");
        toast({ title: "MQTT Status", description: `Connected to ${brokerUrl}`});
        client.subscribe(topic, { qos: 0 }, (err) => { // Using QoS 0 for visualization
          if (err) {
            toast({ title: "Subscription Error", description: `Failed to subscribe to ${topic}: ${err.message}`, variant: "destructive" });
            setConnectionStatus("error");
          } else {
            toast({ title: "MQTT Status", description: `Subscribed to ${topic}` });
          }
        });
      });

      client.on("message", (_topic: string, payload: Buffer, _packet: IPublishPacket) => {
        const messageStr = payload.toString();
        let value: number | undefined;
        try {
          const parsedJson = JSON.parse(messageStr);
          if (typeof parsedJson.value === 'number') {
            value = parsedJson.value;
          } else if (Object.values(parsedJson).some(v => typeof v === 'number')) {
            value = Object.values(parsedJson).find(v => typeof v === 'number') as number;
          } else {
             value = parseFloat(messageStr); // Try to parse as plain number
          }
        } catch (e) {
          value = parseFloat(messageStr); // Fallback to plain number if JSON parsing fails
        }
        
        if (value !== undefined && !isNaN(value)) {
          setDataPoints((prevData) => {
            const newDataPoint = { timestamp: Date.now(), value: value as number };
            const updatedData = [...prevData, newDataPoint];
            return updatedData.length > MAX_DATA_POINTS ? updatedData.slice(-MAX_DATA_POINTS) : updatedData;
          });
        } else {
            // console.warn("Received non-numeric or unparsable message:", messageStr);
             toast({ title: "Data Warning", description: `Received unparsable message: ${messageStr.substring(0,50)}...`, variant: "default" });
        }
      });

      client.on("error", (err) => {
        setConnectionStatus("error");
        toast({ title: "MQTT Error", description: err.message, variant: "destructive" });
        client.end(true); // Force close on error
      });

      client.on("close", () => {
        // Only set to disconnected if not already in error state or trying to connect
        if (connectionStatusRef.current !== "error" && connectionStatusRef.current !== "connecting") {
          setConnectionStatus("disconnected");
          toast({ title: "MQTT Status", description: "Disconnected from broker.", variant: "destructive" });
        }
      });

      client.on('offline', () => {
        setConnectionStatus("disconnected"); // Broker went offline
        toast({ title: "MQTT Status", description: "Broker is offline.", variant: "destructive" });
      });

    } catch (error: any) {
      setConnectionStatus("error");
      toast({ title: "Connection Failed", description: error.message || "Unknown error.", variant: "destructive" });
    }
  }, [toast]); // Removed mqttClient from dependencies to avoid re-creating connect function on client change

  // Ref to keep track of current connection status for close event handler
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
          MQTT Data Visualizer &copy; {new Date().getFullYear()}.
        </p>
      </footer>
    </div>
  );
}
