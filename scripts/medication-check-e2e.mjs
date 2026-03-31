/** E2E: POST /api/v1/health/medication-check */
import { runDecisionApiE2E } from "./health-decision-apis-e2e-lib.mjs";
runDecisionApiE2E("medication-check").catch((e) => {
  console.error(e);
  process.exit(1);
});
