export type Point = {
  x: number;
  y: number;
  isGuard?: boolean;
};

export type PointScore = {
  score: number;
  color: string;
};

export type GameState = "idle" | "playing" | "cleared" | "failing";
