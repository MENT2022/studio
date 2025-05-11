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
 * @returns The ID of the saved document.
 * @throws Will throw an error if Firestore is not initialized or if saving fails.
 */
export async function saveMqttData(topic: string, rawMessage: string): Promise<string> {
  if (!db) {
    console.error('FirestoreServiceError: Firestore database instance is not available in saveMqttData.');
    // Make sure this error is distinct and clearly identifiable
    throw new Error('FirestoreNotInitialized: Database instance is null. Cannot save MQTT data.');
  }

  let dataForFirestore: Omit<FirebaseStoredData, 'id' | 'receivedAt'> = {
    topic: topic,
    rawPayload: rawMessage,
    parsedSuccessfully: false,
    conformsToSchema: false,
  };


  try {
    const jsonData = JSON.parse(rawMessage);
    dataForFirestore.parsedSuccessfully = true;
    dataForFirestore.jsonPayload = jsonData; 

    if (
      jsonData &&
      typeof jsonData.device_serial === 'string' &&
      typeof jsonData.tftvalue === 'object' &&
      jsonData.tftvalue !== null
    ) {
      dataForFirestore.conformsToSchema = true;
      dataForFirestore.structuredPayload = jsonData as MqttDataPayload;
    }
  } catch (e) {
    // rawMessage was not valid JSON.
    // parsedSuccessfully remains false. jsonPayload, conformsToSchema, structuredPayload remain undefined.
  }

  try {
    const docRef = await addDoc(collection(db, 'mqtt_data'), {
      ...dataForFirestore,
      receivedAt: serverTimestamp(), 
    });
    // console.log('MQTT data saved to Firebase with ID: ', docRef.id); // Keep commented for cleaner server logs unless debugging
    return docRef.id;
  } catch (error) {
    console.error('FirebaseServiceError: Error adding document to Firebase:', error);
    let message = 'Unknown error occurred while saving data to Firebase.';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }
    // Ensure a new, clean Error object is thrown for better serialization by Next.js
    throw new Error(`FirebaseSaveError: ${message}`);
  }
}
