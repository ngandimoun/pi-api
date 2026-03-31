/** E2E: POST /api/v1/health/research-assist */
import { runDecisionApiE2E } from "./health-decision-apis-e2e-lib.mjs";
runDecisionApiE2E("research-assist").catch((e) => {
  console.error(e);
  process.exit(1);
});
