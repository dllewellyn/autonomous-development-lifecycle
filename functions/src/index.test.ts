import * as functions from "firebase-functions-test";
import { scheduledScraper } from "./index";
import { fetchWikipediaHTML } from "./scraper";
import { parseTraitorsData } from "./parser";

// Initialize firebase-functions-test.
const test = functions();

// Mock the scraper and parser modules.
jest.mock("./scraper", () => ({
  fetchWikipediaHTML: jest.fn(),
}));
jest.mock("./parser", () => ({
    parseTraitorsData: jest.fn(),
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

  it("should log the parsed data on success", async () => {
    const mockHtml = "<html><body><h1>Test HTML</h1></body></html>";
    const mockContestants = [{ name: 'Test', age: 30, occupation: 'Tester', status: 'Testing' }];
    (fetchWikipediaHTML as jest.Mock).mockResolvedValue(mockHtml);
    (parseTraitorsData as jest.Mock).mockReturnValue(mockContestants);

    const wrapped = test.wrap(scheduledScraper);
    await wrapped({});

    expect(console.log).toHaveBeenCalledWith("Scraper function triggered.");
    expect(fetchWikipediaHTML).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Successfully fetched HTML")
    );
    expect(parseTraitorsData).toHaveBeenCalledWith(mockHtml);
    expect(console.log).toHaveBeenCalledWith("Parsed contestants:", mockContestants);
  });

  it("should log an error on failure", async () => {
    const mockError = new Error("Failed to fetch");
    (fetchWikipediaHTML as jest.Mock).mockRejectedValue(mockError);

    const wrapped = test.wrap(scheduledScraper);
    await wrapped({});

    expect(console.log).toHaveBeenCalledWith("Scraper function triggered.");
    expect(fetchWikipediaHTML).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch and parse HTML"),
      mockError
    );
  });
});
