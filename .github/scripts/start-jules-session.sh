#!/bin/bash
set -e

# Expected environment variables:
# JULES_API_KEY
# GITHUB_REPOSITORY (format: owner/repo)
# GITHUB_REF_NAME (branch name)
# PROMPT (optional, can be passed as argument)

PROMPT="${1:-$PROMPT}"

if [ -z "$JULES_API_KEY" ]; then
  echo "Error: JULES_API_KEY is not set." >&2
  exit 1
fi

if [ -z "$PROMPT" ]; then
  echo "Error: PROMPT is not set or provided." >&2
  exit 1
fi

if [ -z "$GITHUB_REPOSITORY" ]; then
  echo "Error: GITHUB_REPOSITORY is not set." >&2
  exit 1
fi

if [ -z "$GITHUB_REF_NAME" ]; then
  echo "Error: GITHUB_REF_NAME is not set." >&2
  exit 1
fi

# Split GITHUB_REPOSITORY into owner and repo
IFS='/' read -r OWNER REPO <<< "$GITHUB_REPOSITORY"
# The API expects sources/github/OWNER/REPO
SOURCE="sources/github/$OWNER/$REPO"

# JSON Payload
PAYLOAD=$(jq -n \
  --arg prompt "$PROMPT" \
  --arg source "$SOURCE" \
  --arg branch "$GITHUB_REF_NAME" \
  '{
    prompt: $prompt,
    sourceContext: {
      source: $source,
      githubRepoContext: {
        startingBranch: $branch
      }
    },
    automationMode: "AUTO_CREATE_PR"
  }')

echo "Creating Jules session for $SOURCE on branch $GITHUB_REF_NAME..." >&2

RESPONSE=$(curl -s -X POST \
  -H "X-Goog-Api-Key: $JULES_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "https://jules.googleapis.com/v1alpha/sessions")

# Check for error
if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
  echo "Error creating session:" >&2
  echo "$RESPONSE" | jq .error >&2
  exit 1
fi

# Extract Session ID
# The name field is typically "sessions/{UUID}" or "projects/.../sessions/{UUID}"
# We assume the ID we need for subsequent calls (which construct URL .../sessions/{ID}) is just the UUID.
FULL_NAME=$(echo "$RESPONSE" | jq -r '.name')
SESSION_ID=$(echo "$FULL_NAME" | sed 's|.*/sessions/||')

echo "$SESSION_ID"
