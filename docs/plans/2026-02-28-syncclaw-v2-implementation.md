# SyncClaw v2 MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time AI task console MVP with kanban board, agent thought streaming, and user intervention — from scratch.

**Architecture:** Single Next.js 16 fullstack app with App Router. Prisma + SQLite for persistence. SSE for real-time updates. Mock engine simulates Agent execution. shadcn/ui + dnd-kit for UI.

**Tech Stack:** Next.js 16, TypeScript (strict), Tailwind CSS 4, shadcn/ui, dnd-kit, Prisma 6, SQLite, SSE

**Reference:** Design doc at `docs/plans/2026-02-28-syncclaw-v2-mvp-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `.env`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

**Step 1: Initialize Next.js project**

```bash
cd /home/lxcong/projects/synclaw_v2/.claude/worktrees/init
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --turbopack
```

If it prompts about existing files, allow overwrite. If create-next-app doesn't work in an existing directory, initialize manually:

```bash
npm init -y
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/react @types/react-dom @types/node eslint eslint-config-next tailwindcss @tailwindcss/postcss postcss
```

**Step 2: Configure path alias in tsconfig.json**

Ensure `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Set up PostCSS config**

`postcss.config.mjs`:
```js
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

**Step 4: Set up globals.css with dark theme**

`src/app/globals.css`:
```css
@import "tailwindcss";

:root {
  --background: #09090b;
  --foreground: #fafafa;
  --card: #18181b;
  --card-hover: #27272a;
  --border: #27272a;
  --border-hover: #3f3f46;
  --primary: #6366f1;
  --primary-hover: #818cf8;
  --muted: #71717a;
  --muted-foreground: #a1a1aa;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --thinking: #a78bfa;
  --acting: #3b82f6;
  --blocked: #f97316;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: "Inter", system-ui, -apple-system, sans-serif;
}
```

**Step 5: Create minimal layout and page**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SyncClaw - Intelligent Task Console",
  description: "Executable intelligent task console with AI agent integration",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function Home() {
  return <div className="flex h-screen items-center justify-center text-lg">SyncClaw v2</div>;
}
```

**Step 6: Create .env and .gitignore**

`.env`:
```
DATABASE_URL="file:./dev.db"
```

`.gitignore` — use standard Next.js gitignore plus:
```
node_modules/
.next/
*.db
*.db-journal
.env.local
```

**Step 7: Verify dev server starts**

```bash
npm run dev
```

Open http://localhost:3000, confirm "SyncClaw v2" renders on dark background.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 16 project with TypeScript and Tailwind CSS 4"
```

---

### Task 2: Install shadcn/ui and Core Dependencies

**Files:**
- Modify: `package.json`
- Create: `src/lib/utils.ts`
- Create: `components.json` (shadcn config)

**Step 1: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Zinc
- CSS variables: Yes

If the interactive CLI doesn't work, install manually:
```bash
npm install class-variance-authority clsx tailwind-merge lucide-react
```

Then create `src/lib/utils.ts`:
```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 2: Add shadcn/ui components we need**

```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add dialog
npx shadcn@latest add sheet
npx shadcn@latest add badge
npx shadcn@latest add scroll-area
npx shadcn@latest add textarea
npx shadcn@latest add select
npx shadcn@latest add separator
```

**Step 3: Install dnd-kit**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 4: Install Prisma**

```bash
npm install prisma @prisma/client
npm install -D tsx
```

**Step 5: Verify build still works**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: install shadcn/ui, dnd-kit, and Prisma dependencies"
```

---

### Task 3: Database Schema and Seed Data

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `prisma/seed.ts`

**Step 1: Write Prisma schema**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Workspace {
  id          String   @id @default(cuid())
  name        String
  icon        String   @default("📁")
  description String?
  tasks       Task[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Agent {
  id            String         @id @default(cuid())
  name          String
  description   String
  capabilities  String         // JSON array as string
  status        String         @default("idle") // idle | busy | offline | error
  avatarUrl     String?
  lastHeartbeat DateTime?
  tasks         Task[]
  thoughts      ThoughtEntry[]
  createdAt     DateTime       @default(now())
}

model Task {
  id              String              @id @default(cuid())
  title           String
  description     String?
  status          String              @default("todo") // todo | thinking | acting | blocked | done
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

model ThoughtEntry {
  id        String   @id @default(cuid())
  task      Task     @relation(fields: [taskId], references: [id])
  taskId    String
  agent     Agent    @relation(fields: [agentId], references: [id])
  agentId   String
  type      String   // thinking | tool_use | result | error
  content   String
  toolName  String?
  timestamp DateTime @default(now())
}

model TaskResult {
  id        String   @id @default(cuid())
  task      Task     @relation(fields: [taskId], references: [id])
  taskId    String
  type      String   // text | file | link | email_draft
  title     String
  content   String
  url       String?
  createdAt DateTime @default(now())
}

model InterventionRequest {
  id         String    @id @default(cuid())
  task       Task      @relation(fields: [taskId], references: [id])
  taskId     String
  question   String
  options    String?   // JSON array as string
  response   String?
  resolvedAt DateTime?
  createdAt  DateTime  @default(now())
}
```

**Step 2: Generate Prisma client and push schema**

```bash
npx prisma generate
npx prisma db push
```

**Step 3: Create Prisma client singleton**

