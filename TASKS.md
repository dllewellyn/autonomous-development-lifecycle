# Task Backlog

- [ ] Align ESLint configuration with Constitution (Strict rules + JSDoc enforcement).
- [ ] Verify/Update Husky pre-commit hooks to run lint and tests before commit.
- [ ] Update CI/CD pipeline to strictly enforce 90% test coverage threshold.
- [ ] Integrate Firebase Storage to save the generated CSV file.
- [ ] Add monitoring and alerting for the scheduled Firebase Function.

--- COMPLETED WORK ---
- [x] Implement CSV generation logic using the parsed data.
- [x] Develop a parser to extract episode/series statistics from the HTML tables.
- [x] Add unit tests for the parser logic.
- [x] Add schema validation for parsed data to detect page layout changes.
- [x] Integrate session management and violation feedback with the Jules API.
- [x] Create a CI/CD pipeline that runs build, tests, lint, husky etc to ensure pull-requests are up-to-scratch
- [x] Implement the scraper logic to fetch Wikipedia HTML for UK Traitors series.
- [x] Audit CI/CD workflows for secret usage consistency.
- [x] Refactor CI/CD workflows for simplicity and maintainability.
- [x] Correct API key variable in the heartbeat workflow.
- [x] Configure permissions for the heartbeat workflow.
- [x] Initialize Firebase project with TypeScript configuration (`firebase init functions`).
- [x] Configure `tsconfig.json` and install scraping dependencies (e.g., `axios`, `cheerio`).
- [x] Create a scheduled Firebase Function (Pub/Sub) to trigger every 24 hours.