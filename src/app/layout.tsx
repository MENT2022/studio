
import type { Metadata } from 'next';
import { Geist_Sans } from 'next/font/google'; 
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { MqttProvider } from '@/contexts/MqttContext';
import { AppLayoutClientBoundary } from './app-layout-client-boundary';

const geistSans = Geist_Sans({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
});

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
      <body className={`${geistSans.variable} antialiased bg-background text-foreground`}>
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
