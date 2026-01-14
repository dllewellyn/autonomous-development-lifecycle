# Agent Lessons Learned

## Wednesday, January 14, 2026

A new feature for scraping a Wikipedia page was successfully implemented and merged. The changes demonstrated several best practices in software development, which have been recorded here as lessons learned.

### 1. Prioritize Test-Driven Development (TDD)
- **Observation:** The merged code included a comprehensive test suite for the new functionality. Unit tests were written for both the scraper and the main cloud function.
- **Lesson:** Writing tests alongside new features is crucial for ensuring code quality and preventing regressions. Using mocking libraries (like `axios--mock-adapter`) is an effective way to isolate components and test them independently.

### 2. Isolate Configuration from Logic
- **Observation:** The Wikipedia URL, a configurable value, was stored in a separate `config.ts` file.
- **Lesson:** Externalizing configuration into separate files makes the application more flexible and easier to maintain. It allows for changes in configuration without modifying the core application logic.

### 3. Maintain Clear Separation of Concerns
- **Observation:** The new feature was well-structured, with distinct files for scraping logic (`scraper.ts`), the main cloud function (`index.ts`), and configuration (`config.ts`).
- **Lesson:** A clear separation of concerns makes the codebase more modular, easier to understand, and simpler to test and debug.

### 4. Be a Good Web Scraping Citizen
- **Observation:** The scraper included a `User-Agent` header in its requests, identifying itself and providing contact information.
- **Lesson:** When scraping websites, it is important to be respectful of the site's resources and policies. Setting a descriptive `User-Agent` is a key part of responsible scraping.

### 5. Leverage Automation for Repetitive Tasks
- **Observation:** The scraper was implemented as a scheduled function that runs automatically every 24 hours.
- **Lesson:** Automating repetitive tasks using scheduled functions or cron jobs is an efficient way to handle routine processes without manual intervention.

### 6. Invest in Code Quality and Tooling
- **Observation:** The project was updated to include Jest for testing and to generate code coverage reports.
- **Lesson:** Investing in tooling for testing, linting, and code coverage helps to maintain a high level of code quality and catches potential issues early in the development process.