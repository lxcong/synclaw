# OpenClaw Gateway Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect SyncClaw v2 to OpenClaw Gateway so tasks dispatch to real agents and status syncs back in real-time.

**Architecture:** Server-side singleton WebSocket client in Next.js connects to OpenClaw Gateway (ws://localhost:18789). Task creation triggers `agent` RPC; `agent` events stream back through existing SSE to browser.

**Tech Stack:** TypeScript, Next.js 16 (App Router), ws (WebSocket), Prisma + SQLite, SSE

**Design doc:** `docs/plans/2026-03-01-openclaw-gateway-integration-design.md`

---

### Task 0: Merge MVP code into this branch

**Files:** All files from `worktree-init` branch

**Step 1: Merge the init branch**

```bash
git merge worktree-init --no-edit
```

**Step 2: Verify merge**

```bash
ls src/lib/mock-engine.ts  # should exist
ls src/app/api/tasks/route.ts  # should exist
```

**Step 3: Install dependencies and generate Prisma**

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
```

**Step 4: Verify dev server starts**

```bash
npm run dev
# Visit http://localhost:3000, verify kanban loads
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: merge MVP from worktree-init"
```

---

### Task 1: Install ws dependency

**Files:**
- Modify: `package.json`

**Step 1: Install ws and types**

```bash
npm install ws
npm install -D @types/ws
```

**Step 2: Verify installation**

```bash
node -e "require('ws'); console.log('ws ok')"
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ws dependency for Gateway client"
```

---

### Task 2: Add runId field to Task model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add runId to Task model**

In `prisma/schema.prisma`, add `runId` field to the `Task` model:

```prisma
model Task {
  id              String              @id @default(cuid())
  title           String
  description     String?
  status          String              @default("todo") // todo | thinking | acting | blocked | done
  runId           String?             // OpenClaw Gateway run ID
  workspace       Workspace           @relation(fields: [workspaceId], references: [id])
  workspaceId     String
  assignedAgent   Agent?              @relation(fields: [assignedAgentId], references: [id])
  assignedAgentId String?
  thoughts        ThoughtEntry[]
  results         TaskResult[]
  interventions   InterventionRequest[]
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
}
```

**Step 2: Regenerate Prisma client and push schema**

```bash
npx prisma generate
npx prisma db push
```

**Step 3: Verify the field exists**

```bash
npx tsx -e "
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client.js';
const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });
const task = await prisma.task.findFirst();
console.log('runId field exists:', 'runId' in (task ?? {}));
await prisma.\$disconnect();
"
```

Expected: `runId field exists: true`

**Step 4: Commit**

```bash
git add prisma/schema.prisma generated/
git commit -m "feat: add runId field to Task model for Gateway tracking"
```

---

### Task 3: Add Gateway environment variables

**Files:**
- Modify: `.env`

**Step 1: Add env vars**

Append to `.env`:

```env
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_GATEWAY_TOKEN=
```

**Step 2: Commit**

```bash
git add .env
git commit -m "chore: add OpenClaw Gateway env vars"
```

---

### Task 4: Create Gateway WebSocket client

**Files:**
- Create: `src/lib/gateway-client.ts`

This is the core module. It must handle:
1. WebSocket connection + handshake (ConnectParams → hello-ok)
2. RPC requests (send req frame → await matching res frame)
3. Event subscription by runId
4. Auto-reconnect with exponential backoff
5. Completion callback for final res frames

**Step 1: Write the Gateway client**

Create `src/lib/gateway-client.ts`:

```typescript
import { randomUUID } from "crypto";
import WebSocket from "ws";

// --- Types ---

export interface AgentEvent {
  runId: string;
  seq: number;
  stream: string; // "lifecycle" | "tool" | "assistant" | "error"
  ts: number;
  data: Record<string, unknown>;
}

interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
}

type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

type PendingRequest = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type EventSubscriber = {
  onEvent: (event: AgentEvent) => void;
  onComplete?: (payload: unknown) => void;
  onError?: (error: { code: string; message: string }) => void;
};

// --- Client ---

class OpenClawGatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private connected = false;
  private connecting = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private subscribers = new Map<string, EventSubscriber>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((err: Error) => void) | null = null;

  constructor() {
    this.url = process.env.OPENCLAW_GATEWAY_URL || "ws://localhost:18789";
    this.token = process.env.OPENCLAW_GATEWAY_TOKEN || "";
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connecting) return;
    this.connecting = true;

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.createConnection();
    });
  }

  private createConnection() {
    try {
      const headers: Record<string, string> = {};
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }
      this.ws = new WebSocket(this.url, { headers });

      this.ws.on("open", () => {
        this.sendHandshake();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on("close", () => {
        this.handleDisconnect();
      });

      this.ws.on("error", (err: Error) => {
        console.error("[gateway] WebSocket error:", err.message);
        if (this.connecting && this.connectReject) {
          this.connecting = false;
          this.connectReject(err);
          this.connectResolve = null;
          this.connectReject = null;
        }
      });
    } catch (err) {
      this.connecting = false;
      if (this.connectReject) {
        this.connectReject(err instanceof Error ? err : new Error(String(err)));
        this.connectResolve = null;
        this.connectReject = null;
      }
    }
  }

  private sendHandshake() {
    const connectParams = {
      minProtocol: 1,
      maxProtocol: 1,
      client: {
        id: "gateway-client",
        displayName: "SyncClaw",
        version: "0.1.0",
        platform: "node",
        mode: "backend",
      },
      role: "operator",
      scopes: ["admin"],
      ...(this.token ? { auth: { token: this.token } } : {}),
    };
    this.ws?.send(JSON.stringify(connectParams));
  }

  private handleMessage(raw: WebSocket.Data) {
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Handle hello-ok (handshake response)
    if ("type" in frame && (frame as Record<string, unknown>).type === "hello-ok") {
      this.connected = true;
      this.connecting = false;
      this.reconnectAttempts = 0;
      console.log("[gateway] Connected to OpenClaw Gateway");
      if (this.connectResolve) {
        this.connectResolve();
        this.connectResolve = null;
        this.connectReject = null;
      }
      return;
    }

    // Handle response frames
    if (frame.type === "res") {
      const res = frame as ResponseFrame;
      // Check if this is a final agent response (has runId in payload)
      const payload = res.payload as Record<string, unknown> | undefined;
      const runId = payload?.runId as string | undefined;
      if (runId && payload?.status && payload.status !== "accepted") {
        // This is the final response for an agent run
        const sub = this.subscribers.get(runId);
        if (sub) {
          if (res.ok) {
            sub.onComplete?.(res.payload);
          } else {
            sub.onError?.(res.error ?? { code: "UNKNOWN", message: "Unknown error" });
          }
        }
      }

      // Resolve pending RPC request
      const pending = this.pendingRequests.get(res.id);
      if (pending) {
        this.pendingRequests.delete(res.id);
        clearTimeout(pending.timer);
        if (res.ok) {
          pending.resolve(res.payload);
        } else {
          pending.reject(
            new Error(res.error?.message ?? "Gateway request failed")
          );
        }
      }
      return;
    }

    // Handle event frames
    if (frame.type === "event") {
      const evt = frame as EventFrame;
      if (evt.event === "agent" && evt.payload) {
        const agentEvt = evt.payload as AgentEvent;
        const sub = this.subscribers.get(agentEvt.runId);
        if (sub) {
          sub.onEvent(agentEvt);
        }
      }
      return;
    }
  }

  private handleDisconnect() {
    const wasConnected = this.connected;
    this.connected = false;
    this.connecting = false;

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Gateway disconnected"));
      this.pendingRequests.delete(id);
    }

    if (wasConnected) {
      console.warn("[gateway] Disconnected, scheduling reconnect...");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    console.log(`[gateway] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connecting = true;
      this.connectResolve = () => {
        console.log("[gateway] Reconnected successfully");
      };
      this.connectReject = (err) => {
        console.error("[gateway] Reconnect failed:", err.message);
        this.scheduleReconnect();
      };
      this.createConnection();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.connecting = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async request(method: string, params: unknown, timeoutMs = 30000): Promise<unknown> {
    if (!this.connected || !this.ws) {
      throw new Error("Gateway not connected");
    }

    const id = randomUUID();
    const frame: RequestFrame = { type: "req", id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Gateway request timed out: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  subscribe(runId: string, subscriber: EventSubscriber) {
    this.subscribers.set(runId, subscriber);
  }

  unsubscribe(runId: string) {
    this.subscribers.delete(runId);
  }
}

// --- Singleton ---

const globalForGateway = globalThis as unknown as {
  gatewayClient: OpenClawGatewayClient | undefined;
};

export const gatewayClient =
  globalForGateway.gatewayClient ?? new OpenClawGatewayClient();

if (process.env.NODE_ENV !== "production") {
  globalForGateway.gatewayClient = gatewayClient;
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/lib/gateway-client.ts 2>&1 | head -20
```

Expected: No errors (or only unrelated project-wide errors).

**Step 3: Commit**

```bash
git add src/lib/gateway-client.ts
git commit -m "feat: add OpenClaw Gateway WebSocket client"
```

---

### Task 5: Modify task creation to dispatch to Gateway

**Files:**
- Modify: `src/app/api/tasks/route.ts`

**Step 1: Update POST handler to dispatch to Gateway**

Replace the full content of `src/app/api/tasks/route.ts`:

```typescript
import { prisma } from "@/lib/db";
import { gatewayClient } from "@/lib/gateway-client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      workspaceId: body.workspaceId,
      assignedAgentId: body.assignedAgentId,
      status: body.assignedAgentId ? "thinking" : "todo",
    },
    include: { assignedAgent: true },
  });

  // Dispatch to Gateway if agent is assigned
  if (task.assignedAgentId && gatewayClient.isConnected()) {
    try {
      const message = task.description
        ? `${task.title}\n\n${task.description}`
        : task.title;

      const result = await gatewayClient.request("agent", {
        message,
        sessionKey: `sk:global:syncclaw:${task.id}`,
        idempotencyKey: task.id,
      }) as { runId: string };

      await prisma.task.update({
        where: { id: task.id },
        data: { runId: result.runId },
      });

      return NextResponse.json({ ...task, runId: result.runId }, { status: 201 });
    } catch (err) {
      console.error("[gateway] Failed to dispatch task:", err);
      // Task still created, just not dispatched — fallback to todo
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "todo" },
      });
      return NextResponse.json({ ...task, status: "todo" }, { status: 201 });
    }
  }

  return NextResponse.json(task, { status: 201 });
}
```

**Step 2: Verify no syntax errors**

```bash
npx tsc --noEmit 2>&1 | grep "tasks/route" | head -5
```

Expected: No errors for this file.

**Step 3: Commit**

```bash
git add src/app/api/tasks/route.ts
git commit -m "feat: dispatch tasks to OpenClaw Gateway on creation"
```

---

### Task 6: Rewrite SSE stream to use Gateway events

**Files:**
- Modify: `src/app/api/tasks/[id]/stream/route.ts`

This replaces the mock engine with real Gateway event subscription.

**Step 1: Rewrite the stream route**

Replace the full content of `src/app/api/tasks/[id]/stream/route.ts`:

```typescript
import { prisma } from "@/lib/db";
import { gatewayClient, type AgentEvent } from "@/lib/gateway-client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedAgent: true },
  });

  if (!task) {
    return new Response("Task not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  // If no agent assigned or no runId, return current status and close
  if (!task.assignedAgentId || !task.runId) {
    const simpleStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: status_change\ndata: ${JSON.stringify({ status: task.status })}\n\n`
          )
        );
        controller.close();
      },
    });
    return new Response(simpleStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // If task is already done, return status and close
  if (task.status === "done") {
    const simpleStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: status_change\ndata: ${JSON.stringify({ status: "done" })}\n\n`
          )
        );
        controller.close();
      },
    });
    return new Response(simpleStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const runId = task.runId;
  const agentId = task.assignedAgentId;
  let cancelled = false;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: unknown) {
        if (cancelled) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream may be closed
        }
      }

      // Heartbeat
      const heartbeatInterval = setInterval(() => {
        if (cancelled) {
          clearInterval(heartbeatInterval);
          return;
        }
        send("heartbeat", { timestamp: Date.now() });
      }, 15000);

      // Subscribe to Gateway events for this runId
      gatewayClient.subscribe(runId, {
        onEvent: async (evt: AgentEvent) => {
          if (cancelled) return;

          try {
            await handleAgentEvent(evt, taskId, agentId, send);
          } catch (err) {
            console.error("[stream] Error handling agent event:", err);
          }
        },
        onComplete: async (payload: unknown) => {
          if (cancelled) return;

          try {
            const p = payload as Record<string, unknown>;
            const resultText =
              typeof p.result === "string"
                ? p.result
                : typeof p.summary === "string"
                  ? p.summary
                  : "Task completed";

            // Save result to DB
            const result = await prisma.taskResult.create({
              data: {
                taskId,
                type: "text",
                title: "Execution Result",
                content: resultText,
              },
            });
            send("result", result);

            // Update status to done
            await prisma.task.update({
              where: { id: taskId },
              data: { status: "done" },
            });
            send("status_change", { status: "done" });
          } catch (err) {
            console.error("[stream] Error handling completion:", err);
          }

          // Cleanup
          clearInterval(heartbeatInterval);
          gatewayClient.unsubscribe(runId);
          if (!cancelled) controller.close();
        },
        onError: async (error: { code: string; message: string }) => {
          if (cancelled) return;

          try {
            // Record error as thought
            const thought = await prisma.thoughtEntry.create({
              data: {
                taskId,
                agentId,
                type: "error",
                content: error.message,
              },
            });
            send("thought", thought);

            // Update status to blocked
            await prisma.task.update({
              where: { id: taskId },
              data: { status: "blocked" },
            });
            send("status_change", { status: "blocked" });
          } catch (err) {
            console.error("[stream] Error handling error event:", err);
          }

          clearInterval(heartbeatInterval);
          gatewayClient.unsubscribe(runId);
          if (!cancelled) controller.close();
        },
      });
    },
    cancel() {
      cancelled = true;
      gatewayClient.unsubscribe(runId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Translate an OpenClaw agent event into SyncClaw SSE events.
 *
 * OpenClaw event streams:
 * - lifecycle: { phase: "start"|"end"|"error" }
 * - assistant: { text, delta }
 * - tool:      { phase: "start"|"update"|"result", name, args?, result? }
 * - error:     { message }
 */
async function handleAgentEvent(
  evt: AgentEvent,
  taskId: string,
  agentId: string,
  send: (event: string, data: unknown) => void
) {
  const { stream, data } = evt;

  switch (stream) {
    case "lifecycle": {
      const phase = data.phase as string;
      if (phase === "start") {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "thinking" },
        });
        send("status_change", { status: "thinking" });
      } else if (phase === "error") {
        const errorMsg = (data.error as string) || "Agent execution failed";
        const thought = await prisma.thoughtEntry.create({
          data: { taskId, agentId, type: "error", content: errorMsg },
        });
        send("thought", thought);
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "blocked" },
        });
        send("status_change", { status: "blocked" });
      }
      break;
    }

    case "assistant": {
      const delta = (data.delta as string) || (data.text as string) || "";
      if (delta) {
        const thought = await prisma.thoughtEntry.create({
          data: { taskId, agentId, type: "thinking", content: delta },
        });
        send("thought", thought);
      }
      break;
    }

    case "tool": {
      const phase = data.phase as string;
      const toolName = (data.name as string) || "unknown";

      if (phase === "start") {
        // Switch to acting status when tools start
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "acting" },
        });
        send("status_change", { status: "acting" });

        const argsStr = data.args
          ? JSON.stringify(data.args).slice(0, 200)
          : "";
        const thought = await prisma.thoughtEntry.create({
          data: {
            taskId,
            agentId,
            type: "tool_use",
            content: `Calling ${toolName}${argsStr ? `: ${argsStr}` : ""}`,
            toolName,
          },
        });
        send("thought", thought);
      } else if (phase === "result") {
        const resultText =
          typeof data.result === "string"
            ? data.result
            : JSON.stringify(data.result ?? "").slice(0, 500);
        const isError = data.isError === true;
        const thought = await prisma.thoughtEntry.create({
          data: {
            taskId,
            agentId,
            type: isError ? "error" : "result",
            content: `${toolName}: ${resultText}`,
            toolName,
          },
        });
        send("thought", thought);
      }
      // Ignore "update" phase for now (Phase 2: streaming tool output)
      break;
    }

    case "error": {
      const errorMsg = (data.message as string) || "Unknown error";
      const thought = await prisma.thoughtEntry.create({
        data: { taskId, agentId, type: "error", content: errorMsg },
      });
      send("thought", thought);
      break;
    }
  }
}
```

**Step 2: Verify no syntax errors**

```bash
npx tsc --noEmit 2>&1 | grep "stream/route" | head -5
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/tasks/[id]/stream/route.ts
git commit -m "feat: replace mock engine with OpenClaw Gateway event stream"
```

---

### Task 7: Add Gateway auto-connect on server startup

**Files:**
- Create: `src/lib/gateway-init.ts`
- Modify: `src/app/layout.tsx`

The Gateway client should connect when the Next.js server starts. We use a server-side init module imported in the root layout.

**Step 1: Create the init module**

Create `src/lib/gateway-init.ts`:

```typescript
import { gatewayClient } from "./gateway-client";

let initialized = false;

export async function initGateway() {
  if (initialized) return;
  initialized = true;

  try {
    await gatewayClient.connect();
    console.log("[gateway] Auto-connected to OpenClaw Gateway");
  } catch (err) {
    console.warn(
      "[gateway] Failed to auto-connect (will retry on next request):",
      err instanceof Error ? err.message : err
    );
  }
}

// Auto-init on module load (server-side only)
if (typeof window === "undefined") {
  initGateway();
}
```

**Step 2: Import in root layout to trigger server-side init**

Add this import at the top of `src/app/layout.tsx`:

```typescript
import "@/lib/gateway-init";
```

This line goes before other imports. It runs only on the server side, triggering the Gateway connection when Next.js loads the layout module.

**Step 3: Verify the import works**

```bash
npx tsc --noEmit 2>&1 | grep "gateway-init\|layout" | head -5
```

**Step 4: Commit**

```bash
git add src/lib/gateway-init.ts src/app/layout.tsx
git commit -m "feat: auto-connect to Gateway on server startup"
```

---

### Task 8: Add Gateway status API endpoint

**Files:**
- Create: `src/app/api/gateway/status/route.ts`

Provides a simple endpoint for the frontend to check Gateway connectivity.

**Step 1: Create the status endpoint**

Create `src/app/api/gateway/status/route.ts`:

```typescript
import { gatewayClient } from "@/lib/gateway-client";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    connected: gatewayClient.isConnected(),
    url: process.env.OPENCLAW_GATEWAY_URL || "ws://localhost:18789",
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/gateway/status/route.ts
git commit -m "feat: add Gateway status API endpoint"
```

---

### Task 9: Integration test — end-to-end task dispatch

**Files:** None (manual verification)

**Step 1: Ensure OpenClaw Gateway is running**

```bash
# In a separate terminal, verify Gateway is up
curl -s http://localhost:18789/ | head -5
```

**Step 2: Start SyncClaw dev server**

```bash
npm run dev
```

**Step 3: Check Gateway status**

```bash
curl -s http://localhost:3000/api/gateway/status | jq .
```

Expected: `{ "connected": true, "url": "ws://localhost:18789" }`

**Step 4: Create a task via API**

```bash
# First get a workspace ID
WORKSPACE_ID=$(curl -s http://localhost:3000/api/workspaces | jq -r '.[0].id')

# Get an agent ID
AGENT_ID=$(curl -s http://localhost:3000/api/agents | jq -r '.[0].id')

# Create a task assigned to the agent
curl -s -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test OpenClaw integration\",
    \"description\": \"This is a test task dispatched to OpenClaw Gateway.\",
    \"workspaceId\": \"$WORKSPACE_ID\",
    \"assignedAgentId\": \"$AGENT_ID\"
  }" | jq .
```

Expected: Response includes `runId` field (non-null) and status is `thinking`.

**Step 5: Monitor the SSE stream**

```bash
# Use the task ID from step 4
TASK_ID="<task-id-from-step-4>"
curl -N -s http://localhost:3000/api/tasks/$TASK_ID/stream
```

Expected: SSE events flow in (status_change, thought, result events from the real agent).

**Step 6: Commit any fixes if needed, then tag as done**

```bash
git add -A
git commit -m "test: verify OpenClaw Gateway integration end-to-end"
```
