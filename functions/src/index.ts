import * as functions from "firebase-functions";
import {fetchWikipediaHTML} from "./scraper";
import {WIKIPEDIA_URL} from "./config";

export const scheduledScraper = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
      console.log("Scraper function triggered.");

      try {
        const html = await fetchWikipediaHTML(WIKIPEDIA_URL);
        console.log(`Successfully fetched HTML from ${WIKIPEDIA_URL}.`);
        console.log(html.substring(0, 500));
      } catch (error) {
        console.error(`Failed to fetch HTML from ${WIKIPEDIA_URL}.`, error);
      }
    });
