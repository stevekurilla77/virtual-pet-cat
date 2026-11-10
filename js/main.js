import { AudioBus } from "./audio.js";
import {
  COAT_ORDER,
  COATS,
  EYE_ORDER,
  EYES,
  cleanName,
  loadCat,
  saveCat,
  swatchBackground,
} from "./coats.js";
import { Game, renderPreview } from "./game.js";
import { auditTailPose, renderTailSheet } from "./kitten.js";

const app = document.querySelector("#app");
const roomCanvas = document.querySelector("#room");
const preview = document.querySelector("#preview");
const previewCtx = preview.getContext("2d");
const picker = document.querySelector("#picker");
const hud = document.querySelector("#hud");
const form = document.querySelector("#cat-form");
const nameInput = document.querySelector("#cat-name");
const coatName = document.querySelector("#coat-name");
const startBtn = document.querySelector("#start");
const cancelBtn = document.querySelector("#cancel");
const title = document.querySelector("#picker-title");
const label = document.querySelector("#cat-label");
const hint = document.querySelector("#hint");
const muteBtn = document.querySelector("#mute");
const editBtn = document.querySelector("#edit");
const tray = document.querySelector("#tray");
const dock = document.querySelector("#dock");
const trayToggle = document.querySelector("#tray-toggle");
const topbar = document.querySelector("#chrome");
const bars = {
  playful: document.querySelector("#bar-play"),
  sleepy: document.querySelector("#bar-sleep"),
  happy: document.querySelector("#bar-happy"),
  bond: document.querySelector("#bar-bond"),
};
const goalChip = document.querySelector("#goal-chip");
const goOut = document.querySelector("#go-out");
const callBirds = document.querySelector("#call-birds");
const settingsEl = document.querySelector("#settings");
const settingsOpen = document.querySelector("#settings-open");
const settingsClose = document.querySelector("#settings-close");
const unlockAllBtn = document.querySelector("#unlock-all");
const goalList = document.querySelector("#goal-list");
const bondReadout = document.querySelector("#bond-readout");

const audio = new AudioBus();
const game = new Game(roomCanvas, audio);
game.onSave = () => persist();
const draft = {
  name: "Miso",
  gender: "girl",
  hair: "short",
  coat: "orange",
  eyes: "green",
};

let saved = loadCat();
let editing = false;
let last = performance.now();
let previewTime = 0;

if (!saved) document.documentElement.classList.remove("has-cat");

buildSwatches();
bindControls();
if (saved) openRoom(saved, false);
else showPicker(false);

game.onHud = (hudState) => {
  const playful = Math.round(hudState.moods.playful * 100);
  const sleepy = Math.round(hudState.moods.sleepy * 100);
  const happy = Math.round(hudState.moods.happy * 100);
  setMeter(bars.playful, playful);
  setMeter(bars.sleepy, sleepy);
  setMeter(bars.happy, happy);
  setMeter(bars.bond, Math.round(hudState.bond || 0));
  paintGoals(hudState);
  if (hudState.notice && hudState.notice !== lastNotice) {
    lastNotice = hudState.notice;
    toast.textContent = hudState.notice;
    showPlayToast();
  }
  hint.textContent = hudState.hint || "";
  for (const button of tray.querySelectorAll(".toy")) {
    const on = button.dataset.tool === hudState.tool;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
};

window.addEventListener("resize", () => {
  if (!hud.hidden) game.resize(measureUi());
  sizePreview();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    persist();
    return;
  }
  last = performance.now();
  requestAnimationFrame(loop);
});

window.addEventListener("pagehide", persist);

requestAnimationFrame(loop);

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  previewTime += dt;
  try {
    if (game.running) game.update(dt);
    if (!picker.hidden) drawPreview();
    else if (game.cat) game.render();
  } catch (error) {
    console.error(error);
  }
  if (!document.hidden) requestAnimationFrame(loop);
}

function drawPreview() {
  const rect = preview.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  if (preview.width !== Math.round(w * dpr) || preview.height !== Math.round(h * dpr)) {
    preview.width = Math.round(w * dpr);
    preview.height = Math.round(h * dpr);
  }
  previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderPreview(previewCtx, currentDraft(), w, h, previewTime);
}

function sizePreview() {
  if (!picker.hidden) drawPreview();
}

