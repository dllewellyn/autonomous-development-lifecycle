# Monolith Migration Plan: Probot-Based Single Service

## Overview

Consolidate 5 separate Cloud Run services into a single Probot-based GitHub App service.

## Architecture

### Current (5 Services)
```
Cloud Scheduler → Heartbeat (Cloud Run)
                    ├─→ Pub/Sub → Planner (Cloud Run)
                    └─→ Pub/Sub → Troubleshooter (Cloud Run)

GitHub Webhook → Enforcer (Cloud Run)
GitHub Webhook → Strategist (Cloud Run)
```

### Target (1 Service)
```
Cloud Scheduler → /heartbeat endpoint
                    ├─→ runPlanner() [internal]
                    └─→ runTroubleshooter() [internal]

GitHub Webhooks → Probot App
                    ├─→ pull_request.* → Enforcer handler
                    └─→ push (main) → Strategist handler → runPlanner() [internal]
```

## Implementation Steps

### Phase 1: Project Setup

1. **Create Monolith Service Structure**
   ```
   services/monolith/
   ├── src/
   │   ├── index.ts              # Probot app entry point
   │   ├── server.ts             # Express server with Probot + custom routes
   │   ├── handlers/
   │   │   ├── enforcer.ts       # pull_request webhook handler
   │   │   └── strategist.ts     # push webhook handler
   │   ├── services/
   │   │   ├── heartbeat.ts      # Orchestrator logic
   │   │   ├── planner.ts        # Task creation (internal only)
   │   │   └── troubleshooter.ts # Question answering (internal only)
   │   └── utils/
   │       └── logging.ts        # Structured logging
   ├── package.json
   ├── tsconfig.json
   └── Dockerfile
   ```

2. **Dependencies**
   ```json
   {
     "dependencies": {
       "probot": "^13.x",
       "express": "^4.x",
       "@gcp-adl/state": "workspace:*",
       "@gcp-adl/jules": "workspace:*",
       "@gcp-adl/gemini": "workspace:*",
       "@gcp-adl/github": "workspace:*"
     }
   }
   ```

### Phase 2: Extract Business Logic

3. **Planner Module** (`services/planner.ts`)
   ```typescript
   export async function runPlanner(
     context: {
       stateManager: StateManager,
       julesClient: JulesClient,
       geminiClient: GeminiClient,
       octokit: Octokit,  // from Probot context
       owner: string,
       repo: string,
       branch: string
     }
   ): Promise<PlannerResult>
   ```
   - Pure business logic, no Express
   - Takes dependencies as parameters
   - Returns structured result

4. **Troubleshooter Module** (`services/troubleshooter.ts`)
   ```typescript
   export async function runTroubleshooter(
     context: {
       julesClient: JulesClient,
       geminiClient: GeminiClient,
       octokit: Octokit,
       sessionId: string,
       question: string,
       owner: string,
       repo: string,
       branch: string
     }
   ): Promise<TroubleshooterResult>
   ```

5. **Heartbeat Module** (`services/heartbeat.ts`)
   ```typescript
   export async function runHeartbeat(
     context: {
       stateManager: StateManager,
       julesClient: JulesClient,
       runPlanner: () => Promise<PlannerResult>,
       runTroubleshooter: (sessionId: string, question: string) => Promise<TroubleshooterResult>
     }
   ): Promise<HeartbeatResult>
   ```
   - Orchestrates workflow
   - Calls planner/troubleshooter directly (no HTTP/Pub/Sub)

### Phase 3: Probot Handlers

