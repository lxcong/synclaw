# Pixel Office Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Phaser 3-based pixel office scene to the Agent Hub page that visualizes agent statuses as pixel characters in different office zones, with click interaction between scene and existing card grid.

**Architecture:** A `PixelOffice` React component wraps a Phaser 3 game instance, dynamically imported to avoid SSR issues. An `AgentsPageClient` component manages state polling and bidirectional click interaction between the canvas and agent cards. The server component provides initial data, and the client polls `/api/agents` every 5 seconds.

**Tech Stack:** Next.js 16, React 19, Phaser 3, TypeScript, Tailwind CSS

---

### Task 1: Install Phaser 3 and create placeholder assets

**Files:**
- Modify: `package.json`
- Create: `public/pixel-assets/office-bg.png` (placeholder)
- Create: `public/pixel-assets/guest_anim_1.png` through `guest_anim_6.png` (placeholders)

**Step 1: Install Phaser 3**

Run: `npm install phaser`

**Step 2: Create placeholder pixel assets directory**

Run: `mkdir -p public/pixel-assets`

**Step 3: Generate placeholder assets using a script**

Create a temporary Node script to generate simple colored rectangle PNGs as placeholders. These will be replaced with proper pixel art later.

Create file `scripts/generate-placeholder-assets.ts`:

```typescript
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// Minimal 1x1 PNG in different colors for testing
// Real assets will replace these
function createMinimalPng(width: number, height: number, r: number, g: number, b: number): Buffer {
  // Create a minimal valid PNG file
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(2, 9); // color type: RGB
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdr = createChunk("IHDR", ihdrData);

  // IDAT chunk - raw pixel data with zlib
  const rawData: number[] = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter none
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b);
    }
  }
  // Minimal zlib wrapper: deflate stored block
  const raw = Buffer.from(rawData);
  const deflated = zlibDeflateRaw(raw);
  const idat = createChunk("IDAT", deflated);

  // IEND chunk
  const iend = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const combined = Buffer.concat([typeBuffer, data]);
  const crc = crc32(combined);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  return Buffer.concat([length, combined, crcBuffer]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zlibDeflateRaw(data: Buffer): Buffer {
  // zlib header (deflate, no dict, level 0)
  const header = Buffer.from([0x78, 0x01]);
  // Stored block: BFINAL=1, BTYPE=00
  const blockHeader = Buffer.alloc(5);
  blockHeader.writeUInt8(0x01, 0); // final block, stored
  blockHeader.writeUInt16LE(data.length, 1);
  blockHeader.writeUInt16LE(~data.length & 0xffff, 3);
  // Adler-32 checksum
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE((b << 16) | a, 0);
  return Buffer.concat([header, blockHeader, data, adler]);
}

const assetsDir = join(process.cwd(), "public", "pixel-assets");
mkdirSync(assetsDir, { recursive: true });

// Office background: 960x320 dark gray
writeFileSync(join(assetsDir, "office-bg.png"), createMinimalPng(960, 320, 24, 24, 27));

// 6 character spritesheets: 256x32 (8 frames of 32x32) in different colors
const colors = [
  [99, 102, 241],   // indigo
  [34, 197, 94],    // green
  [239, 68, 68],    // red
  [245, 158, 11],   // amber
  [168, 85, 247],   // purple
  [59, 130, 246],   // blue
];

for (let i = 0; i < 6; i++) {
  const [r, g, b] = colors[i];
  // 8 frames of 32x32 = 256x32 spritesheet
  writeFileSync(join(assetsDir, `guest_anim_${i + 1}.png`), createMinimalPng(256, 32, r, g, b));
}

console.log("Placeholder assets generated in public/pixel-assets/");
```

Run: `npx tsx scripts/generate-placeholder-assets.ts`
Expected: Files created in `public/pixel-assets/`

**Step 4: Verify assets exist**

Run: `ls -la public/pixel-assets/`
Expected: `office-bg.png` and `guest_anim_1.png` through `guest_anim_6.png`

**Step 5: Commit**

```bash
git add package.json package-lock.json public/pixel-assets/ scripts/generate-placeholder-assets.ts
git commit -m "feat: install Phaser 3 and generate placeholder pixel assets"
```

---

### Task 2: Create pixel office constants and types

**Files:**
- Create: `src/components/pixel-office/constants.ts`

