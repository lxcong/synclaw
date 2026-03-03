[English](./README.md) | **中文**

# SyncClaw

智能任务控制台，连接人类任务管理与自主 AI Agent 执行 — 一个将任务派发给 AI Agent 并实时展示思维流的看板。

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

## 功能

- **看板任务面板** — 三列看板（Todo → Acting → Done），支持拖拽排序。将任务分配给 Agent 自主执行。
- **实时思维流** — 实时观看 Agent 思考。检查器面板通过 SSE 流式展示推理过程、工具调用、结果和错误。
- **像素办公室** — 基于 Phaser 3 的像素风格办公室，Agent 精灵根据状态在不同区域（工位、休息区、服务器间）间移动。点击可交互。
- **工作空间** — 按上下文组织任务（如客服、财务），支持自定义图标和描述。
- **Agent 管理** — 追踪 Agent 状态、能力和心跳。自动从 OpenClaw Gateway 同步。

## 架构

```
浏览器 (Next.js App Router)
    │
    ├── HTTP/SSE ──→ Next.js API Routes
    │                    │
    │                    └── WebSocket ──→ OpenClaw Gateway
    │                                     (Agent 编排)
    └── Phaser Canvas (像素办公室)
```

| 层级 | 技术栈 |
|------|--------|
| 前端 | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, @dnd-kit |
| 数据库 | Prisma 7 + SQLite (better-sqlite3) |
| 实时通信 | SSE（浏览器端）, WebSocket（Gateway） |
| 可视化 | Phaser 3 |
| 测试 | Playwright |

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 20+
- [OpenClaw Gateway](https://github.com/openclaw/openclaw) 实例（用于 Agent 执行）

### 方式一：通过 OpenClaw Agent 安装（推荐）

如果你已经在运行 [OpenClaw](https://github.com/openclaw/openclaw)，对 Agent 说：

```
npx skills add lxcong/synclaw
```

Agent 会自动安装和配置 SyncClaw。

### 方式二：手动安装

```bash
git clone https://github.com/lxcong/synclaw.git
cd synclaw
npm install
```

配置环境：

```bash
cp .env.example .env
# 编辑 .env，填入你的 Gateway URL 和 Token
```

初始化数据库并构建：

```bash
npm run db:generate
npm run db:push
npm run db:seed      # 可选：填充示例数据
npm run build
```

全局安装 CLI：

```bash
npm install -g synclaw
```

启动服务：

```bash
synclaw start
```

打开 [http://localhost:3000](http://localhost:3000)。

> [!TIP]
> 使用 `synclaw start --dev` 启动开发模式，支持热重载。

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:./dev.db` |
| `OPENCLAW_GATEWAY_URL` | OpenClaw Gateway WebSocket 地址 | `ws://localhost:18789` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway 认证 Token | — |

## CLI 参考

`synclaw` CLI 以后台进程方式管理 SyncClaw 服务。

```bash
synclaw start [-p port] [-H host]     # 后台启动服务
synclaw start --dev                   # 开发模式启动
synclaw stop [-t timeout]             # 优雅停止（SIGTERM → SIGKILL）
synclaw restart                       # 重启
synclaw status                        # 查看 PID、运行时间、端口、Gateway 状态
synclaw logs [-f] [-n lines]          # 查看或跟踪日志
```

### npm 脚本

```bash
npm run dev          # 开发服务器 (Turbopack)
npm run build        # 生产构建
npm run lint         # ESLint 检查
npm run db:studio    # 打开 Prisma Studio 可视化界面
```

## 数据模型

```
Workspace ──┐
             └── Task ──┬── ThoughtEntry[]
                         └── TaskResult[]
Agent ───────────┘
```

| 实体 | 说明 |
|------|------|
| **Workspace** | 按上下文分组任务 |
| **Agent** | 自主 AI 实体，带状态追踪（idle / busy / offline / error） |
| **Task** | 工作单元，生命周期：`todo` → `acting` → `done` |
| **ThoughtEntry** | Agent 实时推理日志（thinking / tool_use / result / error） |
| **TaskResult** | 已完成任务的结构化输出（text / file / link） |

## 致谢

像素艺术素材来自 [LimeZu](https://limezu.itch.io/)。
