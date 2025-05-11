
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { useEffect, useState } from "react";
// import { collection, getDocs, orderBy, query } from "firebase/firestore";
// import { db } from "@/lib/firebase";
// import type { FirebaseStoredData } from "@/services/firebase-service"; // Assuming this type is exported
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import { format } from 'date-fns';
// import { ScrollArea } from "@/components/ui/scroll-area";

export default function HistoricPage() {
  // const [historicData, setHistoricData] = useState<FirebaseStoredData[]>([]);
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
  //   const fetchData = async () => {
  //     if (!db) {
  //       setError("Firestore is not initialized.");
  //       setLoading(false);
  //       return;
  //     }
  //     try {
  //       setLoading(true);
  //       const q = query(collection(db, "mqtt_data"), orderBy("receivedAt", "desc"));
  //       const querySnapshot = await getDocs(q);
  //       const data: FirebaseStoredData[] = [];
  //       querySnapshot.forEach((doc) => {
  //         data.push({ id: doc.id, ...doc.data() } as FirebaseStoredData); // Ensure id is included if needed
  //       });
  //       setHistoricData(data);
  //       setError(null);
  //     } catch (err: any) {
  //       console.error("Error fetching historic data:", err);
  //       setError(`Failed to load data: ${err.message}`);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchData();
  // }, []);

  return (
    <main className="flex-grow container mx-auto p-4 md:p-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Historic MQTT Data</CardTitle>
          <CardDescription>
            Browse all data received from your MQTT broker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* {loading && <p className="text-muted-foreground">Loading historic data...</p>}
          {error && <p className="text-destructive">{error}</p>}
          {!loading && !error && historicData.length === 0 && (
            <p className="text-muted-foreground">No historic data found.</p>
          )}
          {!loading && !error && historicData.length > 0 && (
            <ScrollArea className="h-[600px] rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[200px]">Received At</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Raw Payload</TableHead>
                    <TableHead className="w-[150px]">Parsed OK?</TableHead>
                    <TableHead className="w-[150px]">Schema OK?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicData.map((item, index) => (
                    <TableRow key={item.id || index}>
                      <TableCell>
                        {item.receivedAt ? format(item.receivedAt.toDate(), 'Pp, p') : 'N/A'}
                      </TableCell>
                      <TableCell>{item.topic}</TableCell>
                      <TableCell className="max-w-xs truncate" title={item.rawPayload}>
                         <pre className="whitespace-pre-wrap break-all text-xs">{item.rawPayload}</pre>
                      </TableCell>
                      <TableCell>{item.parsedSuccessfully ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{item.conformsToSchema ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )} */}
          <p className="text-muted-foreground">Historic data display will be implemented here.</p>
        </CardContent>
      </Card>
    </main>
  );
}
