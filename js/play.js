import { paintCat } from "./kitten.js";
import { clonePose, POSES, POSE_KEYS } from "./poses.js";
import { COAT_ORDER, COATS, EYE_ORDER, EYES, cleanName, swatchBackground } from "./coats.js";
import { PlayAudio } from "./play-audio.js";
import { bakeScene, drawLady, drawMotion } from "./scenery.js";
import { applyClimb, dressLevel, drawBird, drawCans, drawClimbs, drawHazards, nearClimb, nearest, updateCans, updateHazards, birdSheet } from "./hazards.js";

const KEY = "sunbeam-play";
const GROUND = 470;
const PW = 32;
const PH = 58;
const GRAV = 1680;
const JUMP = -650;
const MAXRUN = 255;

const audio = new PlayAudio();
const held = { left: false, right: false, jump: false, scratch: false, fish: false, action: false };
const pressed = { jump: false, scratch: false, fish: false, action: false };

const view = document.querySelector("#view");
const ctx = view.getContext("2d");

function solid(x, y, w, h, kind = "block") {
  return { x, y, w, h, kind };
}

function addFish(list, x, y, golden = false) {
  list.push({ x, y, golden, phase: list.length * 0.47, got: false });
}

function arcFish(list, x0, x1, y, n) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    addFish(list, x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * 58);
  }
}

function lineFish(list, x, y, n, dx = 36) {
  for (let i = 0; i < n; i++) addFish(list, x + dx * i, y);
}

function buildLevel(spec) {
  const fish = spec.placed ? spec.placed.slice() : [];
  if (!fish.length) {
    for (const group of spec.groups || []) {
      if (group.kind === "arc") arcFish(fish, group.x0, group.x1, group.y, group.n);
      else if (group.kind === "line") lineFish(fish, group.x, group.y, group.n, group.dx);
      else addFish(fish, group.x, group.y, Boolean(group.golden));
    }
  }
  return { ...spec, fish, fishValue: fish.length };
}

function course() {
  const solids = [];
  const highs = [];
  const gaps = [];
  const water = [];
  const checkpoints = [];
  let cursor = 0;
  const api = {
    solids, highs, gaps, water, checkpoints,
    get x() { return cursor; },
    floor(w) {
      const span = { x: cursor, w, y: GROUND };
      solids.push(solid(cursor, GROUND, w, 240, "floor"));
      cursor += w;
      return span;
    },
    gap(w) {
      gaps.push({ x: cursor, w });
      cursor += w;
    },
    plat(at, y, w, h, kind) {
      solids.push(solid(at, y, w, Math.max(h, 18), kind));
      highs.push({ x: at + w / 2, y, w });
    },
    decor(span, at, h, w, kind) {
      this.plat(span.x + at, GROUND - h, w, h, kind);
    },
    stairs(n, rise, kind) {
      let px = cursor + 10;
      const pw = 180;
      const stride = 196;
      const step = Math.min(rise, 34);
      for (let i = 0; i < n; i++) {
        this.plat(px, GROUND - step * (i + 1), pw, 18, kind);
        px += stride;
      }
      for (let i = n - 2; i >= 0; i--) {
        this.plat(px, GROUND - step * (i + 1), pw, 18, kind);
        px += stride;
      }
      cursor = px + 12;
    },
    bed() {
      const span = this.floor(250);
      checkpoints.push({ x: span.x + 120, y: GROUND - PH });
    },
    pond(w) {
      const span = this.floor(w);
      water.push({ x: span.x + 40, w: w - 80, y: GROUND - 8 });
      solids.push(solid(span.x + 30, GROUND - 4, w - 60, 36, "pond"));
      return span;
    },
  };
  return api;
}

function floorAt(solids, x) {
  return solids.find((block) => block.kind === "floor" && x >= block.x + 90 && x <= block.x + block.w - 90);
}

function placeFoe(world, kind, frac, width, extra = {}) {
  let spot = 180 + frac * (width - 360);
  for (let hop = 0; hop < 14; hop++) {
    const nearBed = world.checkpoints.some((mark) => Math.abs(mark.x - spot) < 170);
    const floor = floorAt(world.solids, spot);
    const bodyY = kind === "bird" ? 146 : kind === "fish" ? GROUND - 6 : GROUND - 24;
    const blocked = world.solids.some((block) => block.kind !== "floor" && block.kind !== "pond" && spot > block.x + 8 && spot < block.x + block.w - 8 && bodyY > block.y && bodyY < block.y + block.h);
    if (floor && !nearBed && !blocked) {
      const y = kind === "bird" ? 146 : kind === "fish" ? GROUND - 6 : kind === "chicken" || kind === "rooster" ? GROUND - 30 : GROUND - 20;
      world.enemies = world.enemies || [];
      world.enemies.push({
        kind,
        x: spot,
        y,
        min: floor.x + 70,
        max: floor.x + floor.w - 70,
        hp: extra.hp || 1,
        big: Boolean(extra.big),
        home: y,
      });
      return;
    }
    spot += 90;
  }
}

function placeSquirrel(world, frac, width) {
  const want = 200 + frac * (width - 400);
  const plat = world.highs.find((high) => high.y < GROUND - 30 && Math.abs(high.x - want) < 280) || world.highs.find((high) => high.y < GROUND - 30);
  if (!plat) return;
  world.enemies = world.enemies || [];
  world.enemies.push({
    kind: "squirrel",
    x: plat.x,
    y: plat.y - 16,
    min: plat.x - Math.min(36, plat.w / 2 - 8),
    max: plat.x + Math.min(36, plat.w / 2 - 8),
    hp: 1,
    home: plat.y - 16,
  });
}

function placeLeaper(world, index) {
  const pond = world.water[index % Math.max(1, world.water.length)];
  if (!pond) return;
  world.enemies = world.enemies || [];
  world.enemies.push({
    kind: "fish",
    x: pond.x + pond.w * (0.35 + (index % 3) * 0.15),
    y: pond.y + 4,
    min: pond.x + 16,
    max: pond.x + pond.w - 16,
    hp: 1,
    home: pond.y + 4,
  });
}

function stockFish(world, target, ownerX) {
  const fish = [];
  for (const gap of world.gaps) {
    if (gap.w < 80 || gap.w > 160) continue;
    arcFish(fish, gap.x - 6, gap.x + gap.w + 6, GROUND - 24, 4);
  }
  world.solids.filter((block) => block.kind === "floor" && block.w >= 560).forEach((block, index) => {
    if (index % 2 === 0) return;
    lineFish(fish, block.x + 100, GROUND - 34, 4, 36);
  });
  for (const high of world.highs) {
    if (high.y > GROUND - 40) continue;
    addFish(fish, high.x, high.y - 22);
  }
  const open = (x, y) => !world.solids.some((block) => block.kind !== "floor" && block.kind !== "pond" && x >= block.x && x <= block.x + block.w && y >= block.y && y <= block.y + block.h);
  const room = Math.max(0, target - 1);
  const kept = fish.filter((item) => open(item.x, item.y)).slice(0, room);
  const floors = world.solids.filter((block) => block.kind === "floor" && block.w > 220);
  let guard = 0;
  while (kept.length < room && guard < 120) {
    const floor = floors[guard % floors.length];
    const x = floor.x + 70 + (guard * 41) % Math.max(40, floor.w - 140);
    const y = GROUND - 34;
    if (open(x, y) && !kept.some((item) => Math.abs(item.x - x) < 30 && Math.abs(item.y - y) < 24)) addFish(kept, x, y);
    guard += 1;
  }
  addFish(kept, ownerX - 60, GROUND - 120, true);
  return kept;
}

function lay(spec) {
  const world = course();
  world.enemies = [];
  for (const beat of spec.beats) beat(world);
  world.floor(300);
  const width = world.x + 20;
  const owner = { x: width - 130, y: GROUND - 86 };
  spec.cast(world, width);
  for (const enemy of world.enemies) {
    if (enemy.kind === "bird" || enemy.kind === "fish") continue;
    for (let hop = 0; hop < 8; hop++) {
      const buried = world.solids.some((block) => block.kind !== "floor" && block.kind !== "pond" && enemy.x > block.x + 2 && enemy.x < block.x + block.w - 2 && enemy.y > block.y + 2 && enemy.y < block.y + block.h - 2);
      if (!buried) break;
      enemy.x += 36;
    }
  }
  return buildLevel({
    id: spec.id,
    name: spec.name,
    music: spec.music,
    width,
    theme: spec.theme,
    spawn: 70,
    owner,
    checkpoint: world.checkpoints[0] ? world.checkpoints[0].x : 500,
    checkpoints: world.checkpoints,
    water: world.water,
    rod: spec.rod ? spec.rod(world, width) : null,
    solids: world.solids,
    enemies: world.enemies,
    placed: stockFish(world, spec.fish, owner.x),
  });
}

const LEVELS = [
  lay({
    id: "living",
    name: "Living room",
    music: "music-living",
    theme: "living",
    fish: 44,
    beats: [
      (w) => { const s = w.floor(820); w.decor(s, 180, 64, 220, "couch"); w.decor(s, 520, 42, 160, "table"); },
      (w) => w.gap(100),
      (w) => w.floor(680),
      (w) => w.gap(108),
      (w) => { const s = w.floor(740); w.decor(s, 80, 86, 110, "perch"); w.decor(s, 280, 150, 110, "perch"); w.decor(s, 480, 86, 120, "sill"); },
      (w) => w.stairs(3, 42, "step"),
      (w) => w.floor(620),
      (w) => w.bed(),
      (w) => w.floor(700),
      (w) => w.gap(118),
      (w) => { const s = w.floor(640); w.decor(s, 200, 36, 140, "tank"); },
      (w) => w.gap(124),
      (w) => w.stairs(3, 44, "step"),
      (w) => w.floor(860),
      (w) => w.gap(132),
      (w) => w.floor(720),
      (w) => w.gap(116),
      (w) => w.stairs(3, 40, "step"),
      (w) => w.floor(700),
      (w) => w.gap(124),
      (w) => { const s = w.floor(980); w.decor(s, 180, 48, 200, "hearth"); },
    ],
    cast(w) {
      [0.07, 0.16, 0.3, 0.52, 0.66, 0.8, 0.9].forEach((frac) => placeFoe(w, "mouse", frac, w.x));
      [0.22, 0.46, 0.74].forEach((frac) => placeFoe(w, "bird", frac, w.x));
    },
  }),
  lay({
    id: "porch",
    name: "Front porch",
    music: "music-porch",
    theme: "porch",
    fish: 50,
    beats: [
      (w) => { const s = w.floor(760); w.decor(s, 160, 70, 130, "planter"); },
      (w) => w.gap(104),
      (w) => { const s = w.floor(700); w.decor(s, 220, 100, 150, "rail"); },
      (w) => w.gap(112),
      (w) => w.stairs(3, 40, "rail"),
      (w) => w.floor(560),
      (w) => w.bed(),
      (w) => w.pond(460),
      (w) => w.gap(116),
      (w) => { const s = w.floor(680); w.decor(s, 160, 78, 150, "chair"); },
      (w) => w.gap(122),
      (w) => w.floor(640),
      (w) => w.bed(),
      (w) => w.stairs(3, 44, "rail"),
      (w) => w.gap(130),
      (w) => w.floor(700),
      (w) => w.gap(114),
      (w) => w.stairs(3, 40, "rail"),
      (w) => w.floor(680),
      (w) => w.gap(122),
      (w) => { const s = w.floor(900); w.decor(s, 240, 50, 90, "mailbox"); },
    ],
    cast(w) {
      [0.1, 0.4, 0.72].forEach((frac) => placeFoe(w, "mouse", frac, w.x));
      [0.14, 0.28, 0.48, 0.63, 0.82, 0.93].forEach((frac) => placeFoe(w, "bird", frac, w.x));
      [0.2, 0.36, 0.55, 0.7, 0.88].forEach((frac) => placeSquirrel(w, frac, w.x));
      [0, 1].forEach((index) => placeLeaper(w, index));
    },
  }),
  lay({
    id: "yard",
    name: "The yard",
    music: "music-yard",
    theme: "yard",
    fish: 54,
    rod: (w) => ({ x: Math.min(w.x - 400, 2100), y: GROUND - 36 }),
    beats: [
      (w) => w.floor(840),
      (w) => w.gap(106),
      (w) => { const s = w.floor(720); w.decor(s, 180, 70, 170, "branch"); w.decor(s, 460, 120, 150, "branch"); },
      (w) => w.gap(114),
      (w) => w.floor(600),
      (w) => w.bed(),
      (w) => w.pond(520),
      (w) => w.stairs(3, 42, "fence"),
      (w) => w.gap(120),
      (w) => { const s = w.floor(760); w.decor(s, 200, 60, 140, "fence"); },
      (w) => w.bed(),
      (w) => w.gap(126),
      (w) => w.pond(420),
      (w) => w.stairs(4, 40, "branch"),
      (w) => w.gap(134),
      (w) => w.floor(740),
      (w) => w.gap(118),
      (w) => w.stairs(3, 40, "fence"),
      (w) => w.floor(700),
      (w) => w.gap(126),
      (w) => w.floor(980),
    ],
    cast(w) {
      [0.08, 0.58].forEach((frac) => placeFoe(w, "mouse", frac, w.x));
      [0.18, 0.44, 0.76].forEach((frac) => placeFoe(w, "bird", frac, w.x));
      [0.16, 0.34, 0.62, 0.84].forEach((frac) => placeSquirrel(w, frac, w.x));
      [0.12, 0.26, 0.5, 0.68, 0.8, 0.92].forEach((frac) => placeFoe(w, "chicken", frac, w.x));
      [0, 1, 2].forEach((index) => placeLeaper(w, index));
    },
  }),
  lay({
    id: "neighbor",
    name: "Neighbor's house",
    music: "music-neighbor",
    theme: "neighbor",
    fish: 58,
    beats: [
      (w) => { const s = w.floor(780); w.decor(s, 200, 70, 180, "counter"); },
      (w) => w.gap(108),
      (w) => { const s = w.floor(700); w.decor(s, 160, 120, 150, "shelf"); },
      (w) => w.gap(116),
      (w) => w.stairs(3, 42, "cage"),
      (w) => w.floor(560),
      (w) => w.bed(),
      (w) => w.pond(480),
      (w) => w.gap(122),
      (w) => { const s = w.floor(720); w.decor(s, 80, 90, 120, "cage"); w.decor(s, 320, 150, 120, "cage"); w.decor(s, 520, 90, 130, "cage"); },
      (w) => w.bed(),
      (w) => w.stairs(4, 42, "shelf"),
      (w) => w.gap(130),
      (w) => w.pond(400),
      (w) => w.gap(136),
      (w) => w.floor(760),
      (w) => w.gap(120),
      (w) => w.stairs(3, 42, "cage"),
      (w) => w.floor(720),
      (w) => w.gap(128),
      (w) => w.floor(1560),
    ],
    cast(w) {
      [0.06, 0.24, 0.47, 0.7].forEach((frac) => placeFoe(w, "mouse", frac, w.x));
      [0.12, 0.33, 0.58, 0.8].forEach((frac) => placeFoe(w, "bird", frac, w.x));
      [0.18, 0.4, 0.64, 0.86].forEach((frac) => placeSquirrel(w, frac, w.x));
      [0.1, 0.22, 0.38, 0.55, 0.73, 0.88, 0.95].forEach((frac) => placeFoe(w, "chicken", frac, w.x));
      [0, 1, 2].forEach((index) => placeLeaper(w, index));
      placeFoe(w, "rooster", 0.97, w.x, { hp: 2, big: true });
    },
  }),
];

