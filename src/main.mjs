import { GameRuntime, UI_COPY } from "./game_state.mjs";
import { ToastQueue } from "./toast_queue.mjs";

const STORAGE_KEYS = Object.freeze({
  seenFtue: "llc_seen_ftue",
  bestScore: "llc_best_score",
  lastResult: "llc_last_result"
});

const MOVEMENT_KEYS = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "w",
  "a",
  "s",
  "d"
]);

const runtime = new GameRuntime();
const toastQueue = new ToastQueue({ minGapMs: 1200, durationMs: 2200 });
const END_PANEL_DELAY_MS = 260;

const elements = {
  titleScreen: document.getElementById("title-screen"),
  gameScreen: document.getElementById("game-screen"),
  titleMeta: document.getElementById("title-meta"),
  startRun: document.getElementById("start-run"),
  timer: document.getElementById("timer"),
  integrity: document.getElementById("integrity"),
  cells: document.getElementById("cells"),
  multiplier: document.getElementById("multiplier"),
  score: document.getElementById("score"),
  objective: document.getElementById("objective-strip"),
  toast: document.getElementById("toast"),
  overlay: document.getElementById("ftue-overlay"),
  collectCell: document.getElementById("collect-cell"),
  takeHit: document.getElementById("take-hit"),
  extractNow: document.getElementById("extract-now"),
  endPanel: document.getElementById("end-panel"),
  endTitle: document.getElementById("end-title"),
  endBody: document.getElementById("end-body"),
  endTip: document.getElementById("end-tip"),
  statScore: document.getElementById("stat-score"),
  statDelta: document.getElementById("stat-delta"),
  statCells: document.getElementById("stat-cells"),
  statTime: document.getElementById("stat-time"),
  restartRun: document.getElementById("restart-run"),
  quitTitle: document.getElementById("quit-title")
};

