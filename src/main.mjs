import { GameRuntime, UI_COPY } from "./game_state.mjs";
import { ToastQueue } from "./toast_queue.mjs";
import { CanvasGame } from "./game_canvas.mjs";
import { GENERATED_IMAGE_ASSETS, pickDistinctAssets } from "./generated_assets.mjs";

const STORAGE_KEYS = Object.freeze({
  seenFtue: "ppj_seen_ftue",
  bestScore: "ppj_best_score",
  lastResult: "ppj_last_result",
  difficulty: "ppj_difficulty"
});

const MOVEMENT_KEYS = new Set([
  "arrowleft",
  "arrowright",
  "arrowup",
  "arrowdown",
  "a",
  "d",
  "w",
  "s"
]);

const runtime = new GameRuntime();
const toastQueue = new ToastQueue({ minGapMs: 1200, durationMs: 2200 });

const END_PANEL_DELAY_MS = 260;
const UPGRADE_TIMEOUT_SECONDS = 10;
const BGM_SRC = "./assets/audio/generated/combat_loop.wav";
const BGM_VOLUME = 0.28;
const FALLBACK_TITLE_ART = "./assets/images/generated/keyart.svg";
const FALLBACK_ENEMY_ART = "./assets/images/generated/enemy_concept.svg";

const elements = {
  titleScreen: document.getElementById("title-screen"),
  gameScreen: document.getElementById("game-screen"),
  titleMeta: document.getElementById("title-meta"),
  titleArt: document.getElementById("title-art"),
  startRun: document.getElementById("start-run"),
  shuffleArt: document.getElementById("shuffle-art"),
  difficultySelect: document.getElementById("difficulty-select"),
  timer: document.getElementById("timer"),
  hp: document.getElementById("hp"),
  score: document.getElementById("score"),
  wave: document.getElementById("wave"),
  surge: document.getElementById("surge"),
  overheatFill: document.getElementById("overheat-fill"),
  overheatText: document.getElementById("overheat-text"),
  polarity: document.getElementById("polarity"),
  objective: document.getElementById("objective-strip"),
  toast: document.getElementById("toast"),
  overlay: document.getElementById("ftue-overlay"),
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
  copyResult: document.getElementById("copy-result"),
  canvas: document.getElementById("game-canvas"),
  pauseBtn: document.getElementById("pause-btn"),
  audioToggle: document.getElementById("audio-toggle"),
  upgradePanel: document.getElementById("upgrade-panel"),
  upgradeList: document.getElementById("upgrade-list"),
  upgradeTimer: document.getElementById("upgrade-timer")
};

let rafTime = performance.now();
let pendingEndPanelTimer = null;
let pendingUpgradeTimer = null;
let upgradeTimeLeft = UPGRADE_TIMEOUT_SECONDS;
let canvasGame = null;
let currentVisualAssets = null;
let latestEndEvent = null;

let bgmEnabled = true;
let bgmAvailable = typeof Audio !== "undefined";
const bgmTrack = bgmAvailable ? new Audio(BGM_SRC) : null;

if (bgmTrack) {
  bgmTrack.loop = true;
  bgmTrack.preload = "auto";
  bgmTrack.volume = BGM_VOLUME;
  bgmTrack.addEventListener("error", () => {
    bgmAvailable = false;
    syncAudioButton();
  });
}

function pickVisualAssets(seed = Date.now()) {
  const picks = pickDistinctAssets(seed, 8);
  let titleArt = picks[0] || FALLBACK_TITLE_ART;
  let playerArt = picks[1] || titleArt;
  let backdropArt = picks[2] || titleArt;
  let enemyArt = picks[3] || FALLBACK_ENEMY_ART;
  const gallery = picks.length > 0 ? picks : GENERATED_IMAGE_ASSETS.slice(0, 8);

  if (!GENERATED_IMAGE_ASSETS.includes(FALLBACK_ENEMY_ART)) {
    enemyArt = picks[3] || picks[2] || backdropArt;
  }

  return {
    titleArt,
    playerArt,
    backdropArt,
    enemyArt,
    gallery
  };
}

