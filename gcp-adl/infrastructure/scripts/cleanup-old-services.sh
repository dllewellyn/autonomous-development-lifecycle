#!/bin/bash
set -e

# Cleanup script for old services
# Usage: ./cleanup-old-services.sh

echo "========================================"
echo "Cleaning Up Old Services"
echo "========================================"

# Check required environment variables
if [ -z "$GCP_PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID environment variable is required"
  exit 1
fi

REGION="${GCP_REGION:-us-central1}"

echo ""
echo "Configuration:"
echo "  Project ID: $GCP_PROJECT_ID"
echo "  Region: $REGION"
echo ""

read -p "Are you sure you want to delete old services and Pub/Sub resources? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Cleanup cancelled"
  exit 0
fi

echo ""
echo "Deleting old Cloud Run services..."

services=("heartbeat" "planner" "troubleshooter" "enforcer" "strategist")
for service in "${services[@]}"; do
  if gcloud run services describe "$service" --region "$REGION" --project "$GCP_PROJECT_ID" &>/dev/null; then
    echo "  - Deleting service: $service"
    gcloud run services delete "$service" \
      --region "$REGION" \
      --project "$GCP_PROJECT_ID" \
      --quiet
  else
    echo "  - Service not found (already deleted?): $service"
  fi
done

echo ""
echo "Deleting Pub/Sub subscriptions..."
subscriptions=("adl-planner-subscription" "adl-troubleshooter-subscription")
for subscription in "${subscriptions[@]}"; do
  if gcloud pubsub subscriptions describe "$subscription" --project "$GCP_PROJECT_ID" &>/dev/null; then
    echo "  - Deleting subscription: $subscription"
    gcloud pubsub subscriptions delete "$subscription" \
      --project "$GCP_PROJECT_ID" \
      --quiet
  else
    echo "  - Subscription not found (already deleted?): $subscription"
  fi
done

echo ""
echo "Deleting Pub/Sub topics..."
topics=("adl-planner-trigger" "adl-troubleshooter-trigger")
for topic in "${topics[@]}"; do
  if gcloud pubsub topics describe "$topic" --project "$GCP_PROJECT_ID" &>/dev/null; then
    echo "  - Deleting topic: $topic"
    gcloud pubsub topics delete "$topic" \
      --project "$GCP_PROJECT_ID" \
      --quiet
  else
    echo "  - Topic not found (already deleted?): $topic"
  fi
done

echo ""
echo "========================================"
echo "Cleanup complete!"
echo "========================================"
echo ""
echo "Old services and Pub/Sub resources have been removed."
echo ""
echo "Note: This script does NOT delete:"
echo "  - Cloud Storage bucket (contains state)"
echo "  - Secret Manager secrets (may be reused)"
echo "  - Cloud Scheduler job (needs to be updated to point to monolith)"
echo ""
echo "To update Cloud Scheduler:"
echo "  SERVICE_URL=\$(gcloud run services describe adl-monolith --region $REGION --format 'value(status.url)')"
echo "  gcloud scheduler jobs update http adl-heartbeat \\"
echo "    --location $REGION \\"
echo "    --uri \"\${SERVICE_URL}/heartbeat\""
echo ""