`src/lib/db.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 4: Write seed script**

`prisma/seed.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.interventionRequest.deleteMany();
  await prisma.taskResult.deleteMany();
  await prisma.thoughtEntry.deleteMany();
  await prisma.task.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.workspace.deleteMany();

  // Create workspaces
  const csWorkspace = await prisma.workspace.create({
    data: { name: "公司客服", icon: "🎧", description: "客户服务相关任务" },
  });
  const lifeWorkspace = await prisma.workspace.create({
    data: { name: "个人生活", icon: "🏠", description: "个人事务管理" },
  });
  const finWorkspace = await prisma.workspace.create({
    data: { name: "财务自动化", icon: "💰", description: "财务流程自动化" },
  });

  // Create agents
  const csAgent = await prisma.agent.create({
    data: {
      name: "CS-Agent",
      description: "客服专员，擅长处理客户咨询、退款和投诉",
      capabilities: JSON.stringify(["查询订单", "退款处理", "邮件回复", "客户信息查询"]),
      status: "busy",
      lastHeartbeat: new Date(),
    },
  });
  const personalAgent = await prisma.agent.create({
    data: {
      name: "Life-Agent",
      description: "个人助理，管理日程、提醒和日常事务",
      capabilities: JSON.stringify(["日历管理", "提醒设置", "信息搜索", "文件整理"]),
      status: "idle",
      lastHeartbeat: new Date(),
    },
  });
  const finAgent = await prisma.agent.create({
    data: {
      name: "Fin-Agent",
      description: "财务助手，处理报表、对账和财务分析",
      capabilities: JSON.stringify(["报表生成", "数据分析", "对账核算", "预算管理"]),
      status: "idle",
      lastHeartbeat: new Date(),
    },
  });

  // Create tasks
  await prisma.task.create({
    data: {
      title: "处理张三的退款请求",
      description: "客户要求退还上月订单 #20241201 的费用",
      status: "acting",
      workspaceId: csWorkspace.id,
      assignedAgentId: csAgent.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "回复李四的咨询邮件",
      description: "关于产品升级方案的问题",
      status: "thinking",
      workspaceId: csWorkspace.id,
      assignedAgentId: csAgent.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "VVIP 客户退款超期审批",
      description: "政策显示已过退款期，但该用户是 VVIP",
      status: "blocked",
      workspaceId: csWorkspace.id,
      assignedAgentId: csAgent.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "更新客服话术模板",
      description: "根据最新产品线调整标准回复模板",
      status: "done",
      workspaceId: csWorkspace.id,
      assignedAgentId: csAgent.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "整理本月财务报表",
      description: "汇总 2 月份所有收支数据",
      status: "todo",
      workspaceId: finWorkspace.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "预约下周牙医",
      description: "周三或周四下午",
      status: "todo",
      workspaceId: lifeWorkspace.id,
    },
  });

  console.log("Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 5: Add seed script to package.json**

Add to `package.json` scripts:
```json
"db:generate": "prisma generate",
"db:push": "prisma db push",
"db:seed": "npx tsx prisma/seed.ts",
"db:studio": "prisma studio"
```

And add prisma config:
```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

**Step 6: Run seed**

```bash
npx tsx prisma/seed.ts
```

Expected: "Seed data created successfully!"

**Step 7: Verify with Prisma Studio**

```bash
npx prisma studio
```

Check all 3 workspaces, 3 agents, 6 tasks are present.

**Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts src/lib/db.ts package.json
git commit -m "feat: add Prisma schema, seed data, and db client"
```

---

### Task 4: TypeScript Type Definitions

**Files:**
- Create: `src/types/index.ts`

**Step 1: Write shared type definitions**

`src/types/index.ts`:
```ts
// === Task Status Lifecycle ===
export type TaskStatus = "todo" | "thinking" | "acting" | "blocked" | "done";

// === Agent Status ===
export type AgentStatus = "idle" | "busy" | "offline" | "error";

// === Thought Entry Type ===
export type ThoughtType = "thinking" | "tool_use" | "result" | "error";

// === Task Result Type ===
export type ResultType = "text" | "file" | "link" | "email_draft";

// === Core Domain Types ===

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  status: AgentStatus;
  avatarUrl?: string | null;
  lastHeartbeat?: Date | null;
  createdAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  workspaceId: string;
  assignedAgentId?: string | null;
  assignedAgent?: Agent | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThoughtEntry {
  id: string;
  taskId: string;
  agentId: string;
  type: ThoughtType;
  content: string;
  toolName?: string | null;
  timestamp: Date;
}

export interface TaskResult {
  id: string;
  taskId: string;
  type: ResultType;
  title: string;
  content: string;
  url?: string | null;
  createdAt: Date;
}

export interface InterventionRequest {
  id: string;
  taskId: string;
  question: string;
  options?: string[] | null;
  response?: string | null;
  resolvedAt?: Date | null;
  createdAt: Date;
}

// === SSE Event Types ===
export type SSEEvent =
  | { type: "status_change"; status: TaskStatus }
  | { type: "thought"; entry: ThoughtEntry }
  | { type: "intervention"; request: InterventionRequest }
  | { type: "result"; result: TaskResult }
  | { type: "heartbeat" };

// === Status UI Metadata ===
export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; animate?: boolean }> = {
  todo: { label: "待处理", color: "var(--muted)" },
  thinking: { label: "思考中", color: "var(--thinking)", animate: true },
  acting: { label: "执行中", color: "var(--acting)", animate: true },
  blocked: { label: "待干预", color: "var(--blocked)" },
  done: { label: "已完成", color: "var(--success)" },
};

export const TASK_STATUSES: TaskStatus[] = ["todo", "thinking", "acting", "blocked", "done"];
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions for all domain models"
```

---

### Task 5: REST API Routes

**Files:**
- Create: `src/app/api/workspaces/route.ts`
- Create: `src/app/api/workspaces/[id]/tasks/route.ts`
- Create: `src/app/api/tasks/route.ts`
- Create: `src/app/api/tasks/[id]/route.ts`
- Create: `src/app/api/tasks/[id]/intervene/route.ts`
- Create: `src/app/api/agents/route.ts`

**Step 1: Workspaces — list and create**

`src/app/api/workspaces/route.ts`:
```ts
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(workspaces);
}

export async function POST(request: Request) {
  const body = await request.json();
  const workspace = await prisma.workspace.create({
    data: {
      name: body.name,
      icon: body.icon ?? "📁",
      description: body.description,
    },
  });
  return NextResponse.json(workspace, { status: 201 });
}
```

**Step 2: Tasks by workspace**

`src/app/api/workspaces/[id]/tasks/route.ts`:
```ts
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tasks = await prisma.task.findMany({
    where: { workspaceId: id },
    include: { assignedAgent: true },
    orderBy: { createdAt: "asc" },
  });
  // Parse agent capabilities from JSON string
  const parsed = tasks.map((t) => ({
    ...t,
    assignedAgent: t.assignedAgent
      ? { ...t.assignedAgent, capabilities: JSON.parse(t.assignedAgent.capabilities) }
      : null,
  }));
  return NextResponse.json(parsed);
}
```

**Step 3: Tasks — create**

`src/app/api/tasks/route.ts`:
```ts
import { prisma } from "@/lib/db";
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
  return NextResponse.json(task, { status: 201 });
}
```

**Step 4: Tasks — get, update, delete**

`src/app/api/tasks/[id]/route.ts`:
```ts
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedAgent: true,
      thoughts: { orderBy: { timestamp: "asc" } },
      results: { orderBy: { createdAt: "asc" } },
      interventions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({
    ...task,
    assignedAgent: task.assignedAgent
      ? { ...task.assignedAgent, capabilities: JSON.parse(task.assignedAgent.capabilities) }
      : null,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.assignedAgentId !== undefined && { assignedAgentId: body.assignedAgentId }),
    },
    include: { assignedAgent: true },
  });
  return NextResponse.json(task);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Delete related records first
  await prisma.interventionRequest.deleteMany({ where: { taskId: id } });
  await prisma.taskResult.deleteMany({ where: { taskId: id } });
  await prisma.thoughtEntry.deleteMany({ where: { taskId: id } });
  await prisma.task.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
```

**Step 5: Intervention response**

`src/app/api/tasks/[id]/intervene/route.ts`:
```ts
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const body = await request.json();

  // Find the latest unresolved intervention for this task
  const intervention = await prisma.interventionRequest.findFirst({
    where: { taskId, resolvedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!intervention) {
    return NextResponse.json({ error: "No pending intervention" }, { status: 404 });
  }

  // Resolve intervention
  const updated = await prisma.interventionRequest.update({
    where: { id: intervention.id },
    data: { response: body.response, resolvedAt: new Date() },
  });

  // Resume task — set status back to acting
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "acting" },
  });

  return NextResponse.json(updated);
}
```

**Step 6: Agents — list**

`src/app/api/agents/route.ts`:
```ts
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const agents = await prisma.agent.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "asc" },
  });
  const parsed = agents.map((a) => ({
    ...a,
    capabilities: JSON.parse(a.capabilities),
  }));
  return NextResponse.json(parsed);
}
```

**Step 7: Verify APIs work**

```bash
npm run dev
```

Test with curl:
```bash
curl http://localhost:3000/api/workspaces
curl http://localhost:3000/api/agents
```

Expected: JSON arrays of seeded data.

**Step 8: Commit**

```bash
git add src/app/api/
git commit -m "feat: add REST API routes for workspaces, tasks, and agents"
```

---

### Task 6: SSE Endpoint and Mock Engine

**Files:**
- Create: `src/lib/mock-engine.ts`
- Create: `src/app/api/tasks/[id]/stream/route.ts`

**Step 1: Write mock engine**

The mock engine simulates an Agent executing a task by emitting a series of events with delays.

`src/lib/mock-engine.ts`:
```ts
import type { ThoughtType } from "@/types";

export interface MockEvent {
  type: "status_change" | "thought" | "intervention" | "result";
  delay: number; // ms before this event fires
  data: Record<string, unknown>;
}

// Predefined scenarios for different task types
const defaultScenario: MockEvent[] = [
  {
    type: "status_change",
    delay: 0,
    data: { status: "thinking" },
  },
  {
    type: "thought",
    delay: 1500,
    data: { thoughtType: "thinking" as ThoughtType, content: "正在分析任务需求..." },
  },
  {
    type: "thought",
    delay: 2000,
    data: { thoughtType: "thinking" as ThoughtType, content: "制定执行计划，分为 3 个步骤" },
  },
  {
    type: "status_change",
    delay: 1000,
    data: { status: "acting" },
  },
  {
    type: "thought",
    delay: 2000,
    data: { thoughtType: "tool_use" as ThoughtType, content: "正在查询相关数据...", toolName: "数据库查询" },
  },
  {
    type: "thought",
    delay: 3000,
    data: { thoughtType: "result" as ThoughtType, content: "找到 3 条相关记录" },
  },
  {
    type: "thought",
    delay: 2000,
    data: { thoughtType: "tool_use" as ThoughtType, content: "正在核对业务规则...", toolName: "规则引擎" },
  },
  {
    type: "intervention",
    delay: 2000,
    data: {
      question: "检测到特殊情况，需要您确认处理方式",
      options: JSON.stringify(["按标准流程处理", "特殊审批通过", "暂时搁置"]),
    },
  },
  // After intervention is resolved, the stream will continue from here
  {
    type: "status_change",
    delay: 500,
    data: { status: "acting" },
  },
  {
    type: "thought",
    delay: 2000,
    data: { thoughtType: "tool_use" as ThoughtType, content: "正在执行最终操作...", toolName: "操作执行器" },
  },
  {
    type: "thought",
    delay: 2000,
    data: { thoughtType: "result" as ThoughtType, content: "操作完成，生成执行报告" },
  },
  {
    type: "result",
    delay: 1000,
    data: {
      resultType: "text",
      title: "执行报告",
      content: "任务已成功完成。处理了 3 条记录，所有操作均已确认。",
    },
  },
  {
    type: "status_change",
    delay: 500,
    data: { status: "done" },
  },
];

export function getMockScenario(): MockEvent[] {
  return defaultScenario;
}
```

**Step 2: Write SSE stream endpoint**

`src/app/api/tasks/[id]/stream/route.ts`:
```ts
import { prisma } from "@/lib/db";
import { getMockScenario } from "@/lib/mock-engine";

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

  const scenario = getMockScenario();
  let eventIndex = 0;
  let waitingForIntervention = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      // Heartbeat every 15 seconds
      const heartbeatInterval = setInterval(() => {
        try {
          send("heartbeat", { timestamp: Date.now() });
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      async function processNextEvent() {
        if (eventIndex >= scenario.length) {
          clearInterval(heartbeatInterval);
          controller.close();
          return;
        }

        const event = scenario[eventIndex];

        // If we hit an intervention, pause and wait
        if (event.type === "intervention" && !waitingForIntervention) {
          waitingForIntervention = true;

          // Create the intervention in the DB
          const intervention = await prisma.interventionRequest.create({
            data: {
              taskId,
              question: event.data.question as string,
              options: event.data.options as string,
            },
          });

          // Update task status to blocked
          await prisma.task.update({
            where: { id: taskId },
            data: { status: "blocked" },
          });

          send("status_change", { status: "blocked" });
          send("intervention", {
            id: intervention.id,
            taskId,
            question: intervention.question,
            options: JSON.parse(intervention.options ?? "[]"),
            createdAt: intervention.createdAt,
          });

          // Poll for intervention resolution
          const pollInterval = setInterval(async () => {
            try {
              const updated = await prisma.interventionRequest.findUnique({
                where: { id: intervention.id },
              });
              if (updated?.resolvedAt) {
                clearInterval(pollInterval);
                waitingForIntervention = false;
                eventIndex++; // Move past the intervention event
                processNextEvent();
              }
            } catch {
              clearInterval(pollInterval);
            }
          }, 1000);

          return;
        }

        // Process non-intervention events
        await new Promise((resolve) => setTimeout(resolve, event.delay));

        if (event.type === "status_change") {
          await prisma.task.update({
            where: { id: taskId },
            data: { status: event.data.status as string },
          });
          send("status_change", { status: event.data.status });
        } else if (event.type === "thought") {
          const thought = await prisma.thoughtEntry.create({
            data: {
              taskId,
              agentId: task.assignedAgentId!,
              type: event.data.thoughtType as string,
              content: event.data.content as string,
              toolName: (event.data.toolName as string) ?? null,
            },
          });
          send("thought", thought);
        } else if (event.type === "result") {
          const result = await prisma.taskResult.create({
            data: {
              taskId,
              type: event.data.resultType as string,
              title: event.data.title as string,
              content: event.data.content as string,
            },
          });
          send("result", result);
        }

        eventIndex++;
        processNextEvent();
      }

      processNextEvent();
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
```

**Step 3: Verify SSE works**

```bash
npm run dev
```

Get a task ID first:
```bash
curl http://localhost:3000/api/workspaces
```

Then test the stream (replace TASK_ID):
```bash
curl -N http://localhost:3000/api/tasks/TASK_ID/stream
```

Expected: SSE events stream in over ~20 seconds. Should see `event: status_change`, `event: thought`, etc.

**Step 4: Commit**

```bash
git add src/lib/mock-engine.ts src/app/api/tasks/\[id\]/stream/
git commit -m "feat: add SSE real-time stream endpoint and mock agent engine"
```

---

### Task 7: UI Shell — Layout, Sidebar, and Navigation

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/workspace/[id]/page.tsx`
- Create: `src/app/workspace/[id]/layout.tsx`
- Create: `src/components/sidebar.tsx`
- Create: `src/components/top-bar.tsx`
- Create: `src/components/create-workspace-dialog.tsx`

**Step 1: Create Sidebar component**

`src/components/sidebar.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import type { Workspace } from "@/types";
import { cn } from "@/lib/utils";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

export function Sidebar() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const activeId = params?.id as string | undefined;

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then(setWorkspaces);
  }, []);

  async function handleCreate(name: string, icon: string) {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon }),
    });
    const ws = await res.json();
    setWorkspaces((prev) => [...prev, ws]);
    setDialogOpen(false);
    router.push(`/workspace/${ws.id}`);
  }

  return (
    <aside
      className="w-60 border-r flex flex-col shrink-0"
      style={{ borderColor: "var(--border)", background: "var(--background)" }}
    >
      <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
        <h1 className="text-lg font-bold tracking-tight">
          <span style={{ color: "var(--primary)" }}>Sync</span>Claw
        </h1>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <div
          className="px-2 py-1 text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          工作区
        </div>
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => router.push(`/workspace/${ws.id}`)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer"
            )}
            style={{
              background: activeId === ws.id ? "var(--card)" : "transparent",
              color: activeId === ws.id ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            <span>{ws.icon}</span>
            <span>{ws.name}</span>
          </button>
        ))}
        <button
          onClick={() => setDialogOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer"
          style={{ color: "var(--muted)" }}
        >
          <span>+</span>
          <span>新建工作区</span>
        </button>
      </nav>

      <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => router.push("/agents")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer"
          style={{ color: "var(--muted-foreground)" }}
        >
          <span>🤖</span>
          <span>Agent 中心</span>
        </button>
      </div>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
      />
    </aside>
  );
}
```

**Step 2: Create workspace dialog**

`src/components/create-workspace-dialog.tsx`:
```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ICONS = ["📁", "🎧", "🏠", "💰", "📊", "🚀", "🎯", "📝"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, icon: string) => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), icon);
    setName("");
    setIcon("📁");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle>新建工作区</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              图标
            </label>
            <div className="flex gap-2">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className="w-8 h-8 rounded flex items-center justify-center text-lg cursor-pointer"
                  style={{
                    background: icon === i ? "var(--primary)" : "var(--background)",
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              名称
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入工作区名称"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim()}>
            创建
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Create TopBar component**

`src/components/top-bar.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  onNewTask?: () => void;
}

export function TopBar({ title, onNewTask }: Props) {
  const router = useRouter();

  return (
    <header
      className="h-14 px-6 border-b flex items-center justify-between shrink-0"
      style={{ borderColor: "var(--border)" }}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/agents")}
          className="text-sm cursor-pointer"
          style={{ color: "var(--muted-foreground)" }}
        >
          🤖 Agent Hub
        </Button>
        {onNewTask && (
          <Button
            size="sm"
            onClick={onNewTask}
            className="cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            + 新建任务
          </Button>
        )}
      </div>
    </header>
  );
}
```

**Step 4: Root page — redirect to first workspace**

`src/app/page.tsx`:
```tsx
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function Home() {
  const firstWorkspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (firstWorkspace) {
    redirect(`/workspace/${firstWorkspace.id}`);
  }
  // If no workspaces, show a simple create prompt
  return (
    <div className="flex h-screen items-center justify-center">
      <p style={{ color: "var(--muted-foreground)" }}>创建你的第一个工作区开始使用</p>
    </div>
  );
}
```

**Step 5: Workspace layout with sidebar**

`src/app/workspace/[id]/layout.tsx`:
```tsx
import { Sidebar } from "@/components/sidebar";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
```

**Step 6: Workspace page (placeholder — will be filled in Task 8)**

`src/app/workspace/[id]/page.tsx`:
```tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { TaskBoardWrapper } from "@/components/task-board-wrapper";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: Props) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  return <TaskBoardWrapper workspaceId={id} workspaceName={workspace.name} />;
}
```

Create a temporary placeholder for the wrapper:

`src/components/task-board-wrapper.tsx`:
```tsx
"use client";

import { TopBar } from "@/components/top-bar";

interface Props {
  workspaceId: string;
  workspaceName: string;
}

export function TaskBoardWrapper({ workspaceName }: Props) {
  return (
    <>
      <TopBar title={workspaceName} onNewTask={() => {}} />
      <div className="flex-1 flex items-center justify-center" style={{ color: "var(--muted)" }}>
        任务看板（下一步实现）
      </div>
    </>
  );
}
```

**Step 7: Verify navigation works**

```bash
npm run dev
```

Open http://localhost:3000 — should redirect to first workspace. Sidebar should list workspaces. Clicking between them should update the URL.

**Step 8: Commit**

```bash
git add src/app/ src/components/
git commit -m "feat: add sidebar navigation, workspace routing, and top bar"
```

---

### Task 8: Kanban Board with Drag-and-Drop

**Files:**
- Modify: `src/components/task-board-wrapper.tsx` (replace placeholder)
- Create: `src/components/kanban-column.tsx`
- Create: `src/components/task-card.tsx`
- Create: `src/components/create-task-dialog.tsx`

**Step 1: Create TaskCard component**

`src/components/task-card.tsx`:
```tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/types";
import { STATUS_CONFIG } from "@/types";

interface Props {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: Props) {
  const config = STATUS_CONFIG[task.status];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderColor: task.status === "blocked" ? "var(--blocked)" : "var(--border)",
    background: "var(--background)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="p-3 rounded-md border transition-colors cursor-pointer hover:border-[var(--border-hover)]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug">{task.title}</h3>
        {config.animate && (
          <span
            className="flex-shrink-0 w-2 h-2 rounded-full mt-1 animate-pulse"
            style={{ background: config.color }}
          />
        )}
      </div>

      {task.description && (
        <p
          className="mt-1 text-xs leading-relaxed line-clamp-2"
          style={{ color: "var(--muted-foreground)" }}
        >
          {task.description}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        {task.assignedAgent && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "var(--card)", color: "var(--muted-foreground)" }}
          >
            🤖 {task.assignedAgent.name}
          </span>
        )}
        {task.status === "blocked" && (
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ background: "var(--blocked)", color: "white" }}
          >
            需要介入
          </span>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create KanbanColumn component**

`src/components/kanban-column.tsx`:
```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Task, TaskStatus } from "@/types";
import { STATUS_CONFIG } from "@/types";
import { TaskCard } from "./task-card";

interface Props {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function KanbanColumn({ status, tasks, onTaskClick }: Props) {
  const config = STATUS_CONFIG[status];
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div
      className="flex-shrink-0 w-72 flex flex-col rounded-lg"
      style={{ background: "var(--card)" }}
    >
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: config.color }} />
        <span className="text-sm font-medium">{config.label}</span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
        >
          {tasks.length}
        </span>
      </div>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
```

**Step 3: Create task dialog**

`src/components/create-task-dialog.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Agent } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onCreate: (task: { title: string; description: string; assignedAgentId?: string }) => void;
}