LEVELS.forEach(dressLevel);

function heard(sound) {
  const music = sound && Number(sound.music) > 0 ? Math.max(0, Math.min(1, Number(sound.music))) : 0.6;
  return {
    music,
    musicOn: !sound || sound.musicOn !== false,
    effects: sound && sound.effects != null ? Math.max(0, Math.min(1, Number(sound.effects))) : 0.8,
    effectsOn: !sound || sound.effectsOn !== false,
  };
}

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object") throw new Error("empty");
    return {
      cat: raw.cat || { name: "Miso", gender: "girl", hair: "short", coat: "orange", eyes: "green" },
      sound: heard(raw.sound),
      unlocked: raw.unlocked || 1,
      stars: raw.stars || {},
      rod: Boolean(raw.rod),
      unlockAll: Boolean(raw.unlockAll),
      fishBank: raw.fishBank || 0,
      bestFish: raw.bestFish || {},
    };
  } catch (error) {
    return {
      cat: { name: "Miso", gender: "girl", hair: "short", coat: "orange", eyes: "green" },
      sound: heard(null),
      unlocked: 1,
      stars: {},
      rod: false,
      unlockAll: false,
      fishBank: 0,
      bestFish: {},
    };
  }
}

function saveProgress(progress) {
  localStorage.setItem(KEY, JSON.stringify(progress));
}

function appearance(config) {
  const coat = COATS[config.coat] || COATS.orange;
  const eye = EYES[config.eyes] || EYES.green;
  const lum = parseInt(coat.base.slice(1), 16);
  const bright = ((lum >> 16) & 255) * 0.3 + ((lum >> 8) & 255) * 0.5 + (lum & 255) * 0.2;
  return {
    hair: config.hair === "long" ? "long" : "short",
    gender: config.gender === "boy" ? "boy" : "girl",
    coat,
    eye: eye.color,
    eyeDeep: eye.deep,
    whisker: bright < 90 ? "rgba(255,248,242,0.85)" : "rgba(74,52,40,0.7)",
  };
}

function makeCat(config) {
  return {
    x: 80,
    groundY: GROUND,
    hop: 0,
    facing: 1,
    scale: 1.22,
    app: appearance(config),
    m: clonePose("stand"),
    curl: 0,
    back: 0,
    scratch: 0,
    scratchPhase: 0,
    inBox: false,
    blink: 1,
    squint: 0,
    mouth: "none",
    lick: 0,
    earTwitch: 0,
    earSide: 1,
    tailAmp: 8,
    tailSpeed: 1.6,
    purr: 0,
    squash: 1,
    walkPhase: 0,
    gait: "walk",
    gaitBlend: 0,
    gazeX: 0,
    gazeY: 0,
    excited: 0,
    asleep: false,
    swat: 0,
    drawRot: 0,
    wigglePhase: 0,
    wiggleAmp: 0,
  };
}

function fresh(progress, levelIndex) {
  const level = LEVELS[levelIndex];
  return {
    progress,
    levelIndex,
    level: JSON.parse(JSON.stringify(level)),
    player: {
      x: level.spawn,
      y: GROUND - PH,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      coyote: 0,
      jumpBuf: 0,
      jumpHeld: false,
      scratch: 0,
      clawCd: 0,
      swipeHit: false,
      airJump: false,
      pounce: 0,
      pounceCd: 0,
      food: 0,
      grapple: null,
      mantle: null,
      cling: null,
      clingLock: 0,
      hurt: 0,
      invuln: 0,
      land: 0,
      health: 3,
      pose: "stand",
    },
    cat: makeCat(progress.cat),
    fishGot: 0,
    heartAwarded: false,
    gotRod: progress.rod,
    checkpoint: level.spawn,
    safe: { x: level.spawn, y: GROUND - PH },
    camX: 0,
    camY: 0,
    time: 0,
    shake: 0,
    particles: [],
    shots: [],
    fishing: null,
    won: false,
    mode: "play",
    stars: 0,
    banner: "",
    bannerT: 0,
    tension: 0,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function body(player) {
  return { x: player.x, y: player.y, w: PW, h: PH - 6 };
}

function movePlayer(state, dt, input) {
  const player = state.player;
  const solids = state.level.solids.filter((item) => item.kind !== "pond");
  if (state.fishing) {
    player.vx = 0;
    return;
  }
  const climbMode = applyClimb(state, dt, input, audio);
  if (climbMode === "mantle") {
    if (player.y > 720) hurt(state, "pit");
    return;
  }
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const grip = player.slip == null ? 1 : player.slip;
  if (dir) {
    player.vx += dir * ACCEL * grip * dt;
    player.facing = dir;
  } else {
    const sign = Math.sign(player.vx);
    player.vx -= sign * Math.min(Math.abs(player.vx), 1600 * grip * dt);
  }
  player.vx += (player.wind || 0) * dt;
  const pace = player.food > 0 ? 1.34 : 1;
  player.vx = Math.max(-MAXRUN * pace, Math.min(MAXRUN * pace, player.vx));
  if (climbMode !== "cling") player.x += player.vx * dt;
  else if (player.cling) player.x = player.cling.x - 16;
  player.coyote = player.onGround ? 0.12 : Math.max(0, player.coyote - dt);
  const tapped = input.jumpPressed && !player.prevJump;
  player.prevJump = !!input.jumpPressed;
  if (tapped) {
    const since = state.time - (player.lastJumpTap == null ? -10 : player.lastJumpTap);
    const doublet = since >= 0.04 && since <= 0.3;
    player.lastJumpTap = state.time;
    const justLeft = !player.onGround && (player.leftGround || 0) < 0.12;
    if (doublet && player.pounceCd <= 0 && (pounceTarget(state) || justLeft)) startPounce(state);
    else if (!player.onGround && player.airJump && state.levelIndex >= 1) {
      player.vy = JUMP * 0.88 * (player.food > 0 ? 1.28 : 1);
      player.airJump = false;
      player.jumpBuf = 0;
      for (let i = 0; i < 5; i++) {
        state.particles.push({ x: player.x + 16, y: player.y + 40, vx: (Math.random() - 0.5) * 40, vy: 20, life: 0.3, max: 0.3, kind: "puff", color: "#fff" });
      }
    } else player.jumpBuf = 0.12;
  } else player.jumpBuf = Math.max(0, player.jumpBuf - dt);
  const gravity = !input.jump && player.vy < 0 ? GRAV * 2.15 : GRAV;
  if (climbMode !== "cling") player.vy += gravity * dt;
  const was = player.y;
  player.y += player.vy * dt;
  player.onGround = false;
  for (const block of solids) {
    const feet = player.y + PH;
    const prevFeet = was + PH;
    const overlapX = player.x + PW > block.x + 4 && player.x < block.x + block.w - 4;
    if (player.vy >= 0 && overlapX && prevFeet <= block.y + 8 && feet >= block.y && feet <= block.y + 28) {
      player.y = block.y - PH;
      player.vy = 0;
      player.onGround = true;
      if (!player.wasGround)       player.land = 0.14;
    }
  }
  if (player.jumpBuf > 0 && (player.onGround || player.coyote > 0)) {
    player.vy = JUMP * (player.food > 0 ? 1.28 : 1);
    player.onGround = false;
    player.coyote = 0;
    player.jumpBuf = 0;
    player.squash = 0.8;
    player.airJump = state.levelIndex >= 1;
    audio.meow("kitten");
  }
  if (player.bounce) {
    player.vy = player.bounce;
    player.onGround = false;
    player.bounce = 0;
  }
  player.wasGround = player.onGround;
  if (player.onGround) player.leftGround = 0;
  else player.leftGround = (player.leftGround || 0) + dt;
  if (player.onGround) rememberSafe(state);
  if (player.y > 720) hurt(state, "pit");
}

function surfaceBelow(state, x, feet) {
  const cx = x + PW / 2;
  let best = null;
  for (const block of state.level.solids) {
    if (block.kind === "pond") continue;
    if (cx < block.x + 8 || cx > block.x + block.w - 8) continue;
    if (block.y < feet - 8) continue;
    if (best == null || block.y < best) best = block.y;
  }
  return best;
}

function num(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function hazardUnder(state, x) {
  return (state.level.hazards || []).some((hazard) => hazard.hop && Math.abs(hazard.x - (x + PW / 2)) < 26);
}

function groundedSpot(state, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const feet = y + PH;
  const surface = surfaceBelow(state, x, feet);
  if (surface == null || Math.abs(surface - feet) > 4) return false;
  if (hazardUnder(state, x)) return false;
  return true;
}

function rememberSafe(state) {
  const player = state.player;
  const feet = player.y + PH;
  const surface = surfaceBelow(state, player.x, feet);
  if (surface == null || Math.abs(surface - feet) > 3) return;
  if (hazardUnder(state, player.x)) return;
  const crowded = state.level.enemies.some((enemy) => enemy.alive !== false && !enemy.flee && Math.abs(enemy.x - (player.x + PW / 2)) < 64 && Math.abs(enemy.y - player.y) < 48);
  if (crowded) return;
  state.safe = { x: player.x, y: player.y };
}

function respawn(state) {
  const player = state.player;
  const start = { x: state.level.spawn, y: GROUND - PH };
  const candidates = [];
  if (state.safe) candidates.push(state.safe);
  for (const mark of (state.level.checkpoints || []).slice(0, 8)) candidates.push({ x: mark.x - 16, y: GROUND - PH });
  candidates.push(start);
  let spot = start;
  for (let i = 0; i < candidates.length && i < 12; i++) {
    if (groundedSpot(state, candidates[i].x, candidates[i].y)) {
      spot = candidates[i];
      break;
    }
  }
  player.x = spot.x;
  player.y = spot.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.wasGround = true;
  player.invuln = 1.7;
  player.hurt = 0.25;
  player.scratch = 0;
  player.swipeHit = false;
  player.pounce = 0;
  player.grapple = null;
  player.airJump = false;
  player.bounce = 0;
  player.mantle = null;
  player.cling = null;
  player.clingLock = 0;
  player.wind = 0;
  state.fishing = null;
  state.snapCam = true;
  state.respawned = true;
  state.pitTime = 0;
  state.banner = "Back on solid ground";
  state.bannerT = 1.3;
}

function sanitize(state, dt) {
  const player = state.player;
  const spawnX = state.level.spawn;
  player.x = num(player.x, spawnX);
  player.y = num(player.y, GROUND - PH);
  player.vx = Math.max(-900, Math.min(900, num(player.vx, 0)));
  player.vy = Math.max(-1400, Math.min(2200, num(player.vy, 0)));
  player.x = Math.max(-200, Math.min(state.level.width + 200, player.x));
  if (player.y > 1400) player.y = 1400;
  state.camX = num(state.camX, 0);
  state.camY = num(state.camY, 0);
  if (player.y > GROUND + 48) state.pitTime = (state.pitTime || 0) + dt;
  else state.pitTime = 0;
  if (state.pitTime > 1.5) respawn(state);
}

const ACCEL = 1700;

const SWIPE = 0.58;
const SWIPE_CD = 0.22;

function attackBox(player) {
  const reach = 58;
  return {
    x: player.facing > 0 ? player.x + PW - 8 : player.x - reach + 6,
    y: player.y - 16,
    w: reach,
    h: 68,
  };
}

function shoo(state, enemy) {
  enemy.alive = false;
  enemy.flee = 1;
  enemy.vy = -220;
  enemy.vx = playerDirAway(state.player, enemy) * 180;
  audio.tweet();
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      x: enemy.x,
      y: enemy.y,
      vx: (Math.random() - 0.5) * 140,
      vy: -40 - Math.random() * 80,
      life: 0.5,
      max: 0.5,
      kind: i % 2 ? "star" : "puff",
      color: i % 2 ? "#ffe08a" : "#fff8f2",
    });
  }
}

