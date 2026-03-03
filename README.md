# SyncClaw

An executable intelligent task console that bridges human task management with autonomous AI agent execution.

SyncClaw provides a unified interface where you can assign tasks to AI agents, observe their reasoning process in real-time via thought streams, and maintain full visibility into automated workflows — all within a kanban-style board.

## Features

### Kanban Task Board

Three-column board (Todo → Acting → Done) with drag-and-drop support. Tasks are organized by workspace and can be assigned to agents for autonomous execution.

### Real-Time Thought Stream

Watch agents think in real-time. When a task is dispatched to an agent, the inspector panel streams thought entries via SSE:

- **Thinking** — agent reasoning process (collapsible)
- **Tool Use** — API calls and data retrieval with tool names
- **Results** — outcomes rendered in Markdown
- **Errors** — execution errors with details

Task status automatically syncs as agents progress through execution.

### Agent Hub with Pixel Office

A pixel-art office visualization (powered by Phaser 3) showing agent status at a glance:

| Zone | Status |
|------|--------|
| Work desks | Busy (executing tasks) |
| Break area | Idle (waiting) |
| Server room | Error state |
| Door | Offline |

Agents appear as animated sprites that move between zones based on their status. Click a sprite to highlight its card, or click a card to locate the agent in the office.

## Architecture

```
Browser (Next.js App Router)
    │
    ├── HTTP/SSE ──→ Next.js API Routes
    │                    │
    │                    └── WebSocket ──→ OpenClaw Gateway
    │                                     (Agent Orchestration)
    └── Phaser Canvas (Pixel Office)
```

- **Frontend**: Next.js 16 with React 19, Tailwind CSS 4, shadcn/ui
- **Database**: Prisma 7 + SQLite (via better-sqlite3)
- **Real-time**: SSE for browser, WebSocket for Gateway connection
- **Visualization**: Phaser 3 game engine for pixel-art rendering
- **Drag & Drop**: @dnd-kit
- **Testing**: Playwright (E2E)

## Installation

### Option 1: Via OpenClaw Agent (Recommended)

If you already have [OpenClaw](https://github.com/openclaw/openclaw) running, tell the agent:

```
学习skill: npx skills add lxcong/synclaw
```

The agent will install and configure SyncClaw automatically.

### Option 2: Manual Setup

#### Prerequisites

- Node.js 20+
- An [OpenClaw Gateway](https://github.com/openclaw/openclaw) instance (for agent execution)

#### Clone and Install

```bash
git clone https://github.com/lxcong/synclaw.git
cd synclaw

npm install

cp .env.example .env
# Edit .env with your Gateway URL and token

npm run db:generate
npm run db:push
npm run db:seed      # Optional: populate sample data

npm run build
```

#### Install CLI

```bash
npm install -g synclaw
```

#### Start

```bash
synclaw start           # Production mode (requires npm run build first)
synclaw start --dev     # Development mode
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `OPENCLAW_GATEWAY_URL` | OpenClaw Gateway WebSocket endpoint | `ws://localhost:18789` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway authentication token | — |

## CLI

Install the CLI globally to manage the SyncClaw service:

```bash
npm install -g synclaw
```

Run all commands from the project directory:

```bash
synclaw start [-p port] [-H host] [-d]   # Start server (background)
synclaw stop [-t timeout]                 # Graceful stop (SIGTERM → SIGKILL)
synclaw restart                           # Stop then start
synclaw status                            # PID, uptime, port, Gateway status
synclaw logs [-f] [-n lines]              # View / follow logs
```

### Scripts

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run db:studio    # Prisma Studio GUI
```

## Data Model

```
Workspace ──┐
             └── Task ──┬── ThoughtEntry[]
                         └── TaskResult[]
Agent ───────────┘
```

- **Workspace** — organizes tasks by context (e.g., Customer Service, Finance)
- **Agent** — autonomous AI entity with status tracking (idle/busy/offline/error)
- **Task** — unit of work with lifecycle: `todo` → `acting` → `done`
- **ThoughtEntry** — real-time agent reasoning log (thinking/tool_use/result/error)
- **TaskResult** — structured output from completed tasks (text/file/link)

## Acknowledgments

Pixel art assets by [LimeZu](https://limezu.itch.io/).

## License

MIT
