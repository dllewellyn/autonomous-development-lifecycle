# ADL Monolith Service

Single unified Cloud Run service for the Autonomous Development Lifecycle system.

## Architecture

This service consolidates 5 separate services into one Probot-based GitHub App:

- **Heartbeat**: Orchestrator (Cloud Scheduler trigger)
- **Planner**: Task creator (internal function)
- **Troubleshooter**: Question answerer (internal function)
- **Enforcer**: PR reviewer (GitHub webhook)
- **Strategist**: Learning system (GitHub webhook)

## Features

- ✅ Single Cloud Run service
- ✅ Probot framework for GitHub webhooks
- ✅ Internal function calls (no Pub/Sub)
- ✅ Native GitHub API integration
- ✅ Structured logging
- ✅ TypeScript with strict mode

## Prerequisites

- Node.js 20+
- Docker
- GCP project with billing enabled
- GitHub App created

## Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# GitHub App (Probot)
APP_ID=your-github-app-id
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
WEBHOOK_SECRET=your-webhook-secret
WEBHOOK_PROXY_URL=https://smee.io/your-channel  # For local development

# Application
GITHUB_REPOSITORY=owner/repo
GITHUB_BRANCH=main

# External APIs
GEMINI_API_KEY=your-gemini-api-key
JULES_API_KEY=your-jules-api-key

# GCP
STATE_BUCKET=your-state-bucket

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Build shared libraries:
```bash
cd ../../shared/state && npm install && npm run build
cd ../jules && npm install && npm run build
cd ../gemini && npm install && npm run build
cd ../github && npm install && npm run build
cd ../../services/monolith
```

3. Set up environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Run locally:
```bash
npm run dev
```

5. Use smee.io for webhook forwarding:
```bash
# Install smee-client
npm install -g smee-client

# Forward webhooks
smee --url https://smee.io/your-channel --target http://localhost:3000
```

## Building

```bash
# Build TypeScript
npm run build

# Build Docker image
docker build -t adl-monolith:latest -f Dockerfile ../..
```

## Deployment

1. Set environment variables:
```bash
export GCP_PROJECT_ID=your-project-id
export GITHUB_REPOSITORY=owner/repo
export GCP_REGION=us-central1  # optional, defaults to us-central1
```

2. Build and push:
```bash
cd ../../infrastructure/scripts
./build-monolith.sh
```

3. Deploy to Cloud Run:
```bash
./deploy-monolith.sh
```

4. Update Cloud Scheduler:
```bash
SERVICE_URL=$(gcloud run services describe adl-monolith --region us-central1 --format 'value(status.url)')
gcloud scheduler jobs update http adl-heartbeat \
  --location us-central1 \
  --schedule "*/5 * * * *" \
  --uri "${SERVICE_URL}/heartbeat" \
  --http-method POST
```

5. Update GitHub App webhook URL to `${SERVICE_URL}`

## Endpoints

### Health Check
```bash
GET /health
```

### Heartbeat (Cloud Scheduler)
```bash
POST /heartbeat
```

### Manual Planner Trigger (Testing)
```bash
POST /trigger/planner
```

### GitHub Webhooks (Probot)
```bash
POST /  # All GitHub events
```

## Testing

### Test Health
```bash
curl https://your-service-url/health
```

### Test Heartbeat
```bash
curl -X POST https://your-service-url/heartbeat
```

### Test Planner
```bash
curl -X POST https://your-service-url/trigger/planner
```

### Test Enforcer
1. Create a PR in your repository
2. Check Cloud Logs for processing

### Test Strategist
1. Merge a PR to main
2. Check Cloud Logs for processing
3. Verify AGENTS.md and TASKS.md are updated

## Monitoring

### View Logs
```bash
gcloud logs read --service=adl-monolith --limit=50
```

### Stream Logs
```bash
gcloud logs tail --service=adl-monolith
```

### View Metrics
```bash
gcloud monitoring dashboards list
```

## Troubleshooting

### Service won't start
- Check environment variables are set correctly
- Verify secrets exist in Secret Manager
- Check Docker image builds successfully

### Webhooks not received
- Verify GitHub App webhook URL is correct
- Check webhook secret matches
- Ensure service is deployed and healthy

### Heartbeat not triggering
- Verify Cloud Scheduler job is configured
- Check scheduler job logs
- Ensure service URL is correct

### PR reviews failing
- Check Gemini API key is valid
- Verify CONSTITUTION.md exists in repo
- Check service logs for errors

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

GitHub Webhooks
    │
    ├─→ pull_request.* → Enforcer Handler
    │       │
    │       ▼
    │   Review PR → Approve/Reject
    │
    └─→ push (main) → Strategist Handler
            │
            ▼
        Update AGENTS.md/TASKS.md → runPlanner() [internal]
```

## Cost Estimate

- **Cloud Run**: $3-5/month (scales to zero)
- **Cloud Storage**: <$1/month
- **Cloud Scheduler**: Free (first 3 jobs)
- **Total**: ~$5/month

Compare to 5 services: ~$15/month (70% savings)

## Migration from 5 Services

See [MONOLITH_MIGRATION_PLAN.md](../../MONOLITH_MIGRATION_PLAN.md) for detailed migration guide.

## License

MIT