function buildSwatches() {
  const coats = document.querySelector("#coats");
  const eyes = document.querySelector("#eyes");
  for (const id of COAT_ORDER) {
    const coat = COATS[id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.dataset.value = id;
    button.setAttribute("aria-label", coat.name);
    button.setAttribute("aria-pressed", id === draft.coat ? "true" : "false");
    button.style.background = swatchBackground(coat);
    button.addEventListener("click", () => {
      draft.coat = id;
      syncSeg("#coats", id);
      coatName.textContent = coat.name;
    });
    coats.appendChild(button);
  }
  for (const id of EYE_ORDER) {
    const eye = EYES[id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.dataset.value = id;
    button.setAttribute("aria-label", `${eye.name} eyes`);
    button.setAttribute("aria-pressed", id === draft.eyes ? "true" : "false");
    button.style.background = `radial-gradient(circle at 35% 35%, #fff 0 12%, ${eye.color} 13% 70%, ${eye.deep} 71%)`;
    button.addEventListener("click", () => {
      draft.eyes = id;
      syncSeg("#eyes", id);
    });
    eyes.appendChild(button);
  }
}

function bindControls() {
  for (const button of document.querySelectorAll("#gender button")) {
    button.addEventListener("click", () => {
      draft.gender = button.dataset.value;
      syncSeg("#gender", draft.gender);
    });
  }
  for (const button of document.querySelectorAll("#hair button")) {
    button.addEventListener("click", () => {
      draft.hair = button.dataset.value;
      syncSeg("#hair", draft.hair);
    });
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    audio.unlock();
    const config = {
      ...(saved || {}),
      ...currentDraft(),
      mute: saved ? saved.mute : audio.muted,
      mood: saved ? saved.mood : { playful: 0.48, sleepy: 0.3, happy: 0.66 },
    };
    if (editing && game.cat) config.mood = { ...game.moods };
    saved = config;
    saveCat(saved);
    openRoom(saved, !editing);
    editing = false;
  });
  cancelBtn.addEventListener("click", () => {
    if (!saved) return;
    editing = false;
    openRoom(saved, false);
  });
  muteBtn.addEventListener("click", () => {
    audio.unlock();
    const muted = !audio.muted;
    audio.setMuted(muted);
    if (saved) {
      saved.mute = muted;
      saveCat(saved);
    }
    muteBtn.classList.toggle("is-muted", muted);
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    muteBtn.setAttribute("aria-label", muted ? "Unmute sounds" : "Mute sounds");
  });
  editBtn.addEventListener("click", () => {
    audio.unlock();
    if (saved && game.cat) saved.mood = { ...game.moods };
    persist();
    showPicker(true);
  });
  for (const button of tray.querySelectorAll(".toy")) {
    button.addEventListener("click", () => {
      audio.unlock();
      if (button.dataset.tool === "scratch") {
        game.startScratch();
        return;
      }
      const previous = game.tool;
      game.setTool(button.dataset.tool);
      if (game.tool && game.tool !== previous && !introduced.has(game.tool)) {
        introduced.add(game.tool);
        toast.textContent = "Drag on the floor to play";
        showPlayToast();
      }
    });
  }
  callBirds.addEventListener("click", () => {
    audio.unlock();
    game.callBirds();
  });
  goOut.addEventListener("click", () => {
    audio.unlock();
    if (game.scene === "out") game.requestInside();
    else game.requestOutside();
  });
  goalChip.addEventListener("click", () => openSettings());
  settingsOpen.addEventListener("click", () => openSettings());
  settingsClose.addEventListener("click", () => {
    settingsEl.hidden = true;
  });
  unlockAllBtn.addEventListener("click", () => {
    game.setUnlockAll(!game.unlockAll);
    paintGoals(game.goalSnapshot && { goals: game.goalSnapshot(), bond: game.bond, unlockAll: game.unlockAll, scene: game.scene, outsideOpen: game.outsideUnlocked() });
  });

  trayToggle.addEventListener("click", () => {
    const open = dock.classList.toggle("collapsed");
    trayToggle.setAttribute("aria-expanded", open ? "false" : "true");
    trayToggle.setAttribute("aria-label", open ? "Show toys" : "Hide toys");
    trayToggle.textContent = open ? "Show" : "Toys";
    if (!hud.hidden) game.resize(measureUi());
  });

  const listen = { capture: true, passive: false };
  app.addEventListener("pointerdown", (event) => onPlayDown(event, "pointer"), listen);
  app.addEventListener("pointermove", (event) => onPlayMove(event, "pointer"), listen);
  app.addEventListener("pointerup", (event) => onPlayUp(event, "pointer"), listen);
  app.addEventListener("pointercancel", (event) => onPlayUp(event, "pointer"), listen);
  app.addEventListener("touchstart", (event) => onPlayDown(event, "touch"), listen);
  app.addEventListener("touchmove", (event) => onPlayMove(event, "touch"), listen);
  app.addEventListener("touchend", (event) => onPlayUp(event, "touch"), listen);
  app.addEventListener("touchcancel", (event) => onPlayUp(event, "touch"), listen);
  window.addEventListener("pointerup", (event) => onPlayUp(event, "pointer"), listen);
  window.addEventListener("touchend", (event) => onPlayUp(event, "touch"), listen);
  document.addEventListener("gesturestart", (event) => event.preventDefault(), listen);
  roomCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
  bindSecret(label);
  bindSecret(title);
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "m" && event.target.tagName !== "INPUT") muteBtn.click();
  });
}

