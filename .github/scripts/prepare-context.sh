#!/bin/bash
set -e

# Read all context files and prepare them for Gemini
echo "Reading context files..."

GOALS_CONTENT=$(cat GOALS.md 2>/dev/null || echo "File not found")
TASKS_CONTENT=$(cat TASKS.md 2>/dev/null || echo "File not found")
CONTEXT_MAP_CONTENT=$(cat CONTEXT_MAP.md 2>/dev/null || echo "File not found")
AGENTS_CONTENT=$(cat AGENTS.md 2>/dev/null || echo "File not found")

# Save to environment for next step
echo "GOALS_CONTENT<<EOF" >> $GITHUB_ENV
echo "$GOALS_CONTENT" >> $GITHUB_ENV
echo "EOF" >> $GITHUB_ENV

echo "TASKS_CONTENT<<EOF" >> $GITHUB_ENV
echo "$TASKS_CONTENT" >> $GITHUB_ENV
echo "EOF" >> $GITHUB_ENV

echo "CONTEXT_MAP_CONTENT<<EOF" >> $GITHUB_ENV
echo "$CONTEXT_MAP_CONTENT" >> $GITHUB_ENV
echo "EOF" >> $GITHUB_ENV

echo "AGENTS_CONTENT<<EOF" >> $GITHUB_ENV
echo "$AGENTS_CONTENT" >> $GITHUB_ENV
echo "EOF" >> $GITHUB_ENV

echo "Context files prepared successfully"
