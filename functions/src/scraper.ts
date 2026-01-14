import axios from "axios";

const WIKIPEDIA_URL =
  "https://en.wikipedia.org/wiki/The_Traitors_(British_TV_series)";

/**
 * Fetches the HTML content of the Wikipedia page for
 * The Traitors (British TV series).
 * @param {string} url The URL of the Wikipedia page to fetch.
 * @return {Promise<string>} The HTML content of the page.
 */
export async function fetchWikipediaHTML(
    url: string = WIKIPEDIA_URL,
): Promise<string> {
  try {
    const response = await axios.get(url);
    if (response.status !== 200) {
      throw new Error(`Failed to fetch HTML. Status: ${response.status}`);
    }
    return response.data;
  } catch (error) {
    console.error("Error fetching Wikipedia page:", error);
    throw error; // Re-throw to be handled by the caller
  }
}
