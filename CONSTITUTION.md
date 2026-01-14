# Repository Constitution

## Language & Frameworks
- **Language**: TypeScript is mandatory for all source code.
- **Platform**: Firebase Functions.
- **Runtime**: Node.js (Latest LTS).

## Testing
- **Framework**: Jest.
- **Coverage**: Minimum **90%** code coverage required for both unit and integration tests.
- **Types**: Unit tests for logic; Integration tests for Firebase emulators/interaction.
- **Enforcement**: Tests must pass before any merge.

## Code Quality & Style
- **Linting**: Strict ESLint configuration (`eslint:recommended`, `plugin:@typescript-eslint/recommended`).
- **Pre-commit**: Husky must be configured to run linting and tests on commit.
- **Style**: Prefer functional programming patterns where appropriate. avoid `any` type.

## Workflow
- **Merge Strategy**: **Squash and Merge** only.
- **CI/CD**: GitHub Actions must verify build, lint, and test steps.
- **Force Push**: Strictly forbidden on the `main` branch.

## Architecture
- **Separation of Concerns**: Scraper logic, Parser logic, and Storage logic must be decoupled.
- **Configuration**: No hardcoded credentials; use environment variables or Firebase config.
