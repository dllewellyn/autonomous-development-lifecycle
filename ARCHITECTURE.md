# Project Sovereign: Master Blueprint & Documentation

This file contains the complete specification for the Autonomous Development Lifecycle (ADL) using Jules, Gemini-CLI, and the Ralph methodology.

## 1. Project Blueprint

### Core Repository Structure

| File | Responsibility |
| :--- | :--- |
| `.ralph-state.json` | Heartbeat. Tracks loop status, task IDs, and iteration counts. |
| `GOALS.md` | Long-term vision (Human-managed). |
| `TASKS.md` | Backlog of atomic units of work. |
| `TECH_DEBT.md` | Identified issues for future refactoring. |
| `CONSTITUTION.md` | The legal code of the repo. PRs must comply with these rules. |
| `AGENTS.md` | Meta-Memory. Logs learned behaviors and execution performance. |
| `CONTEXT_MAP.md` | High-level architectural map for AI navigation. |

### The Orchestrator Logic (GitHub Actions)

#### Workflow A: The Heartbeat (Cron: 5 mins)
1. Read `.ralph-state.json`. If `status: stopped`, terminate.
2. Call Jules API: `GET /repos/{owner}/{repo}/jules/tasks`.
3. Analyze status:
    - **None Active**: Trigger Workflow B (Planner).
    - **Waiting for Input**: Trigger Workflow C (Troubleshooter).
    - **Blocked**: Notify Human and set state to stopped.
    - **In Progress**: Do nothing.

#### Workflow B: The Planner (Start Task)
1. Invoke Gemini-CLI to analyze `GOALS.md`, `TASKS.md`, `CONTEXT_MAP.md`, and `AGENTS.md`.
2. Gemini generates a `PLAN.md` with technical instructions.
3. Call Jules API: `POST /tasks` with the plan.
4. Update `.ralph-state.json` with the new `task_id`.

#### Workflow C: The Troubleshooter (Input Provider)
1. Fetch the blocker question from Jules.
2. Gemini-CLI analyzes the codebase and question.
3. Post the definitive technical answer back to Jules via API.

#### Workflow D: The Enforcer (PR Review)
1. Gemini-CLI audits the PR diff against `CONSTITUTION.md`.
2. **If Violations**: Post `@jules [Constitution Violation]: <details>`.
3. **If Compliant**: Approve and merge.

#### Workflow E: The Strategist (Evolution)
1. Triggered on merge to main.
2. Gemini-CLI updates `AGENTS.md` with lessons learned.
3. Removes completed task from `TASKS.md`.
4. Restarts loop via `.ralph-state.json`.

## 2. Repository Constitution

- **Language & Frameworks**: Always use TypeScript 5.4+; prefer Functional Components.
- **Testing**: Minimum 80% line coverage for new features. Use Vitest.
- **Architecture**: All API calls must reside in `/src/services`. No inline fetch.
- **Naming**: Use `camelCase` for variables, `PascalCase` for components.
- **Forbidden**: Do not use `any`. Do not add new dependencies without explicit reason.
- **Interaction**: Jules must never force-push to main.
- **Communication**: If Jules hits a recursion limit (3 failures), it must stop for a human.

## 3. Agent Memory & Performance (AGENTS.md)

### Lessons Learned Log
- **[Date]**: Example: Jules struggles with Tailwind grid layouts; Gemini should provide explicit CSS classes in the plan.
- **[Date]**: Example: Reviewer was too lenient on JSDoc. Updated Constitution Rule #1.

## 4. State & Task Schemas

### `.ralph-state.json`
```json
{
  "status": "started",
  "current_task_id": "jules-12345",
  "last_updated": "2026-01-14T09:00:00Z",
  "iteration_count": 2,
  "max_iterations": 10
}
```

### `TASKS.md`
- [ ] Write the GitHub Action YAML for the "Orchestrator" heartbeat.
- [ ] Integrate Gemini-CLI for automated PR reviews.
- [ ] Create the Strategist pipeline to auto-update AGENTS.md.

## 5. Context Map

- `/src/components`: UI Layer.
- `/src/hooks`: Reusable logic.
- `/src/services`: External API interfaces.
- `/src/utils`: Helper functions.