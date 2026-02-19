import { GameRuntime, UI_COPY } from "./game_state.mjs";
import { ToastQueue } from "./toast_queue.mjs";
import { CanvasGame } from "./game_canvas.mjs";

const STORAGE_KEYS = Object.freeze({
  seenFtue: "ppj_seen_ftue",
  bestScore: "ppj_best_score",
  lastResult: "ppj_last_result"
});

const MOVEMENT_KEYS = new Set([
  "arrowleft",
  "arrowright",
  "a",
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
  carry: document.getElementById("carry"),
  combo: document.getElementById("combo"),
  comboTimeout: document.getElementById("combo-timeout"),
  score: document.getElementById("score"),
  objective: document.getElementById("objective-strip"),
  toast: document.getElementById("toast"),
  overlay: document.getElementById("ftue-overlay"),
  collectScrap: document.getElementById("collect-scrap"),
  depositCarry: document.getElementById("deposit-carry"),
  takeHit: document.getElementById("take-hit"),
  endPanel: document.getElementById("end-panel"),
  endTitle: document.getElementById("end-title"),
  endBody: document.getElementById("end-body"),
  endTip: document.getElementById("end-tip"),
  statScore: document.getElementById("stat-score"),
  statDelta: document.getElementById("stat-delta"),
  statCarry: document.getElementById("stat-carry"),
  statTime: document.getElementById("stat-time"),
  restartRun: document.getElementById("restart-run"),
  quitTitle: document.getElementById("quit-title"),
  canvas: document.getElementById("game-canvas"),
  pauseBtn: document.getElementById("pause-btn")
};

let rafTime = performance.now();
let pendingEndPanelTimer = null;
let canvasGame = null;

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

function isGameplayPaused() {
  return runtime.isPaused() || Boolean(canvasGame && canvasGame.paused);
}

function canDispatchGameplayAction() {
  return Boolean(canvasGame) && runtime.isRunning() && !isGameplayPaused();
}

function togglePause() {
  if (!canvasGame || !runtime.isRunning()) {
    return false;
  }

  const paused = runtime.setPaused(!runtime.isPaused());
  canvasGame.setPaused(paused);
  elements.pauseBtn.textContent = paused ? "Resume" : "Pause";
  return paused;
}

function renderTitleMeta() {
  const best = readBestScore();
  const last = readLastResult();
  if (!last) {
    elements.titleMeta.textContent = `Best score: ${best} | No completed shifts yet.`;
    return;
  }
  elements.titleMeta.textContent = `Best score: ${best} | Last shift: ${last.outcome} (${last.score})`;
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

  if (!canvasGame) {
    canvasGame = new CanvasGame(elements.canvas, runtime);
  }
  canvasGame.init();

  elements.endPanel.hidden = true;
  elements.toast.hidden = true;
  elements.pauseBtn.textContent = "Pause";
  showScreen("game");
  processEvents();
  renderHud(runtime.getSnapshot());
}

function quitToTitle() {
  if (pendingEndPanelTimer !== null) {
    clearTimeout(pendingEndPanelTimer);
    pendingEndPanelTimer = null;
  }

  if (canvasGame) {
    canvasGame.setPaused(true);
    runtime.setPaused(true);
  }

  toastQueue.reset();
  showScreen("title");
  elements.endPanel.hidden = true;
  elements.overlay.hidden = true;
  elements.toast.hidden = true;
  renderTitleMeta();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderToastMessage(template, values) {
  if (!values) {
    return `<span class="toast-message">${escapeHtml(template)}</span>`;
  }

  const segments = String(template).split(/\{([a-z_]+)\}/g);
  let html = "";
  for (let index = 0; index < segments.length; index += 1) {
    if (index % 2 === 1) {
      const value = values[segments[index]];
      if (value !== undefined) {
        html += `<span class="toast-slot">${escapeHtml(value)}</span>`;
      } else {
        html += escapeHtml(`{${segments[index]}}`);
      }
    } else {
      html += escapeHtml(segments[index]);
    }
  }

  return `<span class="toast-message">${html}</span>`;
}

function showToast(toast) {
  elements.toast.hidden = false;
  elements.toast.className = "";
  elements.toast.classList.add(toast.tone ?? "neutral");
  elements.toast.innerHTML = renderToastMessage(toast.message, toast.values);
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
  elements.carry.textContent = String(snapshot.carryCount);
  elements.combo.textContent = `x${snapshot.comboText}`;
  elements.comboTimeout.textContent = `${snapshot.comboWindowText}s`;
  elements.score.textContent = String(snapshot.scoreRounded);

  if (snapshot.comboWindowRemaining > 0 && snapshot.comboWindowRemaining <= 2) {
    elements.comboTimeout.classList.add("is-low");
  } else {
    elements.comboTimeout.classList.remove("is-low");
  }
}

function showEndPanel(event) {
  const previousBest = readBestScore();
  const currentScore = event.stats.finalScore;
  const bestDelta = currentScore - previousBest;
  const isNewBest = currentScore > previousBest;
  if (isNewBest) {
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
  elements.statCarry.textContent = String(event.stats.carryCount);
  elements.statTime.textContent = `${event.stats.survivedSeconds}s`;

  const notes = [];
  if (isNewBest) {
    notes.push(`${event.pbBadge}. ${event.pbBody}`);
  }
  if (event.tip) {
    notes.push(event.tip);
  }

  if (notes.length > 0) {
    elements.endTip.hidden = false;
    elements.endTip.textContent = notes.join(" ");
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
    showToast(state.active);
    return;
  }

  hideToast();
}

function processEvents() {
  const nowMs = performance.now();
  const events = runtime.drainEvents();
  for (const event of events) {
    if (event.type === "objective") {
      elements.objective.textContent = event.message;
    } else if (event.type === "toast") {
      toastQueue.enqueue(event, nowMs);
    } else if (event.type === "overlay") {
      renderOverlay(event);
    } else if (event.type === "feedback" && event.key === "carry_pulse") {
      elements.carry.style.color = "#6be895";
      setTimeout(() => {
        elements.carry.style.color = "";
      }, 300);
    } else if (event.type === "feedback" && event.key === "deposit") {
      elements.combo.style.color = "#6be895";
      setTimeout(() => {
        elements.combo.style.color = "";
      }, 300);
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
  if (elements.gameScreen.hidden) {
    return;
  }

  const key = event.key.toLowerCase();
  
  if (key === "p") {
    togglePause();
    return;
  }

  if (!runtime.isRunning()) {
    return;
  }

  if (isGameplayPaused()) {
    return;
  }

  if (MOVEMENT_KEYS.has(key)) {
    runtime.registerMovement();
  } else if (event.code === "Space") {
    runtime.useBoost();
    event.preventDefault();
  } else if (key === "e") {
    if (canvasGame) {
      canvasGame.deposit();
    }
  } else if (key === "h") {
    if (canvasGame) {
      canvasGame.forceDamage();
    }
  }
}

function update(now) {
  const deltaSeconds = Math.min((now - rafTime) / 1000, 0.25);
  rafTime = now;

  const isPaused = isGameplayPaused();
  const isGameOver = canvasGame && canvasGame.gameOver;

  if (runtime.isRunning() && !isPaused) {
    runtime.tick(deltaSeconds);
    
    if (canvasGame && !isGameOver) {
      canvasGame.update(deltaSeconds);
      
      const snapshot = runtime.getSnapshot();
      if (snapshot.elapsed >= 121 && snapshot.elapsed < 122) {
        canvasGame.setPhase(2);
      } else if (snapshot.elapsed >= 241 && snapshot.elapsed < 242) {
        canvasGame.setPhase(3);
      }
      
      if (canvasGame.player) {
        runtime.syncPlayerState({
          hp: canvasGame.player.hp,
          carryCount: canvasGame.player.carryCount,
          carryValue: canvasGame.player.carryValue
        });
      }
      
      if (canvasGame.gameOver) {
        if (canvasGame.player && canvasGame.player.hp <= 0) {
          runtime.endRunFromGameOver();
        }
      }
    }
  }

  if (canvasGame) {
    canvasGame.draw();
  }

  processEvents();
  syncToastQueue(now);
  renderHud(runtime.getSnapshot());
  requestAnimationFrame(update);
}

elements.startRun.addEventListener("click", startRun);
elements.restartRun.addEventListener("click", startRun);
elements.quitTitle.addEventListener("click", quitToTitle);
elements.collectScrap.addEventListener("click", () => {
  if (canDispatchGameplayAction()) {
    const debris = canvasGame.debris.find(d => !d.collected);
    if (debris) {
      debris.collected = true;
      canvasGame.player.carryCount++;
      canvasGame.player.carryValue += debris.value;
      runtime.collectScrap({ value: debris.value });
    }
  }
});
elements.depositCarry.addEventListener("click", () => {
  if (canDispatchGameplayAction()) {
    canvasGame.forceDeposit();
  }
});
elements.takeHit.addEventListener("click", () => {
  if (canDispatchGameplayAction()) {
    canvasGame.forceDamage();
  }
});
elements.pauseBtn.addEventListener("click", () => {
  togglePause();
});
document.addEventListener("keydown", handleKeydown);

elements.objective.textContent = UI_COPY.objective;
renderTitleMeta();
showScreen("title");
requestAnimationFrame(update);
