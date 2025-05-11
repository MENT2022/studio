
"use client";

import type { FC } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Icons } from "@/components/icons";

const connectFormSchema = z.object({
  brokerUrl: z.string().min(1, "Broker URL is required.")
    .refine(url => {
      try {
        const parsedUrl = new URL(url);
        return ['mqtt:', 'mqtts:', 'ws:', 'wss:'].includes(parsedUrl.protocol);
      } catch (e) {
        // Allow hostnames without protocol for mqtt.js flexibility, it will try to infer
        // For direct mqtt/mqtts (non-websocket), mqtt.js often takes host/port separately.
        // This simplified check mainly ensures it's not an obviously invalid HTTP URL etc.
        return !url.startsWith('http://') && !url.startsWith('https://');
      }
    }, { message: "Invalid URL. Use mqtt(s)://host:port or ws(s)://host:port" }),
  topic: z.string().min(1, "Topic is required."),
  username: z.string().optional(),
  password: z.string().optional(),
});

export type ConnectFormValues = z.infer<typeof connectFormSchema>;

interface MqttConnectFormProps {
  onConnect: (values: ConnectFormValues) => void;
  isConnecting: boolean;
  isConnected: boolean;
  onDisconnect: () => void;
}

export const MqttConnectForm: FC<MqttConnectFormProps> = ({ onConnect, isConnecting, isConnected, onDisconnect }) => {
  const form = useForm<ConnectFormValues>({
    resolver: zodResolver(connectFormSchema),
    defaultValues: {
      brokerUrl: "mqtts://270e5d38ecbe4c2b89b7e54a787d3068.s1.eu.hivemq.cloud:8883",
      topic: "/TFT/Response",
      username: "calibrationDevice",
      password: "!+a7Sp9G8spZK}D",
    },
  });

  const handleSubmit = (values: ConnectFormValues) => {
    onConnect(values);
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">MQTT Connection</CardTitle>
        <CardDescription>Enter broker details, credentials, and topic to subscribe.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="brokerUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Broker URL</FormLabel>
                  <FormControl>
                    <Input placeholder="mqtts://broker.example.com:8883" {...field} disabled={isConnected || isConnecting} className="text-card-foreground bg-card border-border focus:ring-ring" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="your-username" {...field} disabled={isConnected || isConnecting} className="text-card-foreground bg-card border-border focus:ring-ring" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password (Optional)</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="your-password" {...field} disabled={isConnected || isConnecting} className="text-card-foreground bg-card border-border focus:ring-ring" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <FormControl>
                    <Input placeholder="device/sensor/temperature" {...field} disabled={isConnected || isConnecting} className="text-card-foreground bg-card border-border focus:ring-ring" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="pt-2">
              {isConnected ? (
                <Button type="button" onClick={onDisconnect} variant="destructive" className="w-full">
                  <Icons.WifiOff className="mr-2 h-4 w-4" /> Disconnect
                </Button>
              ) : (
                <Button type="submit" disabled={isConnecting} className="w-full">
                  {isConnecting ? (
                    <Icons.Loader className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.Wifi className="mr-2 h-4 w-4" />
                  )}
                  {isConnecting ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
