import type { StreamCreateInput, SurveillanceProfile } from "../../contracts/surveillance-api";

export type { SurveillanceProfile };

type ProfilePartial = Pick<
  StreamCreateInput,
  "detect" | "behaviors" | "anomaly" | "outputs" | "alerts"
>;

/**
 * Built-in presets: partial stream config merged under user request (user wins on conflicts).
 */
export const SURVEILLANCE_PROFILES: Record<SurveillanceProfile, ProfilePartial> = {
  retail_security: {
    detect: ["person", "backpack", "handbag"],
    behaviors: [
      { type: "loitering", zone: "sales_floor", seconds: 120 },
      { type: "crowd_growth", zone: "checkout", count: 12, window_sec: 60 },
      { type: "object_left", zone: "aisle", seconds: 180 },
    ],
    anomaly: { enabled: true, sensitivity: 0.65 },
    outputs: { delivery: ["sse"], format: "summary" },
    alerts: { min_severity: "warning", cooldown_seconds: 45, group_by: "zone" },
  },
  warehouse_safety: {
    detect: ["person", "forklift", "truck"],
    behaviors: [
      { type: "speed_violation", zone: "loading_dock", max_speed_mps: 3 },
      { type: "wrong_direction", zone: "one_way_lane", allowed_heading_deg: 90, tolerance_deg: 45 },
      { type: "perimeter_breach", zone: "restricted_storage", boundary: "inside" },
    ],
    anomaly: { enabled: true, sensitivity: 0.75 },
    outputs: { delivery: ["sse", "webhook"], format: "detailed" },
    alerts: { min_severity: "warning", cooldown_seconds: 20, group_by: "type" },
  },
  smart_city: {
    detect: ["person", "car", "bicycle", "bus"],
    behaviors: [
      { type: "crowd_growth", zone: "crosswalk", count: 25, window_sec: 120 },
      { type: "speed_violation", zone: "artery", max_speed_mps: 20 },
      { type: "wrong_direction", zone: "bus_lane", allowed_heading_deg: 0, tolerance_deg: 30 },
    ],
    anomaly: { enabled: true, sensitivity: 0.5 },
    outputs: { delivery: ["sse"], format: "summary" },
    alerts: { min_severity: "info", cooldown_seconds: 60, group_by: "zone" },
  },
  residential_perimeter: {
    detect: ["person", "car"],
    behaviors: [
      { type: "intrusion", zone: "yard_night", classes: ["person"] },
      { type: "loitering", zone: "driveway", seconds: 300 },
    ],
    anomaly: { enabled: true, sensitivity: 0.7 },
    outputs: { delivery: ["sse", "webhook"], format: "summary" },
    alerts: { min_severity: "warning", cooldown_seconds: 60, group_by: "zone" },
  },
  construction_site: {
    detect: ["person", "truck", "crane"],
    behaviors: [
      { type: "perimeter_breach", zone: "hazard_zone", boundary: "inside" },
      { type: "crowd_growth", zone: "scaffold_base", count: 15, window_sec: 90 },
    ],
    anomaly: { enabled: true, sensitivity: 0.72 },
    outputs: { delivery: ["sse"], format: "detailed" },
    alerts: { min_severity: "critical", cooldown_seconds: 30, group_by: "zone" },
  },
  parking_lot: {
    detect: ["car", "person"],
    behaviors: [
      { type: "loitering", zone: "vehicle_rows", seconds: 600 },
      { type: "intrusion", zone: "after_hours", classes: ["person", "car"] },
      { type: "speed_violation", zone: "lot_drive", max_speed_mps: 8 },
    ],
    anomaly: { enabled: true, sensitivity: 0.6 },
    outputs: { delivery: ["sse"], format: "summary" },
    alerts: { min_severity: "info", cooldown_seconds: 90, group_by: "type" },
  },
  school_campus: {
    detect: ["person", "backpack"],
    behaviors: [
      { type: "crowd_growth", zone: "cafeteria", count: 80, window_sec: 300 },
      { type: "loitering", zone: "parking", seconds: 240 },
      { type: "intrusion", zone: "restricted_staff", classes: ["person"] },
    ],
    anomaly: { enabled: true, sensitivity: 0.55 },
    outputs: { delivery: ["sse", "webhook"], format: "detailed" },
    alerts: { min_severity: "warning", cooldown_seconds: 45, group_by: "zone" },
  },
  healthcare_facility: {
    detect: ["person", "wheelchair"],
    behaviors: [
      { type: "loitering", zone: "patient_wing", seconds: 900 },
      { type: "crowd_growth", zone: "er_waiting", count: 40, window_sec: 600 },
      { type: "perimeter_breach", zone: "pharmacy", boundary: "inside" },
    ],
    anomaly: { enabled: true, sensitivity: 0.58 },
    outputs: { delivery: ["sse"], format: "summary" },
    alerts: { min_severity: "warning", cooldown_seconds: 30, group_by: "zone" },
  },
};

export function getProfilePartial(profile: SurveillanceProfile): ProfilePartial {
  return SURVEILLANCE_PROFILES[profile];
}

/**
 * Deep-merge profile defaults with user body. User arrays and explicit fields override profile.
 */
export function mergeStreamConfig(
  user: StreamCreateInput,
  profile?: SurveillanceProfile
): StreamCreateInput {
  if (!profile) return user;
  const base = SURVEILLANCE_PROFILES[profile];
  return {
    ...user,
    detect: user.detect?.length ? user.detect : base.detect ?? user.detect,
    behaviors: user.behaviors?.length ? user.behaviors : base.behaviors ?? user.behaviors,
    anomaly: user.anomaly ?? base.anomaly,
    outputs: {
      delivery: user.outputs?.delivery ?? base.outputs?.delivery ?? ["sse"],
      format: user.outputs?.format ?? base.outputs?.format ?? "summary",
      webhook_url: user.outputs?.webhook_url ?? base.outputs?.webhook_url,
      email: user.outputs?.email ?? base.outputs?.email,
    },
    alerts: {
      min_severity: user.alerts?.min_severity ?? base.alerts?.min_severity ?? "info",
      cooldown_seconds: user.alerts?.cooldown_seconds ?? base.alerts?.cooldown_seconds ?? 30,
      group_by: user.alerts?.group_by ?? base.alerts?.group_by ?? "zone",
    },
    profile: user.profile ?? profile,
  };
}
