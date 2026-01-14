#!/bin/bash
set -euo pipefail

# Required environment variables:
# GITHUB_TOKEN
# REPO_OWNER
# REPO_NAME
# PR_NUMBER

# Check if PR is a draft and mark as ready if needed
IS_DRAFT=$(gh pr view "$PR_NUMBER" --json isDraft --jq '.isDraft' --repo "$REPO_OWNER/$REPO_NAME")

if [ "$IS_DRAFT" == "true" ]; then
  echo "PR is in draft status. Marking as ready for review..."
  gh pr ready "$PR_NUMBER" --repo "$REPO_OWNER/$REPO_NAME"
  echo "PR marked as ready for review."
fi

# Approve the PR
echo "Approving PR..."
if gh pr review "$PR_NUMBER" --approve --body "✅ All constitution rules satisfied. Auto-approving." --repo "$REPO_OWNER/$REPO_NAME"; then
  echo "PR approved."
else
  echo "Failed to approve PR (might be self-approval restriction). Continuing..."
fi

# Merge the PR
echo "Merging PR..."
if gh pr merge "$PR_NUMBER" --squash --auto --repo "$REPO_OWNER/$REPO_NAME"; then
  echo "PR merged successfully (or set to auto-merge)."
else
  echo "Failed to merge PR. It might have conflicts or require other checks."
  exit 1
fi
