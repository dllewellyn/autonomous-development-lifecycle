# GCP ADL Deployment Guide

This guide provides step-by-step instructions for deploying the GCP ADL system.

## Prerequisites Checklist

Before deploying, ensure you have:

- [ ] Google Cloud Project created with billing enabled
- [ ] gcloud CLI installed and authenticated
- [ ] Docker installed
- [ ] Gemini API key
- [ ] Jules API key  
- [ ] GitHub Personal Access Token (with repo, workflow permissions)
- [ ] GitHub repository with GOALS.md, TASKS.md, CONSTITUTION.md, AGENTS.md, CONTEXT_MAP.md

## Quick Deploy (Automated)

For a quick deployment using our automated scripts:

```bash
# 1. Set environment variables
export GCP_PROJECT_ID="your-project-id"
export GITHUB_REPOSITORY="owner/repo"
export GITHUB_BRANCH="main"

# 2. Run setup script (creates resources)
cd gcp-adl/infrastructure/scripts
./setup-infrastructure.sh

# 3. Build and deploy
./build-all.sh
./deploy-all.sh

# 4. Configure webhooks manually (see below)
```

## Manual Deployment (Step-by-Step)

### Phase 1: Enable APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable storage.googleapis.com  
gcloud services enable pubsub.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### Phase 2: Create Cloud Storage Bucket

```bash
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"

gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://adl-state-${PROJECT_ID}"

# Initialize state file
cat > /tmp/ralph-state.json << EOF
{
  "status": "started",
  "current_task_id": null,
  "last_updated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "iteration_count": 0,
  "max_iterations": 10
}
EOF

gsutil cp /tmp/ralph-state.json "gs://adl-state-${PROJECT_ID}/.ralph-state.json"
```

### Phase 3: Set Up Secrets

```bash
# Create secrets
echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key --data-file=-
echo -n "your-jules-api-key" | gcloud secrets create jules-api-key --data-file=-
echo -n "your-github-token" | gcloud secrets create github-token --data-file=-

# Grant access to default compute service account
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for secret in gemini-api-key jules-api-key github-token; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### Phase 4: Create Pub/Sub Topics

```bash
gcloud pubsub topics create adl-planner-trigger
gcloud pubsub topics create adl-troubleshooter-trigger
```

### Phase 5: Build Docker Images

```bash
cd gcp-adl

# Build all services
for service in heartbeat planner troubleshooter enforcer strategist; do
  docker build -t "gcr.io/${PROJECT_ID}/adl-${service}" -f "services/${service}/Dockerfile" .
  docker push "gcr.io/${PROJECT_ID}/adl-${service}"
done
```

### Phase 6: Deploy Services

Set common variables:

```bash
STATE_BUCKET="adl-state-${PROJECT_ID}"
GITHUB_REPOSITORY="owner/repo"
GITHUB_BRANCH="main"

COMMON_ENV="STATE_BUCKET=${STATE_BUCKET},GITHUB_REPOSITORY=${GITHUB_REPOSITORY},GITHUB_BRANCH=${GITHUB_BRANCH},PUBSUB_PROJECT_ID=${PROJECT_ID}"
COMMON_SECRETS="JULES_API_KEY=jules-api-key:latest,GEMINI_API_KEY=gemini-api-key:latest,GITHUB_TOKEN=github-token:latest"
```

Deploy each service:

```bash
# Heartbeat
gcloud run deploy adl-heartbeat \
  --image "gcr.io/${PROJECT_ID}/adl-heartbeat" \
  --platform managed \
  --region "$REGION" \
  --no-allow-unauthenticated \
  --set-env-vars="$COMMON_ENV" \
  --set-secrets="$COMMON_SECRETS" \
  --memory 512Mi \
  --timeout 300

# Planner
gcloud run deploy adl-planner \
  --image "gcr.io/${PROJECT_ID}/adl-planner" \
  --platform managed \
  --region "$REGION" \
  --no-allow-unauthenticated \
  --set-env-vars="$COMMON_ENV" \
  --set-secrets="$COMMON_SECRETS" \
  --memory 512Mi \
  --timeout 900

