/**
 * Runs all health-related HTTP E2E suites in sequence.
 *
 * Prerequisites:
 * - Next.js app listening (default http://localhost:3000) — `npm run dev` or `npm run start`
 * - Supabase + Trigger.dev worker so async jobs complete
 * - `PI_API_KEY` or `UNKEY_ROOT_KEY` + `UNKEY_API_ID` (scripts mint a key if Unkey is set)
 * - `GEMINI_KEY` for LLM steps (optional tiers: MEDGEMMA_*, METABCI_*, HUATUOGPT_*, MONAI_*)
 *
 * Usage:
 *   npm run test:health-e2e
 *
 * Override base URL:
 *   PI_BASE_URL=http://127.0.0.1:3001 npm run test:health-e2e
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SUITES = [
  { file: "scripts/health-decision-apis-e2e.mjs", name: "Seven decision APIs (risk, adherence, notes, decision, medication, scan, research)" },
  { file: "scripts/health-triage-e2e.mjs", name: "Health triage (POST /api/v1/health/analyze)" },
  { file: "scripts/neuro-decode-e2e.mjs", name: "Neuro decode (motor_imagery, p300, ssvep)" },
  { file: "scripts/cognitive-wellness-e2e.mjs", name: "Cognitive wellness (POST /api/v1/health/wellness)" },
];

console.log(`
═══════════════════════════════════════════════════════════════
  Health E2E suite (${SUITES.length} scripts)
═══════════════════════════════════════════════════════════════
`);

for (let i = 0; i < SUITES.length; i++) {
  const { file, name } = SUITES[i];
  const scriptPath = path.join(root, file);
  console.log(`\n[${i + 1}/${SUITES.length}] ${name}`);
  console.log(`    node ${file}\n`);

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\n✖ Suite failed: ${file} (exit ${result.status ?? "unknown"})`);
    process.exit(result.status ?? 1);
  }
}

console.log(`
═══════════════════════════════════════════════════════════════
  All ${SUITES.length} health E2E suites passed.
═══════════════════════════════════════════════════════════════
`);
