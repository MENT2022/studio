
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HomeIcon, SettingsIcon, BarChart3Icon } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { MqttStatusIndicator } from "@/components/mqtt-status-indicator";
import { useMqtt } from '@/contexts/MqttContext';

export function AppLayoutClientBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { connectionStatus } = useMqtt();
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="dark:bg-sidebar dark:text-sidebar-foreground border-r border-sidebar-border">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <BarChart3Icon className="h-8 w-8 text-primary" />
            <h2 className="text-xl font-semibold text-primary">MQTT Vis</h2>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/" passHref legacyBehavior>
                <SidebarMenuButton tooltip="Dashboard" isActive={pathname === '/'}>
                  <HomeIcon />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/settings" passHref legacyBehavior>
                <SidebarMenuButton tooltip="Connection Settings" isActive={pathname === '/settings'}>
                  <SettingsIcon />
                  <span>Settings</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
          <span className="text-xs text-muted-foreground text-center">
            &copy; {currentYear !== null ? currentYear : '...'}
          </span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="dark flex flex-col min-h-screen">
        <header className="p-4 md:px-6 border-b border-border shadow-sm sticky top-0 bg-primary text-primary-foreground z-40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-primary-foreground hover:bg-primary/80">
                  <Icons.Menu className="h-6 w-6" />
                </Button>
              </SidebarTrigger>
              <SidebarTrigger className="hidden md:flex text-primary-foreground hover:bg-primary/80" />
              <h1 className="text-xl md:text-2xl font-bold">MQTT Data Visualizer</h1>
            </div>
            <MqttStatusIndicator status={connectionStatus} />
          </div>
        </header>

        {children} {/* Page content goes here */}

        <footer className="p-4 md:p-6 border-t border-border text-center bg-background text-muted-foreground">
          <p className="text-sm">
            MQTT Data Visualizer. Built with Firebase & Next.js.
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
