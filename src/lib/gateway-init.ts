import { gatewayClient } from "./gateway-client";
import { handleGlobalAgentEvent } from "./task-auto-tracker";

let initialized = false;

export async function initGateway() {
  if (initialized) return;
  initialized = true;

  // Register global listener before connecting so no events are missed
  gatewayClient.onAgentEvent((event) => {
    handleGlobalAgentEvent(event).catch((err) =>
      console.error("[gateway-init] Global event handler error:", err)
    );
  });

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

// Auto-init on module load (server-side only)
if (typeof window === "undefined") {
  initGateway();
}
