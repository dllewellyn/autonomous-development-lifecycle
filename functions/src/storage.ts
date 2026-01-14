import * as admin from "firebase-admin";

export async function uploadCsvToStorage(
    csvContent: string,
    fileName: string,
): Promise<void> {
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(fileName);
    await file.save(csvContent);
    console.log(`Successfully uploaded ${fileName} to ${bucket.name}.`);
  } catch (error) {
    console.error("Failed to upload CSV to storage:", error);
    throw error;
  }
}
