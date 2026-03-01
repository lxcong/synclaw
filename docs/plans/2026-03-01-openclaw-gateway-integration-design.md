# OpenClaw Gateway Integration Design

Date: 2026-03-01
Phase: 1 (Task Dispatch + Status Sync)

## Overview

Integrate SyncClaw v2 with OpenClaw Gateway to replace the mock agent engine with real agent execution. Phase 1 focuses on core task dispatch and status synchronization.

**Architecture:** Server-side Gateway Client (Option A)

```
Browser ── SSE ──> Next.js API ──> OpenClaw Gateway (WebSocket)
Browser <── SSE ── Next.js    <── Gateway Agent Events
```

## Module 1: Gateway WebSocket Client

**File:** `src/lib/gateway-client.ts`

A singleton WebSocket client running in the Next.js server process.

### Responsibilities

- Connect to OpenClaw Gateway (`ws://localhost:18789`)
- Send handshake frame (ConnectParams), receive `hello-ok`
- Provide `request(method, params)` for RPC calls
- Listen for `agent` events, dispatch by `runId` to subscribers
- Auto-reconnect with exponential backoff (max 30s)
- Heartbeat keepalive

### Protocol

**Handshake (ConnectParams):**

```json
{
  "minProtocol": 1,
  "maxProtocol": 1,
  "client": {
    "id": "<uuid>",
    "displayName": "SyncClaw",
    "version": "0.1.0",
    "platform": "node",
    "mode": "operator"
  },
  "role": "operator",
  "scopes": ["admin"]
}
```

**Request Frame:**

```json
{
  "type": "req",
  "id": "<uuid>",
  "method": "agent",
  "params": {
    "message": "<task title + description>",
    "sessionKey": "sk:global:syncclaw:<taskId>",
    "idempotencyKey": "<taskId>"
  }
}
```

**Response Frame:**

```json
{
  "type": "res",
  "id": "<req-id>",
  "ok": true,
  "payload": { "runId": "<run-id>", "status": "accepted" }
}
```

**Agent Event Frame:**

```json
{
  "type": "event",
  "event": "agent",
  "payload": {
    "runId": "<run-id>",
    "seq": 1,
    "stream": "assistant|tool|lifecycle|error",
    "ts": 1234567890,
    "data": { ... }
  }
}
```

### API Surface

```typescript
interface GatewayClient {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // RPC call, returns response payload
  request(method: string, params: unknown): Promise<unknown>;

  // Subscribe to agent events by runId
  subscribe(runId: string, callback: (event: AgentEvent) => void): void;
  unsubscribe(runId: string): void;
}

interface AgentEvent {
  runId: string;
  seq: number;
  stream: string;   // "assistant" | "tool" | "lifecycle" | "error"
  ts: number;
  data: Record<string, unknown>;
}
```

## Module 2: Task Dispatch

**Files modified:**
- `src/app/api/tasks/route.ts`
- `prisma/schema.prisma` (add `runId` field)

### Flow

1. Client sends `POST /api/tasks` with `{ title, description, workspaceId, assignedAgentId }`
2. Create task record in DB (status: `thinking` if agent assigned)
3. If agent assigned, call Gateway:
   ```
   gatewayClient.request("agent", {
     message: `${task.title}\n\n${task.description}`,
     sessionKey: `sk:global:syncclaw:${task.id}`,
     idempotencyKey: task.id
   })
   ```
4. Save returned `runId` to task record
5. Return 201 with task data

### Database Change

```prisma
model Task {
  // ... existing fields
  runId  String?   // OpenClaw Gateway run ID
}
```

### Key Mappings

| SyncClaw           | OpenClaw Gateway        |
|--------------------|-------------------------|
| task.id            | idempotencyKey          |
| title + description| message                 |
| unique per task    | sessionKey              |
| assignedAgentId    | agentId (optional)      |
| task.runId (new)   | response.payload.runId  |

## Module 3: Status Sync (SSE Stream)

**File modified:** `src/app/api/tasks/[id]/stream/route.ts`

Replace mock engine with Gateway event subscription.

### Event Mapping

| OpenClaw Agent Event                        | SyncClaw SSE Event                        |
|---------------------------------------------|-------------------------------------------|
| stream: "lifecycle", data has started       | status_change → thinking                  |
| stream: "assistant", data.delta             | thought (type: thinking)                  |
| stream: "tool", data has tool start         | thought (type: tool_use, toolName)        |
| stream: "tool", data has tool result        | thought (type: result)                    |
| stream: "error"                             | thought (type: error)                     |
| Final res frame (status: "ok")              | result + status_change → done             |
| Final res frame (status: "error")           | thought (error) + status_change → blocked |

### Flow

1. Client connects to `GET /api/tasks/{id}/stream`
2. Look up task's `runId` from DB
3. Subscribe to Gateway events: `gatewayClient.subscribe(runId, callback)`
4. In callback:
   - Translate OpenClaw event → SyncClaw SSE event
   - Update DB (task status, thought entries, results)
   - Push SSE event to browser
5. On stream close: `gatewayClient.unsubscribe(runId)`
6. Heartbeat every 15s

## Module 4: Configuration & Error Handling

### Environment Variables

```env
# .env
DATABASE_URL="file:./dev.db"
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_GATEWAY_TOKEN=
```

### Error Handling

| Scenario                    | Behavior                                              |
|-----------------------------|-------------------------------------------------------|
| Gateway connection failed   | Task created as `todo` (not dispatched), log warning   |
| Gateway returns error       | Task status → `blocked`, record error in ThoughtEntry |
| WebSocket disconnected      | Auto-reconnect (exponential backoff, max 30s)          |
| Agent execution error       | Task status → `blocked`, record error details          |
| Reconnect after disconnect  | Re-subscribe active runIds                            |

### Not in Phase 1

- User intervention flow (exec.approval) → Phase 2
- Real-time thought stream display (assistant delta merging) → Phase 2
- Agent list sync from Gateway → Phase 2
- Mock/real mode switch toggle → Direct replacement for now

## File Changes Summary

| File | Action |
|------|--------|
| `src/lib/gateway-client.ts` | **New** - WebSocket client singleton |
| `src/app/api/tasks/route.ts` | **Modify** - Add Gateway dispatch |
| `src/app/api/tasks/[id]/stream/route.ts` | **Modify** - Replace mock with Gateway events |
| `prisma/schema.prisma` | **Modify** - Add `runId` to Task |
| `.env` | **Modify** - Add Gateway env vars |
