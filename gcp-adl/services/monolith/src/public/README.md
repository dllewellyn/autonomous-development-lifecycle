# Debug UI for ADL Strategist

## Overview
This debug UI provides a convenient way to force re-trigger the strategist for testing and debugging purposes.

## Access
Once the monolith service is running, access the debug UI at:
```
http://localhost:3000/debug/debug.html
```

Or in production:
```
https://your-service-url/debug/debug.html
```

## Features

### Force Re-trigger Strategist
This button allows you to:
1. **Delete the existing Ralph state** - Resets the current state in GCS
2. **Reset iteration counter to 0** - Starts fresh
3. **Trigger planner execution** - Forces the planner to run immediately
4. **Start a fresh ADL cycle** - Restarts the entire autonomous development loop

## Usage

1. Navigate to the debug UI URL
2. Click the "Force Re-trigger Strategist" button
3. Wait for the operation to complete
4. Check the status message for success/failure

## API Endpoint

The debug UI calls the following endpoint:

```
POST /debug/trigger-strategist
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "message": "Strategist triggered successfully. State reset and planner executed.",
  "result": {
    // Planner execution result
  }
}
```

## Security Notes

⚠️ **Warning**: This is a debug endpoint and should be protected in production environments.

Consider:
- Adding authentication/authorization
- Restricting access by IP address
- Only enabling in development/staging environments
- Using environment variables to enable/disable debug features

## Development

To modify the debug UI, edit:
```
services/monolith/src/public/debug.html
```

Then rebuild:
```bash
cd services/monolith
npm run build
```

## Environment Variables

The debug endpoint requires these environment variables:
- `STATE_BUCKET` - GCS bucket for state management
- `JULES_API_KEY` - Jules API key for AI agent
- `GEMINI_API_KEY` - Gemini API key for AI features
- `GITHUB_REPOSITORY` - Repository in format `owner/repo`
- `GITHUB_BRANCH` - Branch to work on (default: `main`)
