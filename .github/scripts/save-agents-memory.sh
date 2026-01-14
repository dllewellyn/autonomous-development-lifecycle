#!/bin/bash
set -euo pipefail

# Required environment variables:
# AGENTS_SUMMARY

printf '%s' "$AGENTS_SUMMARY" > AGENTS.md
echo "AGENTS.md updated with new lessons"
