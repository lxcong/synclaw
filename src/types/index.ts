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
  todo: { label: "\u5F85\u5904\u7406", color: "var(--muted)" },
  thinking: { label: "\u601D\u8003\u4E2D", color: "var(--thinking)", animate: true },
  acting: { label: "\u6267\u884C\u4E2D", color: "var(--acting)", animate: true },
  blocked: { label: "\u5F85\u5E72\u9884", color: "var(--blocked)" },
  done: { label: "\u5DF2\u5B8C\u6210", color: "var(--success)" },
};

export const TASK_STATUSES: TaskStatus[] = ["todo", "thinking", "acting", "blocked", "done"];
