const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

export function success(msg: string) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

export function error(msg: string) {
  console.error(`${RED}✗${RESET} ${msg}`);
}

export function warn(msg: string) {
  console.log(`${YELLOW}!${RESET} ${msg}`);
}

export function info(msg: string) {
  console.log(`${BLUE}i${RESET} ${msg}`);
}

export function label(key: string, value: string) {
  console.log(`  ${DIM}${key}:${RESET} ${value}`);
}

export function header(msg: string) {
  console.log(`\n${BOLD}${msg}${RESET}`);
}
