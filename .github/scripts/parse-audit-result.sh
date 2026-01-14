#!/bin/bash
set -e

# Parse the audit result from Gemini and extract compliance status
AUDIT_RESPONSE="$1"

echo "$AUDIT_RESPONSE" > audit_result.json

COMPLIANT=$(jq -r '.compliant' audit_result.json)
echo "compliant=$COMPLIANT" >> $GITHUB_OUTPUT

if [ "$COMPLIANT" = "true" ]; then
  echo "✅ PR is compliant with CONSTITUTION.md"
else
  echo "❌ PR has constitution violations"
fi
