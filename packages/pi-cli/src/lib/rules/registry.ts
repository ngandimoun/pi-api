/**
 * Jutsu Registry — catalog of Pi rules (synced with definitions/built-in.json).
 */
import builtIn from "./definitions/built-in.json";

export const RULE_IDS = Object.freeze(builtIn.map((d) => d.id)) as readonly string[];

export type RuleId = (typeof builtIn)[number]["id"];
