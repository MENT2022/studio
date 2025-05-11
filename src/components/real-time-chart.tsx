
"use client";

import type { FC } from 'react';
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

export interface DataPoint {
  timestamp: number; // Unix timestamp (milliseconds)
  value: number;
}

interface RealTimeChartProps {
  data: DataPoint[];
  config: GraphConfig;
  topic: string | null;
}

export const RealTimeChart: FC<RealTimeChartProps> = ({ data, config, topic }) => {
  // Transform data for chart, ensuring timestamps are used for x-axis key if 'name' is not ideal
  const chartData = data.map(dp => ({...dp, timeLabel: format(new Date(dp.timestamp), 'HH:mm:ss')}));

  const CustomTooltip: FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Assuming payload[0].payload contains the original DataPoint with 'timestamp' and 'value'
      const dataPoint = payload[0].payload;
      return (
        <div className="p-3 border rounded-lg shadow-xl bg-popover text-popover-foreground text-sm">
          <p className="font-semibold mb-1">{`Time: ${format(new Date(dataPoint.timestamp), 'PPpp')}`}</p>
          <p className="text-primary">{`Value: ${dataPoint.value.toLocaleString()}`}</p>
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
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-0 pb-4"> {/* Added pb-4 for Brush space */}
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
                  dataKey="timeLabel" // Use the formatted time label
                  stroke="hsl(var(--card-foreground))" // Use card-foreground for axis text on card
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  angle={-15} // Angle ticks slightly for better readability if crowded
                  textAnchor="end"
                  height={50} // Allocate space for angled labels
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
                payload={[{ value: topic || 'Value', type: 'line', color: config.lineColor }]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.lineColor}
                strokeWidth={config.lineThickness}
                dot={false} // No dots for smoother line with many points
                isAnimationActive={true}
                animationDuration={200} // Faster animation for real-time feel
                name={topic || "Value"}
              />
              {data.length > 1 && ( // Show Brush only if there's enough data
                <Brush 
                  dataKey="timeLabel" 
                  height={30} 
                  stroke={config.lineColor} 
                  travellerWidth={10} 
                  fill="hsl(var(--card) / 0.8)" // Use card background for brush fill
                  y={385} // Adjust position to be at the bottom of the chart area
                  tickFormatter={(index) => chartData[index]?.timeLabel} // Ensure labels in brush match main chart
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
