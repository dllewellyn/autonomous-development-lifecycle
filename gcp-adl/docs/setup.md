# GCP ADL Setup Guide

This guide walks you through setting up the Google Cloud Platform version of the Autonomous Development Lifecycle.

## Prerequisites

1. **Google Cloud Project**
   - Create a new GCP project or use an existing one
   - Enable billing for the project

2. **Required APIs**
   Enable the following APIs in your GCP project:
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable storage.googleapis.com
   gcloud services enable pubsub.googleapis.com
   gcloud services enable cloudscheduler.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```

3. **Tools**
   - Install [gcloud CLI](https://cloud.google.com/sdk/docs/install)
   - Install [Docker](https://docs.docker.com/get-docker/)
   - Install [Terraform](https://www.terraform.io/downloads) (optional, for infrastructure as code)

4. **API Keys**
   - Gemini API Key from [Google AI Studio](https://ai.google.dev/)
   - Jules API Key from [jules.google.com](https://jules.google.com)
   - GitHub Personal Access Token with repo and workflow permissions

## Step 1: Configure gcloud

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Configure Docker for Google Container Registry
gcloud auth configure-docker
```

## Step 2: Create Cloud Storage Bucket

```bash
# Create a bucket for state management
gsutil mb -p YOUR_PROJECT_ID -l us-central1 gs://adl-state-YOUR_PROJECT_ID

# Make it private
gsutil iam ch allUsers:objectViewer gs://adl-state-YOUR_PROJECT_ID
```

## Step 3: Create Pub/Sub Topics

```bash
# Create topics for inter-service communication
gcloud pubsub topics create adl-planner-trigger
gcloud pubsub topics create adl-troubleshooter-trigger

# Create subscriptions (Cloud Run will use push subscriptions)
# These will be created automatically when services are deployed
```

## Step 4: Set Up Secrets

Store sensitive configuration in Google Secret Manager:

```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create secrets
echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key --data-file=-
echo -n "your-jules-api-key" | gcloud secrets create jules-api-key --data-file=-
echo -n "your-github-token" | gcloud secrets create github-token --data-file=-

# Grant access to Cloud Run service account
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding jules-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding github-token \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 5: Build and Deploy Services

Navigate to the deployment scripts directory:

```bash
cd gcp-adl/infrastructure/scripts
```

Build Docker images:

```bash
./build-all.sh
```

Deploy all services:

```bash
./deploy-all.sh
```

Or deploy services individually:

```bash
# Deploy Heartbeat
gcloud run deploy adl-heartbeat \
  --image gcr.io/YOUR_PROJECT_ID/adl-heartbeat \
  --platform managed \
  --region us-central1 \
  --no-allow-unauthenticated \
  --set-env-vars="STATE_BUCKET=adl-state-YOUR_PROJECT_ID,GITHUB_REPOSITORY=owner/repo,PUBSUB_PROJECT_ID=YOUR_PROJECT_ID" \
  --set-secrets="JULES_API_KEY=jules-api-key:latest"

# Repeat for other services...
```

## Step 6: Configure Cloud Scheduler

Create a Cloud Scheduler job to trigger the heartbeat:

```bash
# Get the Heartbeat service URL
HEARTBEAT_URL=$(gcloud run services describe adl-heartbeat --region us-central1 --format="value(status.url)")

# Create scheduler job (runs every 5 minutes)
gcloud scheduler jobs create http adl-heartbeat-cron \
  --schedule="*/5 * * * *" \
  --uri="${HEARTBEAT_URL}/run" \
  --http-method=POST \
  --oidc-service-account-email="${SERVICE_ACCOUNT}" \
  --location=us-central1
```

## Step 7: Configure Pub/Sub Push Subscriptions

```bash
# Get service URLs
PLANNER_URL=$(gcloud run services describe adl-planner --region us-central1 --format="value(status.url)")
TROUBLESHOOTER_URL=$(gcloud run services describe adl-troubleshooter --region us-central1 --format="value(status.url)")

# Create push subscriptions
gcloud pubsub subscriptions create adl-planner-sub \
  --topic=adl-planner-trigger \
  --push-endpoint="${PLANNER_URL}/trigger" \
  --push-auth-service-account="${SERVICE_ACCOUNT}"

gcloud pubsub subscriptions create adl-troubleshooter-sub \
  --topic=adl-troubleshooter-trigger \
  --push-endpoint="${TROUBLESHOOTER_URL}/trigger" \
  --push-auth-service-account="${SERVICE_ACCOUNT}"
```

## Step 8: Set Up GitHub Webhooks

1. Go to your GitHub repository settings
2. Navigate to Webhooks → Add webhook
3. Configure the Enforcer webhook:
   - Payload URL: `https://YOUR-ENFORCER-URL/webhook`
   - Content type: `application/json`
   - Secret: (optional, configure in service env vars)
   - Events: Select "Pull requests"

4. Configure the Strategist webhook:
   - Payload URL: `https://YOUR-STRATEGIST-URL/webhook`
   - Content type: `application/json`
   - Events: Select "Pushes"
   - Branch filter: `refs/heads/main` (or your default branch)

## Step 9: Initialize State

Create the initial state file:

```bash
# Create initial state
cat > /tmp/ralph-state.json << EOF
{
  "status": "started",
  "current_task_id": null,
  "last_updated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "iteration_count": 0,
  "max_iterations": 10
}
EOF

# Upload to Cloud Storage
gsutil cp /tmp/ralph-state.json gs://adl-state-YOUR_PROJECT_ID/.ralph-state.json
```

## Step 10: Test the System

1. **Test Heartbeat**:
   ```bash
   HEARTBEAT_URL=$(gcloud run services describe adl-heartbeat --region us-central1 --format="value(status.url)")
   curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
        -X POST "${HEARTBEAT_URL}/run"
   ```

2. **Check Logs**:
   ```bash
   gcloud logs read --service=adl-heartbeat --limit=50
   ```

3. **Monitor Services**:
   Visit the Cloud Console to monitor your services:
   - Cloud Run: https://console.cloud.google.com/run
   - Cloud Scheduler: https://console.cloud.google.com/cloudscheduler
   - Pub/Sub: https://console.cloud.google.com/cloudpubsub

## Troubleshooting

### Service won't start
- Check environment variables are set correctly
- Verify secrets are accessible
- Review logs: `gcloud logs read --service=SERVICE_NAME --limit=100`

### Heartbeat not triggering
- Verify Cloud Scheduler job is enabled
- Check IAM permissions for the service account
- Test manually: `gcloud scheduler jobs run adl-heartbeat-cron`

### Webhooks not working
- Verify webhook URLs are correct
- Check service allows unauthenticated requests (or configure webhook authentication)
- Review service logs for webhook events

## Next Steps

- Monitor the system for a few iterations
- Adjust Cloud Scheduler frequency if needed
- Review and refine your CONSTITUTION.md
- Add custom monitoring and alerting

## Cost Optimization

To minimize costs:
- Use Cloud Run's "Minimum instances: 0" (cold starts acceptable)
- Use Cloud Scheduler's free tier (3 jobs per month)
- Monitor and set billing alerts
- Use Cloud Monitoring to track usage
