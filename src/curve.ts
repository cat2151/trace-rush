import { config } from "./config";
import { distance } from "./scoring";
import type { Point } from "./types";

type Bounds = {
  width: number;
  height: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  cx: number;
  cy: number;
};

function createAnchors(pattern: number, bounds: Bounds): Point[] {
  const { width, height, x0, x1, y0, y1, cx, cy } = bounds;
  let anchors: Point[] = [];

  switch (pattern) {
    case 0:
      anchors = [
        { x: x0, y: y0 + Math.random() * (y1 - y0) },
        { x: cx * 0.7 + Math.random() * width * 0.1, y: y0 + Math.random() * (cy - y0) * 0.8 },
        { x: cx + Math.random() * width * 0.1, y: cy + Math.random() * (y1 - cy) * 0.8 },
        { x: x1, y: y0 + Math.random() * (y1 - y0) },
      ];
      break;
    case 1:
      anchors = [
        { x: x0 + Math.random() * width * 0.1, y: cy + Math.random() * (y1 - cy) * 0.7 },
        { x: cx * 0.6, y: y0 + Math.random() * (cy - y0) * 0.6 },
        { x: cx * 1.4, y: cy + Math.random() * (y1 - cy) * 0.6 },
        { x: x1 - Math.random() * width * 0.1, y: y0 + Math.random() * (cy - y0) * 0.7 },
      ];
      break;
    case 2:
      anchors = [
        { x: x0, y: y0 },
        { x: x0 + width * 0.3 + Math.random() * width * 0.15, y: y0 + height * 0.2 + Math.random() * height * 0.2 },
        { x: x0 + width * 0.5 + Math.random() * width * 0.15, y: y0 + height * 0.5 + Math.random() * height * 0.15 },
        { x: x1 - Math.random() * width * 0.1, y: y1 - Math.random() * height * 0.1 },
      ];
      break;
    case 3:
      anchors = [
        { x: x0 + Math.random() * width * 0.1, y: y0 + Math.random() * height * 0.15 },
        { x: x0 + width * 0.1 + Math.random() * width * 0.1, y: y1 - Math.random() * height * 0.1 },
        { x: cx + Math.random() * width * 0.15 - width * 0.075, y: y1 - Math.random() * height * 0.1 },
        { x: x1 - width * 0.1 - Math.random() * width * 0.1, y: y1 - Math.random() * height * 0.1 },
        { x: x1 - Math.random() * width * 0.1, y: y0 + Math.random() * height * 0.15 },
      ];
      break;
    case 4:
      anchors = [
        { x: x0, y: y0 + Math.random() * height * 0.15 },
        { x: x1 - Math.random() * width * 0.1, y: y0 + height * 0.1 + Math.random() * height * 0.1 },
        { x: x0 + Math.random() * width * 0.1, y: y1 - height * 0.1 - Math.random() * height * 0.1 },
        { x: x1, y: y1 - Math.random() * height * 0.15 },
      ];
      break;
    case 5: {
      const count = 5;
      for (let i = 0; i < count; i++) {
        anchors.push({
          x: x0 + ((x1 - x0) * i) / (count - 1) + (Math.random() - 0.5) * width * 0.18,
          y: y0 + Math.random() * (y1 - y0),
        });
      }

      anchors.forEach((anchor) => {
        anchor.x = Math.max(x0, Math.min(x1, anchor.x));
        anchor.y = Math.max(y0, Math.min(y1, anchor.y));
      });
      break;
    }
    case 6:
      anchors = [
        { x: x0 + Math.random() * (x1 - x0), y: y0 },
        { x: x0 + Math.random() * (cx - x0) * 0.8, y: cy * 0.6 + Math.random() * height * 0.1 },
        { x: cx + Math.random() * (x1 - cx) * 0.8, y: cy + Math.random() * height * 0.1 },
        { x: x0 + Math.random() * (x1 - x0), y: y1 },
      ];
      break;
    default:
      throw new Error(`Unknown curve pattern: ${pattern}`);
  }

  return anchors;
}

function interpolateAnchors(anchors: Point[]): Point[] {
  const raw: Point[] = [];
  const subdivisions = 120;

  for (let segment = 0; segment < anchors.length - 1; segment++) {
    const p0 = anchors[Math.max(0, segment - 1)];
    const p1 = anchors[segment];
    const p2 = anchors[segment + 1];
    const p3 = anchors[Math.min(anchors.length - 1, segment + 2)];

    if (!p0 || !p1 || !p2 || !p3) {
      continue;
    }

    for (let i = segment === 0 ? 0 : 1; i <= subdivisions; i++) {
      const t = i / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      raw.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }

  return raw;
}

function samplePoints(raw: Point[]): Point[] {
  const first = raw[0];
  if (!first) {
    return [];
  }

  const main: Point[] = [first];
  let accumulated = 0;

  for (let i = 1; i < raw.length; i++) {
    const current = raw[i];
    const previous = raw[i - 1];
    if (!current || !previous) {
      continue;
    }

    accumulated += distance(current.x, current.y, previous.x, previous.y);
    if (accumulated >= config.PT_SPACING) {
      main.push(current);
      accumulated = 0;
    }
  }

  const last = raw[raw.length - 1];
  const previous = main[main.length - 1];
  if (last && previous && distance(last.x, last.y, previous.x, previous.y) >= config.PT_SPACING * 0.5) {
    main.push(last);
  }

  return main;
}

function appendGuardPoint(points: Point[]): Point[] {
  const count = points.length;
  if (count < 2) {
    return points;
  }

  const last = points[count - 1];
  const previous = points[count - 2];
  if (!last || !previous) {
    return points;
  }

  const dx = last.x - previous.x;
  const dy = last.y - previous.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return [
    ...points,
    {
      x: last.x + (dx / len) * config.PT_SPACING,
      y: last.y + (dy / len) * config.PT_SPACING,
      isGuard: true,
    },
  ];
}

export function createRandomCurve(width: number, height: number): Point[] {
  const margin = width * 0.12;
  const bounds = {
    width,
    height,
    x0: margin,
    x1: width - margin,
    y0: margin,
    y1: height - margin,
    cx: width / 2,
    cy: height / 2,
  };
  const pattern = Math.floor(Math.random() * 7);
  return appendGuardPoint(samplePoints(interpolateAnchors(createAnchors(pattern, bounds))));
}
