import { execSync } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const dryRun = process.argv.includes("--dry-run");
const env = {
  ...process.env,
  CLOUDFLARE_ENV: "staging",
  VITE_PADDLE_ENVIRONMENT: "sandbox",
  VITE_TURNSTILE_SITE_KEY:
    process.env.VITE_TURNSTILE_SITE_KEY ?? "0x4AAAAAAD45Qc4hHmixYPj9",
};

execSync(`${npmCommand} run build`, { env, stdio: "inherit" });
execSync(
  `${npmCommand} exec wrangler -- deploy --env staging${dryRun ? " --dry-run" : ""}`,
  { env, stdio: "inherit" },
);
