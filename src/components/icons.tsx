
import type { LucideProps } from 'lucide-react';
import { Wifi, WifiOff, Loader2, Palette, LineChart as LineChartIcon, Settings2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Icons = {
  Wifi: (props: LucideProps) => <Wifi {...props} />,
  WifiOff: (props: LucideProps) => <WifiOff {...props} />,
  Loader: (props: LucideProps) => <Loader2 {...props} className={cn("animate-spin", props.className)} />,
  Palette: (props: LucideProps) => <Palette {...props} />,
  LineChart: (props: LucideProps) => <LineChartIcon {...props} />,
  Settings: (props: LucideProps) => <Settings2 {...props} />,
  AlertTriangle: (props: LucideProps) => <AlertTriangle {...props} />,
  CheckCircle: (props: LucideProps) => <CheckCircle2 {...props} />,
  XCircle: (props: LucideProps) => <XCircle {...props} />,
};
