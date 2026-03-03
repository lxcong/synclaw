import { getRunningProcess } from "../lib/process.js";
import { success, error, label, header } from "../lib/output.js";

export async function statusCommand() {
  const running = getRunningProcess();

  if (!running) {
    error("SyncClaw is not running.");
    return;
  }

  const uptime = formatUptime(new Date(running.startedAt));

  header("SyncClaw Status");
  success("Running");
  label("PID", String(running.pid));
  label("Port", String(running.port));
  label("Host", running.host);
  label("Mode", running.mode);
  label("Uptime", uptime);
  label("Started", running.startedAt);

  // Fetch gateway status
  try {
    const res = await fetch(`http://localhost:${running.port}/api/gateway/status`);
    if (res.ok) {
      const data = await res.json();
      console.log();
      header("Gateway");
      label("Connected", data.connected ? "yes" : "no");
      label("URL", data.url);
    }
  } catch {
    console.log();
    label("Gateway", "unable to reach (server may still be starting)");
  }
}

function formatUptime(startedAt: Date): string {
  const diff = Date.now() - startedAt.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