6. **Enforcer Handler** (`handlers/enforcer.ts`)
   ```typescript
   export function setupEnforcerHandler(app: Probot) {
     app.on(['pull_request.opened', 'pull_request.synchronize', 'pull_request.reopened'], 
       async (context) => {
         // Get PR details from context
         const { pull_request } = context.payload;
         
         // Initialize clients
         const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY);
         const stateManager = new StateManager(process.env.STATE_BUCKET);
         const julesClient = new JulesClient(process.env.JULES_API_KEY);
         
         // Fetch CONSTITUTION.md using context.octokit
         const constitution = await context.octokit.repos.getContent({
           owner: context.payload.repository.owner.login,
           repo: context.payload.repository.name,
           path: 'CONSTITUTION.md'
         });
         
         // Get PR diff
         const diff = await context.octokit.pulls.get({
           owner: context.payload.repository.owner.login,
           repo: context.payload.repository.name,
           pull_number: pull_request.number,
           mediaType: { format: 'diff' }
         });
         
         // Audit with Gemini
         const audit = await geminiClient.auditPR(constitutionContent, tasksContent, diff);
         
         // Post review using Probot context
         if (!audit.compliant) {
           await context.octokit.pulls.createReview({
             owner: context.payload.repository.owner.login,
             repo: context.payload.repository.name,
             pull_number: pull_request.number,
             event: 'REQUEST_CHANGES',
             body: formatViolations(audit.violations)
           });
           
           // Notify Jules
           const state = await stateManager.readState();
           if (state.current_task_id) {
             await julesClient.sendMessage(state.current_task_id, formatViolations(audit.violations));
           }
         } else {
           // Approve and merge
           await context.octokit.pulls.createReview({
             owner: context.payload.repository.owner.login,
             repo: context.payload.repository.name,
             pull_number: pull_request.number,
             event: 'APPROVE',
             body: '✅ Constitution compliant. LGTM!'
           });
           
           await context.octokit.pulls.merge({
             owner: context.payload.repository.owner.login,
             repo: context.payload.repository.name,
             pull_number: pull_request.number
           });
         }
       }
     );
   }
   ```

7. **Strategist Handler** (`handlers/strategist.ts`)
   ```typescript
   export function setupStrategistHandler(app: Probot, runPlanner: Function) {
     app.on('push', async (context) => {
       const branch = process.env.GITHUB_BRANCH || 'main';
       const ref = context.payload.ref;
       
       // Only process pushes to main
       if (ref !== `refs/heads/${branch}`) {
         return;
       }
       
       const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY);
       const stateManager = new StateManager(process.env.STATE_BUCKET);
       
       // Get commit diff
       const commits = context.payload.commits;
       const latestCommit = commits[commits.length - 1];
       
       const diff = await context.octokit.repos.getCommit({
         owner: context.payload.repository.owner.login,
         repo: context.payload.repository.name,
         ref: latestCommit.id
       });
       
       // Fetch AGENTS.md and TASKS.md
       const [agents, tasks] = await Promise.all([
         context.octokit.repos.getContent({
           owner: context.payload.repository.owner.login,
           repo: context.payload.repository.name,
           path: 'AGENTS.md'
         }),
         context.octokit.repos.getContent({
           owner: context.payload.repository.owner.login,
           repo: context.payload.repository.name,
           path: 'TASKS.md'
         })
       ]);
       
       // Extract lessons
       const updatedAgents = await geminiClient.extractLessons(agentsContent, diff.data.files);
       const updatedTasks = await geminiClient.updateTasks(tasksContent, diff.data.files);
       
       // Update files
       await context.octokit.repos.createOrUpdateFileContents({
         owner: context.payload.repository.owner.login,
         repo: context.payload.repository.name,
         path: 'AGENTS.md',
         message: 'chore: update agent memory after merge',
         content: Buffer.from(updatedAgents).toString('base64'),
         sha: agents.data.sha
       });
       
       await context.octokit.repos.createOrUpdateFileContents({
         owner: context.payload.repository.owner.login,
         repo: context.payload.repository.name,
         path: 'TASKS.md',
         message: 'chore: update tasks after merge',
         content: Buffer.from(updatedTasks).toString('base64'),
         sha: tasks.data.sha
       });
       
       // Restart loop
       await stateManager.startLoop();
       
       // Trigger planner (internal call)
       await runPlanner();
     });
   }
   ```

### Phase 4: Main Application

8. **Server Setup** (`server.ts`)
   ```typescript
   import { Probot, Server } from 'probot';
   import { setupEnforcerHandler } from './handlers/enforcer';
   import { setupStrategistHandler } from './handlers/strategist';
   import { runHeartbeat } from './services/heartbeat';
   import { runPlanner } from './services/planner';
   import { runTroubleshooter } from './services/troubleshooter';
   
   export function setupServer(probot: Probot) {
     const app = probot.route();
     
     // Setup Probot handlers
     setupEnforcerHandler(probot);
     setupStrategistHandler(probot, runPlanner);
     
     // Custom routes (non-GitHub)
     app.get('/health', (req, res) => {
       res.json({ status: 'healthy', service: 'adl-monolith' });
     });
     
     // Heartbeat endpoint (Cloud Scheduler)
     app.post('/heartbeat', async (req, res) => {
       try {
         const result = await runHeartbeat({
           stateManager: new StateManager(process.env.STATE_BUCKET),
           julesClient: new JulesClient(process.env.JULES_API_KEY),
           runPlanner: async () => {
             // Create bound planner function with dependencies
             return runPlanner({
               stateManager: new StateManager(process.env.STATE_BUCKET),
               julesClient: new JulesClient(process.env.JULES_API_KEY),
               geminiClient: new GeminiClient(process.env.GEMINI_API_KEY),
               octokit: probot.octokit,
               owner: process.env.GITHUB_REPOSITORY.split('/')[0],
               repo: process.env.GITHUB_REPOSITORY.split('/')[1],
               branch: process.env.GITHUB_BRANCH || 'main'
             });
           },
           runTroubleshooter: async (sessionId: string, question: string) => {
             return runTroubleshooter({
               julesClient: new JulesClient(process.env.JULES_API_KEY),
               geminiClient: new GeminiClient(process.env.GEMINI_API_KEY),
               octokit: probot.octokit,
               sessionId,
               question,
               owner: process.env.GITHUB_REPOSITORY.split('/')[0],
               repo: process.env.GITHUB_REPOSITORY.split('/')[1],
               branch: process.env.GITHUB_BRANCH || 'main'
             });
           }
         });
         
         res.json({ success: true, result });
       } catch (error) {
         console.error('Heartbeat failed:', error);
         res.status(500).json({ success: false, error: String(error) });
       }
     });
   }
   ```

