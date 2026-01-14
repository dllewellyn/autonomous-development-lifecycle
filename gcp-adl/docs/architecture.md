# GCP ADL Architecture

## Overview

The GCP ADL (Google Cloud Platform Autonomous Development Lifecycle) is a cloud-native implementation of the autonomous development system originally designed for GitHub Actions. This document provides detailed architectural information about the system.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                        │
│  (GOALS.md, TASKS.md, CONSTITUTION.md, AGENTS.md, code, etc.)  │
└──────────────────┬──────────────────────────┬───────────────────┘
                   │                          │
                   │ (webhooks)               │ (API calls)
                   ▼                          ▼
         ┌──────────────────┐      ┌──────────────────┐
         │   Enforcer       │      │   Strategist     │
         │  (Cloud Run)     │      │  (Cloud Run)     │
         └──────────────────┘      └────────┬─────────┘
                                            │
                                            │ (publishes)
                                            ▼
                                   ┌─────────────────┐
         ┌──────────────────────┐  │   Pub/Sub       │
         │  Cloud Scheduler     │  │   Topics        │
         │  (every 5 mins)      │  └────┬────────────┘
         └──────┬───────────────┘       │
                │                       │
                ▼                       │
       ┌──────────────────┐             │
       │   Heartbeat      │             │
       │  (Cloud Run)     │◄────────────┘
       └────────┬─────────┘
                │
                │ (reads/writes)
                ▼
       ┌──────────────────┐
       │ Cloud Storage    │
       │ (.ralph-state)   │
       └──────────────────┘
                │
                │ (publishes)
                ▼
       ┌──────────────────┐
       │   Pub/Sub        │
       │   Topics         │
       └────┬─────────┬───┘
            │         │
            ▼         ▼
    ┌──────────┐  ┌──────────────┐
    │ Planner  │  │Troubleshooter│
    │(Cloud Run)│  │ (Cloud Run) │
    └────┬─────┘  └──────┬───────┘
         │                │
         └────────┬───────┘
                  │
                  ▼
         ┌─────────────────┐
         │   Jules API     │
         │  (Task Mgmt)    │
         └─────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  GitHub (PRs)   │
         └─────────────────┘
