'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

// Expected structure of the tftvalue part of the MQTT payload
export interface TftValuePayload {
  S1_L1?: number | string;
  S1_L2?: number | string;
  S1_L3?: number | string;
  S2_L1?: number | string;
  S2_L2?: number | string;
  S2_L3?: number | string;
  S3_L1?: number | string;
  S3_L2?: number | string;
  S3_L3?: number | string;
  [key: string]: number | string | undefined; // Allow other potential sensor fields
}

// Expected structure of the incoming MQTT JSON payload
export interface MqttJsonPayload {
  device_serial: string;
  tftvalue: TftValuePayload;
  [key: string]: any; // Allow other potential top-level fields
}

// Structure for storing data in Firestore's 'mqtt_records' collection
// This is what we'll primarily use for the historic data page.
export interface FirebaseMqttRecordData {
  receivedAt: Timestamp;
  device_serial: string;
  topic: string;
  rawPayload: string;
  S1_L1?: number;
  S1_L2?: number;
  S1_L3?: number;
  S2_L1?: number;
  S2_L2?: number;
  S2_L3?: number;
  S3_L1?: number;
  S3_L2?: number;
  S3_L3?: number;
  // Add other sensor fields if necessary
}

// Structure for data retrieved by the client (includes ID and JS Date)
export interface FetchedMqttRecord extends Omit<FirebaseMqttRecordData, 'receivedAt' | 'S1_L1' | 'S1_L2' | 'S1_L3' | 'S2_L1' | 'S2_L2' | 'S2_L3' | 'S3_L1' | 'S3_L2' | 'S3_L3'> {
  id: string;
  receivedAt: Date; // Converted from Firestore Timestamp
  S1_L1?: number;
  S1_L2?: number;
  S1_L3?: number;
  S2_L1?: number;
  S2_L2?: number;
  S2_L3?: number;
  S3_L1?: number;
  S3_L2?: number;
  S3_L3?: number;
}


/**
 * Parses sensor values from tftvalue, converting them to numbers.
 * @param tftvalue The tftvalue object from the MQTT payload.
 * @returns An object with sensor keys and their numeric values.
 */
function parseSensorValues(tftvalue: TftValuePayload): Partial<FirebaseMqttRecordData> {
  const sensorData: Partial<FirebaseMqttRecordData> = {};
  const sensorKeys: (keyof TftValuePayload)[] = [
    'S1_L1', 'S1_L2', 'S1_L3',
    'S2_L1', 'S2_L2', 'S2_L3',
    'S3_L1', 'S3_L2', 'S3_L3',
  ];

  for (const key of sensorKeys) {
    if (Object.prototype.hasOwnProperty.call(tftvalue, key)) {
      const value = tftvalue[key];
      if (value !== undefined && value !== null) {
        const numValue = parseFloat(String(value));
        if (!isNaN(numValue)) {
          sensorData[key as keyof FirebaseMqttRecordData] = numValue;
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
            parsedSuccessfully: typeof jsonData === 'object', // True if jsonData is an object (even if not conforming)
            conformsToSchema: false,
            jsonPayload: typeof jsonData === 'object' ? jsonData : null, // Store if it was parseable JSON
            receivedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('FirebaseServiceError: Error adding non-conforming/raw data to mqtt_data:', error);
    }
    return null; // Indicate that structured save was skipped or data was non-conforming
  }

  // At this point, jsonData is a conforming MqttJsonPayload
  const conformingJsonData = jsonData as MqttJsonPayload;
  const sensorValues = parseSensorValues(conformingJsonData.tftvalue);

  const recordToSave: Omit<FirebaseMqttRecordData, 'receivedAt'> & { receivedAt: any } = {
    device_serial: conformingJsonData.device_serial,
    topic: topic,
    rawPayload: rawMessage, // Save the original raw message
    ...sensorValues,
    receivedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, 'mqtt_records'), recordToSave);
    // console.log('Structured MQTT data saved to Firebase (mqtt_records) with ID: ', docRef.id);
    
    // Optionally, also save to the general 'mqtt_data' collection for full history/audit if desired
    // This might be redundant if all conforming data also goes to mqtt_records.
    // Consider if this is needed or if mqtt_data is only for non-conforming/raw.
    // If mqtt_data is for ALL data, then this part is fine.
     await addDoc(collection(db, 'mqtt_data'), {
        topic,
        rawPayload: rawMessage,
        parsedSuccessfully: true,
        conformsToSchema: true,
        structuredRecordId: docRef.id, // Link to the record in mqtt_records
        jsonPayload: conformingJsonData, // Store the MqttJsonPayload structure
        receivedAt: recordToSave.receivedAt,
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
    // Also attempt to save the raw data to mqtt_data as a fallback if mqtt_records fails
    try {
      await addDoc(collection(db, 'mqtt_data'), {
            topic,
            rawPayload: rawMessage,
            parsedSuccessfully: true, // It was parsed to attempt structured save
            conformsToSchema: true,    // It conformed, but saving to mqtt_records failed
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


// Type guard for FirebaseMqttRecordData (excluding receivedAt as Timestamp for simplicity in guard)
function isFirebaseMqttRecordDocumentData(data: DocumentData): data is Omit<FirebaseMqttRecordData, 'receivedAt'> {
  return (
    typeof data.device_serial === 'string' &&
    typeof data.topic === 'string' &&
    typeof data.rawPayload === 'string'
    // Sensor fields are optional, so not strictly checked here for type guarding
    // `receivedAt` will be a Timestamp object from Firestore, handled during conversion
  );
}

// Helper to convert Firestore document snapshot to FetchedMqttRecord
export async function fromFirestore(doc: QueryDocumentSnapshot<DocumentData>): Promise<FetchedMqttRecord | null> {
    const data = doc.data();
    if (!data.receivedAt || typeof data.receivedAt.toDate !== 'function') {
        // console.warn(`Document ${doc.id} is missing a valid receivedAt timestamp.`);
        return null; 
    }
    if (!isFirebaseMqttRecordDocumentData(data)) {
        // console.warn(`Document ${doc.id} does not match FirebaseMqttRecordData structure from 'mqtt_records'.`, data);
        return null;
    }

    const sensorData: Partial<FetchedMqttRecord> = {};
    const sensorKeys: (keyof TftValuePayload)[] = [
        'S1_L1', 'S1_L2', 'S1_L3',
        'S2_L1', 'S2_L2', 'S2_L3',
        'S3_L1', 'S3_L2', 'S3_L3',
    ];
     for (const key of sensorKeys) {
        if (Object.prototype.hasOwnProperty.call(data, key) && typeof data[key] === 'number') {
            sensorData[key as keyof FetchedMqttRecord] = data[key];
        }
    }

    return {
        id: doc.id,
        receivedAt: (data.receivedAt as Timestamp).toDate(),
        device_serial: data.device_serial,
        topic: data.topic,
        rawPayload: data.rawPayload,
        ...sensorData,
    };
}
