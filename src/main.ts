import "./styles.css";

import { colors, config } from "./config";
import { createRandomCurve } from "./curve";
import { createRenderer } from "./renderer";
import { distance, distanceToPointScore, normalizedScore, realPointCount, scoreToColor } from "./scoring";
import type { GameState, Point, PointScore } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Element #app was not found.");
}

app.innerHTML = `
  <h1>Trace <span>Rush</span></h1>

  <div class="stat-row">
    <div class="stat">
      <div class="stat-label">クリア数</div>
      <div class="stat-value" id="s-pass">0</div>
    </div>
    <div class="stat">
      <div class="stat-label">挑戦数</div>
      <div class="stat-value" id="s-total">0</div>
    </div>
    <div class="stat">
      <div class="stat-label">最高スコア</div>
      <div class="stat-value" id="s-best">—</div>
    </div>
  </div>

  <div class="controls">
    <div>
      <div id="live-score">—</div>
      <div id="live-label">/ 100</div>
    </div>
    <div class="score-wrap">
      <div id="score-bar-wrap">
        <div id="score-bar"></div>
      </div>
      <div id="status-msg">START からなぞってください</div>
    </div>
    <div class="btn-row">
      <button id="next-btn" type="button">新しい曲線</button>
    </div>
  </div>

  <div class="canvas-wrap">
    <canvas id="c" height="400"></canvas>
    <div id="pass-flash"></div>
    <div id="fail-flash"></div>
  </div>

  <div class="legend">
    <span>線の色:</span>
    <span class="legend-score-high">■ 満点（真上）</span>
    <span class="legend-score-mid">■ 中程度</span>
    <span class="legend-score-low">■ ギリギリ</span>
  </div>

  <a class="repo-readme-link" href="https://github.com/cat2151/trace-rush">GitHub</a>
`;

function getElement<T extends HTMLElement>(id: string, ctor: { new (): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Element #${id} was not found or has an unexpected type.`);
  }

  return element;
}

const canvas = getElement("c", HTMLCanvasElement);
const liveScore = getElement("live-score", HTMLDivElement);
const liveLabel = getElement("live-label", HTMLDivElement);
const scoreBar = getElement("score-bar", HTMLDivElement);
const statusMsg = getElement("status-msg", HTMLDivElement);
const sPass = getElement("s-pass", HTMLDivElement);
const sTotal = getElement("s-total", HTMLDivElement);
const sBest = getElement("s-best", HTMLDivElement);
const nextBtn = getElement("next-btn", HTMLButtonElement);
const passFlash = getElement("pass-flash", HTMLDivElement);
const failFlash = getElement("fail-flash", HTMLDivElement);
const renderer = createRenderer(canvas);

let width = 0;
let height = 0;
let points: Point[] = [];
let drawing = false;
let passCount = 0;
let totalCount = 0;
let bestScore = 0;
let dirty = false;
let penX: number | null = null;
let penY: number | null = null;
let prevDist = Infinity;
let pointScores: PointScore[] = [];
let attemptPath: Point[] = [];
let headIdx = 0;
let state: GameState = "idle";
let endBestDist = Infinity;
let endTempScore: PointScore | null = null;

function getRealPointCount(): number {
  return realPointCount(points);
}

function calcNormScore(extra?: number): number {
  return normalizedScore(pointScores, getRealPointCount(), extra);
}

function markDirty() {
  dirty = true;
}

function updateScoreUI(currentScore: number) {
  liveScore.textContent = String(Math.round(currentScore));
  const ratio = currentScore / 100;
  scoreBar.style.width = `${ratio * 100}%`;
  scoreBar.style.background = ratio >= 0.8 ? colors.pass : ratio >= 0.6 ? colors.warning : colors.fail;
  if (state === "playing") {
    statusMsg.style.color = colors.muted;
    const remaining = getRealPointCount() - pointScores.length;
    statusMsg.textContent = `残り${remaining}点 — 離さずに`;
  }
}

function processPenPoint(x: number, y: number) {
  if (state === "failing" || state === "idle") {
    return;
  }

  if (state === "cleared") {
    const guardPoint = points[points.length - 1];
    if (guardPoint?.isGuard && distance(x, y, guardPoint.x, guardPoint.y) <= config.HIT_RADIUS) {
      onFail("描きすぎ — ENDで止めてください");
      return;
    }

    const endPoint = points[getRealPointCount() - 1];
    if (!endPoint) {
      return;
    }

    const endDistance = distance(x, y, endPoint.x, endPoint.y);
    if (endDistance < endBestDist) {
      endBestDist = endDistance;
      const pointScore = distanceToPointScore(endBestDist);
      endTempScore = { score: pointScore, color: scoreToColor(pointScore) };
      markDirty();
      updateScoreUI(calcNormScore(pointScore));
    }
    return;
  }

  if (headIdx >= points.length) {
    return;
  }

  const headPoint = points[headIdx];
  if (!headPoint) {
    return;
  }

  const currentDistance = distance(x, y, headPoint.x, headPoint.y);
  if (headPoint.isGuard) {
    if (currentDistance <= config.HIT_RADIUS) {
      onFail("描きすぎ");
    }
    return;
  }

  const realTotal = getRealPointCount();
  const isEndPoint = headIdx === realTotal - 1;
  if (isEndPoint) {
    if (currentDistance <= config.HIT_RADIUS) {
      endBestDist = currentDistance;
      const pointScore = distanceToPointScore(currentDistance);
      endTempScore = { score: pointScore, color: scoreToColor(pointScore) };
      state = "cleared";
      statusMsg.style.color = colors.pass;
      statusMsg.textContent = "END到達！ ペンを離してクリア";
      markDirty();
      updateScoreUI(calcNormScore(pointScore));
    }
    prevDist = currentDistance;
    return;
  }

  if (currentDistance <= config.HIT_RADIUS && currentDistance > prevDist) {
    const pointScore = distanceToPointScore(prevDist);
    pointScores.push({ score: pointScore, color: scoreToColor(pointScore) });
    headIdx++;
    prevDist = Infinity;
    markDirty();
    updateScoreUI(calcNormScore());
  } else {
    prevDist = currentDistance;
  }
}

