# Task Backlog

- [ ] Implement the scraper logic to fetch Wikipedia HTML for UK Traitors series.
- [ ] Develop a parser to extract episode/series statistics from the HTML tables.
- [ ] Implement CSV generation logic using the parsed data.
- [ ] Integrate Firebase Storage to save the generated CSV file.
- [ ] Add unit tests for the parser logic.
- [ ] Add monitoring and alerting for the scheduled Firebase Function.

--- COMPLETED WORK ---
- [x] Initialize Firebase project with TypeScript configuration (`firebase init functions`).
- [x] Configure `tsconfig.json` and install scraping dependencies (e.g., `axios`, `cheerio`).
- [x] Create a scheduled Firebase Function (Pub/Sub) to trigger every 24 hours.