export function CreateTaskDialog({ open, onOpenChange, workspaceId, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetch("/api/agents")
        .then((r) => r.json())
        .then(setAgents);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      assignedAgentId: selectedAgentId || undefined,
    });
    setTitle("");
    setDescription("");
    setSelectedAgentId("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              标题
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入任务标题"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              描述
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入任务描述（可选）"
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              指派 Agent（可选）
            </label>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedAgentId("")}
                className="w-full text-left px-3 py-2 rounded text-sm cursor-pointer"
                style={{
                  background: !selectedAgentId ? "var(--primary)" : "var(--background)",
                  color: !selectedAgentId ? "white" : "var(--muted-foreground)",
                }}
              >
                不指派（手动处理）
              </button>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  className="w-full text-left px-3 py-2 rounded text-sm cursor-pointer"
                  style={{
                    background: selectedAgentId === agent.id ? "var(--primary)" : "var(--background)",
                    color: selectedAgentId === agent.id ? "white" : "var(--muted-foreground)",
                  }}
                >
                  🤖 {agent.name} — {agent.description}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={!title.trim()}>
            创建任务
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Implement TaskBoardWrapper with dnd-kit**

Replace `src/components/task-board-wrapper.tsx`:
```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Task, TaskStatus } from "@/types";
import { TASK_STATUSES } from "@/types";
import { TopBar } from "./top-bar";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { CreateTaskDialog } from "./create-task-dialog";
import { TaskInspector } from "./task-inspector";

interface Props {
  workspaceId: string;
  workspaceName: string;
}

export function TaskBoardWrapper({ workspaceId, workspaceName }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [inspectedTask, setInspectedTask] = useState<Task | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchTasks = useCallback(() => {
    fetch(`/api/workspaces/${workspaceId}/tasks`)
      .then((r) => r.json())
      .then(setTasks);
  }, [workspaceId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    // Only update if dropped on a different column
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    // Persist
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function handleCreateTask(data: {
    title: string;
    description: string;
    assignedAgentId?: string;
  }) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, workspaceId }),
    });
    const newTask = await res.json();
    setTasks((prev) => [...prev, newTask]);
    setCreateDialogOpen(false);
  }

  function handleTaskClick(task: Task) {
    setInspectedTask(task);
  }

  // Refresh task when inspector updates it (e.g., intervention resolved)
  function handleTaskUpdate(updatedTask: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
  }

  return (
    <>
      <TopBar title={workspaceName} onNewTask={() => setCreateDialogOpen(true)} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-x-auto p-4 gap-4">
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasks.filter((t) => t.status === status)}
              onTaskClick={handleTaskClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      <TaskInspector
        task={inspectedTask}
        onClose={() => setInspectedTask(null)}
        onTaskUpdate={handleTaskUpdate}
      />

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        workspaceId={workspaceId}
        onCreate={handleCreateTask}
      />
    </>
  );
}
```

