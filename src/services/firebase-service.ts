'use server';

import { rtdb } from '@/lib/firebase';
import {
  ref,
  push,
  serverTimestamp as rtdbServerTimestamp,
  query,
  orderByChild,
  startAt,
  endAt,
  get,
  DataSnapshot,
  Query
} from 'firebase/database';

export interface TftValuePayload {
  [key: string]: number | string | undefined;
}

export interface MqttJsonPayload {
  device_serial: string;
  tftvalue: TftValuePayload;
  [key: string]: any;
}

interface RealtimeDBReadingData {
  timestamp: number | object;
  tftvalue: Record<string, number>;
}

export interface FetchedMqttRecord {
  id: string;
  device_serial: string;
  timestamp: number;
  [sensorKey: string]: number | string | undefined;
}

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

export async function saveStructuredMqttDataToRTDB(jsonData: MqttJsonPayload): Promise<string | null> {
  const localRtdb = rtdb;
  if (!localRtdb) {
    console.error('FirebaseServiceError: Realtime Database instance is not available.');
    throw new Error('RealtimeDBNotInitialized: Database instance is null.');
  }

  const deviceSerial = jsonData.device_serial;

  const readingData: Omit<RealtimeDBReadingData, 'timestamp'> & { timestamp: object } = {
    timestamp: rtdbServerTimestamp(),
    tftvalue: parseSensorValues(jsonData.tftvalue),
  };

  try {
    const deviceReadingsRef = ref(localRtdb, `device_readings/${deviceSerial}`);
    const newReadingRef = await push(deviceReadingsRef, readingData);
    return newReadingRef.key;
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
 * @param deviceSerialFilter Optional device serial to filter data.
 * @returns A promise that resolves to an array of FetchedMqttRecord.
 */
export async function getHistoricDataFromRTDB(
  startDate?: Date,
  endDate?: Date,
  deviceSerialFilter?: string
): Promise<FetchedMqttRecord[]> {
  const localRtdb = rtdb;
  if (!localRtdb) {
    console.error('FirebaseServiceError: Realtime Database instance is not available for fetching.');
    throw new Error('RealtimeDBNotInitialized: Database instance is null for fetching.');
  }

  const allReadings: FetchedMqttRecord[] = [];

  const processDeviceReadings = async (deviceSerial: string) => {
    let readingsQuery: Query = query(ref(localRtdb, `device_readings/${deviceSerial}`), orderByChild('timestamp'));

    const startTimestamp = startDate ? startDate.getTime() : null;
    const endTimestamp = endDate
      ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime()
      : null;

    if (startTimestamp) {
      readingsQuery = query(readingsQuery, startAt(startTimestamp));
    }
    if (endTimestamp) {
      readingsQuery = query(readingsQuery, endAt(endTimestamp));
    }

    const readingsSnapshot = await get(readingsQuery);
    if (readingsSnapshot.exists()) {
      readingsSnapshot.forEach((readingSnapshot: DataSnapshot) => {
        const readingId = readingSnapshot.key;
        const readingData = readingSnapshot.val() as Omit<RealtimeDBReadingData, 'timestamp'> & { timestamp: number };

        if (readingId && readingData && typeof readingData.timestamp === 'number' && readingData.tftvalue) {
          if (endTimestamp && readingData.timestamp > endTimestamp) {
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
  };

  try {
    if (deviceSerialFilter && deviceSerialFilter.trim() !== "") {
      await processDeviceReadings(deviceSerialFilter.trim());
    } else {
      const devicesRef = ref(localRtdb, 'device_readings');
      const devicesSnapshot = await get(devicesRef);
      if (devicesSnapshot.exists()) {
        const fetchPromises: Promise<void>[] = [];
        devicesSnapshot.forEach((deviceSerialSnapshot: DataSnapshot) => {
          const deviceSerial = deviceSerialSnapshot.key;
          if (deviceSerial) {
            fetchPromises.push(processDeviceReadings(deviceSerial));
          }
        });
        await Promise.all(fetchPromises);
      }
    }
  } catch (error) {
    console.error('FirebaseServiceError: Error fetching historic data from Realtime Database:', error);
    if (error instanceof Error && error.message.includes("Index not defined")) {
      throw new Error(`Database Index Error: ${error.message}. Please ensure 'timestamp' is indexed under 'device_readings/$deviceSerialId/.indexOn'.`);
    }
    throw error;
  }

  allReadings.sort((a, b) => b.timestamp - a.timestamp);
  return allReadings;
}