function handlePenMove(nextX: number, nextY: number) {
  attemptPath.push({ x: nextX, y: nextY });

  if (penX === null || penY === null) {
    penX = nextX;
    penY = nextY;
    processPenPoint(nextX, nextY);
    return;
  }

  const dx = nextX - penX;
  const dy = nextY - penY;
  const moveDistance = Math.sqrt(dx * dx + dy * dy);
  if (moveDistance <= config.INTERP_STEP) {
    penX = nextX;
    penY = nextY;
    processPenPoint(nextX, nextY);
  } else {
    const steps = Math.ceil(moveDistance / config.INTERP_STEP);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      processPenPoint(penX + dx * t, penY + dy * t);
      if (state === "failing") {
        break;
      }
    }
    penX = nextX;
    penY = nextY;
  }
  markDirty();
}

function onClear() {
  if (state !== "cleared") {
    return;
  }

  if (endTempScore) {
    pointScores.push(endTempScore);
  }
  const currentScore = calcNormScore();
  totalCount++;
  sTotal.textContent = String(totalCount);
  if (currentScore > bestScore) {
    bestScore = currentScore;
    sBest.textContent = String(Math.round(currentScore));
  }
  passCount++;
  sPass.textContent = String(passCount);
  state = "idle";
  statusMsg.style.color = colors.pass;
  statusMsg.textContent = `クリア！ ${Math.round(currentScore)} / 100点`;
  passFlash.style.display = "block";
  markDirty();
  window.setTimeout(() => {
    passFlash.style.display = "none";
    newCurve();
  }, 1800);
}

function onFail(message: string) {
  if (state === "failing") {
    return;
  }

  state = "failing";
  endTempScore = null;
  totalCount++;
  sTotal.textContent = String(totalCount);
  statusMsg.style.color = colors.fail;
  statusMsg.textContent = `${message} — ピンク線があなたの描線です。タッチで即リトライ`;
  failFlash.style.display = "block";
  markDirty();
}

function resetAttempt() {
  headIdx = 0;
  pointScores = [];
  attemptPath = [];
  prevDist = Infinity;
  penX = null;
  penY = null;
  drawing = false;
  endBestDist = Infinity;
  endTempScore = null;
  failFlash.style.display = "none";
  liveScore.textContent = "—";
  liveLabel.textContent = "/ 100";
  scoreBar.style.width = "0%";
  scoreBar.style.background = colors.fail;
  statusMsg.textContent = "START からなぞってください";
  statusMsg.style.color = colors.muted;
  state = "idle";
  markDirty();
}

function renderLoop() {
  if (dirty) {
    renderer.draw({ points, pointScores, attemptPath, state, headIdx, endTempScore });
    dirty = false;
  }
  requestAnimationFrame(renderLoop);
}

function getXY(event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = width / rect.width;
  const scaleY = height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function processEvent(event: PointerEvent) {
  const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
  for (const coalescedEvent of events) {
    if (state === "failing" || state === "idle") {
      break;
    }
    const point = getXY(coalescedEvent);
    handlePenMove(point.x, point.y);
  }
}

function resetPointer() {
  drawing = false;
  penX = null;
  penY = null;
  prevDist = Infinity;
}

canvas.addEventListener(
  "pointerdown",
  (event) => {
    event.preventDefault();
    if (state === "failing") {
      resetAttempt();
      state = "playing";
    } else if (state === "idle") {
      state = "playing";
    } else {
      return;
    }

    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    penX = null;
    penY = null;
    prevDist = Infinity;
    processEvent(event);
    markDirty();
  },
  { passive: false },
);

canvas.addEventListener(
  "pointermove",
  (event) => {
    if ((state !== "playing" && state !== "cleared") || !drawing) {
      return;
    }
    event.preventDefault();
    processEvent(event);
  },
  { passive: false },
);

canvas.addEventListener("pointerup", (event) => {
  if (!drawing) {
    return;
  }

  event.preventDefault();
  processEvent(event);
  resetPointer();
  if (state === "cleared") {
    onClear();
  } else if (state === "playing") {
    onFail("失敗 — ペンを離さず終点まで");
  }
  markDirty();
});

canvas.addEventListener("pointercancel", () => {
  if (!drawing) {
    return;
  }

  resetPointer();
  if (state === "playing") {
    onFail("失敗 — ペンを離さず終点まで");
  }
  markDirty();
});

nextBtn.addEventListener("click", () => {
  newCurve();
});

function newCurve() {
  state = "idle";
  headIdx = 0;
  pointScores = [];
  attemptPath = [];
  prevDist = Infinity;
  endBestDist = Infinity;
  endTempScore = null;
  drawing = false;
  penX = null;
  penY = null;
  liveScore.textContent = "—";
  liveLabel.textContent = "/ 100";
  scoreBar.style.width = "0%";
  scoreBar.style.background = colors.fail;
  statusMsg.textContent = "START からなぞってください";
  statusMsg.style.color = colors.muted;

  const size = renderer.resize();
  width = size.width;
  height = size.height;
  points = createRandomCurve(width, height);
  markDirty();
}

window.addEventListener("resize", () => newCurve());
newCurve();
renderLoop();
