import {scraperHandler} from "./index";
import {fetchWikipediaHTML} from "./scraper";
import {parseTraitorsData} from "./parser";
import {generateCsv} from "./csv";
import {uploadCsvToStorage} from "./storage";

// Mock firebase-functions used by config.ts
jest.mock("firebase-functions", () => ({
  config: () => ({
    firebase: {
      storageBucket: "test-bucket",
    },
  }),
  pubsub: {
    schedule: () => ({
      onRun: () => {},
    }),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  onRequest: jest.fn(),
}));


// Mock modules
jest.mock("./scraper");
jest.mock("./parser");
jest.mock("./csv");
jest.mock("./storage");

describe("scraperHandler", () => {
  beforeEach(() => {
    // Spy on console.log and console.error to check their outputs.
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    // Restore original console functions and clear mocks.
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
    jest.clearAllMocks();
  });

  it("should run the full success path: fetch, parse, generate CSV, and upload", async () => {
    const mockHtml = "<html><body><h1>Test HTML</h1></body></html>";
    const mockContestants = [{name: "Test", age: 30, occupation: "Tester", status: "Testing"}];
    const mockCsv = "name,age,occupation,status\nTest,30,Tester,Testing";

    (fetchWikipediaHTML as jest.Mock).mockResolvedValue(mockHtml);
    (parseTraitorsData as jest.Mock).mockReturnValue(mockContestants);
    (generateCsv as jest.Mock).mockReturnValue(mockCsv);

    await scraperHandler();

    expect(console.log).toHaveBeenCalledWith("Scraper function triggered.");
    expect(fetchWikipediaHTML).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Successfully fetched HTML"));
    expect(parseTraitorsData).toHaveBeenCalledWith(mockHtml);
    expect(console.log).toHaveBeenCalledWith("Parsed contestants:", mockContestants);
    expect(generateCsv).toHaveBeenCalledWith(mockContestants);
    expect(console.log).toHaveBeenCalledWith("Generated CSV:", mockCsv);
    expect(uploadCsvToStorage).toHaveBeenCalledWith(mockCsv, "traitors-uk-series-1.csv");
  });

  it("should log an error on failure and re-throw the error", async () => {
    const mockError = new Error("Failed to fetch");
    (fetchWikipediaHTML as jest.Mock).mockRejectedValue(mockError);

    await expect(scraperHandler()).rejects.toThrow("Failed to fetch");

    expect(console.log).toHaveBeenCalledWith("Scraper function triggered.");
    expect(fetchWikipediaHTML).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch, parse, and upload data"),
      mockError,
    );
  });
});

// After all modules are mocked, load the index to get the handler
require("./index");
const {onRequest} = require("firebase-functions/v2/https");
const onDemandHandler = (onRequest as jest.Mock).mock.calls[0][0];

describe("scrapeTraitorsOnDemand", () => {
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  it("should call scraperHandler and return 200 on success", async () => {
    // Mock the full success path for scraperHandler's dependencies
    (fetchWikipediaHTML as jest.Mock).mockResolvedValue("<html></html>");
    (parseTraitorsData as jest.Mock).mockReturnValue([]);
    (generateCsv as jest.Mock).mockReturnValue("csv");
    (uploadCsvToStorage as jest.Mock).mockResolvedValue(undefined);

    await onDemandHandler(mockRequest, mockResponse);

    // Verify that the scraperHandler's logic was executed
    expect(uploadCsvToStorage).toHaveBeenCalledTimes(1);
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.send).toHaveBeenCalledWith("Scraping complete.");
  });

  it("should return 500 if scraperHandler fails", async () => {
    // Mock a failure in one of the scraperHandler's dependencies
    const mockError = new Error("Scraping failed");
    (fetchWikipediaHTML as jest.Mock).mockRejectedValue(mockError);

    await onDemandHandler(mockRequest, mockResponse);

    // Verify that the error is caught and a 500 is returned
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith("Scraping failed.");
  });
});
