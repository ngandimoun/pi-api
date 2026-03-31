import { randomUUID } from "node:crypto";

import type {
  BehaviorRule,
  Incident,
  PerceptionResult,
  PolicyCreateInput,
} from "../../contracts/surveillance-api";

/** Axis-aligned zone in normalized or pixel coords (same space as xyxy). */
export type ZoneBox = {
  xyxy: [number, number, number, number];
};

export type ZoneMap = Record<string, ZoneBox>;

export type TrackPosition = {
  t: number;
  cx: number;
  cy: number;
  xyxy: [number, number, number, number];
};

export type TrackState = {
  positions: TrackPosition[];
  zone_entered_at: Record<string, number>;
  last_zone: Record<string, string | undefined>;
};

export type TrackStateMap = Record<number, TrackState>;

export type PolicyEngineContext = {
  nowMs: number;
  streamId: string;
  zones?: ZoneMap;
  /** Previous frame index processed (for velocity). */
  lastFrameIndex?: number;
};

function centerOf(xyxy: [number, number, number, number]): { cx: number; cy: number } {
  const [x1, y1, x2, y2] = xyxy;
  return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

function pointInZone(cx: number, cy: number, zone?: ZoneBox): boolean {
  if (!zone) return true;
  const [x1, y1, x2, y2] = zone.xyxy;
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
}

function labelMatches(want: string[] | undefined, detLabel: string): boolean {
  if (!want || want.length === 0) return true;
  return want.some((c) => c.toLowerCase() === detLabel.toLowerCase());
}

function severityFor(rule: BehaviorRule): Incident["severity"] {
  switch (rule.type) {
    case "intrusion":
    case "perimeter_breach":
      return "critical";
    case "speed_violation":
    case "crowd_growth":
      return "warning";
    default:
      return "info";
  }
}

function ensureTrackState(map: TrackStateMap, trackId: number): TrackState {
  if (!map[trackId]) {
    map[trackId] = { positions: [], zone_entered_at: {}, last_zone: {} };
  }
  return map[trackId];
}

/**
 * Updates track state from current perception (call each frame).
 */
export function updateTrackStateFromPerception(
  perception: PerceptionResult,
  ctx: PolicyEngineContext,
  state: TrackStateMap
): void {
  const now = ctx.nowMs;
  for (const tr of perception.tracks) {
    const st = ensureTrackState(state, tr.track_id);
    const { cx, cy } = centerOf(tr.xyxy);
    st.positions.push({ t: now, cx, cy, xyxy: tr.xyxy });
    if (st.positions.length > 64) {
      st.positions.splice(0, st.positions.length - 64);
    }
  }
}

function speedMps(st: TrackState): number | null {
  if (st.positions.length < 2) return null;
  const a = st.positions[st.positions.length - 2];
  const b = st.positions[st.positions.length - 1];
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0) return null;
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  return Math.hypot(dx, dy) / dt;
}

