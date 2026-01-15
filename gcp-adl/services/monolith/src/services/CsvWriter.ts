import { stringify } from 'csv-stringify';
import * as fs from 'fs/promises'; // Use fs/promises for async file operations

export class CsvWriter {
  /**
   * Writes an array of objects to a CSV file.
   *
   * @template T The type of objects to write (must extend object).
   * @param {string} filePath The path to the output CSV file.
   * @param {T[]} data An array of objects to write to the CSV.
   * @param {(keyof T)[]} headers An array of keys from the object T, defining the column order and headers in the CSV.
   * @returns {Promise<void>} A Promise that resolves when the file has been written successfully.
   * @throws {Error} If there's an error during CSV stringification or file writing.
   */
  public async write<T extends object>(filePath: string, data: T[], headers: (keyof T)[]): Promise<void> {
    const columns = headers.map(header => ({ key: header as string, header: String(header) }));

    try {
      const csvString = await new Promise<string>((resolve, reject) => {
        stringify(data, { header: true, columns }, (err, output) => {
          if (err) return reject(err);
          resolve(output || '');
        });
      });
      await fs.writeFile(filePath, csvString);
    } catch (err: any) {
      throw new Error(`Failed to write CSV to ${filePath}: ${err.message}`);
    }
  }
}