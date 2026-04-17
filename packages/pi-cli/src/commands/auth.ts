import chalk from "chalk";
import { PiApiClient } from "../lib/api-client.js";
import { clearGlobalConfig, getApiKey, setGlobalConfig } from "../lib/config.js";

export async function runAuthStatus(): Promise<void> {
  const key = getApiKey();
  if (!key) {
    console.log(chalk.yellow("Not authenticated. Run pi-hokage or `pi auth login --api-key`."));
    return;
  }
  const client = new PiApiClient();
  const v = await client.verify();
  console.log(
    v.valid ? chalk.green("Authenticated") : chalk.red("Invalid key"),
    v.organization_id ? `org=${v.organization_id}` : ""
  );
}

export async function runAuthLogin(apiKey: string, baseUrl?: string): Promise<void> {
  const client = new PiApiClient({ apiKey, baseUrl });
  const v = await client.verify();
  if (!v.valid) {
    console.error(chalk.red("Verification failed."));
    process.exitCode = 1;
    return;
  }
  setGlobalConfig({
    apiKey,
    organizationId: v.organization_id ?? undefined,
    baseUrl,
  });
  console.log(chalk.green("✓"), "Credentials saved.");
}

export async function runAuthLogout(): Promise<void> {
  clearGlobalConfig();
  console.log(chalk.gray("Local Pi CLI config cleared (global)."));
}
