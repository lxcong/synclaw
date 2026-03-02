import { gatewayClient } from "./gateway-client";
import { handleGlobalAgentEvent } from "./task-auto-tracker";

// Survive HMR: store cleanup function on globalThis so we can remove the
// previous listener before registering a new one on each module reload.
const g = globalThis as unknown as { __gatewayCleanup?: () => void };

export async function initGateway() {
  // Remove listener from previous HMR cycle (if any)
  if (g.__gatewayCleanup) {
    g.__gatewayCleanup();
  }

  const unsubscribe = gatewayClient.onAgentEvent((event) => {
    handleGlobalAgentEvent(event).catch((err) =>
      console.error("[gateway-init] Global event handler error:", err)
    );
  });
  g.__gatewayCleanup = unsubscribe;

  if (!gatewayClient.isConnected) {
    try {
      await gatewayClient.connect();
      console.log("[gateway] Connected to OpenClaw Gateway");
    } catch (err) {
      console.warn(
        "[gateway] Failed to connect (will retry on next request):",
        err instanceof Error ? err.message : err
      );
    }
  }
}

// Auto-init on module load (server-side only)
if (typeof window === "undefined") {
  initGateway();
}
