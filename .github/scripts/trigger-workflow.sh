#!/bin/bash
set -euo pipefail

# Required environment variables:
# WORKFLOW_ID
# REF
# REPO_OWNER
# REPO_NAME

echo "Triggering workflow: $WORKFLOW_ID on ref: $REF"
gh workflow run "$WORKFLOW_ID" --ref "$REF" --repo "$REPO_OWNER/$REPO_NAME"