**Step 1: Create the constants file**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/components/pixel-office/constants.ts
git commit -m "feat: add pixel office constants and area definitions"
```

---

### Task 3: Create OfficeScene (Phaser Scene)

**Files:**
- Create: `src/components/pixel-office/office-scene.ts`

This is the core Phaser Scene that manages the office background, agent sprites, and interactions.

**Step 1: Create the OfficeScene class**

```typescript
import Phaser from "phaser";
import type { Agent, AgentStatus } from "@/types";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPRITE_FRAME_SIZE,
  SPRITE_SCALE,
  SPRITE_FRAME_COUNT,
  SPRITE_FRAME_RATE,
  CHARACTER_VARIANTS,
  DEPTH,
  MOVE_TWEEN_MS,
  HIGHLIGHT_DURATION_MS,
  STATUS_LABELS,
  getCharacterVariant,
  getRandomPositionInArea,
  getAreaForStatus,
} from "./constants";

interface AgentSpriteData {
  sprite: Phaser.GameObjects.Sprite;
  nameLabel: Phaser.GameObjects.Text;
  currentStatus: AgentStatus;
  targetX: number;
  targetY: number;
}

export class OfficeScene extends Phaser.Scene {
  private agentSprites: Map<string, AgentSpriteData> = new Map();
  private onAgentClick?: (agentId: string) => void;

  constructor() {
    super({ key: "OfficeScene" });
  }

  setAgentClickHandler(handler: (agentId: string) => void) {
    this.onAgentClick = handler;
  }

  preload() {
    this.load.image("office_bg", "/pixel-assets/office-bg.png");

    for (let i = 1; i <= CHARACTER_VARIANTS; i++) {
      this.load.spritesheet(`guest_anim_${i}`, `/pixel-assets/guest_anim_${i}.png`, {
        frameWidth: SPRITE_FRAME_SIZE,
        frameHeight: SPRITE_FRAME_SIZE,
      });
    }
  }

  create() {
    // Background
    const bg = this.add.image(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, "office_bg");
    bg.setDisplaySize(CANVAS_WIDTH, CANVAS_HEIGHT);
    bg.setDepth(DEPTH.BACKGROUND);

    // Area labels
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: "11px",
      color: "#71717a",
      fontFamily: "monospace",
    };
    this.add.text(180, 70, "工作区", labelStyle).setDepth(DEPTH.FURNITURE).setOrigin(0.5);
    this.add.text(480, 70, "休息区", labelStyle).setDepth(DEPTH.FURNITURE).setOrigin(0.5);
    this.add.text(740, 70, "服务器区", labelStyle).setDepth(DEPTH.FURNITURE).setOrigin(0.5);
    this.add.text(905, 155, "门口", labelStyle).setDepth(DEPTH.FURNITURE).setOrigin(0.5);