function playerDirAway(player, enemy) {
  return enemy.x >= player.x ? 1 : -1;
}

function hurt(state, knock) {
  const player = state.player;
  if (state.won) return;
  if (knock === "pit") {
    if (player.invuln <= 0) {
      player.health -= 1;
      if (player.health <= 0) player.health = 3;
      state.shake = 7;
      audio.sting("music-hurt");
      audio.yowl();
    }
    respawn(state);
    return;
  }
  if (player.invuln > 0) return;
  player.health -= 1;
  state.shake = 7;
  audio.sting("music-hurt");
  audio.yowl();
  if (player.health <= 0) {
    player.health = 3;
    respawn(state);
    return;
  }
  player.invuln = 1.15;
  player.hurt = 0.35;
  player.vy = -280;
  player.vx = typeof knock === "number" ? knock : -player.facing * 160;
}

function collectFish(state, fish) {
  if (fish.got) return;
  fish.got = true;
  const bank = fish.golden ? 3 : 1;
  if (!fish.bonus) state.fishGot += 1;
  if (state.player.food > 0 && !fish.bonus) {
    state.fishGot += 1;
    state.progress.fishBank += 1;
  }
  state.progress.fishBank += bank;
  audio.ding(fish.golden);
  state.particles.push({
    x: fish.x,
    y: fish.y,
    vx: 0,
    vy: -30,
    life: 0.45,
    max: 0.45,
    kind: "spark",
    color: fish.golden ? "#f0b429" : "#9ee7ff",
  });
  if (!fish.bonus && !state.heartAwarded && state.fishGot >= state.level.fishValue) {
    state.heartAwarded = true;
    state.player.health = Math.min(5, state.player.health + 1);
    state.banner = "Every fish. Extra life.";
    state.bannerT = 1.6;
  }
  if (state.progress.fishBank >= 80) {
    state.progress.fishBank -= 80;
    state.player.health = Math.min(5, state.player.health + 1);
    state.banner = "80 fish. Another life.";
    state.bannerT = 1.8;
  }
}

function updateFish(state, dt) {
  const player = state.player;
  for (const fish of state.level.fish) {
    if (fish.got) continue;
    const dx = fish.x - (player.x + PW / 2);
    const dy = fish.y - (player.y + PH / 2);
    if (dx * dx + dy * dy < 32 * 32) collectFish(state, fish);
  }
}

function cue(enemy, dt, fn) {
  enemy.voice = (enemy.voice || 0) - dt;
  if (enemy.voice > 0) return;
  enemy.voice = 2.4;
  fn();
}

function updateEnemies(state, dt) {
  const player = state.player;
  let nearest = 9999;
  for (const enemy of state.level.enemies) {
    if (enemy.flee) {
      enemy.flee -= dt;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.vy += 500 * dt;
      continue;
    }
    if (enemy.alive === false) continue;
    enemy.t = (enemy.t || 0) + dt;
    const home = enemy.home == null ? enemy.y : enemy.home;
    if (enemy.stun > 0) {
      enemy.stun -= dt;
      enemy.x += (enemy.vx || 0) * dt;
      enemy.vx *= 0.9;
    } else if (enemy.kind === "mouse") {
      enemy.dir = enemy.dir || 1;
      enemy.x += enemy.dir * 96 * dt;
      if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.dir *= -1;
      enemy.y = home + Math.abs(Math.sin(enemy.t * 14)) * -6;
      if (Math.abs(player.x - enemy.x) < 200) cue(enemy, dt, () => audio.squeak());
    } else if (enemy.kind === "bird") {
      enemy.baseY = enemy.baseY || home;
      const dx = player.x - enemy.x;
      if (!enemy.dive && Math.abs(dx) < 170 && Math.abs(dx) > 36 && enemy.t > (enemy.wait || 0)) {
        enemy.dive = "warn";
        enemy.warn = 0.48;
        enemy.tx = player.x + 36;
        audio.tweet();
      }
      if (enemy.dive === "warn") {
        enemy.warn -= dt;
        enemy.y = enemy.baseY + Math.sin(enemy.t * 22) * 5;
        if (enemy.warn <= 0) enemy.dive = "go";
      } else if (enemy.dive === "go") {
        enemy.y += 260 * dt;
        enemy.x += (enemy.tx - enemy.x) * 3 * dt;
        if (enemy.y > GROUND - 36) {
          enemy.dive = null;
          enemy.y = enemy.baseY;
          enemy.wait = enemy.t + 2.4;
        }
      } else {
        enemy.x += Math.sin(enemy.t * 1.3) * 22 * dt;
        enemy.y = enemy.baseY + Math.sin(enemy.t * 2.1) * 14;
      }
    } else if (enemy.kind === "squirrel") {
      enemy.dir = enemy.dir || 1;
      enemy.x += enemy.dir * 70 * dt;
      if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.dir *= -1;
      enemy.cool = (enemy.cool == null ? 1.4 : enemy.cool) - dt;
      enemy.wind = Math.max(0, (enemy.wind || 0) - dt);
      if (enemy.cool <= 0 && Math.abs(player.x - enemy.x) < 320) {
        enemy.wind = 0.28;
        enemy.cool = 2.6;
        audio.chatter();
      }
      if (enemy.wind > 0 && enemy.wind < 0.04) {
        const dir = player.x >= enemy.x ? 1 : -1;
        state.shots.push({ x: enemy.x, y: enemy.y - 4, vx: dir * 150, vy: -120, life: 1.7 });
        enemy.wind = 0;
      }
    } else if (enemy.kind === "fish") {
      const leap = Math.sin(enemy.t * 2.2);
      const rising = leap > 0.2;
      if (rising && !enemy.up) audio.splash();
      enemy.up = rising;
      enemy.y = home - Math.max(0, leap) * 64;
    } else if (enemy.kind === "chicken" || enemy.kind === "rooster") {
      const reach = enemy.kind === "rooster" ? 230 : 150;
      const close = Math.abs(player.x - enemy.x) < reach;
      enemy.dir = enemy.dir || 1;
      enemy.phase = enemy.phase || "strut";
      if (!close && enemy.phase !== "charge") enemy.phase = "strut";
      if (enemy.phase === "strut") {
        enemy.x += enemy.dir * (enemy.kind === "rooster" ? 34 : 40) * dt;
        if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.dir *= -1;
        if (close) {
          enemy.phase = "wind";
          enemy.wind = enemy.kind === "rooster" ? 0.55 : 0.28;
          enemy.dir = player.x > enemy.x ? 1 : -1;
          if (enemy.kind === "rooster") audio.crow();
          else audio.cluck();
        }
      } else if (enemy.phase === "wind") {
        enemy.wind -= dt;
        if (enemy.wind <= 0) {
          enemy.phase = "charge";
          enemy.charge = enemy.kind === "rooster" ? 0.7 : 0.42;
        }
      } else {
        const speed = enemy.kind === "rooster" ? 145 : 108;
        enemy.x += enemy.dir * speed * dt;
        enemy.charge -= dt;
        if (enemy.charge <= 0) enemy.phase = "strut";
      }
      enemy.x = Math.max(enemy.min, Math.min(enemy.max, enemy.x));
      enemy.y = home + Math.abs(Math.sin(enemy.t * 14)) * -6;
    }
    nearest = Math.min(nearest, Math.abs(enemy.x - player.x));
    const scale = enemy.big ? 1.4 : 1;
    const box = { x: enemy.x - 16 * scale, y: enemy.y - 16 * scale, w: 36 * scale, h: 32 * scale };
    const reach = player.food > 0 ? 84 : 70;
    const lunge = {
      x: player.facing > 0 ? player.x + 4 : player.x - reach + 8,
      y: player.y + 4,
      w: reach,
      h: 54,
    };
    const stomp = player.vy > 90 && player.y + PH < enemy.y + 10 && rectsOverlap({ x: player.x, y: player.y + PH - 12, w: PW, h: 16 }, box);
    if (stomp || (player.pounce > 0 && rectsOverlap(lunge, box))) {
      enemy.hp = player.food > 0 ? 0 : (enemy.hp || 1) - 1;
      player.vy = -300;
      if (enemy.hp <= 0) shoo(state, enemy);
      continue;
    }
    if (player.swipeHit && rectsOverlap(attackBox(player), box)) {
      enemy.hp = player.food > 0 ? 0 : (enemy.hp || 1) - 1;
      if (enemy.hp <= 0) shoo(state, enemy);
      else {
        enemy.stun = 0.6;
        enemy.vx = player.facing * -160;
        enemy.dive = null;
        audio.tweet();
        state.particles.push({ x: enemy.x, y: enemy.y, vx: 0, vy: -20, life: 0.35, max: 0.35, kind: "star", color: "#fff3b0" });
      }
      continue;
    }
    if (enemy.stun > 0) continue;
    if (player.invuln <= 0 && rectsOverlap(body(player), box)) hurt(state, enemy.x < player.x ? 180 : -180);
  }
  state.tension = nearest < 240 ? 1 - nearest / 240 : 0;
  state.shots = state.shots.filter((shot) => {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.vy += 400 * dt;
    if (player.invuln <= 0 && Math.hypot(shot.x - player.x, shot.y - player.y) < 24) {
      hurt(state, shot.vx > 0 ? 140 : -140);
      return false;
    }
    return shot.life > 0 && shot.y < GROUND;
  });
}

