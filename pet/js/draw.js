import { COATS, EYES } from "./coats.js";
import { paintBoxCat, paintCat } from "./kitten.js";
import { lum, quadPoint, roundRect } from "./util.js";

const OUTLINE = "#4A3428";
const OUTLINE_SOFT = "#6A5346";

const SPECIES = [
  { id: "sparrow", body: "#C6A15C", wing: "#8A6238", belly: "#F4E4C4", beak: "#E09A40", cap: "#8A6238", cheek: "#F4E4C4" },
  { id: "chickadee", body: "#8E939C", wing: "#5E646C", belly: "#F7F4EF", beak: "#3A3A3A", cap: "#2A2A2E", cheek: "#FFFFFF" },
  { id: "cardinal", body: "#E23B3B", wing: "#B82028", belly: "#E85A4A", beak: "#F2A03A", cap: "#E23B3B", cheek: "#E23B3B", crest: true },
  { id: "bluebird", body: "#4C8ED9", wing: "#2C62B0", belly: "#F0A06A", beak: "#3A3A3A", cap: "#2C62B0", cheek: "#D7E8FA" },
  { id: "goldfinch", body: "#F2D04B", wing: "#2C2C30", belly: "#FFE98A", beak: "#F2A03A", cap: "#2C2C30", cheek: "#F2D04B" },
];

export function speciesAt(index) {
  return SPECIES[index % SPECIES.length];
}

export function speciesCount() {
  return SPECIES.length;
}

export function layoutRoom(w, h, uiTop, uiBottom) {
  const playTop = Math.max(8, uiTop + 4);
  const playBottom = h - Math.max(0, uiBottom);
  const playH = Math.max(120, playBottom - playTop);
  const floorY = Math.round(playTop + playH * 0.4);
  const ground = Math.round(playTop + playH * 0.74);
  const win = {
    x: Math.round(w * 0.06),
    y: Math.round(playTop),
    w: Math.round(w * 0.88),
    h: Math.max(80, Math.round(floorY - playTop - 12)),
  };
  const sun = {
    x: win.x + win.w * 0.34,
    y: ground - 6,
    rx: Math.max(52, w * 0.18),
    ry: Math.max(18, (ground - floorY) * 0.2),
  };
  const boxW = Math.min(118, Math.max(86, w * 0.26));
  const boxH = Math.min(96, Math.max(72, (ground - floorY) * 0.62));
  const box = {
    x: Math.round(w - boxW - Math.max(16, w * 0.05)),
    y: Math.round(ground - boxH),
    w: Math.round(boxW),
    h: Math.round(boxH),
  };
  const feeder = {
    x: win.x + win.w * 0.58,
    y: win.y + win.h * 0.58,
  };
  const couchH = Math.round(Math.min(84, Math.max(62, (ground - floorY) * 0.52)));
  const couchW = Math.round(Math.min(108, Math.max(86, w * 0.26)));
  const couch = {
    x: 46,
    y: Math.round(ground - couchH),
    w: couchW,
    h: couchH,
  };
  couch.scratchX = couch.x + couch.w + 10;
  const door = {
    x: Math.round(Math.min(w * 0.62, box.x - 64)),
    y: Math.round(ground - 78),
    w: 34,
    h: 78,
  };
  return {
    w,
    h,
    floorY,
    ground,
    win,
    sun,
    box,
    feeder,
    couch,
    door,
    watchX: feeder.x - w * 0.04,
    napX: sun.x,
    boxX: box.x + box.w * 0.42,
    playTop,
    playBottom,
  };
}

export function drawRoom(ctx, room, time, birds, extras) {
  const { w, h, floorY, win } = room;
  const shake = (extras.glass || 0) * Math.sin(time * 54) * 3;

  const wall = ctx.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, "#F8DCC8");
  wall.addColorStop(1, "#F3C5A8");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, floorY + 2);

  drawFloor(ctx, room);
  drawRug(ctx, room);
  drawSunbeam(ctx, room, time);

  ctx.save();
  ctx.translate(shake, 0);
  drawWindow(ctx, room, time, birds, extras);
  ctx.restore();

  drawDoor(ctx, room.door, extras.outsideOpen);
  drawCouch(ctx, room.couch, extras.wear || 0);
  drawBox(ctx, room.box);
}

export function layoutGarden(w, h, uiTop, uiBottom) {
  const playTop = Math.max(8, uiTop + 4);
  const playBottom = h - Math.max(0, uiBottom);
  const playH = Math.max(120, playBottom - playTop);
  const ground = Math.round(playTop + playH * 0.74);
  const horizon = Math.round(playTop + playH * 0.28);
  const flowers = [
    { x: w * 0.3, y: ground - 16, kind: 0 },
    { x: w * 0.44, y: ground - 6, kind: 1 },
    { x: w * 0.58, y: ground - 20, kind: 2 },
    { x: w * 0.7, y: ground - 8, kind: 3 },
  ];
  return {
    w,
    h,
    playTop,
    playBottom,
    ground,
    horizon,
    flowers,
    porchX: Math.round(w * 0.42),
    tree: { x: Math.round(w * 0.8), y: horizon + 8 },
    fenceY: Math.round(horizon + (ground - horizon) * 0.46),
    door: { x: 12, y: ground - 78, w: 34, h: 78 },
    watch: { x: Math.round(w * 0.72), y: horizon + 18 },
  };
}

export function drawGarden(ctx, garden, time, extras) {
  const { w, h, horizon, ground } = garden;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 40);
  sky.addColorStop(0, "#8ecdf2");
  sky.addColorStop(0.55, "#d7f1c4");
  sky.addColorStop(1, "#b7d98a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#fff8e8";
  ctx.beginPath();
  ctx.arc(w * 0.22, horizon * 0.42, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,248,232,0.85)";
  ctx.beginPath();
  ctx.arc(w * 0.62, horizon * 0.28, 16, 0, Math.PI * 2);
  ctx.arc(w * 0.68, horizon * 0.32, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8fbf62";
  ctx.beginPath();
  ctx.moveTo(0, horizon + 18);
  ctx.quadraticCurveTo(w * 0.3, horizon - 10, w * 0.55, horizon + 16);
  ctx.quadraticCurveTo(w * 0.8, horizon + 36, w, horizon + 8);
  ctx.lineTo(w, ground);
  ctx.lineTo(0, ground);
  ctx.fill();

  drawTree(ctx, garden.tree, time);
  drawFence(ctx, garden);
  ctx.fillStyle = "#7fba55";
  ctx.fillRect(0, garden.fenceY + 10, w, ground - garden.fenceY);
  for (const flower of garden.flowers) drawFlower(ctx, flower, time);
  for (const bird of extras.birds || []) drawBird(ctx, bird, time);
  for (const bug of extras.butterflies || []) drawButterfly(ctx, bug, time);

  const porch = ctx.createLinearGradient(0, ground - 8, 0, h);
  porch.addColorStop(0, "#e7c48a");
  porch.addColorStop(1, "#c9955c");
  ctx.fillStyle = porch;
  ctx.fillRect(0, ground - 6, w, h - ground + 6);
  ctx.strokeStyle = "rgba(120, 72, 36, 0.28)";
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, ground - 4);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  drawDoor(ctx, garden.door, true, "In");
}

