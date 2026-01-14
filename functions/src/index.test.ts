import * as functions from "firebase-functions-test";
import { scheduledScraper } from "./index";
import { fetchWikipediaHTML } from "./scraper";

// Initialize firebase-functions-test.
const test = functions();

// Mock the scraper module.
jest.mock("./scraper", () => ({
  fetchWikipediaHTML: jest.fn(),
}));

describe("scheduledScraper", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on console.log and console.error to check their outputs.
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    // Restore original console functions.
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  it("should log the fetched HTML on success", async () => {
    const mockHtml = "<html><body><h1>Test HTML</h1></body></html>";
    (fetchWikipediaHTML as jest.Mock).mockResolvedValue(mockHtml);

    const wrapped = test.wrap(scheduledScraper);
    await wrapped({});

    expect(console.log).toHaveBeenCalledWith("Scraper function triggered.");
    expect(fetchWikipediaHTML).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Successfully fetched HTML")
    );
    expect(console.log).toHaveBeenCalledWith(mockHtml.substring(0, 500));
  });

  it("should log an error on failure", async () => {
    const mockError = new Error("Failed to fetch");
    (fetchWikipediaHTML as jest.Mock).mockRejectedValue(mockError);

    const wrapped = test.wrap(scheduledScraper);
    await wrapped({});

    expect(console.log).toHaveBeenCalledWith("Scraper function triggered.");
    expect(fetchWikipediaHTML).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch HTML"),
      mockError
    );
  });
});
