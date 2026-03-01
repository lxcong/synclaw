# OpenClaw Agent Sync Design

Date: 2026-03-01
Phase: 2 (Agent List Sync from Gateway)

## Overview

Replace mock/seed agent data with real agents fetched from OpenClaw Gateway. Agents are synced to local Prisma DB to preserve Task foreign key relationships. Task dispatch includes `agentId` so Gateway routes to the correct agent.

## Architecture

```
Browser → GET /api/agents → Next.js API
                           → Gateway RPC agents.list
                           → Gateway RPC agents.files.get (SOUL.md per agent)
                           → Upsert agents to local Prisma DB
                           → Query active task counts → infer status
                           → Return agent list

Browser → POST /api/tasks → Next.js API
                           → Gateway RPC agent({ message, agentId, ... })
```

## Data Model Mapping

| SyncClaw Agent Field | Source                                    |
|----------------------|-------------------------------------------|
| id                   | OpenClaw agent ID (external, not cuid)    |
| name                 | `identity.name` or `name` from agents.list |
| description          | Extracted from SOUL.md via agents.files.get |
| capabilities         | Derived from agent skills/config           |
| status               | Inferred: has active tasks → busy, else idle |
| avatarUrl            | `identity.avatarUrl` from agents.list      |
| emoji                | `identity.emoji` from agents.list (new)    |

## Changes Required

### 1. Prisma Schema

- `Agent.id`: Remove `@default(cuid())` — use OpenClaw's agent ID directly
- Add `emoji` field (optional String)
- Keep all existing fields and relationships

### 2. GET /api/agents (agent list endpoint)

- Call `gatewayClient.request("agents.list", {})` to get agent list
- For each agent, call `gatewayClient.request("agents.files.get", { agentId, fileName: "SOUL.md" })` to get description
- Upsert each agent into Prisma DB (create if new, update if exists)
- Remove agents from DB that no longer exist in Gateway
- Query task counts to infer busy/idle status
- Return assembled agent list

### 3. POST /api/tasks (task dispatch)

- Add `agentId` to Gateway RPC params:
  ```typescript
  gatewayClient.request("agent", {
    message,
    sessionKey: `sk:global:syncclaw:${task.id}`,
    idempotencyKey: task.id,
    agentId: task.assignedAgentId,  // NEW
  })
  ```

### 4. TypeScript Types

- Add `emoji?: string` to Agent interface

### 5. Agent Card Component

- Use `emoji` from agent data for display instead of hardcoded icon mapping
- Show `avatarUrl` if available, fall back to emoji

### 6. Seed Data

- Remove hardcoded mock agents from seed.ts
- Keep workspace seed data

## Error Handling

| Scenario                         | Behavior                                          |
|----------------------------------|---------------------------------------------------|
| Gateway not connected            | Return cached agents from local DB                |
| agents.files.get fails           | Use empty description, continue                   |
| Agent removed from Gateway       | Remove from local DB (cascade or nullify tasks)   |

## Not in Scope

- Agent creation/update/delete from SyncClaw UI
- Real-time agent status push (heartbeat events)
- Agent workspace file editing