const introduced = new Set();
const inputGate = { source: "", at: 0 };
const toast = document.querySelector("#play-toast");
const debugEl = document.querySelector("#touch-debug");

function isControl(target) {
  if (!target || !target.closest) return false;
  return Boolean(target.closest("#dock, #chrome, #settings, #picker, button, input, a, label"));
}

let lastNotice = "";

function openSettings() {
  settingsEl.hidden = false;
  paintGoals({
    goals: game.goalSnapshot(),
    bond: game.bond,
    unlockAll: game.unlockAll,
    scene: game.scene,
    outsideOpen: game.outsideUnlocked(),
  });
}

function paintGoals(hudState) {
  if (!hudState || !hudState.goals) return;
  const next = hudState.goals.find((goal) => goal.have < goal.need) || hudState.goals[hudState.goals.length - 1];
  const done = hudState.goals.every((goal) => goal.have >= goal.need);
  goalChip.textContent = done ? "Today is complete" : `${next.label} ${Math.min(next.have, next.need)}/${next.need}`;
  goOut.textContent = hudState.scene === "out" ? "Inside" : "Outside";
  goOut.classList.toggle("is-locked", hudState.scene !== "out" && !hudState.outsideOpen);
  if (!settingsEl.hidden) {
    bondReadout.textContent = `Bond ${Math.round(hudState.bond || 0)} of 100. The porch opens at 5.`;
    unlockAllBtn.setAttribute("aria-pressed", hudState.unlockAll ? "true" : "false");
    unlockAllBtn.textContent = hudState.unlockAll ? "Everything is unlocked" : "Unlock everything";
    goalList.replaceChildren(
      ...hudState.goals.map((goal) => {
        const item = document.createElement("li");
        item.classList.toggle("done", goal.have >= goal.need);
        item.textContent = `${goal.label} · ${Math.min(goal.have, goal.need)}/${goal.need}`;
        return item;
      })
    );
  }
}

function claimInput(source) {
  const now = performance.now();
  if (inputGate.source && inputGate.source !== source && now - inputGate.at < 70) return false;
  inputGate.source = source;
  inputGate.at = now;
  return true;
}

function pointFrom(event) {
  const src = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0]) || event;
  const rect = roomCanvas.getBoundingClientRect();
  return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

function paintDebug(type, point) {
  if (!debugEl || debugEl.hidden) return;
  const target = game.debugTarget ? game.debugTarget() : "";
  debugEl.textContent = `${type}\nx ${Math.round(point.x)}  y ${Math.round(point.y)}\ntoy ${game.tool || "none"}\ntarget ${target}`;
}

function onPlayDown(event, source) {
  if (!game.running || isControl(event.target)) return;
  if (source === "pointer" && event.button > 0) return;
  if (event.cancelable) event.preventDefault();
  if (!claimInput(source)) return;
  if (source === "pointer" && event.pointerId != null) {
    try {
      roomCanvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // Safari drops capture when a touch is already being tracked as a gesture.
    }
  }
  const point = pointFrom(event);
  paintDebug(event.type, point);
  game.pointerDown(point.x, point.y, event.pointerId || 1);
  hud.classList.toggle("is-playing", game.pointer.down);
}

function onPlayMove(event, source) {
  if (!game.pointer.down) return;
  if (event.cancelable) event.preventDefault();
  if (!claimInput(source)) return;
  const point = pointFrom(event);
  paintDebug(event.type, point);
  game.pointerMove(point.x, point.y);
}

