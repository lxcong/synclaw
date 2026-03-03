import fs from "fs";
import path from "path";
import { PATHS } from "./paths.js";

export interface PidInfo {
  pid: number;
  port: number;
  host: string;
  mode: string;
  startedAt: string;
}

export function readPidFile(): PidInfo | null {
  try {
    const content = fs.readFileSync(PATHS.pidFile, "utf-8");
    return JSON.parse(content) as PidInfo;
  } catch {
    return null;
  }
}

export function writePidFile(info: PidInfo): void {
  fs.mkdirSync(path.dirname(PATHS.pidFile), { recursive: true });
  fs.writeFileSync(PATHS.pidFile, JSON.stringify(info, null, 2) + "\n");
}

export function removePidFile(): void {
  try {
    fs.unlinkSync(PATHS.pidFile);
  } catch {
    // already gone
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns PidInfo if process is alive, cleans up stale PID file otherwise.
 */
export function getRunningProcess(): PidInfo | null {
  const info = readPidFile();
  if (!info) return null;

  if (isProcessRunning(info.pid)) {
    return info;
  }

  // Stale PID file
  removePidFile();
  return null;
}
