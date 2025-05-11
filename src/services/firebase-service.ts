
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

export interface MqttDataPayload {
  device_serial: string;
  tftvalue: Record<string, string | number>; // Can contain S1_L1, S1_L2 etc. or other similar structures
  [key: string]: any; // Allow other potential fields
}

export interface FirebaseMqttData extends MqttDataPayload {
  topic: string;
  receivedAt: Timestamp;
}

export async function saveMqttData(topic: string, data: MqttDataPayload): Promise<string | null> {
  if (!data || typeof data.device_serial !== 'string' || typeof data.tftvalue !== 'object') {
    console.error('Invalid data format for Firestore:', data);
    throw new Error('Invalid data format for Firestore. Required fields: device_serial (string), tftvalue (object).');
  }

  try {
    const docRef = await addDoc(collection(db, 'mqtt_data'), {
      ...data,
      topic: topic,
      receivedAt: serverTimestamp(),
    });
    console.log('Document written with ID: ', docRef.id);
    return docRef.id;
  } catch (e) {
    console.error('Error adding document: ', e);
    return null;
  }
}
