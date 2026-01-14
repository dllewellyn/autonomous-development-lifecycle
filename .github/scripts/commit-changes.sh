#!/bin/bash
set -e

# Commit changes to the repository
git config user.name "Ralph Bot"
git config user.email "ralph@bot.local"

if [ -z "${GITHUB_PAT:-}" ]; then
  echo "GITHUB_PAT is required for pushing commits"
  exit 1
fi

if [ -z "${GITHUB_REPOSITORY:-}" ]; then
  echo "GITHUB_REPOSITORY is required for pushing commits"
  exit 1
fi

git remote set-url origin "https://x-access-token:${GITHUB_PAT}@github.com/${GITHUB_REPOSITORY}.git"

# Add all specified files (passed as arguments)
git add "$@"

# Only commit if there are changes
if git diff --staged --quiet; then
  echo "No changes to commit"
else
  COMMIT_MSG="${COMMIT_MESSAGE:-chore: automated update}"
  git commit -m "$COMMIT_MSG"
  git push
  echo "Changes committed and pushed successfully"
fi
