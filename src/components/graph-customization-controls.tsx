
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface GraphConfig {
  lineColor: string;
  lineThickness: number;
  showXAxis: boolean;
  showYAxis: boolean;
  showGrid: boolean;
}

interface GraphCustomizationControlsProps {
  config: GraphConfig;
  onConfigChange: (newConfig: Partial<GraphConfig>) => void;
}

export const GraphCustomizationControls: FC<GraphCustomizationControlsProps> = ({ config, onConfigChange }) => {
  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Graph Customization</CardTitle>
        <CardDescription>Adjust the appearance of the data visualization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="lineColor">Line Color</Label>
            <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal border-border hover:bg-accent/50"
                >
                    <div className="w-5 h-5 rounded-sm border mr-2" style={{ background: config.lineColor }} />
                    <span className="text-card-foreground">{config.lineColor}</span>
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Input
                        id="lineColor"
                        type="color"
                        value={config.lineColor}
                        onChange={(e) => onConfigChange({ lineColor: e.target.value })}
                        className="p-1 h-10 w-full border-none cursor-pointer rounded-md bg-card" // Full width color picker with card background
                    />
                </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lineThickness">Line Thickness ({config.lineThickness}px)</Label>
          <Slider
            id="lineThickness"
            min={1}
            max={10}
            step={1}
            value={[config.lineThickness]}
            onValueChange={(value) => onConfigChange({ lineThickness: value[0] })}
          />
        </div>

        <div className="flex items-center justify-between space-x-2 py-2">
          <Label htmlFor="showXAxis" className="flex flex-col space-y-1">
            <span>Show X-Axis</span>
          </Label>
          <Switch
            id="showXAxis"
            checked={config.showXAxis}
            onCheckedChange={(checked) => onConfigChange({ showXAxis: checked })}
          />
        </div>

        <div className="flex items-center justify-between space-x-2 py-2">
          <Label htmlFor="showYAxis" className="flex flex-col space-y-1">
            <span>Show Y-Axis</span>
          </Label>
          <Switch
            id="showYAxis"
            checked={config.showYAxis}
            onCheckedChange={(checked) => onConfigChange({ showYAxis: checked })}
          />
        </div>

        <div className="flex items-center justify-between space-x-2 py-2">
          <Label htmlFor="showGrid" className="flex flex-col space-y-1">
            <span>Show Grid</span>
          </Label>
          <Switch
            id="showGrid"
            checked={config.showGrid}
            onCheckedChange={(checked) => onConfigChange({ showGrid: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
};