```

## Core Components

### 1. Heartbeat Service

**Purpose**: Orchestrator that monitors system state and triggers appropriate actions.

**Technology**: Cloud Run + Cloud Scheduler

**Triggers**: 
- Cloud Scheduler (cron: every 5 minutes)
- Manual HTTP trigger

**Responsibilities**:
1. Read Ralph state from Cloud Storage
2. Check if system is stopped (if so, terminate)
3. Query Jules API for task status
4. Decide on action based on status:
   - `none_active` → Publish to planner-trigger topic
   - `waiting_for_input` → Publish to troubleshooter-trigger topic
   - `blocked` → Stop loop, notify human
   - `in_progress` → Do nothing

**State Management**:
- Reads: `.ralph-state.json` from Cloud Storage
- Writes: Updates state when stopping loop

**Dependencies**:
- Cloud Storage (state)
- Jules API
- Pub/Sub (publishing triggers)

### 2. Planner Service

**Purpose**: Creates new Jules tasks based on repository analysis.

**Technology**: Cloud Run

**Triggers**:
- Pub/Sub push subscription (planner-trigger topic)
- Manual HTTP trigger

**Responsibilities**:
1. Check for existing active sessions
2. Fetch GOALS.md, TASKS.md, CONTEXT_MAP.md, AGENTS.md from GitHub
3. Use Gemini to analyze and generate a plan
4. Create Jules session with the plan
5. Update Ralph state with new session ID

**State Management**:
- Reads: Current state (to check for active session)
- Writes: Updates session ID and increments iteration count

**Dependencies**:
- GitHub API (reading files)
- Gemini API (plan generation)
- Jules API (session creation)
- Cloud Storage (state)

### 3. Enforcer Service

**Purpose**: Reviews pull requests against the repository constitution.

**Technology**: Cloud Run

**Triggers**:
- GitHub webhook (pull_request events: opened, synchronize, reopened)
- Manual HTTP trigger

**Responsibilities**:
1. Receive PR webhook from GitHub
2. Fetch PR diff via GitHub API
3. Fetch CONSTITUTION.md and TASKS.md
4. Use Gemini to audit the PR
5. If violations:
   - Post comment on PR
   - Request changes
   - Send feedback to Jules session
6. If compliant:
   - Approve PR
   - Merge PR

**State Management**:
- Reads: Current session ID (for sending feedback to Jules)

**Dependencies**:
- GitHub API (webhooks, PR operations)
- Gemini API (audit)
- Jules API (sending feedback)
- Cloud Storage (state, read-only)

**Security**:
- Allows unauthenticated requests (for GitHub webhooks)
- Optional: Webhook signature verification

### 4. Strategist Service

**Purpose**: Learns from merges and updates system knowledge.

**Technology**: Cloud Run

**Triggers**:
- GitHub webhook (push events to main branch)
- Manual HTTP trigger

**Responsibilities**:
1. Receive push webhook from GitHub
2. Fetch latest commit diff
3. Fetch current AGENTS.md and TASKS.md
4. Use Gemini to extract lessons learned
5. Use Gemini to update TASKS.md (mark completed, add new)
6. Update both files in the repository
7. Restart the loop (reset state)
8. Trigger Planner via Pub/Sub

**State Management**:
- Writes: Restarts loop (resets iteration count, sets status to 'started')

**Dependencies**:
- GitHub API (webhooks, file operations)
- Gemini API (analysis)
- Pub/Sub (triggering Planner)
- Cloud Storage (state)

**Security**:
- Allows unauthenticated requests (for GitHub webhooks)
- Optional: Webhook signature verification

### 5. Troubleshooter Service

**Purpose**: Provides answers to Jules when tasks are waiting for input.

**Technology**: Cloud Run

**Triggers**:
- Pub/Sub push subscription (troubleshooter-trigger topic)
- Manual HTTP trigger

**Responsibilities**:
1. Receive trigger with session ID and question
2. Fetch CONTEXT_MAP.md and CONSTITUTION.md
3. Use Gemini to generate an answer
4. Send answer to Jules session

**Note**: This is a simplified implementation. The Jules API may need additional endpoints to fetch blocker questions programmatically.

**Dependencies**:
- GitHub API (reading context files)
- Gemini API (answer generation)
- Jules API (sending messages)

## Shared Libraries

### State Management (`@gcp-adl/state`)

**Purpose**: Manages Ralph state persistence in Cloud Storage.

**Key Classes**:
- `StateManager`: Read/write state, update fields, manage loop status

**State Schema**:
```typescript
interface RalphState {
  status: 'started' | 'stopped';
  current_task_id: string | null;
  last_updated: string;
  iteration_count: number;
  max_iterations: number;
}
```

### Jules Client (`@gcp-adl/jules`)

**Purpose**: Interacts with Jules API for task management.

**Key Classes**:
- `JulesClient`: List sessions, get status, create session, send message

**Key Methods**:
- `listSessions()`: Get all Jules sessions
- `getStatus()`: Get aggregated status (none_active, in_progress, waiting_for_input, blocked)
- `createSession()`: Create new Jules task
- `sendMessage()`: Send feedback/answers to Jules

### Gemini Client (`@gcp-adl/gemini`)

**Purpose**: Interacts with Gemini API for AI-powered analysis.

**Key Classes**:
- `GeminiClient`: Generate content, analyze, audit, extract lessons

**Key Methods**:
- `generatePlan()`: Analyze repo state and generate task plan
- `auditPR()`: Review PR against constitution
- `extractLessons()`: Learn from merged changes
- `updateTasks()`: Update task list after merge

### GitHub Client (`@gcp-adl/github`)

**Purpose**: Interacts with GitHub API for repository operations.

**Key Classes**:
- `GitHubClient`: File operations, PR operations, issue creation

**Key Methods**:
- `getFileContent()`: Read files from repository
- `updateFile()`: Write files to repository
- `getPRDiff()`: Get PR changes
- `commentOnPR()`, `approvePR()`, `mergePR()`: PR review operations
- `getLatestCommitDiff()`: Get recent changes

## Data Flow

### 1. Normal Task Execution Flow

```
Scheduler → Heartbeat → Check State → Check Jules
                                    ↓ (no active tasks)
                                  Planner
                                    ↓
                    Read repo files (GitHub)
                                    ↓
                            Generate Plan (Gemini)
                                    ↓
                            Create Session (Jules)
                                    ↓
                              Update State
                                    ↓
                         Jules executes → Creates PR
                                    ↓
                              GitHub webhook
                                    ↓
                                Enforcer
                                    ↓
                          Audit (Gemini) → Approve & Merge
                                    ↓
                              Push to main
                                    ↓
                              GitHub webhook
                                    ↓
                               Strategist
                                    ↓
                    Extract Lessons (Gemini)
                                    ↓
                     Update AGENTS.md & TASKS.md
                                    ↓
                              Restart Loop
                                    ↓
                           Trigger Planner
```

### 2. Blocked Task Flow

```
Scheduler → Heartbeat → Check Jules → Status: blocked
                                    ↓
                                Stop Loop
                                    ↓
                          Create GitHub Issue
                                    ↓
                            (Wait for human)
