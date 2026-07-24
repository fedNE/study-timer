const DEFAULT_CYCLE = [
  { minutes: 20, type: "focus", label: "20 minute focus" },
  { minutes: 3, type: "break", label: "3 minute break" },
  { minutes: 40, type: "focus", label: "40 minute focus" },
  { minutes: 2, type: "break", label: "2 minute reset" },
  { minutes: 10, type: "focus", label: "10 minute review" },
  { minutes: 20, type: "break", label: "20 minute break" }
];
const DEFAULT_DURATIONS = DEFAULT_CYCLE.map((phase) => phase.minutes);

const STORAGE_KEY = "study-cycle-timer:v1";
const SECOND = 1000;

const els = {
  phaseKind: document.getElementById("phaseKind"),
  phaseStep: document.getElementById("phaseStep"),
  timeDisplay: document.getElementById("timeDisplay"),
  phaseName: document.getElementById("phaseName"),
  progressFill: document.getElementById("progressFill"),
  startPause: document.getElementById("startPause"),
  skip: document.getElementById("skip"),
  reset: document.getElementById("reset"),
  settings: document.getElementById("settings"),
  settingsPanel: document.getElementById("settingsPanel"),
  closeSettings: document.getElementById("closeSettings"),
  saveSettings: document.getElementById("saveSettings"),
  settingsFields: document.getElementById("settingsFields"),
  soundToggle: document.getElementById("soundToggle"),
  dots: [...document.querySelectorAll("[data-dot]")]
};

let audioContext = null;
let timerId = null;
let state = loadState();

function durationFor(index, durations = DEFAULT_DURATIONS) {
  return durations[index] * 60 * SECOND;
}

function cycleLabel(index) {
  const phase = DEFAULT_CYCLE[index];
  return `${state.durations[index]} minute ${phase.type === "focus" ? "focus" : "break"}`;
}

function freshState(durations = DEFAULT_DURATIONS) {
  const safeDurations = normalizeDurations(durations);
  return {
    phaseIndex: 0,
    remainingMs: durationFor(0, safeDurations),
    running: false,
    updatedAt: Date.now(),
    sound: true,
    durations: safeDurations,
    done: false
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Number.isInteger(saved.phaseIndex)) return freshState();

    const safePhase = Math.min(Math.max(saved.phaseIndex, 0), DEFAULT_CYCLE.length - 1);
    const loaded = {
      ...freshState(),
      ...saved,
      phaseIndex: safePhase,
      sound: saved.sound !== false,
      durations: normalizeDurations(saved.durations),
      done: saved.done === true,
      updatedAt: Number(saved.updatedAt) || Date.now()
    };

    loaded.remainingMs = Math.min(
      Math.max(Number(loaded.remainingMs) || durationFor(safePhase, loaded.durations), 0),
      durationFor(safePhase, loaded.durations)
    );

    if (loaded.running) {
      return applyElapsed(loaded, Date.now() - loaded.updatedAt);
    }

    return loaded;
  } catch {
    return freshState();
  }
}

function normalizeDurations(value) {
  const defaults = DEFAULT_DURATIONS;
  if (!Array.isArray(value)) return defaults;
  return defaults.map((fallback, index) => {
    const minutes = Number(value[index]);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
  });
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...state, updatedAt: Date.now() })
  );
}

function applyElapsed(current, elapsedMs) {
  let next = { ...current };
  let elapsed = Math.max(0, elapsedMs);

  while (next.running && elapsed >= next.remainingMs) {
    elapsed -= next.remainingMs;

    if (next.phaseIndex === DEFAULT_CYCLE.length - 1) {
      next = freshState(current.durations);
      next.sound = current.sound;
      next.done = true;
      break;
    }

    next.phaseIndex += 1;
    next.remainingMs = durationFor(next.phaseIndex, next.durations);
    next.done = false;
  }

  if (next.running) {
    next.remainingMs -= elapsed;
  }

  next.updatedAt = Date.now();
  return next;
}

function tick() {
  if (!state.running) return;

  const previousPhase = state.phaseIndex;
  const wasFinal = previousPhase === DEFAULT_CYCLE.length - 1;
  state = applyElapsed(state, Date.now() - state.updatedAt);

  if (state.phaseIndex !== previousPhase || (wasFinal && state.done)) {
    playTone();
  }

  render();
  saveState();

  if (!state.running) {
    stopTicker();
  }
}

