'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

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

// Structure for storing data in Firestore's 'mqtt_records' collection
export interface FirebaseMqttRecordData {
  receivedAt: Timestamp;
  device_serial: string;
  topic: string;
  rawPayload: string;
  [key: string]: number | string | Timestamp | undefined; // For dynamic sensor data
}

// Structure for data retrieved by the client (includes ID and JS Date)
export interface FetchedMqttRecord {
  id: string;
  receivedAt: Date;
  device_serial: string;
  topic: string;
  rawPayload: string;
  [key: string]: number | string | Date | undefined; // For dynamic sensor data
}


/**
 * Parses sensor values from tftvalue, converting them to numbers.
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
 * Saves structured MQTT data to the 'mqtt_records' collection in Firestore.
 * It expects a parsed JSON payload that includes 'device_serial' and 'tftvalue'.
 * If the payload does not conform, it saves the raw message and parsed JSON (if possible) to 'mqtt_data'.
 * @param topic The MQTT topic.
 * @param rawMessage The raw message string.
 * @param jsonData The parsed JSON object from the rawMessage, or the rawMessage itself if not JSON.
 * @returns The ID of the saved document in 'mqtt_records' if successful and conforming, otherwise null.
 * @throws Will throw an error if Firestore is not initialized or if saving to 'mqtt_records' fails.
 */
export async function saveStructuredMqttData(topic: string, rawMessage: string, jsonData: MqttJsonPayload | any): Promise<string | null> {
  if (!db) {
    console.error('FirebaseServiceError: Firestore database instance is not available in saveStructuredMqttData.');
    throw new Error('FirestoreNotInitialized: Database instance is null. Cannot save MQTT data.');
  }

  const isConformingPayload = jsonData &&
                              typeof jsonData === 'object' &&
                              typeof jsonData.device_serial === 'string' &&
                              typeof jsonData.tftvalue === 'object' &&
                              jsonData.tftvalue !== null;

  if (!isConformingPayload) {
    // console.warn('FirebaseServiceWarning: Data does not conform to MqttJsonPayload schema. Saving to mqtt_data.', jsonData);
    try {
        await addDoc(collection(db, 'mqtt_data'), {
            topic,
            rawPayload: rawMessage,
            parsedSuccessfully: typeof jsonData === 'object',
            conformsToSchema: false,
            jsonPayload: typeof jsonData === 'object' ? jsonData : null,
            receivedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('FirebaseServiceError: Error adding non-conforming/raw data to mqtt_data:', error);
    }
    return null;
  }

  const conformingJsonData = jsonData as MqttJsonPayload;
  const sensorValues = parseSensorValues(conformingJsonData.tftvalue);

  const recordToSave: Omit<FirebaseMqttRecordData, 'receivedAt'> & { receivedAt: any } = {
    device_serial: conformingJsonData.device_serial,
    topic: topic,
    rawPayload: rawMessage,
    ...sensorValues, // Spread all parsed numeric sensor values
    receivedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, 'mqtt_records'), recordToSave);

     await addDoc(collection(db, 'mqtt_data'), {
        topic,
        rawPayload: rawMessage,
        parsedSuccessfully: true,
        conformsToSchema: true,
        structuredRecordId: docRef.id,
        jsonPayload: conformingJsonData,
        receivedAt: recordToSave.receivedAt, // Use the same serverTimestamp placeholder
    });

    return docRef.id;
  } catch (error) {
    console.error('FirebaseServiceError: Error adding document to mqtt_records:', error);
    let message = 'Unknown error occurred while saving structured data to Firebase.';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }
    try {
      await addDoc(collection(db, 'mqtt_data'), {
            topic,
            rawPayload: rawMessage,
            parsedSuccessfully: true,
            conformsToSchema: true,
            jsonPayload: conformingJsonData,
            receivedAt: serverTimestamp(),
            saveError: `Failed to save to mqtt_records: ${message}`
        });
    } catch (fallbackError) {
         console.error('FirebaseServiceError: Error saving to mqtt_data after mqtt_records failed:', fallbackError);
    }
    throw new Error(`FirebaseSaveError: ${message}`);
  }
}

// Define a type for the core fields expected in a valid mqtt_record document
type CoreFirebaseMqttRecord = {
  device_serial: string;
  topic: string;
  rawPayload: string;
  receivedAt: Timestamp; // Firestore Timestamp
  // Other dynamic fields can exist
  [key: string]: any;
};

// Type guard to check if the document data matches the core structure
function isCoreFirebaseMqttRecordDocumentData(data: DocumentData): data is CoreFirebaseMqttRecord {
  return (
    typeof data.device_serial === 'string' &&
    typeof data.topic === 'string' &&
    typeof data.rawPayload === 'string' &&
    data.receivedAt instanceof Timestamp && // Check if it's a Firestore Timestamp instance
    typeof data.receivedAt.toDate === 'function' // Ensure it has the toDate method
  );
}

// Helper to convert Firestore document snapshot to FetchedMqttRecord
export async function fromFirestore(doc: QueryDocumentSnapshot<DocumentData>): Promise<FetchedMqttRecord | null> {
    const data = doc.data();

    if (!isCoreFirebaseMqttRecordDocumentData(data)) {
        // console.warn(`Document ${doc.id} does not match core FirebaseMqttRecordData structure or receivedAt is not a valid Timestamp.`, data);
        return null;
    }

    // At this point, data.receivedAt is confirmed to be a Firestore Timestamp.
    const fetchedRecord: FetchedMqttRecord = {
        id: doc.id,
        receivedAt: data.receivedAt.toDate(), // Convert Firestore Timestamp to JS Date
        device_serial: data.device_serial,
        topic: data.topic,
        rawPayload: data.rawPayload,
    };

    // Add all other properties from data as potential sensor values
    // These are assumed to be already stored as numbers or strings in Firestore for mqtt_records
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key) &&
            !['receivedAt', 'device_serial', 'topic', 'rawPayload'].includes(key)) {
            const value = data[key];
            if (typeof value === 'number' || typeof value === 'string') {
                 fetchedRecord[key] = value;
            }
            // If dynamic fields could also be Timestamps and need conversion:
            // else if (value instanceof Timestamp) {
            //    fetchedRecord[key] = value.toDate();
            // }
        }
    }
    return fetchedRecord;
}
