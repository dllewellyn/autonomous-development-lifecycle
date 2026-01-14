import {uploadCsvToStorage} from "./storage";
import * as admin from "firebase-admin";

const mockSave = jest.fn();
const mockFile = jest.fn(() => ({save: mockSave}));
const mockBucket = jest.fn(() => ({file: mockFile, name: "test-bucket"}));

jest.mock("firebase-admin", () => ({
  storage: jest.fn(() => ({
    bucket: mockBucket,
  })),
}));

describe("uploadCsvToStorage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should upload the CSV content to the correct bucket and file", async () => {
    const csvContent = "header1,header2\nvalue1,value2";
    const fileName = "test.csv";

    await uploadCsvToStorage(csvContent, fileName);

    expect(admin.storage().bucket).toHaveBeenCalledWith();
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
