#!/bin/bash
set -e

# Prepare context for task update
TASKS_CONTENT=$(cat TASKS.md 2>/dev/null || echo "File not found")

echo "TASKS_CONTENT<<EOF" >> $GITHUB_ENV
echo "$TASKS_CONTENT" >> $GITHUB_ENV
echo "EOF" >> $GITHUB_ENV

echo "Tasks context prepared successfully"