function updatePose(state, dt) {
  const player = state.player;
  const cat = state.cat;
  let pose = "stand";
  if (state.won) pose = "sit";
  else if (player.hurt > 0) pose = "sit";
  else if (!player.onGround && player.vy < 0) pose = "pounce";
  else if (!player.onGround) pose = "stretch";
  else if (Math.abs(player.vx) > 150) pose = "run";
  else if (Math.abs(player.vx) > 20) pose = "walk";
  player.pose = pose;
  const target = POSES[pose] || POSES.stand;
  for (const key of POSE_KEYS) cat.m[key] += (target[key] - cat.m[key]) * Math.min(1, dt * 8);
  const swiping = player.scratch > 0;
  cat.upright = swiping;
  cat.scratch = 0;
  if (swiping) {
    const along = 1 - player.scratch / SWIPE;
    cat.rise = along < 0.18 ? along / 0.18 : along < 0.78 ? 1 : Math.max(0, 1 - (along - 0.78) / 0.22);
    cat.scratchPhase += dt * 6.5;
    player.swipeHit = along > 0.16 && along < 0.8;
  } else {
    cat.rise = 0;
    player.swipeHit = false;
  }
  cat.x = player.x + PW / 2;
  cat.groundY = player.y + PH;
  cat.hop = 0;
  cat.hideShadow = true;
  cat.facing = player.facing;
  cat.squash += ((player.land > 0 ? 0.72 : 1) - cat.squash) * Math.min(1, dt * 10);
  cat.gait = pose === "run" ? "gallop" : "walk";
  cat.gaitBlend += ((pose === "run" || pose === "walk" ? 1 : 0) - cat.gaitBlend) * Math.min(1, dt * 6);
  cat.walkPhase = (cat.walkPhase + Math.abs(player.vx) * dt * 0.01) % 1;
  cat.drawRot = swiping ? 0 : (pose === "stretch" ? 0.25 : 0);
  cat.swat = swiping ? 1 : 0;
  cat.purr = state.won ? 1 : Math.max(0, cat.purr - dt);
  cat.mouth = player.hurt > 0 ? "meow" : "none";
  cat.squint = player.hurt > 0 ? 1 : 0;
  cat.tailAmp = pose === "run" ? 12 : 7;
  cat.tailSpeed = pose === "run" ? 6 : 1.5;
  if (player.land > 0) player.land -= dt;
  if (player.scratch > 0) player.scratch = Math.max(0, player.scratch - dt);
  if (player.pounce > 0) player.pounce = Math.max(0, player.pounce - dt);
  if (player.clawCd > 0) player.clawCd = Math.max(0, player.clawCd - dt);
  if (player.hurt > 0) player.hurt -= dt;
  if (player.invuln > 0) player.invuln -= dt;
}

function tryFish(state) {
  if (!state.gotRod || state.fishing) return;
  const spot = state.level.water.find((water) => {
    const px = state.player.x + PW / 2;
    return px > water.x - 30 && px < water.x + water.w + 30;
  });
  if (!spot) {
    state.banner = "The rod wants water.";
    state.bannerT = 1;
    return;
  }
  state.fishing = { t: 0, bite: 0.8 + Math.random() * 0.9, caught: false, spot };
  audio.sting("music-sting");
  state.banner = "Wait for the tug, then tap Jump.";
  state.bannerT = 1.2;
}

function updateFishing(state, dt, input) {
  const fish = state.fishing;
  if (!fish) return;
  fish.t += dt;
  if (!fish.caught && input.jumpPressed && fish.t > fish.bite && fish.t < fish.bite + 0.42) {
    fish.caught = true;
    const prize = { x: state.player.x + 20, y: state.player.y - 10, golden: Math.random() < 0.25, phase: 0, got: false, bonus: true };
    collectFish(state, prize);
    state.banner = prize.golden ? "A golden fish on the line." : "A fish on the line.";
    state.bannerT = 1.2;
    audio.meow("kitten");
  } else if (!fish.caught && fish.t > fish.bite + 0.42) {
    state.banner = "It slipped away.";
    state.bannerT = 1;
    state.fishing = null;
  } else if (fish.caught && fish.t > fish.bite + 0.7) {
    state.fishing = null;
  }
}

function finish(state) {
  if (state.won) return;
  state.won = true;
  state.mode = "complete";
  const ratio = state.fishGot / Math.max(1, state.level.fishValue);
  state.stars = ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1;
  const prev = state.progress.stars[state.level.id] || 0;
  state.progress.stars[state.level.id] = Math.max(prev, state.stars);
  state.progress.bestFish[state.level.id] = Math.max(state.progress.bestFish[state.level.id] || 0, state.fishGot);
  state.progress.unlocked = Math.max(state.progress.unlocked, state.levelIndex + 2);
  if (state.level.rod) state.progress.rod = true;
  saveProgress(state.progress);
  audio.setPurr(true);
  audio.sting("music-fanfare");
  audio.playMusic("music-inside");
  audio.meow("greet");
  showComplete(state);
}

function step(state, dt, input) {
  if (state.mode !== "play" || state.won) return;
  state.time += dt;
  const player = state.player;
  if (input.scratchPressed && player.scratch <= 0 && player.clawCd <= 0) {
    player.scratch = SWIPE;
    player.clawCd = SWIPE + SWIPE_CD;
    audio.scratch();
  }
  if (input.actionPressed) useAction(state);
  if (input.fishPressed) tryFish(state);
  const field = updateHazards(state, dt, audio);
  player.slip = field.slip;
  player.wind = field.wind;
  if (field.bounce) player.bounce = field.bounce;
  if (state._poke) {
    const knock = state._poke;
    state._poke = 0;
    hurt(state, knock);
  }
  updateCans(state, dt, audio);
  if (!state.hintedJump && player.onGround && state.time > 0.4) {
    state.hintedJump = true;
    state.banner = state.levelIndex >= 1
      ? "Double-tap Jump to pounce. In the air, a clear second tap double-jumps."
      : "Double-tap Jump to pounce.";
    state.bannerT = 2.4;
  }
  if (state.fishing) updateFishing(state, dt, input);
  else movePlayer(state, dt, input);
  updateFish(state, dt);
  updateEnemies(state, dt);
  updatePose(state, dt);
  const owner = state.level.owner;
  if (player.x + PW > owner.x && player.y + PH > owner.y) finish(state);
  for (const mark of state.level.checkpoints || []) {
    if (mark.got || !player.onGround) continue;
    if (Math.abs(player.x + PW / 2 - mark.x) < 40) {
      mark.got = true;
      state.safe = { x: mark.x - 16, y: GROUND - PH };
      state.banner = "A soft place to land.";
      state.bannerT = 1.4;
    }
  }
  if (!state.gotRod && state.level.rod && Math.abs(player.x - state.level.rod.x) < 36) {
    state.gotRod = true;
    state.progress.rod = true;
    saveProgress(state.progress);
    state.banner = "A fishing rod. Find water.";
    state.bannerT = 2;
    audio.meow("curious");
  }
  state.bannerT = Math.max(0, state.bannerT - dt);
  state.shake = Math.max(0, state.shake - dt * 12);
  sanitize(state, dt);
  audio.setTension(state.tension);
  for (const bit of state.particles) {
    bit.life -= dt;
    bit.x += (bit.vx || 0) * dt;
    bit.y += (bit.vy || 0) * dt;
  }
  state.particles = state.particles.filter((bit) => bit.life > 0);
}

function policy(state) {
  const player = state.player;
  const ahead = player.x + PW + 28;
  const feet = player.y + PH;
  const supported = state.level.solids.some((block) => {
    if (block.kind === "pond") return false;
    return ahead > block.x && ahead < block.x + block.w && block.y >= feet - 6 && block.y < feet + 150;
  });
  const floorAhead = state.level.solids.some((block) => block.kind === "floor" && ahead > block.x && ahead < block.x + block.w && Math.abs(block.y - feet) < 10);
  const wall = !floorAhead && state.level.solids.some((block) => {
    if (block.kind === "pond" || block.kind === "floor") return false;
    return rectsOverlap({ x: player.x + PW, y: player.y + 8, w: 10, h: PH - 20 }, block);
  });
  const foe = state.level.enemies.some((enemy) => enemy.alive !== false && !enemy.flee && enemy.x > player.x - 10 && enemy.x < player.x + 92 && Math.abs(enemy.y - player.y) < 70);
  const hopper = state.level.enemies.some((enemy) => enemy.alive !== false && !enemy.flee && (enemy.stun || 0) <= 0 && ["mouse", "chicken", "rooster", "squirrel"].includes(enemy.kind) && enemy.x > player.x + 6 && enemy.x < player.x + 84 && Math.abs(enemy.y - player.y) < 54);
  const needJump = player.onGround && (!supported || wall || hopper);
  const holdJump = !player.onGround && player.vy < 0;
  const rising = state.level.solids.some((block) => block.kind !== "pond" && block.x > player.x + 10 && block.x < player.x + 150 && block.y < feet - 24);
  const air = state.levelIndex >= 1 && !player.onGround && player.airJump && player.vy > 40 && rising;
  return {
    right: true,
    left: false,
    jump: needJump || holdJump || air,
    jumpPressed: needJump || air,
    scratch: foe,
    scratchPressed: foe,
    fish: false,
    fishPressed: false,
    action: false,
    actionPressed: false,
  };
}

function pounceTarget(state) {
  const player = state.player;
  const reach = 110;
  const ahead = (x) => player.facing > 0 ? x > player.x - 12 && x < player.x + reach : x < player.x + PW + 12 && x > player.x - reach;
  const enemy = state.level.enemies.some((item) => item.alive !== false && !item.flee && ahead(item.x) && Math.abs(item.y - player.y) < 78);
  const hazard = (state.level.hazards || []).some((item) => item.hop && ahead(item.x));
  return enemy || hazard;
}

function startPounce(state) {
  const player = state.player;
  player.pounce = 0.26;
  player.pounceCd = 0.42;
  player.vx = player.facing * (player.food > 0 ? 460 : 360);
  player.vy = Math.min(player.vy, -140);
  player.onGround = false;
  player.airJump = false;
  player.jumpBuf = 0;
  audio.scratch();
  for (let i = 0; i < 6; i++) {
    state.particles.push({
      x: player.x + player.facing * 20,
      y: player.y + 24,
      vx: player.facing * 40,
      vy: -20 - Math.random() * 30,
      life: 0.28,
      max: 0.28,
      kind: "spark",
      color: "#fff6ea",
    });
  }
}

function useAction(state) {
  const player = state.player;
  const post = nearest(state.level, "post", player.x + 16, 28);
  const hook = nearest(state.level, "hook", player.x + 16, 90);
  if (nearClimb(state)) return;
  if (post) {
    player.vy = -220;
    player.x = post.x - 16;
    state.banner = "Scratch up the post.";
    state.bannerT = 0.8;
    return;
  }
  if (hook) {
    player.grapple = { x: hook.x, y: GROUND - 130, life: 0.7 };
    state.banner = "The yarn holds.";
    state.bannerT = 0.8;
  }
}

function simulate(id) {
  const progress = {
    cat: { name: "Miso", gender: "girl", hair: "short", coat: "orange", eyes: "green" },
    sound: { music: 0, musicOn: false, effects: 0, effectsOn: false },
    unlocked: 4,
    stars: {},
    rod: false,
    unlockAll: true,
    fishBank: 0,
    bestFish: {},
  };
  const index = LEVELS.findIndex((level) => level.id === id);
  const state = fresh(progress, index);
  state.mode = "play";
  const dt = 1 / 60;
  let frames = 0;
  while (frames < 60 * 150 && !state.won && state.player.health > 0) {
    step(state, dt, policy(state));
    frames += 1;
  }
  return { id, won: state.won, x: Math.round(state.player.x), health: state.player.health, fish: state.fishGot, total: state.level.fishValue, frames };
}

function planted(state) {
  const feet = state.player.y + PH;
  const surface = surfaceBelow(state, state.player.x, feet);
  return surface != null && Math.abs(surface - feet) < 2 && state.player.vy === 0;
}

function still() {
  return { left: false, right: false, jump: false, jumpPressed: false, scratch: false, scratchPressed: false, fish: false, fishPressed: false };
}

