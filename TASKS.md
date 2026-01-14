# Task Backlog

- [ ] Develop a parser to extract episode/series statistics from the HTML tables.
- [ ] Add unit tests for the parser logic.
- [ ] Add schema validation for parsed data to detect page layout changes.
- [ ] Implement CSV generation logic using the parsed data.
- [ ] Integrate Firebase Storage to save the generated CSV file.
- [ ] Add monitoring and alerting for the scheduled Firebase Function.

--- COMP-LETED WORK ---
- [x] Create a CI/CD pipeline that runs build, tests, lint, husky etc to ensure pull-requests are up-to-scratch
- [x] Implement the scraper logic to fetch Wikipedia HTML for UK Traitors series.
- [x] Audit CI/CD workflows for secret usage consistency.
- [x] Refactor CI/CD workflows for simplicity and maintainability.
- [x] Correct API key variable in the heartbeat workflow.
- [x] Configure permissions for the heartbeat workflow.
- [x] Initialize Firebase project with TypeScript configuration (`firebase init functions`).
- [x] Configure `tsconfig.json` and install scraping dependencies (e.g., `axios`, `cheerio`).
- [x] Create a scheduled Firebase Function (Pub/Sub) to trigger every 24 hours.