
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, orderBy, query, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FirebaseStoredData } from "@/services/firebase-service";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react"; // Changed from CalendarDays
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/icons";


export default function HistoricPage() {
  const [historicData, setHistoricData] = useState<FirebaseStoredData[]>([]);
  const [loading, setLoading] = useState(false); // Initially not loading
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
      setError(null); // Clear previous errors

      let q = query(collection(db, "mqtt_data"), orderBy("receivedAt", "desc"));

      if (startDate) {
        q = query(q, where("receivedAt", ">=", Timestamp.fromDate(startDate)));
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999); // To include the whole end day
        q = query(q, where("receivedAt", "<=", Timestamp.fromDate(endOfDay)));
      }
      
      const querySnapshot = await getDocs(q);
      const data: FirebaseStoredData[] = [];
      querySnapshot.forEach((doc) => {
        // Ensure id is included if needed, and receivedAt is correctly handled
        const docData = doc.data();
        data.push({ 
          id: doc.id, 
          ...docData,
          // Firestore Timestamps need to be converted to Date objects if they are not already
          // For Firebase v9+, Timestamps are usually retrieved as Timestamp objects
          // and `toDate()` method is available.
          receivedAt: docData.receivedAt instanceof Timestamp ? docData.receivedAt : (docData.receivedAt && typeof docData.receivedAt.toDate === 'function' ? docData.receivedAt : new Timestamp(0,0) ) // Fallback to epoch if invalid
        } as FirebaseStoredData);
      });
      setHistoricData(data);
    } catch (err: any) {
      console.error("Error fetching historic data:", err);
      setError(`Failed to load data: ${err.message}`);
      setHistoricData([]); // Clear data on error
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // useEffect(() => {
  //   // Fetch data when component mounts or when dates change (if desired)
  //   // For now, we fetch on button click.
  //   // fetchData(); // Remove this if you want to fetch only on button click
  // }, [fetchData]);


  return (
    <main className="flex-grow container mx-auto p-4 md:p-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Historic MQTT Data</CardTitle>
          <CardDescription>
            Browse data received from your MQTT broker. Filter by date range.
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
                      "w-full justify-start text-left font-normal",
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
                      "w-full justify-start text-left font-normal",
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
                    <TableHead className="w-[220px]">Received At</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead className="min-w-[300px]">Raw Payload</TableHead>
                    <TableHead className="w-[100px]">Parsed?</TableHead>
                    <TableHead className="w-[100px]">Schema OK?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {/* Ensure item.receivedAt is a Date object or can be converted */}
                        {item.receivedAt instanceof Timestamp 
                          ? format(item.receivedAt.toDate(), 'yyyy-MM-dd HH:mm:ss.SSS') 
                          : (item.receivedAt && typeof (item.receivedAt as any).toDate === 'function' 
                              ? format((item.receivedAt as any).toDate(), 'yyyy-MM-dd HH:mm:ss.SSS')
                              : 'Invalid Date')}
                      </TableCell>
                      <TableCell>{item.topic}</TableCell>
                      <TableCell className="max-w-md">
                         <pre className="whitespace-pre-wrap break-all text-xs">{item.rawPayload}</pre>
                      </TableCell>
                      <TableCell>{item.parsedSuccessfully ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{item.conformsToSchema ? 'Yes' : 'No'}</TableCell>
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
