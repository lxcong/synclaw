**English** | [中文](./README.zh-CN.md)

# SyncClaw

An intelligent task console that bridges human task management with autonomous AI agent execution — a kanban board where tasks are dispatched to AI agents with real-time thought streaming.

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

## Features

- **Kanban Task Board** — Three-column board (Todo → Acting → Done) with drag-and-drop. Assign tasks to agents for autonomous execution.
- **Real-Time Thought Stream** — Watch agents think. The inspector panel streams reasoning, tool calls, results, and errors via SSE as agents work.
- **Pixel Office** — A Phaser 3 pixel-art office where agent sprites move between zones (desks, break area, server room) based on their status. Click to interact.
- **Workspaces** — Organize tasks by context (e.g., Customer Service, Finance) with custom icons and descriptions.
- **Agent Management** — Track agent status, capabilities, and heartbeat. Auto-syncs from the OpenClaw Gateway.

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

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, @dnd-kit |
| Database | Prisma 7 + SQLite (better-sqlite3) |
| Real-time | SSE (browser), WebSocket (Gateway) |
| Visualization | Phaser 3 |
| Testing | Playwright |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- An [OpenClaw Gateway](https://github.com/openclaw/openclaw) instance (for agent execution)

### Option 1: Via OpenClaw Agent (Recommended)

If you already have [OpenClaw](https://github.com/openclaw/openclaw) running, tell the agent:

```
npx skills add lxcong/synclaw
```

The agent will install and configure SyncClaw automatically.

### Option 2: Manual Setup

```bash
git clone https://github.com/lxcong/synclaw.git
cd synclaw
npm install
```

Configure environment:

```bash
cp .env.example .env
# Edit .env with your Gateway URL and token
```

Initialize database and build:

```bash
npm run db:generate
npm run db:push
npm run db:seed      # Optional: populate sample data
npm run build
```

Install the CLI globally:

```bash
npm install -g synclaw
```

Start the server:

```bash
synclaw start
```

Open [http://localhost:3000](http://localhost:3000).

> [!TIP]
> Use `synclaw start --dev` for development mode with hot reload.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `OPENCLAW_GATEWAY_URL` | OpenClaw Gateway WebSocket endpoint | `ws://localhost:18789` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway authentication token | — |

## CLI Reference

The `synclaw` CLI manages the SyncClaw service as a background process.

```bash
synclaw start [-p port] [-H host]     # Start server in background
synclaw start --dev                   # Start in development mode
synclaw stop [-t timeout]             # Graceful stop (SIGTERM → SIGKILL)
synclaw restart                       # Stop then start
synclaw status                        # PID, uptime, port, Gateway status
synclaw logs [-f] [-n lines]          # View or follow logs
```

### npm Scripts

```bash
npm run dev          # Dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run db:studio    # Open Prisma Studio GUI
```

## Data Model

```
Workspace ──┐
             └── Task ──┬── ThoughtEntry[]
                         └── TaskResult[]
Agent ───────────┘
```

| Entity | Description |
|--------|-------------|
| **Workspace** | Groups tasks by context |
| **Agent** | Autonomous AI entity with status tracking (idle / busy / offline / error) |
| **Task** | Unit of work with lifecycle: `todo` → `acting` → `done` |
| **ThoughtEntry** | Real-time agent reasoning log (thinking / tool_use / result / error) |
| **TaskResult** | Structured output from completed tasks (text / file / link) |

## Acknowledgments

Pixel art assets by [LimeZu](https://limezu.itch.io/).