function headingDeg(st: TrackState): number | null {
  if (st.positions.length < 2) return null;
  const a = st.positions[st.positions.length - 2];
  const b = st.positions[st.positions.length - 1];
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  if (dx === 0 && dy === 0) return null;
  const rad = Math.atan2(dy, dx);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Evaluates inline behavior rules from the stream request against the latest perception.
 */
export function evaluateBehaviorRules(params: {
  perception: PerceptionResult;
  behaviors: BehaviorRule[];
  ctx: PolicyEngineContext;
  trackState: TrackStateMap;
}): Incident[] {
  const { perception, behaviors, ctx, trackState } = params;
  const incidents: Incident[] = [];
  const zones = ctx.zones ?? {};

  updateTrackStateFromPerception(perception, ctx, trackState);

  for (const rule of behaviors) {
    const zoneBox = zones[rule.zone];
    switch (rule.type) {
      case "intrusion": {
        for (const tr of perception.tracks) {
          const label =
            perception.detections.find((d) => {
              const tc = centerOf(tr.xyxy);
              const dc = centerOf(d.xyxy);
              return Math.hypot(dc.cx - tc.cx, dc.cy - tc.cy) < 48;
            })?.label ?? "person";
          if (!labelMatches(rule.classes, label)) continue;
          const { cx, cy } = centerOf(tr.xyxy);
          if (!pointInZone(cx, cy, zoneBox)) continue;
          incidents.push({
            id: randomUUID(),
            object: "surveillance.incident",
            stream_id: ctx.streamId,
            type: "intrusion",
            severity: severityFor(rule),
            created_at: Math.floor(ctx.nowMs / 1000),
            detections: perception.detections,
            tracks: [tr],
            anomaly_score: perception.anomaly_score ?? null,
            zone: rule.zone,
            metadata: { rule: "intrusion" },
          });
        }
        break;
      }
      case "loitering": {
        for (const tr of perception.tracks) {
          const { cx, cy } = centerOf(tr.xyxy);
          if (!pointInZone(cx, cy, zoneBox)) continue;
          const st = ensureTrackState(trackState, tr.track_id);
          const key = rule.zone;
          if (!st.zone_entered_at[key]) {
            st.zone_entered_at[key] = ctx.nowMs;
          }
          const elapsed = (ctx.nowMs - st.zone_entered_at[key]) / 1000;
          if (elapsed >= rule.seconds) {
            incidents.push({
              id: randomUUID(),
              object: "surveillance.incident",
              stream_id: ctx.streamId,
              type: "loitering",
              severity: "warning",
              created_at: Math.floor(ctx.nowMs / 1000),
              detections: perception.detections,
              tracks: [tr],
              anomaly_score: perception.anomaly_score ?? null,
              zone: rule.zone,
              metadata: { seconds_elapsed: elapsed },
            });
          }
        }
        break;
      }
      case "crowd_growth": {
        let count = 0;
        for (const tr of perception.tracks) {
          const { cx, cy } = centerOf(tr.xyxy);
          if (pointInZone(cx, cy, zoneBox)) count += 1;
        }
        if (count >= rule.count) {
          incidents.push({
            id: randomUUID(),
            object: "surveillance.incident",
            stream_id: ctx.streamId,
            type: "crowd_growth",
            severity: "warning",
            created_at: Math.floor(ctx.nowMs / 1000),
            detections: perception.detections,
            tracks: perception.tracks,
            anomaly_score: perception.anomaly_score ?? null,
            zone: rule.zone,
            metadata: { count, window_sec: rule.window_sec },
          });
        }
        break;
      }
      case "object_left": {
        if (perception.anomaly_score != null && perception.anomaly_score > 0.5) {
          incidents.push({
            id: randomUUID(),
            object: "surveillance.incident",
            stream_id: ctx.streamId,
            type: "object_left",
            severity: "info",
            created_at: Math.floor(ctx.nowMs / 1000),
            detections: perception.detections,
            tracks: perception.tracks,
            anomaly_score: perception.anomaly_score,
            zone: rule.zone,
            metadata: { note: "anomaly_proxy_for_object_left" },
          });
        }
        break;
      }
      case "perimeter_breach": {
        for (const tr of perception.tracks) {
          const { cx, cy } = centerOf(tr.xyxy);
          const inside = pointInZone(cx, cy, zoneBox);
          const st = ensureTrackState(trackState, tr.track_id);
          const prev = st.last_zone[rule.zone];
          const nowInside = inside;
          st.last_zone[rule.zone] = nowInside ? "in" : "out";
          if (rule.boundary === "inside" && prev === "out" && nowInside) {
            incidents.push({
              id: randomUUID(),
              object: "surveillance.incident",
              stream_id: ctx.streamId,
              type: "perimeter_breach",
              severity: "critical",
              created_at: Math.floor(ctx.nowMs / 1000),
              detections: perception.detections,
              tracks: [tr],
              anomaly_score: perception.anomaly_score ?? null,
              zone: rule.zone,
              metadata: { transition: "entered" },
            });
          }
        }
        break;
      }
      case "speed_violation": {
        for (const tr of perception.tracks) {
          const st = ensureTrackState(trackState, tr.track_id);
          const { cx, cy } = centerOf(tr.xyxy);
          if (!pointInZone(cx, cy, zoneBox)) continue;
          const v = speedMps(st);
          if (v != null && v > rule.max_speed_mps) {
            incidents.push({
              id: randomUUID(),
              object: "surveillance.incident",
              stream_id: ctx.streamId,
              type: "speed_violation",
              severity: "warning",
              created_at: Math.floor(ctx.nowMs / 1000),
              detections: perception.detections,
              tracks: [tr],
              anomaly_score: perception.anomaly_score ?? null,
              zone: rule.zone,
              metadata: { speed_mps: v, max: rule.max_speed_mps },
            });
          }
        }
        break;
      }
      case "wrong_direction": {
        for (const tr of perception.tracks) {
          const { cx, cy } = centerOf(tr.xyxy);
          if (!pointInZone(cx, cy, zoneBox)) continue;
          const st = ensureTrackState(trackState, tr.track_id);
          const h = headingDeg(st);
          if (h == null) break;
          if (angularDiff(h, rule.allowed_heading_deg) > rule.tolerance_deg) {
            incidents.push({
              id: randomUUID(),
              object: "surveillance.incident",
              stream_id: ctx.streamId,
              type: "wrong_direction",
              severity: "warning",
              created_at: Math.floor(ctx.nowMs / 1000),
              detections: perception.detections,
              tracks: [tr],
              anomaly_score: perception.anomaly_score ?? null,
              zone: rule.zone,
              metadata: { heading_deg: h, allowed: rule.allowed_heading_deg },
            });
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return incidents;
}

/**
 * Maps stored policies to engine evaluation (MVP: crowd + intrusion style from condition).
 */
export function evaluateStoredPolicies(params: {
  perception: PerceptionResult;
  policies: PolicyCreateInput[];
  ctx: PolicyEngineContext;
  trackState: TrackStateMap;
  zones?: ZoneMap;
}): Incident[] {
  const incidents: Incident[] = [];
  const { perception, policies, ctx, trackState } = params;

  for (const pol of policies) {
    if (!pol.enabled) continue;
    const zone = pol.condition.zone ?? "global";
    const zoneBox = params.zones?.[zone];

    if (pol.type === "crowd_growth" && pol.condition.count_threshold && pol.condition.window_sec) {
      let count = 0;
      for (const tr of perception.tracks) {
        const { cx, cy } = centerOf(tr.xyxy);
        if (pointInZone(cx, cy, zoneBox)) count += 1;
      }
      if (count >= pol.condition.count_threshold) {
        incidents.push({
          id: randomUUID(),
          object: "surveillance.incident",
          stream_id: ctx.streamId,
          type: "crowd_growth",
          severity: pol.action?.severity ?? "warning",
          created_at: Math.floor(ctx.nowMs / 1000),
          detections: perception.detections,
          tracks: perception.tracks,
          anomaly_score: perception.anomaly_score ?? null,
          zone,
          policy_matched: { id: pol.id, name: pol.name },
          metadata: { count },
        });
      }
    }

    if (pol.type === "intrusion") {
      for (const tr of perception.tracks) {
        const { cx, cy } = centerOf(tr.xyxy);
        if (pointInZone(cx, cy, zoneBox)) {
          incidents.push({
            id: randomUUID(),
            object: "surveillance.incident",
            stream_id: ctx.streamId,
            type: "intrusion",
            severity: pol.action?.severity ?? "critical",
            created_at: Math.floor(ctx.nowMs / 1000),
            detections: perception.detections,
            tracks: [tr],
            anomaly_score: perception.anomaly_score ?? null,
            zone,
            policy_matched: { id: pol.id, name: pol.name },
            metadata: {},
          });
        }
      }
    }
  }

  return incidents;
}

export function mergeIncidents(a: Incident[], b: Incident[]): Incident[] {
  return [...a, ...b];
}
