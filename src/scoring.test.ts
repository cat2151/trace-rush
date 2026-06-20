import { describe, expect, it } from "vitest";

import { config } from "./config";
import { distance, distanceToPointScore, isWithinPassRange, normalizedScore, realPointCount } from "./scoring";

describe("scoring", () => {
  it("counts only non-guard points", () => {
    expect(realPointCount([{ x: 0, y: 0 }, { x: 1, y: 1, isGuard: true }])).toBe(1);
  });

  it("calculates Euclidean distance", () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });

  it("checks whether the pen is inside any active pass range", () => {
    const targets = [
      { x: 0, y: 0 },
      { x: config.HIT_RADIUS * 2, y: 0 },
    ];

    expect(isWithinPassRange(config.HIT_RADIUS, 0, targets)).toBe(true);
    expect(isWithinPassRange(config.HIT_RADIUS * 3 + 1, 0, targets)).toBe(false);
    expect(isWithinPassRange(0, 0, [])).toBe(false);
  });

  it("maps distance to a point score within the configured range", () => {
    expect(distanceToPointScore(0)).toBe(config.PT_MAX);
    expect(distanceToPointScore(config.HIT_RADIUS)).toBe(config.PT_MIN);
    expect(distanceToPointScore(config.HIT_RADIUS * 2)).toBe(config.PT_MIN);
  });

  it("normalizes accumulated scores to a 0-100 value", () => {
    expect(normalizedScore([{ score: 10, color: "red" }, { score: 5, color: "blue" }], 2)).toBe(75);
    expect(normalizedScore([], 0)).toBe(0);
  });
});
