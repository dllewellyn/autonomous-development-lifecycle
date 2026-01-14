import axios from "axios";
import * as admin from "firebase-admin";
import {config} from "./config";

export async function fetchWikipediaHTML(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "TraitorsScraper/1.0 (https://github.com/dllewellyn/autonomous-development-lifecycle; dllewellyn@google.com)",
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching HTML from ${url}:`, error);
    throw error;
  }
}

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