function applyVisualAssets(assets) {
  if (!assets) {
    return;
  }

  if (elements.titleArt) {
    elements.titleArt.src = assets.titleArt;
  }

  if (canvasGame && typeof canvasGame.setVisualAssets === "function") {
    canvasGame.setVisualAssets(assets);
  }
}

function shuffleVisualAssets() {
  currentVisualAssets = pickVisualAssets(Date.now() + Math.floor(Math.random() * 10_000));
  applyVisualAssets(currentVisualAssets);
}

function getSelectedDifficulty() {
  const value = String(elements.difficultySelect?.value || "arcade").toLowerCase();
  if (value === "casual" || value === "insane") {
    return value;
  }
  return "arcade";
}

function saveSelectedDifficulty() {
  safeSetItem(STORAGE_KEYS.difficulty, getSelectedDifficulty());
}

function restoreDifficultySelection() {
  const stored = safeGetItem(STORAGE_KEYS.difficulty);
  if (!elements.difficultySelect || !stored) {
    return;
  }
  const normalized = stored.toLowerCase();
  if (normalized === "casual" || normalized === "arcade" || normalized === "insane") {
    elements.difficultySelect.value = normalized;
  }
}

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

function syncAudioButton() {
  if (!elements.audioToggle) {
    return;
  }

  if (!bgmAvailable || !bgmTrack) {
    elements.audioToggle.disabled = true;
    elements.audioToggle.textContent = "Music: Missing";
    return;
  }

  elements.audioToggle.disabled = false;
  const isPlaying = !bgmTrack.paused && !bgmTrack.ended;
  if (!bgmEnabled) {
    elements.audioToggle.textContent = "Music: Off";
    return;
  }
  elements.audioToggle.textContent = isPlaying ? "Music: On" : "Music: Tap to Enable";
}

async function playBgm() {
  if (!bgmTrack || !bgmAvailable || !bgmEnabled) {
    syncAudioButton();
    return;
  }

  try {
    await bgmTrack.play();
  } catch {
    // Browser may block autoplay until explicit user interaction.
  }

  syncAudioButton();
}

function stopBgm(resetTime = false) {
  if (!bgmTrack) {
    return;
  }

  bgmTrack.pause();
  if (resetTime) {
    bgmTrack.currentTime = 0;
  }
  syncAudioButton();
}

function toggleBgm() {
  if (!bgmAvailable) {
    syncAudioButton();
    return;
  }

  bgmEnabled = !bgmEnabled;
  if (!bgmEnabled) {
    stopBgm(false);
    return;
  }
  void playBgm();
}

function isGameplayPaused() {
  return runtime.isPaused() || Boolean(canvasGame && canvasGame.paused);
}

function clearUpgradeTimer() {
  if (pendingUpgradeTimer !== null) {
    clearInterval(pendingUpgradeTimer);
    pendingUpgradeTimer = null;
  }
}

function hideUpgradePanel() {
  clearUpgradeTimer();
  elements.upgradePanel.hidden = true;
  elements.upgradeList.innerHTML = "";
  elements.upgradeTimer.textContent = "";
}

function togglePause() {
  if (!canvasGame || !runtime.isRunning()) {
    return false;
  }

  if (!elements.upgradePanel.hidden) {
    return true;
  }

  const paused = runtime.setPaused(!runtime.isPaused());
  canvasGame.setPaused(paused);
  elements.pauseBtn.textContent = paused ? "Resume" : "Pause";

  if (paused) {
    stopBgm(false);
  } else if (runtime.isRunning()) {
    void playBgm();
  }

  return paused;
}

function renderTitleMeta() {
  const best = readBestScore();
  const last = readLastResult();
  const difficulty = getSelectedDifficulty();
  if (!last) {
    elements.titleMeta.textContent = `Best score: ${best} | Difficulty: ${difficulty.toUpperCase()} | No completed shifts yet.`;
    return;
  }

  const difficultyLabel = String(last.difficulty || difficulty).toUpperCase();
  elements.titleMeta.textContent = `Best score: ${best} | Last shift: ${last.outcome} (${last.score}) | ${difficultyLabel}`;
}

