
import type { Metadata } from 'next';
// import { GeistSans } from 'geist/sans'; // Removed due to module resolution issues
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { MqttProvider } from '@/contexts/MqttContext';
import { AppLayoutClientBoundary } from './app-layout-client-boundary';

export const metadata: Metadata = {
  title: 'MQTT Data Visualizer',
  description: 'Visualize real-time MQTT data with dynamic graphs.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Removed GeistSans.variable from className */}
      <body className={`antialiased bg-background text-foreground`}>
        <MqttProvider>
          <AppLayoutClientBoundary>
            {children}
          </AppLayoutClientBoundary>
        </MqttProvider>
        <Toaster />
      </body>
    </html>
  );
}
