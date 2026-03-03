"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
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
  const sceneReadyRef = useRef(false);
  const pendingAgentsRef = useRef<Agent[]>(agents);
  const onAgentClickRef = useRef(onAgentClick);
  onAgentClickRef.current = onAgentClick;

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

    // Register ready callback BEFORE passing to Phaser
    // (onReady is called at end of scene.create())
    scene.onReady(() => {
      sceneReadyRef.current = true;
      scene.setAgentClickHandler((agentId) => {
        onAgentClickRef.current?.(agentId);
      });
      scene.updateAgents(pendingAgentsRef.current);
    });

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
      sceneReadyRef.current = false;
    };
  }, []);

  // Update agents when data changes
  useEffect(() => {
    pendingAgentsRef.current = agents;
    const scene = sceneRef.current;
    if (scene && sceneReadyRef.current) {
      scene.updateAgents(agents);
    }
  }, [agents]);

  return (
    <div
      ref={containerRef}
      data-testid="pixel-office"
      className="w-full rounded-lg overflow-hidden border"
      style={{
        borderColor: "var(--border)",
        maxHeight: "384px",
        aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
      }}
    />
  );
});

export default PixelOffice;