function startTicker() {
  stopTicker();
  timerId = window.setInterval(tick, 250);
}

function stopTicker() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function toggleRunning() {
  primeAudio();
  state.running = !state.running;
  state.done = false;
  state.updatedAt = Date.now();

  if (state.running) {
    startTicker();
  } else {
    stopTicker();
  }

  render();
  saveState();
}

function resetTimer() {
  stopTicker();
  const sound = state.sound;
  const durations = state.durations;
  state = freshState(durations);
  state.sound = sound;
  render();
  saveState();
}

function skipPhase() {
  primeAudio();

  if (state.phaseIndex === DEFAULT_CYCLE.length - 1) {
    const sound = state.sound;
    const durations = state.durations;
    state = freshState(durations);
    state.sound = sound;
    state.done = true;
    stopTicker();
  } else {
    state.phaseIndex += 1;
    state.remainingMs = durationFor(state.phaseIndex, state.durations);
    state.done = false;
  }

  state.updatedAt = Date.now();
  playTone();
  render();
  saveState();
}

function setSound(enabled) {
  state.sound = enabled;
  saveState();

  if (enabled) {
    primeAudio();
    playTone(120, 660, 0.04);
  }
}

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function render() {
  const phase = DEFAULT_CYCLE[state.phaseIndex];
  const total = durationFor(state.phaseIndex, state.durations);
  const elapsed = total - state.remainingMs;
  const progress = Math.min(Math.max((elapsed / total) * 100, 0), 100);

  document.body.dataset.phaseType = phase.type;
  document.body.dataset.cycleDone = String(state.done);
  els.phaseKind.textContent = state.done ? "Done" : phase.type;
  els.phaseStep.textContent = `${state.phaseIndex + 1} / ${DEFAULT_CYCLE.length}`;
  els.phaseName.textContent = state.done ? "Cycle complete" : phase.label;
  if (!state.done) els.phaseName.textContent = cycleLabel(state.phaseIndex);
  els.timeDisplay.textContent = formatTime(state.remainingMs);
  els.progressFill.style.width = `${progress}%`;
  els.startPause.textContent = state.running ? "Pause" : "Start";
  els.soundToggle.checked = state.sound;
  document.title = `${formatTime(state.remainingMs)} - Study Cycle Timer`;

  els.dots.forEach((dot, index) => {
    dot.classList.toggle("is-active", index === state.phaseIndex && !state.done);
    dot.classList.toggle("is-complete", index < state.phaseIndex || state.done);
  });
}

function renderSettings() {
  els.settingsFields.innerHTML = DEFAULT_CYCLE.map((phase, index) => `
    <label>
      <span>${index + 1}. ${phase.type}</span>
      <input data-time="${index}" type="number" min="1" max="180" value="${state.durations[index]}">
    </label>
  `).join("");
}

function openSettings() {
  renderSettings();
  els.settingsPanel.hidden = false;
}

function closeSettings() {
  els.settingsPanel.hidden = true;
}

function saveSettings() {
  const values = [...els.settingsFields.querySelectorAll("input")].map((input) => Number(input.value));
  state.durations = normalizeDurations(values);
  state.remainingMs = Math.min(state.remainingMs, durationFor(state.phaseIndex, state.durations));
  state.updatedAt = Date.now();
  closeSettings();
  render();
  saveState();
}

function primeAudio() {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(duration = 180, frequency = 880, volume = 0.07) {
  if (!state.sound || !audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration / 1000);
}

els.startPause.addEventListener("click", toggleRunning);
els.reset.addEventListener("click", resetTimer);
els.skip.addEventListener("click", skipPhase);
els.settings.addEventListener("click", openSettings);
els.closeSettings.addEventListener("click", closeSettings);
els.saveSettings.addEventListener("click", saveSettings);
els.soundToggle.addEventListener("change", (event) => {
  setSound(event.currentTarget.checked);
});

window.addEventListener("beforeunload", saveState);
window.addEventListener("keydown", (event) => {
  if (event.target.matches("button, input")) return;
  if (event.code === "Space") {
    event.preventDefault();
    toggleRunning();
  } else if (event.key.toLowerCase() === "r") {
    resetTimer();
  } else if (event.key.toLowerCase() === "s") {
    skipPhase();
  }
});

render();
if (state.running) startTicker();