    // Zone boundary lines (subtle)
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x27272a, 0.5);
    // Vertical dividers
    graphics.lineBetween(365, 60, 365, 300);
    graphics.lineBetween(605, 60, 605, 300);
    graphics.lineBetween(855, 60, 855, 300);
    graphics.setDepth(DEPTH.FURNITURE);

    // Create idle animations for each character variant
    for (let i = 1; i <= CHARACTER_VARIANTS; i++) {
      if (!this.anims.exists(`guest_idle_${i}`)) {
        this.anims.create({
          key: `guest_idle_${i}`,
          frames: this.anims.generateFrameNumbers(`guest_anim_${i}`, {
            start: 0,
            end: SPRITE_FRAME_COUNT - 1,
          }),
          frameRate: SPRITE_FRAME_RATE,
          repeat: -1,
        });
      }
    }
  }

  /** Update all agent sprites based on new agent data */
  updateAgents(agents: Agent[]) {
    const currentIds = new Set(agents.map((a) => a.id));

    // Remove sprites for agents that no longer exist
    for (const [id, data] of this.agentSprites) {
      if (!currentIds.has(id)) {
        data.sprite.destroy();
        data.nameLabel.destroy();
        this.agentSprites.delete(id);
      }
    }

    // Add or update sprites
    for (const agent of agents) {
      const existing = this.agentSprites.get(agent.id);
      if (existing) {
        this.updateAgentSprite(agent, existing);
      } else {
        this.createAgentSprite(agent);
      }
    }
  }

  private createAgentSprite(agent: Agent) {
    const variant = getCharacterVariant(agent.id);
    const area = getAreaForStatus(agent.status);
    const pos = getRandomPositionInArea(area);

    const sprite = this.add.sprite(pos.x, pos.y, `guest_anim_${variant}`, 0);
    sprite.setScale(SPRITE_SCALE);
    sprite.setDepth(DEPTH.AGENT_SPRITE);
    sprite.play(`guest_idle_${variant}`);
    sprite.setInteractive({ useHandCursor: true });

    // Click handler
    sprite.on("pointerdown", () => {
      this.onAgentClick?.(agent.id);
    });

    // Hover effect
    sprite.on("pointerover", () => {
      sprite.setScale(SPRITE_SCALE * 1.15);
    });
    sprite.on("pointerout", () => {
      sprite.setScale(SPRITE_SCALE);
    });

    // Offline agents are semi-transparent
    if (agent.status === "offline") {
      sprite.setAlpha(0.4);
    }

    // Error agents get a red tint
    if (agent.status === "error") {
      sprite.setTint(0xff6666);
    }

    // Name label
    const displayName = agent.emoji ? `${agent.emoji} ${agent.name}` : agent.name;
    const nameLabel = this.add.text(pos.x, pos.y - SPRITE_FRAME_SIZE * SPRITE_SCALE / 2 - 8, displayName, {
      fontSize: "10px",
      color: "#fafafa",
      fontFamily: "monospace",
      backgroundColor: "#18181bee",
      padding: { x: 4, y: 2 },
    });
    nameLabel.setOrigin(0.5, 1);
    nameLabel.setDepth(DEPTH.NAME_LABEL);

    this.agentSprites.set(agent.id, {
      sprite,
      nameLabel,
      currentStatus: agent.status,
      targetX: pos.x,
      targetY: pos.y,
    });
  }

  private updateAgentSprite(agent: Agent, data: AgentSpriteData) {
    // If status changed, move to new area
    if (data.currentStatus !== agent.status) {
      const area = getAreaForStatus(agent.status);
      const pos = getRandomPositionInArea(area);
      data.targetX = pos.x;
      data.targetY = pos.y;
      data.currentStatus = agent.status;

      // Tween sprite to new position
      this.tweens.add({
        targets: data.sprite,
        x: pos.x,
        y: pos.y,
        duration: MOVE_TWEEN_MS,
        ease: "Power2",
      });

      // Tween name label along with sprite
      this.tweens.add({
        targets: data.nameLabel,
        x: pos.x,
        y: pos.y - SPRITE_FRAME_SIZE * SPRITE_SCALE / 2 - 8,
        duration: MOVE_TWEEN_MS,
        ease: "Power2",
      });

      // Update visual state
      data.sprite.clearTint();
      data.sprite.setAlpha(1);

      if (agent.status === "offline") {
        this.tweens.add({
          targets: data.sprite,
          alpha: 0.4,
          duration: MOVE_TWEEN_MS,
        });
      }
      if (agent.status === "error") {
        this.time.delayedCall(MOVE_TWEEN_MS, () => {
          data.sprite.setTint(0xff6666);
        });
      }
    }
  }

  /** Highlight a specific agent sprite (called when card is clicked) */
  highlightAgent(agentId: string) {
    const data = this.agentSprites.get(agentId);
    if (!data) return;

    // Bounce animation
    this.tweens.add({
      targets: data.sprite,
      y: data.sprite.y - 20,
      duration: 200,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
    });

    // Show status bubble
    const bubbleText = STATUS_LABELS[data.currentStatus];
    const bubble = this.add.text(
      data.sprite.x,
      data.sprite.y - SPRITE_FRAME_SIZE * SPRITE_SCALE / 2 - 24,
      bubbleText,
      {
        fontSize: "11px",
        color: "#09090b",
        fontFamily: "monospace",
        backgroundColor: "#fafafa",
        padding: { x: 6, y: 3 },
      }
    );
    bubble.setOrigin(0.5, 1);
    bubble.setDepth(DEPTH.STATUS_BUBBLE);

    // Auto-remove bubble
    this.time.delayedCall(HIGHLIGHT_DURATION_MS, () => {
      bubble.destroy();
    });
  }
}
```

**Step 2: Commit**

```bash
git add src/components/pixel-office/office-scene.ts
git commit -m "feat: add OfficeScene with agent sprites and area mapping"
```

---

### Task 4: Create PixelOffice React wrapper component

**Files:**
- Create: `src/components/pixel-office/pixel-office.tsx`

This wraps the Phaser game in a React component and exposes imperative methods.

**Step 1: Create the component**

```tsx
"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import type { Agent } from "@/types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./constants";
import { OfficeScene } from "./office-scene";

export interface PixelOfficeHandle {
  highlightAgent: (agentId: string) => void;
}

interface Props {
  agents: Agent[];
  onAgentClick?: (agentId: string) => void;
}

