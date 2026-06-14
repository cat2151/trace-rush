import { colors, config } from "./config";
import { realPointCount } from "./scoring";
import type { GameState, Point, PointScore } from "./types";

type RenderState = {
  points: Point[];
  pointScores: PointScore[];
  state: GameState;
  headIdx: number;
  endTempScore: PointScore | null;
};

export function createRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is not available.");
  }
  const ctx: CanvasRenderingContext2D = context;

  let width = 0;
  let height = 0;

  function resize() {
    width = canvas.parentElement?.clientWidth || 600;
    height = config.CANVAS_HEIGHT;
    canvas.width = width;
    canvas.height = height;
    return { width, height };
  }

  function drawMarker(x: number, y: number, label: string, bgColor: string) {
    const pad = 4;
    const fontSize = 10;
    ctx.save();
    ctx.font = `bold ${fontSize}px -apple-system,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textWidth = ctx.measureText(label).width;
    const boxWidth = textWidth + pad * 2;
    const boxHeight = fontSize + pad * 2;
    ctx.beginPath();
    ctx.roundRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight, boxHeight / 2);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.fillStyle = colors.text;
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  function drawUnhitPath(points: Point[], realTotal: number, firstUnhit: number) {
    if (firstUnhit >= realTotal) {
      return;
    }

    const startPoint = points[Math.max(0, firstUnhit - 1)];
    if (!startPoint) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = "rgba(55,138,221,0.22)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    for (let i = firstUnhit; i < realTotal; i++) {
      const point = points[i];
      if (point) {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawUnhitPoints(points: Point[], realTotal: number, firstUnhit: number) {
    ctx.save();
    ctx.fillStyle = "rgba(55,138,221,0.28)";
    for (let i = firstUnhit + (firstUnhit < realTotal ? 1 : 0); i < realTotal - 1; i++) {
      const point = points[i];
      if (!point) {
        continue;
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, config.PT_DRAW_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHitPath(points: Point[], drawScores: PointScore[]) {
    for (let i = 0; i < drawScores.length - 1; i++) {
      const point = points[i];
      const nextPoint = points[i + 1];
      if (!point || !nextPoint) {
        continue;
      }

      ctx.save();
      ctx.strokeStyle = drawScores[i]?.color ?? colors.accent;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(nextPoint.x, nextPoint.y);
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < drawScores.length; i++) {
      const point = points[i];
      const score = drawScores[i];
      if (!point || !score) {
        continue;
      }

      ctx.save();
      ctx.fillStyle = score.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, config.PT_DRAW_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawNextTarget(points: Point[], state: GameState, headIdx: number, realTotal: number) {
    if (state !== "playing" || headIdx >= realTotal - 1) {
      return;
    }

    const target = points[headIdx];
    if (!target) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(target.x, target.y, config.HIT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(55,138,221,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(55,138,221,0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(target.x, target.y, config.PT_DRAW_R + 2, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.fill();
    ctx.restore();
  }

  function drawEndpointMarkers(points: Point[], realTotal: number, drawScores: PointScore[], state: GameState) {
    if (realTotal <= 0) {
      return;
    }

    const startPoint = points[0];
    const endPoint = points[realTotal - 1];
    if (!startPoint || !endPoint) {
      return;
    }

    const startDone = drawScores.length > 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, config.MARKER_R, 0, Math.PI * 2);
    ctx.fillStyle = startDone ? colors.pass : colors.start;
    ctx.fill();
    ctx.restore();
    drawMarker(startPoint.x, startPoint.y, "START", startDone ? colors.pass : colors.start);

    const endDone = state === "cleared";
    ctx.save();
    ctx.beginPath();
    ctx.arc(endPoint.x, endPoint.y, config.MARKER_R, 0, Math.PI * 2);
    ctx.fillStyle = endDone ? colors.pass : "rgba(55,138,221,0.6)";
    ctx.fill();
    ctx.restore();
    drawMarker(endPoint.x, endPoint.y, "END", endDone ? colors.pass : colors.accent);
  }

  function draw(gameState: RenderState) {
    const { points, pointScores, state, headIdx, endTempScore } = gameState;
    ctx.clearRect(0, 0, width, height);

    const realTotal = realPointCount(points);
    const drawScores = [...pointScores];
    if (state === "cleared" && endTempScore) {
      drawScores.push(endTempScore);
    }
    const firstUnhit = drawScores.length;

    drawUnhitPath(points, realTotal, firstUnhit);
    drawUnhitPoints(points, realTotal, firstUnhit);
    drawHitPath(points, drawScores);
    drawNextTarget(points, state, headIdx, realTotal);
    drawEndpointMarkers(points, realTotal, drawScores, state);
  }

  return {
    resize,
    draw,
  };
}
