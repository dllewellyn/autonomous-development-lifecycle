#!/bin/bash
set -e

# Build script for all GCP ADL services
# This script builds Docker images for all services

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${GCP_REGION:-us-central1}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID not set and no default project configured"
  exit 1
fi

echo "Building images for project: $PROJECT_ID"
echo "Region: $REGION"

# Navigate to gcp-adl directory
cd "$(dirname "$0")/../.."

SERVICES=("heartbeat" "planner" "troubleshooter" "enforcer" "strategist")

for service in "${SERVICES[@]}"; do
  echo ""
  echo "======================================"
  echo "Building $service..."
  echo "======================================"
  
  IMAGE_NAME="gcr.io/${PROJECT_ID}/adl-${service}"
  
  docker build \
    -t "$IMAGE_NAME" \
    -f "services/${service}/Dockerfile" \
    .
  
  echo "Pushing $IMAGE_NAME to GCR..."
  docker push "$IMAGE_NAME"
  
  echo "✓ $service built and pushed successfully"
done

echo ""
echo "======================================"
echo "All services built successfully!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Run ./deploy-all.sh to deploy services"
echo "2. Follow setup.md to configure Cloud Scheduler and webhooks"
