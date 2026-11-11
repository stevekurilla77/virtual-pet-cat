// Mario 3 style overworld. The cat walks the paths; Play opens the node.

import { WORLDS } from "./campaign.js";
import { paintCat } from "./kitten.js";

let walk = null;
let wander = { node: 0, t: 0 };
let cooldown = 0;

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

function pathIndex(world, id) {
  return world.path.indexOf(id);
}

export function ensureMap(progress) {
  progress.map = progress.map || { world: 0, node: "living" };
  const world = WORLDS[progress.map.world] || WORLDS[0];
  if (!world.nodes[progress.map.node]) progress.map.node = world.path[0];
  return progress.map;
}

function neighbors(world, id) {
  const along = pathIndex(world, id);
  const prev = along > 0 ? world.path[along - 1] : null;
  const next = along >= 0 && along < world.path.length - 1 ? world.path[along + 1] : null;
  const side = Object.keys(world.nodes).find((key) => world.nodes[key].from === id) || null;
  return { prev, next, side };
}

function canStand(progress, world, id) {
  if (!id || !world.nodes[id]) return false;
  const node = world.nodes[id];
  if (node.from) return cleared(progress, node.from);
  const index = pathIndex(world, id);
  if (index <= 0) return true;
  return cleared(progress, world.path[index - 1]);
}

export function stepMap(progress, input, dt) {
  const map = ensureMap(progress);
  cooldown = Math.max(0, cooldown - dt);
  if (walk) {
    walk.t += dt / 0.35;
    if (walk.t >= 1) {
      map.node = walk.to;
      walk = null;
    }
    return null;
  }
  const world = WORLDS[map.world];
  const here = neighbors(world, map.node);
  const hop = (id) => {
    if (!id || !canStand(progress, world, id) || cooldown > 0) return;
    walk = { from: map.node, to: id, t: 0 };
    cooldown = 0.18;
  };
  if (input.left) hop(here.prev);
  else if (input.right) hop(here.next);
  else if (input.up) hop(here.side);
  wander.t += dt * 0.15;
  const route = world.path;
  wander.node = Math.floor(wander.t) % route.length;
  if (input.jumpPressed) return enterCurrent(progress);
  if (input.world != null && worldOpen(progress, input.world)) {
    map.world = input.world;
    map.node = WORLDS[input.world].path[0];
    walk = null;
  }
  return null;
}

export function enterCurrent(progress) {
  const map = ensureMap(progress);
  const world = WORLDS[map.world];
  const node = world.nodes[map.node];
  if (!node || !canStand(progress, world, map.node)) return { type: "locked" };
  const foe = wander.t > 1.2 && world.path[wander.node % world.path.length] === map.node && node.kind === "level";
  if (foe && progress.skirmish !== map.node) {
    progress.skirmish = map.node;
    return { type: "level", id: "skirmish", node: map.node };
  }
  if (node.kind === "level" || node.kind === "boss" || node.kind === "fish") return { type: "level", id: node.level, node: map.node };
  if (node.kind === "shop") return { type: "shop" };
  if (node.kind === "bonus") return { type: "bonus", id: map.node };
  if (node.kind === "check") return { type: "check", id: map.node };
  return { type: "locked" };
}

export function hitWorld(x, y, w, h) {
  for (let i = 0; i < WORLDS.length; i++) {
    const cx = 230 + i * ((w - 420) / 3);
    const cy = 108;
    if (Math.hypot(x - cx, y - cy) < 28) return i;
  }
  return null;
}

function point(world, id, w, h) {
  const node = world.nodes[id];
  return [220 + node.x * (w - 380), 132 + node.y * (h - 210)];
}

export function drawMap(ctx, width, height, dpr, progress, cat, time) {
  const map = ensureMap(progress);
  const world = WORLDS[map.world];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, world.sky[0]);
  sky.addColorStop(1, world.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = world.ground;
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.72, width * 0.62, height * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = world.path;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  const link = (a, b) => {
    const [x1, y1] = point(world, a, width, height);
    const [x2, y2] = point(world, b, width, height);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  for (let i = 1; i < world.path.length; i++) link(world.path[i - 1], world.path[i]);
  for (const [id, node] of Object.entries(world.nodes)) {
    if (node.from) link(node.from, id);
  }
  for (const [id, node] of Object.entries(world.nodes)) {
    const [x, y] = point(world, id, width, height);
    const open = canStand(progress, world, id);
    const done = cleared(progress, node.level || id);
    ctx.fillStyle = open ? "#fff8f2" : "rgba(255,248,242,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, node.kind === "boss" ? 22 : 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = node.kind === "boss" ? "#c45a3a" : world.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = world.ink;
    ctx.font = "700 12px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(done ? "★" : node.label, x, y + 4);
  }
  const stand = walk ? walk.from : map.node;
  const dest = walk ? walk.to : map.node;
  const [ax, ay] = point(world, stand, width, height);
  const [bx, by] = point(world, dest, width, height);
  const t = walk ? Math.min(1, walk.t) : 0;
  const cx = ax + (bx - ax) * t;
  const cy = ay + (by - ay) * t;
  if (cat) {
    cat.x = 0;
    cat.groundY = 0;
    cat.scale = 0.7;
    cat.facing = bx >= ax ? 1 : -1;
    ctx.save();
    ctx.translate(cx, cy - 28);
    paintCat(ctx, cat, time);
    ctx.restore();
  }
  const foeId = world.path[wander.node % world.path.length];
  const [fx, fy] = point(world, foeId, width, height);
  ctx.fillStyle = "#8d6844";
  ctx.beginPath();
  ctx.ellipse(fx + 18, fy - 10, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = world.ink;
  ctx.font = "800 16px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${world.name} · ${world.mission}`, 220, height - 16);
  WORLDS.forEach((item, index) => {
    const mx = 230 + index * ((width - 420) / 3);
    const open = worldOpen(progress, index);
    ctx.fillStyle = index === map.world ? "#fff8f2" : open ? "rgba(255,248,242,0.7)" : "rgba(40,30,24,0.25)";
    ctx.beginPath();
    ctx.arc(mx, 108, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = open ? world.ink : "rgba(255,248,242,0.8)";
    ctx.font = "800 14px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(index + 1), mx, 113);
  });
  const panel = [
    progress.foundOwner ? "Owner found" : "Owner missing",
    progress.friend ? "Friend safe" : "Friend lost",
    progress.escaped ? "Out of the vet" : "Vet ahead",
    progress.home ? "Home" : "Rain between you",
  ];
  ctx.fillStyle = "rgba(255,248,242,0.82)";
  round(ctx, width - 168, 64, 152, 78, 14);
  ctx.fill();
  ctx.fillStyle = "#3a2a22";
  ctx.font = "600 11px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  panel.forEach((line, i) => ctx.fillText(line, width - 156, 84 + i * 16));
}

function round(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
