import { execSync } from "child_process";
import path from "path";

export default function globalSetup() {
  const projectRoot = path.resolve(__dirname, "..");
  const env = {
    ...process.env,
    DATABASE_URL: "file:./dev.db",
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes",
  };
  // Re-seed the database before all tests to ensure clean state
  execSync("npx prisma db push --force-reset && npx tsx prisma/seed.ts", {
    cwd: projectRoot,
    stdio: "inherit",
    env,
  });
}
