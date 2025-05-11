
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
  brokerUrl: z.string().url({ message: "Invalid URL. Include protocol (e.g., ws:// or wss://)" }).min(1, "Broker URL is required."),
  topic: z.string().min(1, "Topic is required."),
});

type ConnectFormValues = z.infer<typeof connectFormSchema>;

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
      brokerUrl: "wss://test.mosquitto.org:8081", // Default public broker for testing
      topic: "visualizer/test/data",
    },
  });

  const handleSubmit = (values: ConnectFormValues) => {
    onConnect(values);
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">MQTT Connection</CardTitle>
        <CardDescription>Enter broker details and topic to subscribe.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="brokerUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Broker URL</FormLabel>
                  <FormControl>
                    <Input placeholder="wss://broker.example.com:8081" {...field} disabled={isConnected || isConnecting} className="text-card-foreground bg-card border-border focus:ring-ring" />
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
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
