import * as functions from "firebase-functions";
import {fetchWikipediaHTML} from "./scraper";
import {WIKIPEDIA_URLS} from "./config";

export const scheduledScraper = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
      console.log("Scraper function triggered.");

      for (const url of WIKIPEDIA_URLS) {
        try {
          const html = await fetchWikipediaHTML(url);
          console.log(`Successfully fetched HTML from ${url}.`);
          console.log(html.substring(0, 500));
        } catch (error) {
          console.error(`Failed to fetch HTML from ${url}.`, error);
        }
      }
    });
