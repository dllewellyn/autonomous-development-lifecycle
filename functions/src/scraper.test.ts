import { fetchWikipediaHTML } from "./scraper";
import { WIKIPEDIA_URL } from "./config";
import axios from "axios";

jest.mock("axios");

describe("fetchWikipediaHTML", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch HTML from the given URL on success", async () => {
    const mockHtml = "<html><body><h1>Success</h1></body></html>";
    (axios.get as jest.Mock).mockResolvedValue({ data: mockHtml });

    const html = await fetchWikipediaHTML(WIKIPEDIA_URL);

    expect(axios.get).toHaveBeenCalledWith(WIKIPEDIA_URL, {
      headers: {
        "User-Agent":
          "TraitorsScraper/1.0 (https://github.com/dllewellyn/autonomous-development-lifecycle; dllewellyn@google.com)",
      },
    });
    expect(html).toBe(mockHtml);
  });

  it("should throw an error and log it on failure", async () => {
    const mockError = new Error("Network error");
    (axios.get as jest.Mock).mockRejectedValue(mockError);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    await expect(fetchWikipediaHTML(WIKIPEDIA_URL)).rejects.toThrow(
      "Network error"
    );

    expect(axios.get).toHaveBeenCalledWith(WIKIPEDIA_URL, expect.any(Object));
    expect(console.error).toHaveBeenCalledWith(
      `Error fetching HTML from ${WIKIPEDIA_URL}:`,
      mockError
    );

    consoleErrorSpy.mockRestore();
  });
});