function drawFloor(ctx, room) {
  const { w, h, floorY } = room;
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const y0 = floorY + ((h - floorY) * i) / rows;
    const y1 = floorY + ((h - floorY) * (i + 1)) / rows;
    ctx.fillStyle = i % 2 === 0 ? "#d7b48a" : "#c9a06e";
    ctx.fillRect(0, y0, w, y1 - y0 + 0.5);
  }
  ctx.strokeStyle = "rgba(120, 64, 24, 0.13)";
  ctx.lineWidth = 1;
  const cols = 6;
  for (let i = 1; i < cols; i++) {
    ctx.beginPath();
    ctx.moveTo((w * i) / cols, floorY);
    ctx.lineTo((w * i) / cols, h);
    ctx.stroke();
  }
  ctx.fillStyle = "#F7E7D6";
  ctx.fillRect(0, floorY - 8, w, 12);
  ctx.fillStyle = "#E7CDB8";
  ctx.fillRect(0, floorY + 2, w, 3);
}

function drawRug(ctx, room) {
  const { sun } = room;
  ctx.save();
  ctx.fillStyle = "#F0B7A2";
  ctx.beginPath();
  ctx.ellipse(sun.x + 8, sun.y + 8, sun.rx * 1.25, sun.ry * 1.55, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#E0898C";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,248,242,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(sun.x + 8, sun.y + 8, sun.rx * 0.86, sun.ry * 1.05, -0.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSunbeam(ctx, room, time) {
  const { win, sun } = room;
  const pulse = 0.22 + Math.sin(time * 0.7) * 0.04;
  ctx.fillStyle = `rgba(255, 214, 120, ${pulse})`;
  ctx.beginPath();
  ctx.moveTo(win.x + win.w * 0.18, win.y + win.h - 4);
  ctx.lineTo(win.x + win.w * 0.62, win.y + win.h - 4);
  ctx.lineTo(sun.x + sun.rx * 0.95, sun.y + sun.ry * 0.2);
  ctx.lineTo(sun.x - sun.rx * 0.85, sun.y + sun.ry * 0.2);
  ctx.closePath();
  ctx.fill();

  const glow = ctx.createRadialGradient(sun.x, sun.y, 8, sun.x, sun.y, sun.rx);
  glow.addColorStop(0, "rgba(255, 214, 110, 0.9)");
  glow.addColorStop(0.55, "rgba(255, 196, 90, 0.38)");
  glow.addColorStop(1, "rgba(255, 214, 120, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(sun.x, sun.y, sun.rx, sun.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  if (room.reduced) return;
  for (let i = 0; i < 7; i++) {
    const u = (time * 0.045 + i * 0.17) % 1;
    const y = sun.y - u * (sun.y - (win.y + win.h * 0.72));
    const x = sun.x + (0.5 - u) * 24 + Math.sin(time * 0.8 + i * 2) * 12;
    const alpha = Math.sin(u * Math.PI) * 0.55;
    ctx.fillStyle = `rgba(255, 252, 235, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.6 + (i % 3) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWindow(ctx, room, time, birds, extras) {
  const { win } = room;
  ctx.save();
  roundRect(ctx, win.x - 8, win.y - 8, win.w + 16, win.h + 18, 16);
  ctx.fillStyle = "#FFF8F2";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#E7D3C4";
  ctx.stroke();

  ctx.save();
  roundRect(ctx, win.x, win.y, win.w, win.h, 8);
  ctx.clip();
  drawOutside(ctx, room, time);
  drawFeeder(ctx, room);
  for (const bird of birds) drawBird(ctx, bird, time);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.moveTo(win.x, win.y);
  ctx.lineTo(win.x + win.w * 0.42, win.y);
  ctx.lineTo(win.x, win.y + win.h * 0.55);
  ctx.closePath();
  ctx.fill();
  if (extras.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${extras.flash * 0.28})`;
    ctx.fillRect(win.x, win.y, win.w, win.h);
  }
  for (const print of extras.prints || []) drawPawPrint(ctx, print);
  ctx.restore();

  ctx.strokeStyle = "#FFF8F2";
  ctx.lineWidth = 4;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(win.x + win.w / 2, win.y + 2);
  ctx.lineTo(win.x + win.w / 2, win.y + win.h - 2);
  ctx.moveTo(win.x + 2, win.y + win.h * 0.46);
  ctx.lineTo(win.x + win.w - 2, win.y + win.h * 0.46);
  ctx.stroke();

  drawCurtain(ctx, win.x - 2, win.y - 4, 1);
  drawCurtain(ctx, win.x + win.w + 2, win.y - 4, -1);
  drawSill(ctx, room);
  ctx.restore();
}

function drawOutside(ctx, room, time) {
  const { win } = room;
  const sky = ctx.createLinearGradient(0, win.y, 0, win.y + win.h);
  sky.addColorStop(0, "#7EC8F8");
  sky.addColorStop(0.55, "#C5ECFF");
  sky.addColorStop(1, "#E5F8D8");
  ctx.fillStyle = sky;
  ctx.fillRect(win.x, win.y, win.w, win.h);

  const sunX = win.x + win.w * 0.22;
  const sunY = win.y + win.h * 0.28;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 36);
  glow.addColorStop(0, "rgba(255, 244, 186, 0.95)");
  glow.addColorStop(1, "rgba(255, 244, 186, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFF4C8";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
  ctx.fill();

  if (!room.reduced) {
    for (let i = 0; i < 2; i++) {
      const travel = (time * (7 + i * 3) + i * 180) % (win.w + 90);
      const x = win.x - 40 + travel;
      const y = win.y + 28 + i * 26;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.ellipse(x, y, 22, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 16, y + 2, 16, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 14, y + 3, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = "#B7D98A";
  ctx.beginPath();
  ctx.moveTo(win.x, win.y + win.h * 0.72);
  ctx.quadraticCurveTo(win.x + win.w * 0.3, win.y + win.h * 0.6, win.x + win.w * 0.55, win.y + win.h * 0.74);
  ctx.quadraticCurveTo(win.x + win.w * 0.8, win.y + win.h * 0.66, win.x + win.w, win.y + win.h * 0.78);
  ctx.lineTo(win.x + win.w, win.y + win.h);
  ctx.lineTo(win.x, win.y + win.h);
  ctx.fill();

  ctx.fillStyle = "#7DBE74";
  ctx.beginPath();
  ctx.moveTo(win.x, win.y + win.h * 0.84);
  ctx.quadraticCurveTo(win.x + win.w * 0.4, win.y + win.h * 0.74, win.x + win.w, win.y + win.h * 0.86);
  ctx.lineTo(win.x + win.w, win.y + win.h);
  ctx.lineTo(win.x, win.y + win.h);
  ctx.fill();

  const treeX = win.x + win.w * 0.16;
  const treeY = win.y + win.h * 0.78;
  ctx.fillStyle = "#8D5A32";
  roundRect(ctx, treeX - 4, treeY - 18, 8, 28, 3);
  ctx.fill();
  ctx.fillStyle = "#3E8F55";
  ctx.beginPath();
  ctx.arc(treeX, treeY - 28, 20, 0, Math.PI * 2);
  ctx.arc(treeX - 14, treeY - 16, 14, 0, Math.PI * 2);
  ctx.arc(treeX + 14, treeY - 16, 14, 0, Math.PI * 2);
  ctx.fill();
}

function drawFeeder(ctx, room) {
  const { feeder, win } = room;
  const x = feeder.x;
  const y = feeder.y;
  ctx.strokeStyle = "#8D5A32";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 28, win.y + win.h * 0.46);
  ctx.lineTo(x - 16, y - 16);
  ctx.moveTo(x + 28, win.y + win.h * 0.46);
  ctx.lineTo(x + 16, y - 16);
  ctx.stroke();

  ctx.fillStyle = "#E25B4A";
  ctx.beginPath();
  ctx.moveTo(x - 34, y - 14);
  ctx.lineTo(x, y - 30);
  ctx.lineTo(x + 34, y - 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#D08A45";
  roundRect(ctx, x - 42, y - 8, 84, 12, 4);
  ctx.fill();
  ctx.strokeStyle = "#8A5A32";
  ctx.stroke();
  ctx.fillStyle = "#E7B56A";
  roundRect(ctx, x - 38, y - 4, 76, 6, 3);
  ctx.fill();

  ctx.fillStyle = "#C9843A";
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(x - 20 + i * 7, y - 1, 2.2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCurtain(ctx, x, y, dir) {
  ctx.fillStyle = "#E9898C";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + dir * 28, y + 30, x + dir * 10, y + 78);
  ctx.quadraticCurveTo(x + dir * 26, y + 120, x + dir * 6, y + 150);
  ctx.lineTo(x, y + 150);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#F2B4B4";
  ctx.beginPath();
  ctx.ellipse(x + dir * 8, y + 70, 7, 5, 0.4 * dir, 0, Math.PI * 2);
  ctx.fill();
}

function drawSill(ctx, room) {
  const { win } = room;
  ctx.fillStyle = "#FFF8F2";
  roundRect(ctx, win.x - 14, win.y + win.h - 2, win.w + 28, 16, 6);
  ctx.fill();
  ctx.strokeStyle = "#E7D3C4";
  ctx.lineWidth = 2;
  ctx.stroke();

  const potX = win.x + 28;
  const potY = win.y + win.h - 2;
  ctx.fillStyle = "#E07A4A";
  roundRect(ctx, potX - 10, potY - 16, 20, 16, 4);
  ctx.fill();
  ctx.fillStyle = "#3E8F55";
  ctx.beginPath();
  ctx.ellipse(potX, potY - 22, 12, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(potX - 8, potY - 18, 7, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(potX + 8, potY - 16, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F2D04B";
  ctx.beginPath();
  ctx.ellipse(potX + 2, potY - 28, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPawPrint(ctx, print) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, print.life) * 0.75;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.translate(print.x, print.y);
  ctx.rotate(-0.4);
  ctx.beginPath();
  ctx.ellipse(0, 2, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const toe of [
    [-6, -6],
    [-2, -9],
    [3, -8],
    [7, -5],
  ]) {
    ctx.beginPath();
    ctx.ellipse(toe[0], toe[1], 2.4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDoor(ctx, door, open, label = "Out") {
  if (!door) return;
  const { x, y, w, h } = door;
  ctx.save();
  ctx.fillStyle = "#f4e2cc";
  ctx.strokeStyle = "#8d6244";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = open ? "#b9ddf2" : "#d9c4ae";
  ctx.fillRect(x + 4, y + 6, w - 8, h * 0.42);
  ctx.strokeRect(x + 4, y + 6, w - 8, h * 0.42);
  ctx.fillStyle = "#c9843a";
  roundRect(ctx, x + 5, y + h - 28, w - 10, 20, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6a4632";
  ctx.font = "700 9px ui-rounded, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + h - 14);
  ctx.restore();
}

function drawCouch(ctx, couch, wear) {
  if (!couch) return;
  const { x, y, w, h } = couch;
  ctx.save();
  ctx.fillStyle = "rgba(90, 52, 32, 0.14)";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h - 2, w * 0.42, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c96b4a";
  ctx.strokeStyle = "#8a4634";
  ctx.lineWidth = 2;
  roundRect(ctx, x + 8, y + 16, w - 22, h - 22, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e08968";
  roundRect(ctx, x + 4, y + h * 0.42, w - 28, h * 0.38, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#b85a3e";
  roundRect(ctx, x, y, 16, h - 6, 5);
  ctx.fill();
  ctx.stroke();
  const armX = x + w - 20;
  ctx.fillStyle = "#a84e36";
  roundRect(ctx, armX, y + 8, 20, h - 14, 6);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 236, 220, 0.85)";
  ctx.lineWidth = 1.4;
  const marks = Math.round(Math.max(0, Math.min(1, wear)) * 5);
  ctx.globalAlpha = 0.45 + wear * 0.5;
  for (let i = 0; i < marks; i++) {
    const yy = y + 18 + i * 8;
    ctx.beginPath();
    ctx.moveTo(armX + 4, yy);
    ctx.lineTo(armX + 15, yy + 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTree(ctx, tree, time) {
  ctx.save();
  ctx.fillStyle = "#8a5a3a";
  ctx.fillRect(tree.x - 6, tree.y, 12, 78);
  const sway = Math.sin(time * 0.7) * 3;
  ctx.fillStyle = "#3f8f45";
  ctx.beginPath();
  ctx.arc(tree.x + sway, tree.y + 4, 28, 0, Math.PI * 2);
  ctx.arc(tree.x - 18 + sway, tree.y + 16, 20, 0, Math.PI * 2);
  ctx.arc(tree.x + 18 + sway, tree.y + 18, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#67b15a";
  ctx.beginPath();
  ctx.arc(tree.x + sway, tree.y - 2, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFence(ctx, garden) {
  const y = garden.fenceY;
  ctx.save();
  ctx.strokeStyle = "#f4efe4";
  ctx.fillStyle = "#f7f1e6";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, y);
  ctx.lineTo(garden.w - 8, y);
  ctx.moveTo(18, y + 12);
  ctx.lineTo(garden.w - 8, y + 12);
  ctx.stroke();
  for (let x = 24; x < garden.w; x += 28) {
    roundRect(ctx, x, y - 10, 6, 36, 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFlower(ctx, flower, time) {
  const colors = ["#e86b8a", "#f2d04b", "#f4f0ea", "#c984d4"];
  const bob = Math.sin(time * 1.3 + flower.x) * 1.2;
  ctx.save();
  ctx.strokeStyle = "#3f7a3a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(flower.x, flower.y + 16);
  ctx.quadraticCurveTo(flower.x + 2, flower.y + 6, flower.x, flower.y + bob);
  ctx.stroke();
  ctx.fillStyle = colors[flower.kind % colors.length];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(flower.x + Math.cos(a) * 4, flower.y + bob + Math.sin(a) * 4, 3, 2, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f2c14b";
  ctx.beginPath();
  ctx.arc(flower.x, flower.y + bob, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawButterfly(ctx, bug, time) {
  const flap = 0.45 + Math.abs(Math.sin(time * 10 + bug.phase)) * 0.7;
  ctx.save();
  ctx.translate(bug.x, bug.y);
  ctx.fillStyle = bug.color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(-6, 0, 7 * flap, 4.2, -0.4, 0, Math.PI * 2);
  ctx.ellipse(6, 0, 7 * flap, 4.2, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#4a3428";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(0, 3);
  ctx.stroke();
  ctx.restore();
}

export function hitRect(rect, x, y, pad = 10) {
  if (!rect) return false;
  return x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad;
}

export function drawBox(ctx, box) {
  const { x, y, w, h } = box;
  ctx.save();
  ctx.fillStyle = "rgba(120, 70, 30, 0.16)";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.48, y + h - 2, w * 0.36, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#C9925A";
  ctx.strokeStyle = "#8A5A32";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.7, y + 18);
  ctx.lineTo(x + w + 8, y + 28);
  ctx.lineTo(x + w + 8, y + h - 8);
  ctx.lineTo(x + w * 0.7, y + h - 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#8C623C";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.42, y + 24, w * 0.3, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#E7C48A";
  flap(ctx, x + 6, y + 20, -18, 2, -4, 14);
  flap(ctx, x + w * 0.62, y + 20, 22, 4, 8, 16);
  ctx.fillStyle = "#F0D2A0";
  flap(ctx, x + w * 0.2, y + 22, w * 0.16, 16, w * 0.28, 18);

  ctx.fillStyle = "#E2B56E";
  roundRect(ctx, x, y + 20, w * 0.78, h - 24, 7);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(196, 146, 78, 0.55)";
  ctx.fillRect(x + w * 0.34, y + 20, 9, h - 24);

  ctx.strokeStyle = "#8A5A32";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(x + w * 0.26, y + h * 0.62, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function flap(ctx, x, y, x2, y2, x3, y3) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + x2, y + y2);
  ctx.lineTo(x + x3, y + y3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function drawBird(ctx, bird, time) {
  const spec = bird.spec;
  const flap = bird.state === "fly" || bird.state === "scatter" || bird.state === "leave"
    ? Math.sin(time * (bird.state === "scatter" ? 28 : 16) + bird.phase) * 0.7
    : Math.sin(time * 2 + bird.phase) * 0.08;
  ctx.save();
  ctx.translate(bird.x, bird.y + Math.sin(time * 2 + bird.phase) * (bird.state === "perch" || bird.state === "peck" ? 0.6 : 0));
  ctx.scale(bird.dir * 1.28, 1.28);
  const peck = bird.peckT > 0 ? 0.7 : 0;

  ctx.fillStyle = spec.wing;
  ctx.beginPath();
  ctx.ellipse(-2, 1, 8, 4.5, -0.6 + flap, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = spec.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = spec.belly;
  ctx.beginPath();
  ctx.ellipse(2, 2.5, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(8, -2);
  ctx.rotate(peck);
  ctx.fillStyle = spec.cap || spec.body;
  ctx.beginPath();
  ctx.arc(0, 0, 5.4, 0, Math.PI * 2);
  ctx.fill();
  if (spec.cheek) {
    ctx.fillStyle = spec.cheek;
    ctx.beginPath();
    ctx.ellipse(-1, 1.5, 2.4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (spec.crest) {
    ctx.fillStyle = spec.body;
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(1, -11);
    ctx.lineTo(3, -3);
    ctx.fill();
  }
  ctx.fillStyle = "#1C1A22";
  ctx.beginPath();
  ctx.arc(1.5, -0.5, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(1.1, -0.9, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = spec.beak;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(9, 1.2);
  ctx.lineTo(4, 2.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = spec.wing;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(-15, 3);
  ctx.lineTo(-8, 4);
  ctx.fill();
  ctx.restore();
}

export function appearanceFrom(config) {
  const coat = COATS[config.coat] || COATS.orange;
  const eye = EYES[config.eyes] || EYES.green;
  return {
    hair: config.hair === "long" ? "long" : "short",
    gender: config.gender === "boy" ? "boy" : "girl",
    coat,
    eye: eye.color,
    eyeDeep: eye.deep,
    whisker: lum(coat.base) < 0.45 ? "rgba(255,248,242,0.85)" : "rgba(74,52,40,0.7)",
    outline: lum(coat.base) > 0.85 ? "#8A7468" : OUTLINE,
  };
}

export function catHit(cat, x, y) {
  if (!cat || cat.inBox) {
    if (cat && cat.inBox) {
      const hx = cat.boxAnchorX;
      const hy = cat.boxAnchorY;
      const dx = x - hx;
      const dy = y - hy;
      const body = dx * dx / (36 * 36) + dy * dy / (30 * 30) <= 1;
      return { body, belly: false };
    }
    return { body: false, belly: false };
  }
  const s = cat.scale;
  const cx = cat.x + cat.facing * 8 * s;
  const cy = cat.groundY + cat.hop - 46 * s;
  const dx = (x - cx) / (62 * s);
  const dy = (y - cy) / (48 * s);
  const body = dx * dx + dy * dy <= 1.05;
  const belly = body && y > cy + 6 * s && Math.abs(x - cx) < 34 * s && cat.back < 0.4 && cat.curl < 0.5;
  return { body, belly };
}

export function drawCat(ctx, cat, time) {
  paintCat(ctx, cat, time);
}

function drawShadow(ctx, cat) {
  const air = Math.min(1, Math.abs(cat.hop) / 90);
  ctx.save();
  ctx.translate(cat.x, cat.groundY + 4);
  ctx.scale(1 - air * 0.25, 1);
  ctx.globalAlpha = 0.16 * (1 - air * 0.45);
  ctx.fillStyle = "#6A4428";
  ctx.beginPath();
  const wide = cat.curl > 0.6 ? 28 : 36;
  ctx.ellipse(0, 0, wide * cat.scale, 9 * cat.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function fluffExtra(cat) {
  return cat.app.hair === "long" ? 1 : 0;
}

function drawActive(ctx, cat, time) {
  const m = cat.m;
  const f = fluffExtra(cat);
  const breath = Math.sin(time * (cat.asleep ? 1.4 : 2.5)) * (cat.asleep ? 2.2 : 1);
  const bodyY = m.bodyY + breath;
  const rx = m.bodyRx + f * 11;
  const ry = m.bodyRy + f * 8;
  drawTail(ctx, cat, m, time, bodyY);
  if (f) {
    traceTorso(ctx, m.bodyX - 2, bodyY + 2, rx + 7, ry + 6);
    ctx.fillStyle = cat.app.coat.shade;
    ctx.fill();
    strokeCute(ctx, cat.app.outline, 2.2);
  }

  traceTorso(ctx, m.bodyX, bodyY, rx, ry);
  ctx.fillStyle = cat.app.coat.base;
  ctx.fill();
  paintBodyPattern(ctx, cat, m.bodyX, bodyY, rx, ry);
  traceTorso(ctx, m.bodyX, bodyY, rx, ry);
  strokeCute(ctx, cat.app.outline, 2.6);

  drawBelly(ctx, cat, m, bodyY);
  drawLegs(ctx, cat, m, bodyY);

  ctx.fillStyle = cat.app.coat.base;
  ctx.beginPath();
  ctx.ellipse(m.headX - 6, m.headY + 22 + breath * 0.2, 16 + f * 3, 14, 0.5, 0, Math.PI * 2);
  ctx.fill();

  if (f) drawCheekFluff(ctx, cat, m);
  ctx.save();
  ctx.translate(m.headX, m.headY + breath * 0.35);
  drawHead(ctx, cat, time);
  ctx.restore();

  if (cat.purr > 0.25) drawPurrMarks(ctx, cat, m, time);
}

function traceTorso(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(8, rx), Math.max(8, ry), -0.04, 0, Math.PI * 2);
}

function strokeCute(ctx, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function paintBodyPattern(ctx, cat, x, y, rx, ry) {
  const coat = cat.app.coat;
  ctx.save();
  traceTorso(ctx, x, y, rx + (cat.app.hair === "long" ? 8 : 0), ry + (cat.app.hair === "long" ? 4 : 0));
  ctx.clip();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = coat.shade;
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.2, y - ry * 0.35, rx * 0.7, ry * 0.42, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (coat.pattern === "tabby") {
    ctx.strokeStyle = coat.stripe;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x - rx * 0.45 + i * rx * 0.28, y - ry * 0.1, ry * 0.75, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (coat.pattern === "calico") {
    blob(ctx, coat.orange, x - rx * 0.25, y - ry * 0.1, rx * 0.45, ry * 0.55, 0.4);
    blob(ctx, coat.ink, x + rx * 0.28, y + ry * 0.05, rx * 0.32, ry * 0.4, -0.2);
  } else if (coat.pattern === "tortie") {
    blob(ctx, coat.orange, x - rx * 0.15, y - ry * 0.05, rx * 0.5, ry * 0.48, 0.6);
    blob(ctx, coat.orange, x + rx * 0.3, y + ry * 0.1, rx * 0.22, ry * 0.3, -0.4);
  } else if (coat.pattern === "point") {
    ctx.fillStyle = coat.point;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.72, y + ry * 0.72, 12, 7, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function blob(ctx, color, x, y, rx, ry, rot) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function pawFill(cat, low) {
  const coat = cat.app.coat;
  if (coat.pattern === "tuxedo" && low) return "#FFFEFC";
  if (coat.pattern === "point" && low) return coat.point;
  return coat.base;
}

function drawBelly(ctx, cat, m, bodyY) {
  const coat = cat.app.coat;
  if (coat.pattern === "point" || coat.pattern === "tortie") return;
  ctx.fillStyle = coat.belly;
  ctx.beginPath();
  ctx.ellipse(m.bodyX + m.bodyRx * 0.42, bodyY + m.bodyRy * 0.42, 11, 9, 0.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawLegs(ctx, cat, m, bodyY) {
  if (m.legTuck > 0.62 && m.stretch < 0.4) {
    drawSitPaws(ctx, cat, m, bodyY);
    return;
  }
  const phase = cat.walkPhase || 0;
  const stride = m.stride || 0;
  const hips = [
    { along: -0.62, shift: 0.1, width: 7 },
    { along: -0.28, shift: Math.PI, width: 8 },
    { along: 0.22, shift: Math.PI * 0.45, width: 7 },
    { along: 0.55, shift: Math.PI * 1.45, width: 9 },
  ];
  hips.forEach((hip, index) => {
    const hipX = m.bodyX + m.bodyRx * hip.along;
    const hipY = bodyY + m.bodyRy * 0.55;
    const swing = Math.sin(phase * Math.PI * 2 + hip.shift) * 13 * stride;
    const lift = Math.max(0, Math.sin(phase * Math.PI * 2 + hip.shift)) * 9 * stride;
    let footX = hipX + swing;
    let footY = -2 - lift;
    if (m.stretch > 0.2 && index >= 2) {
      footX = hipX + 26 * m.stretch + (index === 3 ? 10 : 0);
      footY = -2;
    }
    if (index === 3 && cat.swat > 0) {
      footX += 22 * cat.swat;
      footY -= 16 * cat.swat;
    }
    const color = pawFill(cat, true);
    drawLimb(ctx, hipX, hipY, footX, footY, color, cat.app.outline, hip.width);
  });
}

function drawSitPaws(ctx, cat, m, bodyY) {
  const outline = cat.app.outline;
  const color = pawFill(cat, true);
  const chest = m.bodyX + m.bodyRx * 0.15;
  drawPaw(ctx, chest - 2, -1, color, outline, 11);
  if (m.groom > 0.12) {
    const px = chest + 12 + (m.headX - chest - 8) * m.groom;
    const py = -1 + (m.headY + 16 - -1) * m.groom;
    drawLimb(ctx, chest + 8, bodyY + m.bodyRy * 0.2, px, py, pawFill(cat, false), outline, 8);
    drawPaw(ctx, px, py, pawFill(cat, false), outline, 8);
  } else if (cat.swat > 0.05) {
    const px = chest + 16 + 26 * cat.swat;
    const py = -1 - 20 * cat.swat;
    drawLimb(ctx, chest + 8, bodyY + 4, px, py, color, outline, 8);
    drawPaw(ctx, px, py, color, outline, 8);
  } else {
    drawPaw(ctx, chest + 16, -1, color, outline, 11);
  }
}

function drawPaw(ctx, x, y, color, outline, size) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.72, size * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

function drawLimb(ctx, x0, y0, x1, y1, color, outline, width) {
  ctx.strokeStyle = outline;
  ctx.lineWidth = width + 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x1, y1, width * 0.72, width * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.7;
  ctx.stroke();
}

function drawCheekFluff(ctx, cat, m) {
  ctx.fillStyle = cat.app.coat.base;
  ctx.beginPath();
  ctx.ellipse(m.headX - 14, m.headY + 14, 9, 6, 0.5, 0, Math.PI * 2);
  ctx.ellipse(m.headX + 18, m.headY + 16, 10, 6.5, -0.35, 0, Math.PI * 2);
  ctx.fill();
  strokeCute(ctx, cat.app.outline, 1.6);
}

function drawTail(ctx, cat, m, time, bodyY) {
  const f = fluffExtra(cat);
  const lift = m.tailLift;
  const wag = Math.sin(time * cat.tailSpeed) * cat.tailAmp * 0.55;
  const anchorY = bodyY == null ? m.bodyY : bodyY;
  const reach = f ? 16 : 0;
  const p0 = { x: m.bodyX - m.bodyRx * 0.78, y: anchorY + 2 };
  const p1 = { x: p0.x - 26 - reach - lift * 8, y: p0.y - 10 - lift * 18 + wag * 0.2 };
  const p2 = { x: p0.x - 6 + wag * 0.35, y: p0.y - 38 - reach - lift * 26 + wag };
  const coat = cat.app.coat;
  const outline = cat.app.outline;
  const fur = coat.pattern === "point" ? coat.point : coat.base;
  const outer = f ? 20 : 9;
  const inner = f ? 14 : 6;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = outline;
  ctx.lineWidth = outer + 3.5;
  strokeCurve(ctx, p0, p1, p2);
  ctx.strokeStyle = fur;
  ctx.lineWidth = inner;
  strokeCurve(ctx, p0, p1, p2);
  const tip = quadPoint(p0, p1, p2, 1);
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, f ? 9 : 4.5, 0, Math.PI * 2);
  ctx.fill();
  strokeCute(ctx, outline, 1.8);
  if (coat.pattern === "tabby") {
    ctx.strokeStyle = coat.stripe;
    ctx.lineWidth = 2;
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const p = quadPoint(p0, p1, p2, t);
      const tan = quadTangent(p0, p1, p2, t);
      const mag = Math.hypot(tan.x, tan.y) || 1;
      const nx = -tan.y / mag;
      const ny = tan.x / mag;
      const len = f ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(p.x - nx * len, p.y - ny * len);
      ctx.lineTo(p.x + nx * len, p.y + ny * len);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function quadTangent(p0, p1, p2, t) {
  return {
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

function strokeCurve(ctx, p0, p1, p2) {
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
  ctx.stroke();
}

function drawHead(ctx, cat, time) {
  const app = cat.app;
  const coat = app.coat;
  const f = fluffExtra(cat);
  const earBack = cat.m.earBack || 0;
  const twitch = cat.earTwitch || 0;
  const side = cat.earSide || 0;

  drawEar(ctx, -18, -18, 0.78, -0.4 - earBack * 0.5 + (side < 0 ? twitch : 0) * 0.45, cat, f, "far");
  ctx.beginPath();
  ctx.ellipse(2, 2, 29 + f * 4, 27 + f * 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = coat.base;
  ctx.fill();
  paintHeadPattern(ctx, cat);
  ctx.beginPath();
  ctx.ellipse(2, 2, 29 + f * 4, 27 + f * 3, 0, 0, Math.PI * 2);
  strokeCute(ctx, app.outline, 2.4);
  drawEar(ctx, 14, -24, 1, 0.18 - earBack * 0.35 + (side > 0 ? twitch : 0) * 0.5, cat, f, "near");

  if (coat.pattern === "tuxedo" || coat.pattern === "calico") {
    ctx.fillStyle = "#FFFEFC";
    ctx.beginPath();
    ctx.ellipse(6, 14, 14, 10, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  const open = cat.blink == null ? 1 : cat.blink;
  const squint = cat.squint || 0;
  const eyeOpen = cat.asleep ? 0 : open * (1 - squint * 0.62);
  drawEye(ctx, -9, -1, 8, 9.6, eyeOpen, squint || (cat.asleep ? 0.2 : 0), cat, true);
  drawEye(ctx, 10, 1, 10, 12, eyeOpen, squint || (cat.asleep ? 0.2 : 0), cat, false);

  ctx.fillStyle = coat.nose;
  ctx.beginPath();
  ctx.moveTo(5, 12);
  ctx.quadraticCurveTo(9, 16, 13, 12.5);
  ctx.quadraticCurveTo(9, 18, 5, 12);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(7.2, 13.2, 1.1, 0, Math.PI * 2);
  ctx.fill();

  drawMouth(ctx, cat);
  drawWhiskers(ctx, cat);
  ctx.globalAlpha = 0.28 + (cat.squint || 0) * 0.35;
  ctx.fillStyle = "#F4A0B0";
  ctx.beginPath();
  ctx.ellipse(-12, 10, 6, 3.2, 0, 0, Math.PI * 2);
  ctx.ellipse(18, 12, 6.5, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (app.gender === "girl") drawBow(ctx, 24, -18, app.outline);
  else drawCollar(ctx, app.outline);

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-6, -12, 10, 5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  void time;
}

function paintHeadPattern(ctx, cat) {
  const coat = cat.app.coat;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(2, 2, 29 + (cat.app.hair === "long" ? 4 : 0), 27 + (cat.app.hair === "long" ? 3 : 0), 0, 0, Math.PI * 2);
  ctx.clip();
  if (coat.pattern === "tabby") {
    ctx.strokeStyle = coat.stripe;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, -18);
    ctx.lineTo(-4, -11);
    ctx.lineTo(1, -16);
    ctx.lineTo(6, -11);
    ctx.lineTo(10, -18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-18, 6);
    ctx.quadraticCurveTo(-10, 9, -16, 13);
    ctx.moveTo(16, 8);
    ctx.quadraticCurveTo(22, 12, 18, 15);
    ctx.stroke();
  } else if (coat.pattern === "calico") {
    blob(ctx, coat.orange, -14, -16, 10, 8, 0.3);
    blob(ctx, coat.ink, 18, 12, 8, 6, -0.2);
  } else if (coat.pattern === "tortie") {
    blob(ctx, coat.orange, -2, -16, 12, 7, 0.2);
    blob(ctx, coat.orange, 16, 12, 7, 5, -0.3);
  } else if (coat.pattern === "point") {
    ctx.fillStyle = coat.point;
    ctx.beginPath();
    ctx.ellipse(6, 6, 20, 16, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEar(ctx, x, y, sc, rot, cat, fluff, which) {
  const coat = cat.app.coat;
  let outer = coat.base;
  if (coat.pattern === "point") outer = coat.point;
  else if (coat.pattern === "calico") outer = which === "far" ? coat.ink : coat.orange;
  else if (coat.pattern === "tortie" && which === "near") outer = coat.orange;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  ctx.beginPath();
  ctx.moveTo(-11, 8);
  ctx.quadraticCurveTo(-13, -14, 0, -26);
  ctx.quadraticCurveTo(13, -14, 11, 8);
  ctx.closePath();
  ctx.fillStyle = outer;
  ctx.fill();
  strokeCute(ctx, cat.app.outline, 2);
  ctx.beginPath();
  ctx.moveTo(-5, 6);
  ctx.quadraticCurveTo(-6, -6, 0, -14);
  ctx.quadraticCurveTo(6, -6, 5, 6);
  ctx.closePath();
  ctx.fillStyle = coat.innerEar;
  ctx.fill();
  if (fluff) {
    ctx.beginPath();
    ctx.moveTo(-3, -24);
    ctx.lineTo(0, -30);
    ctx.lineTo(4, -22);
    ctx.closePath();
    ctx.fillStyle = outer;
    ctx.fill();
    strokeCute(ctx, cat.app.outline, 1.6);
  }
  ctx.restore();
}

function drawEye(ctx, x, y, rx, ry, open, squint, cat, far) {
  const h = ry * open;
  const happy = squint > 0.35 && !cat.asleep;
  ctx.save();
  ctx.translate(x, y);
  if (h < 2.2) {
    ctx.strokeStyle = "#2A2428";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-rx, 0);
    ctx.quadraticCurveTo(0, happy || cat.asleep ? -4.5 : 3, rx, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, h, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFEFC";
  ctx.fill();
  ctx.strokeStyle = cat.app.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const gazeX = (cat.gazeX || 0) * (far ? 0.7 : 1);
  const gazeY = (cat.gazeY || 0) * (far ? 0.7 : 1);
  const irisR = Math.max(1.2, Math.min(h - 1.6, far ? 5.4 : 7));
  const irisH = Math.max(1.2, Math.min(h - 1.8, irisR + 0.6));
  ctx.fillStyle = cat.app.eye;
  ctx.beginPath();
  ctx.ellipse(gazeX * 0.3, 0.8 + gazeY * 0.2, irisR, irisH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cat.app.eyeDeep;
  ctx.beginPath();
  ctx.ellipse(gazeX * 0.3, 1.2, Math.max(1, irisR * 0.72), Math.max(1, irisR * 0.72), 0, 0, Math.PI * 2);
  ctx.fill();
  const pupil = (far ? 2.6 : 3.5) + (cat.excited || 0) * 1.1;
  const pupilR = Math.max(0.8, Math.min(pupil, h * 0.45));
  ctx.fillStyle = "#1C1A22";
  ctx.beginPath();
  ctx.arc(gazeX, 1.1 + gazeY, pupilR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-rx * 0.28 + gazeX * 0.2, -h * 0.28, far ? 1.7 : 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rx * 0.32, h * 0.22, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMouth(ctx, cat) {
  ctx.strokeStyle = "#6A4038";
  ctx.fillStyle = "#6A3040";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  const mouth = cat.mouth || "none";
  if (mouth === "meow" || mouth === "yawn") {
    ctx.beginPath();
    ctx.ellipse(9, 20, mouth === "yawn" ? 7 : 4.5, mouth === "yawn" ? 8 : 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (mouth === "yawn") {
      ctx.fillStyle = "#F2A0B4";
      ctx.beginPath();
      ctx.ellipse(9, 23, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (mouth === "chatter") {
    ctx.beginPath();
    ctx.ellipse(9, 19, 3.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (mouth === "lick" || cat.lick > 0.65) {
    ctx.beginPath();
    ctx.moveTo(6, 17);
    ctx.quadraticCurveTo(9, 22, 12, 17);
    ctx.stroke();
    ctx.fillStyle = "#F2A0B4";
    ctx.beginPath();
    ctx.ellipse(9, 21, 2.2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(9, 17);
  ctx.quadraticCurveTo(6, 21, 3, 18);
  ctx.moveTo(9, 17);
  ctx.quadraticCurveTo(12, 21, 16, 18);
  ctx.stroke();
}

function drawWhiskers(ctx, cat) {
  ctx.strokeStyle = cat.app.whisker;
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  const lines = [
    [-2, 12, -28, 8],
    [-1, 15, -30, 15],
    [0, 18, -26, 22],
    [14, 13, 34, 8],
    [14, 16, 36, 16],
    [13, 19, 32, 23],
  ];
  for (const [x1, y1, x2, y2] of lines) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, y1 - 1, x2, y2);
    ctx.stroke();
  }
}

function drawBow(ctx, x, y, outline) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#E23E6B";
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(-7, 0, 8, 5.2, -0.45, 0, Math.PI * 2);
  ctx.ellipse(7, 0, 8, 5.2, 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 3.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.quadraticCurveTo(-8, 10, -5, 15);
  ctx.moveTo(2, 2);
  ctx.quadraticCurveTo(8, 11, 5, 16);
  ctx.stroke();
  ctx.restore();
}

function drawCollar(ctx, outline) {
  ctx.save();
  ctx.strokeStyle = "#E2533E";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(4, 10, 20, 0.25, Math.PI - 0.15);
  ctx.stroke();
  ctx.fillStyle = "#F2C14B";
  ctx.beginPath();
  ctx.arc(6, 30, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = "#A88420";
  ctx.beginPath();
  ctx.moveTo(4, 28);
  ctx.lineTo(8, 32);
  ctx.stroke();
  ctx.restore();
}

function drawPurrMarks(ctx, cat, m, time) {
  ctx.save();
  ctx.globalAlpha = 0.35 + Math.sin(time * 26) * 0.15;
  ctx.strokeStyle = "#E07098";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(m.headX + 24, m.headY + 6 + i * 5, 6 + i, -0.4, 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCurl(ctx, cat, time) {
  const f = fluffExtra(cat);
  const coat = cat.app.coat;
  const breath = Math.sin(time * 1.35) * 1.6;
  const rx = 34 + f * 8;
  const ry = 26 + f * 5 + breath;
  ctx.save();
  ctx.strokeStyle = coat.pattern === "point" ? coat.point : coat.base;
  ctx.lineWidth = f ? 16 : 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(-2, -30, rx * 0.92, 0.15, Math.PI * 1.25);
  ctx.stroke();
  if (f) {
    ctx.strokeStyle = coat.base;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(-2, -30, rx * 0.92, 0.15, Math.PI * 1.25);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(-2, -30, rx, ry, 0.05, 0, Math.PI * 2);
  ctx.fillStyle = coat.base;
  ctx.fill();
  paintCurlPattern(ctx, cat, rx, ry);
  ctx.beginPath();
  ctx.ellipse(-2, -30, rx, ry, 0.05, 0, Math.PI * 2);
  strokeCute(ctx, cat.app.outline, 2.4);

  ctx.fillStyle = coat.belly;
  ctx.beginPath();
  ctx.ellipse(6, -18, 10, 7, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cat.app.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.save();
  ctx.translate(16, -42 + breath * 0.3);
  ctx.rotate(0.35);
  const asleep = cat.asleep;
  const prev = cat.asleep;
  cat.asleep = true;
  drawHead(ctx, cat, time);
  cat.asleep = prev || asleep;
  ctx.restore();
  ctx.restore();
}

function paintCurlPattern(ctx, cat, rx, ry) {
  const coat = cat.app.coat;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-2, -30, rx, ry, 0.05, 0, Math.PI * 2);
  ctx.clip();
  if (coat.pattern === "tabby") {
    ctx.strokeStyle = coat.stripe;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-16 + i * 14, -34, 16, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  } else if (coat.pattern === "calico" || coat.pattern === "tortie") {
    blob(ctx, coat.orange, -8, -34, 16, 12, 0.4);
    if (coat.pattern === "calico") blob(ctx, coat.ink, 10, -24, 12, 10, -0.3);
  }
  ctx.restore();
}

function drawBack(ctx, cat, time) {
  const coat = cat.app.coat;
  const f = fluffExtra(cat);
  const kick = Math.sin(time * 10) * cat.backKick;
  ctx.fillStyle = coat.pattern === "point" ? coat.point : coat.base;
  ctx.lineCap = "round";
  ctx.lineWidth = f ? 12 : 7;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  ctx.moveTo(-30, -28);
  ctx.quadraticCurveTo(-48, -6, -24, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, -34, 40 + f * 7, 24 + f * 3, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = coat.base;
  ctx.fill();
  strokeCute(ctx, cat.app.outline, 2.3);
  ctx.fillStyle = coat.belly;
  ctx.beginPath();
  ctx.ellipse(0, -38, 24, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  const paws = [
    [-16, -54],
    [-4, -60],
    [12, -58],
    [22, -50],
  ];
  paws.forEach((paw, i) => {
    const y = paw[1] + (i > 1 ? kick : -kick) * 0.4;
    drawLimb(ctx, paw[0] * 0.4, -40, paw[0], y, coat.pattern === "tuxedo" ? "#FFFEFC" : coat.base, cat.app.outline, 7);
    ctx.fillStyle = "#F3A8B8";
    ctx.beginPath();
    ctx.ellipse(paw[0], y - 2, 3.2, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.save();
  ctx.translate(38, -28);
  ctx.rotate(-0.7);
  drawHead(ctx, cat, time);
  ctx.restore();
}

export function drawBoxCat(ctx, cat, box, time) {
  paintBoxCat(ctx, cat, box, time);
}

export function drawFeather(ctx, x, y, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.78;
  ctx.rotate(-0.9 + Math.sin(time * 3) * 0.08);
  ctx.fillStyle = "rgba(196, 84, 86, 0.9)";
  ctx.beginPath();
  ctx.ellipse(0, -7, 3.2, 9, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(232, 206, 170, 0.75)";
  ctx.beginPath();
  ctx.ellipse(1.4, -2, 1.8, 6, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(90, 60, 40, 0.35)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(1, 12);
  ctx.stroke();
  ctx.restore();
}

export function drawLaser(ctx, x, y, time) {
  const pulse = 0.55 + Math.sin(time * 10) * 0.2;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = `rgba(255, 48, 56, ${0.22 * pulse})`;
  ctx.beginPath();
  ctx.arc(x, y, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 36, 48, 0.85)";
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawYarn(ctx, yarn) {
  ctx.save();
  ctx.translate(yarn.x, yarn.y);
  ctx.rotate(yarn.rot || 0);
  ctx.fillStyle = "rgba(120,70,30,0.15)";
  ctx.beginPath();
  ctx.ellipse(0, yarn.r - 2, yarn.r * 0.7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#E23B4A";
  ctx.beginPath();
  ctx.arc(0, 0, yarn.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#F7D0A8";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, yarn.r - 3, 0.4, 2.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, yarn.r - 6, 2.4, 4.4);
  ctx.stroke();
  ctx.strokeStyle = "#B82434";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "#F2C14B";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(yarn.r - 1, -2);
  ctx.quadraticCurveTo(yarn.r + 10, -8, yarn.r + 6, 6);
  ctx.stroke();
  ctx.restore();
}

export function drawEffects(ctx, effects) {
  for (const fx of effects) {
    if (fx.type === "heart") drawHeart(ctx, fx);
    else if (fx.type === "zzz") drawZ(ctx, fx);
    else if (fx.type === "mark") drawChatter(ctx, fx);
    else if (fx.type === "zoom") drawZoomLine(ctx, fx);
  }
}

function drawHeart(ctx, fx) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - fx.life / fx.max);
  ctx.translate(fx.x, fx.y);
  ctx.scale(fx.s, fx.s);
  ctx.fillStyle = "#F25C84";
  ctx.beginPath();
  ctx.moveTo(0, 3);
  ctx.bezierCurveTo(-8, -4, -3, -8, 0, -4);
  ctx.bezierCurveTo(3, -8, 8, -4, 0, 3);
  ctx.fill();
  ctx.restore();
}

function drawZ(ctx, fx) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - fx.life / fx.max);
  ctx.fillStyle = "#7A8FD4";
  ctx.font = `800 ${18 + fx.s * 0.35}px ui-rounded, "Trebuchet MS", sans-serif`;
  ctx.fillText("Zzz", fx.x, fx.y);
  ctx.restore();
}

function drawChatter(ctx, fx) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - fx.life / fx.max);
  ctx.strokeStyle = "#E07A3A";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(fx.x, fx.y);
  ctx.lineTo(fx.x + 8, fx.y - 4);
  ctx.moveTo(fx.x, fx.y + 5);
  ctx.lineTo(fx.x + 10, fx.y + 3);
  ctx.stroke();
  ctx.restore();
}

function drawZoomLine(ctx, fx) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 0.45 - fx.life);
  ctx.strokeStyle = "#F2C14B";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(fx.x, fx.y);
  ctx.lineTo(fx.x + fx.w, fx.y);
  ctx.stroke();
  ctx.restore();
}

export function previewBackdrop(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#F8DCC8");
  sky.addColorStop(0.62, "#F6D0B6");
  sky.addColorStop(1, "#E7A85A");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.42, w * 0.28, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}
