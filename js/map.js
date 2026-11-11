// One scrolling illustrated overworld. Static art is baked; the cat, weather, and nodes animate.

import { WORLDS } from "./campaign.js";
import { paintCat } from "./kitten.js";

export const MAP_W = 4700;
export const MAP_H = 700;

const SPOTS = {
  living: [240, 400], porch: [460, 445], bowl: [460, 560], yard: [680, 445],
  treats: [680, 300], nap: [900, 445], shop: [900, 290], neighbor: [1100, 400],
  sidewalk: [1420, 460], alley: [1640, 430], fish2: [1640, 575], rooftops: [1880, 330],
  treats2: [1880, 530], treetop: [2100, 360], shop2: [2100, 230], dogpark: [2320, 460],
  waiting: [2680, 440], exam: [2900, 400], treats3: [2900, 575], vents: [3100, 340],
  shop3: [3100, 545], closet: [3280, 440], frontdesk: [3480, 460],
  rainy: [3820, 470], drains: [4020, 530], fish4: [4020, 330], chase: [4220, 350],
  shop4: [4220, 540], fencerun: [4400, 450], homecoming: [4580, 380],
};

const MAIN = ["living", "porch", "yard", "nap", "neighbor", "sidewalk", "alley", "rooftops", "treetop", "dogpark", "waiting", "exam", "vents", "closet", "frontdesk", "rainy", "drains", "chase", "fencerun", "homecoming"];
const GATES = { neighbor: 1, dogpark: 2, frontdesk: 3 };

let walk = null;
let cooldown = 0;
let wander = 0;
let camX = 0;
let camY = 80;
let baked = null;
let selected = null;
let lastCat = null;
let lastView = { w: 1, h: 1 };

export function cleared(progress, id) {
  if (!id) return true;
  if (progress.cleared && progress.cleared[id]) return true;
  return !!(progress.stars && progress.stars[id]);
}

export function worldOpen(progress, index) {
  const world = WORLDS[index];
  if (!world) return false;
  if (!world.need) return true;
  return cleared(progress, world.need);
}

function worldIndexOf(id) {
  return WORLDS.findIndex((world) => world.nodes[id]);
}

function findNode(id) {
  for (const world of WORLDS) {
    if (world.nodes[id]) return { ...world.nodes[id], id, world: WORLDS.indexOf(world) };
  }
  return null;
}

export function ensureMap(progress) {
  progress.map = progress.map || { world: 0, node: "living" };
  if (!findNode(progress.map.node)) progress.map.node = "living";
  progress.map.world = Math.max(0, worldIndexOf(progress.map.node));
  return progress.map;
}

function sideOf(id) {
  for (const world of WORLDS) {
    for (const [key, node] of Object.entries(world.nodes)) {
      if (node.from === id) return key;
    }
  }
  return null;
}

function gateOpen(progress, from, to) {
  const gate = GATES[from];
  if (gate && to === MAIN[MAIN.indexOf(from) + 1]) return worldOpen(progress, gate);
  const back = GATES[to];
  if (back && from === MAIN[MAIN.indexOf(to) + 1]) return worldOpen(progress, back);
  return true;
}

function neighbors(progress, id) {
  const index = MAIN.indexOf(id);
  let prev = index > 0 ? MAIN[index - 1] : null;
  let next = index >= 0 && index < MAIN.length - 1 ? MAIN[index + 1] : null;
  if (prev && !gateOpen(progress, prev, id)) prev = null;
  if (next && !gateOpen(progress, id, next)) next = null;
  if (index < 0) {
    const node = findNode(id);
    prev = node && node.from;
    next = null;
  }
  return { prev, next, side: sideOf(id) };
}

function canStand(progress, id) {
  const node = findNode(id);
  if (!node) return false;
  if (!worldOpen(progress, node.world)) return false;
  if (node.from) return cleared(progress, node.from);
  const index = MAIN.indexOf(id);
  if (index <= 0) return true;
  return cleared(progress, MAIN[index - 1]);
}

function spot(id) {
  return SPOTS[id] || [200, 440];
}

export function stepMap(progress, input, dt) {
  const map = ensureMap(progress);
  cooldown = Math.max(0, cooldown - dt);
  wander += dt * 0.12;
  if (walk) {
    walk.t += dt / 0.45;
    if (walk.t >= 1) {
      map.node = walk.to;
      map.world = Math.max(0, worldIndexOf(map.node));
      walk = null;
      selected = map.node;
    }
    return null;
  }
  const here = neighbors(progress, map.node);
  const hop = (id) => {
    if (!id || !canStand(progress, id) || cooldown > 0) return;
    walk = { from: map.node, to: id, t: 0 };
    cooldown = 0.16;
    selected = id;
  };
  if (input.left) hop(here.prev);
  else if (input.right) hop(here.next);
  else if (input.up) hop(here.side);
  if (input.jumpPressed) return enterCurrent(progress);
  return null;
}

