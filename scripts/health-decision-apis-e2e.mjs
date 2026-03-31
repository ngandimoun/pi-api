/**
 * E2E smoke for all seven health decision APIs (202 + job poll).
 *
 *   PI_API_KEY=pi_... node scripts/health-decision-apis-e2e.mjs
 */
import { runDecisionApiE2E } from "./health-decision-apis-e2e-lib.mjs";

runDecisionApiE2E().catch((e) => {
  console.error(e);
  process.exit(1);
});
