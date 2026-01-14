import {fetchWikipediaHTML, uploadCsvToStorage} from "./scraper";
import {WIKIPEDIA_URL, config} from "./config";
import axios from "axios";
import * as admin from "firebase-admin";

jest.mock("axios");

const mockSave = jest.fn();
const mockFile = jest.fn(() => ({save: mockSave}));
const mockBucket = jest.fn(() => ({file: mockFile}));

jest.mock("firebase-admin", () => ({
  storage: jest.fn(() => ({
    bucket: mockBucket,
  })),
}));


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

describe("uploadCsvToStorage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should upload the CSV content to the correct bucket and file", async () => {
    const csvContent = "header1,header2\nvalue1,value2";
    const fileName = "test.csv";

    await uploadCsvToStorage(csvContent, fileName);

    expect(admin.storage().bucket).toHaveBeenCalledWith(config.storageBucket);
    expect(mockFile).toHaveBeenCalledWith(fileName);
    expect(mockSave).toHaveBeenCalledWith(csvContent);
  });

  it("should throw an error and log it on failure", async () => {
    const mockError = new Error("Upload failed");
    mockSave.mockRejectedValue(mockError);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    const csvContent = "header1,header2\nvalue1,value2";
    const fileName = "test.csv";

    await expect(uploadCsvToStorage(csvContent, fileName)).rejects.toThrow(
        "Upload failed",
    );

    expect(console.error).toHaveBeenCalledWith(
        "Failed to upload CSV to storage:",
        mockError,
    );

    consoleErrorSpy.mockRestore();
  });
});
