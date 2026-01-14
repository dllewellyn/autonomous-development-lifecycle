import { generateCsv } from './csv';
import { Contestant } from './parser';

describe('generateCsv', () => {
  it('should generate a CSV string from an array of contestants', () => {
    const contestants: Contestant[] = [
      { name: 'Alice', age: 30, occupation: 'Engineer', status: 'Active' },
      { name: 'Bob', age: 25, occupation: 'Designer', status: 'Eliminated' },
    ];

    const expectedCsv = `name,age,occupation,status
Alice,30,Engineer,Active
Bob,25,Designer,Eliminated`;

    const csv = generateCsv(contestants);
    expect(csv).toEqual(expectedCsv);
  });
});
