/** E2E: POST /api/v1/health/scan-analysis */
import { runDecisionApiE2E } from "./health-decision-apis-e2e-lib.mjs";
runDecisionApiE2E("scan-analysis").catch((e) => {
  console.error(e);
  process.exit(1);
});
