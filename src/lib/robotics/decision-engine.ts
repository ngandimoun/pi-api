import type { Incident } from "../../contracts/surveillance-api";
import type { RobotAction, RobotActionRule, RobotCommand } from "../../contracts/robotics-api";

export function actionsForIncidents(params: {
  incidents: Incident[];
  actionRules: RobotActionRule[];
}): Array<{ incident: Incident; actions: RobotAction[]; ruleOn: string }> {
  const out: Array<{ incident: Incident; actions: RobotAction[]; ruleOn: string }> = [];
  for (const inc of params.incidents) {
    const rule = params.actionRules.find((r) => r.on === inc.type);
    if (!rule) continue;
    out.push({ incident: inc, actions: rule.do, ruleOn: rule.on });
  }
  return out;
}

export function extractCommands(actions: RobotAction[]): RobotCommand[] {
  const cmds: RobotCommand[] = [];
  for (const a of actions) {
    if (a.type === "command") cmds.push(a.command);
  }
  return cmds;
}

