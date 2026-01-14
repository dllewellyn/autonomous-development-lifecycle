#!/bin/bash
set -e

# Get the diff for the PR, excluding package-lock.json to avoid "Argument list too long" errors
git diff origin/${BASE_REF}...HEAD . ':(exclude)package-lock.json' > pr_diff.txt
echo "Diff saved to pr_diff.txt"

# Prepare context for Gemini
echo "PR context prepared successfully (files created: pr_diff.txt)"