export function chooseNode(progress, id) {
  if (!id || !findNode(id)) return null;
  selected = id;
  const map = ensureMap(progress);
  if (!canStand(progress, id)) return { type: "locked", id };
  if (id === map.node || (walk && walk.to === id)) return null;
  const here = neighbors(progress, map.node);
  if (id === here.next || id === here.prev || id === here.side) {
    walk = { from: map.node, to: id, t: 0 };
    cooldown = 0.16;
  }
  return null;
}

export function enterCurrent(progress) {
  const map = ensureMap(progress);
  const node = findNode(map.node);
  if (!node || !canStand(progress, map.node)) return { type: "locked" };
  const routeIndex = Math.floor(wander) % MAIN.length;
  const foeHere = MAIN[routeIndex] === map.node && node.kind === "level" && wander > 1.2;
  if (foeHere && progress.skirmish !== map.node) {
    progress.skirmish = map.node;
    return { type: "level", id: "skirmish", node: map.node };
  }
  if (node.kind === "level" || node.kind === "boss" || node.kind === "fish") return { type: "level", id: node.level, node: map.node };
  if (node.kind === "shop") return { type: "shop" };
  if (node.kind === "bonus") return { type: "bonus", id: map.node };
  if (node.kind === "check") return { type: "check", id: map.node };
  return { type: "locked" };
}

export function selectedNode() {
  return selected;
}

function catPoint(progress) {
  const map = ensureMap(progress);
  const from = spot(walk ? walk.from : map.node);
  const to = spot(walk ? walk.to : map.node);
  const t = walk ? Math.min(1, walk.t) : 0;
  const ease = t * t * (3 - 2 * t);
  return [from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease];
}

function frameCamera(x, y, viewW, viewH, moving) {
  const focusX = viewW * 0.52;
  const focusY = viewH * 0.42;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const nextX = clamp(x - focusX, -viewW * 0.25, MAP_W - viewW * 0.5);
  const nextY = clamp(y - focusY, -80, Math.max(-80, MAP_H - viewH * 0.62));
  if (moving) {
    camX += (nextX - camX) * 0.18;
    camY += (nextY - camY) * 0.18;
  } else {
    camX = nextX;
    camY = nextY;
  }
}

export function pickMap(px, py) {
  let best = null;
  let bestD = 36;
  for (const id of Object.keys(SPOTS)) {
    const [x, y] = spot(id);
    const sx = x - camX;
    const sy = y - camY;
    const dist = Math.hypot(px - sx, py - sy);
    if (dist < bestD) {
      best = id;
      bestD = dist;
    }
  }
  return best;
}

export function mapHudReport() {
  return { cat: lastCat, view: lastView };
}

function round(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function tree(g, x, y, r, leaf, trunk) {
  g.fillStyle = trunk;
  g.fillRect(x - 6, y - r, 12, r + 8);
  g.fillStyle = leaf;
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 1.1, r * 0.7, 0, Math.PI * 2);
  g.arc(x + r * 0.35, y - r * 1.2, r * 0.75, 0, Math.PI * 2);
  g.arc(x, y - r * 0.7, r * 0.6, 0, Math.PI * 2);
  g.fill();
}

function house(g, x, y, w, h, wall, roof, door) {
  g.fillStyle = wall;
  round(g, x, y - h, w, h, 6);
  g.fill();
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(x - 10, y - h + 8);
  g.lineTo(x + w / 2, y - h - 28);
  g.lineTo(x + w + 10, y - h + 8);
  g.fill();
  g.fillStyle = "#bfe4f5";
  g.fillRect(x + 12, y - h + 22, 22, 18);
  g.fillRect(x + w - 36, y - h + 22, 22, 18);
  g.fillStyle = door;
  round(g, x + w / 2 - 10, y - 36, 20, 36, 4);
  g.fill();
}

function tileFloor(g, x, y, w, h, a, b) {
  for (let row = 0; row < h; row += 16) {
    for (let col = 0; col < w; col += 16) {
      g.fillStyle = ((row + col) / 16) % 2 ? a : b;
      g.fillRect(x + col, y + row, 16, 16);
    }
  }
}

