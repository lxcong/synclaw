import path from "path";

const ROOT = process.cwd();

export const PATHS = {
  root: ROOT,
  pidFile: path.join(ROOT, ".data", "synclaw.pid"),
  logFile: path.join(ROOT, ".data", "logs", "synclaw.log"),
  logDir: path.join(ROOT, ".data", "logs"),
  dataDir: path.join(ROOT, ".data"),
  nextDir: path.join(ROOT, ".next"),
  nextBin: path.join(ROOT, "node_modules", ".bin", "next"),
};
