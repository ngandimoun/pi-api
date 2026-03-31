/** E2E: POST /api/v1/health/adherence */
import { runDecisionApiE2E } from "./health-decision-apis-e2e-lib.mjs";
runDecisionApiE2E("adherence").catch((e) => {
  console.error(e);
  process.exit(1);
});
