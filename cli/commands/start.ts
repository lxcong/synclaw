import { spawn } from "child_process";
import fs from "fs";
import { PATHS } from "../lib/paths.js";
import { getRunningProcess, writePidFile } from "../lib/process.js";
import { success, error, warn, info } from "../lib/output.js";

interface StartOptions {
  port: string;
  host: string;
  dev: boolean;
}

export function startCommand(opts: StartOptions) {
  const port = parseInt(opts.port, 10);
  const host = opts.host;
  const mode = opts.dev ? "development" : "production";

  // Check if already running
  const running = getRunningProcess();
  if (running) {
    warn(`SyncClaw is already running (PID: ${running.pid}, port: ${running.port})`);
    return;
  }

  // Production mode: check .next/ exists
  if (!opts.dev && !fs.existsSync(PATHS.nextDir)) {
    error("No .next/ build found. Run 'npm run build' first or use --dev for development mode.");
    process.exit(1);
  }

  // Ensure log directory exists
  fs.mkdirSync(PATHS.logDir, { recursive: true });

  // Open log file for append
  const logFd = fs.openSync(PATHS.logFile, "a");

  // Build command args
  const args = opts.dev
    ? ["dev", "--turbopack", "-p", String(port), "-H", host]
    : ["start", "-p", String(port), "-H", host];

  info(`Starting SyncClaw in ${mode} mode on ${host}:${port}...`);

  const child = spawn(PATHS.nextBin, args, {
    cwd: PATHS.root,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env },
  });

  child.unref();
  fs.closeSync(logFd);

  const pid = child.pid!;

  writePidFile({
    pid,
    port,
    host,
    mode,
    startedAt: new Date().toISOString(),
  });

  // Wait 2 seconds and verify process is alive
  setTimeout(() => {
    try {
      process.kill(pid, 0);
      success(`SyncClaw started (PID: ${pid})`);
      info(`Logs: ${PATHS.logFile}`);
    } catch {
      error("SyncClaw failed to start. Last log lines:");
      try {
        const log = fs.readFileSync(PATHS.logFile, "utf-8");
        const lines = log.trim().split("\n").slice(-10);
        lines.forEach((l) => console.log(`  ${l}`));
      } catch {
        error("Could not read log file.");
      }
      process.exit(1);
    }
  }, 2000);
}
