
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

// This is the specific data structure we try to parse messages into.
export interface MqttDataPayload {
  device_serial: string;
  tftvalue: Record<string, string | number>;
  [key: string]: any; // Allow other potential fields
}

// This defines the structure of the data as it will be stored in Firestore.
export interface FirebaseStoredData {
  id: string; // Document ID from Firestore
  topic: string;
  receivedAt: Timestamp; // Firestore Timestamp
  rawPayload: string; // Always store the raw message string
  parsedSuccessfully?: boolean; // True if rawPayload was valid JSON
  conformsToSchema?: boolean; // True if the parsed JSON matched MqttDataPayload schema
  structuredPayload?: MqttDataPayload; // The payload, if it conformed to MqttDataPayload
  jsonPayload?: any; // The parsed JSON payload, if rawPayload was valid JSON
}

/**
 * Saves MQTT data to Firestore.
 * It stores the raw message, and if the message is JSON, it also stores the parsed version.
 * If the parsed JSON matches the MqttDataPayload schema, it's also stored in a structured format.
 * @param topic The MQTT topic from which the message was received.
 * @param rawMessage The raw message string received from MQTT.
 * @returns The ID of the saved document, or null if an error occurred.
 */
export async function saveMqttData(topic: string, rawMessage: string): Promise<string | null> {
  if (!db) {
    console.error('Firestore database instance is not available.');
    throw new Error('Firestore not initialized.');
  }

  // Base structure for data to be saved, excluding fields that are conditionally added
  // and also excluding id, receivedAt which are handled by Firestore or added upon retrieval.
  let dataForFirestore: Omit<FirebaseStoredData, 'id' | 'receivedAt'> = {
    topic: topic,
    rawPayload: rawMessage,
    parsedSuccessfully: false,
    conformsToSchema: false,
    // structuredPayload and jsonPayload will be added if applicable
  };


  try {
    const jsonData = JSON.parse(rawMessage);
    dataForFirestore.parsedSuccessfully = true;
    dataForFirestore.jsonPayload = jsonData; // Store the parsed JSON regardless of its schema

    // Check if the parsed JSON conforms to the MqttDataPayload schema
    if (
      jsonData &&
      typeof jsonData.device_serial === 'string' &&
      typeof jsonData.tftvalue === 'object' &&
      jsonData.tftvalue !== null // Important: typeof null is 'object'
    ) {
      dataForFirestore.conformsToSchema = true;
      dataForFirestore.structuredPayload = jsonData as MqttDataPayload;
    }
  } catch (e) {
    // rawMessage was not valid JSON.
    // parsedSuccessfully remains false. jsonPayload, conformsToSchema, structuredPayload remain undefined.
    // The rawPayload is already set.
  }

  try {
    const docRef = await addDoc(collection(db, 'mqtt_data'), {
      ...dataForFirestore,
      receivedAt: serverTimestamp(), // Firestore will set this to the server's timestamp
    });
    console.log('MQTT data saved to Firebase with ID: ', docRef.id);
    return docRef.id;
  } catch (e) {
    console.error('Error adding document to Firebase: ', e);
    // Propagate the error so the caller can handle it (e.g., show a toast)
    throw new Error(`Failed to save data to Firebase: ${(e as Error).message}`);
  }
}
