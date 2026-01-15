#!/bin/bash
set -euo pipefail

# Required environment variables:
# TASKS_SUMMARY

printf '%s' "$TASKS_SUMMARY" > TASKS.md
echo "TASKS.md updated - completed task removed"
