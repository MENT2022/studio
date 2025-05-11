
"use client";

import type { FC } from 'react';
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

export type MqttConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface MqttStatusIndicatorProps {
  status: MqttConnectionStatus;
}

export const MqttStatusIndicator: FC<MqttStatusIndicatorProps> = ({ status }) => {
  let icon: JSX.Element;
  let text: string;
  let badgeClasses: string = "border-border"; // Default border

  switch (status) {
    case "connected":
      icon = <Icons.CheckCircle className="h-4 w-4 text-green-500" />;
      text = "Connected";
      badgeClasses = "bg-green-500/20 text-green-700 border-green-500/50 dark:text-green-400 dark:border-green-500/70 dark:bg-green-500/10";
      break;
    case "connecting":
      icon = <Icons.Loader className="h-4 w-4 animate-spin text-blue-500" />;
      text = "Connecting...";
      badgeClasses = "bg-blue-500/20 text-blue-700 border-blue-500/50 dark:text-blue-400 dark:border-blue-500/70 dark:bg-blue-500/10";
      break;
    case "error":
      icon = <Icons.AlertTriangle className="h-4 w-4 text-red-500" />;
      text = "Error";
      badgeClasses = "bg-red-500/20 text-red-700 border-red-500/50 dark:text-red-400 dark:border-red-500/70 dark:bg-red-500/10";
      break;
    case "disconnected":
    default:
      icon = <Icons.XCircle className="h-4 w-4 text-muted-foreground" />;
      text = "Disconnected";
      badgeClasses = "bg-muted text-muted-foreground border-border";
      break;
  }

  return (
    <Badge variant="outline" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-full shadow-sm ${badgeClasses}`}>
      {icon}
      <span>{text}</span>
    </Badge>
  );
};
