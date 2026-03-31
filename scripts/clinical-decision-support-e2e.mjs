/** E2E: POST /api/v1/health/decision-support */
import { runDecisionApiE2E } from "./health-decision-apis-e2e-lib.mjs";
runDecisionApiE2E("decision-support").catch((e) => {
  console.error(e);
  process.exit(1);
});