9. **Entry Point** (`index.ts`)
   ```typescript
   import { Probot } from 'probot';
   import { setupServer } from './server';
   
   export default (app: Probot) => {
     setupServer(app);
   };
   ```

### Phase 5: Shared Libraries Simplification

10. **Remove GitHubClient** (Optional)
    - Probot provides `context.octokit` with authenticated GitHub API
    - Can remove `@gcp-adl/github` package
    - Or keep it for non-Probot contexts (heartbeat)

11. **Keep Other Shared Libraries**
    - `@gcp-adl/state`: Still needed for Ralph state
    - `@gcp-adl/jules`: Still needed for Jules API
    - `@gcp-adl/gemini`: Still needed for Gemini API

### Phase 6: Configuration

12. **Environment Variables**
    ```bash
    # GitHub App (Probot)
    APP_ID=your-github-app-id
    PRIVATE_KEY=your-github-app-private-key
    WEBHOOK_SECRET=your-webhook-secret
    
    # Application
    GITHUB_REPOSITORY=owner/repo
    GITHUB_BRANCH=main
    
    # External APIs
    GEMINI_API_KEY=your-gemini-api-key
    JULES_API_KEY=your-jules-api-key
    
    # GCP
    STATE_BUCKET=your-state-bucket
    
    # Server
    PORT=8080
    NODE_ENV=production
    ```

13. **GitHub App Setup**
    - Create GitHub App in repository settings
    - Permissions:
      - Repository contents: Read & Write
      - Pull requests: Read & Write
      - Issues: Read & Write (for notifications)
    - Subscribe to events:
      - Pull request
      - Push
    - Generate private key
    - Install app on repository

### Phase 7: Deployment

14. **Dockerfile**
    ```dockerfile
    FROM node:20-alpine
    
    WORKDIR /app
    
    # Copy workspace packages
    COPY gcp-adl/shared ./shared
    COPY gcp-adl/services/monolith ./monolith
    
    # Install dependencies
    WORKDIR /app/monolith
    RUN npm ci --only=production
    
    # Build TypeScript
    RUN npm run build
    
    EXPOSE 8080
    
    CMD ["npm", "start"]
    ```

15. **Build Script** (`infrastructure/scripts/build-monolith.sh`)
    ```bash
    #!/bin/bash
    set -e
    
    echo "Building monolith service..."
    
    cd gcp-adl/services/monolith
    
    # Build shared libraries first
    for lib in ../../../shared/*; do
      if [ -d "$lib" ]; then
        echo "Building $(basename $lib)..."
        cd "$lib"
        npm run build
        cd -
      fi
    done
    
    # Build monolith
    npm run build
    
    # Build Docker image
    docker build -t gcr.io/${GCP_PROJECT_ID}/adl-monolith:latest -f Dockerfile ../..
    docker push gcr.io/${GCP_PROJECT_ID}/adl-monolith:latest
    
    echo "Build complete!"
    ```

