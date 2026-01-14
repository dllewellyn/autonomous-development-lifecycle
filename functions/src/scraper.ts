import axios from "axios";

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
