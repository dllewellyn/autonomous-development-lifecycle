# GitHub Actions Scripts

This directory contains reusable bash scripts used by the Autonomous Development Lifecycle workflows.

## Scripts

### State Management
- **`read-state.sh`** - Reads and validates `.ralph-state.json`
- **`update-state.sh`** - Updates Ralph state after task creation
- **`restart-loop.sh`** - Restarts the autonomous loop

### Context Preparation
- **`prepare-context.sh`** - Prepares GOALS, TASKS, CONTEXT_MAP, and AGENTS files for Gemini
- **`prepare-pr-context.sh`** - Prepares PR diff and CONSTITUTION for review
- **`prepare-merge-context.sh`** - Prepares merge diff for lessons learned
- **`prepare-tasks-context.sh`** - Prepares TASKS.md for updates

### Workflow Logic
- **`check-trigger.sh`** - Determines whether to trigger Planner or Troubleshooter based on Jules task status
- **`parse-audit-result.sh`** - Parses Gemini audit results for PR compliance
- **`commit-changes.sh`** - Reusable script for committing and pushing changes

## Usage

All scripts are designed to be called from GitHub Actions workflows. They use environment variables and GitHub Actions outputs for communication.

### Example

```yaml
- name: Read Ralph state
  id: read_state
  run: ./.github/scripts/read-state.sh
```

## Environment Variables

Scripts may use the following environment variables:
- `GITHUB_OUTPUT` - For setting step outputs
- `GITHUB_ENV` - For setting environment variables
- `BASE_REF` - PR base branch reference
- `COMMIT_MESSAGE` - Custom commit message

## Testing

To test scripts locally:

```bash
# Make scripts executable
chmod +x .github/scripts/*.sh

# Run individual scripts
./.github/scripts/read-state.sh
```

**Note**: Some scripts require GitHub Actions environment variables and may not work fully outside of Actions.
