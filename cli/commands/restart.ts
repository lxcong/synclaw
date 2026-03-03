import { stopCommand } from "./stop.js";
import { startCommand } from "./start.js";
import { info } from "../lib/output.js";

interface RestartOptions {
  port: string;
  host: string;
  dev: boolean;
  timeout: string;
}

export async function restartCommand(opts: RestartOptions) {
  info("Restarting SyncClaw...");
  await stopCommand({ timeout: opts.timeout });
  startCommand({ port: opts.port, host: opts.host, dev: opts.dev });
}
