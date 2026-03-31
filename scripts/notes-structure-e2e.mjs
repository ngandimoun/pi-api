/** E2E: POST /api/v1/health/notes-structure */
import { runDecisionApiE2E } from "./health-decision-apis-e2e-lib.mjs";
runDecisionApiE2E("notes-structure").catch((e) => {
  console.error(e);
  process.exit(1);
});
