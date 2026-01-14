#!/bin/bash
set -e

# Parse the audit result from Gemini and extract compliance status
# It expects the response in the AUDIT_RESPONSE environment variable

# Extract JSON from markdown code block (assuming ```json ... ```)
# If not found, try to use the whole response if it looks like JSON, or fail gracefully.

json_content=$(echo "$AUDIT_RESPONSE" | sed -n '/^```json$/,/^```$/p' | sed '1d;$d')

if [ -z "$json_content" ]; then
  # Fallback: try to find just a JSON object start/end if code blocks aren't used
  # strict parsing might fail if there is extra text.
  # Let's try to assume the whole thing might be JSON if it starts with {
  if [[ "$AUDIT_RESPONSE" =~ ^[[:space:]]*\{ ]]; then
    json_content="$AUDIT_RESPONSE"
  else
    echo "Error: Could not extract JSON from response."
    echo "Response was:"
    echo "$AUDIT_RESPONSE"
    exit 1
  fi
fi

echo "$json_content" > audit_result.json

# Validate JSON
if ! jq -e . audit_result.json >/dev/null 2>&1; then
  echo "Error: Extracted content is not valid JSON."
  echo "Content:"
  cat audit_result.json
  exit 1
fi

COMPLIANT=$(jq -r '.compliant' audit_result.json)
echo "compliant=$COMPLIANT" >> $GITHUB_OUTPUT

if [ "$COMPLIANT" = "true" ]; then
  echo "✅ PR is compliant with CONSTITUTION.md"
else
  echo "❌ PR has constitution violations"
fi