function onPlayUp(event, source) {
  if (!game.pointer.down) return;
  if (event.type === "pointercancel" && inputGate.source === "touch") return;
  if (event.cancelable) event.preventDefault();
  if (!claimInput(source)) return;
  const point = pointFrom(event);
  paintDebug(event.type, point);
  game.pointerMove(point.x, point.y);
  game.pointerUp();
  hud.classList.remove("is-playing");
}

function showPlayToast() {
  if (!toast) return;
  toast.hidden = false;
  toast.classList.add("show");
  window.clearTimeout(showPlayToast.timer);
  showPlayToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2000);
}

function bindSecret(node) {
  if (!node) return;
  let timer = 0;
  let held = false;
  let presses = [];
  const start = (event) => {
    if (held) return;
    held = true;
    if (event.cancelable) event.preventDefault();
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const now = performance.now();
      presses = presses.filter((stamp) => now - stamp < 4000);
      presses.push(now);
      if (presses.length >= 3) {
        presses = [];
        debugEl.hidden = !debugEl.hidden;
        if (!debugEl.hidden) paintDebug("debug", { x: 0, y: 0 });
      }
    }, 480);
  };
  const stop = () => {
    held = false;
    window.clearTimeout(timer);
  };
  node.addEventListener("pointerdown", start);
  node.addEventListener("pointerup", stop);
  node.addEventListener("pointercancel", stop);
  node.addEventListener("pointerleave", stop);
  node.addEventListener("touchstart", start, { passive: false });
  node.addEventListener("touchend", stop);
  node.addEventListener("touchcancel", stop);
}

function currentDraft() {
  return {
    name: cleanName(nameInput.value),
    gender: draft.gender,
    hair: draft.hair,
    coat: draft.coat,
    eyes: draft.eyes,
  };
}

function syncSeg(selector, value) {
  for (const button of document.querySelectorAll(`${selector} button, ${selector} .swatch`)) {
    button.setAttribute("aria-pressed", button.dataset.value === value ? "true" : "false");
  }
}

function showPicker(isEdit) {
  editing = isEdit;
  game.running = false;
  const source = isEdit && saved ? saved : saved || draft;
  draft.gender = source.gender;
  draft.hair = source.hair;
  draft.coat = source.coat;
  draft.eyes = source.eyes;
  draft.name = source.name;
  nameInput.value = isEdit ? source.name : "";
  if (!isEdit) nameInput.placeholder = "Miso";
  coatName.textContent = COATS[draft.coat].name;
  syncSeg("#gender", draft.gender);
  syncSeg("#hair", draft.hair);
  syncSeg("#coats", draft.coat);
  syncSeg("#eyes", draft.eyes);
  title.textContent = isEdit ? "A new look?" : "Who lives here?";
  startBtn.textContent = isEdit ? "Save this look" : "Come sit by the window";
  cancelBtn.hidden = !isEdit;
  picker.hidden = false;
  hud.hidden = true;
  document.documentElement.classList.remove("has-cat");
}

function openRoom(config, intro) {
  picker.hidden = true;
  hud.hidden = false;
  document.documentElement.classList.add("has-cat");
  label.textContent = config.name;
  document.title = `${config.name} · Sunbeam`;
  audio.setMuted(Boolean(config.mute));
  muteBtn.classList.toggle("is-muted", Boolean(config.mute));
  muteBtn.setAttribute("aria-pressed", config.mute ? "true" : "false");
  requestAnimationFrame(() => {
    if (intro || !game.cat) game.setConfig(config, true);
    else game.updateAppearance(config);
    game.resize(measureUi());
    game.running = true;
    game.syncHint();
    last = performance.now();
  });
}

function measureUi() {
  return {
    top: topbar.getBoundingClientRect().height,
    bottom: dock.getBoundingClientRect().height + 10,
  };
}

function setMeter(node, value) {
  node.firstElementChild.style.width = `${value}%`;
  node.setAttribute("aria-valuenow", String(value));
}

function persist() {
  if (!saved) return;
  if (game.cat) saved.mood = { ...game.moods };
  saved.mute = audio.muted;
  saveCat(saved);
}

window.sunbeam = {
  game,
  draft,
  auditTailPose,
  renderTailSheet,
  get saved() {
    return saved;
  },
};
