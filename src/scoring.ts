import { config } from "./config";
import type { Point, PointScore } from "./types";

export function realPointCount(points: Point[]): number {
  return points.filter((point) => !point.isGuard).length;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceToPointScore(distanceValue: number): number {
  return config.PT_MAX - (Math.min(distanceValue, config.HIT_RADIUS) / config.HIT_RADIUS) * (config.PT_MAX - config.PT_MIN);
}

export function scoreToColor(score: number): string {
  const ratio = (score - config.PT_MIN) / (config.PT_MAX - config.PT_MIN);
  if (ratio >= 0.5) {
    const t = (ratio - 0.5) * 2;
    return `rgb(${Math.round(239 + (29 - 239) * t)},${Math.round(159 + (158 - 159) * t)},${Math.round(39 + (117 - 39) * t)})`;
  }

  const t = ratio * 2;
  return `rgb(${Math.round(226 + (239 - 226) * t)},${Math.round(75 + (159 - 75) * t)},${Math.round(48 + (39 - 48) * t)})`;
}

export function normalizedScore(pointScores: PointScore[], realPointTotal: number, extraScore = 0): number {
  const raw = pointScores.reduce((sum, point) => sum + point.score, 0) + extraScore;
  const max = realPointTotal * config.PT_MAX;
  return max > 0 ? (raw / max) * 100 : 0;
}
