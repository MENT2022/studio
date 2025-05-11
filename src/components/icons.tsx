
import type { LucideProps } from 'lucide-react';
import { Wifi, WifiOff, Loader2, Palette, LineChart as LineChartIcon, Settings2, AlertTriangle, CheckCircle2, XCircle, Menu, Settings, Home, Activity, BarChart3, History as HistoryIcon, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Icons = {
  Wifi: (props: LucideProps) => <Wifi {...props} />,
  WifiOff: (props: LucideProps) => <WifiOff {...props} />,
  Loader: (props: LucideProps) => <Loader2 {...props} className={cn("animate-spin", props.className)} />,
  Palette: (props: LucideProps) => <Palette {...props} />,
  LineChart: (props: LucideProps) => <LineChartIcon {...props} />,
  Settings: (props: LucideProps) => <Settings {...props} />, // Changed from Settings2 to Settings for consistency if desired
  SettingsIcon: (props: LucideProps) => <Settings2 {...props} />, // Keep original Settings2 if needed
  AlertTriangle: (props: LucideProps) => <AlertTriangle {...props} />,
  CheckCircle: (props: LucideProps) => <CheckCircle2 {...props} />,
  XCircle: (props: LucideProps) => <XCircle {...props} />,
  Menu: (props: LucideProps) => <Menu {...props} />,
  Home: (props: LucideProps) => <Home {...props} />,
  Activity: (props: LucideProps) => <Activity {...props} />,
  BarChart3: (props: LucideProps) => <BarChart3 {...props} />,
  History: (props: LucideProps) => <HistoryIcon {...props} />,
  CalendarIcon: (props: LucideProps) => <CalendarDays {...props} />, // Added CalendarIcon
};

