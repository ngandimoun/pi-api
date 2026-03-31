import type { ZoneDefinition } from "../../contracts/robotics-api";

export type Point2 = { x: number; y: number };

export function pointInPolygon(point: Point2, polygon: Array<[number, number]>): boolean {
  // Ray casting algorithm
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function zonesContainingPoint(params: {
  point: Point2;
  zones: ZoneDefinition[];
  frame?: string;
}): ZoneDefinition[] {
  const { point, zones, frame } = params;
  return zones.filter((z) => {
    if (frame && z.frame && z.frame !== frame) return false;
    return pointInPolygon(point, z.polygon);
  });
}

