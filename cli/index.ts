import { Command } from "commander";
import { startCommand } from "./commands/start.js";
import { stopCommand } from "./commands/stop.js";
import { restartCommand } from "./commands/restart.js";
import { statusCommand } from "./commands/status.js";
import { logsCommand } from "./commands/logs.js";

const program = new Command();

program
  .name("synclaw")
  .description("SyncClaw service manager")
  .version("0.1.3");

program
  .command("start")
  .description("Start SyncClaw in the background")
  .option("-p, --port <port>", "port to listen on", "3000")
  .option("-H, --host <host>", "host to bind to", "0.0.0.0")
  .option("-d, --dev", "start in development mode (next dev --turbopack)", false)
  .action(startCommand);

program
  .command("stop")
  .description("Stop SyncClaw")
  .option("-t, --timeout <seconds>", "seconds to wait before SIGKILL", "10")
  .action(stopCommand);

program
  .command("restart")
  .description("Restart SyncClaw")
  .option("-p, --port <port>", "port to listen on", "3000")
  .option("-H, --host <host>", "host to bind to", "0.0.0.0")
  .option("-d, --dev", "start in development mode", false)
  .option("-t, --timeout <seconds>", "seconds to wait before SIGKILL", "10")
  .action(restartCommand);

program
  .command("status")
  .description("Show SyncClaw status")
  .action(statusCommand);

program
  .command("logs")
  .description("View SyncClaw logs")
  .option("-f, --follow", "follow log output", false)
  .option("-n, --lines <count>", "number of lines to show", "50")
  .action(logsCommand);

program.parse();