function paintClinic(g) {
  g.fillStyle = "#8d97a3";
  g.fillRect(2340, 500, 240, 48);
  g.fillStyle = "#f4f6f4";
  for (let x = 2356; x < 2560; x += 32) g.fillRect(x, 516, 16, 10);
  g.fillStyle = "#5c6772";
  round(g, 2468, 448, 168, 86, 10);
  g.fill();
  g.fillStyle = "#d5e7f2";
  round(g, 2484, 462, 70, 32, 6);
  g.fill();
  g.fillStyle = "#2c343c";
  g.beginPath();
  g.arc(2504, 524, 9, 0, Math.PI * 2);
  g.arc(2540, 524, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f2c14b";
  g.fillRect(2408, 360, 10, 150);
  g.beginPath();
  g.arc(2413, 348, 18, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#c9d4da";
  round(g, 2568, 470, 54, 28, 6);
  g.fill();
  g.fillStyle = "#3f8f62";
  g.fillRect(2388, 488, 28, 18);
  g.beginPath();
  g.ellipse(2396, 484, 12, 8, 0, 0, Math.PI * 2);
  g.ellipse(2412, 490, 9, 6, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = "#f7fbfc";
  round(g, 2520, 230, 1160, 400, 14);
  g.fill();
  g.fillStyle = "#e7eef2";
  g.fillRect(2520, 300, 1140, 18);
  tileFloor(g, 2580, 360, 1040, 180, "#e5f3ee", "#f8fbfb");
  g.fillStyle = "#d5e1e7";
  g.fillRect(2520, 230, 1160, 22);
  g.fillStyle = "#1f6f78";
  round(g, 2588, 246, 250, 48, 8);
  g.fill();
  g.fillStyle = "#fff";
  g.font = "800 22px 'Avenir Next', 'Segoe UI', sans-serif";
  g.textAlign = "left";
  g.fillText("Paw +", 2688, 278);
  g.fillStyle = "#e23b4a";
  g.fillRect(2644, 256, 10, 26);
  g.fillRect(2634, 266, 30, 8);
  g.fillStyle = "#f28b76";
  g.beginPath();
  g.ellipse(2620, 268, 10, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#e07a8c";
  g.fillRect(2540, 300, 180, 16);
  g.fillStyle = "#f7c6d0";
  for (let i = 0; i < 5; i++) g.fillRect(2544 + i * 36, 300, 16, 16);
  g.fillStyle = "rgba(186, 224, 236, 0.9)";
  round(g, 2548, 324, 52, 86, 4);
  g.fill();
  round(g, 2608, 324, 52, 86, 4);
  g.fill();
  g.fillStyle = "#b7c3ca";
  g.beginPath();
  g.moveTo(2530, 418);
  g.lineTo(2700, 448);
  g.lineTo(2700, 462);
  g.lineTo(2530, 436);
  g.fill();
  g.fillStyle = "#8d6a45";
  round(g, 2600, 452, 48, 12, 4);
  g.fill();
  g.fillStyle = "#5c4638";
  g.font = "700 16px 'Avenir Next', 'Segoe UI', sans-serif";
  g.fillText("Escape from the Vet", 2868, 348);

  g.fillStyle = "#8fb8d6";
  round(g, 2724, 390, 36, 48, 8);
  g.fill();
  round(g, 2772, 404, 36, 48, 8);
  g.fill();
  g.fillStyle = "#d7c4a4";
  round(g, 2736, 448, 70, 18, 4);
  g.fill();
  g.fillStyle = "#1f6f9a";
  round(g, 2816, 378, 78, 52, 6);
  g.fill();
  g.fillStyle = "rgba(214, 236, 246, 0.85)";
  g.fillRect(2824, 386, 62, 36);
  g.fillStyle = "#6aa7c9";
  round(g, 2744, 250, 48, 32, 4);
  g.fill();
  g.fillStyle = "#3f6f8a";
  round(g, 2688, 248, 42, 28, 4);
  g.fill();
  g.fillStyle = "#3f8f62";
  g.fillRect(2796, 330, 10, 36);
  g.beginPath();
  g.arc(2801, 324, 14, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#e7d3b0";
  round(g, 2668, 430, 36, 28, 4);
  g.fill();
  g.fillStyle = "#c9843a";
  g.beginPath();
  g.ellipse(2708, 470, 16, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5c4638";
  g.fillRect(2688, 446, 10, 28);
  g.beginPath();
  g.arc(2693, 442, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#d7dde2";
  round(g, 2764, 468, 42, 28, 6);
  g.fill();
  g.fillStyle = "#f28b76";
  g.beginPath();
  g.arc(2784, 478, 6, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = "#9aafb8";
  g.lineWidth = 4;
  g.strokeRect(2860, 300, 240, 210);
  g.fillStyle = "#d5dde3";
  round(g, 2920, 392, 110, 22, 6);
  g.fill();
  g.fillRect(2936, 414, 10, 40);
  g.fillRect(3004, 414, 10, 40);
  g.fillStyle = "#c9d4da";
  round(g, 2876, 330, 48, 64, 4);
  g.fill();
  g.fillStyle = "#fff6c8";
  g.beginPath();
  g.arc(3070, 330, 18, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#5c4638";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(3048, 390, 12, 0.3, Math.PI);
  g.stroke();
  g.fillStyle = "#f7f1ea";
  g.fillRect(2876, 410, 40, 48);
  g.strokeStyle = "#c9b8a4";
  g.strokeRect(2884, 420, 24, 18);
  g.fillStyle = "#e7eef2";
  g.strokeRect(2872, 470, 36, 28);

  g.fillStyle = "#f2c14b";
  g.beginPath();
  g.ellipse(2900, 575, 22, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff6ee";
  g.beginPath();
  g.ellipse(2900, 572, 12, 6, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = "#b7c4cc";
  round(g, 3060, 300, 300, 46, 10);
  g.fill();
  g.fillStyle = "#8d9aa3";
  for (let x = 3080; x < 3340; x += 36) {
    g.fillRect(x, 308, 22, 28);
    g.fillRect(x + 6, 316, 10, 4);
  }
  g.strokeStyle = "#8aa0ab";
  g.lineWidth = 3;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      g.strokeRect(3076 + col * 48, 360 + row * 42, 40, 34);
      g.fillStyle = "#f7f1ea";
      g.fillRect(3082 + col * 48, 366 + row * 42, 28, 22);
    }
  }
  g.fillStyle = "#e7d3b0";
  g.beginPath();
  g.ellipse(3096, 376, 8, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f28b76";
  g.beginPath();
  g.ellipse(3144, 418, 7, 5, 0, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = "#9aafb8";
  g.lineWidth = 4;
  g.strokeRect(3220, 360, 200, 170);
  for (let shelf = 0; shelf < 3; shelf++) {
    g.fillStyle = "#f7fbfc";
    g.fillRect(3236, 384 + shelf * 40, 168, 12);
  }
  g.fillStyle = "#7ec8c3";
  round(g, 3252, 360, 16, 28, 3);
  g.fill();
  g.fillStyle = "#e07a8c";
  round(g, 3280, 356, 18, 32, 3);
  g.fill();
  g.fillStyle = "#f2c14b";
  g.fillRect(3316, 396, 28, 20);
  g.fillStyle = "#dfe7ea";
  g.fillRect(3356, 430, 40, 24);
  g.fillStyle = "#f4e4c4";
  g.fillRect(3248, 470, 36, 22);

  g.fillStyle = "#eef4f6";
  g.fillRect(3288, 236, 120, 58);
  g.strokeStyle = "#9aa7b2";
  g.strokeRect(3288, 236, 120, 58);
  g.strokeStyle = "#d5dde3";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(3310, 274);
  g.lineTo(3340, 248);
  g.lineTo(3376, 276);
  g.stroke();
  g.fillStyle = "#f7f1ea";
  g.beginPath();
  g.arc(3348, 258, 10, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#d7e4ea";
  g.fillRect(3168, 248, 40, 12);
  g.fillRect(3220, 236, 12, 28);
  g.fillStyle = "#7ec8c3";
  round(g, 3236, 252, 16, 22, 3);
  g.fill();

  g.strokeStyle = "#9aafb8";
  g.lineWidth = 4;
  g.strokeRect(3440, 340, 230, 200);
  g.fillStyle = "#d5e0e6";
  round(g, 3464, 390, 100, 20, 6);
  g.fill();
  g.fillStyle = "#2c343c";
  round(g, 3476, 372, 40, 20, 3);
  g.fill();
  g.fillStyle = "#e23b4a";
  g.fillRect(3488, 378, 16, 4);
  g.fillStyle = "rgba(186, 224, 236, 0.95)";
  round(g, 3568, 380, 78, 120, 8);
  g.fill();
  g.strokeStyle = "#5c6b78";
  g.strokeRect(3568, 380, 78, 120);
  g.fillStyle = "#f2c14b";
  g.font = "800 15px 'Avenir Next', 'Segoe UI', sans-serif";
  g.fillText("Quiet Please", 3460, 450);
  g.fillStyle = "#e7c44a";
  g.beginPath();
  g.moveTo(3510, 500);
  g.lineTo(3526, 528);
  g.lineTo(3494, 528);
  g.fill();
  g.fillStyle = "#8fb8d6";
  round(g, 3604, 500, 28, 22, 4);
  g.fill();
  g.fillStyle = "#c9843a";
  g.fillRect(3488, 508, 16, 24);
}

function ensureBake() {
  if (baked) return baked;
  const mid = document.createElement("canvas");
  mid.width = MAP_W;
  mid.height = MAP_H;
  const g = mid.getContext("2d");
  const sky = g.createLinearGradient(0, 0, MAP_W, 0);
  sky.addColorStop(0, "#f6d7a8");
  sky.addColorStop(0.22, "#c6ecff");
  sky.addColorStop(0.48, "#d5e7c4");
  sky.addColorStop(0.68, "#e7eef3");
  sky.addColorStop(0.82, "#6a4a68");
  sky.addColorStop(1, "#241c38");
  g.fillStyle = sky;
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.beginPath();
  g.ellipse(180, 90, 70, 22, 0, 0, Math.PI * 2);
  g.ellipse(520, 70, 90, 24, 0, 0, Math.PI * 2);
  g.ellipse(1500, 80, 80, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#e7c49a";
  g.fillRect(0, 500, 1180, 200);
  g.fillStyle = "#b7dd8a";
  g.fillRect(1180, 500, 1240, 200);
  g.fillStyle = "#d5dde6";
  g.fillRect(2420, 500, 1100, 200);
  g.fillStyle = "#2c3344";
  g.fillRect(3520, 500, 1180, 200);
  g.fillStyle = "#c9843a";
  round(g, 1180, 470, 80, 16, 8);
  g.fill();
  g.fillStyle = "#8d6a45";
  g.fillRect(2360, 430, 70, 14);
  g.fillRect(2375, 390, 8, 50);
  g.fillRect(2405, 390, 8, 50);
  g.fillStyle = "#9aa7b4";
  g.fillRect(3520, 520, 90, 10);

  // World 1 cutaway house
  g.fillStyle = "#fff6ee";
  round(g, 80, 210, 340, 250, 16);
  g.fill();
  g.fillStyle = "#bfe4f5";
  round(g, 100, 230, 90, 70, 8);
  g.fill();
  g.fillStyle = "#f2c14b";
  g.fillRect(108, 248, 8, 40);
  g.fillStyle = "#d23d55";
  round(g, 210, 360, 120, 50, 12);
  g.fill();
  g.fillStyle = "#e4578b";
  g.beginPath();
  g.ellipse(270, 430, 70, 18, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#c4925a";
  g.fillRect(360, 300, 16, 140);
  g.fillStyle = "#7d5cff";
  g.beginPath();
  g.ellipse(368, 290, 28, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5c4638";
  g.font = "700 18px 'Avenir Next', 'Segoe UI', sans-serif";
  g.fillText("Home Sweet Home", 100, 200);

  house(g, 430, 500, 110, 90, "#f4efe4", "#c45a4a", "#8d5a32");
  g.fillStyle = "#6eae84";
  g.beginPath();
  g.ellipse(560, 470, 16, 10, 0, 0, Math.PI * 2);
  g.ellipse(590, 478, 12, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#f7f1ea";
  g.lineWidth = 4;
  for (let x = 640; x < 860; x += 18) {
    g.beginPath();
    g.moveTo(x, 470);
    g.lineTo(x, 430);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(640, 430);
  g.lineTo(860, 430);
  g.stroke();
  g.fillStyle = "#e07a8c";
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc(660 + i * 28, 490, 5, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#c9843a";
  g.fillRect(820, 430, 10, 50);
  g.fillStyle = "#3a6ea5";
  g.fillRect(800, 418, 36, 22);
  house(g, 980, 500, 150, 120, "#f7e2c4", "#a85a48", "#6b4a32");
  g.fillStyle = "#e7eef2";
  g.beginPath();
  g.ellipse(1120, 455, 14, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(90,90,90,0.35)";
  g.beginPath();
  g.arc(1040, 340, 8, 0, Math.PI * 2);
  g.fill();

  // Neighborhood
  g.fillStyle = "#d7d2cc";
  g.fillRect(1240, 500, 1000, 28);
  g.fillStyle = "#f4f1ea";
  for (let x = 1260; x < 2200; x += 36) g.fillRect(x, 512, 16, 6);
  [[1280, "#f2c14b", "#c45a4a"], [1460, "#9fd0e8", "#5c4638"], [1640, "#f0a3b8", "#6e4a5a"], [1820, "#c9e6a8", "#3f6b4a"]].forEach(([x, wall, roof]) => {
    house(g, x, 500, 130, 110, wall, roof, "#6b4a32");
    g.fillStyle = "rgba(255, 214, 120, 0.85)";
    g.fillRect(x + 16, 500 - 110 + 26, 16, 12);
  });
  g.fillStyle = "#6f8f72";
  g.fillRect(1560, 460, 22, 36);
  g.fillRect(1590, 468, 18, 28);
  g.fillStyle = "#dfe8df";
  g.fillRect(1556, 454, 30, 8);
  tree(g, 1760, 500, 46, "#3f9a55", "#8d5a32");
  tree(g, 1980, 500, 54, "#2f7a44", "#6b4428");
  tree(g, 2140, 490, 60, "#245c34", "#5a3a22");
  g.fillStyle = "#7ec8e8";
  g.beginPath();
  g.ellipse(2060, 530, 70, 18, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#c4925a";
  g.fillRect(2000, 512, 120, 8);
  g.fillStyle = "#e7a0b0";
  g.beginPath();
  g.arc(2168, 500, 7, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#f4efe4";
  g.lineWidth = 3;
  g.strokeRect(2240, 430, 150, 70);
  g.fillStyle = "#5c4638";
  g.font = "700 16px 'Avenir Next', 'Segoe UI', sans-serif";
  g.fillText("The Neighborhood", 1300, 250);
  g.fillText("Woods", 2060, 250);

  paintClinic(g);

  // Night home
  g.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 8; i++) g.fillRect(3600 + i * 120, 80 + (i % 3) * 20, 2, 2);
  house(g, 3680, 500, 120, 100, "#3d4a58", "#241c38", "#1a1e28");
  g.fillStyle = "#f2c14b";
  g.fillRect(3600, 360, 8, 140);
  g.beginPath();
  g.arc(3604, 350, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#4a5568";
  g.fillRect(4000, 490, 80, 16);
  g.fillStyle = "#8d5a32";
  for (let x = 4180; x < 4460; x += 16) g.fillRect(x, 430, 4, 50);
  g.fillStyle = "#fff1c9";
  round(g, 4500, 340, 70, 50, 8);
  g.fill();
  g.fillStyle = "#f7c6d8";
  g.beginPath();
  g.arc(4568, 390, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f6efe6";
  g.fillText("Back into the House", 3660, 230);

  // Cobbled path
  g.strokeStyle = "rgba(90, 60, 40, 0.45)";
  g.lineWidth = 10;
  g.lineCap = "round";
  g.setLineDash([2, 14]);
  g.beginPath();
  MAIN.forEach((id, index) => {
    const [x, y] = spot(id);
    if (index === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.stroke();
  g.setLineDash([]);
  for (const world of WORLDS) {
    for (const [id, node] of Object.entries(world.nodes)) {
      if (!node.from) continue;
      const [x, y] = spot(id);
      const [px, py] = spot(node.from);
      g.strokeStyle = "rgba(90, 60, 40, 0.35)";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(x, y);
      g.stroke();
    }
  }
  baked = mid;
  return baked;
}

function paintClinicLife(ctx, time) {
  const tankX = 2824;
  const tankW = 58;
  for (let i = 0; i < 3; i++) {
    const x = tankX + ((time * 22 + i * 18) % tankW);
    ctx.fillStyle = i === 2 ? "#f2c14b" : "#1f6f9a";
    ctx.beginPath();
    ctx.ellipse(x, 396 + i * 8, 5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (Math.sin(time * 7) > 0.55) {
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(2860, 304, 160, 8);
    ctx.fillRect(3300, 242, 90, 6);
  }
  const nurseX = 2690 + (time * 26) % 130;
  ctx.fillStyle = "rgba(70, 110, 130, 0.5)";
  ctx.fillRect(nurseX, 258, 18, 32);
  ctx.beginPath();
  ctx.arc(nurseX + 9, 250, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(2766, 268);
  ctx.strokeStyle = "#5c4638";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -5);
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.sin(time) * 5, Math.cos(time) * 4);
  ctx.stroke();
  ctx.restore();
  const pulse = (Math.sin(time * 6) + 1) / 2;
  ctx.strokeStyle = `rgba(226, 59, 74, ${0.35 + pulse * 0.6})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 48; i++) {
    const x = 3464 + i * 1.4;
    const y = 386 + (i % 8 === 4 ? -8 : i % 8 === 5 ? 4 : 0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(200, 210, 216, 0.55)";
  ctx.beginPath();
  ctx.arc(3370, 250 - (time * 14) % 28, 4, 0, Math.PI * 2);
  ctx.arc(3382, 242 - (time * 12) % 24, 3, 0, Math.PI * 2);
  ctx.fill();
  if (Math.sin(time * 4) > 0) {
    ctx.fillStyle = "#7ee0a8";
    ctx.fillRect(3472, 382, 6, 4);
  }
  ctx.strokeStyle = "rgba(255, 244, 160, 0.55)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(2740, 270, 22 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawNode(g, progress, id, time) {
  const node = findNode(id);
  if (!node) return;
  const [x, y] = spot(id);
  const open = canStand(progress, id);
  const done = cleared(progress, node.level || id);
  const here = ensureMap(progress).node === id;
  const boss = node.kind === "boss";
  g.save();
  g.translate(x, y);
  if (!worldOpen(progress, node.world)) g.globalAlpha = 0.45;
  if (here) {
    g.strokeStyle = `rgba(242, 193, 75, ${0.45 + Math.sin(time * 5) * 0.35})`;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 30 + Math.sin(time * 5) * 3, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = open ? "#fffaf4" : "rgba(255,248,242,0.4)";
  g.beginPath();
  g.arc(0, 0, boss ? 24 : 18, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = boss ? "#c45a3a" : "#5c4638";
  g.stroke();
  if (node.kind === "fish") {
    g.fillStyle = "#3aa0d8";
    g.beginPath();
    g.ellipse(0, 1, 8, 5, 0, 0, Math.PI * 2);
    g.fill();
  } else if (node.kind === "shop") {
    g.fillStyle = "#e07a8c";
    g.fillRect(-10, -8, 20, 6);
    g.fillStyle = "#f7f1ea";
    g.fillRect(-8, -2, 16, 8);
  } else if (node.kind === "bonus") {
    g.fillStyle = "#f2c14b";
    g.beginPath();
    g.ellipse(0, 2, 8, 5, 0, 0, Math.PI * 2);
    g.fill();
  } else if (node.kind === "check") {
    g.fillStyle = "#f7c6d8";
    g.beginPath();
    g.ellipse(0, 2, 9, 5, 0, 0, Math.PI * 2);
    g.fill();
  } else if (boss) {
    g.fillStyle = id === "dogpark" ? "#d7a15a" : id === "frontdesk" ? "#7ec8c3" : id === "homecoming" ? "#e23b3b" : "#c9843a";
    g.beginPath();
    g.arc(0, 0, 8, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = "#5c4638";
    g.font = "800 12px 'Avenir Next', 'Segoe UI', sans-serif";
    g.textAlign = "center";
    g.fillText(done ? "" : node.label, 0, 4);
  }
  if (done) {
    g.fillStyle = "#e07a3d";
    g.beginPath();
    g.ellipse(-2, 2, 5, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(-6, 0, 2, 0, Math.PI * 2);
    g.arc(2, -1, 2, 0, Math.PI * 2);
    g.fill();
  }
  const stars = node.level && progress.stars ? progress.stars[node.level] || 0 : 0;
  if (stars) {
    g.fillStyle = "#f2c14b";
    g.font = "700 10px 'Avenir Next', 'Segoe UI', sans-serif";
    g.textAlign = "center";
    g.fillText("★".repeat(stars), 0, 30);
  }
  g.restore();
}

export function drawMap(ctx, width, height, dpr, progress, cat, time) {
  ensureMap(progress);
  lastView = { w: width, h: height };
  const [cx, cy] = catPoint(progress);
  frameCamera(cx, cy, width, height, Boolean(walk));
  const art = ensureBake();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));
  ctx.drawImage(art, 0, 0);
  paintClinicLife(ctx, time);
  const sway = Math.sin(time * 1.4) * 3;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(300 + (time * 18) % 900, 80 + sway, 64, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(1600 + (time * 14) % 700, 64, 80, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(80,80,80,0.25)";
  ctx.beginPath();
  ctx.arc(1048, 330 + Math.sin(time * 2) * -10, 7, 0, Math.PI * 2);
  ctx.arc(1040, 318 + Math.sin(time * 2) * -16, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2c14b";
  ctx.beginPath();
  ctx.arc(3604, 348 + Math.sin(time * 3) * 2, 10, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const bx = 1900 + Math.sin(time * 1.3 + i) * 40 + i * 18;
    const by = 300 + Math.cos(time * 1.7 + i) * 16;
    ctx.fillStyle = i % 2 ? "#f2c14b" : "#e07a8c";
    ctx.beginPath();
    ctx.ellipse(bx, by, 3, 2, time + i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f7f1ea";
  ctx.beginPath();
  ctx.ellipse(2030 + Math.sin(time) * 10, 528, 8, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(2075 + Math.cos(time * 0.8) * 8, 534, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (Math.sin(time * 0.7) > 0.92) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(4000, 40);
    ctx.lineTo(3920, 180);
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const rx = 3600 + ((i * 97 + time * 80) % 1000);
    const ry = 80 + ((i * 53) % 420);
    ctx.fillStyle = "rgba(190, 210, 230, 0.45)";
    ctx.fillRect(rx, ry, 1.5, 8);
  }
  for (const world of WORLDS) {
    if (worldOpen(progress, WORLDS.indexOf(world))) continue;
    const ids = Object.keys(world.nodes);
    const xs = ids.map((id) => spot(id)[0]);
    const min = Math.min(...xs) - 80;
    const max = Math.max(...xs) + 80;
    ctx.fillStyle = "rgba(40, 36, 48, 0.38)";
    ctx.fillRect(min, 160, max - min, 420);
    ctx.fillStyle = "#fff8f2";
    ctx.font = "700 16px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Locked", (min + max) / 2, 250);
  }
  for (const id of Object.keys(SPOTS)) drawNode(ctx, progress, id, time);
  const routeIndex = Math.floor(wander * 2) % MAIN.length;
  const mouseA = spot(MAIN[routeIndex]);
  const mouseB = spot(MAIN[(routeIndex + 1) % MAIN.length]);
  const mt = (wander * 2) % 1;
  const mx = mouseA[0] + (mouseB[0] - mouseA[0]) * mt;
  const my = mouseA[1] + (mouseB[1] - mouseA[1]) * mt;
  ctx.save();
  ctx.translate(mx, my - 8);
  ctx.fillStyle = "rgba(60,40,20,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c4a484";
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4c7cf";
  ctx.beginPath();
  ctx.arc(-4, -6, 4, 0, Math.PI * 2);
  ctx.arc(4, -6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a88870";
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.quadraticCurveTo(-16, 8 + Math.sin(time * 8) * 3, -6, 8);
  ctx.stroke();
  ctx.restore();

  const bob = Math.sin(time * (walk ? 10 : 3)) * (walk ? 4 : 2);
  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.fillStyle = "rgba(60, 40, 20, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (cat) {
    cat.x = 0;
    cat.groundY = 0;
    cat.scale = 2.05;
    cat.facing = !walk || spot(walk.to)[0] >= spot(walk.from)[0] ? 1 : -1;
    cat.tailAmp = 14;
    cat.tailSpeed = walk ? 7 : 2.4;
    cat.hop = walk ? Math.abs(Math.sin(time * 10)) : 0;
    paintCat(ctx, cat, time);
  }
  ctx.restore();
  const screenX = cx - camX;
  const screenY = cy - camY + bob;
  lastCat = { x: screenX - 46, y: screenY - 108, w: 96, h: 116, cx: screenX, cy: screenY };
  ctx.restore();

  ctx.fillStyle = "rgba(255,248,242,0.9)";
  round(ctx, 12, 10, Math.min(360, width * 0.46), 54, 16);
  ctx.fill();
  const world = WORLDS[progress.map.world] || WORLDS[0];
  ctx.fillStyle = "#3a2a22";
  ctx.font = "800 16px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(world.name, 26, 32);
  ctx.font = "600 12px 'Avenir Next', 'Segoe UI', sans-serif";
  const bits = [
    progress.foundOwner ? "Owner found" : "Owner missing",
    progress.friend ? "Friend safe" : "Friend lost",
    progress.escaped ? "Out of the vet" : "Vet ahead",
    progress.home ? "Home" : "Rain ahead",
  ];
  ctx.fillText(bits.join("  ·  "), 26, 52);
  ctx.font = "700 13px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.fillText(`🐟 ${progress.fishBank || 0}`, width - 150, 32);
}