**Step 5: Create a temporary TaskInspector placeholder**

`src/components/task-inspector.tsx`:
```tsx
"use client";

import type { Task } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  task: Task | null;
  onClose: () => void;
  onTaskUpdate: (task: Task) => void;
}

export function TaskInspector({ task, onClose }: Props) {
  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-[600px] sm:max-w-[600px]"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
      >
        <SheetHeader>
          <SheetTitle>{task?.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4" style={{ color: "var(--muted-foreground)" }}>
          任务详情面板（下一步实现）
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 6: Verify kanban board**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- 5 columns render with seeded tasks
- Tasks can be dragged between columns
- "+ 新建任务" opens create dialog
- Clicking a card opens the slide-over panel

**Step 7: Commit**

```bash
git add src/components/ src/app/
git commit -m "feat: add kanban board with drag-and-drop and task creation"
```

---

### Task 9: Task Inspector — Thought Stream, Results, and Intervention

**Files:**
- Modify: `src/components/task-inspector.tsx` (replace placeholder)
- Create: `src/hooks/use-task-stream.ts`
- Create: `src/components/thought-stream.tsx`
- Create: `src/components/intervention-panel.tsx`
- Create: `src/components/result-preview.tsx`

**Step 1: Create useTaskStream hook**

`src/hooks/use-task-stream.ts`:
```ts
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { ThoughtEntry, InterventionRequest, TaskResult, TaskStatus } from "@/types";

