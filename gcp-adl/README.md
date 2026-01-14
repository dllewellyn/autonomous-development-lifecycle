# Google Cloud Platform - Autonomous Development Lifecycle

This directory contains a Google Cloud-based implementation of the Autonomous Development Lifecycle (ADL) system, originally designed to run on GitHub Actions.

## Architecture Overview

The GCP-ADL system replaces GitHub Actions workflows with Google Cloud services:

### Services Architecture

| Component | GCP Service | Trigger | Description |
|-----------|-------------|---------|-------------|
| **Heartbeat** | Cloud Run + Cloud Scheduler | Cron (every 5 mins) | Orchestrator that checks Jules task status and triggers other services |
| **Planner** | Cloud Run | Pub/Sub | Creates new Jules tasks based on GOALS/TASKS analysis using Gemini |
| **Troubleshooter** | Cloud Run | Pub/Sub | Provides answers to Jules when tasks are waiting for input |
| **Enforcer** | Cloud Run | GitHub Webhook | Reviews PRs against CONSTITUTION using Gemini |
| **Strategist** | Cloud Run | GitHub Webhook | Extracts lessons from merges and updates AGENTS.md |

### Component Diagram

```
┌─────────────────┐
│ Cloud Scheduler │ (Every 5 mins)
└────────┬────────┘
         │
         ▼
┌──────────────────┐      ┌────────────────┐
│   Heartbeat      │─────▶│   Cloud Storage│
│   (Cloud Run)    │      │  (.ralph-state) │
└────────┬─────────┘      └────────────────┘
         │
         ├─────────────────┬─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌──────────┐    ┌─────────────┐
    │ Planner │      │Troublesht│    │ Stop/Notify │
    │ (Pub/Sub)│      │  (Pub/Sub)│    └─────────────┘
    └────┬────┘      └─────┬────┘
         │                 │
         ▼                 ▼
    ┌──────────────────────────┐
    │      Jules API           │
    │  (Task Management)       │
    └──────────────────────────┘
              │
              ▼
    ┌──────────────────────────┐
    │    GitHub (Create PR)    │
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │   Enforcer (Webhook)     │◀── GitHub Webhook
    │   Reviews PR             │
    └──────────┬───────────────┘
               │
               ▼ (Merge)
    ┌──────────────────────────┐
    │  Strategist (Webhook)    │◀── GitHub Webhook (push to main)
    │  Updates AGENTS.md       │
    └──────────┬───────────────┘
               │
               │ (triggers via Pub/Sub)
               ▼
    ┌──────────────────────────┐
    │   Planner (Pub/Sub)      │
    │   Start next task        │
    └──────────────────────────┘
```

## Directory Structure

```
gcp-adl/
├── services/               # Individual Cloud Run services
│   ├── heartbeat/         # Orchestrator service
│   ├── planner/           # Task planner service
│   ├── troubleshooter/    # Question answering service
│   ├── enforcer/          # PR review service
│   └── strategist/        # Learning service
├── shared/                # Shared libraries
│   ├── state/            # State management (Cloud Storage)
│   ├── gemini/           # Gemini API client
│   ├── jules/            # Jules API client
│   └── github/           # GitHub API client
├── infrastructure/        # Infrastructure as Code
│   ├── terraform/        # Terraform configs
│   └── scripts/          # Deployment scripts
└── docs/                 # Documentation
    ├── setup.md          # Setup instructions
    ├── deployment.md     # Deployment guide
    └── architecture.md   # Detailed architecture
```

## Key Differences from GitHub Actions Version

1. **State Management**: Instead of committing `.ralph-state.json` to the repo, state is stored in Cloud Storage
2. **Triggering**: Instead of workflow_dispatch, services communicate via Pub/Sub
3. **Authentication**: Uses Google Cloud IAM and service accounts
4. **GitHub Integration**: Uses GitHub App with webhooks instead of GitHub Actions
5. **Gemini Integration**: Uses Gemini API directly instead of gemini-cli GitHub Action

## Prerequisites

- Google Cloud Project with billing enabled
- gcloud CLI installed and configured
- GitHub App created for webhook integration
- API Keys:
  - Gemini API Key
  - Jules API Key
  - GitHub Personal Access Token (for the GitHub App)

## Quick Start

See [docs/setup.md](./docs/setup.md) for detailed setup instructions.

## Environment Variables

Each service requires the following environment variables:

```bash
GEMINI_API_KEY=your-gemini-api-key
JULES_API_KEY=your-jules-api-key
GITHUB_TOKEN=your-github-token
GITHUB_REPOSITORY=owner/repo
STATE_BUCKET=your-cloud-storage-bucket
PUBSUB_PROJECT_ID=your-gcp-project-id
```

## Development

Each service is a standalone Node.js/TypeScript application that can be developed and tested independently.

```bash
# Install dependencies
cd services/heartbeat
npm install

# Run locally
npm run dev

# Build
npm run build

# Test
npm run test
```

## Deployment

See [docs/deployment.md](./docs/deployment.md) for deployment instructions.

## Monitoring

- Cloud Logging: All service logs
- Cloud Monitoring: Service health and metrics
- Error Reporting: Automatic error tracking

## Cost Estimation

Based on typical usage patterns:
- Cloud Run: ~$5-10/month (minimal traffic)
- Cloud Storage: <$1/month (small state files)
- Pub/Sub: <$1/month (low message volume)
- Cloud Scheduler: Free tier
- **Total**: ~$10-15/month

## Support

For issues specific to the GCP implementation, see the documentation in the `docs/` directory.