function startRun() {
  if (pendingEndPanelTimer !== null) {
    clearTimeout(pendingEndPanelTimer);
    pendingEndPanelTimer = null;
  }

  hideUpgradePanel();
  toastQueue.reset();
  latestEndEvent = null;
  if (elements.copyResult) {
    elements.copyResult.textContent = "Copy Result";
  }

  const firstRun = safeGetItem(STORAGE_KEYS.seenFtue) !== "1";
  const difficulty = getSelectedDifficulty();
  saveSelectedDifficulty();
  runtime.startRun({ firstRun });
  if (firstRun) {
    safeSetItem(STORAGE_KEYS.seenFtue, "1");
  }

  if (!canvasGame) {
    canvasGame = new CanvasGame(elements.canvas, runtime);
    canvasGame.setUpgradeHandler(showUpgradePanel);
  }
  canvasGame.setDifficulty(difficulty);
  if (!currentVisualAssets) {
    currentVisualAssets = pickVisualAssets(Date.now());
  }
  canvasGame.setVisualAssets(currentVisualAssets);
  canvasGame.init();

  elements.endPanel.hidden = true;
  elements.overlay.hidden = true;
  elements.toast.hidden = true;
  elements.pauseBtn.textContent = "Pause";

  showScreen("game");
  processEvents();
  renderHud(runtime.getSnapshot(), canvasGame.getCombatSnapshot());
  void playBgm();
}

