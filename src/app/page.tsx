
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
  const connectionStatusRef = useRef(connectionStatus);
  const isManuallyDisconnectingRef = useRef<boolean>(false);

  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  // Effect for dynamically importing the MQTT.js library
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

    return () => {
      isMounted = false;
    };
  }, [toast]);

  // Effect for handling MQTT client cleanup
  useEffect(() => {
    return () => {
      if (mqttClient) {
        mqttClient.end(true);
      }
    };
  }, [mqttClient]);


  const handleConnect = useCallback(async ({ brokerUrl, topic, username, password }: ConnectFormValues) => {
    if (!mqttModuleRef.current) {
      toast({ title: "MQTT Error", description: "MQTT library not loaded yet. Please wait and try again.", variant: "destructive" });
      return;
    }
    
    if (typeof mqttModuleRef.current.connect !== 'function') {
      toast({ title: "MQTT Error", description: "MQTT 'connect' method is not available. Library might be corrupted or loaded incorrectly.", variant: "destructive" });
      console.error("handleConnect: mqttModuleRef.current.connect is not a function. Current value:", mqttModuleRef.current);
      return;
    }

    if (mqttClient) {
      isManuallyDisconnectingRef.current = true; // Indicate a deliberate client change
      mqttClient.end(true, () => {
        isManuallyDisconnectingRef.current = false; // Reset after old client is fully closed
      });
    }

    setConnectionStatus("connecting");
    setDataPoints([]);
    setCurrentTopic(topic);
    isManuallyDisconnectingRef.current = false; // Ensure it's false for a new connection attempt

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
                brokerUrl.startsWith('mqtts') ? 'mqtts' : 'mqtt',
    };

    let connectUrl = brokerUrl;
    if (!brokerUrl.startsWith('ws') && !brokerUrl.startsWith('wss') && !brokerUrl.startsWith('mqtts') && !brokerUrl.startsWith('mqtt')) {
      try {
        // Attempt to parse as a full URL if no protocol, default to mqtt or mqtts based on common ports
        // This part is tricky as mqtt.js has its own ways of handling host/port.
        // For non-ws, mqtt.js often prefers options.host and options.port.
        // Let's assume if it's not ws/wss, it might be a hostname:port or just hostname
        const urlParts = new URL(`mqtt://${brokerUrl}`); // Use dummy protocol for parsing
        options.host = urlParts.hostname;
        options.port = parseInt(urlParts.port, 10) || (options.protocol === 'mqtts' ? 8883 : 1883);
        // connectUrl is not strictly needed if options.host/port are set, but mqtt.js connect can take either
        connectUrl = `${options.protocol}://${options.host}:${options.port}`;
      } catch (e) {
         // If parsing fails, it might be a simple hostname. Let mqtt.js try with the original brokerUrl.
         // No specific error toast here, let the connection attempt fail naturally if needed.
      }
    }


    try {
      const client = options.host && options.port ? mqttModuleRef.current.connect(options) : mqttModuleRef.current.connect(connectUrl, options);
      setMqttClient(client);

      client.on("connect", () => {
        setConnectionStatus("connected");
        toast({ title: "MQTT Status", description: `Connected to ${brokerUrl}`});
        client.subscribe(topic, { qos: 0 }, (err) => {
          if (err) {
            toast({ title: "Subscription Error", description: `Failed to subscribe to ${topic}: ${err.message}`, variant: "destructive" });
            setConnectionStatus("error"); // Set status to error on subscription failure
            client.end(true); // Attempt to close client if subscription fails
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
            const tftValues = Object.values(parsedPayload.tftvalue);
            const numericTftValue = tftValues.find(v => typeof parseFloat(String(v)) === 'number' && !isNaN(parseFloat(String(v))));
            if (numericTftValue !== undefined) {
              valueForChart = parseFloat(String(numericTftValue));
            }
          } else {
             if (typeof jsonData.value === 'number') {
                valueForChart = jsonData.value;
             } else if (typeof jsonData === 'number') {
                valueForChart = jsonData;
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

        if (parsedPayload && currentTopic) {
          try {
            await saveMqttData(currentTopic, parsedPayload);
          } catch (error: any) {
            toast({ title: "Firebase Error", description: `Failed to save data: ${error.message}`, variant: "destructive" });
          }
        }
      });

      client.on("error", (err) => {
        if (connectionStatusRef.current !== "error") { // Avoid multiple error toasts
            setConnectionStatus("error");
            toast({ title: "MQTT Error", description: err.message, variant: "destructive" });
        }
        client.end(true); // Ensure client is closed on error
      });

      client.on("close", () => {
        if (isManuallyDisconnectingRef.current) {
          // Manual disconnect is handled by handleDisconnect's callback
          // We still ensure status is updated here in case callback is very delayed
          if (connectionStatusRef.current !== "disconnected") {
            setConnectionStatus("disconnected");
          }
          return;
        }

        // If 'offline' event already set status to 'disconnected' and showed a toast
        if (connectionStatusRef.current === "disconnected") {
            return;
        }

        if (connectionStatusRef.current === "connected") {
          setConnectionStatus("disconnected");
          toast({ title: "MQTT Status", description: "Disconnected from broker.", variant: "destructive" });
        } else if (connectionStatusRef.current === "connecting") {
          // If 'connecting' and 'close' occurs without 'connect' or 'error' it's a failed attempt
          if (connectionStatusRef.current !== "error") { // Avoid toast if 'error' already handled it
            setConnectionStatus("error");
            toast({ title: "Connection Failed", description: "Could not connect. Connection closed.", variant: "destructive" });
          }
        }
        // If connectionStatusRef.current was 'error', the 'error' handler already dealt with it.
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
    }
  }, [toast, mqttClient, currentTopic]); // Added currentTopic to dependencies, though it's set within this function.


  const handleDisconnect = useCallback(() => {
    if (mqttClient) {
      isManuallyDisconnectingRef.current = true;
      mqttClient.end(true, () => {
          toast({ title: "MQTT Status", description: "Disconnected by user." }); // Default variant is fine
          setConnectionStatus("disconnected");
          setMqttClient(null); 
          setCurrentTopic(null);
          isManuallyDisconnectingRef.current = false; // Reset ref
      });
    } else {
        // If no client, just ensure status is disconnected
        if (connectionStatus !== "disconnected") {
            setConnectionStatus("disconnected");
        }
    }
  }, [mqttClient, toast, connectionStatus]);

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
