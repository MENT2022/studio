
"use client";

import { GraphCustomizationControls } from "@/components/graph-customization-controls";
import { RealTimeChart } from "@/components/real-time-chart";
import { useMqtt } from "@/contexts/MqttContext";

export default function DashboardPage() {
  const {
    connectionStatus,
    dataPoints,
    currentTopic,
    graphConfig,
    handleGraphConfigChange,
  } = useMqtt();

  return (
    <main className="flex-grow container mx-auto p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-4 space-y-6">
          {connectionStatus === "connected" && (
            <GraphCustomizationControls
              config={graphConfig}
              onConfigChange={handleGraphConfigChange}
            />
          )}
           {connectionStatus !== "connected" && (
             <div className="p-4 bg-card rounded-lg shadow-lg text-center text-card-foreground">
                <p className="text-lg font-semibold">Connect to MQTT</p>
                <p className="text-sm text-muted-foreground">Please go to the Settings page to configure your MQTT connection.</p>
             </div>
           )}
        </div>
        <div className="lg:col-span-8">
          <RealTimeChart
            data={dataPoints}
            config={graphConfig}
            topic={currentTopic}
          />
        </div>
      </div>
    </main>
  );
}
