import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {fetchWikipediaHTML} from "./scraper";
import {uploadCsvToStorage} from "./storage";
import {parseTraitorsData} from "./parser";
import {WIKIPEDIA_URL} from "./config";
import {generateCsv} from "./csv";

admin.initializeApp();

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

export const scheduledScraper = functions.pubsub
    .schedule("every 24 hours")
    .onRun(scraperHandler);

export const scrapeTraitorsOnDemand = onRequest(async (request, response) => {
  try {
    await scraperHandler();
    response.status(200).send("Scraping complete.");
  } catch (error) {
    console.error("Error during on-demand scraping:", error);
    response.status(500).send("Scraping failed.");
  }
});
