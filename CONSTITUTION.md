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

## Agent Protocols
- **Context First**: Agents must read `AGENTS.md`, `GOALS.md`, `TASKS.md` and relevant code files before planning or editing.
- **Verification**: Agents must run `npm test` and `npm run lint` locally before committing.
- **Self-Correction**: Agents are expected to attempt to fix their own errors before asking for help.
- **Dependencies**: Never hallucinate imports. Only use libraries listed in `package.json`.

## Documentation Standards
- **JSDoc/TSDoc**: Mandatory for all exported functions and interfaces.
- **Commit Messages**: Must follow Conventional Commits (e.g., `feat: add scraper`, `fix: handle timeout`) and include *why* the change was made.

## Security & Safety
- **Secrets**: Zero tolerance for committing secrets/keys.
- **Environment**: Strict separation of `dev` and `prod` configurations.