"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, orderBy, query, Timestamp, where, DocumentData, QueryDocumentSnapshot, QueryConstraint } from "firebase/firestore";
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
import { CalendarIcon, DatabaseZapIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/icons";

export default function HistoricPage() {
  const [historicData, setHistoricData] = useState<FetchedMqttRecord[]>([]);
  const [allSensorKeys, setAllSensorKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStartDate, setCurrentStartDate] = useState<Date | undefined>(undefined);
  const [currentEndDate, setCurrentEndDate] = useState<Date | undefined>(undefined);

  const fetchData = useCallback(async (sDate?: Date, eDate?: Date) => {
    if (!db) {
      setError("Firestore is not initialized.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const qBase = collection(db, "mqtt_records");
      const qConstraints: QueryConstraint[] = [orderBy("receivedAt", "desc")];

      if (sDate) {
        qConstraints.push(where("receivedAt", ">=", Timestamp.fromDate(sDate)));
      }
      if (eDate) {
        const endOfDay = new Date(eDate);
        endOfDay.setHours(23, 59, 59, 999); 
        qConstraints.push(where("receivedAt", "<=", Timestamp.fromDate(endOfDay)));
      }
      
      const finalQuery = query(qBase, ...qConstraints);
      
      const querySnapshot = await getDocs(finalQuery);
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
  }, []); // db is stable from import, so empty dependency array is fine.

  const handleFetchFilteredData = () => {
    fetchData(currentStartDate, currentEndDate);
  };

  const handleFetchAllData = () => {
    setCurrentStartDate(undefined);
    setCurrentEndDate(undefined);
    fetchData(); // No arguments means fetch all
  };

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
            Browse structured data received from your MQTT broker. Filter by date range or fetch all records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end flex-wrap">
            <div className="grid w-full sm:w-auto max-w-xs items-center gap-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="startDate"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal text-card-foreground",
                      !currentStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {currentStartDate ? format(currentStartDate, "PPP") : <span>Pick a start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={currentStartDate}
                    onSelect={setCurrentStartDate}
                    initialFocus
                    className="bg-card text-card-foreground"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid w-full sm:w-auto max-w-xs items-center gap-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="endDate"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal text-card-foreground",
                      !currentEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {currentEndDate ? format(currentEndDate, "PPP") : <span>Pick an end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={currentEndDate}
                    onSelect={setCurrentEndDate}
                    disabled={(date) =>
                      currentStartDate ? date < currentStartDate : false
                    }
                    initialFocus
                    className="bg-card text-card-foreground"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleFetchFilteredData} disabled={loading} className="w-full sm:w-auto">
              {loading ? <Icons.Loader className="mr-2" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
              {loading ? "Fetching..." : "Fetch by Date"}
            </Button>
             <Button onClick={handleFetchAllData} disabled={loading} className="w-full sm:w-auto" variant="secondary">
              {loading ? <Icons.Loader className="mr-2" /> : <DatabaseZapIcon className="mr-2 h-4 w-4" />}
              {loading ? "Fetching All..." : "Fetch All Data"}
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
                          {/* Ensure item[key] is accessed safely and converted to string */}
                          {item[key as keyof FetchedMqttRecord] !== undefined 
                            ? String(item[key as keyof FetchedMqttRecord])
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

