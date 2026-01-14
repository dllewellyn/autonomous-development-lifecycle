# Firebase Functions ADL Implementation

This directory contains the Firebase Functions implementation of the Autonomous Development Lifecycle (ADL).

## Architecture

The ADL system uses Firebase Functions instead of Cloud Run for a simpler, more integrated approach:

### Functions

1. **heartbeat** (Scheduled, every 5 minutes)
   - Orchestrates the system
   - Checks state and Jules status
   - Triggers Planner or Troubleshooter as needed

2. **planner** (Callable)
   - Analyzes repository state using Gemini
   - Creates Jules tasks
   - Updates state

3. **enforcer** (HTTP)
   - GitHub webhook for PR events
   - Reviews PRs against CONSTITUTION.md
   - Approves/requests changes

4. **strategist** (HTTP)
   - GitHub webhook for push to main
   - Extracts lessons learned
   - Updates AGENTS.md and TASKS.md
   - Triggers Planner for next cycle

5. **troubleshooter** (Callable)
   - Provides answers to Jules (simplified)

### State Management

State is stored in Firestore at `system/ralph-state`:
```typescript
{
  status: 'started' | 'stopped',
  current_task_id: string | null,
  last_updated: string,
  iteration_count: number,
  max_iterations: number
}
```

## Setup

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Firebase

```bash
firebase functions:config:set \
  gemini.apikey="YOUR_GEMINI_API_KEY" \
  jules.apikey="YOUR_JULES_API_KEY" \
  github.token="YOUR_GITHUB_TOKEN" \
  github.repository="owner/repo" \
  github.branch="main"
```

Or use environment variables in `.env`:
```
GEMINI_API_KEY=your-key
JULES_API_KEY=your-key
GITHUB_TOKEN=your-token
GITHUB_REPOSITORY=owner/repo
GITHUB_BRANCH=main
```

### 3. Initialize Firestore

The state document will be created automatically on first run.

### 4. Deploy

```bash
firebase deploy --only functions
```

## GitHub Webhooks

After deployment, configure webhooks:

1. **Enforcer** (PR events)
   - URL: `https://REGION-PROJECT.cloudfunctions.net/enforcer`
   - Events: Pull requests

2. **Strategist** (Push events)
   - URL: `https://REGION-PROJECT.cloudfunctions.net/strategist`
   - Events: Pushes (to main branch)

## Directory Structure

```
functions/src/
├── adl/
│   ├── shared/          # Shared utilities
│   │   ├── types.ts
│   │   ├── state-manager.ts
│   │   ├── jules-client.ts
│   │   ├── gemini-client.ts
│   │   └── github-client.ts
│   └── services/        # ADL functions
│       └── index.ts     # All ADL functions
├── scraper.ts          # Existing scraper
├── parser.ts
├── csv.ts
├── storage.ts
└── index.ts            # Main exports
```

## Testing

```bash
# Run tests
npm test

# Build
npm run build

# Local emulator
npm run serve
```

## Monitoring

View logs:
```bash
firebase functions:log
```

Or in Firebase Console:
- Functions → Logs

## Cost

Firebase Functions pricing:
- **Free tier**: 2M invocations/month
- **Compute**: $0.40/million invocations + compute time
- **Heartbeat**: ~8,640 invocations/month (every 5 min)
- **Estimated**: $5-10/month

## Benefits vs Cloud Run

- ✅ Simpler deployment (single command)
- ✅ Unified codebase with existing functions
- ✅ Built-in Firestore integration
- ✅ Native scheduled functions
- ✅ Generous free tier
- ✅ Automatic scaling
- ✅ Less infrastructure management

## Development

The ADL implementation is modular:
- **Shared utilities** in `adl/shared/` can be reused
- **Functions** in `adl/services/` are independent
- **Existing scraper** functions remain unchanged

## Complete Workflow

1. **Heartbeat** runs every 5 minutes
2. If no active Jules tasks → **Planner** creates one
3. Jules executes → Creates PR
4. GitHub webhook → **Enforcer** reviews PR
5. If compliant → PR merged
6. Push to main → **Strategist** learns and updates
7. **Strategist** triggers **Planner** → Cycle repeats
