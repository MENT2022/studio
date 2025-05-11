
"use client";

import type { FC } from 'react';
import { useMemo } from 'react';
import { format } from 'date-fns';
import type { DataPoint } from '@/contexts/MqttContext';
import type { GraphConfig } from './graph-customization-controls';
import { SensorChart } from './sensor-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DeviceDataViewProps {
  deviceSerial: string;
  deviceRawData: DataPoint[];
  graphConfig: GraphConfig;
}

export interface SensorChartDataPoint {
  timestamp: number;
  L1?: number;
  L2?: number;
  L3?: number;
}

const SENSOR_PREFIXES = ['S1', 'S2', 'S3']; // Define the sensor prefixes

export const DeviceDataView: FC<DeviceDataViewProps> = ({ deviceSerial, deviceRawData, graphConfig }) => {
  const lastUpdateTime = useMemo(() => {
    if (deviceRawData.length === 0) return null;
    const latestPoint = deviceRawData.reduce((latest, point) => 
      point.timestamp > latest.timestamp ? point : latest
    );
    return latestPoint.timestamp;
  }, [deviceRawData]);

  const sensorDataGroups = useMemo(() => {
    const groups: Record<string, SensorChartDataPoint[]> = {};
    SENSOR_PREFIXES.forEach(prefix => {
      groups[prefix] = deviceRawData.map(dp => {
        const sensorPoint: SensorChartDataPoint = { timestamp: dp.timestamp };
        if (dp.values[`${prefix}_L1`] !== undefined) sensorPoint.L1 = dp.values[`${prefix}_L1`];
        if (dp.values[`${prefix}_L2`] !== undefined) sensorPoint.L2 = dp.values[`${prefix}_L2`];
        if (dp.values[`${prefix}_L3`] !== undefined) sensorPoint.L3 = dp.values[`${prefix}_L3`];
        return sensorPoint;
      }).sort((a,b) => a.timestamp - b.timestamp); // Ensure data is sorted by time for charts
    });
    return groups;
  }, [deviceRawData]);

  return (
    <Card className="shadow-lg w-full">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Device: {deviceSerial}</CardTitle>
        {lastUpdateTime && (
          <CardDescription>
            Last Update: {format(new Date(lastUpdateTime), 'HH:mm:ss')}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SENSOR_PREFIXES.map((prefix, index) => (
            <SensorChart
              key={prefix}
              sensorName={`Screen ${index + 1}`} // e.g., Screen 1, Screen 2
              sensorPrefix={prefix} // e.g., S1, S2
              sensorChartData={sensorDataGroups[prefix]}
              graphConfig={graphConfig}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

