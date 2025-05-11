
"use client"; // This page orchestrates client components

import type { MqttClient, IClientOptions, IPublishPacket } from 'mqtt';
import { useEffect, useState, useCallback, useRef } from 'react';
import { HomeIcon, SettingsIcon, ActivityIcon, BarChart3Icon } from 'lucide-react';

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
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const MAX_DATA_POINTS = 200; // Keep the last N data points
const HARDCODED_TOPIC = "/TFT/Response"; // Hardcoded topic

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


  const handleConnect = useCallback(async ({ brokerUrl, username, password }: ConnectFormValues) => {
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
      protocolVersion: 4, 
      username: username,
      password: password,
    };

    try {
      const client = mqttModuleRef.current.connect(brokerUrl, connectOptions);
      setMqttClient(client);

      client.on("connect", () => {
        setConnectionStatus("connected");
        toast({ title: "MQTT Status", description: `Connected to ${brokerUrl}`});
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
        let parsedPayload: MqttDataPayload | null = null;

        try {
          const jsonData = JSON.parse(messageStr);
          if (jsonData && typeof jsonData.device_serial === 'string' && typeof jsonData.tftvalue === 'object') {
            parsedPayload = jsonData as MqttDataPayload;
            const tftValues = Object.values(parsedPayload.tftvalue);
            const numericTftValue = tftValues.find(v => typeof parseFloat(String(v)) === 'number' && !isNaN(parseFloat(String(v))));
            if (numericTftValue !== undefined) valueForChart = parseFloat(String(numericTftValue));
          } else {
             if (typeof jsonData.value === 'number') valueForChart = jsonData.value;
             else if (typeof jsonData === 'number') valueForChart = jsonData;
             else if (Object.values(jsonData).some(v => typeof v === 'number'))  valueForChart = Object.values(jsonData).find(v => typeof v === 'number') as number;
             else valueForChart = parseFloat(messageStr); 
          }
        } catch (e) { valueForChart = parseFloat(messageStr); }
        
        if (valueForChart !== undefined && !isNaN(valueForChart)) {
          setDataPoints((prevData) => {
            const newDataPoint = { timestamp: Date.now(), value: valueForChart as number };
            const updatedData = [...prevData, newDataPoint];
            return updatedData.length > MAX_DATA_POINTS ? updatedData.slice(-MAX_DATA_POINTS) : updatedData;
          });
        } else {
             if (messageStr.trim() !== "") {
                // toast({ title: "Data Warning", description: `Received unparsable/non-numeric: ${messageStr.substring(0,30)}...`, variant: "default" });
             }
        }
        if (parsedPayload && currentTopic) {
          try { await saveMqttData(currentTopic, parsedPayload); } 
          catch (error: any) { toast({ title: "Firebase Error", description: `Failed to save data: ${error.message}`, variant: "destructive" }); }
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
  }, [toast, mqttClient]); 


  const handleDisconnect = useCallback(() => {
    if (mqttClient) {
      isManuallyDisconnectingRef.current = true;
      mqttClient.end(true, () => {
          toast({ title: "MQTT Status", description: "Disconnected by user." }); 
          setConnectionStatus("disconnected");
          setMqttClient(null); 
          setCurrentTopic(null);
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
    <SidebarProvider defaultOpen> {/* Apply dark theme via html tag or specific provider */}
      <Sidebar collapsible="icon" className="dark:bg-sidebar dark:text-sidebar-foreground border-r border-sidebar-border">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <BarChart3Icon className="h-8 w-8 text-primary" />
            <h2 className="text-xl font-semibold text-primary">MQTT Vis</h2>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Dashboard" isActive={true}> 
                <HomeIcon />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Data Monitoring">
                <ActivityIcon />
                <span>Monitoring</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Connection Settings">
                <SettingsIcon />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
            <span className="text-xs text-muted-foreground text-center">
                &copy; {new Date().getFullYear()}
            </span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="dark flex flex-col min-h-screen"> {/* Ensure SidebarInset itself is dark and flex col */}
        <header className="p-4 md:px-6 border-b border-border shadow-sm sticky top-0 bg-primary text-primary-foreground z-40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-primary-foreground hover:bg-primary/80">
                  <Icons.Settings className="h-6 w-6" />
                </Button>
              </SidebarTrigger>
              <SidebarTrigger className="hidden md:flex text-primary-foreground hover:bg-primary/80" />
              <h1 className="text-xl md:text-2xl font-bold">MQTT Data Visualizer</h1>
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

        <footer className="p-4 md:p-6 border-t border-border text-center bg-background text-muted-foreground">
          <p className="text-sm">
            MQTT Data Visualizer. Built with Firebase & Next.js.
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
