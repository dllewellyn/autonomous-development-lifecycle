#!/bin/bash
set -e

# Build script for monolith service
# Usage: ./build-monolith.sh

echo "========================================"
echo "Building ADL Monolith Service"
echo "========================================"

# Check required environment variables
if [ -z "$GCP_PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID environment variable is required"
  echo "Usage: export GCP_PROJECT_ID=your-project-id"
  exit 1
fi

# Navigate to gcp-adl directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/../.."

echo ""
echo "Project ID: $GCP_PROJECT_ID"
echo "Working directory: $(pwd)"
echo ""

# Build shared libraries
echo "Building shared libraries..."
for lib in shared/*; do
  if [ -d "$lib" ]; then
    lib_name=$(basename "$lib")
    echo "  - Building $lib_name..."
    cd "$lib"
    npm install --silent
    npm run build --silent
    cd ../..
  fi
done

echo ""
echo "Building monolith service..."
cd services/monolith
npm install --silent
npm run build

echo ""
echo "Building Docker image..."
cd ../..
IMAGE_NAME="gcr.io/${GCP_PROJECT_ID}/adl-monolith"
IMAGE_TAG="latest"

docker build \
  -f services/monolith/Dockerfile \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" \
  .

echo ""
echo "Pushing Docker image to GCR..."
docker push "${IMAGE_NAME}:${IMAGE_TAG}"

echo ""
echo "========================================"
echo "Build complete!"
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "========================================"