# Troubleshooter
gcloud run deploy adl-troubleshooter \
  --image "gcr.io/${PROJECT_ID}/adl-troubleshooter" \
  --platform managed \
  --region "$REGION" \
  --no-allow-unauthenticated \
  --set-env-vars="$COMMON_ENV" \
  --set-secrets="$COMMON_SECRETS" \
  --memory 512Mi \
  --timeout 600

# Enforcer (public for webhooks)
gcloud run deploy adl-enforcer \
  --image "gcr.io/${PROJECT_ID}/adl-enforcer" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars="$COMMON_ENV" \
  --set-secrets="$COMMON_SECRETS" \
  --memory 512Mi \
  --timeout 600

# Strategist (public for webhooks)
gcloud run deploy adl-strategist \
  --image "gcr.io/${PROJECT_ID}/adl-strategist" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars="$COMMON_ENV" \
  --set-secrets="$COMMON_SECRETS" \
  --memory 512Mi \
  --timeout 600
```

### Phase 7: Configure Cloud Scheduler

```bash
HEARTBEAT_URL=$(gcloud run services describe adl-heartbeat --region "$REGION" --format="value(status.url)")

gcloud scheduler jobs create http adl-heartbeat-cron \
  --schedule="*/5 * * * *" \
  --uri="${HEARTBEAT_URL}/run" \
  --http-method=POST \
  --oidc-service-account-email="${SERVICE_ACCOUNT}" \
  --location="$REGION"
```

### Phase 8: Configure Pub/Sub Subscriptions

```bash
PLANNER_URL=$(gcloud run services describe adl-planner --region "$REGION" --format="value(status.url)")
TROUBLESHOOTER_URL=$(gcloud run services describe adl-troubleshooter --region "$REGION" --format="value(status.url)")

gcloud pubsub subscriptions create adl-planner-sub \
  --topic=adl-planner-trigger \
  --push-endpoint="${PLANNER_URL}/trigger" \
  --push-auth-service-account="${SERVICE_ACCOUNT}"

gcloud pubsub subscriptions create adl-troubleshooter-sub \
  --topic=adl-troubleshooter-trigger \
  --push-endpoint="${TROUBLESHOOTER_URL}/trigger" \
  --push-auth-service-account="${SERVICE_ACCOUNT}"
```

### Phase 9: Configure GitHub Webhooks

Get webhook URLs:

```bash
ENFORCER_URL=$(gcloud run services describe adl-enforcer --region "$REGION" --format="value(status.url)")
STRATEGIST_URL=$(gcloud run services describe adl-strategist --region "$REGION" --format="value(status.url)")

echo "Enforcer webhook URL: ${ENFORCER_URL}/webhook"
echo "Strategist webhook URL: ${STRATEGIST_URL}/webhook"
```

Configure in GitHub:

1. **Enforcer Webhook**:
   - Go to: `https://github.com/OWNER/REPO/settings/hooks/new`
   - Payload URL: `${ENFORCER_URL}/webhook`
   - Content type: `application/json`
   - Events: Select "Pull requests"
   - Active: ✓

2. **Strategist Webhook**:
   - Payload URL: `${STRATEGIST_URL}/webhook`
   - Content type: `application/json`
   - Events: Select "Pushes"
   - Active: ✓
   - **Note**: When triggered by push to main, Strategist updates AGENTS.md/TASKS.md and triggers Planner via Pub/Sub to start the next cycle

## Verification

### Test Heartbeat

```bash
# Manual trigger
gcloud scheduler jobs run adl-heartbeat-cron --location="$REGION"

# Check logs
gcloud logs read --service=adl-heartbeat --limit=50 --format=json
```

### Test Planner

```bash
# Trigger via Pub/Sub
gcloud pubsub topics publish adl-planner-trigger --message='{"trigger":"manual"}'

# Check logs
gcloud logs read --service=adl-planner --limit=50
```

### Test Enforcer

Create a test PR in your repository and verify:
1. Webhook is triggered
2. PR is reviewed
3. Comment is posted (if violations) or PR is merged (if compliant)

### Test Strategist

