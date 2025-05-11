
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, DocumentData, QueryDocumentSnapshot, doc } from 'firebase/firestore';

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

// Structure for a document in the 'history' sub-collection
// This represents how data is stored in Firestore for each device reading
interface HistoryEntryData {
  timestamp: Timestamp; // Firestore Timestamp for when the record was saved
  tftvalue: Record<string, number>; // Parsed sensor values
  topic: string; // MQTT topic
  rawPayload: string; // The raw payload string
}

// Structure for data after retrieval and processing by the client, ready for display
// This is used by the historic page and includes the document ID and JS Date.
export interface FetchedMqttRecord {
  id: string; // Firestore document ID from the 'history' sub-collection
  receivedAt: Date; // JavaScript Date object, converted from Firestore Timestamp
  device_serial: string; // Identifier for the device, derived from parent document ID
  topic: string; // MQTT topic
  rawPayload: string; // The raw payload string
  // Dynamically include sensor data keys (e.g., S1_L1, S2_L2, etc.)
  [sensorKey: string]: number | string | Date | undefined; 
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
 * Saves structured MQTT data. Data for each device is stored under a document
 * keyed by its device_serial in 'device_readings_by_id'. Each reading is then
 * added to a 'history' sub-collection under that device's document.
 * Also logs a general record to the 'mqtt_data_log' collection.
 * @param topic The MQTT topic.
 * @param rawMessage The raw message string.
 * @param jsonData The parsed JSON object from the rawMessage.
 * @returns The ID of the saved document in the 'history' sub-collection if successful, otherwise null.
 * @throws Will throw an error if Firestore is not initialized or if saving fails.
 */
export async function saveStructuredMqttData(topic: string, rawMessage: string, jsonData: MqttJsonPayload | any): Promise<string | null> {
  if (!db) {
    console.error('FirebaseServiceError: Firestore database instance is not available.');
    throw new Error('FirestoreNotInitialized: Database instance is null.');
  }

  const isConformingPayload = jsonData &&
                              typeof jsonData === 'object' &&
                              typeof jsonData.device_serial === 'string' &&
                              typeof jsonData.tftvalue === 'object' &&
                              jsonData.tftvalue !== null;

  // Log to general 'mqtt_data_log' collection first
  const generalLogData: any = {
    topic,
    rawPayload: rawMessage,
    parsedSuccessfully: typeof jsonData === 'object',
    conformsToSchema: isConformingPayload,
    jsonPayload: typeof jsonData === 'object' ? jsonData : null, // Store parsed JSON if available
    receivedAt: serverTimestamp(), // Firestore server timestamp
  };

  try {
    await addDoc(collection(db, 'mqtt_data_log'), generalLogData);
  } catch (error) {
    console.error('FirebaseServiceError: Error adding to mqtt_data_log (general log):', error);
    // Decide if you want to stop further processing or just log and continue
  }

  // If the payload doesn't conform to the expected MqttJsonPayload structure,
  // do not attempt to save it to the structured 'device_readings_by_id' path.
  // It has already been logged to 'mqtt_data_log'.
  if (!isConformingPayload) {
    // console.warn('FirebaseServiceWarning: Data does not conform to MqttJsonPayload schema for structured saving. Only saved to general log.', jsonData);
    return null;
  }

  // Cast to the conforming type now that we've checked
  const conformingJsonData = jsonData as MqttJsonPayload;
  const deviceSerial = conformingJsonData.device_serial;
  
  // Prepare the entry for the 'history' sub-collection
  const historyEntry: Omit<HistoryEntryData, 'timestamp'> & { timestamp: any } = { // `timestamp: any` because serverTimestamp() is used
    timestamp: serverTimestamp(), // Use Firestore server timestamp for the actual record
    tftvalue: parseSensorValues(conformingJsonData.tftvalue), // Store parsed numeric sensor values
    topic: topic,
    rawPayload: rawMessage,
  };

  try {
    // Path: device_readings_by_id / {deviceSerial} / history / {autoId}
    const deviceDocRef = doc(db, 'device_readings_by_id', deviceSerial);
    const historyCollectionRef = collection(deviceDocRef, 'history');
    const docRef = await addDoc(historyCollectionRef, historyEntry);
    return docRef.id; // Return the ID of the newly created document in the 'history' sub-collection
  } catch (error) {
    console.error(`FirebaseServiceError: Error adding document to history for device ${deviceSerial}:`, error);
    let message = `Unknown error occurred while saving structured data for device ${deviceSerial}.`;
    if (error instanceof Error) message = error.message;
    else if (typeof error === 'string') message = error;
    // Optionally, update the general log entry with this error or handle as needed
    throw new Error(`FirebaseSaveError: ${message}`);
  }
}


// Type guard for data from 'history' subcollection documents
function isValidHistoryDocData(data: DocumentData): data is Omit<HistoryEntryData, 'timestamp'> & {timestamp: Timestamp} {
  return (
    data.timestamp instanceof Timestamp &&
    typeof data.tftvalue === 'object' && data.tftvalue !== null &&
    // Ensure all values in tftvalue are numbers, or handle mixed types if necessary
    Object.values(data.tftvalue).every(val => typeof val === 'number') && 
    typeof data.topic === 'string' &&
    typeof data.rawPayload === 'string'
  );
}

// Helper to convert Firestore document snapshot (from 'history' subcollection) to FetchedMqttRecord
export const fromFirestore = async (docSnapshot: QueryDocumentSnapshot<DocumentData>): Promise<FetchedMqttRecord | null> => {
    const data = docSnapshot.data();

    // Use the type guard to validate the structure
    if (!isValidHistoryDocData(data)) {
        // console.warn(`Document ${docSnapshot.id} from a 'history' subcollection does not match expected structure or timestamp is invalid.`, data);
        return null;
    }
    
    // The 'history' collection is a subcollection. Its parent document's ID is the device_serial.
    // docSnapshot.ref.parent gives the CollectionReference of the 'history' collection.
    // docSnapshot.ref.parent.parent gives the DocumentReference of the device (e.g., /device_readings_by_id/{deviceSerial}).
    const deviceSerial = docSnapshot.ref.parent.parent?.id; 
    if (!deviceSerial) {
      // console.warn(`Could not determine device_serial for document ${docSnapshot.id}`);
      return null;
    }

    // Construct the FetchedMqttRecord
    // The `data` object is now confirmed to match the expected structure by isValidHistoryDocData.
    const fetchedRecord: FetchedMqttRecord = {
        id: docSnapshot.id,
        receivedAt: data.timestamp.toDate(), // Convert Firestore Timestamp to JavaScript Date
        device_serial: deviceSerial,
        topic: data.topic,
        rawPayload: data.rawPayload,
        ...data.tftvalue, // Spread the sensor values from the tftvalue map directly into the record
    };
    
    return fetchedRecord;
};