const PixelOffice = forwardRef<PixelOfficeHandle, Props>(function PixelOffice(
  { agents, onAgentClick },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    highlightAgent(agentId: string) {
      sceneRef.current?.highlightAgent(agentId);
    },
  }));

  // Initialize Phaser game
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const scene = new OfficeScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      parent: containerRef.current,
      backgroundColor: "#09090b",
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
      },
      scene: scene,
    });

    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // Update click handler
  const onAgentClickRef = useRef(onAgentClick);
  onAgentClickRef.current = onAgentClick;

  useEffect(() => {
    sceneRef.current?.setAgentClickHandler((agentId) => {
      onAgentClickRef.current?.(agentId);
    });
  }, []);

  // Update agents when data changes
  const updateAgents = useCallback((agentList: Agent[]) => {
    const scene = sceneRef.current;
    if (!scene || !scene.scene?.isActive()) return;
    scene.updateAgents(agentList);
  }, []);

  useEffect(() => {
    // Small delay to ensure scene is created
    const timer = setTimeout(() => updateAgents(agents), 100);
    return () => clearTimeout(timer);
  }, [agents, updateAgents]);

  return (
    <div
      ref={containerRef}
      data-testid="pixel-office"
      className="w-full rounded-lg overflow-hidden border"
      style={{
        borderColor: "var(--border)",
        maxHeight: "320px",
        aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
      }}
    />
  );
});

export default PixelOffice;
```

**Step 2: Commit**

```bash
git add src/components/pixel-office/pixel-office.tsx
git commit -m "feat: add PixelOffice React wrapper with imperative API"
```

---

### Task 5: Create AgentsPageClient component

**Files:**
- Create: `src/components/agents-page-client.tsx`

This client component handles polling, state management, and bidirectional click interaction.

**Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Agent } from "@/types";
import type { PixelOfficeHandle } from "@/components/pixel-office/pixel-office";
import { AgentCard } from "@/components/agent-card";
import { POLL_INTERVAL_MS, HIGHLIGHT_DURATION_MS } from "@/components/pixel-office/constants";

const PixelOffice = dynamic(() => import("@/components/pixel-office/pixel-office"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-lg animate-pulse"
      style={{
        background: "var(--card)",
        maxHeight: "320px",
        aspectRatio: "960 / 320",
      }}
    />
  ),
});

interface Props {
  initialAgents: (Agent & { _count: { tasks: number } })[];
}

export function AgentsPageClient({ initialAgents }: Props) {
  const [agents, setAgents] = useState(initialAgents);
  const [highlightedAgentId, setHighlightedAgentId] = useState<string | null>(null);
  const pixelOfficeRef = useRef<PixelOfficeHandle>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Poll for agent updates
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
        }
      } catch {
        // Keep existing data on failure
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Handle click on pixel sprite → highlight card
  const handleSpriteClick = useCallback((agentId: string) => {
    setHighlightedAgentId(agentId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedAgentId(null), HIGHLIGHT_DURATION_MS);

    // Scroll card into view
    const cardEl = document.querySelector(`[data-agent-id="${agentId}"]`);
    cardEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // Handle click on card → highlight sprite
  const handleCardClick = useCallback((agentId: string) => {
    pixelOfficeRef.current?.highlightAgent(agentId);
    setHighlightedAgentId(agentId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedAgentId(null), HIGHLIGHT_DURATION_MS);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <header
        className="h-14 px-6 border-b flex items-center shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className="text-lg font-semibold">🤖 Agent 中心</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Pixel Office Scene */}
        <div className="max-w-5xl">
          <PixelOffice
            ref={pixelOfficeRef}
            agents={agents}
            onAgentClick={handleSpriteClick}
          />
        </div>

        {/* Agent Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          {agents.map((agent) => (
            <div
              key={agent.id}
              data-agent-id={agent.id}
              onClick={() => handleCardClick(agent.id)}
              className="cursor-pointer transition-all duration-300"
              style={{
                borderRadius: "0.5rem",
                outline: highlightedAgentId === agent.id
                  ? "2px solid var(--primary)"
                  : "2px solid transparent",
                outlineOffset: "2px",
              }}
            >
              <AgentCard agent={agent} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/agents-page-client.tsx
git commit -m "feat: add AgentsPageClient with polling and click interaction"
```

---

### Task 6: Update the agents page to use client component

**Files:**
- Modify: `src/app/agents/page.tsx`

**Step 1: Update the server component**

Replace the entire content of `src/app/agents/page.tsx` with:

