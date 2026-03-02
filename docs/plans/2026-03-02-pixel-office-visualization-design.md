# Agent Hub Pixel Office Visualization Design

## Overview

在 Agent Hub 页面顶部添加像素风格的办公室可视化场景，以直观、有趣的方式展示各 agent 的工作状态。下方保留现有的 agent 卡片网格，两者通过点击联动。

参考项目: [Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI)

## Architecture

### Component Hierarchy

```
AgentsPage (Server Component)
  └── AgentsPageClient (Client Component)
       ├── PixelOffice (Phaser 3 game canvas, dynamic import, ssr: false)
       │    └── OfficeScene (Phaser.Scene)
       │         ├── Background Layer: pixel office background
       │         ├── Furniture Layer: desks, sofa, servers
       │         ├── Character Layer: agent pixel sprites
       │         └── UI Layer: name labels, status bubbles
       └── AgentCard[] (existing card grid, unchanged)
```

### Data Flow

1. Server Component loads initial agent list via `syncAgentsFromGateway()`
2. Client Component receives initial data via props
3. Client polls `GET /api/agents` every 5 seconds for status updates
4. State changes flow to OfficeScene via Phaser EventEmitter
5. Sprites tween-move to target area, play corresponding animation
6. Click sprite → React highlights card; click card → Phaser highlights sprite

### Technology

- **Rendering**: Phaser 3 (~1MB dependency, dynamic import)
- **Assets**: LimeZu free pixel character sprites (32x32, 8-frame idle loop, 6 variants)
- **SSR**: `next/dynamic` with `ssr: false` and skeleton loader fallback
- **State sync**: Client-side polling via `setInterval` + fetch

## Office Scene Layout

Canvas size: **960 x 320** pixels (3:1 widescreen ratio).

### Area Mapping

| Area | X Range | Agent Status | Visual Elements |
|------|---------|-------------|----------------|
| Work Zone (left) | 100-350 | `busy` | Desks, monitors |
| Break Zone (center) | 380-580 | `idle` | Sofa, coffee machine |
| Server Zone (right) | 620-860 | `error` | Server racks, warning lights |
| Door (far right) | 860-960 | `offline` | Door, semi-transparent sprites |

### Depth Layering

| Depth | Elements |
|-------|----------|
| 0 | Background image |
| 10 | Furniture (desks, sofa, servers) |
| 20 | Agent sprites |
| 30 | Name labels |
| 40 | Status bubbles |

## Character System

### Sprite Assignment

Each agent gets a deterministic character variant based on `agent.id` hash:

```typescript
function getCharacterVariant(agentId: string): number {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0;
  }
  return (hash % 6) + 1; // 1-6
}
```

### Sprite Rendering

- Frame size: 32x32
- Display scale: 3x (renders at 96x96 on screen)
- Animation: 8-frame idle loop at 8fps
- Name label: floating text above sprite (pixel font or system font)

### State Transitions

When agent status changes:
1. Target area coordinates calculated (random position within area bounds)
2. Phaser tween moves sprite to target over ~1 second (ease: 'Power2')
3. If entering `offline`, sprite fades to 50% opacity
4. If entering `error`, sprite gets a red tint overlay

## Interaction Design

### Sprite → Card

1. User clicks pixel sprite in canvas
2. Phaser emits `agent-selected` event with `agentId`
3. React scrolls to and highlights corresponding AgentCard (border glow)
4. Highlight auto-removes after 3 seconds

### Card → Sprite

1. User clicks AgentCard
2. React calls `pixelOfficeRef.highlightAgent(agentId)`
3. OfficeScene creates a bounce animation on the sprite
4. Status bubble appears above sprite for 3 seconds

### Hover

- Hovering over sprite shows a tooltip-style bubble with agent name and status text

## File Structure

```
src/
├── components/
│   ├── pixel-office/
│   │   ├── pixel-office.tsx      # React wrapper: mounts Phaser, handles lifecycle
│   │   ├── office-scene.ts       # Phaser Scene: background, furniture, agent sprites
│   │   ├── agent-sprite.ts       # Manages individual agent sprite + label + bubble
│   │   └── constants.ts          # Area coords, depths, config values
│   └── agents-page-client.tsx    # Client component: polling, state, layout
├── app/agents/
│   └── page.tsx                  # Modified: passes initial data to client component
└── public/
    └── pixel-assets/
        ├── office-bg.png         # Pixel art office background (960x320)
        ├── guest_anim_1.webp     # Character spritesheet variant 1
        ├── guest_anim_2.webp     # ... variant 2
        ├── guest_anim_3.webp     # ... variant 3
        ├── guest_anim_4.webp     # ... variant 4
        ├── guest_anim_5.webp     # ... variant 5
        └── guest_anim_6.webp     # ... variant 6
```

## API Changes

### New Endpoint: GET /api/agents

Already exists for card data. No changes needed — the client component will poll this endpoint.

### Response Shape (existing)

```typescript
interface AgentResponse {
  id: string;
  name: string;
  emoji: string;
  status: 'idle' | 'busy' | 'offline' | 'error';
  capabilities: string[];
  description: string;
  lastHeartbeat: string | null;
  _count: { tasks: number };
}
```

## SSR Compatibility

```tsx
import dynamic from 'next/dynamic';

const PixelOffice = dynamic(
  () => import('@/components/pixel-office/pixel-office'),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[320px] rounded-lg animate-pulse"
        style={{ background: 'var(--card)' }}
      />
    ),
  }
);
```

## Asset Strategy

- Use LimeZu's "Animated Mini Characters 2" (free, CC-BY licensed for non-commercial)
- Office background: create a simple pixel art background or find a suitable free asset
- If no suitable office background found, generate a minimal one with solid color zones and simple pixel furniture outlines
- All assets placed in `public/pixel-assets/` for static serving

## Error Handling

- If Phaser fails to load: show fallback skeleton, cards still work independently
- If polling fails: keep last known state, retry on next interval
- If no agents: show empty office with furniture only

## Performance Considerations

- Phaser canvas uses WebGL with Canvas 2D fallback
- Max sprites expected: ~20 agents (well within Phaser's capability)
- Polling interval: 5 seconds (configurable)
- Dynamic import prevents Phaser from affecting initial page load
