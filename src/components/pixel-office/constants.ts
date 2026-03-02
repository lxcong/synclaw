import type { AgentStatus } from "@/types";

/** Canvas dimensions */
export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 320;

/** Sprite configuration */
export const SPRITE_FRAME_SIZE = 32;
export const SPRITE_SCALE = 3;
export const SPRITE_FRAME_COUNT = 8;
export const SPRITE_FRAME_RATE = 8;

/** Character variants count */
export const CHARACTER_VARIANTS = 6;

/** Depth layers */
export const DEPTH = {
  BACKGROUND: 0,
  FURNITURE: 10,
  AGENT_SPRITE: 20,
  NAME_LABEL: 30,
  STATUS_BUBBLE: 40,
  HIGHLIGHT: 50,
} as const;

/** Office area definitions - where agents go based on status */
export interface AreaBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}

export const OFFICE_AREAS: Record<Exclude<AgentStatus, "offline">, AreaBounds> = {
  busy: { x1: 100, y1: 100, x2: 350, y2: 260, label: "工作区" },
  idle: { x1: 380, y1: 100, x2: 580, y2: 260, label: "休息区" },
  error: { x1: 620, y1: 100, x2: 860, y2: 260, label: "服务器区" },
};

/** Offline agents appear near the door, semi-transparent */
export const DOOR_AREA: AreaBounds = {
  x1: 870, y1: 180, x2: 940, y2: 280, label: "门口",
};

/** Polling interval in milliseconds */
export const POLL_INTERVAL_MS = 5000;

/** Tween duration for sprite movement (ms) */
export const MOVE_TWEEN_MS = 1000;

/** Highlight duration (ms) */
export const HIGHLIGHT_DURATION_MS = 3000;

/** Get a deterministic character variant (1-6) from agent ID */
export function getCharacterVariant(agentId: string): number {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0;
  }
  return (hash % CHARACTER_VARIANTS) + 1;
}

/** Get a random position within area bounds */
export function getRandomPositionInArea(area: AreaBounds): { x: number; y: number } {
  return {
    x: area.x1 + Math.random() * (area.x2 - area.x1),
    y: area.y1 + Math.random() * (area.y2 - area.y1),
  };
}

/** Get the target area for an agent status */
export function getAreaForStatus(status: AgentStatus): AreaBounds {
  if (status === "offline") return DOOR_AREA;
  return OFFICE_AREAS[status];
}

/** Status label for speech bubbles */
export const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "休息中...",
  busy: "工作中!",
  offline: "已离线",
  error: "出错了!",
};
