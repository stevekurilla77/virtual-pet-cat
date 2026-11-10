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
const topbar = document.querySelector("#topbar");
const bars = {
  playful: document.querySelector("#bar-play"),
  sleepy: document.querySelector("#bar-sleep"),
  happy: document.querySelector("#bar-happy"),
};

const audio = new AudioBus();
const game = new Game(roomCanvas, audio);
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
      game.setTool(button.dataset.tool);
    });
  }

  roomCanvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  roomCanvas.addEventListener("pointermove", onPointerMove, { passive: false });
  roomCanvas.addEventListener("pointerup", onPointerUp);
  roomCanvas.addEventListener("pointercancel", onPointerUp);
  roomCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "m" && event.target.tagName !== "INPUT") muteBtn.click();
  });
}

function onPointerDown(event) {
  if (!game.running || event.button > 0) return;
  event.preventDefault();
  roomCanvas.setPointerCapture(event.pointerId);
  const point = localPoint(event);
  game.pointerDown(point.x, point.y, event.pointerId);
}

function onPointerMove(event) {
  const point = localPoint(event);
  if (game.pointer.down && event.pointerId !== game.pointer.id) return;
  game.pointerMove(point.x, point.y);
}

function onPointerUp(event) {
  if (game.pointer.down && event.pointerId != null && event.pointerId !== game.pointer.id) return;
  game.pointerUp();
}

function localPoint(event) {
  const rect = roomCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
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
    bottom: tray.getBoundingClientRect().height + 6,
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
  get saved() {
    return saved;
  },
};
