import * as functions from "firebase-functions";
import {fetchWikipediaHTML} from "./scraper";
import {parseTraitorsData} from "./parser";
import {WIKIPEDIA_URL} from "./config";

export const scheduledScraper = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
      console.log("Scraper function triggered.");

      try {
        const html = await fetchWikipediaHTML(WIKIPEDIA_URL);
        console.log(`Successfully fetched HTML from ${WIKIPEDIA_URL}.`);

        const contestants = parseTraitorsData(html);
        console.log("Parsed contestants:", contestants);
      } catch (error) {
        console.error(`Failed to fetch and parse HTML from ${WIKIPEDIA_URL}.`, error);
      }
    });
