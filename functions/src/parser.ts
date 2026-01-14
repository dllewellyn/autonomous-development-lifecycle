
import * as cheerio from 'cheerio';
import { z } from 'zod';

export const ContestantSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
  occupation: z.string().min(1),
  status: z.string().min(1),
});

export type Contestant = z.infer<typeof ContestantSchema>;


export const parseTraitorsData = (html: string): Contestant[] => {
  const $ = cheerio.load(html);
  const rawContestants: any[] = [];

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

        rawContestants.push({
          name,
          age,
          occupation,
          status,
        });
      }
    });
  }

  const validatedContestants = rawContestants
    .map((contestant) => {
      const validationResult = ContestantSchema.safeParse(contestant);
      if (!validationResult.success) {
        console.error(`Validation failed for contestant: ${contestant.name}`, validationResult.error.issues);
        return null;
      }
      return validationResult.data;
    })
    .filter((c): c is Contestant => c !== null);


  return validatedContestants;
};
