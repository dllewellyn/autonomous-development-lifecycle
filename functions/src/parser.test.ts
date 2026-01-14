
import * as fs from 'fs';
import * as path from 'path';
import { parseTraitorsData } from './parser';

describe('parseTraitorsData', () => {
  it('should parse the HTML and return the correct contestant data', () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'traitors-series-1.html'), 'utf-8');
    const result = parseTraitorsData(html);

    expect(result).toHaveLength(22);
    expect(result[0]).toEqual({
      name: 'Aisha Birley',
      age: 23,
      occupation: 'Masters Graduate',
      status: 'Murdered(Episode 2)',
    });
    expect(result[21]).toEqual({
        name: 'Meryl Williams',
        age: 25,
        occupation: 'Call centre agent',
        status: 'Winner(Episode 12)',
    });
  });

  it('should filter out invalid contestant data', () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'traitors-series-1-malformed.html'), 'utf-8');
    const result = parseTraitorsData(html);

    expect(result).toHaveLength(2);
    expect(result.find(c => c.name === 'Invalid Contestant')).toBeUndefined();
  });
});
