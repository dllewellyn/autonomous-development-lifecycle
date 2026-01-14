import * as admin from "firebase-admin";
import {config} from "./config";

export async function uploadCsvToStorage(
    csvContent: string,
    fileName: string,
): Promise<void> {
  try {
    const bucket = admin.storage().bucket(config.storageBucket);
    const file = bucket.file(fileName);
    await file.save(csvContent);
    console.log(`Successfully uploaded ${fileName} to ${config.storageBucket}.`);
  } catch (error) {
    console.error("Failed to upload CSV to storage:", error);
    throw error;
  }
}
