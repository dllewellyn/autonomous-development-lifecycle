# Quick Start Guide: ADL Monolith

Get the ADL Monolith service running in 15 minutes.

## Prerequisites

- [x] GCP account with billing enabled
- [x] GitHub repository for ADL
- [x] Node.js 20+ installed
- [x] Docker installed
- [x] gcloud CLI configured

## Step 1: Create GitHub App (5 min)

1. Go to GitHub Settings → Developer settings → GitHub Apps → New GitHub App

2. Configure the app:
   - **Name**: `adl-bot-your-org` (must be unique)
   - **Homepage URL**: `https://github.com/your-org/your-repo`
   - **Webhook URL**: `https://temporary-url.com` (will update later)
   - **Webhook secret**: Generate a random secret (save it!)

3. Set permissions:
   - Repository contents: **Read & Write**
   - Pull requests: **Read & Write**
   - Issues: **Read & Write**

4. Subscribe to events:
   - [x] Pull request
   - [x] Push

5. Click "Create GitHub App"

6. Generate private key:
   - Click "Generate a private key"
   - Save the `.pem` file

7. Install the app:
   - Click "Install App"
   - Select your repository
   - Click "Install"

8. Note your **App ID** (shown at top of settings page)

## Step 2: Setup GCP Secrets (5 min)

```bash
# Set your GCP project
export GCP_PROJECT_ID=your-project-id
gcloud config set project $GCP_PROJECT_ID

# Create secrets
echo "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
echo "YOUR_JULES_API_KEY" | gcloud secrets create jules-api-key --data-file=-
echo "YOUR_GITHUB_APP_ID" | gcloud secrets create github-app-id --data-file=-
echo "YOUR_WEBHOOK_SECRET" | gcloud secrets create github-webhook-secret --data-file=-
echo "your-state-bucket-name" | gcloud secrets create state-bucket-name --data-file=-

# Create secret for private key
gcloud secrets create github-app-private-key --data-file=/path/to/your-app.pem
```

## Step 3: Create Cloud Storage Bucket (1 min)

```bash
# Create bucket for state
gsutil mb gs://your-state-bucket-name

# Initialize state
echo '{
  "status": "stopped",
  "current_task_id": null,
  "last_updated": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "iteration_count": 0,
  "max_iterations": 10
}' | gsutil cp - gs://your-state-bucket-name/.ralph-state.json
```

## Step 4: Build and Deploy (5 min)

```bash
# Navigate to gcp-adl directory
cd /path/to/autonomous-development-lifecycle/gcp-adl

# Set environment variables
export GCP_PROJECT_ID=your-project-id
export GITHUB_REPOSITORY=owner/repo
export GCP_REGION=us-central1  # optional

# Build
./infrastructure/scripts/build-monolith.sh

# Deploy
./infrastructure/scripts/deploy-monolith.sh
```

## Step 5: Update GitHub App Webhook (1 min)

1. Get your service URL:
```bash
gcloud run services describe adl-monolith \
  --region us-central1 \
  --format 'value(status.url)'
```

2. Go to your GitHub App settings
3. Update **Webhook URL** to your service URL
4. Save changes

## Step 6: Create Cloud Scheduler Job (1 min)

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe adl-monolith \
  --region us-central1 \
  --format 'value(status.url)')

# Create scheduler job
gcloud scheduler jobs create http adl-heartbeat \
  --location us-central1 \
  --schedule "*/5 * * * *" \
  --uri "${SERVICE_URL}/heartbeat" \
  --http-method POST \
  --oidc-service-account-email $(gcloud config get-value account)
```

## Step 7: Test It! (2 min)

### Test Health
```bash
SERVICE_URL=$(gcloud run services describe adl-monolith --region us-central1 --format 'value(status.url)')
curl ${SERVICE_URL}/health
```

Expected: `{"status":"healthy","service":"adl-monolith","timestamp":"..."}`

### Test Heartbeat
```bash
curl -X POST ${SERVICE_URL}/heartbeat
```

Expected: `{"success":true,"result":{...}}`

### Test Enforcer
1. Create a test PR in your repository
2. Watch the logs:
```bash
gcloud logs tail --service=adl-monolith
```
3. The PR should be reviewed automatically

### Test Strategist
1. Merge a PR to main
2. Watch the logs
3. Check that AGENTS.md and TASKS.md are updated

## Verification Checklist

- [ ] Service deployed and healthy (`/health` returns 200)
- [ ] Heartbeat endpoint works (`/heartbeat` returns success)
- [ ] Cloud Scheduler job created and enabled
- [ ] GitHub App webhook configured with service URL
- [ ] GitHub App installed on repository
- [ ] Test PR created and reviewed automatically
- [ ] Test merge updates AGENTS.md/TASKS.md
- [ ] Logs visible in Cloud Logging

## Troubleshooting

### Service won't deploy
```bash
# Check if secrets exist
gcloud secrets list

# Check if bucket exists
gsutil ls gs://your-state-bucket-name

# View deployment logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=adl-monolith" --limit 50
```

### Webhooks not working
```bash
# Test webhook delivery in GitHub App settings
# Check "Recent Deliveries" tab

# View service logs
gcloud logs tail --service=adl-monolith

# Verify webhook secret matches
gcloud secrets versions access latest --secret=github-webhook-secret
```

### Heartbeat not triggering
```bash
# Check scheduler job status
gcloud scheduler jobs describe adl-heartbeat --location=us-central1

# Manually trigger
gcloud scheduler jobs run adl-heartbeat --location=us-central1

# View scheduler logs
gcloud logging read "resource.type=cloud_scheduler_job" --limit 10
```

## Next Steps

1. **Update Repository Files**:
   - Create/update `CONSTITUTION.md`
   - Create/update `GOALS.md`
   - Create/update `TASKS.md`
   - Create/update `AGENTS.md`
   - Create/update `CONTEXT_MAP.md`

2. **Enable the System**:
```bash
# Update state to "started"
echo '{
  "status": "started",
  "current_task_id": null,
  "last_updated": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "iteration_count": 0,
  "max_iterations": 10
}' | gsutil cp - gs://your-state-bucket-name/.ralph-state.json
```

3. **Monitor**:
```bash
# Watch logs
gcloud logs tail --service=adl-monolith --format=json

# Check Cloud Monitoring dashboard
gcloud monitoring dashboards list
```

4. **Cleanup Old Services** (if migrating):
```bash
./infrastructure/scripts/cleanup-old-services.sh
```

## Support

- **Documentation**: [services/monolith/README.md](../services/monolith/README.md)
- **Migration Guide**: [MONOLITH_MIGRATION_PLAN.md](../MONOLITH_MIGRATION_PLAN.md)
- **Architecture**: [README.md](../README.md)

## Estimated Costs

- Cloud Run: $3-5/month
- Cloud Storage: <$1/month
- Cloud Scheduler: Free
- **Total: ~$5/month**

---

**Time to complete**: ~15 minutes  
**Difficulty**: Intermediate  
**Prerequisites**: GCP account, GitHub repository
