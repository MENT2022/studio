"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
} from 'recharts';
import type { GraphConfig } from './graph-customization-controls';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DataPoint } from '@/contexts/MqttContext'; // Import DataPoint from MqttContext

// Define a palette for the lines
const lineColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--secondary-foreground))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))", 
  // Add more colors if more than 9 sensors are expected or cycle through them.
];


interface RealTimeChartProps {
  data: DataPoint[];
  config: GraphConfig;
  topic: string | null;
}

export const RealTimeChart: FC<RealTimeChartProps> = ({ data, config, topic }) => {
  const [sensorKeys, setSensorKeys] = useState<string[]>([]);

  useEffect(() => {
    if (data.length > 0 && data[0].values) {
      const keys = Object.keys(data[0].values).sort(); // Sort for consistent color assignment
      setSensorKeys(keys);
    } else {
      setSensorKeys([]);
    }
  }, [data]);
  
  // Transform data for chart: flatten sensor values into the main object
  const chartData = data.map(dp => ({
    timestamp: dp.timestamp,
    timeLabel: format(new Date(dp.timestamp), 'HH:mm:ss'),
    ...dp.values 
  }));

  const CustomTooltip: FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload; // The underlying data for this tick (already transformed)
      return (
        <div className="p-3 border rounded-lg shadow-xl bg-popover text-popover-foreground text-sm">
          <p className="font-semibold mb-1">{`Time: ${format(new Date(dataPoint.timestamp), 'PPpp')}`}</p>
          {sensorKeys.map((key, index) => (
            dataPoint[key] !== undefined && (
              <p key={key} style={{ color: lineColors[index % lineColors.length] }}>
                {`${key}: ${dataPoint[key].toLocaleString()}`}
              </p>
            )
          ))}
        </div>
      );
    }
    return null;
  };


  return (
    <Card className="w-full h-[500px] shadow-lg flex flex-col overflow-hidden">
      <CardHeader>
        <CardTitle className="text-2xl">Real-Time Data Stream</CardTitle>
        <CardDescription>
          {topic ? `Visualizing data from topic: ${topic}` : "Awaiting connection to visualize data."}
          {sensorKeys.length > 0 && ` Sensors: ${sensorKeys.join(', ')}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-0 pb-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Waiting for data...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
              {config.showXAxis && (
                <XAxis
                  dataKey="timeLabel"
                  stroke="hsl(var(--card-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
              )}
              {config.showYAxis && (
                <YAxis
                  stroke="hsl(var(--card-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString() : value}
                />
              )}
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--accent) / 0.2)'}}/>
              <Legend 
                wrapperStyle={{fontSize: '14px', color: 'hsl(var(--card-foreground))', paddingTop: '10px'}}
                payload={sensorKeys.map((key, index) => ({
                  value: key,
                  type: 'line',
                  id: key,
                  color: lineColors[index % lineColors.length]
                }))}
              />
              {sensorKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key} // Data key is now the sensor name directly (e.g., "S1_L1")
                  stroke={lineColors[index % lineColors.length]}
                  strokeWidth={config.lineThickness}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={200}
                  name={key}
                />
              ))}
              {data.length > 1 && (
                <Brush 
                  dataKey="timeLabel" 
                  height={30} 
                  stroke={config.lineColor} // Brush stroke can use the main configured color
                  travellerWidth={10} 
                  fill="hsl(var(--card) / 0.8)"
                  y={385}
                  tickFormatter={(index) => chartData[index]?.timeLabel}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
