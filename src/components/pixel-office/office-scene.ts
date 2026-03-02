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
  private onReadyCallback?: () => void;

  constructor() {
    super({ key: "OfficeScene" });
  }

  setAgentClickHandler(handler: (agentId: string) => void) {
    this.onAgentClick = handler;
  }

  /** Register a callback to fire once the scene's create() has completed */
  onReady(callback: () => void) {
    this.onReadyCallback = callback;
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
    this.add.text(180, 70, "\u5DE5\u4F5C\u533A", labelStyle).setDepth(DEPTH.FURNITURE).setOrigin(0.5);
    this.add.text(480, 70, "\u4F11\u606F\u533A", labelStyle).setDepth(DEPTH.FURNITURE).setOrigin(0.5);
    this.add.text(740, 70, "\u670D\u52A1\u5668\u533A", labelStyle).setDepth(DEPTH.FURNITURE).setOrigin(0.5);
    this.add.text(905, 155, "\u95E8\u53E3", labelStyle).setDepth(DEPTH.FURNITURE).setOrigin(0.5);

    // Zone boundary lines (subtle)
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x27272a, 0.5);
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

    // Notify React wrapper that scene is ready
    this.onReadyCallback?.();
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
