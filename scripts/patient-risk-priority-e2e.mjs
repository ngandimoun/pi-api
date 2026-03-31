/** E2E: POST /api/v1/health/risk-priority — see health-decision-apis-e2e-lib.mjs */
import { runDecisionApiE2E } from "./health-decision-apis-e2e-lib.mjs";
runDecisionApiE2E("risk-priority").catch((e) => {
  console.error(e);
  process.exit(1);
});
