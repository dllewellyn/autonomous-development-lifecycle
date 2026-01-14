import * as functions from "firebase-functions";
import {fetchWikipediaHTML} from "./scraper";

export const scrapeTraitorsData = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
      console.log("Scraper function triggered.");
      try {
        const html = await fetchWikipediaHTML();
        console.log(`Successfully fetched HTML of length: ${html.length}`);
        // Next steps (parsing, CSV generation) will be added here.
      } catch (error) {
        console.error("Failed to execute scraper:", error);
        // Future step: Add alerting here.
      }
      return null;
    });
