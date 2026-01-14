#!/bin/bash
set -e

# Get the diff for the PR
git diff origin/${BASE_REF}...HEAD > pr_diff.txt
echo "Diff saved to pr_diff.txt"

# Prepare context for Gemini
CONSTITUTION=$(cat CONSTITUTION.md 2>/dev/null || echo "File not found")
PR_DIFF=$(cat pr_diff.txt)

echo "CONSTITUTION_CONTENT<<EOF" >> $GITHUB_ENV
echo "$CONSTITUTION" >> $GITHUB_ENV
echo "EOF" >> $GITHUB_ENV

echo "PR_DIFF_CONTENT<<EOF" >> $GITHUB_ENV
echo "$PR_DIFF" >> $GITHUB_ENV
echo "EOF" >> $GITHUB_ENV

echo "PR context prepared successfully"
