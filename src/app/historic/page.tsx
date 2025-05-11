"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, orderBy, query, Timestamp, where, DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FetchedMqttRecord } from "@/services/firebase-service"; 
import { fromFirestore } from "@/services/firebase-service"; 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/icons";

export default function HistoricPage() {
  const [historicData, setHistoricData] = useState<FetchedMqttRecord[]>([]);
  const [allSensorKeys, setAllSensorKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const fetchData = useCallback(async () => {
    if (!db) {
      setError("Firestore is not initialized.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      let q = query(collection(db, "mqtt_records"), orderBy("receivedAt", "desc"));

      if (startDate) {
        q = query(q, where("receivedAt", ">=", Timestamp.fromDate(startDate)));
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999); 
        q = query(q, where("receivedAt", "<=", Timestamp.fromDate(endOfDay)));
      }
      
      const querySnapshot = await getDocs(q);
      const dataPromises = querySnapshot.docs.map(doc => fromFirestore(doc as QueryDocumentSnapshot<DocumentData>));
      const resolvedData = await Promise.all(dataPromises);
      const filteredData = resolvedData.filter(record => record !== null) as FetchedMqttRecord[];
      
      setHistoricData(filteredData);
    } catch (err: any) {
      console.error("Error fetching historic data:", err);
      setError(`Failed to load data: ${err.message}`);
      setHistoricData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (historicData.length > 0) {
      const keys = new Set<string>();
      historicData.forEach(record => {
        Object.keys(record).forEach(key => {
          if (!['id', 'receivedAt', 'device_serial', 'topic', 'rawPayload'].includes(key)) {
            keys.add(key);
          }
        });
      });
      setAllSensorKeys(Array.from(keys).sort());
    } else {
      setAllSensorKeys([]);
    }
  }, [historicData]);


  return (
    <main className="flex-grow container mx-auto p-4 md:p-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Historic MQTT Data</CardTitle>
          <CardDescription>
            Browse structured data received from your MQTT broker. Filter by date range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="startDate"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal text-card-foreground",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="bg-card text-card-foreground"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="endDate"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal text-card-foreground",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick an end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) =>
                      startDate ? date < startDate : false
                    }
                    initialFocus
                    className="bg-card text-card-foreground"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={fetchData} disabled={loading} className="w-full sm:w-auto">
              {loading ? <Icons.Loader className="mr-2" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
              {loading ? "Fetching..." : "Fetch Data"}
            </Button>
          </div>

          {loading && <p className="text-muted-foreground text-center py-4">Loading historic data...</p>}
          {error && <p className="text-destructive text-center py-4">{error}</p>}
          
          {!loading && !error && historicData.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              No historic data found for the selected criteria. Please adjust filters or ensure data exists.
            </p>
          )}

          {!loading && !error && historicData.length > 0 && (
            <ScrollArea className="h-[600px] rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[200px]">Received At</TableHead>
                    <TableHead className="w-[180px]">Device Serial</TableHead>
                    <TableHead>Topic</TableHead>
                    {allSensorKeys.map(key => (
                      <TableHead key={key} className="w-[80px] text-center">{key}</TableHead>
                    ))}
                    <TableHead className="min-w-[250px]">Raw Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.receivedAt instanceof Date 
                          ? format(item.receivedAt, 'yyyy-MM-dd HH:mm:ss.SSS') 
                          : 'Invalid Date'}
                      </TableCell>
                      <TableCell>{item.device_serial}</TableCell>
                      <TableCell>{item.topic}</TableCell>
                      {allSensorKeys.map(key => (
                        <TableCell key={key} className="text-center">
                          {item[key] !== undefined 
                            ? String(item[key])
                            : '-'}
                        </TableCell>
                      ))}
                      <TableCell className="max-w-xs">
                         <pre className="whitespace-pre-wrap break-all text-xs">{item.rawPayload}</pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
