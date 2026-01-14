import { unparse } from 'papaparse';
import { Contestant } from './parser';

export const generateCsv = (contestants: Contestant[]): string => {
  const csv = unparse(contestants, {
    header: true,
    newline: '\n',
  });
  return csv;
};
