/** Default Pi API base (override with PI_CLI_BASE_URL). */
export const DEFAULT_PI_BASE_URL = "https://piii-black.vercel.app";

export const PI_DIR = ".pi";
export const PI_CACHE_DIR = ".pi/.cache";
export const PI_PROMPT_CACHE_DIR = ".pi/prompt-cache";
export const PI_ROUTINES_DIR = ".pi/routines";
export const PI_RESONANCE_DIR = ".pi/resonance";
export const PI_CONSTITUTION_FILE = ".pi/constitution.md";
export const SYSTEM_STYLE_FILE = ".pi/system-style.json";
/** Agent handoff contract — paste into Cursor / Claude / Windsurf */
export const PI_HANDOFF_FILE = ".pi/handoff.md";
/** Last validate result cache for downstream consumption */
export const PI_LAST_VALIDATE_RESULT = ".pi/.last-validate-result.json";
/** Pi watch daemon metadata (JSON: pid, cwd, startedAt) */
export const PI_WATCH_PID_FILE = ".pi/.watch-pid.json";
/** Pi watch heartbeat for liveness (JSON: pid, lastTick, cwd, version) */
export const PI_WATCH_HEALTH_FILE = ".pi/.watch-health.json";
/** Exclusive lock — created by daemon child (wx) */
export const PI_WATCH_LOCK_FILE = ".pi/.watch.lock";
/** Append-only daemon log (rotates when large) */
export const PI_WATCH_LOG_FILE = ".pi/logs/watch.log";
/** Local timestamps for validate/prompt habit nudges (see cli-activity.ts) */
export const PI_CLI_ACTIVITY_FILE = ".pi/.cli-activity.json";