let rafTime = performance.now();
let pendingEndPanelTimer = null;

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function readBestScore() {
  const raw = safeGetItem(STORAGE_KEYS.bestScore);
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function writeBestScore(score) {
  safeSetItem(STORAGE_KEYS.bestScore, String(Math.max(0, score)));
}

function writeLastResult(payload) {
  safeSetItem(STORAGE_KEYS.lastResult, JSON.stringify(payload));
}

function readLastResult() {
  const raw = safeGetItem(STORAGE_KEYS.lastResult);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function showScreen(name) {
  elements.titleScreen.hidden = name !== "title";
  elements.gameScreen.hidden = name !== "game";
}

function renderTitleMeta() {
  const best = readBestScore();
  const last = readLastResult();
  if (!last) {
    elements.titleMeta.textContent = `Best score: ${best} | No completed runs yet.`;
    return;
  }
  elements.titleMeta.textContent = `Best score: ${best} | Last run: ${last.outcome} (${last.score})`;
}

function startRun() {
  if (pendingEndPanelTimer !== null) {
    clearTimeout(pendingEndPanelTimer);
    pendingEndPanelTimer = null;
  }

  toastQueue.reset();
  const firstRun = safeGetItem(STORAGE_KEYS.seenFtue) !== "1";
  runtime.startRun({ firstRun });
  if (firstRun) {
    safeSetItem(STORAGE_KEYS.seenFtue, "1");
  }

  elements.endPanel.hidden = true;
  elements.toast.hidden = true;
  showScreen("game");
  processEvents();
  renderHud(runtime.getSnapshot());
}

function quitToTitle() {
  if (pendingEndPanelTimer !== null) {
    clearTimeout(pendingEndPanelTimer);
    pendingEndPanelTimer = null;
  }

  toastQueue.reset();
  showScreen("title");
  elements.endPanel.hidden = true;
  elements.overlay.hidden = true;
  elements.toast.hidden = true;
  renderTitleMeta();
}

function showToast(message, tone = "neutral") {
  elements.toast.hidden = false;
  elements.toast.className = "";
  elements.toast.classList.add(tone);
  elements.toast.textContent = message;
}

function hideToast() {
  if (!elements.toast.hidden) {
    elements.toast.hidden = true;
    elements.toast.className = "";
    elements.toast.textContent = "";
  }
}

function renderOverlay(event) {
  if (!event.visible) {
    elements.overlay.hidden = true;
    elements.overlay.textContent = "";
    return;
  }
  elements.overlay.hidden = false;
  elements.overlay.textContent = event.message;
}

function renderHud(snapshot) {
  elements.timer.textContent = `${snapshot.timeLeftRounded}s`;
  elements.integrity.textContent = String(snapshot.hp);
  elements.cells.textContent = `${snapshot.cells}/${snapshot.requiredCells ?? 6}`;
  elements.multiplier.textContent = `x${snapshot.multiplier.toFixed(1)}`;
  elements.score.textContent = String(snapshot.scoreRounded);

  if (snapshot.timeLeft < 30) {
    elements.timer.classList.add("is-low");
  } else {
    elements.timer.classList.remove("is-low");
  }
}

function showEndPanel(event) {
  const previousBest = readBestScore();
  const currentScore = event.stats.finalScore;
  const bestDelta = currentScore - previousBest;
  if (currentScore > previousBest) {
    writeBestScore(currentScore);
  }

  writeLastResult({
    outcome: event.outcome,
    score: currentScore
  });

  elements.endTitle.textContent = event.title;
  elements.endBody.textContent = event.body;
  elements.statScore.textContent = String(currentScore);
  elements.statDelta.textContent = `${bestDelta >= 0 ? "+" : ""}${bestDelta}`;
  elements.statCells.textContent = `${event.stats.cellsCollected}/${event.stats.requiredCells}`;
  elements.statTime.textContent = `${event.stats.survivedSeconds}s`;

  if (event.tip) {
    elements.endTip.hidden = false;
    elements.endTip.textContent = event.tip;
  } else {
    elements.endTip.hidden = true;
    elements.endTip.textContent = "";
  }

  elements.endPanel.hidden = false;
  elements.restartRun.focus();
}

function queueEndPanel(event) {
  if (pendingEndPanelTimer !== null) {
    clearTimeout(pendingEndPanelTimer);
  }
  pendingEndPanelTimer = setTimeout(() => {
    showEndPanel(event);
    pendingEndPanelTimer = null;
  }, END_PANEL_DELAY_MS);
}

function syncToastQueue(now) {
  const state = toastQueue.tick(now);
  if (!state.changed) {
    return;
  }

  if (state.active) {
    showToast(state.active.message, state.active.tone);
    return;
  }

  hideToast();
}

function processEvents() {
  const events = runtime.drainEvents();
  for (const event of events) {
    if (event.type === "objective") {
      elements.objective.textContent = event.message;
    } else if (event.type === "objective_update") {
      elements.cells.textContent = `${event.current}/${event.total}`;
    } else if (event.type === "toast") {
      toastQueue.enqueue(event);
    } else if (event.type === "overlay") {
      renderOverlay(event);
    } else if (event.type === "feedback" && event.key === "extraction_pulse") {
      elements.objective.style.borderColor = "#6be895";
      setTimeout(() => {
        elements.objective.style.borderColor = "";
      }, 450);
    } else if (event.type === "feedback" && event.key === "damage") {
      elements.gameScreen.style.boxShadow = "0 0 0 2px #ff5f6d inset";
      setTimeout(() => {
        elements.gameScreen.style.boxShadow = "";
      }, 120);
    } else if (event.type === "end") {
      toastQueue.reset();
      hideToast();
      queueEndPanel(event);
      renderTitleMeta();
    }
  }
}

function handleKeydown(event) {
  if (elements.gameScreen.hidden || !runtime.isRunning()) {
    return;
  }

  const key = event.key.toLowerCase();
  if (MOVEMENT_KEYS.has(key)) {
    runtime.registerMovement();
  } else if (event.code === "Space") {
    runtime.useDash();
    event.preventDefault();
  } else if (key === "c") {
    runtime.collectCell();
  } else if (key === "h") {
    runtime.takeDamage();
  } else if (key === "e") {
    runtime.attemptExtraction();
  }
}

function update(now) {
  const deltaSeconds = Math.min((now - rafTime) / 1000, 0.25);
  rafTime = now;

  if (runtime.isRunning()) {
    runtime.tick(deltaSeconds);
  }

  processEvents();
  syncToastQueue(now);
  renderHud(runtime.getSnapshot());
  requestAnimationFrame(update);
}

elements.startRun.addEventListener("click", startRun);
elements.restartRun.addEventListener("click", startRun);
elements.quitTitle.addEventListener("click", quitToTitle);
elements.collectCell.addEventListener("click", () => runtime.collectCell());
elements.takeHit.addEventListener("click", () => runtime.takeDamage());
elements.extractNow.addEventListener("click", () => runtime.attemptExtraction());
document.addEventListener("keydown", handleKeydown);

elements.objective.textContent = UI_COPY.objective;
renderTitleMeta();
showScreen("title");
requestAnimationFrame(update);