```tsx
import { gatewayClient } from "@/lib/gateway-client";
import { syncAgentsFromGateway, getAgentsWithInferredStatus } from "@/lib/agent-sync";
import { AgentsPageClient } from "@/components/agents-page-client";
import type { Agent } from "@/types";

export default async function AgentsPage() {
  let agentList: (Agent & { _count: { tasks: number } })[];

  // Sync from Gateway if connected
  if (gatewayClient.isConnected) {
    try {
      agentList = (await syncAgentsFromGateway()) as (Agent & {
        _count: { tasks: number };
      })[];
    } catch {
      agentList = (await getAgentsWithInferredStatus()) as (Agent & {
        _count: { tasks: number };
      })[];
    }
  } else {
    agentList = (await getAgentsWithInferredStatus()) as (Agent & {
      _count: { tasks: number };
    })[];
  }

  return <AgentsPageClient initialAgents={agentList} />;
}
```

**Step 2: Run the dev server and verify it loads**

Run: `npm run dev -- -p 3003`

Open `http://localhost:3003/agents` and verify:
- Page loads without errors
- Pixel office canvas appears at the top (dark rectangle with zone labels)
- Agent cards appear below
- Console has no errors

**Step 3: Commit**

```bash
git add src/app/agents/page.tsx
git commit -m "feat: wire up pixel office visualization in agents page"
```

---

### Task 7: Update E2E tests

**Files:**
- Modify: `e2e/07-agent-hub.spec.ts`

**Step 1: Update the E2E test**

Replace the entire content of `e2e/07-agent-hub.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Agent Hub", () => {
  test("agent hub page renders correctly", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    // Page heading is always present
    await expect(page.getByRole("heading", { name: /Agent 中心/ })).toBeVisible();
  });

  test("pixel office canvas renders", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(2000);

    // The pixel office container should be present
    const pixelOffice = page.locator("[data-testid='pixel-office']");
    await expect(pixelOffice).toBeVisible();

    // Should contain a canvas element (Phaser renders to canvas)
    const canvas = pixelOffice.locator("canvas");
    await expect(canvas).toBeVisible();
  });

  test("agent cards render when agents exist", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(2000);

    // Check if any agent cards are rendered (from Gateway or DB cache)
    const cards = page.locator("[data-testid='agent-card']");
    const count = await cards.count();

    if (count > 0) {
      // Each card should have a name and status indicator
      const firstCard = cards.first();
      await expect(firstCard).toBeVisible();
    }
  });

  test("clicking agent card highlights it", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(2000);

    const cards = page.locator("[data-agent-id]");
    const count = await cards.count();

    if (count > 0) {
      const firstCard = cards.first();
      await firstCard.click();

      // Card should get a highlight outline
      const outline = await firstCard.evaluate(
        (el) => getComputedStyle(el).outline
      );
      expect(outline).toContain("var(--primary)");
    }
  });

  test("sidebar is visible on agent hub page", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText("公司客服")).toBeVisible();
  });
});
```

**Step 2: Run E2E tests to verify**

Run: `npx playwright test e2e/07-agent-hub.spec.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add e2e/07-agent-hub.spec.ts
git commit -m "test: update agent hub E2E tests for pixel office canvas"
```

---

### Task 8: Manual smoke test and final polish

**Step 1: Run the full dev server**

Run: `npm run dev -- -p 3003`

**Step 2: Manual verification checklist**

Open `http://localhost:3003/agents` and verify:

- [ ] Page loads without console errors
- [ ] Pixel office canvas renders at the top with dark background
- [ ] Zone labels ("工作区", "休息区", "服务器区", "门口") are visible
- [ ] If agents exist, pixel sprites appear in the corresponding zones
- [ ] Hovering over a sprite enlarges it slightly
- [ ] Clicking a sprite scrolls to and highlights the corresponding card below
- [ ] Clicking a card triggers a bounce animation on the sprite above
- [ ] Highlight border disappears after 3 seconds
- [ ] Page is responsive (canvas scales down on narrow viewport)
- [ ] Offline agents appear semi-transparent near the door
- [ ] Error agents have a red tint

**Step 3: Run full E2E suite**

Run: `npx playwright test`
Expected: All tests pass, including the updated agent hub tests

**Step 4: Run build to ensure no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Install Phaser 3 + placeholder assets | `package.json`, `public/pixel-assets/` |
| 2 | Constants and types | `src/components/pixel-office/constants.ts` |
| 3 | OfficeScene (Phaser Scene) | `src/components/pixel-office/office-scene.ts` |
| 4 | PixelOffice React wrapper | `src/components/pixel-office/pixel-office.tsx` |
| 5 | AgentsPageClient (polling + interaction) | `src/components/agents-page-client.tsx` |
| 6 | Wire up agents page | `src/app/agents/page.tsx` |
| 7 | Update E2E tests | `e2e/07-agent-hub.spec.ts` |
| 8 | Smoke test + final polish | Manual testing |
