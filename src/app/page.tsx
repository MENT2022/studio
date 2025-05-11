
"use client";

import { useMemo } from 'react';
import { GraphCustomizationControls } from "@/components/graph-customization-controls";
import { DeviceDataView } from "@/components/device-data-view";
import { useMqtt } from "@/contexts/MqttContext";
import type { DataPoint } from '@/contexts/MqttContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GroupedDataByDevice {
  [deviceSerial: string]: DataPoint[];
}

export default function DashboardPage() {
  const {
    connectionStatus,
    dataPoints,
    graphConfig,
    handleGraphConfigChange,
  } = useMqtt();

  const groupedData = useMemo(() => {
    return dataPoints.reduce((acc, point) => {
      if (!acc[point.deviceSerial]) {
        acc[point.deviceSerial] = [];
      }
      acc[point.deviceSerial].push(point);
      // Keep only the latest MAX_DATA_POINTS per device for display purposes if needed,
      // or handle this within DeviceDataView/SensorChart if MAX_DATA_POINTS is global
      // For now, pass all points for the device.
      // acc[point.deviceSerial] = acc[point.deviceSerial].slice(-200); // Example: limit points per device
      return acc;
    }, {} as GroupedDataByDevice);
  }, [dataPoints]);

  const connectedDevices = Object.keys(groupedData);

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
        <div className="lg:col-span-8 space-y-8">
          {connectionStatus === "connected" && connectedDevices.length > 0 ? (
            connectedDevices.map(deviceSerial => (
              <DeviceDataView
                key={deviceSerial}
                deviceSerial={deviceSerial}
                deviceRawData={groupedData[deviceSerial]}
                graphConfig={graphConfig}
              />
            ))
          ) : connectionStatus === "connected" ? (
             <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Waiting for Data</CardTitle>
                <CardDescription>Connected to MQTT broker. No data received yet or no devices are sending data.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Once data is received, sensor charts will appear here.</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}