interface StreamState {
  thoughts: ThoughtEntry[];
  results: TaskResult[];
  intervention: InterventionRequest | null;
  status: TaskStatus | null;
  connected: boolean;
}

export function useTaskStream(taskId: string | null) {
  const [state, setState] = useState<StreamState>({
    thoughts: [],
    results: [],
    intervention: null,
    status: null,
    connected: false,
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState((s) => ({ ...s, connected: false }));
  }, []);

  useEffect(() => {
    if (!taskId) {
      disconnect();
      return;
    }

    // Reset state for new task
    setState({
      thoughts: [],
      results: [],
      intervention: null,
      status: null,
      connected: false,
    });

    // Load existing thoughts and results
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((task) => {
        setState((s) => ({
          ...s,
          thoughts: task.thoughts ?? [],
          results: task.results ?? [],
          status: task.status,
          intervention:
            task.interventions?.find((i: InterventionRequest) => !i.resolvedAt) ?? null,
        }));
      });

    // Connect SSE stream
    const es = new EventSource(`/api/tasks/${taskId}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setState((s) => ({ ...s, connected: true }));
    };

    es.addEventListener("status_change", (e) => {
      const data = JSON.parse(e.data);
      setState((s) => ({ ...s, status: data.status }));
    });

    es.addEventListener("thought", (e) => {
      const thought = JSON.parse(e.data);
      setState((s) => ({
        ...s,
        thoughts: [...s.thoughts, thought],
      }));
    });

    es.addEventListener("intervention", (e) => {
      const intervention = JSON.parse(e.data);
      setState((s) => ({ ...s, intervention }));
    });

    es.addEventListener("result", (e) => {
      const result = JSON.parse(e.data);
      setState((s) => ({
        ...s,
        results: [...s.results, result],
      }));
    });

    es.onerror = () => {
      setState((s) => ({ ...s, connected: false }));
    };

    return () => {
      es.close();
    };
  }, [taskId, disconnect]);

  return { ...state, disconnect };
}
```

**Step 2: Create ThoughtStream component**

`src/components/thought-stream.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ThoughtEntry } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";

const typeConfig: Record<string, { icon: string; color: string }> = {
  thinking: { icon: "💭", color: "var(--thinking)" },
  tool_use: { icon: "🔧", color: "var(--acting)" },
  result: { icon: "✅", color: "var(--success)" },
  error: { icon: "❌", color: "var(--danger)" },
};

interface Props {
  thoughts: ThoughtEntry[];
  connected: boolean;
}

export function ThoughtStream({ thoughts, connected }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thoughts.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium">脑回路</h3>
        {connected && (
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4">
          {thoughts.length === 0 && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              等待 Agent 开始执行...
            </p>
          )}
          {thoughts.map((thought) => {
            const config = typeConfig[thought.type] ?? typeConfig.thinking;
            return (
              <div key={thought.id} className="flex gap-2">
                <span className="text-sm mt-0.5">{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--foreground)" }}>
                    {thought.content}
                  </p>
                  {thought.toolName && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block"
                      style={{ background: "var(--card)", color: config.color }}
                    >
                      {thought.toolName}
                    </span>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    {new Date(thought.timestamp).toLocaleTimeString("zh-CN")}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
```

**Step 3: Create InterventionPanel component**

`src/components/intervention-panel.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { InterventionRequest } from "@/types";
import { Button } from "@/components/ui/button";

interface Props {
  intervention: InterventionRequest;
  taskId: string;
  onResolved: () => void;
}

export function InterventionPanel({ intervention, taskId, onResolved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const options = intervention.options ?? [];

  async function handleRespond(response: string) {
    setSubmitting(true);
    await fetch(`/api/tasks/${taskId}/intervene`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    setSubmitting(false);
    onResolved();
  }

  return (
    <div
      className="p-4 rounded-lg border"
      style={{ borderColor: "var(--blocked)", background: "rgba(249, 115, 22, 0.1)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚠️</span>
        <h4 className="text-sm font-medium" style={{ color: "var(--blocked)" }}>
          需要你的决定
        </h4>
      </div>
      <p className="text-sm mb-4">{intervention.question}</p>
      <div className="space-y-2">
        {options.map((option) => (
          <Button
            key={option}
            variant="outline"
            size="sm"
            className="w-full justify-start cursor-pointer"
            disabled={submitting}
            onClick={() => handleRespond(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Create ResultPreview component**

`src/components/result-preview.tsx`:
```tsx
"use client";

import type { TaskResult } from "@/types";

const typeIcon: Record<string, string> = {
  text: "📄",
  file: "📎",
  link: "🔗",
  email_draft: "✉️",
};

interface Props {
  results: TaskResult[];
}

export function ResultPreview({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">执行成果</h3>
      <div className="space-y-2">
        {results.map((result) => (
          <div
            key={result.id}
            className="p-3 rounded-md border"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{typeIcon[result.type] ?? "📄"}</span>
              <span className="text-sm font-medium">{result.title}</span>
            </div>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {result.content}
            </p>
            {result.url && (
              <a
                href={result.url}
                className="text-xs mt-1 inline-block"
                style={{ color: "var(--primary)" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看链接 →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 5: Implement full TaskInspector**

Replace `src/components/task-inspector.tsx`:
```tsx
"use client";

import type { Task } from "@/types";
import { STATUS_CONFIG } from "@/types";
import { useTaskStream } from "@/hooks/use-task-stream";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ThoughtStream } from "./thought-stream";
import { InterventionPanel } from "./intervention-panel";
import { ResultPreview } from "./result-preview";

interface Props {
  task: Task | null;
  onClose: () => void;
  onTaskUpdate: (task: Task) => void;
}

export function TaskInspector({ task, onClose, onTaskUpdate }: Props) {
  const stream = useTaskStream(task?.id ?? null);

  // Sync status changes back to the board
  const effectiveStatus = stream.status ?? task?.status;

  function handleInterventionResolved() {
    if (task) {
      onTaskUpdate({ ...task, status: "acting" });
    }
  }

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-[600px] sm:max-w-[600px] flex flex-col"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>{task?.title}</span>
            {effectiveStatus && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: STATUS_CONFIG[effectiveStatus].color,
                  color: "white",
                }}
              >
                {STATUS_CONFIG[effectiveStatus].label}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {task?.description && (
          <p className="text-sm mt-2" style={{ color: "var(--muted-foreground)" }}>
            {task.description}
          </p>
        )}

        <Separator className="my-4" style={{ background: "var(--border)" }} />

        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
          {/* Thought stream — takes up remaining space */}
          <div className="flex-1 overflow-hidden">
            <ThoughtStream thoughts={stream.thoughts} connected={stream.connected} />
          </div>

          {/* Intervention panel — shows when blocked */}
          {stream.intervention && !stream.intervention.resolvedAt && task && (
            <>
              <Separator style={{ background: "var(--border)" }} />
              <InterventionPanel
                intervention={stream.intervention}
                taskId={task.id}
                onResolved={handleInterventionResolved}
              />
            </>
          )}

          {/* Results */}
          {stream.results.length > 0 && (
            <>
              <Separator style={{ background: "var(--border)" }} />
              <ResultPreview results={stream.results} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 6: Verify the full flow**

```bash
npm run dev
```

1. Open http://localhost:3000
2. Click on a task card that has an assigned agent (e.g., "处理张三的退款请求")
3. The slide-over should open with the thought stream
4. SSE events should stream in, showing thinking → tool use → result steps
5. When intervention appears, click a response option
6. The task should resume and eventually complete

**Step 7: Commit**

```bash
git add src/hooks/ src/components/
git commit -m "feat: add task inspector with real-time thought stream and intervention"
```

---

### Task 10: Agent Hub Page

**Files:**
- Create: `src/app/agents/page.tsx`
- Create: `src/app/agents/layout.tsx`
- Create: `src/components/agent-card.tsx`

**Step 1: Agent Hub layout**

`src/app/agents/layout.tsx`:
```tsx
import { Sidebar } from "@/components/sidebar";

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
```

**Step 2: Agent card component**

`src/components/agent-card.tsx`:
```tsx
"use client";

import type { Agent, AgentStatus } from "@/types";

const statusConfig: Record<AgentStatus, { label: string; color: string }> = {
  idle: { label: "空闲", color: "var(--success)" },
  busy: { label: "忙碌", color: "var(--acting)" },
  offline: { label: "离线", color: "var(--muted)" },
  error: { label: "异常", color: "var(--danger)" },
};

interface Props {
  agent: Agent & { _count?: { tasks: number } };
}

export function AgentCard({ agent }: Props) {
  const status = statusConfig[agent.status];

  return (
    <div
      className="p-4 rounded-lg border transition-colors"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{ background: "var(--background)" }}
          >
            🤖
          </div>
          <div>
            <h3 className="text-sm font-medium">{agent.name}</h3>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {agent.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: status.color }}
          />
          <span className="text-xs" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
          能力
        </p>
        <div className="flex flex-wrap gap-1">
          {agent.capabilities.map((cap) => (
            <span
              key={cap}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: "var(--background)", color: "var(--muted-foreground)" }}
            >
              {cap}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
        <span>任务数: {agent._count?.tasks ?? 0}</span>
        {agent.lastHeartbeat && (
          <span>
            最后心跳: {new Date(agent.lastHeartbeat).toLocaleTimeString("zh-CN")}
          </span>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Agent Hub page**

`src/app/agents/page.tsx`:
```tsx
import { prisma } from "@/lib/db";
import { AgentCard } from "@/components/agent-card";
import type { Agent } from "@/types";

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "asc" },
  });

  const parsed = agents.map((a) => ({
    ...a,
    capabilities: JSON.parse(a.capabilities) as string[],
  })) as (Agent & { _count: { tasks: number } })[];

  return (
    <div className="flex flex-col h-full">
      <header
        className="h-14 px-6 border-b flex items-center shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className="text-lg font-semibold">🤖 Agent 中心</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          {parsed.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Verify Agent Hub**

```bash
npm run dev
```

Click "Agent 中心" in sidebar. Should show 3 agent cards with status, capabilities, and task counts.

**Step 5: Commit**

```bash
git add src/app/agents/ src/components/agent-card.tsx
git commit -m "feat: add Agent Hub page with agent status and capabilities"
```

---

### Task 11: Polish and Final Verification

**Step 1: Run full build**

```bash
npm run build
```

Fix any TypeScript or build errors.

**Step 2: End-to-end smoke test**

Run the dev server and verify the complete flow:

1. Root `/` redirects to first workspace
2. Sidebar shows all workspaces, clicking navigates
3. Kanban board shows tasks in correct columns
4. Drag a task between columns, verify status persists (refresh page to confirm)
5. Create a new task via dialog, optionally assign an Agent
6. Click a task card → inspector opens
7. If task has Agent, SSE stream shows thought entries
8. When intervention appears, respond → task resumes
9. Navigate to Agent Hub, verify all agents display

**Step 3: Fix any issues found in smoke test**

Address any bugs or visual issues.

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: polish UI and resolve build issues"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffolding | package.json, next.config.ts, globals.css |
| 2 | Install dependencies | shadcn/ui, dnd-kit, Prisma |
| 3 | Database schema + seed | prisma/schema.prisma, prisma/seed.ts |
| 4 | TypeScript types | src/types/index.ts |
| 5 | REST API routes | src/app/api/**/*.ts |
| 6 | SSE + Mock engine | src/lib/mock-engine.ts, stream/route.ts |
| 7 | Layout + sidebar + navigation | sidebar.tsx, top-bar.tsx, workspace layout |
| 8 | Kanban board + drag-and-drop | task-board-wrapper.tsx, kanban-column.tsx |
| 9 | Task inspector + thought stream | task-inspector.tsx, use-task-stream.ts |
| 10 | Agent Hub page | agents/page.tsx, agent-card.tsx |
| 11 | Polish + final verification | Build check, e2e smoke test |
