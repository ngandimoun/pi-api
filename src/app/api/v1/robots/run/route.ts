import { withApiAuth } from "@/lib/auth";
import { queueRobotRun } from "@/lib/robotics/queue-robot-run";

/**
 * OpenAI-compatible async endpoint: start a robot run (perception + behaviors + decisions + actions).
 */
export const POST = withApiAuth(async (request) => {
  return queueRobotRun(request);
});

