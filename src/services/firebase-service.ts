
'use server';

import { rtdb } from '@/lib/firebase'; // Import Realtime Database instance
import { ref, push, serverTimestamp as rtdbServerTimestamp, query, orderByChild, startAt, endAt, get, DataSnapshot } from 'firebase/database';

// Expected structure of the tftvalue part of the MQTT payload
export interface TftValuePayload {
  [key: string]: number | string | undefined; // Allow any sensor fields
}

// Expected structure of the incoming MQTT JSON payload
export interface MqttJsonPayload {
  device_serial: string;
  tftvalue: TftValuePayload;
  [key: string]: any; // Allow other potential top-level fields
}

// Structure for a reading stored in Realtime Database under device_readings/{deviceSerial}/{readingId}
interface RealtimeDBReadingData {
  timestamp: number | object; // number (epoch ms) when read, object for rtdbServerTimestamp on write
  tftvalue: Record<string, number>; // Parsed sensor values
  // topic and rawPayload are not part of the new RTDB structure per user's example
}

// Structure for data after retrieval and processing, ready for display on historic page
export interface FetchedMqttRecord {
  id: string; // readingId (the push key from RTDB)
  device_serial: string; // Identifier for the device
  timestamp: number; // JavaScript epoch milliseconds, converted from RTDB
  // Dynamically include sensor data keys (e.g., S1_L1, S2_L2, etc.)
  [sensorKey: string]: number | string | undefined;
}


/**
 * Parses sensor values from tftvalue, converting them to numbers.
 * Filters out non-numeric values.
 * @param tftvalue The tftvalue object from the MQTT payload.
 * @returns An object with sensor keys and their numeric values.
 */
function parseSensorValues(tftvalue: TftValuePayload): Record<string, number> {
  const sensorData: Record<string, number> = {};
  for (const key in tftvalue) {
    if (Object.prototype.hasOwnProperty.call(tftvalue, key)) {
      const value = tftvalue[key];
      if (value !== undefined && value !== null) {
        const numValue = parseFloat(String(value));
        if (!isNaN(numValue)) {
          sensorData[key] = numValue;
        }
      }
    }
  }
  return sensorData;
}

/**
 * Saves structured MQTT data to Firebase Realtime Database.
 * Data for each device is stored under 'device_readings/{device_serial}'.
 * Each reading is pushed, generating a unique ID.
 * @param _topic The MQTT topic (currently not used in the RTDB structure).
 * @param _rawMessage The raw message string (currently not used in the RTDB structure).
 * @param jsonData The parsed JSON object from the MQTT message.
 * @returns The key of the saved reading in Realtime Database if successful, otherwise null.
 * @throws Will throw an error if Realtime Database is not initialized or if saving fails.
 */
export async function saveStructuredMqttDataToRTDB(_topic: string, _rawMessage: string, jsonData: MqttJsonPayload | any): Promise<string | null> {
  if (!rtdb) {
    console.error('FirebaseServiceError: Realtime Database instance is not available.');
    throw new Error('RealtimeDBNotInitialized: Database instance is null.');
  }

  const isConformingPayload = jsonData &&
                              typeof jsonData === 'object' &&
                              typeof jsonData.device_serial === 'string' &&
                              typeof jsonData.tftvalue === 'object' &&
                              jsonData.tftvalue !== null;

  if (!isConformingPayload) {
    console.warn('FirebaseServiceWarning: Data does not conform to MqttJsonPayload schema for Realtime Database saving.', jsonData);
    return null;
  }

  const conformingJsonData = jsonData as MqttJsonPayload;
  const deviceSerial = conformingJsonData.device_serial;
  
  const readingData: Omit<RealtimeDBReadingData, 'timestamp'> & { timestamp: object } = {
    timestamp: rtdbServerTimestamp(), // Use Realtime Database server timestamp
    tftvalue: parseSensorValues(conformingJsonData.tftvalue),
  };

  try {
    const deviceReadingsRef = ref(rtdb, `device_readings/${deviceSerial}`);
    const newReadingRef = await push(deviceReadingsRef, readingData);
    return newReadingRef.key; // Return the unique key of the newly pushed reading
  } catch (error) {
    console.error(`FirebaseServiceError: Error saving reading to Realtime Database for device ${deviceSerial}:`, error);
    let message = `Unknown error occurred while saving to Realtime Database for device ${deviceSerial}.`;
    if (error instanceof Error) message = error.message;
    else if (typeof error === 'string') message = error;
    throw new Error(`FirebaseSaveError: ${message}`);
  }
}

/**
 * Fetches historic MQTT data from Firebase Realtime Database.
 * @param startDate Optional start date to filter data.
 * @param endDate Optional end date to filter data.
 * @returns A promise that resolves to an array of FetchedMqttRecord.
 */
export async function getHistoricDataFromRTDB(startDate?: Date, endDate?: Date): Promise<FetchedMqttRecord[]> {
  if (!rtdb) {
    console.error('FirebaseServiceError: Realtime Database instance is not available for fetching.');
    throw new Error('RealtimeDBNotInitialized: Database instance is null for fetching.');
  }

  const allReadings: FetchedMqttRecord[] = [];
  const devicesRef = ref(rtdb, 'device_readings');

  try {
    const devicesSnapshot = await get(devicesRef);
    if (devicesSnapshot.exists()) {
      const fetchPromises: Promise<void>[] = [];

      devicesSnapshot.forEach((deviceSerialSnapshot: DataSnapshot) => {
        const deviceSerial = deviceSerialSnapshot.key;
        if (!deviceSerial) return;

        let readingsQuery = query(ref(rtdb, `device_readings/${deviceSerial}`), orderByChild('timestamp'));
        
        if (startDate) {
          readingsQuery = query(readingsQuery, startAt(startDate.getTime()));
        }
        // For RTDB, endAt is inclusive. If filtering by endDate, it's often combined with startAt.
        // If only endDate is given, it means all records up to that timestamp.
        // If both, it defines a range.
        // Note: RTDB filtering might require client-side refinement if complex date logic beyond simple range is needed.

        const promise = get(readingsQuery).then((readingsSnapshot: DataSnapshot) => {
          if (readingsSnapshot.exists()) {
            readingsSnapshot.forEach((readingSnapshot: DataSnapshot) => {
              const readingId = readingSnapshot.key;
              const readingData = readingSnapshot.val() as Omit<RealtimeDBReadingData, 'timestamp'> & { timestamp: number }; // Timestamp will be number after fetch

              if (readingId && readingData && typeof readingData.timestamp === 'number' && readingData.tftvalue) {
                // Further client-side filtering for endDate if RTDB's endAt was not precise enough or not used
                if (endDate && readingData.timestamp > endDate.getTime() + (24 * 60 * 60 * 1000 -1) /* include whole day */ ) {
                    return; 
                }

                allReadings.push({
                  id: readingId,
                  device_serial: deviceSerial,
                  timestamp: readingData.timestamp,
                  ...readingData.tftvalue,
                });
              }
            });
          }
        });
        fetchPromises.push(promise);
      });
      await Promise.all(fetchPromises);
    }
  } catch (error) {
    console.error('FirebaseServiceError: Error fetching historic data from Realtime Database:', error);
    throw error; // Re-throw to be caught by the caller
  }

  // Sort data by timestamp descending (latest first) as RTDB orderByChild only sorts ascending
  allReadings.sort((a, b) => b.timestamp - a.timestamp);
  return allReadings;
}