function testPit(id = "living") {
  const progress = {
    cat: { name: "Miso", gender: "girl", hair: "short", coat: "orange", eyes: "green" },
    sound: { music: 0, musicOn: false, effects: 0, effectsOn: false },
    unlocked: 4, stars: {}, rod: true, unlockAll: true, fishBank: 0, bestFish: {},
  };
  const index = LEVELS.findIndex((level) => level.id === id);
  const state = fresh(progress, index);
  state.mode = "play";
  const dt = 1 / 60;
  for (let i = 0; i < 20; i++) step(state, dt, still());
  const start = { x: state.player.x, y: state.player.y, planted: planted(state) };
  const floors = state.level.solids.filter((block) => block.kind === "floor").sort((a, b) => a.x - b.x);
  const gap = floors[0].x + floors[0].w + 30;
  state.player.x = gap;
  state.player.y = GROUND - PH - 20;
  state.player.vy = 80;
  state.player.onGround = false;
  let fell = false;
  for (let i = 0; i < 240; i++) {
    step(state, dt, still());
    if (state.respawned) {
      fell = true;
      break;
    }
  }
  state.fishing = { t: 0, bite: 10, caught: false, spot: state.level.water[0] || { x: state.player.x, w: 40, y: state.player.y } };
  for (let i = 0; i < 8; i++) step(state, dt, still());
  state.fishing = null;
  const afterFish = planted(state);
  state.player.health = 1;
  state.player.invuln = 0;
  hurt(state, -80);
  const afterHit = planted(state);
  return {
    id,
    fell,
    startPlanted: start.planted,
    afterFish,
    afterHit,
    grounded: planted(state),
    vy: state.player.vy,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    safeX: Math.round(state.safe.x),
    invuln: state.player.invuln > 0,
  };
}

const palette = {
  living: { sky0: "#ffb15a", sky1: "#ffe0a8", sky2: "#fff6df", sun: "#fff3c4", hill: "#f08a4b", floor: "#e0903a", couch: "#d23d55", table: "#f2c14b", shelf: "#7d5cff", sill: "#3ecf8e", hearth: "#c45a3a", rug: "#e4578b" },
  porch: { sky0: "#2eb6f2", sky1: "#9ae7ff", sky2: "#fff1b0", sun: "#fff6c8", hill: "#ff8f4a", floor: "#ef8a32", couch: "#ff5d8f", table: "#7c5cff", shelf: "#3ecf8e", sill: "#ffd23f", hearth: "#f27d3a", rug: "#5ad7a5" },
  yard: { sky0: "#3ec8ff", sky1: "#b8f08a", sky2: "#fff4b0", sun: "#fff6c2", hill: "#49c45a", floor: "#d4893a", couch: "#ff5d8f", table: "#ffe14a", shelf: "#3ecf6e", sill: "#7ed957", hearth: "#2f9e44", rug: "#ff8a3d" },
  neighbor: { sky0: "#5a3d8c", sky1: "#e36a3a", sky2: "#ffb15a", sun: "#ffd29a", hill: "#c44b7a", floor: "#6d4b86", couch: "#ff7a45", table: "#f2c14b", shelf: "#8d6cff", sill: "#ff8fb8", hearth: "#ffb15a", rug: "#3ec6c0" },
};

function blockColor(theme, kind) {
  const colors = palette[theme];
  if (kind === "couch") return colors.couch;
  if (kind === "table" || kind === "chair") return colors.table;
  if (kind === "shelf" || kind === "perch" || kind === "cage") return colors.shelf;
  if (kind === "sill" || kind === "planter" || kind === "rail") return colors.sill;
  if (kind === "hearth" || kind === "step" || kind === "mailbox") return colors.hearth;
  if (kind === "branch" || kind === "fence") return colors.hill;
  if (kind === "tank") return "#2f86c9";
  return colors.floor;
}

function bake(level) {
  return bakeScene(level);
}

