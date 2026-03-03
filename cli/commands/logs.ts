import { spawn } from "child_process";
import fs from "fs";
import { PATHS } from "../lib/paths.js";
import { error } from "../lib/output.js";

interface LogsOptions {
  follow: boolean;
  lines: string;
}

export function logsCommand(opts: LogsOptions) {
  if (!fs.existsSync(PATHS.logFile)) {
    error("No log file found. Has SyncClaw been started?");
    process.exit(1);
  }

  const args = ["-n", opts.lines];
  if (opts.follow) args.push("-f");
  args.push(PATHS.logFile);

  const tail = spawn("tail", args, { stdio: "inherit" });

  tail.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}