Merge a PR and verify:
1. Webhook is triggered
2. AGENTS.md and TASKS.md are updated
3. Planner is triggered

## Monitoring

### View Logs

```bash
# All services
gcloud logs read --limit=100 --format=json

# Specific service
gcloud logs read --service=adl-heartbeat --limit=50

# Follow logs
gcloud logs tail --service=adl-heartbeat
```

### View Metrics

```bash
# Service list with status
gcloud run services list --platform managed --region "$REGION"

# Detailed service info
gcloud run services describe adl-heartbeat --region "$REGION"
```

### Cloud Console

Visit these URLs:
- Services: https://console.cloud.google.com/run
- Logs: https://console.cloud.google.com/logs
- Scheduler: https://console.cloud.google.com/cloudscheduler
- Pub/Sub: https://console.cloud.google.com/cloudpubsub

## Updating Services

To update a service after code changes:

```bash
# 1. Rebuild image
docker build -t "gcr.io/${PROJECT_ID}/adl-heartbeat" -f services/heartbeat/Dockerfile .
docker push "gcr.io/${PROJECT_ID}/adl-heartbeat"

# 2. Deploy new version
gcloud run services update adl-heartbeat --region "$REGION"

# Or use automated script
./build-all.sh
./deploy-all.sh
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
gcloud logs read --service=SERVICE_NAME --limit=100

# Common issues:
# - Missing environment variables
# - Secret access denied
# - Invalid GitHub repository format
```

### Scheduler Not Running

```bash
# Check job status
gcloud scheduler jobs describe adl-heartbeat-cron --location="$REGION"

# Manual trigger
gcloud scheduler jobs run adl-heartbeat-cron --location="$REGION"

# Check IAM permissions
gcloud projects get-iam-policy "$PROJECT_ID" \
  --flatten="bindings[].members" \
  --filter="bindings.members:${SERVICE_ACCOUNT}"
```

### Webhooks Not Working

```bash
# Check service logs
gcloud logs read --service=adl-enforcer --limit=50

# Test webhook manually
curl -X POST "${ENFORCER_URL}/webhook" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{"action":"opened","pull_request":{"number":1}}'
```

### State File Issues

```bash
# View state
gsutil cat "gs://adl-state-${PROJECT_ID}/.ralph-state.json"

# Reset state
cat > /tmp/reset-state.json << EOF
{
  "status": "started",
  "current_task_id": null,
  "last_updated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "iteration_count": 0,
  "max_iterations": 10
}
EOF

gsutil cp /tmp/reset-state.json "gs://adl-state-${PROJECT_ID}/.ralph-state.json"
```

## Cleanup

To remove all resources:

```bash
# Delete services
for service in heartbeat planner troubleshooter enforcer strategist; do
  gcloud run services delete "adl-${service}" --region "$REGION" --quiet
done

# Delete scheduler job
gcloud scheduler jobs delete adl-heartbeat-cron --location="$REGION" --quiet

# Delete Pub/Sub resources
gcloud pubsub subscriptions delete adl-planner-sub --quiet
gcloud pubsub subscriptions delete adl-troubleshooter-sub --quiet
gcloud pubsub topics delete adl-planner-trigger --quiet
gcloud pubsub topics delete adl-troubleshooter-trigger --quiet

# Delete secrets
for secret in gemini-api-key jules-api-key github-token; do
  gcloud secrets delete "$secret" --quiet
done

# Delete storage bucket
gsutil -m rm -r "gs://adl-state-${PROJECT_ID}"
```

## Best Practices

1. **Use separate projects**: Deploy to dev/staging/prod projects
2. **Monitor costs**: Set up billing alerts
3. **Version images**: Tag Docker images with versions
4. **Backup state**: Regularly backup the state file
5. **Test locally**: Use Cloud Run emulator for local testing
6. **Log retention**: Configure appropriate log retention
7. **Alerts**: Set up alerts for critical failures

## Next Steps

After deployment:
1. Monitor the first few iterations
2. Adjust Cloud Scheduler frequency if needed
3. Refine CONSTITUTION.md based on observed behavior
4. Review AGENTS.md for lessons learned
5. Consider adding custom monitoring dashboards
