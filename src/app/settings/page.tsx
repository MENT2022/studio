
"use client";

import { MqttConnectForm } from "@/components/mqtt-connect-form";
import { useMqtt } from "@/contexts/MqttContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


export default function SettingsPage() {
  const { connectMqtt, disconnectMqtt, connectionStatus } = useMqtt();

  return (
    <main className="flex-grow container mx-auto p-4 md:p-6 flex justify-center items-start">
      <div className="w-full max-w-md space-y-6">
        <MqttConnectForm
          onConnect={connectMqtt}
          isConnecting={connectionStatus === "connecting"}
          isConnected={connectionStatus === "connected"}
          onDisconnect={disconnectMqtt}
        />
         {connectionStatus !== "connected" && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Data Visualization</CardTitle>
                    <CardDescription>Connect to an MQTT broker to see real-time data visualizations on the Dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Once connected, data from the subscribed topic will appear on the Dashboard page.
                        You can customize the graph appearance there as well.
                    </p>
                </CardContent>
            </Card>
        )}
      </div>
    </main>
  );
}
