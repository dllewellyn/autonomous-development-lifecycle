#!/bin/bash
set -e

# Deploy script for monolith service
# Usage: ./deploy-monolith.sh

echo "========================================"
echo "Deploying ADL Monolith Service"
echo "========================================"

# Check required environment variables
if [ -z "$GCP_PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID environment variable is required"
  exit 1
fi

if [ -z "$GITHUB_REPOSITORY" ]; then
  echo "Error: GITHUB_REPOSITORY environment variable is required (format: owner/repo)"
  exit 1
fi

REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="adl-monolith"
IMAGE_NAME="gcr.io/${GCP_PROJECT_ID}/${SERVICE_NAME}:latest"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

echo ""
echo "Configuration:"
echo "  Project ID: $GCP_PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"
echo "  Image: $IMAGE_NAME"
echo "  GitHub Repository: $GITHUB_REPOSITORY"
echo "  GitHub Branch: $GITHUB_BRANCH"
echo ""

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "GITHUB_REPOSITORY=${GITHUB_REPOSITORY},GITHUB_BRANCH=${GITHUB_BRANCH},NODE_ENV=production" \
  --update-secrets="APP_ID=github-app-id:latest,PRIVATE_KEY=github-app-private-key:latest,WEBHOOK_SECRET=github-webhook-secret:latest,GEMINI_API_KEY=gemini-api-key:latest,JULES_API_KEY=jules-api-key:latest,STATE_BUCKET=state-bucket-name:latest" \
  --project "$GCP_PROJECT_ID"

# Get service URL
echo ""
echo "Getting service URL..."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --platform managed \
  --region "$REGION" \
  --format 'value(status.url)' \
  --project "$GCP_PROJECT_ID")

echo ""
echo "========================================"
echo "Deployment complete!"
echo "========================================"
echo ""
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Next steps:"
echo "1. Update Cloud Scheduler job:"
echo "   gcloud scheduler jobs update http adl-heartbeat \\"
echo "     --location ${REGION} \\"
echo "     --schedule '*/5 * * * *' \\"
echo "     --uri '${SERVICE_URL}/heartbeat' \\"
echo "     --http-method POST"
echo ""
echo "2. Update GitHub App webhook URL:"
echo "   - Go to your GitHub App settings"
echo "   - Set Webhook URL to: ${SERVICE_URL}"
echo "   - Ensure webhook secret matches WEBHOOK_SECRET in Secret Manager"
echo ""
echo "3. Verify GitHub App permissions:"
echo "   - Repository contents: Read & Write"
echo "   - Pull requests: Read & Write"
echo "   - Issues: Read & Write"
echo ""
echo "4. Test endpoints:"
echo "   curl ${SERVICE_URL}/health"
echo "   curl -X POST ${SERVICE_URL}/heartbeat"
echo ""
echo "5. View logs:"
echo "   gcloud logs read --service=${SERVICE_NAME} --limit=50"
echo ""
