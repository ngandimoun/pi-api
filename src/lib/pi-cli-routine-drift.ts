/**
 * Re-export routine drift detection for app code (CLI uses `pi-routine-spec` directly).
 * @see packages/pi-routine-spec/src/drift.ts
 */
export { detectRoutineDrift, type DriftViolation } from "pi-routine-spec";
