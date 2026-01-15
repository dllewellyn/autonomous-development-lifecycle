# Google Cloud Platform - Autonomous Development Lifecycle

This directory contains a Google Cloud-based implementation of the Autonomous Development Lifecycle (ADL) system, originally designed to run on GitHub Actions.

## Architecture Overview

Single Probot-based Cloud Run service that handles all workflows:

| Component | Implementation | Trigger | Description |
|-----------|---------------|---------|-------------|
| **Heartbeat** | `/heartbeat` endpoint | Cloud Scheduler (every 5 mins) | Orchestrator that checks Jules task status |
| **Planner** | Internal function | Called by Heartbeat/Strategist | Creates Jules tasks using Gemini |
| **Troubleshooter** | Internal function | Called by Heartbeat | Answers Jules questions using Gemini |
| **Enforcer** | Probot webhook handler | GitHub PR events | Reviews PRs against CONSTITUTION |
| **Strategist** | Probot webhook handler | GitHub push events | Extracts lessons, updates AGENTS.md/TASKS.md |

**Benefits:**
- 70% cost reduction vs microservices
- Simpler deployment and monitoring
- No Pub/Sub complexity
- Faster execution (no async overhead)
- Native GitHub API via Probot

## Architecture Diagram

```
Cloud Scheduler (every 5 min)
    │
    ▼
POST /heartbeat
    │
    ├─→ runPlanner() [internal]
    │       │
    │       ▼
    │   Create Jules session
    │
    └─→ runTroubleshooter() [internal]
            │
            ▼
        Answer Jules question

GitHub Webhooks → Probot App
    │
    ├─→ pull_request.* → Enforcer Handler
    │       │
    │       ▼
    │   Review PR → Approve/Reject → Notify Jules
    │
    └─→ push (main) → Strategist Handler
            │
            ▼
        Update AGENTS.md/TASKS.md → runPlanner() [internal]
```

## Directory Structure

```
gcp-adl/
├── services/                    # Cloud Run service
│   └── monolith/               # Single unified service
│       ├── src/
│       │   ├── handlers/       # Probot webhook handlers
│       │   ├── services/       # Business logic modules
│       │   ├── utils/          # Utilities
│       │   ├── index.ts        # Probot entry point
│       │   └── server.ts       # Express server
│       ├── Dockerfile
│       ├── package.json
│       └── README.md
├── shared/                     # Shared libraries
│   ├── state/                 # State management (Cloud Storage)
│   ├── gemini/                # Gemini API client
│   ├── jules/                 # Jules API client
│   └── github/                # GitHub API client
├── infrastructure/             # Infrastructure as Code
│   └── scripts/               # Deployment scripts
│       ├── build-monolith.sh
│       ├── deploy-monolith.sh
│       └── cleanup-old-services.sh
├── docs/                      # Documentation
│   ├── setup.md
│   ├── deployment.md
│   └── architecture.md
├── MONOLITH_MIGRATION_PLAN.md # Migration guide (if coming from microservices)
├── QUICKSTART.md              # 15-minute setup guide
└── README.md                  # This file
```
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
5. **Gemini Integration**: Uses gemini-cli directly in the container instead of gemini-cli GitHub Action

## Prerequisites

- Google Cloud Project with billing enabled
- gcloud CLI installed and configured
- GitHub App created for webhook integration
- API Keys:
  - Gemini API Key
  - Jules API Key
  - GitHub Personal Access Token (for the GitHub App)

## Quick Start

**Get up and running in 15 minutes!**

See [QUICKSTART.md](./QUICKSTART.md) for a step-by-step guide.

### Prerequisites

- GCP account with billing enabled
- GitHub App created (see [services/monolith/README.md](./services/monolith/README.md))
- Node.js 20+, Docker, gcloud CLI

### Deploy

```bash
# 1. Set environment variables
export GCP_PROJECT_ID=your-project-id
export GITHUB_REPOSITORY=owner/repo

# 2. Build and deploy
./infrastructure/scripts/build-monolith.sh
./infrastructure/scripts/deploy-monolith.sh

# 3. Configure Cloud Scheduler and GitHub webhooks (see output)
```

## Environment Variables

The service requires the following environment variables (stored in GCP Secret Manager):

```bash
# GitHub App (Probot)
APP_ID=your-github-app-id
PRIVATE_KEY=your-github-app-private-key
WEBHOOK_SECRET=your-webhook-secret

# Application
GITHUB_REPOSITORY=owner/repo
GITHUB_BRANCH=main

# External APIs
GEMINI_API_KEY=your-gemini-api-key
JULES_API_KEY=your-jules-api-key

# GCP
STATE_BUCKET=your-state-bucket-name
```

## Local Development

```bash
# Navigate to service
cd services/monolith

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run locally
npm run dev

# Use smee.io for webhook forwarding
npm install -g smee-client
smee --url https://smee.io/your-channel --target http://localhost:3000
```

## Deployment

### Quick Deploy
```bash
export GCP_PROJECT_ID=your-project-id
export GITHUB_REPOSITORY=owner/repo
./infrastructure/scripts/build-monolith.sh
./infrastructure/scripts/deploy-monolith.sh
```

### Manual Deploy
See [services/monolith/README.md](./services/monolith/README.md) for detailed deployment instructions.

## Monitoring

- **Cloud Logging**: `gcloud logs tail --service=adl-monolith`
- **Cloud Monitoring**: Service health and metrics dashboard
- **Error Reporting**: Automatic error tracking

## Cost Estimation

Based on typical usage patterns:
- Cloud Run: $3-5/month (scales to zero)
- Cloud Storage: <$1/month (state files)
- Cloud Scheduler: Free (first 3 jobs)
- **Total**: ~$5/month

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get started in 15 minutes
- **[services/monolith/README.md](./services/monolith/README.md)** - Service documentation
- **[MONOLITH_MIGRATION_PLAN.md](./MONOLITH_MIGRATION_PLAN.md)** - Migration guide from microservices
- **[docs/](./docs/)** - Additional documentation

## Support

For issues or questions:
1. Check the [QUICKSTART.md](./QUICKSTART.md) troubleshooting section
2. Review [services/monolith/README.md](./services/monolith/README.md)
3. Check Cloud Logs: `gcloud logs tail --service=adl-monolith`