16. **Deploy Script** (`infrastructure/scripts/deploy-monolith.sh`)
    ```bash
    #!/bin/bash
    set -e
    
    echo "Deploying monolith service..."
    
    # Deploy to Cloud Run
    gcloud run deploy adl-monolith \
      --image gcr.io/${GCP_PROJECT_ID}/adl-monolith:latest \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --memory 1Gi \
      --timeout 300 \
      --min-instances 0 \
      --max-instances 10 \
      --set-env-vars "GITHUB_REPOSITORY=${GITHUB_REPOSITORY},GITHUB_BRANCH=${GITHUB_BRANCH}" \
      --set-secrets "APP_ID=github-app-id:latest,PRIVATE_KEY=github-app-private-key:latest,WEBHOOK_SECRET=github-webhook-secret:latest,GEMINI_API_KEY=gemini-api-key:latest,JULES_API_KEY=jules-api-key:latest,STATE_BUCKET=state-bucket-name:latest"
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe adl-monolith --platform managed --region us-central1 --format 'value(status.url)')
    
    echo "Service deployed at: ${SERVICE_URL}"
    echo ""
    echo "Next steps:"
    echo "1. Update Cloud Scheduler target to: ${SERVICE_URL}/heartbeat"
    echo "2. Update GitHub App webhook URL to: ${SERVICE_URL}"
    echo "3. Verify GitHub App is installed on repository"
    ```

### Phase 8: Infrastructure Updates

17. **Cloud Scheduler**
    ```bash
    gcloud scheduler jobs update http adl-heartbeat \
      --location us-central1 \
      --schedule "*/5 * * * *" \
      --uri "${SERVICE_URL}/heartbeat" \
      --http-method POST \
      --oidc-service-account-email ${SERVICE_ACCOUNT_EMAIL}
    ```

18. **Remove Old Infrastructure**
    ```bash
    # Delete old services
    gcloud run services delete heartbeat --platform managed --region us-central1 --quiet
    gcloud run services delete planner --platform managed --region us-central1 --quiet
    gcloud run services delete troubleshooter --platform managed --region us-central1 --quiet
    gcloud run services delete enforcer --platform managed --region us-central1 --quiet
    gcloud run services delete strategist --platform managed --region us-central1 --quiet
    
    # Delete Pub/Sub resources
    gcloud pubsub subscriptions delete adl-planner-subscription --quiet
    gcloud pubsub subscriptions delete adl-troubleshooter-subscription --quiet
    gcloud pubsub topics delete adl-planner-trigger --quiet
    gcloud pubsub topics delete adl-troubleshooter-trigger --quiet
    ```

### Phase 9: Testing

19. **Test Checklist**
    - [ ] Health check: `curl https://[service-url]/health`
    - [ ] Heartbeat: Manually trigger Cloud Scheduler job
    - [ ] Enforcer: Create a test PR
    - [ ] Strategist: Merge a PR to main
    - [ ] Verify logs in Cloud Logging
    - [ ] Check Jules sessions are created
    - [ ] Verify AGENTS.md/TASKS.md updates

20. **Monitoring**
    - Cloud Logging: All logs in one place
    - Cloud Monitoring: Single service to monitor
    - Error Reporting: Automatic error tracking
    - Cloud Trace: Request tracing

## Benefits

### Cost Reduction
- **Before**: 5 services × $2-3/month = $10-15/month
- **After**: 1 service × $3-5/month = $3-5/month
- **Savings**: ~70% reduction

### Operational Benefits
- Single deployment pipeline
- Unified logging and monitoring
- No Pub/Sub costs or complexity
- Simpler IAM permissions
- Better cold start performance

### Development Benefits
- Easier local development (single `npm run dev`)
- Better IDE support (single project)
- Simplified testing (no mocking Pub/Sub)
- Native GitHub API via Probot

### Architectural Benefits
- Synchronous execution (faster)
- Better error propagation
- Simpler debugging
- Probot handles webhook verification, retries, rate limiting

## Migration Timeline

- **Week 1**: Implement monolith structure (Phases 1-4)
- **Week 2**: Testing and refinement (Phase 9)
- **Week 3**: Deploy alongside existing services
- **Week 4**: Switch traffic, monitor, decommission old services

## Rollback Plan

1. Keep old services running for 2 weeks
2. If issues detected:
   - Update Cloud Scheduler back to old heartbeat service
   - Update GitHub webhooks back to old services
   - Delete monolith service
3. Otherwise, decommission old services after 2 weeks

## Open Questions

1. Should we keep `@gcp-adl/github` or fully migrate to Probot's octokit?
2. Do we need Pub/Sub at all, or go fully synchronous?
3. Should heartbeat also be a GitHub webhook (e.g., schedule via GitHub Actions)?

## Conclusion

This migration simplifies the architecture significantly by:
- Using Probot as the natural framework for a GitHub App
- Making planner/troubleshooter internal functions (not exposed services)
- Eliminating Pub/Sub entirely
- Reducing from 5 services to 1

The result is a more maintainable, cost-effective, and performant system.
