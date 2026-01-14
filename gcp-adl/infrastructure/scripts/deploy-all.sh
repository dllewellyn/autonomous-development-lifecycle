#!/bin/bash
set -e

# Deploy script for all GCP ADL services

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${GCP_REGION:-us-central1}"
STATE_BUCKET="${STATE_BUCKET:-adl-state-${PROJECT_ID}}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID not set and no default project configured"
  exit 1
fi

if [ -z "$GITHUB_REPOSITORY" ]; then
  echo "Error: GITHUB_REPOSITORY environment variable is required (format: owner/repo)"
  exit 1
fi

echo "Deploying services to project: $PROJECT_ID"
echo "Region: $REGION"
echo "State bucket: $STATE_BUCKET"
echo "GitHub repository: $GITHUB_REPOSITORY"

# Common environment variables
COMMON_ENV="STATE_BUCKET=${STATE_BUCKET},GITHUB_REPOSITORY=${GITHUB_REPOSITORY},GITHUB_BRANCH=${GITHUB_BRANCH},PUBSUB_PROJECT_ID=${PROJECT_ID}"
COMMON_SECRETS="JULES_API_KEY=jules-api-key:latest,GEMINI_API_KEY=gemini-api-key:latest,GITHUB_TOKEN=github-token:latest"

# Deploy Heartbeat
echo ""
echo "Deploying Heartbeat..."
gcloud run deploy adl-heartbeat \
  --image "gcr.io/${PROJECT_ID}/adl-heartbeat" \
  --platform managed \
  --region "$REGION" \
  --no-allow-unauthenticated \
  --set-env-vars="$COMMON_ENV" \
  --set-secrets="$COMMON_SECRETS" \
  --memory 512Mi \
  --timeout 300

# Deploy Planner
echo ""
echo "Deploying Planner..."
gcloud run deploy adl-planner \
  --image "gcr.io/${PROJECT_ID}/adl-planner" \
  --platform managed \
  --region "$REGION" \
  --no-allow-unauthenticated \
  --set-env-vars="$COMMON_ENV" \
  --set-secrets="$COMMON_SECRETS" \
  --memory 512Mi \
  --timeout 900

# Deploy Troubleshooter
echo ""
echo "Deploying Troubleshooter..."
gcloud run deploy adl-troubleshooter \
  --image "gcr.io/${PROJECT_ID}/adl-troubleshooter" \
  --platform managed \
  --region "$REGION" \
  --no-allow-unauthenticated \
  --set-env-vars="$COMMON_ENV" \
  --set-secrets="$COMMON_SECRETS" \
  --memory 512Mi \
  --timeout 600

# Deploy Enforcer (allows unauthenticated for GitHub webhooks)
echo ""
echo "Deploying Enforcer..."
gcloud run deploy adl-enforcer \
  --image "gcr.io/${PROJECT_ID}/adl-enforcer" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars="$COMMON_ENV" \
  --set-secrets="$COMMON_SECRETS" \
  --memory 512Mi \
  --timeout 600

# Deploy Strategist (allows unauthenticated for GitHub webhooks)
echo ""
echo "Deploying Strategist..."
gcloud run deploy adl-strategist \
  --image "gcr.io/${PROJECT_ID}/adl-strategist" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars="$COMMON_ENV" \
  --set-secrets="$COMMON_SECRETS" \
  --memory 512Mi \
  --timeout 600

echo ""
echo "======================================"
echo "All services deployed successfully!"
echo "======================================"
echo ""
echo "Service URLs:"
gcloud run services list --platform managed --region "$REGION" --filter="metadata.name:adl-*" --format="table(metadata.name,status.url)"

echo ""
echo "Next steps:"
echo "1. Configure Cloud Scheduler to trigger heartbeat"
echo "2. Set up Pub/Sub push subscriptions"
echo "3. Configure GitHub webhooks for Enforcer and Strategist"
echo ""
echo "See docs/setup.md for detailed instructions"