function drawFish(g, fish, time) {
  if (fish.got) return;
  const bob = Math.sin(time * 3 + fish.phase) * 5;
  g.save();
  g.translate(fish.x, fish.y + bob);
  g.rotate(Math.sin(time * 2 + fish.phase) * 0.4);
  const glow = g.createRadialGradient(0, 0, 2, 0, 0, 20);
  glow.addColorStop(0, fish.golden ? "rgba(255,214,80,0.85)" : "rgba(150,220,255,0.8)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, 20, 0, Math.PI * 2);
  g.fill();
  const body = g.createLinearGradient(-12, -7, 12, 8);
  if (fish.golden) {
    body.addColorStop(0, "#fff6c4");
    body.addColorStop(0.5, "#f2c14b");
    body.addColorStop(1, "#e07a3d");
  } else {
    body.addColorStop(0, "#f4fdff");
    body.addColorStop(0.4, "#7fd4f5");
    body.addColorStop(1, "#2f86c9");
  }
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(1, 0, 12, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-8, 0);
  g.quadraticCurveTo(-16, -7, -15, 0);
  g.quadraticCurveTo(-16, 7, -8, 0);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.beginPath();
  g.ellipse(-1, -2.2, 4.5, 2, -0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1d2430";
  g.beginPath();
  g.arc(6, -1, 1.3, 0, Math.PI * 2);
  g.fill();
  if (!fish.enemy) {
    g.save();
    g.rotate(time * 3 + (fish.phase || 0));
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(10, -1, 5, 2);
    g.restore();
  }
  g.restore();
}

function drawEnemy(g, enemy, time) {
  if (enemy.alive === false && !enemy.flee) return;
  g.save();
  g.globalAlpha = enemy.flee ? Math.max(0, enemy.flee) : 1;
  g.translate(enemy.x, enemy.y);
  g.shadowColor = "rgba(28,16,10,0.4)";
  g.shadowBlur = 8;
  g.shadowOffsetY = 3;
  if (enemy.big) g.scale(1.35, 1.35);
  if (enemy.kind === "mouse") {
    g.fillStyle = "#d8b89a";
    g.beginPath();
    g.ellipse(0, 1, 13, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f3d2c6";
    g.beginPath();
    g.ellipse(6, 2, 5, 3.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e7a090";
    g.beginPath();
    g.arc(9, -3, 3.1, 0, Math.PI * 2);
    g.arc(4, -4, 2.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#c47a8a";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-12, 2);
    g.quadraticCurveTo(-20, 8, -16, -4);
    g.stroke();
    g.fillStyle = "#2a211c";
    g.beginPath();
    g.arc(8, 0, 1, 0, Math.PI * 2);
    g.fill();
  } else if (enemy.kind === "bird") {
    drawBird(g, enemy, time);
  } else if (enemy.kind === "squirrel") {
    g.fillStyle = "#d4843c";
    g.beginPath();
    g.ellipse(0, 2, 12, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2c9a0";
    g.beginPath();
    g.ellipse(4, 4, 5, 3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e39a55";
    g.beginPath();
    g.ellipse(-12, -6, 7, 11, -0.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1d2430";
    g.beginPath();
    g.arc(6, 0, 1.1, 0, Math.PI * 2);
    g.fill();
  } else if (enemy.kind === "fish") {
    drawFish(g, { x: 0, y: 0, golden: false, phase: enemy.t || 0, got: false, enemy: true }, time);
  } else if (enemy.kind === "chicken" || enemy.kind === "rooster") {
    const rooster = enemy.kind === "rooster";
    g.fillStyle = rooster ? "#f0a03a" : "#f7f1e6";
    g.beginPath();
    g.ellipse(0, 2, rooster ? 16 : 14, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f4efe4";
    g.beginPath();
    g.arc(10, -2, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e23b3b";
    g.beginPath();
    g.ellipse(10, -8, 3.2, rooster ? 6 : 3.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2c14b";
    g.beginPath();
    g.moveTo(15, -2);
    g.lineTo(20, 0);
    g.lineTo(15, 2);
    g.fill();
    if (rooster) {
      g.strokeStyle = "#8a3d2a";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-12, 0);
      g.quadraticCurveTo(-20, -12, -14, -16);
      g.stroke();
    }
    g.strokeStyle = "#e0a050";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(-2, 10);
    g.lineTo(-4, 14);
    g.moveTo(4, 10);
    g.lineTo(6, 14);
    g.stroke();
  }
  g.restore();
}

function drawCheckpoint(g, mark, time) {
  g.save();
  g.translate(mark.x, GROUND);
  g.fillStyle = mark.got ? "#f2c14b" : "#e07a3d";
  g.fillRect(-2, -46, 4, 46);
  g.beginPath();
  g.moveTo(2, -46);
  g.lineTo(22, -38 + Math.sin(time * 3) * 2);
  g.lineTo(2, -30);
  g.fill();
  g.fillStyle = "#f7c6d0";
  g.beginPath();
  g.ellipse(0, -2, 22, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff6ea";
  g.beginPath();
  g.ellipse(-6, -6, 8, 5, -0.3, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawCatShadow(g, state) {
  const feet = state.player.y + PH;
  const surface = surfaceBelow(state, state.player.x, feet);
  state.shadowY = surface;
  if (surface == null) return;
  const height = Math.max(0, surface - feet);
  const lift = Math.min(1, height / 150);
  g.save();
  g.translate(state.player.x + PW / 2, surface + 3);
  g.globalAlpha = 0.42 * (1 - lift * 0.72);
  g.fillStyle = "#3a2418";
  g.beginPath();
  g.ellipse(0, 0, (20 - lift * 9) * state.cat.scale, (6.5 - lift * 2.2) * state.cat.scale, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawRug(g, x, y, w, h, color, stripe) {
  g.save();
  g.translate(x, y);
  round(g, -w / 2, -h / 2, w, h, 12);
  g.fillStyle = color;
  g.fill();
  g.fillStyle = stripe;
  for (let i = -3; i <= 3; i++) g.fillRect(i * (w / 8) - 4, -h / 2 + 5, 7, h - 10);
  g.restore();
}

function drawFlower(g, x, y, petal, center, time, index) {
  const sway = Math.sin(time * 1.15 + index) * 3;
  g.strokeStyle = "#2f8a3a";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, y + 18);
  g.quadraticCurveTo(x + sway * 0.4, y + 8, x + sway, y);
  g.stroke();
  g.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    g.beginPath();
    g.ellipse(x + sway + Math.cos(angle) * 6, y + Math.sin(angle) * 6, 4.4, 3.1, angle, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = center;
  g.beginPath();
  g.arc(x + sway, y, 3.1, 0, Math.PI * 2);
  g.fill();
}

function drawScenery(g, level, time, camX, viewW) {
  if (level.theme === "living") return;
  const petals = level.theme === "yard"
    ? ["#ff5d8f", "#ffe14a", "#ff8a3d", "#ffffff", "#7c5cff"]
    : level.theme === "neighbor"
      ? ["#ff8fb8", "#ffd29a", "#c9a0ff", "#ffb15a", "#7ee0d6"]
      : ["#ff5d8f", "#ffd23f", "#7c5cff", "#ff8a3d", "#ffffff"];
  const centers = ["#fff6c2", "#ff8a3d", "#ffe14a", "#ff5d8f", "#fff"];
  const first = Math.max(0, Math.floor((camX - 40) / 160));
  const last = Math.ceil((camX + viewW + 40) / 160);
  for (let i = first; i <= last; i++) {
    const x = 80 + i * 160;
    drawFlower(g, x, GROUND - 16 - (i % 3) * 4, petals[i % petals.length], centers[i % centers.length], time, i);
  }
}

function drawOwner(g, owner, time, theme, reunion) {
  drawLady(g, owner.x, GROUND, time, theme, reunion ? "reunion" : "idle");
}

function aimCamera(state, viewW, viewH) {
  const player = state.player;
  const groundCam = GROUND - viewH * 0.78;
  if (!Number.isFinite(state.camY)) state.camY = groundCam;
  if (!Number.isFinite(state.camX)) state.camX = 0;
  const targetX = player.x - viewW * 0.38 + player.facing * 70;
  const falling = player.y > GROUND + 24;
  const catAbove = GROUND - (player.y + PH);
  const tall = catAbove > 150 && !falling;
  let desiredY = groundCam;
  const catScreen = player.y - state.camY;
  if (falling) {
    desiredY = Math.min(state.camY, groundCam);
  } else if (tall) {
    desiredY = player.y - viewH * 0.22;
  } else if (catScreen < viewH * 0.22) {
    desiredY = player.y - viewH * 0.22;
  } else if (catScreen > viewH * 0.72 && player.y + PH <= GROUND + 8) {
    desiredY = player.y - viewH * 0.72;
  }
  const floorHigh = GROUND - viewH * 0.70;
  const floorLow = GROUND - viewH * 0.96;
  if (!tall) desiredY = Math.max(floorLow, Math.min(floorHigh, desiredY));
  if (state.snapCam) {
    state.camX = targetX;
    state.camY = falling ? groundCam : desiredY;
    state.snapCam = false;
  } else {
    state.camX += (targetX - state.camX) * 0.08;
    state.camY += (desiredY - state.camY) * (tall ? 0.06 : 0.045);
  }
}

function drawWorld(state) {
  const level = state.level;
  const w = view.width;
  const h = view.height;
  const shakeX = (Math.random() - 0.5) * state.shake;
  const viewH = h / state.dpr;
  aimCamera(state, w / state.dpr, viewH);
  state.camX = Math.max(0, Math.min(Math.max(0, level.width - w / state.dpr), state.camX));
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const farW = state.bake.far.width;
  const farX = -((state.camX * 0.12) % farW);
  ctx.drawImage(state.bake.far, farX, 0, farW, h / state.dpr);
  ctx.drawImage(state.bake.far, farX + farW, 0, farW, h / state.dpr);
  ctx.save();
  ctx.translate(-state.camX + shakeX, -state.camY);
  const midW = state.bake.mid.width;
  const mid = state.bake.mid;
  ctx.save();
  ctx.translate(state.camX * 0.5, 0);
  const pStart = Math.floor((state.camX * 0.5) / midW) * midW - midW;
  for (let i = 0; i < 4; i++) ctx.drawImage(mid, 0, 0, midW, 280, pStart + i * midW, 0, midW, 280);
  ctx.restore();
  const base = Math.floor((state.camX - 40) / midW) * midW;
  for (let i = 0; i < 4; i++) ctx.drawImage(mid, 0, 280, midW, mid.height - 280, base + i * midW, 280, midW, mid.height - 280);
  const viewW = w / state.dpr + 80;
  const slice = Math.max(0, Math.min(state.bake.near.width - 1, state.camX - 40));
  const sliceW = Math.max(1, Math.min(state.bake.near.width - slice, viewW));
  ctx.drawImage(state.bake.near, slice, 0, sliceW, state.bake.near.height, slice, 0, sliceW, state.bake.near.height);
  drawMotion(ctx, level, state.time, state.bake.anchors);
  for (const block of level.solids) {
    if (block.kind === "pond") {
      const water = ctx.createLinearGradient(0, block.y, 0, block.y + 40);
      water.addColorStop(0, "rgba(120,190,230,0.85)");
      water.addColorStop(1, "rgba(40,110,170,0.9)");
      ctx.fillStyle = water;
      round(ctx, block.x, block.y, block.w, 36, 16);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = blockColor(level.theme, block.kind);
    round(ctx, block.x, block.y, block.w, Math.min(block.h, 80), 12);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.fillRect(block.x + 12, block.y + 6, Math.max(8, block.w - 24), 6);
    ctx.fillStyle = "rgba(40,20,10,0.12)";
    ctx.fillRect(block.x + 8, block.y + Math.min(block.h, 80) - 8, block.w - 16, 8);
  }
  for (const mark of level.checkpoints || []) drawCheckpoint(ctx, mark, state.time);
  for (const fish of level.fish) drawFish(ctx, fish, state.time);
  for (const enemy of level.enemies) {
    if (enemy.dive === "warn") {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(state.time * 16) * 0.1;
      ctx.fillStyle = "#3a2418";
      ctx.beginPath();
      ctx.ellipse(enemy.tx || enemy.x, GROUND + 2, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawEnemy(ctx, enemy, state.time);
    if (enemy.kind === "rooster" && enemy.alive !== false) {
      const hp = enemy.hp == null ? 3 : enemy.hp;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < hp ? "#e23b3b" : "rgba(255,255,255,0.7)";
        ctx.fillRect(enemy.x - 16 + i * 12, enemy.y - 40, 10, 5);
      }
    }
  }
  for (const shot of state.shots) {
    ctx.fillStyle = "#8a5a32";
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (level.rod && !state.gotRod) {
    ctx.strokeStyle = "#c9843a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(level.rod.x, level.rod.y);
    ctx.quadraticCurveTo(level.rod.x + 16, level.rod.y - 40, level.rod.x + 6, level.rod.y - 64);
    ctx.stroke();
  }
  drawClimbs(ctx, state.level, state.time);
  drawCans(ctx, state.level, state.time);
  drawHazards(ctx, state);
  drawScenery(ctx, level, state.time, state.camX, w / state.dpr);
  const reunion = state.won || Math.abs(state.player.x - level.owner.x) < 120;
  drawOwner(ctx, level.owner, state.time, level.theme, reunion);
  drawCatShadow(ctx, state);
  if (state.player.food > 0) {
    ctx.save();
    ctx.translate(state.player.x + 16, state.player.y + 30);
    ctx.globalAlpha = 0.28 + Math.sin(state.time * 8) * 0.08;
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (state.player.invuln <= 0 || Math.sin(state.time * 40) > 0) paintCat(ctx, state.cat, state.time);
  for (const bit of state.particles) {
    ctx.globalAlpha = Math.max(0, bit.life / bit.max);
    ctx.fillStyle = bit.color;
    ctx.beginPath();
    if (bit.kind === "star") {
      ctx.moveTo(bit.x, bit.y - 6);
      ctx.lineTo(bit.x + 2, bit.y - 1);
      ctx.lineTo(bit.x + 6, bit.y);
      ctx.lineTo(bit.x + 2, bit.y + 1);
      ctx.lineTo(bit.x, bit.y + 6);
      ctx.lineTo(bit.x - 2, bit.y + 1);
      ctx.lineTo(bit.x - 6, bit.y);
      ctx.lineTo(bit.x - 2, bit.y - 1);
    } else {
      ctx.arc(bit.x, bit.y, bit.kind === "spark" ? 4 : 7, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (state.fishing) {
    ctx.strokeStyle = "rgba(255,248,242,0.8)";
    ctx.beginPath();
    ctx.moveTo(state.player.x + 20, state.player.y + 20);
    ctx.lineTo(state.fishing.spot.x + 40, state.fishing.spot.y);
    ctx.stroke();
    const bite = state.fishing.t > state.fishing.bite && !state.fishing.caught;
    ctx.fillStyle = bite ? "#f0b429" : "#fff";
    ctx.beginPath();
    ctx.arc(state.fishing.spot.x + 40, state.fishing.spot.y, bite ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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

let progress = loadProgress();
let state = null;
let screen = "title";

const hearts = document.querySelector("#hearts");
const fishCount = document.querySelector("#fish-count");
const levelName = document.querySelector("#level-name");
const banner = document.querySelector("#banner");
const hud = document.querySelector("#hud");
const pad = document.querySelector("#pad");
const fishBtn = document.querySelector("#fish-btn");

function show(id) {
  for (const name of ["title", "select", "complete", "settings", "credits"]) {
    document.querySelector(`#${name}`).hidden = name !== id;
  }
  const playing = id === "play";
  hud.hidden = !playing;
  pad.hidden = !playing;
  screen = id;
}

function visibleBox() {
  const viewport = window.visualViewport;
  return {
    width: Math.round(viewport ? viewport.width : window.innerWidth),
    height: Math.round(viewport ? viewport.height : window.innerHeight),
    top: viewport ? viewport.offsetTop : 0,
    left: viewport ? viewport.offsetLeft : 0,
  };
}

function resize() {
  const box = visibleBox();
  const app = document.querySelector("#app");
  app.style.top = `${box.top}px`;
  app.style.left = `${box.left}px`;
  app.style.width = `${box.width}px`;
  app.style.height = `${box.height}px`;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.width = Math.round(box.width * dpr);
  view.height = Math.round(box.height * dpr);
  if (state) state.dpr = dpr;
}

function startLevel(index) {
  audio.unlock();
  state = fresh(progress, index);
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.bake = bake(LEVELS[index]);
  state.gotRod = progress.rod;
  audio.playMusic(LEVELS[index].music);
  audio.setPurr(false);
  levelName.textContent = LEVELS[index].name;
  show("play");
}

function showComplete(current) {
  document.querySelector("#complete-title").textContent = `${progress.cat.name} found you.`;
  document.querySelector("#complete-kicker").textContent = current.level.name;
  const stars = "★★★".slice(0, current.stars) + "☆☆☆".slice(current.stars);
  document.querySelector("#stars").textContent = stars;
  document.querySelector("#complete-copy").textContent = `Fish ${current.fishGot} / ${current.level.fishValue}. ${current.stars === 3 ? "Every last one." : "A few still glint in the room."}`;
  document.querySelector("#next-level").hidden = current.levelIndex >= LEVELS.length - 1;
  show("complete");
}

function paintHud() {
  if (!state) return;
  hearts.textContent = "♥".repeat(Math.max(0, state.player.health)) + "♡".repeat(Math.max(0, 3 - state.player.health));
  fishCount.textContent = `${state.fishGot}/${state.level.fishValue}`;
  const fill = document.querySelector("#progress-fill");
  if (fill) fill.style.width = `${Math.max(0, Math.min(1, state.player.x / Math.max(1, state.level.owner.x))) * 100}%`;
  paintSound();
  banner.hidden = state.bannerT <= 0;
  banner.textContent = state.banner;
  const nearWater = state.level.water.some((water) => {
    const px = state.player.x + PW / 2;
    return px > water.x - 40 && px < water.x + water.w + 40;
  });
  fishBtn.hidden = !(state.gotRod && nearWater);
  const ring = document.querySelector("#food-ring");
  if (ring) {
    const left = state.player.food || 0;
    ring.hidden = left <= 0;
    if (left > 0) {
      const pen = ring.getContext("2d");
      pen.clearRect(0, 0, 36, 36);
      pen.strokeStyle = "rgba(255,255,255,0.45)";
      pen.lineWidth = 4;
      pen.beginPath();
      pen.arc(18, 18, 12, 0, Math.PI * 2);
      pen.stroke();
      pen.strokeStyle = "#e2b84a";
      pen.beginPath();
      pen.arc(18, 18, 12, -Math.PI / 2, -Math.PI / 2 + (left / 9) * Math.PI * 2);
      pen.stroke();
    }
  }
  const actionBtn = document.querySelector("#action");
  if (actionBtn) {
    const label = actionName(state);
    actionBtn.hidden = !label;
    actionBtn.textContent = label || "Act";
  }
}

function actionName(state) {
  const player = state.player;
  if (player.cling || nearClimb(state)) return "Climb";
  if (nearest(state.level, "post", player.x, 36)) return "Climb";
  if (nearest(state.level, "hook", player.x, 100)) return "Yarn";
  return "";
}

function noteError(error) {
  const text = String(error && error.stack ? error.stack : error).slice(0, 500);
  loop.errors = (loop.errors || 0) + 1;
  loop.lastError = text;
  if (sunbeamDebug()) {
    const box = document.querySelector("#debug-log");
    if (box) {
      box.hidden = false;
      box.textContent = text;
    }
  }
  console.error(error);
}

function sunbeamDebug() {
  return /(?:\?|&)debug=1/.test(location.search) || window.SUNBEAM_DEBUG === true;
}

function loop(now) {
  const dt = Math.min(0.033, (now - (loop.last || now)) / 1000);
  loop.last = now;
  try {
    if (state && state.mode === "play") {
      const input = {
        left: held.left,
        right: held.right,
        jump: held.jump,
        jumpPressed: pressed.jump,
        scratch: held.scratch,
        scratchPressed: pressed.scratch,
        fish: held.fish,
        fishPressed: pressed.fish,
        action: held.action,
        actionPressed: pressed.action,
      };
      pressed.jump = pressed.scratch = pressed.fish = pressed.action = false;
      step(state, dt, input);
      drawWorld(state);
      paintHud();
    } else if (screen === "select") {
      drawPreview();
    } else if (screen === "complete") {
      drawReunion();
    }
    paintSound();
  } catch (error) {
    noteError(error);
    if (state) {
      try { sanitize(state, dt); respawn(state); } catch (again) { noteError(again); }
    }
  }
  requestAnimationFrame(loop);
}

function paintSound() {
  const running = Boolean(audio.ctx && audio.ctx.state === "running");
  const prompt = document.querySelector("#sound-prompt");
  if (prompt) prompt.hidden = running;
  const label = !running ? "Sound waiting" : audio.muted || !audio.musicOn ? "Sound off" : "Sound on";
  for (const id of ["title-sound", "pause-sound"]) {
    const button = document.querySelector(`#${id}`);
    if (button) button.textContent = label;
  }
}

function onSoundButton() {
  const running = Boolean(audio.ctx && audio.ctx.state === "running");
  audio.gesture();
  if (running) {
    audio.setMuted(!audio.muted);
    if (!audio.muted && audio.current) audio.playMusic(audio.current, true);
  }
  paintSound();
}

function drawPreview() {
  const canvas = document.querySelector("#preview");
  if (!canvas || document.querySelector("#select").hidden) return;
  const gender = document.querySelector('#gender button[aria-pressed="true"]');
  const hair = document.querySelector('#hair button[aria-pressed="true"]');
  const coat = document.querySelector('#coats button[aria-pressed="true"]');
  const eyes = document.querySelector('#eyes button[aria-pressed="true"]');
  if (!gender || !hair || !coat || !eyes) return;
  const cat = makeCat({
    name: "Miso",
    gender: gender.dataset.value,
    hair: hair.dataset.value,
    coat: coat.dataset.value,
    eyes: eyes.dataset.value,
  });
  cat.x = canvas.width * 0.5;
  cat.groundY = canvas.height * 0.78;
  cat.scale = Math.min(canvas.width / 150, canvas.height / 120);
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, canvas.width, canvas.height);
  paintCat(g, cat, performance.now() / 1000);
}

function drawReunion() {
  const canvas = document.querySelector("#reunion");
  if (!canvas || document.querySelector("#complete").hidden) return;
  const theme = state && state.level ? state.level.theme : "living";
  const g = canvas.getContext("2d");
  const time = performance.now() / 1000;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#fff6ee";
  g.fillRect(0, 0, canvas.width, canvas.height);
  drawLady(g, 360, 250, time, theme, "reunion");
  const cat = makeCat(progress.cat);
  cat.x = 250;
  cat.groundY = 248;
  cat.scale = 1.15;
  cat.facing = 1;
  cat.hideShadow = false;
  paintCat(g, cat, time);
}

function birdCard() {
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#hud").hidden = true;
  document.querySelector("#pad").hidden = true;
  document.querySelector("#sound-prompt").hidden = true;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const w = view.width;
  const h = view.height;
  ctx.fillStyle = "#f6efe6";
  ctx.fillRect(0, 0, w, h);
  birdSheet(ctx, w, h);
  ctx.save();
  ctx.translate(w - w / 7, h * 0.42);
  ctx.scale(3.1, 3.1);
  drawFish(ctx, { x: 0, y: 0, golden: true, phase: 0.4, got: false }, 0.6);
  ctx.restore();
  ctx.fillStyle = "#5c4638";
  ctx.font = "600 15px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("fish", w - w / 7, h * 0.72);
}

function portrait() {
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#hud").hidden = true;
  document.querySelector("#pad").hidden = true;
  document.querySelector("#sound-prompt").hidden = true;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const w = view.width;
  const h = view.height;
  ctx.fillStyle = "#f6efe6";
  ctx.fillRect(0, 0, w, h);
  const time = 1.2;
  ctx.save();
  ctx.translate(w * 0.28, h * 0.9);
  ctx.scale(1.55, 1.55);
  drawLady(ctx, 0, 0, time, "living", "idle");
  ctx.restore();
  ctx.save();
  ctx.translate(w * 0.72, h * 0.9);
  ctx.scale(1.55, 1.55);
  drawLady(ctx, 0, 0, time, "yard", "reunion");
  const cat = makeCat({ name: "Miso", gender: "girl", hair: "short", coat: "orange", eyes: "green" });
  cat.x = -36;
  cat.groundY = 4;
  cat.scale = 0.85;
  cat.facing = 1;
  paintCat(ctx, cat, time);
  ctx.restore();
  ctx.fillStyle = "#5c4638";
  ctx.font = "600 16px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Waiting", w * 0.28, 28);
  ctx.fillText("Reunion", w * 0.72, 28);
}

function bindHold(button, key) {
  const down = (event) => {
    event.preventDefault();
    audio.unlock();
    held[key] = true;
    if (key === "jump" || key === "scratch" || key === "fish" || key === "action") pressed[key] = true;
  };
  const up = (event) => {
    event.preventDefault();
    held[key] = false;
  };
  button.addEventListener("pointerdown", down, { passive: false });
  button.addEventListener("pointerup", up, { passive: false });
  button.addEventListener("pointercancel", (event) => {
    if (event.pointerType === "touch") return;
    held[key] = false;
  });
  button.addEventListener("touchstart", down, { passive: false });
  button.addEventListener("touchend", up, { passive: false });
  button.addEventListener("touchcancel", up, { passive: false });
}

function boot() {
  resize();
  audio.setMix(progress.sound);
  audio.playMusic("music-inside");
  bindHold(document.querySelector("#left"), "left");
  bindHold(document.querySelector("#right"), "right");
  bindHold(document.querySelector("#jump"), "jump");
  bindHold(document.querySelector("#scratch"), "scratch");
  bindHold(document.querySelector("#fish-btn"), "fish");
  bindHold(document.querySelector("#action"), "action");
  document.querySelector("#play").addEventListener("click", () => {
    audio.unlock();
    fillSelect();
    show("select");
  });
  document.querySelector("#quiet").addEventListener("click", () => {
    location.href = "pet/index.html";
  });
  document.querySelector("#begin").addEventListener("click", () => {
    progress.cat = readCat();
    saveProgress(progress);
    startLevel(0);
  });
  document.querySelector("#back-title").addEventListener("click", () => show("title"));
  document.querySelector("#title-settings").addEventListener("click", () => openSettings());
  document.querySelector("#pause").addEventListener("click", () => {
    if (state) state.mode = "pause";
    openSettings();
  });
  document.querySelector("#settings-close").addEventListener("click", () => {
    if (state && state.mode === "pause") {
      state.mode = "play";
      show("play");
    } else show("title");
  });
  document.querySelector("#credits-open").addEventListener("click", () => show("credits"));
  document.querySelector("#credits-close").addEventListener("click", () => openSettings());
  document.querySelector("#next-level").addEventListener("click", () => startLevel(Math.min(LEVELS.length - 1, state.levelIndex + 1)));
  document.querySelector("#replay").addEventListener("click", () => startLevel(state.levelIndex));
  document.querySelector("#to-title").addEventListener("click", () => {
    audio.playMusic("music-inside");
    show("title");
  });
  document.querySelector("#music-volume").addEventListener("input", (event) => {
    audio.unlock();
    audio.setMix({ music: event.target.value / 100 });
    progress.sound = audio.snapshot();
    saveProgress(progress);
  });
  document.querySelector("#sfx-volume").addEventListener("input", (event) => {
    audio.unlock();
    audio.setMix({ effects: event.target.value / 100 });
    progress.sound = audio.snapshot();
    saveProgress(progress);
  });
  document.querySelector("#music-toggle").addEventListener("click", () => {
    audio.setMix({ musicOn: !audio.musicOn });
    syncSound();
    progress.sound = audio.snapshot();
    saveProgress(progress);
  });
  document.querySelector("#sfx-toggle").addEventListener("click", () => {
    audio.setMix({ effectsOn: !audio.sfxOn });
    syncSound();
    progress.sound = audio.snapshot();
    saveProgress(progress);
  });
  document.querySelector("#unlock-all").addEventListener("click", () => {
    progress.unlockAll = !progress.unlockAll;
    if (progress.unlockAll) progress.unlocked = LEVELS.length;
    saveProgress(progress);
    document.querySelector("#unlock-all").textContent = progress.unlockAll ? "All levels open" : "Unlock all levels";
    fillJumps();
  });
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 60));
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
    window.visualViewport.addEventListener("scroll", resize);
  }
  document.addEventListener("touchmove", (event) => {
    if (event.target.closest(".screen")) return;
    event.preventDefault();
  }, { passive: false });
  showHomeTip();
  window.addEventListener("keydown", (event) => {
    audio.unlock();
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") held.left = true;
    if (key === "arrowright" || key === "d") held.right = true;
    if (key === " " || key === "arrowup" || key === "w") {
      held.jump = true;
      pressed.jump = true;
      event.preventDefault();
    }
    if (key === "j" || key === "k") pressed.scratch = true;
    if (key === "f") pressed.fish = true;
    if (key === "e") pressed.action = true;
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") held.left = false;
    if (key === "arrowright" || key === "d") held.right = false;
    if (key === " " || key === "arrowup" || key === "w") held.jump = false;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) audio.pause();
    else audio.resume();
    paintSound();
  });
  fillJumps();
  syncSound();
  const arm = (event) => {
    const target = event.target;
    if (target && target.closest && target.closest("#title-sound, #pause-sound")) return;
    audio.gesture();
    paintSound();
  };
  for (const type of ["pointerup", "touchend"]) document.addEventListener(type, arm);
  document.addEventListener("touchstart", arm, { passive: false });
  document.querySelector("#title-sound").addEventListener("click", onSoundButton);
  document.querySelector("#pause-sound").addEventListener("click", onSoundButton);
  document.querySelector("#sound-prompt").addEventListener("click", () => {
    audio.gesture();
    paintSound();
  });
  paintSound();
  requestAnimationFrame(loop);
}

function readCat() {
  return {
    name: cleanName(document.querySelector("#cat-name").value),
    gender: document.querySelector('#gender button[aria-pressed="true"]').dataset.value,
    hair: document.querySelector('#hair button[aria-pressed="true"]').dataset.value,
    coat: document.querySelector('#coats button[aria-pressed="true"]').dataset.value,
    eyes: document.querySelector('#eyes button[aria-pressed="true"]').dataset.value,
  };
}

function fillSelect() {
  const cat = progress.cat;
  document.querySelector("#cat-name").value = cat.name || "Miso";
  makeSeg("#gender", [["girl", "Girl"], ["boy", "Boy"]], cat.gender);
  makeSeg("#hair", [["short", "Short"], ["long", "Long"]], cat.hair);
  const coats = document.querySelector("#coats");
  coats.replaceChildren(...COAT_ORDER.map((id) => {
    const button = document.createElement("button");
    button.className = "swatch";
    button.type = "button";
    button.dataset.value = id;
    button.style.background = swatchBackground(COATS[id]);
    button.setAttribute("aria-pressed", id === cat.coat ? "true" : "false");
    button.setAttribute("aria-label", COATS[id].name);
    button.addEventListener("click", () => mark(coats, button));
    return button;
  }));
  const eyes = document.querySelector("#eyes");
  eyes.replaceChildren(...EYE_ORDER.map((id) => {
    const button = document.createElement("button");
    button.className = "swatch";
    button.type = "button";
    button.dataset.value = id;
    button.style.background = EYES[id].color;
    button.setAttribute("aria-pressed", id === cat.eyes ? "true" : "false");
    button.setAttribute("aria-label", EYES[id].name);
    button.addEventListener("click", () => mark(eyes, button));
    return button;
  }));
}

function makeSeg(selector, pairs, current) {
  const host = document.querySelector(selector);
  host.replaceChildren(...pairs.map(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.value = value;
    button.textContent = label;
    button.setAttribute("aria-pressed", value === current ? "true" : "false");
    button.addEventListener("click", () => mark(host, button));
    return button;
  }));
}

function mark(host, button) {
  for (const child of host.querySelectorAll("button")) child.setAttribute("aria-pressed", child === button ? "true" : "false");
}

function fillJumps() {
  const host = document.querySelector("#level-jumps");
  host.replaceChildren(...LEVELS.map((level, index) => {
    const button = document.createElement("button");
    button.className = "tiny";
    button.type = "button";
    button.textContent = level.name;
    button.disabled = !progress.unlockAll && index + 1 > progress.unlocked;
    button.addEventListener("click", () => startLevel(index));
    return button;
  }));
}

function openSettings() {
  syncSound();
  document.querySelector("#unlock-all").textContent = progress.unlockAll ? "All levels open" : "Unlock all levels";
  fillJumps();
  show("settings");
}

function showHomeTip() {
  const tip = document.querySelector("#home-tip");
  const safari = /safari/i.test(navigator.userAgent) && !/crios|fxios|chrome|android/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  let seen = false;
  try { seen = localStorage.getItem("sunbeam-home-tip") === "1"; } catch (error) { seen = true; }
  if (!safari || standalone || seen) return;
  tip.hidden = false;
  document.querySelector("#home-tip-close").addEventListener("click", () => {
    tip.hidden = true;
    try { localStorage.setItem("sunbeam-home-tip", "1"); } catch (error) { /* private mode */ }
  });
}

function syncSound() {
  document.querySelector("#music-volume").value = String(Math.round(audio.musicVol * 100));
  document.querySelector("#sfx-volume").value = String(Math.round(audio.sfxVol * 100));
  document.querySelector("#music-toggle").textContent = audio.musicOn ? "Music on" : "Music off";
  document.querySelector("#sfx-toggle").textContent = audio.sfxOn ? "Effects on" : "Effects off";
}

boot();

function snapshot() {
  if (!state) return;
  updatePose(state, 1 / 60);
  drawWorld(state);
  paintHud();
}

const SWIPE_FRAMES = [
  { label: "Rise", rise: 0.08, phase: 0.02 },
  { label: "Up", rise: 0.42, phase: 0.08 },
  { label: "Stand", rise: 0.82, phase: 0.16 },
  { label: "Swipe", rise: 1, phase: 0.25 },
  { label: "Cross", rise: 1, phase: 0.5 },
  { label: "Swipe", rise: 1, phase: 0.75 },
  { label: "Follow", rise: 1, phase: 0.92 },
  { label: "Drop", rise: 0.3, phase: 1.02 },
];

function swipeSheet() {
  const counts = [];
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#hud").hidden = true;
  document.querySelector("#pad").hidden = true;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const w = view.width;
  const h = view.height;
  ctx.fillStyle = "#f4e7d6";
  ctx.fillRect(0, 0, w, h);
  const cols = 4;
  const cellW = w / cols;
  const cellH = h / 2;
  SWIPE_FRAMES.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cat = makeCat({ name: "Miso", gender: "girl", hair: "short", coat: "orange", eyes: "green" });
    cat.upright = true;
    cat.rise = frame.rise;
    cat.scratchPhase = frame.phase;
    cat.scratch = 0;
    cat.facing = 1;
    cat.scale = Math.min(cellW, cellH) / 118;
    cat.x = col * cellW + cellW * 0.4;
    cat.groundY = row * cellH + cellH * 0.8;
    cat.hideShadow = false;
    cat._countBodies = true;
    cat._bodies = 0;
    paintCat(ctx, cat, 0.4);
    counts.push(cat._bodies);
    ctx.fillStyle = "#5c4638";
    ctx.font = "600 14px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${index + 1}  ${frame.label}`, col * cellW + cellW / 2, row * cellH + 22);
  });
  return counts;
}

function enemySheet() {
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#hud").hidden = true;
  document.querySelector("#pad").hidden = true;
  document.querySelector("#sound-prompt").hidden = true;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const w = view.width;
  const h = view.height;
  ctx.fillStyle = "#f6efe4";
  ctx.fillRect(0, 0, w, h);
  const kinds = ["mouse", "bird", "squirrel", "fish", "chicken", "rooster"];
  kinds.forEach((kind, index) => {
    const x = (index + 0.5) * (w / kinds.length);
    ctx.save();
    ctx.translate(x, h * 0.46);
    ctx.scale(2.8, 2.8);
    drawEnemy(ctx, { kind, x: 0, y: 0, alive: true, t: 0.8, big: kind === "rooster", dive: null }, 1);
    ctx.restore();
    ctx.fillStyle = "#5c4638";
    ctx.font = "600 18px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(kind, x, h * 0.78);
  });
}

function covered(level, x, y) {
  let best = null;
  for (const block of level.solids) {
    if (block.kind === "pond") continue;
    if (x < block.x + 8 || x > block.x + block.w - 8) continue;
    if (block.y < y - 8) continue;
    if (best == null || block.y < best) best = block.y;
  }
  return best;
}

function insideSolid(level, x, y) {
  return level.solids.some((block) => block.kind !== "pond" && x > block.x + 4 && x < block.x + block.w - 4 && y > block.y + 4 && y < block.y + Math.min(block.h, 64) - 4);
}

function audit(level) {
  const problems = [];
  for (const enemy of level.enemies) {
    if (insideSolid(level, enemy.x, enemy.y)) problems.push(`${enemy.kind} inside a wall at ${Math.round(enemy.x)}`);
    const ground = covered(level, enemy.x, enemy.y);
    if (enemy.kind === "fish") {
      const wet = level.water.some((pond) => enemy.x > pond.x && enemy.x < pond.x + pond.w);
      if (!wet) problems.push(`fish not in water at ${Math.round(enemy.x)}`);
    } else if (!ground) problems.push(`${enemy.kind} over a pit at ${Math.round(enemy.x)}`);
    else if (enemy.kind !== "bird" && ground - enemy.y > 48) problems.push(`${enemy.kind} floating at ${Math.round(enemy.x)}`);
  }
  for (const fish of level.fish) {
    if (insideSolid(level, fish.x, fish.y)) problems.push(`fish inside a wall at ${Math.round(fish.x)}`);
    if (fish.y > GROUND - 8 && !covered(level, fish.x, fish.y)) problems.push(`fish in a pit at ${Math.round(fish.x)}`);
  }
  return { id: level.id, enemies: level.enemies.length, fish: level.fishValue, width: level.width, problems };
}

function quietProgress() {
  return {
    cat: { name: "Miso", gender: "girl", hair: "short", coat: "orange", eyes: "green" },
    sound: { music: 0, musicOn: false, effects: 0, effectsOn: false },
    unlocked: 4, stars: {}, rod: true, unlockAll: true, fishBank: 0, bestFish: {},
  };
}

function pitXs(level) {
  const floors = level.solids.filter((block) => block.kind === "floor").sort((a, b) => a.x - b.x);
  const pits = [];
  for (let i = 0; i < floors.length - 1 && pits.length < 8; i++) {
    const left = floors[i].x + floors[i].w;
    const gap = floors[i + 1].x - left;
    if (gap > 36) pits.push(left + Math.min(24, gap / 2));
  }
  return pits;
}

function stressPits() {
  const modes = ["plain", "invuln", "jump", "pounce", "grapple", "checkpoint", "lastHeart", "double", "bounce", "ride"];
  const bad = [];
  let cases = 0;
  for (const level of LEVELS) {
    for (const pitX of pitXs(level)) {
      for (const mode of modes) {
        cases += 1;
        const index = LEVELS.indexOf(level);
        const trial = fresh(quietProgress(), index);
        trial.mode = "play";
        const input = still();
        try {
          for (let i = 0; i < 8; i++) step(trial, 1 / 60, input);
          if (mode === "checkpoint" && trial.level.checkpoints[0]) {
            trial.safe = { x: trial.level.checkpoints[0].x - 16, y: GROUND - PH };
          }
          trial.player.x = pitX;
          trial.player.y = GROUND - 20;
          trial.player.vy = 240;
          trial.player.onGround = false;
          if (mode === "invuln") trial.player.invuln = 4;
          if (mode === "lastHeart") trial.player.health = 1;
          if (mode === "pounce") trial.player.pounce = 0.3;
          if (mode === "grapple") trial.player.grapple = { x: pitX + 40, y: 180, life: 0.4 };
          if (mode === "double") {
            trial.player.airJump = true;
            trial.player.vy = -180;
          }
          if (mode === "bounce") trial.player.bounce = -500;
          if (mode === "ride") trial.player.vy = -80;
          for (let frame = 0; frame < 160; frame++) {
            if (mode === "jump" && frame < 25) input.jump = true;
            else input.jump = false;
            step(trial, 1 / 60, input);
          }
          for (let frame = 0; frame < 40; frame++) step(trial, 1 / 60, still());
          const finite = [trial.player.x, trial.player.y, trial.player.vx, trial.player.vy].every(Number.isFinite);
          const grounded = groundedSpot(trial, trial.player.x, trial.player.y) && trial.player.vy === 0;
          if (!finite || !grounded || trial.player.y > 720) bad.push({ id: level.id, mode, finite, grounded, y: Math.round(trial.player.y) });
        } catch (error) {
          bad.push({ id: level.id, mode, threw: String(error).slice(0, 180) });
        }
      }
    }
  }
  return { cases, bad };
}

function rehearse(id, viewW, viewH, kind) {
  const index = LEVELS.findIndex((level) => level.id === id);
  const trial = fresh(quietProgress(), index);
  trial.mode = "play";
  const idle = still();
  for (let i = 0; i < 40; i++) {
    step(trial, 1 / 60, idle);
    aimCamera(trial, viewW, viewH);
  }
  let best = { y: trial.player.y, cam: trial.camY };
  for (let frame = 0; frame < 70; frame++) {
    const launched = kind === "tramp" || kind === "balloon";
    const input = { ...still(), jump: !launched && frame < 26, jumpPressed: !launched && (frame === 0 || (kind === "double" && frame === 16)) };
    if (kind === "tramp" && frame === 0) trial.player.bounce = -820;
    if (kind === "balloon" && frame === 0) trial.player.bounce = -460;
    step(trial, 1 / 60, input);
    aimCamera(trial, viewW, viewH);
    if (trial.player.y < best.y) best = { y: trial.player.y, cam: trial.camY };
  }
  return {
    id,
    kind,
    viewH,
    apexY: Math.round(best.y),
    floor: +((GROUND - best.cam) / viewH).toFixed(3),
  };
}

function fuzzLevels() {
  const bad = [];
  for (const level of LEVELS) {
    const trial = fresh(quietProgress(), LEVELS.indexOf(level));
    trial.mode = "play";
    try {
      for (let frame = 0; frame < 60 * 60; frame++) {
        const input = {
          left: Math.random() < 0.08,
          right: Math.random() < 0.75,
          jump: Math.random() < 0.18,
          jumpPressed: Math.random() < 0.06,
          scratch: false,
          scratchPressed: Math.random() < 0.04,
          fish: false,
          fishPressed: false,
          action: false,
          actionPressed: Math.random() < 0.03,
        };
        step(trial, 1 / 60, input);
        if (![trial.player.x, trial.player.y, trial.player.vx, trial.player.vy].every(Number.isFinite)) {
          bad.push({ id: level.id, frame, why: "not finite" });
          break;
        }
      }
    } catch (error) {
      bad.push({ id: level.id, why: String(error).slice(0, 180) });
    }
  }
  return { seconds: 60, levels: LEVELS.length, bad };
}

function tapChoice() {
  const press = { ...still(), jump: true, jumpPressed: true };
  function run(index, gap, enemy) {
    const trial = fresh(quietProgress(), index);
    trial.mode = "play";
    for (let i = 0; i < 12; i++) step(trial, 1 / 60, still());
    trial.player.x = 240;
    trial.player.facing = 1;
    for (const item of trial.level.enemies) item.x = 8000;
    step(trial, 1 / 60, press);
    for (let i = 0; i < gap; i++) step(trial, 1 / 60, still());
    if (enemy) {
      const foe = trial.level.enemies.find((item) => item.alive !== false);
      if (foe) {
        foe.x = trial.player.x + 60;
        foe.y = trial.player.y + 8;
        foe.alive = true;
        foe.flee = 0;
      }
    }
    step(trial, 1 / 60, press);
    return {
      pounce: trial.player.pounce > 0,
      airJump: trial.player.airJump,
      vy: Math.round(trial.player.vy),
    };
  }
  return {
    takeoffPounce: run(0, 4, false),
    airPounce: run(1, 10, true),
    airDouble: run(1, 10, false),
  };
}

function climbTest(id) {
  const index = LEVELS.findIndex((level) => level.id === id);
  const trial = fresh(quietProgress(), index);
  trial.mode = "play";
  const climb = (trial.level.climbs || [])[0];
  if (!climb) return { id, reached: false, landed: false, why: "no climb" };
  const hold = { ...still(), action: true };
  trial.player.x = climb.x - 16;
  trial.player.y = GROUND - PH - 12;
  trial.player.onGround = false;
  trial.player.vy = -30;
  let high = trial.player.y;
  let jumped = false;
  for (let frame = 0; frame < 280; frame++) {
    const hop = trial.player.onGround && trial.player.y < GROUND - 80 && !jumped;
    if (hop) jumped = true;
    step(trial, 1 / 60, { ...hold, jump: hop, jumpPressed: hop });
    if (trial.player.y < high) high = trial.player.y;
  }
  const off = { ...still(), right: true };
  for (let frame = 0; frame < 150; frame++) step(trial, 1 / 60, off);
  for (let frame = 0; frame < 90; frame++) step(trial, 1 / 60, still());
  return {
    id,
    high: Math.round(high),
    reached: high < GROUND - 130,
    landed: groundedSpot(trial, trial.player.x, trial.player.y) && trial.player.y < 700,
    y: Math.round(trial.player.y),
    fish: trial.level.fishValue,
  };
}

window.sunbeam = {
  audio,
  get state() { return state; },
  startLevel,
  simulate,
  testPit,
  snapshot,
  swipeSheet,
  enemySheet,
  portrait,
  birdCard,
  stressPits,
  fuzzLevels,
  rehearse,
  climbTest,
  tapChoice,
  audit,
  LEVELS,
  show,
};
