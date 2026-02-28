# SyncClaw v2 MVP Design

## Product Vision

SyncClaw is an "executable intelligent task console" that deeply integrates traditional TODO lists with AI Agent execution. Users assign tasks, observe Agent reasoning in real-time, and intervene when needed.

## MVP Scope

**Core**: Task kanban board + real-time Agent thought stream
**Data**: Mock Agent engine (no real Agent service yet)
**Focus**: UI experience and real-time responsiveness

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Drag & Drop | dnd-kit |
| Database | Prisma 6 + SQLite |
| Realtime | SSE (Server-Sent Events) |
| Package Manager | npm |

## Architecture

Single Next.js fullstack application:

```
Next.js App
├── /app (pages)          ← RSC + Client Components
├── /app/api              ← REST API + SSE endpoints
├── /lib/mock-engine      ← Mock Agent execution engine
└── Prisma + SQLite       ← Data persistence
```

## Data Model

### Workspace
- id (cuid), name, icon, description
- Has many Tasks

### Agent
- id (cuid), name, description, avatar, capabilities (JSON)
- status: idle | busy | offline | error
- lastHeartbeat (DateTime)
- Has many Tasks, ThoughtEntries

### Task
- id (cuid), title, description
- status: todo | thinking | acting | blocked | done
- Belongs to Workspace, optionally assigned to Agent
- Has many ThoughtEntries, TaskResults, InterventionRequests

### ThoughtEntry
- id (cuid), type: thinking | tool_use | result | error
- content (string), toolName (optional)
- timestamp (DateTime)
- Belongs to Task and Agent

### InterventionRequest
- id (cuid), question (string), options (JSON)
- response (string, optional), resolvedAt (DateTime, optional)
- Belongs to Task

### TaskResult
- id (cuid), type (string), title, content, url (optional)
- Belongs to Task

## Page Structure & Routes

```
/                           ← Redirect to first workspace
/workspace/[id]             ← Workspace kanban board
/workspace/[id]/task/[tid]  ← Task detail (slide-over modal)
/agents                     ← Agent Hub
```

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  SyncClaw Logo          [Agent Hub]  [+ New Task]       │
├──────────┬──────────────────────────────────────────────┤
│ Workspace│    Kanban Board (5 columns)                  │
│ List     │    ┌──────┬──────┬──────┬──────┬──────┐     │
│          │    │ Todo │Think │ Act  │Block │ Done │     │
│ · CS     │    │      │  ⚡  │  ⚡  │  🔔  │      │     │
│ · Life   │    │ Card │ Card │ Card │ Card │ Card │     │
│ · Finance│    └──────┴──────┴──────┴──────┴──────┘     │
├──────────┴──────────────────────────────────────────────┤
│  Task Inspector (slide-over panel)                      │
│  ┌─────────────────┬───────────────────────┐            │
│  │ Thought Stream  │ Results / Intervention│            │
│  │ ● Querying...   │ [Draft email preview] │            │
│  │ ● Found 3 items │ ┌──────────────┐      │            │
│  │                 │ │ Allow?  [Y][N]│      │            │
│  └─────────────────┴───────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

## API Design

### REST Endpoints

```
GET    /api/workspaces              — List workspaces
POST   /api/workspaces              — Create workspace
GET    /api/workspaces/[id]/tasks   — List tasks in workspace
POST   /api/tasks                   — Create task
PATCH  /api/tasks/[id]              — Update task (status, agent assignment)
DELETE /api/tasks/[id]              — Delete task
GET    /api/tasks/[id]/thoughts     — Get thought history
POST   /api/tasks/[id]/intervene    — Respond to intervention
GET    /api/agents                  — List agents
```

### SSE Endpoint

```
GET /api/tasks/[id]/stream          — Real-time task event stream
```

Event types:
```typescript
type SSEEvent =
  | { type: 'status_change'; status: TaskStatus }
  | { type: 'thought'; entry: ThoughtEntry }
  | { type: 'intervention'; request: InterventionRequest }
  | { type: 'result'; result: TaskResult }
  | { type: 'heartbeat' }
```

## Mock Engine

Located at `src/lib/mock-engine.ts`:
- Starts a simulated execution sequence when task is assigned to an Agent
- Pushes events in order: thinking → tool_use → result
- Randomly triggers intervention requests at certain steps
- Delivers events through SSE endpoint

## Component Architecture

```
RootLayout
└── TopBar
    └── WorkspaceLayout
        ├── Sidebar
        │   ├── WorkspaceList
        │   └── CreateWorkspaceButton
        └── TaskBoard
            ├── KanbanColumn (x5)
            │   └── TaskCard (draggable)
            │       ├── StatusBadge (with pulse animation)
            │       └── AgentBadge
            └── TaskInspector (slide-over)
                ├── ThoughtStream
                │   └── ThoughtEntry
                ├── ResultPreview
                └── InterventionPanel
```

## State Management

No external state library. React-native approach:
- **Server State**: Next.js Server Components + fetch
- **Client State**: useState / useReducer for board state
- **Realtime**: Custom `useTaskStream(taskId)` hook wrapping SSE
- **Drag**: dnd-kit built-in state

## Visual Style

- Dark theme, Linear-inspired minimal aesthetic
- Status colors:
  - Todo: neutral gray
  - Thinking: purple (pulse animation)
  - Acting: blue (pulse animation)
  - Blocked: orange (highlighted, blinking)
  - Done: green
- Font: Inter (latin) + system Chinese fonts
- Cards: rounded corners, subtle shadow, hover lift effect
