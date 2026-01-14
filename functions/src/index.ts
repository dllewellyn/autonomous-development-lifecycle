import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {fetchWikipediaHTML} from "./scraper";
import {uploadCsvToStorage} from "./storage";
import {parseTraitorsData} from "./parser";
import {WIKIPEDIA_URL} from "./config";
import {generateCsv} from "./csv";

admin.initializeApp();

/**
 * Handles the scraping of The Traitors Wikipedia page, parsing the data,
 * and uploading it as a CSV to Firebase Storage.
 * @throws {Error} Throws an error if any step of the process fails.
 */
export const scraperHandler = async (): Promise<void> => {
  console.log("Scraper function triggered.");

  try {
    const html = await fetchWikipediaHTML(WIKIPEDIA_URL);
    console.log(`Successfully fetched HTML from ${WIKIPEDIA_URL}.`);

    const contestants = parseTraitorsData(html);
    console.log("Parsed contestants:", contestants);

    const csv = generateCsv(contestants);
    console.log("Generated CSV:", csv);

    const fileName = "traitors-uk-series-1.csv";
    await uploadCsvToStorage(csv, fileName);
  } catch (error) {
    console.error(`Failed to fetch, parse, and upload data from ${WIKIPEDIA_URL}.`, error);
    throw error;
  }
};

import {onRequest} from "firebase-functions/v2/https";

/**
 * A scheduled Firebase Function that runs the scraper every 24 hours.
 */
export const scheduledScraper = functions.pubsub
    .schedule("every 24 hours")
    .onRun(scraperHandler);

/**
 * An HTTP-triggered Firebase Function that runs the scraper on demand.
 *
 * @param {functions.https.Request} request The HTTP request object.
 * @param {functions.Response} response The HTTP response object.
 */
export const api = onRequest(async (request, response) => {
  try {
    await scraperHandler();
    response.status(200).json({status: "success", message: "Scraping completed."});
  } catch (error) {
    console.error("Error during on-demand scraping:", error);
    response.status(500).json({status: "error", message: "An error occurred during scraping."});
  }
});
