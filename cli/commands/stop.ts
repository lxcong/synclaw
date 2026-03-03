import { getRunningProcess, removePidFile, isProcessRunning } from "../lib/process.js";
import { success, error, warn, info } from "../lib/output.js";

interface StopOptions {
  timeout: string;
}

export async function stopCommand(opts: StopOptions): Promise<void> {
  const timeoutMs = parseInt(opts.timeout, 10) * 1000;

  const running = getRunningProcess();
  if (!running) {
    warn("SyncClaw is not running.");
    return;
  }

  const { pid } = running;
  info(`Stopping SyncClaw (PID: ${pid})...`);

  // Send SIGTERM to process group
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // Process may have already exited
    removePidFile();
    success("SyncClaw stopped.");
    return;
  }

  // Poll every 500ms until process exits or timeout
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isProcessRunning(pid)) {
      removePidFile();
      success("SyncClaw stopped.");
      return;
    }
    await sleep(500);
  }

  // Timeout: force kill
  warn(`Process did not exit within ${opts.timeout}s, sending SIGKILL...`);
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // already gone
  }

  // Wait a bit for SIGKILL to take effect
  await sleep(1000);

  if (!isProcessRunning(pid)) {
    removePidFile();
    success("SyncClaw killed.");
  } else {
    error(`Failed to kill process ${pid}.`);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
