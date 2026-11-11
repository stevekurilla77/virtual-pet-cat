import { paintCat } from "./kitten.js";
import { clonePose, POSES, POSE_KEYS } from "./poses.js";
import { COAT_ORDER, COATS, EYE_ORDER, EYES, cleanName, swatchBackground } from "./coats.js";
import { PlayAudio } from "./play-audio.js";

const KEY = "sunbeam-play";
const GROUND = 470;
const PW = 32;
const PH = 58;
const GRAV = 1680;
const JUMP = -650;
const MAXRUN = 255;

const audio = new PlayAudio();
const held = { left: false, right: false, jump: false, scratch: false, fish: false };
const pressed = { jump: false, scratch: false, fish: false };

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
  const fish = [];
  for (const group of spec.groups) {
    if (group.kind === "arc") arcFish(fish, group.x0, group.x1, group.y, group.n);
    else if (group.kind === "line") lineFish(fish, group.x, group.y, group.n, group.dx);
    else addFish(fish, group.x, group.y, Boolean(group.golden));
  }
  return { ...spec, fish, fishValue: fish.length };
}

const LEVELS = [
  buildLevel({
    id: "living",
    name: "Living room",
    music: "music-living",
    width: 4300,
    theme: "living",
    spawn: 70,
    owner: { x: 4040, y: GROUND - 86 },
    checkpoint: 2100,
    water: [{ x: 2280, w: 150, y: GROUND - 36 }],
    solids: [
      solid(0, GROUND, 1020, 220, "floor"),
      solid(1160, GROUND, 1480, 220, "floor"),
      solid(2760, GROUND, 1540, 220, "floor"),
      solid(220, GROUND - 64, 230, 64, "couch"),
      solid(560, GROUND - 42, 170, 42, "table"),
      solid(1320, GROUND - 86, 100, 18, "perch"),
      solid(1460, GROUND - 150, 100, 18, "perch"),
      solid(1600, GROUND - 86, 110, 18, "perch"),
      solid(1960, GROUND - 120, 220, 18, "sill"),
      solid(2300, GROUND - 36, 130, 36, "tank"),
      solid(3000, GROUND - 48, 110, 48, "step"),
      solid(3140, GROUND - 96, 110, 96, "step"),
      solid(3280, GROUND - 48, 120, 48, "step"),
      solid(3680, GROUND - 28, 240, 28, "hearth"),
    ],
    enemies: [
      { kind: "mouse", x: 480, y: GROUND - 22, min: 360, max: 900 },
      { kind: "mouse", x: 1500, y: GROUND - 172, min: 1460, max: 1540 },
      { kind: "bird", x: 2050, y: 180, min: 1900, max: 2200 },
      { kind: "fish", x: 2360, y: GROUND - 20, min: 2300, max: 2420 },
    ],
    groups: [
      { kind: "line", x: 760, y: GROUND - 36, n: 4, dx: 40 },
      { kind: "arc", x0: 990, x1: 1190, y: GROUND - 28, n: 4 },
      { kind: "line", x: 1700, y: GROUND - 36, n: 5, dx: 38 },
      { kind: "spot", x: 1370, y: GROUND - 112 },
      { kind: "spot", x: 1510, y: GROUND - 176 },
      { kind: "spot", x: 1655, y: GROUND - 112 },
      { kind: "line", x: 1990, y: GROUND - 148, n: 3, dx: 48 },
      { kind: "arc", x0: 2240, x1: 2460, y: GROUND - 48, n: 3 },
      { kind: "arc", x0: 2600, x1: 2800, y: GROUND - 28, n: 4 },
      { kind: "spot", x: 3055, y: GROUND - 78 },
      { kind: "spot", x: 3195, y: GROUND - 128 },
      { kind: "line", x: 3480, y: GROUND - 36, n: 3, dx: 40 },
      { kind: "spot", x: 3980, y: GROUND - 130, golden: true },
    ],
  }),
  buildLevel({
    id: "porch",
    name: "Front porch",
    music: "music-porch",
    width: 3900,
    theme: "porch",
    spawn: 70,
    owner: { x: 3620, y: GROUND - 86 },
    checkpoint: 1800,
    water: [],
    solids: [
      solid(0, GROUND, 800, 220, "floor"),
      solid(940, GROUND - 40, 700, 260, "floor"),
      solid(1760, GROUND, 900, 220, "floor"),
      solid(2780, GROUND - 30, 1120, 250, "floor"),
      solid(280, GROUND - 70, 120, 20, "planter"),
      solid(1180, GROUND - 110, 140, 20, "rail"),
      solid(2000, GROUND - 80, 160, 22, "chair"),
      solid(2400, GROUND - 50, 90, 50, "mailbox"),
    ],
    enemies: [
      { kind: "bird", x: 600, y: 160, min: 400, max: 780 },
      { kind: "squirrel", x: 1400, y: GROUND - 80, min: 1000, max: 1600 },
      { kind: "bird", x: 2200, y: 150, min: 1900, max: 2500 },
      { kind: "squirrel", x: 3000, y: GROUND - 70, min: 2860, max: 3400 },
    ],
    groups: [
      { kind: "line", x: 150, y: GROUND - 36, n: 4, dx: 38 },
      { kind: "line", x: 300, y: GROUND - 98, n: 3, dx: 32 },
      { kind: "arc", x0: 760, x1: 980, y: GROUND - 28, n: 4 },
      { kind: "line", x: 1040, y: GROUND - 70, n: 4, dx: 36 },
      { kind: "line", x: 1200, y: GROUND - 138, n: 3, dx: 36 },
      { kind: "arc", x0: 1600, x1: 1800, y: GROUND - 68, n: 4 },
      { kind: "line", x: 1880, y: GROUND - 36, n: 4, dx: 38 },
      { kind: "line", x: 2030, y: GROUND - 108, n: 3, dx: 36 },
      { kind: "arc", x0: 2620, x1: 2820, y: GROUND - 28, n: 3 },
      { kind: "line", x: 3200, y: GROUND - 64, n: 3, dx: 40 },
      { kind: "spot", x: 3520, y: GROUND - 140, golden: true },
    ],
  }),
  buildLevel({
    id: "yard",
    name: "The yard",
    music: "music-yard",
    width: 4200,
    theme: "yard",
    spawn: 70,
    owner: { x: 3920, y: GROUND - 86 },
    checkpoint: 2000,
    rod: { x: 1680, y: GROUND - 36 },
    water: [{ x: 2500, w: 280, y: GROUND - 8 }],
    solids: [
      solid(0, GROUND, 900, 220, "floor"),
      solid(1040, GROUND, 700, 220, "floor"),
      solid(1860, GROUND - 70, 180, 18, "branch"),
      solid(2100, GROUND - 130, 160, 18, "branch"),
      solid(1860, GROUND, 1480, 220, "floor"),
      solid(3340, GROUND, 860, 220, "floor"),
      solid(3200, GROUND - 60, 140, 18, "fence"),
      solid(3460, GROUND - 100, 120, 18, "fence"),
    ],
    enemies: [
      { kind: "chicken", x: 500, y: GROUND - 36, min: 300, max: 860 },
      { kind: "squirrel", x: 1300, y: GROUND - 36, min: 1100, max: 1680 },
      { kind: "fish", x: 2620, y: GROUND - 10, min: 2520, max: 2740 },
      { kind: "chicken", x: 3300, y: GROUND - 36, min: 3000, max: 3700 },
    ],
    groups: [
      { kind: "line", x: 180, y: GROUND - 36, n: 5, dx: 40 },
      { kind: "arc", x0: 860, x1: 1080, y: GROUND - 28, n: 4 },
      { kind: "line", x: 1160, y: GROUND - 36, n: 4, dx: 40 },
      { kind: "arc", x0: 1700, x1: 1900, y: GROUND - 28, n: 4 },
      { kind: "line", x: 1900, y: GROUND - 98, n: 3, dx: 40 },
      { kind: "line", x: 2120, y: GROUND - 158, n: 3, dx: 36 },
      { kind: "line", x: 2220, y: GROUND - 36, n: 4, dx: 38 },
      { kind: "arc", x0: 2480, x1: 2780, y: GROUND - 20, n: 5 },
      { kind: "spot", x: 3260, y: GROUND - 88 },
      { kind: "spot", x: 3510, y: GROUND - 128 },
      { kind: "line", x: 3680, y: GROUND - 36, n: 3, dx: 40 },
      { kind: "spot", x: 3840, y: GROUND - 130, golden: true },
    ],
  }),
  buildLevel({
    id: "neighbor",
    name: "Neighbor's house",
    music: "music-neighbor",
    width: 4400,
    theme: "neighbor",
    spawn: 70,
    owner: { x: 4120, y: GROUND - 86 },
    checkpoint: 2200,
    water: [{ x: 3000, w: 160, y: GROUND - 40 }],
    solids: [
      solid(0, GROUND, 700, 220, "floor"),
      solid(860, GROUND - 70, 200, 18, "counter"),
      solid(860, GROUND, 520, 220, "floor"),
      solid(1500, GROUND, 400, 220, "floor"),
      solid(1680, GROUND - 120, 160, 18, "shelf"),
      solid(2020, GROUND, 700, 220, "floor"),
      solid(2840, GROUND - 50, 180, 50, "tank"),
      solid(2860, GROUND, 1540, 220, "floor"),
      solid(3400, GROUND - 90, 120, 18, "cage"),
      solid(3600, GROUND - 150, 120, 18, "cage"),
      solid(3800, GROUND - 90, 140, 18, "cage"),
    ],
    enemies: [
      { kind: "mouse", x: 400, y: GROUND - 22, min: 200, max: 660 },
      { kind: "mouse", x: 1100, y: GROUND - 92, min: 880, max: 1040 },
      { kind: "bird", x: 2300, y: 150, min: 2100, max: 2600 },
      { kind: "mouse", x: 3200, y: GROUND - 22, min: 3000, max: 3600 },
    ],
    groups: [
      { kind: "line", x: 160, y: GROUND - 36, n: 4, dx: 40 },
      { kind: "arc", x0: 660, x1: 900, y: GROUND - 28, n: 4 },
      { kind: "line", x: 900, y: GROUND - 98, n: 3, dx: 40 },
      { kind: "line", x: 1080, y: GROUND - 36, n: 4, dx: 38 },
      { kind: "arc", x0: 1340, x1: 1540, y: GROUND - 28, n: 3 },
      { kind: "line", x: 1700, y: GROUND - 148, n: 3, dx: 36 },
      { kind: "arc", x0: 1860, x1: 2060, y: GROUND - 28, n: 4 },
      { kind: "line", x: 2200, y: GROUND - 36, n: 4, dx: 40 },
      { kind: "arc", x0: 2680, x1: 2900, y: GROUND - 28, n: 4 },
      { kind: "spot", x: 3460, y: GROUND - 118 },
      { kind: "spot", x: 3660, y: GROUND - 178 },
      { kind: "spot", x: 3860, y: GROUND - 118 },
      { kind: "line", x: 4000, y: GROUND - 36, n: 3, dx: 40 },
      { kind: "spot", x: 4040, y: GROUND - 140, golden: true },
    ],
  }),
];

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object") throw new Error("empty");
    return {
      cat: raw.cat || { name: "Miso", gender: "girl", hair: "short", coat: "orange", eyes: "green" },
      sound: raw.sound || { music: 0.32, musicOn: true, effects: 0.8, effectsOn: true },
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
      sound: { music: 0.32, musicOn: true, effects: 0.8, effectsOn: true },
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
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) {
    player.vx += dir * ACCEL * dt;
    player.facing = dir;
  } else {
    const sign = Math.sign(player.vx);
    player.vx -= sign * Math.min(Math.abs(player.vx), 1600 * dt);
  }
  player.vx = Math.max(-MAXRUN, Math.min(MAXRUN, player.vx));
  player.x += player.vx * dt;
  player.coyote = player.onGround ? 0.12 : Math.max(0, player.coyote - dt);
  player.jumpBuf = input.jumpPressed ? 0.12 : Math.max(0, player.jumpBuf - dt);
  const gravity = !input.jump && player.vy < 0 ? GRAV * 2.15 : GRAV;
  player.vy += gravity * dt;
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
    player.vy = JUMP;
    player.onGround = false;
    player.coyote = 0;
    player.jumpBuf = 0;
    player.squash = 0.8;
    audio.meow("kitten");
  }
  player.wasGround = player.onGround;
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