```

### 3. Waiting for Input Flow

```
Scheduler → Heartbeat → Check Jules → Status: waiting_for_input
                                    ↓
                             Troubleshooter
                                    ↓
                          Generate Answer (Gemini)
                                    ↓
                         Send Message (Jules)
```

## Infrastructure

### Cloud Run Services

All services are deployed as Cloud Run services with:
- **Concurrency**: Default (80 requests per instance)
- **Memory**: 512MB
- **Timeout**: 5-15 minutes depending on service
- **Min Instances**: 0 (scale to zero when idle)
- **Max Instances**: 10 (adjustable)

### Cloud Storage

- **Bucket**: Single bucket for state management
- **Files**: `.ralph-state.json`
- **Access**: Private, IAM-based
- **Region**: Same as Cloud Run services

### Pub/Sub

**Topics**:
- `adl-planner-trigger`: Triggers Planner service
- `adl-troubleshooter-trigger`: Triggers Troubleshooter service

**Subscriptions**:
- Push subscriptions pointing to Cloud Run service URLs
- Service account authentication

### Cloud Scheduler

- **Job**: `adl-heartbeat-cron`
- **Schedule**: `*/5 * * * *` (every 5 minutes)
- **Target**: Heartbeat service `/run` endpoint
- **Authentication**: Service account with Cloud Run Invoker role

### Secret Manager

Stores sensitive configuration:
- `gemini-api-key`: Gemini API key
- `jules-api-key`: Jules API key
- `github-token`: GitHub personal access token

## Security Considerations

1. **Service Authentication**:
   - Internal services (Heartbeat, Planner, Troubleshooter): Require authentication
   - Webhook services (Enforcer, Strategist): Allow unauthenticated (optional signature verification)

2. **Secrets Management**:
   - All secrets stored in Secret Manager
   - IAM-based access control
   - Secrets injected as environment variables at runtime

3. **GitHub Webhooks**:
   - Optional: Implement webhook signature verification
   - Consider IP allowlisting if needed

4. **State File**:
   - Stored in private Cloud Storage bucket
   - Only accessible by Cloud Run service account

## Monitoring and Observability

### Cloud Logging

All services log to Cloud Logging:
- Structured JSON logs
- Request/response logging
- Error tracking

### Cloud Monitoring

Key metrics to monitor:
- Service request count
- Service latency
- Error rate
- State bucket operations
- Pub/Sub message throughput

### Alerting

Recommended alerts:
- Service error rate > 5%
- Heartbeat not running for > 10 minutes
- Jules session blocked
- Cloud Storage access failures

## Cost Optimization

### Estimated Monthly Costs

Based on typical usage:
- **Cloud Run**: $5-10 (minimal traffic, scale to zero)
- **Cloud Storage**: <$1 (small state files)
- **Pub/Sub**: <$1 (low message volume)
- **Cloud Scheduler**: Free (first 3 jobs)
- **Cloud Logging**: $1-2 (default retention)
- **Secret Manager**: <$1
- **Total**: ~$10-15/month

### Optimization Tips

1. **Scale to Zero**: Keep min instances at 0
2. **Regional Resources**: Keep all resources in same region
3. **Log Retention**: Adjust to 7-30 days instead of 400
4. **Monitoring**: Use default dashboards, avoid custom metrics
5. **Scheduler**: Adjust frequency if 5 minutes is too aggressive

## Comparison with GitHub Actions Version

| Aspect | GitHub Actions | GCP ADL |
|--------|---------------|---------|
| **Triggering** | Cron + workflow_dispatch | Cloud Scheduler + Pub/Sub |
| **State** | Committed to repo | Cloud Storage |
| **Authentication** | GitHub tokens | Service accounts + Secret Manager |
| **Gemini Integration** | gemini-cli action | Gemini API SDK |
| **Cost** | Free (for public repos) | ~$10-15/month |
| **Scalability** | Limited by GitHub Actions quotas | Highly scalable |
| **Monitoring** | GitHub Actions UI | Cloud Logging + Monitoring |
| **Complexity** | Lower (native to GitHub) | Higher (multi-service) |

## Future Enhancements

1. **Enhanced Troubleshooter**: Better integration with Jules API for fetching questions
2. **Metrics Dashboard**: Custom Cloud Monitoring dashboard
3. **Terraform Support**: Full IaC implementation
4. **Multi-Region**: Deploy across multiple regions for HA
5. **Webhook Security**: Implement signature verification
6. **Rate Limiting**: Add rate limiting to webhook endpoints
7. **Caching**: Add caching layer for frequently accessed repo files
8. **Testing**: Add integration tests for end-to-end flows
