"use client";

import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
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
import type { DataPoint } from '@/contexts/MqttContext'; // DataPoint now includes deviceSerial

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
  // Add more colors if more series are expected
  "hsl(200 80% 50%)", 
  "hsl(240 80% 50%)",
  "hsl(280 80% 50%)",
  "hsl(320 80% 50%)",
  "hsl(0 0% 50%)", // A gray for fallback
];

const SERIES_KEY_DELIMITER = '__'; // Using double underscore as a robust delimiter


interface RealTimeChartProps {
  data: DataPoint[];
  config: GraphConfig;
  topic: string | null;
}

export const RealTimeChart: FC<RealTimeChartProps> = ({ data, config, topic }) => {
  const [activeSeriesKeys, setActiveSeriesKeys] = useState<string[]>([]);

  useEffect(() => {
    const allSeries = new Set<string>();
    data.forEach(dp => {
      if (dp.values && dp.deviceSerial) { // Ensure deviceSerial exists
        Object.keys(dp.values).forEach(sensorKey => {
          allSeries.add(`${dp.deviceSerial}${SERIES_KEY_DELIMITER}${sensorKey}`);
        });
      }
    });
    setActiveSeriesKeys(Array.from(allSeries).sort());
  }, [data]);
  
  const chartData = useMemo(() => {
    if (activeSeriesKeys.length === 0 || data.length === 0) return [];

    // Group data by timestamp first
    const dataByTimestamp: Record<number, { timestamp: number; timeLabel: string; [key: string]: any }> = {};

    data.forEach(dp => {
        if (!dp.deviceSerial) return; // Skip if no deviceSerial

        if (!dataByTimestamp[dp.timestamp]) {
            dataByTimestamp[dp.timestamp] = {
                timestamp: dp.timestamp,
                timeLabel: format(new Date(dp.timestamp), 'HH:mm:ss'),
            };
            // Initialize all active series keys to null for this new timestamp
            activeSeriesKeys.forEach(seriesKey => {
                dataByTimestamp[dp.timestamp][seriesKey] = null;
            });
        }

        // Populate the values for the current data point's device and sensors
        if (dp.values) {
            Object.entries(dp.values).forEach(([sensorKey, sensorValue]) => {
                const seriesKey = `${dp.deviceSerial}${SERIES_KEY_DELIMITER}${sensorKey}`;
                if (activeSeriesKeys.includes(seriesKey)) { // Check if this series is active
                    dataByTimestamp[dp.timestamp][seriesKey] = sensorValue;
                }
            });
        }
    });
    
    return Object.values(dataByTimestamp).sort((a,b) => a.timestamp - b.timestamp);

  }, [data, activeSeriesKeys]);


  const CustomTooltip: FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPointForTimestamp = payload[0].payload; 
      return (
        <div className="p-3 border rounded-lg shadow-xl bg-popover text-popover-foreground text-sm">
          <p className="font-semibold mb-1">{`Time: ${format(new Date(dataPointForTimestamp.timestamp), 'PPpp')}`}</p>
          {payload.map((pld: any) => { 
            const seriesKey = pld.dataKey; 
            const value = pld.value;
            // Safely split the seriesKey
            const delimiterIndex = seriesKey.lastIndexOf(SERIES_KEY_DELIMITER);
            let deviceSerial = "Unknown";
            let sensorName = seriesKey;

            if (delimiterIndex !== -1) {
                deviceSerial = seriesKey.substring(0, delimiterIndex);
                sensorName = seriesKey.substring(delimiterIndex + SERIES_KEY_DELIMITER.length);
            }
            
            if (value !== null && value !== undefined) {
              return (
                <p key={seriesKey} style={{ color: pld.color }}>
                  {`${deviceSerial} - ${sensorName}: ${value.toLocaleString()}`}
                </p>
              );
            }
            return null;
          })}
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
          {activeSeriesKeys.length > 0 && (
            <span className="block text-xs mt-1">
              {/* Series: {activeSeriesKeys.map(k => k.replace(SERIES_KEY_DELIMITER, ' - ')).join(', ')} */}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-0 pb-4">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Waiting for data or no active series...</p>
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
                wrapperStyle={{fontSize: '10px', color: 'hsl(var(--card-foreground))', paddingTop: '10px', maxHeight: '60px', overflowY: 'auto', wordBreak: 'break-all'}}
                payload={activeSeriesKeys.map((seriesKey, index) => {
                    const delimiterIndex = seriesKey.lastIndexOf(SERIES_KEY_DELIMITER);
                    let displayValue = seriesKey;
                    if (delimiterIndex !== -1) {
                        const device = seriesKey.substring(0, delimiterIndex);
                        const sensor = seriesKey.substring(delimiterIndex + SERIES_KEY_DELIMITER.length);
                        displayValue = `${device} - ${sensor}`;
                    }
                    return {
                        value: displayValue,
                        type: 'line',
                        id: seriesKey,
                        color: lineColors[index % lineColors.length]
                    };
                })}
              />
              {activeSeriesKeys.map((seriesKey, index) => (
                <Line
                  key={seriesKey}
                  type="monotone"
                  dataKey={seriesKey} 
                  stroke={lineColors[index % lineColors.length]}
                  strokeWidth={config.lineThickness}
                  dot={false}
                  isAnimationActive={false} // Improves performance for fast-updating data
                  name={seriesKey.replace(SERIES_KEY_DELIMITER, ' - ')}
                  connectNulls={true} // Important for when a device doesn't send data for a tick
                />
              ))}
              {chartData.length > 1 && ( // Show Brush only if there's enough data
                <Brush 
                  dataKey="timeLabel" 
                  height={30} 
                  stroke={config.lineColor} 
                  travellerWidth={10} 
                  fill="hsl(var(--card) / 0.8)"
                  // y={385} // Adjust based on chart height or make dynamic. Removing fixed Y.
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

