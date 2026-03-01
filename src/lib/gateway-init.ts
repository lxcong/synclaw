import { gatewayClient } from "./gateway-client";

let initialized = false;

export async function initGateway() {
  if (initialized) return;
  initialized = true;

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
