
import * as cheerio from 'cheerio';

export interface Contestant {
  name: string;
  age: number;
  occupation: string;
  status: string;
}

export const parseTraitorsData = (html: string): Contestant[] => {
  const $ = cheerio.load(html);
  const contestants: Contestant[] = [];

  let contestantsTable: cheerio.Cheerio | undefined;

  $('table.wikitable').each((_, tableElement) => {
    const table = $(tableElement);
    const caption = table.find('caption');
    if (caption.text().trim() === 'List of The Traitors contestants') {
      contestantsTable = table;
    }
  });


  if (contestantsTable) {
    contestantsTable.find('tbody tr').slice(1).each((i: number, row: cheerio.Element) => {
      const columns = $(row).children();

      if (columns.length >= 6) {
        const name = $(columns[0]).text().trim();
        const age = parseInt($(columns[1]).text().trim(), 10);
        const occupation = $(columns[3]).text().trim();
        const status = $(columns[5]).text().trim().replace(/\[\d+\]/g, '');

        contestants.push({
          name,
          age,
          occupation,
          status,
        });
      }
    });
  }

  return contestants;
};
