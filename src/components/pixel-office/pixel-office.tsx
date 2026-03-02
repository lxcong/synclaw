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