function rememberSafe(state) {
  const player = state.player;
  const feet = player.y + PH;
  const surface = surfaceBelow(state, player.x, feet);
  if (surface == null || Math.abs(surface - feet) > 3) return;
  const crowded = state.level.enemies.some((enemy) => enemy.alive !== false && !enemy.flee && Math.abs(enemy.x - (player.x + PW / 2)) < 64 && Math.abs(enemy.y - player.y) < 48);
  if (crowded) return;
  state.safe = { x: player.x, y: player.y };
}

function respawn(state) {
  const player = state.player;
  const spot = state.safe || { x: state.level.spawn, y: GROUND - PH };
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
  state.fishing = null;
  state.snapCam = true;
  state.respawned = true;
  state.banner = "Back on solid ground";
  state.bannerT = 1.3;
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
      kind: "puff",
      color: "#fff8f2",
    });
  }
}

function playerDirAway(player, enemy) {
  return enemy.x >= player.x ? 1 : -1;
}

function hurt(state, knock) {
  const player = state.player;
  if (player.invuln > 0 || state.won) return;
  player.health -= 1;
  state.shake = 7;
  audio.sting("music-hurt");
  audio.yowl();
  if (knock === "pit" || player.health <= 0) {
    if (player.health <= 0) player.health = 3;
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
    const home = enemy.y;
    if (enemy.kind === "mouse") {
      enemy.dir = enemy.dir || 1;
      enemy.x += enemy.dir * 78 * dt;
      if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.dir *= -1;
      enemy.y = home + Math.abs(Math.sin(enemy.t * 10)) * -8;
    } else if (enemy.kind === "bird") {
      enemy.x += Math.sin(enemy.t * 1.4) * 30 * dt * 8;
      enemy.y = 150 + Math.sin(enemy.t * 2.2) * 24;
      if (Math.abs(player.x - enemy.x) < 160) enemy.y += 40;
    } else if (enemy.kind === "squirrel") {
      enemy.dir = enemy.dir || 1;
      enemy.x += enemy.dir * 90 * dt;
      if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.dir *= -1;
      enemy.cool = (enemy.cool || 1.6) - dt;
      if (enemy.cool <= 0) {
        enemy.cool = 2.2;
        state.shots.push({ x: enemy.x, y: enemy.y, vx: (enemy.dir || 1) * 160, vy: -80, life: 2 });
      }
    } else if (enemy.kind === "fish") {
      const leap = Math.sin(enemy.t * 2.4);
      enemy.y = home - Math.max(0, leap) * 70;
    } else if (enemy.kind === "chicken") {
      const close = Math.abs(player.x - enemy.x) < 180;
      enemy.dir = enemy.dir || 1;
      const speed = close ? 150 : 46;
      if (close) enemy.dir = player.x > enemy.x ? 1 : -1;
      enemy.x += enemy.dir * speed * dt;
      enemy.x = Math.max(enemy.min, Math.min(enemy.max, enemy.x));
      enemy.y = home + (close ? Math.abs(Math.sin(enemy.t * 16)) * -10 : 0);
    }
    nearest = Math.min(nearest, Math.abs(enemy.x - player.x));
    const box = { x: enemy.x - 16, y: enemy.y - 16, w: 36, h: 32 };
    if (player.swipeHit && rectsOverlap(attackBox(player), box)) {
      shoo(state, enemy);
      continue;
    }
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
  if (input.fishPressed) tryFish(state);
  if (state.fishing) updateFishing(state, dt, input);
  else movePlayer(state, dt, input);
  updateFish(state, dt);
  updateEnemies(state, dt);
  updatePose(state, dt);
  const owner = state.level.owner;
  if (player.x + PW > owner.x && player.y + PH > owner.y) finish(state);
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
    return ahead > block.x && ahead < block.x + block.w && block.y >= feet - 4 && block.y < feet + 36;
  });
  const wall = state.level.solids.some((block) => {
    if (block.kind === "pond" || block.kind === "floor") return false;
    return rectsOverlap({ x: player.x + PW, y: player.y + 8, w: 10, h: PH - 20 }, block);
  });
  const foe = state.level.enemies.some((enemy) => enemy.alive !== false && !enemy.flee && enemy.x > player.x - 10 && enemy.x < player.x + 92 && Math.abs(enemy.y - player.y) < 70);
  const needJump = player.onGround && (!supported || wall);
  const holdJump = !player.onGround && player.vy < 0;
  return {
    right: true,
    left: false,
    jump: needJump || holdJump,
    jumpPressed: needJump,
    scratch: foe,
    scratchPressed: foe,
    fish: false,
    fishPressed: false,
  };
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
  while (frames < 60 * 55 && !state.won && state.player.health > 0) {
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
  const far = document.createElement("canvas");
  far.width = 900;
  far.height = 320;
  const f = far.getContext("2d");
  const colors = palette[level.theme];
  const sky = f.createLinearGradient(0, 0, 0, 320);
  sky.addColorStop(0, colors.sky0);
  sky.addColorStop(0.55, colors.sky1);
  sky.addColorStop(1, colors.sky2);
  f.fillStyle = sky;
  f.fillRect(0, 0, 900, 320);
  f.fillStyle = colors.sun;
  f.beginPath();
  f.arc(160, 64, 40, 0, Math.PI * 2);
  f.fill();
  f.fillStyle = colors.hill;
  f.globalAlpha = 0.72;
  f.beginPath();
  f.ellipse(180, 236, 210, 52, 0, 0, Math.PI * 2);
  f.ellipse(620, 248, 250, 44, 0, 0, Math.PI * 2);
  f.fill();
  f.globalAlpha = 0.55;
  f.fillStyle = colors.sill;
  f.beginPath();
  f.ellipse(400, 286, 180, 34, 0, 0, Math.PI * 2);
  f.ellipse(760, 300, 160, 28, 0, 0, Math.PI * 2);
  f.fill();
  f.globalAlpha = 1;
  const mid = document.createElement("canvas");
  mid.width = Math.min(2400, level.width);
  mid.height = 560;
  const m = mid.getContext("2d");
  m.fillStyle = colors.sky1;
  if (level.theme === "living") {
    m.fillStyle = "rgba(255,244,236,0.35)";
    m.fillRect(80, 40, 520, 250);
    m.strokeStyle = "rgba(255,255,255,0.7)";
    m.strokeRect(80, 40, 520, 250);
    const beam = m.createLinearGradient(200, 40, 360, 470);
    beam.addColorStop(0, "rgba(255,236,180,0.0)");
    beam.addColorStop(0.2, "rgba(255,228,160,0.28)");
    beam.addColorStop(1, "rgba(255,228,160,0)");
    m.fillStyle = beam;
    m.beginPath();
    m.moveTo(180, 50);
    m.lineTo(430, 50);
    m.lineTo(560, 470);
    m.lineTo(80, 470);
    m.fill();
  }
  return { far, mid };
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
  if (enemy.kind === "mouse") {
    g.fillStyle = "#c7b4a4";
    g.beginPath();
    g.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2c9c0";
    g.beginPath();
    g.arc(8, -2, 2, 0, Math.PI * 2);
    g.fill();
  } else if (enemy.kind === "bird") {
    g.fillStyle = "#4c8ed9";
    g.beginPath();
    g.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
    g.fill();
    const wing = Math.sin(time * 18) * 6;
    g.beginPath();
    g.ellipse(-2, wing, 8, 3, 0.4, 0, Math.PI * 2);
    g.fill();
  } else if (enemy.kind === "squirrel") {
    g.fillStyle = "#c47a3a";
    g.beginPath();
    g.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(-10, -8, 6, 10, -0.6, 0, Math.PI * 2);
    g.fill();
  } else if (enemy.kind === "fish") {
    drawFish(g, { x: 0, y: 0, golden: false, phase: enemy.t || 0, got: false }, time);
  } else if (enemy.kind === "chicken") {
    g.fillStyle = "#f4efe4";
    g.beginPath();
    g.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e23b3b";
    g.beginPath();
    g.arc(12, -2, 3, 0, Math.PI * 2);
    g.fill();
  }
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

function drawScenery(g, level, time) {
  const colors = palette[level.theme];
  if (level.theme === "living") {
    drawRug(g, 250, GROUND - 4, 150, 28, colors.rug, "#ffd36a");
    drawRug(g, 620, GROUND - 2, 120, 22, colors.table, "#fff6df");
    drawRug(g, 900, GROUND - 4, 100, 20, colors.shelf, "#ffd6ea");
    return;
  }
  const petals = level.theme === "yard"
    ? ["#ff5d8f", "#ffe14a", "#ff8a3d", "#ffffff", "#7c5cff"]
    : level.theme === "neighbor"
      ? ["#ff8fb8", "#ffd29a", "#c9a0ff", "#ffb15a", "#7ee0d6"]
      : ["#ff5d8f", "#ffd23f", "#7c5cff", "#ff8a3d", "#ffffff"];
  const centers = ["#fff6c2", "#ff8a3d", "#ffe14a", "#ff5d8f", "#fff"];
  const count = Math.max(8, Math.floor((level.width - 220) / 92));
  for (let i = 0; i < count; i++) {
    const x = 140 + i * 92;
    drawFlower(g, x, GROUND - 16 - (i % 3) * 4, petals[i % petals.length], centers[i % centers.length], time, i);
  }
}

function drawOwner(g, owner, time) {
  g.save();
  g.translate(owner.x, owner.y);
  g.fillStyle = "#f0c7a4";
  g.beginPath();
  g.arc(0, 10, 12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#e07a3d";
  g.fillRect(-16, 22, 32, 36);
  g.strokeStyle = "#f0c7a4";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(10, 30);
  g.quadraticCurveTo(28, 10 + Math.sin(time * 4) * 8, 24, 4);
  g.stroke();
  g.restore();
}

function drawWorld(state) {
  const level = state.level;
  const w = view.width;
  const h = view.height;
  const shakeX = (Math.random() - 0.5) * state.shake;
  const targetX = state.player.x - w / state.dpr * 0.38 + state.player.facing * 70;
  const targetY = state.player.y - h / state.dpr * 0.62;
  if (state.snapCam) {
    state.camX = targetX;
    state.camY = targetY;
    state.snapCam = false;
  } else {
    state.camX += (targetX - state.camX) * 0.08;
    state.camY += (targetY - state.camY) * 0.08;
  }
  state.camX = Math.max(0, Math.min(level.width - w / state.dpr, state.camX));
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(state.bake.far, -((state.camX * 0.2) % 900), 0, 900, h / state.dpr);
  ctx.drawImage(state.bake.far, -((state.camX * 0.2) % 900) + 900, 0, 900, h / state.dpr);
  ctx.save();
  ctx.translate(-state.camX + shakeX, -state.camY);
  const colors = palette[level.theme];
  const drift = 0.5 + 0.5 * Math.sin(state.time * 0.35);
  ctx.fillStyle = colors.rug;
  ctx.globalAlpha = 0.22 + drift * 0.08;
  ctx.beginPath();
  ctx.ellipse(380, GROUND - 6, 180, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
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
  if (level.theme === "yard" || level.theme === "porch") {
    const origin = level.theme === "yard" ? 90 : 40;
    for (let i = 0; i < 5; i++) {
      const sway = Math.sin(state.time * 0.25 + i) * 24;
      const ray = ctx.createLinearGradient(origin, 0, origin + 260 + i * 90, GROUND);
      ray.addColorStop(0, `rgba(255,236,160,${0.05 + drift * 0.08})`);
      ray.addColorStop(0.35, `rgba(255,220,120,${0.16 + drift * 0.08})`);
      ray.addColorStop(1, "rgba(255,220,120,0)");
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(origin + sway, -20);
      ctx.lineTo(origin + 28 + sway, -20);
      ctx.lineTo(origin + 160 + i * 150, GROUND + 10);
      ctx.lineTo(origin + 40 + i * 150, GROUND + 10);
      ctx.fill();
    }
  }
  if (level.theme === "living") {
    ctx.fillStyle = "rgba(186, 224, 244, 0.85)";
    round(ctx, 70, 70, 520, 230, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 8;
    ctx.stroke();
    const beam = ctx.createLinearGradient(160, 80, 420, GROUND);
    beam.addColorStop(0, "rgba(255,226,150,0)");
    beam.addColorStop(0.25, `rgba(255,210,90,${0.22 + drift * 0.16})`);
    beam.addColorStop(1, "rgba(255,220,140,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(160, 90);
    ctx.lineTo(420, 90);
    ctx.lineTo(620, GROUND);
    ctx.lineTo(40, GROUND);
    ctx.fill();
    ctx.fillStyle = "rgba(255,214,150,0.2)";
    ctx.beginPath();
    ctx.ellipse(420, GROUND - 8, 170, 28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const fish of level.fish) drawFish(ctx, fish, state.time);
  for (const enemy of level.enemies) drawEnemy(ctx, enemy, state.time);
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
  drawScenery(ctx, level, state.time);
  drawOwner(ctx, level.owner, state.time);
  drawCatShadow(ctx, state);
  if (state.player.invuln <= 0 || Math.sin(state.time * 40) > 0) paintCat(ctx, state.cat, state.time);
  for (const bit of state.particles) {
    ctx.globalAlpha = Math.max(0, bit.life / bit.max);
    ctx.fillStyle = bit.color;
    ctx.beginPath();
    ctx.arc(bit.x, bit.y, bit.kind === "spark" ? 4 : 7, 0, Math.PI * 2);
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
  banner.hidden = state.bannerT <= 0;
  banner.textContent = state.banner;
  const nearWater = state.level.water.some((water) => {
    const px = state.player.x + PW / 2;
    return px > water.x - 40 && px < water.x + water.w + 40;
  });
  fishBtn.hidden = !(state.gotRod && nearWater);
}

function loop(now) {
  const dt = Math.min(0.033, (now - (loop.last || now)) / 1000);
  loop.last = now;
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
    };
    pressed.jump = pressed.scratch = pressed.fish = false;
    step(state, dt, input);
    drawWorld(state);
    paintHud();
  } else if (screen === "select") {
    drawPreview();
  }
  requestAnimationFrame(loop);
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

function bindHold(button, key) {
  const down = (event) => {
    event.preventDefault();
    audio.unlock();
    held[key] = true;
    if (key === "jump" || key === "scratch" || key === "fish") pressed[key] = true;
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
  });
  fillJumps();
  syncSound();
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

window.sunbeam = {
  audio,
  get state() { return state; },
  startLevel,
  simulate,
  testPit,
  snapshot,
  swipeSheet,
  LEVELS,
  show,
};
