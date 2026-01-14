#!/bin/bash
set -e

# Get the diff for the PR
git diff origin/${BASE_REF}...HEAD > pr_diff.txt
echo "Diff saved to pr_diff.txt"

# Prepare context for Gemini
echo "PR context prepared successfully (files created: pr_diff.txt)"
