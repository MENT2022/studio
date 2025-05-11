
"use client";

import type { FC } from 'react';
import { useMemo } from 'react';
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
} from 'recharts';
import type { GraphConfig } from './graph-customization-controls';
import type { SensorChartDataPoint } from './device-data-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SensorChartProps {
  sensorName: string;
  sensorPrefix: string;
  sensorChartData: SensorChartDataPoint[];
  graphConfig: GraphConfig;
}

const lineColors = {
  L1: "hsl(var(--chart-1))", // Typically red-ish
  L2: "hsl(var(--chart-2))", // Typically blue-ish/green-ish
  L3: "hsl(var(--chart-4))", // Typically yellow-ish/orange-ish
};

const CustomTooltip: FC<any> = ({ active, payload, label, sensorPrefix }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 border rounded-lg shadow-lg bg-popover text-popover-foreground text-xs">
        <p className="font-semibold mb-1">{`Time: ${label}`}</p>
        {payload.map((pld: any) => (
          <p key={pld.dataKey} style={{ color: pld.stroke }}>
            {`${sensorPrefix}_${pld.dataKey}: ${pld.value !== undefined && pld.value !== null ? pld.value.toFixed(2) : 'N/A'}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};


export const SensorChart: FC<SensorChartProps> = ({ sensorName, sensorPrefix, sensorChartData, graphConfig }) => {
  const latestValues = useMemo(() => {
    if (sensorChartData.length === 0) return { L1: 'N/A', L2: 'N/A', L3: 'N/A' };
    const lastPoint = sensorChartData[sensorChartData.length - 1];
    return {
      L1: lastPoint.L1 !== undefined ? lastPoint.L1.toFixed(2) : 'N/A',
      L2: lastPoint.L2 !== undefined ? lastPoint.L2.toFixed(2) : 'N/A',
      L3: lastPoint.L3 !== undefined ? lastPoint.L3.toFixed(2) : 'N/A',
    };
  }, [sensorChartData]);

  const chartFriendlyData = useMemo(() => {
    return sensorChartData.map(dp => ({
      ...dp,
      timeLabel: format(new Date(dp.timestamp), 'HH:mm:ss'),
    }));
  }, [sensorChartData]);

  return (
    <Card className="w-full shadow-md flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base font-semibold">{sensorName}</CardTitle>
        <CardDescription className="text-xs">
          <div>Line 1: {latestValues.L1}</div>
          <div>Line 2: {latestValues.L2}</div>
          <div>Line 3: {latestValues.L3}</div>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-0 pb-2 px-2 h-[200px]"> {/* Fixed height for small charts */}
        {chartFriendlyData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-xs">No data</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartFriendlyData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}> {/* Adjusted margins */}
              {graphConfig.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
              {graphConfig.showXAxis && (
                <XAxis
                  dataKey="timeLabel"
                  stroke="hsl(var(--card-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  angle={-30}
                  textAnchor="end"
                  height={30}
                  interval="preserveStartEnd" // Show ticks more sparsely
                />
              )}
              {graphConfig.showYAxis && (
                <YAxis
                  stroke="hsl(var(--card-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => typeof value === 'number' ? value.toFixed(1) : value}
                  width={30}
                />
              )}
              <Tooltip content={<CustomTooltip sensorPrefix={sensorPrefix} />} cursor={{fill: 'hsl(var(--accent) / 0.2)'}}/>
              <Legend wrapperStyle={{fontSize: '10px', paddingTop: '0px', marginBottom: '5px' }} height={25} />

              {['L1', 'L2', 'L3'].map((lineKey) => (
                <Line
                  key={lineKey}
                  type="monotone"
                  dataKey={lineKey}
                  stroke={lineColors[lineKey as keyof typeof lineColors]}
                  strokeWidth={graphConfig.lineThickness}
                  dot={false}
                  isAnimationActive={false}
                  name={lineKey}
                  connectNulls={true}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
