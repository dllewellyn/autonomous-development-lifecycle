#!/bin/bash
set -e

# Get the diff of what was just merged
git diff HEAD^ HEAD > merge_diff.txt
echo "Merge diff saved to merge_diff.txt"

# Prepare context for lessons learned
AGENTS_CONTENT=$(cat AGENTS.md 2>/dev/null || echo "File not found")
MERGE_DIFF=$(cat merge_diff.txt)

echo "AGENTS_CONTENT<<EOF" >> $GITHUB_ENV
echo "$AGENTS_CONTENT" >> $GITHUB_ENV
echo "EOF" >> $GITHUB_ENV

echo "MERGE_DIFF_CONTENT<<EOF" >> $GITHUB_ENV
echo "$MERGE_DIFF" >> $GITHUB_ENV
echo "EOF" >> $GITHUB_ENV

echo "Merge context prepared successfully"