function quitToTitle() {
  if (pendingEndPanelTimer !== null) {
    clearTimeout(pendingEndPanelTimer);
    pendingEndPanelTimer = null;
  }

  hideUpgradePanel();

  if (canvasGame) {
    canvasGame.setPaused(true);
  }
  runtime.setPaused(true);

  toastQueue.reset();
  hideToast();

  elements.endPanel.hidden = true;
  elements.overlay.hidden = true;

  showScreen("title");
  renderTitleMeta();
  stopBgm(true);
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
  if (elements.toast.hidden) {
    return;
  }

  elements.toast.hidden = true;
  elements.toast.className = "";
  elements.toast.textContent = "";
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

function renderHud(snapshot, combat = null) {
  const overheatPercent = combat
    ? Math.max(0, Math.min(100, Math.round(combat.overheatPercent)))
    : Math.max(0, Math.min(100, Math.round(snapshot.heat || 0)));

  elements.timer.textContent = `${snapshot.timeLeftRounded}s`;
  elements.hp.textContent = String(combat ? combat.hp : snapshot.hp);
  elements.score.textContent = String(combat ? combat.score : snapshot.scoreRounded);
  elements.wave.textContent = String(combat ? combat.wave : snapshot.wave || "1");

  if (elements.surge) {
    if (combat?.surgeActive) {
      elements.surge.textContent = "ACTIVE";
    } else if (combat && Number.isFinite(combat.surgeCooldown) && combat.surgeCooldown > 0) {
      elements.surge.textContent = `${combat.surgeCooldown.toFixed(1)}s`;
    } else {
      elements.surge.textContent = "READY";
    }
  }

  elements.overheatFill.style.width = `${overheatPercent}%`;
  elements.overheatFill.classList.remove("warn", "danger");
  if (overheatPercent >= 75) {
    elements.overheatFill.classList.add("danger");
  } else if (overheatPercent >= 50) {
    elements.overheatFill.classList.add("warn");
  }
  elements.overheatText.textContent = `${overheatPercent}%`;

  const polarityLabel = combat
    ? combat.polarityLabel
    : (snapshot.polarity === "attract" ? "ATTRACT" : (snapshot.polarity === "repel" ? "REPEL" : "OFF"));

  const polarityClass = combat
    ? combat.polarityClass
    : (snapshot.overheatLocked ? "locked" : (snapshot.polarity === "attract" ? "attract" : (snapshot.polarity === "repel" ? "repel" : "")));

  elements.polarity.textContent = polarityLabel;
  elements.polarity.className = "hud-value";
  if (polarityClass) {
    elements.polarity.classList.add(polarityClass);
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

  latestEndEvent = event;
  const difficulty = getSelectedDifficulty();
  latestEndEvent.difficulty = difficulty;

  writeLastResult({
    outcome: event.outcome,
    score: currentScore,
    difficulty
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

function buildShareText() {
  if (!latestEndEvent) {
    return "Pocket Planet Janitor";
  }

  const difficulty = String(latestEndEvent.difficulty || getSelectedDifficulty()).toUpperCase();
  const score = latestEndEvent.stats?.finalScore ?? 0;
  const survived = latestEndEvent.stats?.survivedSeconds ?? 0;
  const outcome = latestEndEvent.outcome || "run";
  return [
    `Pocket Planet Janitor - ${difficulty}`,
    `Outcome: ${outcome}`,
    `Score: ${score}`,
    `Survived: ${survived}s`,
    "Can you beat this run?"
  ].join("\n");
}

async function copyResultSummary() {
  const text = buildShareText();
  let copied = false;
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
  }

  if (!copied) {
    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "absolute";
    fallback.style.left = "-9999px";
    document.body.appendChild(fallback);
    fallback.select();
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    fallback.remove();
  }

  if (elements.copyResult) {
    elements.copyResult.textContent = copied ? "Copied" : "Copy Failed";
    setTimeout(() => {
      if (elements.copyResult) {
        elements.copyResult.textContent = "Copy Result";
      }
    }, 1200);
  }
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
      continue;
    }

    if (event.type === "toast") {
      toastQueue.enqueue(event, nowMs);
      continue;
    }

    if (event.type === "overlay") {
      renderOverlay(event);
      continue;
    }

    if (event.type === "feedback" && event.key === "damage") {
      elements.gameScreen.style.boxShadow = "0 0 0 2px #ff5f6d inset";
      setTimeout(() => {
        elements.gameScreen.style.boxShadow = "";
      }, 120);
      continue;
    }

    if (event.type === "end") {
      hideUpgradePanel();
      toastQueue.reset();
      hideToast();
      queueEndPanel(event);
      renderTitleMeta();
    }
  }
}

function renderUpgradeChoices(choices) {
  const rows = choices.map((choice) => {
    const id = escapeHtml(choice.id);
    const name = escapeHtml(choice.name);
    const description = escapeHtml(choice.description);
    return `
      <button type="button" class="upgrade-card" data-upgrade-id="${id}">
        <strong>${name}</strong>
        <span>${description}</span>
      </button>
    `;
  });

  elements.upgradeList.innerHTML = rows.join("\n");
}

function applyUpgrade(upgradeId) {
  if (!canvasGame || !canvasGame.resolveUpgrade(upgradeId)) {
    return;
  }

  hideUpgradePanel();

  if (runtime.isRunning()) {
    runtime.setPaused(false);
    canvasGame.setPaused(false);
    elements.pauseBtn.textContent = "Pause";
  }
}

function showUpgradePanel(choices) {
  if (!runtime.isRunning() || !canvasGame || !Array.isArray(choices) || choices.length === 0) {
    return;
  }

  runtime.setPaused(true);
  canvasGame.setPaused(true);
  elements.pauseBtn.textContent = "Resume";

  renderUpgradeChoices(choices);
  elements.upgradePanel.hidden = false;

  upgradeTimeLeft = UPGRADE_TIMEOUT_SECONDS;
  elements.upgradeTimer.textContent = `Auto-pick in ${upgradeTimeLeft}s`;

  clearUpgradeTimer();
  pendingUpgradeTimer = setInterval(() => {
    upgradeTimeLeft -= 1;
    if (upgradeTimeLeft <= 0) {
      applyUpgrade(choices[0].id);
      return;
    }

    elements.upgradeTimer.textContent = `Auto-pick in ${upgradeTimeLeft}s`;
  }, 1000);
}

function handleUpgradeClick(event) {
  const target = event.target.closest("[data-upgrade-id]");
  if (!target) {
    return;
  }

  applyUpgrade(target.getAttribute("data-upgrade-id"));
}

function handleUpgradeHotkey(event) {
  if (elements.upgradePanel.hidden) {
    return false;
  }

  const cards = Array.from(elements.upgradeList.querySelectorAll("[data-upgrade-id]"));
  if (cards.length === 0) {
    return false;
  }

  const keyToIndex = {
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    Numpad1: 0,
    Numpad2: 1,
    Numpad3: 2
  };

  let index = keyToIndex[event.code];
  if (index === undefined && event.code === "Enter") {
    index = 0;
  }
  if (index === undefined) {
    return false;
  }

  const selected = cards[Math.min(index, cards.length - 1)];
  if (!selected) {
    return false;
  }

  applyUpgrade(selected.getAttribute("data-upgrade-id"));
  event.preventDefault();
  return true;
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

  if (handleUpgradeHotkey(event)) {
    return;
  }

  if (!runtime.isRunning() || isGameplayPaused()) {
    return;
  }

  if (MOVEMENT_KEYS.has(key)) {
    runtime.registerMovement();
  }

  if (event.code === "Space") {
    event.preventDefault();
  }
}

function update(now) {
  const deltaSeconds = Math.min((now - rafTime) / 1000, 0.25);
  rafTime = now;

  const paused = isGameplayPaused();

  if (runtime.isRunning() && !paused) {
    runtime.tick(deltaSeconds);

    if (canvasGame && !canvasGame.gameOver) {
      canvasGame.update(deltaSeconds);

      const playerState = canvasGame.getPlayerState();
      if (playerState) {
        runtime.syncPlayerState({
          hp: playerState.hp,
          carryCount: playerState.carryCount,
          carryValue: playerState.carryValue
        });
      }

      if (canvasGame.gameOver && runtime.isRunning()) {
        runtime.endRunFromGameOver();
      }
    }
  }

  if (canvasGame) {
    canvasGame.draw();
  }

  processEvents();
  syncToastQueue(now);

  const snapshot = runtime.getSnapshot();
  const combatSnapshot = canvasGame ? canvasGame.getCombatSnapshot() : null;
  renderHud(snapshot, combatSnapshot);

  requestAnimationFrame(update);
}

elements.startRun.addEventListener("click", startRun);
if (elements.shuffleArt) {
  elements.shuffleArt.addEventListener("click", shuffleVisualAssets);
}
if (elements.difficultySelect) {
  elements.difficultySelect.addEventListener("change", () => {
    saveSelectedDifficulty();
    renderTitleMeta();
  });
}
elements.restartRun.addEventListener("click", startRun);
elements.quitTitle.addEventListener("click", quitToTitle);
if (elements.copyResult) {
  elements.copyResult.addEventListener("click", () => {
    void copyResultSummary();
  });
}
elements.pauseBtn.addEventListener("click", togglePause);
elements.audioToggle.addEventListener("click", toggleBgm);
elements.upgradeList.addEventListener("click", handleUpgradeClick);
document.addEventListener("keydown", handleKeydown);
document.addEventListener("visibilitychange", () => {
  if (!bgmTrack || !bgmAvailable) {
    return;
  }

  if (document.hidden) {
    stopBgm(false);
    return;
  }

  if (runtime.isRunning() && !isGameplayPaused()) {
    void playBgm();
  }
});

elements.objective.textContent = UI_COPY.objective;
restoreDifficultySelection();
if (elements.titleArt) {
  elements.titleArt.addEventListener("error", () => {
    elements.titleArt.src = FALLBACK_TITLE_ART;
  });
}
shuffleVisualAssets();
renderTitleMeta();
syncAudioButton();
showScreen("title");
requestAnimationFrame(update);
