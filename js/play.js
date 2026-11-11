import { paintCat } from "./kitten.js";
import { clonePose, POSES, POSE_KEYS } from "./poses.js";
import { COAT_ORDER, COATS, EYE_ORDER, EYES, cleanName, swatchBackground } from "./coats.js";
import { PlayAudio } from "./play-audio.js";
import { bakeScene, drawLady, drawMotion } from "./scenery.js";
import { applyClimb, dressLevel, drawBird, drawCans, drawClimbs, drawHazards, nearClimb, nearest, updateCans, updateHazards, birdSheet } from "./hazards.js";
import { EXTRA_LEVELS, WORLDS, worldClues } from "./campaign.js";
import { chooseNode, drawMap, ensureMap, enterCurrent, mapHudReport, pickMap, selectedNode, stepMap } from "./map.js";

const KEY = "sunbeam-play";
const GROUND = 470;
const PW = 32;
const PH = 58;
const GRAV = 1680;
const JUMP = -650;
const MAXRUN = 255;

const audio = new PlayAudio();
const held = { left: false, right: false, up: false, down: false, jump: false, scratch: false, fish: false, action: false };
const pressed = { jump: false, scratch: false, fish: false, action: false, reel: false, done: false };

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
  const flying = kind === "bird" || kind === "crow" || kind === "pigeon" || kind === "parrot";
  let spot = 180 + frac * (width - 360);
  for (let hop = 0; hop < 14; hop++) {
    const nearBed = world.checkpoints.some((mark) => Math.abs(mark.x - spot) < 170);
    const floor = floorAt(world.solids, spot);
    const bodyY = flying ? 214 : kind === "fish" ? GROUND - 6 : GROUND - 24;
    const blocked = world.solids.some((block) => block.kind !== "floor" && block.kind !== "pond" && spot > block.x + 8 && spot < block.x + block.w - 8 && bodyY > block.y && bodyY < block.y + block.h);
    if (floor && !nearBed && !blocked) {
      const y = flying ? 214 : kind === "fish" ? GROUND - 6 : kind === "chicken" || kind === "rooster" || kind === "bulldog" || kind === "nurse" ? GROUND - 30 : GROUND - 20;
      world.enemies = world.enemies || [];
      world.enemies.push({
        kind,
        x: spot,
        y,
        min: floor.x + 70,
        max: floor.x + floor.w - 70,
        hp: extra.hp || 1,
        big: Boolean(extra.big),
        boss: Boolean(extra.boss),
        home: y,
        species: extra.species || (kind === "crow" ? "crow" : kind === "pigeon" ? "pigeon" : kind === "parrot" ? "cardinal" : kind === "bird" ? "jay" : null),
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
    min: plat.x - Math.max(18, Math.min(48, plat.w / 2 - 12)),
    max: plat.x + Math.max(18, Math.min(48, plat.w / 2 - 12)),
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
    if (enemy.kind === "bird" || enemy.kind === "fish" || enemy.kind === "crow" || enemy.kind === "pigeon" || enemy.kind === "parrot") continue;
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
    spawn: 280,
    owner,
    checkpoint: world.checkpoints[0] ? world.checkpoints[0].x : 500,
    checkpoints: world.checkpoints,
    water: world.water,
    rod: typeof spec.rod === "function" ? spec.rod(world, width) : spec.rod ? { x: Math.min(owner.x - 180, 420), y: GROUND - 36 } : null,
    solids: world.solids,
    enemies: world.enemies,
    placed: stockFish(world, spec.fish, owner.x),
    goal: spec.goal || "clue",
    world: spec.world || 0,
    kit: spec.kit || null,
    cluePlan: spec.clue || null,
  });
}

const LEVELS = [
  lay({
    id: "living",
    name: "Living room",
    music: "music-living",
    theme: "living",
    fish: 44,
    goal: "clue",
    world: 0,
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
    goal: "clue",
    world: 0,
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
    goal: "clue",
    world: 0,
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
    goal: "reunion",
    world: 0,
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

function coursePlan(plan) {
  return plan.map((step) => (w) => {
    if (step[0] === "floor") w.floor(step[1]);
    else if (step[0] === "gap") w.gap(step[1]);
    else if (step[0] === "bed") w.bed();
    else if (step[0] === "pond") w.pond(step[1]);
    else if (step[0] === "stairs") w.stairs(step[1], step[2], step[3] || "step");
    else if (step[0] === "set") {
      const span = w.floor(step[1]);
      for (let i = 2; i < step.length; i++) {
        const decor = step[i];
        w.decor(span, decor[0], decor[1], decor[2], decor[3]);
      }
    }
  });
}

for (const spec of EXTRA_LEVELS) {
  LEVELS.push(lay({
    ...spec,
    beats: coursePlan(spec.plan),
    cast(w) {
      (spec.mice || []).forEach((frac) => placeFoe(w, "mouse", frac, w.x));
      (spec.foes || []).forEach((item) => placeFoe(w, item[0], item[1], w.x, item[2] || {}));
    },
  }));
}

const CLUES = [
  { id: "glasses", label: "Glasses", next: "the front porch", open: "Level 1: the living room. Where did she go?", say: "Oh look, her reading glasses! She must have come this way..." },
  { id: "slippers", label: "Slippers", next: "the yard", open: "Level 2: the front porch. Where did she go?", say: "Her slippers! She can't have gone far..." },
  { id: "yarn", label: "Yarn", next: "the neighbor's house", open: "Level 3: the yard. Where did she go?", say: "Her knitting yarn! The trail leads to the neighbor's house..." },
  { id: "keys", label: "Keys", next: "tea with the neighbor", open: "Level 4: the neighbor's house. Where did she go?", say: "Her handbag and keys! She must be having tea just ahead..." },
];
const REUNION_LINE = "There you are. I only sat down for tea with the neighbor.";
const VET_LINE = "The vet is waiting this afternoon. And I heard a little friend of yours is missing, out in the neighborhood.";
const RESCUE_LINE = "You found them. The friend is safe. Now the vet is calling.";
const ESCAPE_LINE = "Out the front doors. She is there, and the rain has started. Home is across the city.";
const FINALE_LINE = "Home. The flap was open, the friend is on the rug, and the rain can stay outside.";

LEVELS.forEach(dressLevel);
LEVELS.forEach((level, index) => {
  const spec = level.cluePlan || CLUES[index];
  if (!spec) return;
  level.clue = {
    id: spec.id,
    label: spec.label,
    intro: spec.intro,
    found: spec.found,
    next: spec.next,
    open: spec.open,
    say: spec.say,
    x: level.owner.x - (level.goal === "reunion" || level.goal === "finale" ? 200 : 110),
    y: GROUND - 36,
    got: false,
  };
  level.ownerHere = level.goal === "reunion" || level.goal === "finale";
});
LEVELS.forEach((level, index) => {
  level.audit = auditReach(level, index);
});

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
      owned: raw.owned || {},
      clues: raw.clues || {},
      map: raw.map || { world: 0, node: "living" },
      cleared: raw.cleared || {},
      easy: Boolean(raw.easy),
      extraHeart: Boolean(raw.extraHeart),
      foundOwner: Boolean(raw.foundOwner),
      friend: Boolean(raw.friend),
      escaped: Boolean(raw.escaped),
      home: Boolean(raw.home),
      plus: Boolean(raw.plus),
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
      owned: {},
      clues: {},
      map: { world: 0, node: "living" },
      cleared: {},
      easy: false,
      extraHeart: false,
      foundOwner: false,
      friend: false,
      escaped: false,
      home: false,
      plus: false,
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
      belly: 0,
      shield: 0,
      shieldGot: false,
      grapple: null,
      mantle: null,
      cling: null,
      clingLock: 0,
      hurt: 0,
      invuln: 0,
      land: 0,
      health: progress.easy || progress.extraHeart ? 4 : 3,
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
  if (player.ride) {
    player.prevJump = !!input.jumpPressed;
    return;
  }
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
  const pace = (player.food > 0 ? 1.34 : 1) * ((player.boost || 0) > 0 ? 1.28 : 1);
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
      player.jumped = true;
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
    const rise = prevFeet - block.y;
    const smallStep = rise <= 6 && rise >= -8;
    const fromJump = player.jumped && prevFeet <= block.y + 10;
    if (player.vy >= 0 && overlapX && feet >= block.y && feet <= block.y + 28 && (smallStep || fromJump)) {
      player.y = block.y - PH;
      player.vy = 0;
      player.onGround = true;
      if (!player.wasGround)       player.land = 0.14;
    }
  }
  if (player.jumpBuf > 0 && (player.onGround || player.coyote > 0)) {
    player.vy = JUMP * (player.food > 0 ? 1.28 : 1);
    player.jumped = true;
    player.onGround = false;
    player.coyote = 0;
    player.jumpBuf = 0;
    player.squash = 0.8;
    player.airJump = state.levelIndex >= 1;
    audio.meow("kitten");
  }
  if (player.bounce) {
    player.vy = player.bounce;
    player.jumped = true;
    player.onGround = false;
    player.bounce = 0;
  }
  if (player.onGround) player.jumped = false;
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
  player.ride = null;
  audio.hum(false, 0);
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
  clearAround(state, player.x);
}

function clearAround(state, x) {
  const ahead = x + 16;
  for (const enemy of state.level.enemies) {
    const spot = enemy.perchX == null ? enemy.x : Math.min(enemy.x, enemy.perchX);
    if (Math.abs(spot - ahead) > 420) continue;
    const shift = ahead + 320 - spot;
    if (shift <= 8) continue;
    enemy.x += shift;
    if (enemy.perchX != null) enemy.perchX += shift;
    if (enemy.min != null) enemy.min += shift;
    if (enemy.max != null) enemy.max += shift;
  }
  state.spawnGrace = 1.6;
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
  enemy.dive = null;
  enemy.flee = 1;
  enemy.vy = -220;
  enemy.vx = playerDirAway(state.player, enemy) * 180;
  const chain = state.comboAt != null && state.time - state.comboAt < 1.5;
  state.combo = chain ? (state.combo || 1) + 1 : 1;
  state.comboAt = state.time;
  state.comboT = 1.5;
  state.shake = Math.min(12, 4 + state.combo * 1.5);
  if (state.combo >= 3 && state.combo % 3 === 0) {
    state.progress.fishBank += 1;
    state.banner = `Combo ${state.combo}! A bonus fish.`;
    state.bannerT = 1.2;
  }
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
  if (player.ride || player.invuln > 0) return;
  if (player.shield > 0) {
    player.shield = 0;
    player.invuln = 1.15;
    state.shake = 4;
    state.banner = "The purr shield took that.";
    state.bannerT = 1.2;
    audio.blip(520, 0.08, 0.04);
    return;
  }
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

function steerBird(state, enemy, dt) {
  const player = state.player;
  enemy.perchX = enemy.perchX == null ? enemy.x : enemy.perchX;
  enemy.perchY = enemy.perchY == null ? enemy.home || enemy.y : enemy.perchY;
  const screen = Math.max(640, view && view.width ? view.width / (state.dpr || 1) : 800);
  const ahead = enemy.perchX - player.x;
  const passed = player.x > enemy.perchX - 16;
  if (passed || (enemy.dive && enemy.x < player.x + 6)) {
    enemy.dive = null;
    enemy.diveT = 0;
    enemy.gone = true;
    enemy.wait = enemy.t + 4;
  }
  if (enemy.gone) {
    enemy.x += 110 * dt;
    enemy.y += (enemy.perchY - 24 - enemy.y) * Math.min(1, dt * 3);
    return;
  }
  const lead = Math.min(420, screen * 0.5);
  if (!enemy.dive && !enemy.gone && ahead < lead && ahead > 150 && enemy.t > (enemy.wait || 0)) {
    enemy.dive = "warn";
    enemy.warn = 0.7;
    enemy.diveT = 0;
    audio.tweet();
  }
  if (enemy.dive === "warn") {
    enemy.warn -= dt;
    enemy.x = enemy.perchX + Math.sin(enemy.t * 36) * 4;
    enemy.y = enemy.perchY + Math.sin(enemy.t * 28) * 3;
    if (ahead < 80) {
      enemy.dive = null;
      enemy.gone = true;
    } else if (enemy.warn <= 0) enemy.dive = "go";
  } else if (enemy.dive === "go") {
    enemy.diveT = (enemy.diveT || 0) + dt;
    const t = enemy.diveT / 0.82;
    if (t >= 1 || ahead < 36) {
      enemy.dive = null;
      enemy.diveT = 0;
      enemy.wait = enemy.t + 2.4;
      if (ahead < 36) enemy.gone = true;
    } else {
      const lead = Math.max(player.x + 72, Math.min(enemy.perchX - 12, player.x + Math.max(90, (player.vx || 0) * 0.45)));
      enemy.x = enemy.perchX + (lead - enemy.perchX) * Math.sin(Math.min(1, t) * Math.PI * 0.55);
      enemy.y = enemy.perchY + Math.sin(t * Math.PI) * Math.min(160, Math.max(70, GROUND - 90 - enemy.perchY));
      if (enemy.diveT > 0.15 && !enemy.feather) {
        enemy.feather = true;
        state.particles.push({ x: enemy.x, y: enemy.y, vx: -20, vy: 16, life: 0.6, max: 0.6, kind: "puff", color: "#f7f4ea" });
      }
      enemy.x = Math.max(enemy.x, player.x + 24);
      if (enemy.x < player.x + 16) {
        enemy.dive = null;
        enemy.diveT = 0;
        enemy.gone = true;
      }
    }
  } else {
    enemy.x = enemy.perchX + Math.sin(enemy.t * 1.3) * 8;
    enemy.y = enemy.perchY + Math.sin(enemy.t * 2.2) * 6;
  }
  if ((enemy.dive === "warn" || enemy.dive === "go") && enemy.x < player.x + 8) {
    enemy.dive = null;
    enemy.diveT = 0;
    enemy.gone = true;
    enemy.x = Math.max(enemy.x, player.x + 16);
  }
}

function beginPatrol(enemy, dt) {
  enemy.dir = enemy.dir === -1 ? -1 : 1;
  enemy.turnCd = Math.max(0, (enemy.turnCd || 0) - dt);
}

function tryTurn(enemy) {
  if ((enemy.turnCd || 0) > 0) return false;
  enemy.dir = enemy.dir === -1 ? 1 : -1;
  enemy.turnCd = 0.55;
  return true;
}

function patrolSpan(enemy) {
  let min = Number(enemy.min);
  let max = Number(enemy.max);
  if (!Number.isFinite(min)) min = enemy.x - 48;
  if (!Number.isFinite(max)) max = enemy.x + 48;
  if (max < min) {
    const swap = min;
    min = max;
    max = swap;
  }
  enemy.min = min;
  enemy.max = max;
  return { min, max, span: max - min };
}

function walled(state, enemy, dir) {
  const x = enemy.x + dir * 18;
  const y = enemy.y - 6;
  return state.level.solids.some((block) => {
    if (!block || block.kind === "floor" || block.kind === "pond") return false;
    const h = block.h || 18;
    if (h < 22 && y <= block.y) return false;
    return x > block.x + 8 && x < block.x + block.w - 8 && y > block.y + 10 && y < block.y + h - 4;
  });
}

function patrolMove(state, enemy, dt, speed) {
  const { min, max, span } = patrolSpan(enemy);
  if (span < 22) {
    enemy.x = (min + max) / 2;
    return false;
  }
  const ahead = walled(state, enemy, enemy.dir);
  const behind = walled(state, enemy, -enemy.dir);
  if (ahead && behind) return false;
  const pace = span < 90 ? Math.min(speed, 42) : speed;
  const next = enemy.x + enemy.dir * pace * dt;
  const edge = ahead || next < min || next > max;
  if (!edge) {
    enemy.x = next;
    return false;
  }
  if (!tryTurn(enemy)) {
    enemy.x = Math.max(min, Math.min(max, enemy.x));
    return false;
  }
  enemy.x = Math.max(min + 2, Math.min(max - 2, enemy.x + enemy.dir * 14));
  return true;
}

function cue(enemy, dt, fn) {
  enemy.voice = (enemy.voice || 0) - dt;
  if (enemy.voice > 0) return;
  enemy.voice = 2.4;
  fn();
}

const CRITTERS = {
  raccoon: "#8d8078",
  dog: "#c9843a",
  bulldog: "#d7a15a",
  possum: "#c9b8b0",
  toy: "#d23d55",
  tech: "#7ec8c3",
  nurse: "#f2f6f8",
  alley: "#4a403c",
};

function actCritter(state, enemy, dt, player) {
  enemy.dead = Math.max(0, (enemy.dead || 0) - dt);
  enemy.cool = Math.max(0, (enemy.cool || 0) - dt);
  const ahead = player.x > enemy.x - 20 && player.x < enemy.x + 280;
  const close = Math.abs(player.x - enemy.x) < 90;
  if (enemy.kind === "possum" && enemy.dead > 0) {
    enemy.y = (enemy.home || enemy.y) + 6;
    return;
  }
  const speed = enemy.kind === "toy" ? 110 : enemy.kind === "possum" ? 26 : enemy.phase === "chase" ? 88 : 46;
  patrolMove(state, enemy, dt, speed);
  enemy.y = (enemy.home || enemy.y) + Math.abs(Math.sin(enemy.t * 10)) * -4;
  if (enemy.kind === "raccoon" && ahead && enemy.cool <= 0) {
    enemy.cool = 2.4;
    audio.chitter();
    state.shots.push({ x: enemy.x, y: enemy.y - 8, vx: 140, vy: -160, life: 1.4, kind: "acorn" });
  } else if ((enemy.kind === "dog" || enemy.kind === "bulldog") && ahead && enemy.cool <= 0) {
    enemy.cool = 2.2;
    audio.bark();
    state.shots.push({ x: enemy.x + 10, y: GROUND - 16, vx: 160, vy: 0, life: 0.8, kind: "wave" });
  } else if (enemy.kind === "possum" && close) {
    enemy.dead = 1.3;
  } else if ((enemy.kind === "tech" || enemy.kind === "nurse") && ahead && enemy.phase !== "chase") {
    enemy.phase = "chase";
    enemy.chase = 2;
    state.banner = "Spotted! Slip past the carrier.";
    state.bannerT = 1.2;
    audio.buzz();
  }
  if (enemy.phase === "chase") {
    enemy.chase -= dt;
    if (enemy.chase <= 0) enemy.phase = "strut";
    if (enemy.cool <= 0 && enemy.kind === "nurse") {
      enemy.cool = 1.8;
      state.shots.push({ x: enemy.x, y: enemy.y - 10, vx: 120, vy: -40, life: 1.2, kind: "wave" });
    }
  }
}

function updateEnemies(state, dt) {
  const player = state.player;
  let nearest = 9999;
  for (const enemy of state.level.enemies) {
    if (enemy.flee) {
      enemy.dive = null;
      enemy.flee -= dt;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.vy += 500 * dt;
      continue;
    }
    if (enemy.alive === false) continue;
    if (player.ride) {
      const dx = enemy.x - (player.x + 16);
      const dy = enemy.y - (player.y + 28);
      if (dx * dx + dy * dy < 48 * 48) {
        shoo(state, enemy);
        continue;
      }
    }
    enemy.t = (enemy.t || 0) + dt;
    const home = enemy.home == null ? enemy.y : enemy.home;
    if (enemy.stun > 0) {
      enemy.stun -= dt;
      enemy.x += (enemy.vx || 0) * dt;
      enemy.vx *= 0.9;
    } else if (enemy.kind === "mouse") {
      beginPatrol(enemy, dt);
      if (enemy.hole && !enemy.popped) {
        enemy.y = home + 16;
        if (player.x < enemy.x + 30 && Math.abs(player.x - enemy.x) < 190) {
          enemy.popped = true;
          enemy.dir = -1;
          enemy.turnCd = 0.45;
          audio.squeak();
        }
      } else if (enemy.chaser) {
        const { min, max } = patrolSpan(enemy);
        const goal = Math.max(min, Math.min(max, player.x + 160));
        const next = Math.sign(goal - enemy.x || enemy.dir);
        if (Math.abs(goal - enemy.x) > 10 && next !== enemy.dir) tryTurn(enemy);
        if ((enemy.turnCd || 0) < 0.4) enemy.x = Math.max(min, Math.min(max, enemy.x + enemy.dir * 110 * dt));
        enemy.y = home + Math.abs(Math.sin(enemy.t * 16)) * -6;
      } else {
        const zig = Math.sin(enemy.t * 2.1) > 0;
        if (enemy.zig == null) enemy.zig = zig;
        else if (zig !== enemy.zig) {
          enemy.zig = zig;
          tryTurn(enemy);
        }
        patrolMove(state, enemy, dt, enemy.group ? 120 : 100);
        enemy.y = home + Math.abs(Math.sin(enemy.t * 16)) * -7;
        if (Math.abs(player.x - enemy.x) < 180) cue(enemy, dt, () => audio.squeak());
      }
      if (enemy.hole && !enemy.popped) continue;
    } else if (enemy.kind === "bird" || enemy.kind === "crow" || enemy.kind === "pigeon" || enemy.kind === "parrot") {
      steerBird(state, enemy, dt);
      enemy.cool = Math.max(0, (enemy.cool || 0) - dt);
      if (enemy.kind === "crow" && Math.abs(player.x - enemy.x) < 70 && enemy.cool <= 0) {
        enemy.cool = 4;
        audio.chatter();
      }
    } else if (enemy.kind === "squirrel") {
      beginPatrol(enemy, dt);
      patrolMove(state, enemy, dt, 62);
      enemy.cool = (enemy.cool == null ? 1.4 : enemy.cool) - dt;
      enemy.wind = Math.max(0, (enemy.wind || 0) - dt);
      const facing = player.x > enemy.x - 20 && player.x < enemy.x + 360;
      if (enemy.cool <= 0 && facing) {
        enemy.wind = 0.4;
        enemy.cool = 2.3;
        audio.chatter();
      }
      if (enemy.wind > 0 && enemy.wind < 0.05) {
        const aim = player.x + 16 + Math.max(0, player.vx || 0) * 0.32;
        state.shots.push({
          x: enemy.x + 8,
          y: enemy.y - 8,
          vx: Math.max(-40, Math.min(210, (aim - enemy.x) * 1.15)),
          vy: -190,
          life: 1.7,
          kind: "acorn",
        });
        enemy.wind = 0;
      }
    } else if (enemy.kind === "fish") {
      const leap = Math.sin(enemy.t * 2.4 + (enemy.x || 0) * 0.01);
      const rising = leap > 0.35;
      if (rising && !enemy.up) {
        audio.splash();
        state.particles.push({ x: enemy.x, y: home, vx: 0, vy: -20, life: 0.35, max: 0.35, kind: "puff", color: "#d7f3ff" });
      }
      enemy.up = rising;
      enemy.y = home - Math.max(0, leap) * 78;
    } else if (enemy.kind === "chicken" || enemy.kind === "rooster") {
      const reach = enemy.kind === "rooster" ? 230 : 150;
      const close = Math.abs(player.x - enemy.x) < reach;
      beginPatrol(enemy, dt);
      enemy.phase = enemy.phase || "strut";
      if (!close && enemy.phase !== "charge") enemy.phase = "strut";
      if (enemy.phase === "strut") {
        patrolMove(state, enemy, dt, enemy.kind === "rooster" ? 32 : 38);
        if (close) {
          const boss = enemy.kind === "rooster";
          const hp = enemy.hp || 1;
          enemy.phase = "wind";
          enemy.wind = boss && hp >= 3 ? 0.62 : boss ? 0.5 : 0.32;
          enemy.dir = player.x > enemy.x ? 1 : -1;
          enemy.act = boss && hp >= 3 ? "wave" : boss && hp <= 1 ? "eggs" : "charge";
          if (!boss) enemy.egged = false;
          if (boss) audio.crow();
          else audio.cluck();
        }
      } else if (enemy.phase === "wind") {
        enemy.wind -= dt;
        if (enemy.wind <= 0) {
          enemy.phase = "charge";
          enemy.charge = enemy.kind === "rooster" ? 0.7 : 0.42;
        }
      } else {
        const fed = player.food > 0 && enemy.kind === "rooster";
        const speed = (enemy.kind === "rooster" ? 145 : 108) * (fed ? 0.6 : 1);
        const turned = patrolMove(state, enemy, dt, speed);
        enemy.charge -= dt;
        if (enemy.charge <= 0 || turned) {
          enemy.phase = "strut";
          if (enemy.kind === "chicken" && !enemy.egged) {
            enemy.egged = true;
            state.shots.push({ x: enemy.x, y: enemy.y + 4, vx: enemy.dir * 80, vy: -30, life: 2, kind: "egg" });
          }
          if (enemy.act === "wave") {
            state.shots.push({ x: enemy.x, y: GROUND - 14, vx: enemy.dir * 150, vy: 0, life: 1.3, kind: "wave" });
          }
          if (enemy.act === "eggs") {
            state.shots.push({ x: enemy.x, y: enemy.y - 6, vx: enemy.dir * 120, vy: -150, life: 1.8, kind: "egg" });
          }
          enemy.egged = enemy.kind === "chicken";
        }
      }
      enemy.x = Math.max(enemy.min, Math.min(enemy.max, enemy.x));
      enemy.y = home + Math.abs(Math.sin(enemy.t * 14)) * -6;
    } else if (CRITTERS[enemy.kind]) {
      beginPatrol(enemy, dt);
      actCritter(state, enemy, dt, player);
    }
    nearest = Math.min(nearest, Math.abs(enemy.x - player.x));
    const scale = enemy.kind === "bird" ? 1.25 : enemy.big ? 1.45 : 1.2;
    const box = { x: enemy.x - 18 * scale, y: enemy.y - 18 * scale, w: 36 * scale, h: 32 * scale };
    const reach = player.food > 0 ? 84 : 70;
    const lunge = {
      x: player.facing > 0 ? player.x + 4 : player.x - reach + 8,
      y: player.y + 4,
      w: reach,
      h: 54,
    };
    const stomp = player.vy > 90 && player.y + PH < enemy.y + 10 && rectsOverlap({ x: player.x, y: player.y + PH - 12, w: PW, h: 16 }, box);
    if (stomp || (player.pounce > 0 && rectsOverlap(lunge, box))) {
      enemy.hp = player.food > 0 ? 0 : (player.belly > 0 && enemy.kind === "rooster" ? (enemy.hp || 1) - 2 : (enemy.hp || 1) - 1);
      player.vy = -300;
      if (enemy.hp <= 0) shoo(state, enemy);
      continue;
    }
    if (player.swipeHit && rectsOverlap(attackBox(player), box)) {
      enemy.hp = player.food > 0 ? 0 : (player.belly > 0 && enemy.kind === "rooster" ? (enemy.hp || 1) - 2 : (enemy.hp || 1) - 1);
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
    if (!(enemy.dead > 0) && !(state.spawnGrace > 0) && player.invuln <= 0 && rectsOverlap(body(player), box)) hurt(state, enemy.x < player.x ? 180 : -180);
    if (enemy.kind === "bird" && (enemy.dive === "warn" || enemy.dive === "go") && enemy.x < player.x) {
      enemy.dive = null;
      enemy.diveT = 0;
      enemy.gone = true;
    }
  }
  state.tension = nearest < 240 ? 1 - nearest / 240 : 0;
  state.shots = state.shots.filter((shot) => {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.kind === "wave") shot.y = GROUND - 14;
    else if (shot.kind === "egg") shot.vy = Math.min(80, shot.vy + 260 * dt);
    else shot.vy += 420 * dt;
    const cx = player.x + 16;
    const cy = player.y + 28;
    const swat = (player.swipeHit || player.pounce > 0) && Math.hypot(shot.x - cx, shot.y - cy) < 48;
    if (swat) {
      state.particles.push({ x: shot.x, y: shot.y, vx: 0, vy: -30, life: 0.3, max: 0.3, kind: "star", color: "#fff3b0" });
      return false;
    }
    if (!player.ride && !(state.spawnGrace > 0) && player.invuln <= 0 && Math.hypot(shot.x - cx, shot.y - cy) < 20) {
      hurt(state, shot.vx > 0 ? 120 : -120);
      return false;
    }
    return shot.life > 0 && shot.y < GROUND + 8;
  });
}

function updatePose(state, dt) {
  const player = state.player;
  const cat = state.cat;
  let pose = "stand";
  if (player.ride) pose = "sit";
  else if (state.won) pose = "sit";
  else if (player.hurt > 0) pose = "sit";
  else if (!player.onGround && player.vy < 0) pose = "pounce";
  else if (!player.onGround) pose = "stretch";
  else if (Math.abs(player.vx) > 150) pose = "run";
  else if (Math.abs(player.vx) > 20) pose = "walk";
  player.pose = pose;
  const target = POSES[pose] || POSES.stand;
  if (player.ride) {
    for (const key of POSE_KEYS) cat.m[key] = target[key];
  } else {
    for (const key of POSE_KEYS) cat.m[key] += (target[key] - cat.m[key]) * Math.min(1, dt * 8);
  }
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
  cat.tailAmp = player.ride ? 16 : pose === "run" ? 12 : 7;
  cat.tailSpeed = player.ride ? 6.4 : pose === "run" ? 6 : 1.5;
  if (player.ride) cat.gaitBlend = 0;
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
  state.banner = "Wait for the tug, then tap Reel.";
  state.bannerT = 1.2;
}

function updateFishing(state, dt, input) {
  const fish = state.fishing;
  if (!fish) return;
  if (input.donePressed) {
    state.fishing = null;
    state.banner = "The line is in.";
    state.bannerT = 0.8;
    return;
  }
  fish.t += dt;
  const reel = !!(input.jumpPressed || input.reelPressed || input.fishPressed);
  if (!fish.caught && reel && fish.t > fish.bite && fish.t < fish.bite + 0.42) {
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
  const cans = state.level.cans || [];
  const filled = cans.filter((can) => can.got).length;
  const fullBelly = cans.length > 0 && filled >= cans.length;
  const most = ratio >= 0.85;
  state.stars = fullBelly && most ? 3 : (fullBelly || most || filled >= 2 || ratio >= 0.55) ? 2 : 1;
  const prev = state.progress.stars[state.level.id] || 0;
  state.progress.stars[state.level.id] = Math.max(prev, state.stars);
  const earned = Object.values(state.progress.stars).reduce((sum, n) => sum + n, 0);
  state.progress.owned = state.progress.owned || {};
  if (earned >= 3) state.progress.owned.collar = true;
  if (earned >= 6) state.progress.owned.hat = true;
  state.progress.bestFish[state.level.id] = Math.max(state.progress.bestFish[state.level.id] || 0, state.fishGot);
  state.progress.unlocked = Math.max(state.progress.unlocked, state.levelIndex + 2);
  if (state.level.rod) state.progress.rod = true;
  state.progress.cleared = state.progress.cleared || {};
  state.progress.cleared[state.level.id] = true;
  if (state.level.goal === "reunion") state.progress.foundOwner = true;
  if (state.level.goal === "rescue") state.progress.friend = true;
  if (state.level.goal === "escape") state.progress.escaped = true;
  if (state.level.goal === "finale") state.progress.home = true;
  saveProgress(state.progress);
  const finale = state.level.goal === "finale";
  const reunion = state.level.goal === "reunion";
  audio.setPurr(finale || reunion);
  if (finale) {
    audio.sting("music-fanfare");
    audio.playMusic("music-inside");
    audio.meow("greet");
    state.speech = { text: FINALE_LINE, after: "complete" };
  } else if (reunion) {
    audio.sting("music-fanfare");
    audio.playMusic("music-inside");
    audio.meow("greet");
    state.speech = { text: REUNION_LINE, after: "more" };
    state.speechNext = VET_LINE;
  } else if (state.level.goal === "rescue") {
    audio.sting("music-fanfare");
    audio.ding();
    state.speech = { text: RESCUE_LINE, after: "complete" };
  } else if (state.level.goal === "escape") {
    audio.sting("music-sting");
    audio.ding();
    state.speech = { text: ESCAPE_LINE, after: "complete" };
  } else {
    audio.sting("music-sting");
    audio.ding();
    state.speech = { text: state.level.clue ? state.level.clue.say : "Onward.", after: "complete" };
  }
  state.mode = "play";
  paintSpeech();
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
  const field = updateHazards(state, dt, audio, input);
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
  const clue = state.level.clue;
  if (clue && !clue.got) {
    const dx = clue.x - (player.x + PW / 2);
    const dy = clue.y - (player.y + PH / 2);
    if (dx * dx + dy * dy < 70 * 70) {
      clue.got = true;
      state.progress.clues = state.progress.clues || {};
      state.progress.clues[clue.id] = true;
      saveProgress(state.progress);
      if (state.level.goal === "clue" || state.level.goal === "rescue" || state.level.goal === "escape") finish(state);
      else {
        state.speech = { text: clue.say, after: "play" };
        audio.sting("music-sting");
        audio.ding();
        paintSpeech();
      }
    }
  }
  const owner = state.level.owner;
  if ((state.level.goal === "reunion" || state.level.goal === "finale") && player.x + PW > owner.x && player.y + PH > owner.y) finish(state);
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
  if (state.level.theme === "night" && state.time % 9 < dt) audio.thunder();
  state.bannerT = Math.max(0, state.bannerT - dt);
  state.shake = Math.max(0, state.shake - dt * 12);
  state.comboT = Math.max(0, (state.comboT || 0) - dt);
  state.spawnGrace = Math.max(0, (state.spawnGrace || 0) - dt);
  if ((player.boost || 0) > 0) player.boost -= dt;
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
  const air = !player.cling && state.levelIndex >= 1 && !player.onGround && player.airJump && player.vy > 40 && rising;
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
  return { id, won: state.won, x: Math.round(state.player.x), health: state.player.health, fish: state.fishGot, total: state.level.fishValue, frames, speech: state.speech ? state.speech.text : "" };
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
  street: { sky0: "#49b7ee", sky1: "#c6f0a0", sky2: "#fff0c4", sun: "#fff6c8", hill: "#3f9a55", floor: "#d8a15a", couch: "#ff8a3d", table: "#f2c14b", shelf: "#7d5cff", sill: "#8ed56a", hearth: "#c9843a", rug: "#e7a0b0" },
  vet: { sky0: "#d5e4f0", sky1: "#f4efe8", sky2: "#ffffff", sun: "#fff", hill: "#8fb8d6", floor: "#d5dde4", couch: "#7ec8c3", table: "#f7f1ea", shelf: "#c9d6e0", sill: "#b7d4c8", hearth: "#8aa0b2", rug: "#f2c14b" },
  night: { sky0: "#241c38", sky1: "#6a4a68", sky2: "#1d2430", sun: "#f2c14b", hill: "#3d4a58", floor: "#5a4632", couch: "#c45a4a", table: "#f2c14b", shelf: "#6a4a68", sill: "#7ea0c4", hearth: "#e07a3d", rug: "#2c3340" },
};

function blockColor(theme, kind) {
  const colors = palette[theme] || palette.living;
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
  if (fish.enemy) {
    g.fillStyle = fish.golden ? "#e0a040" : "#6ec0e4";
    g.beginPath();
    g.moveTo(-1, -6);
    g.quadraticCurveTo(3, -13, 7, -5);
    g.fill();
    g.beginPath();
    g.ellipse(-1, 4, 5, 2.2, 0.5, 0, Math.PI * 2);
    g.fill();
  }
  if (!fish.enemy) {
    g.save();
    g.rotate(time * 3 + (fish.phase || 0));
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(10, -1, 5, 2);
    g.restore();
  }
  g.restore();
}

function softBody(g, color) {
  g.save();
  g.strokeStyle = color;
  g.globalAlpha = 0.4;
  g.lineWidth = 1;
  g.lineJoin = "round";
  g.stroke();
  g.restore();
}

function limb(g, x, y, phase, color, foot, len = 9) {
  const swing = Math.sin(phase) * 4.5;
  g.strokeStyle = color;
  g.lineWidth = 1.35;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + swing * 0.4, y + len * 0.45, x + swing, y + len);
  g.stroke();
  g.fillStyle = foot;
  g.beginPath();
  g.ellipse(x + swing, y + len + 1, 2.3, 1.35, swing * 0.04, 0, Math.PI * 2);
  g.fill();
}

function drawMouse(g, enemy, step) {
  const sway = Math.sin(step * 0.32);
  g.strokeStyle = "#b08978";
  g.lineWidth = 1.25;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(-13, 3);
  g.quadraticCurveTo(-28, 10 + sway * 2, -38, -1);
  g.quadraticCurveTo(-46, -12, -36, -16 + sway * 3);
  g.stroke();
  limb(g, -9, 7, step, "#c4a08a", "#f3b4c4", 10);
  limb(g, -3, 8, step + Math.PI, "#c4a08a", "#f3b4c4", 10);
  const body = g.createLinearGradient(-16, -8, 8, 12);
  body.addColorStop(0, "#f6e4d6");
  body.addColorStop(0.5, "#e2b89a");
  body.addColorStop(1, "#c48b72");
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-15, 1);
  g.bezierCurveTo(-18, -8, -6, -6, 2, -3);
  g.bezierCurveTo(8, -1, 7, 9, -1, 11);
  g.bezierCurveTo(-12, 14, -18, 8, -15, 1);
  g.fill();
  softBody(g, "#a67b64");
  g.fillStyle = "rgba(255, 246, 240, 0.9)";
  g.beginPath();
  g.ellipse(-3, 5, 7, 4.2, 0.15, 0, Math.PI * 2);
  g.fill();
  const head = g.createLinearGradient(4, -12, 20, 4);
  head.addColorStop(0, "#f8eadf");
  head.addColorStop(1, "#e4bea4");
  g.fillStyle = head;
  g.beginPath();
  g.arc(8, -1, 7.4, 0, Math.PI * 2);
  g.fill();
  softBody(g, "#c49982");
  g.fillStyle = "#f8ebe3";
  g.beginPath();
  g.moveTo(11, -1);
  g.quadraticCurveTo(21, -4, 20, 2);
  g.quadraticCurveTo(17, 6, 11, 4);
  g.fill();
  g.fillStyle = "#e57b93";
  g.beginPath();
  g.ellipse(19.2, 0.2, 1.7, 1.25, 0.3, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(92, 62, 52, 0.55)";
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(15, -0.5);
  g.lineTo(26, -4);
  g.moveTo(15, 0.6);
  g.lineTo(27, 1);
  g.moveTo(15, 1.8);
  g.lineTo(25, 5);
  g.stroke();
  g.fillStyle = "#241c18";
  g.beginPath();
  g.arc(11.2, -2.6, 1.45, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(11.6, -3.05, 0.45, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#d7b49a";
  g.beginPath();
  g.arc(3.5, -14.5, 7.2, 0, Math.PI * 2);
  g.arc(12.5, -16, 7.4, 0, Math.PI * 2);
  g.fill();
  softBody(g, "#b08a74");
  g.fillStyle = "#f7b7c8";
  g.beginPath();
  g.arc(3.5, -14.5, 4.1, 0, Math.PI * 2);
  g.arc(12.5, -16, 4.2, 0, Math.PI * 2);
  g.fill();
  limb(g, 3, 5, step + 1.2, "#e7c2ae", "#f6b7c8", 6.5);
  limb(g, 7, 6, step + Math.PI + 1.2, "#e7c2ae", "#f6b7c8", 6.5);
  if (enemy.cheese) {
    g.fillStyle = "#f2c14b";
    g.beginPath();
    g.moveTo(14, 7);
    g.lineTo(23, 9);
    g.lineTo(16, 15);
    g.closePath();
    g.fill();
    g.fillStyle = "#e2a33a";
    g.beginPath();
    g.arc(18, 10, 1.2, 0, Math.PI * 2);
    g.fill();
  }
}

function drawEnemy(g, enemy, time) {
  if (enemy.alive === false && !enemy.flee) return;
  g.save();
  g.globalAlpha = enemy.flee ? Math.max(0, enemy.flee) : 1;
  g.translate(enemy.x, enemy.y);
  if (enemy.kind !== "bird") g.scale(enemy.kind === "rooster" ? 1.9 : 1.8, enemy.kind === "rooster" ? 1.9 : 1.8);
  const step = (enemy.t || time) * (Math.abs(enemy.dir || 1) ? 13 : 8);
  const face = enemy.dir === -1 ? -1 : 1;
  if (enemy.kind === "mouse") {
    g.save();
    g.scale(face, 1);
    drawMouse(g, enemy, step);
    g.restore();
  } else if (enemy.kind === "bird" || enemy.kind === "crow" || enemy.kind === "pigeon" || enemy.kind === "parrot") {
    drawBird(g, enemy, time);
  } else if (enemy.kind === "squirrel") {
    g.save();
    g.scale(face, 1);
    limb(g, -5, 6, step, "#b86a28", "#f2c9a0", 8);
    limb(g, 0, 7, step + Math.PI, "#b86a28", "#f2c9a0", 8);
    limb(g, 5, 6, step + 0.8, "#b86a28", "#f2c9a0", 7);
    limb(g, 9, 7, step + Math.PI + 0.8, "#b86a28", "#f2c9a0", 7);
    g.fillStyle = "#e39a55";
    g.beginPath();
    g.ellipse(-14, -2, 8, 12, -0.8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2c9a0";
    g.beginPath();
    g.ellipse(-15, 2, 4, 7, -0.7, 0, Math.PI * 2);
    g.fill();
    softBody(g, "#c47a34");
    g.fillStyle = "#d4843c";
    g.beginPath();
    g.ellipse(1, 2, 13, 8, 0, 0, Math.PI * 2);
    g.fill();
    softBody(g, "#b86a28");
    g.fillStyle = "#f6d7b4";
    g.beginPath();
    g.ellipse(5, 4, 6, 3.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1d2430";
    g.beginPath();
    g.arc(8, 0, 1.15, 0, Math.PI * 2);
    g.fill();
    if (enemy.wind > 0.05) {
      g.fillStyle = "#8a5a32";
      g.beginPath();
      g.arc(14, -8 - enemy.wind * 10, 3.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  } else if (enemy.kind === "fish") {
    drawFish(g, { x: 0, y: 0, golden: false, phase: enemy.t || 0, got: false, enemy: true }, time);
  } else if (enemy.kind === "chicken" || enemy.kind === "rooster") {
    const rooster = enemy.kind === "rooster";
    const stride = step * (enemy.phase === "charge" ? 1.4 : 0.8);
    limb(g, -3, 8, stride, "#e2b84a", "#f2c14b", 11);
    limb(g, 4, 8, stride + Math.PI, "#e2b84a", "#f2c14b", 11);
    g.strokeStyle = "#e2b84a";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-3 + Math.sin(stride) * 4, 20);
    g.lineTo(-6 + Math.sin(stride) * 4, 22);
    g.moveTo(-3 + Math.sin(stride) * 4, 20);
    g.lineTo(-1 + Math.sin(stride) * 4, 22);
    g.moveTo(4 + Math.sin(stride + Math.PI) * 4, 20);
    g.lineTo(7 + Math.sin(stride + Math.PI) * 4, 22);
    g.stroke();
    if (rooster) {
      g.fillStyle = "#c46a22";
      g.beginPath();
      g.moveTo(-8, -2);
      g.quadraticCurveTo(-22, -16, -12, 4);
      g.quadraticCurveTo(-18, -6, -6, 2);
      g.fill();
      softBody(g, "#a85a18");
    }
    g.fillStyle = rooster ? "#f0a03a" : "#f7f1e6";
    g.beginPath();
    g.ellipse(0, 2, rooster ? 16 : 14, 10, 0, 0, Math.PI * 2);
    g.fill();
    softBody(g, rooster ? "#d4843c" : "#e2d3c4");
    g.save();
    g.translate(-4, -1);
    g.rotate(Math.sin(time * 8 + (enemy.x || 0)) * 0.35);
    g.fillStyle = rooster ? "#e08a28" : "#fff8f2";
    g.beginPath();
    g.ellipse(0, -2, 9, 4.5, -0.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = "#fff6ee";
    g.beginPath();
    g.arc(11, -3, 6.2, 0, Math.PI * 2);
    g.fill();
    softBody(g, "#ead8c8");
    g.fillStyle = "#e23b3b";
    g.beginPath();
    g.ellipse(12, -9, 3.4, rooster ? 6.5 : 3.6, 0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2c14b";
    g.beginPath();
    g.moveTo(16, -3);
    g.lineTo(22, -1);
    g.lineTo(16, 1);
    g.fill();
    g.fillStyle = "#2a211c";
    g.beginPath();
    g.arc(13, -4, 1.1, 0, Math.PI * 2);
    g.fill();
  } else if (CRITTERS[enemy.kind]) {
    drawCritter(g, enemy, step);
  }
  g.restore();
}

function drawCritter(g, enemy, step) {
  const color = CRITTERS[enemy.kind] || "#c4a484";
  const face = enemy.dir === -1 ? -1 : 1;
  g.save();
  g.scale(face, 1);
  if (enemy.dead > 0) g.rotate(1.2);
  limb(g, -4, 6, step, color, "#f6efe6", 7);
  limb(g, 4, 6, step + Math.PI, color, "#f6efe6", 7);
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(0, 0, enemy.big ? 16 : 12, enemy.big ? 10 : 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff6ee";
  g.beginPath();
  g.ellipse(2, 2, 6, 4, 0, 0, Math.PI * 2);
  g.fill();
  if (enemy.kind === "raccoon") {
    g.fillStyle = "#3a3432";
    g.fillRect(4, -4, 7, 3);
    g.fillStyle = "#6a625c";
    g.beginPath();
    g.ellipse(-12, 2, 4, 8, -0.6, 0, Math.PI * 2);
    g.fill();
  } else if (enemy.kind === "dog" || enemy.kind === "bulldog") {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(8, -8, 4, 6, 0.2, 0, Math.PI * 2);
    g.fill();
  } else if (enemy.kind === "toy") {
    g.fillStyle = "#f2c14b";
    g.fillRect(-6, 4, 14, 5);
  } else if (enemy.kind === "tech" || enemy.kind === "nurse") {
    g.strokeStyle = "#3a6f8a";
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(10, -2, 7, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "#2a211c";
  g.beginPath();
  g.arc(7, -1, 1.1, 0, Math.PI * 2);
  g.fill();
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

function drawWear(g, player) {
  const collar = progress.cat && progress.cat.collar;
  const hat = progress.cat && progress.cat.hat;
  if (!collar && !hat) return;
  g.save();
  g.translate(player.x + PW / 2, player.y);
  if (hat) {
    g.fillStyle = "#3d6b8a";
    g.fillRect(-7, 0, 14, 8);
    g.beginPath();
    g.ellipse(0, 8, 12, 3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2c14b";
    g.beginPath();
    g.arc(0, 3, 1.5, 0, Math.PI * 2);
    g.fill();
  }
  if (collar) {
    g.strokeStyle = "#e23b55";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, 22, 10, 3.6, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#f2c14b";
    g.beginPath();
    g.arc(8, 21, 1.7, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function clueInk(lit, color) {
  return lit ? color : "#b3a79c";
}

function drawClue(g, clue, time) {
  const bob = Math.sin(time * 3) * 5;
  g.save();
  g.translate(clue.x, clue.y + bob);
  const glow = g.createRadialGradient(0, 0, 6, 0, 0, 48);
  glow.addColorStop(0, "rgba(255, 236, 180, 0.85)");
  glow.addColorStop(1, "rgba(255, 214, 120, 0)");
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, 48, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 5; i++) {
    const angle = time * 1.6 + i * 1.25;
    const radius = 30 + Math.sin(time * 3 + i) * 5;
    g.globalAlpha = 0.45 + Math.sin(time * 5 + i) * 0.4;
    g.fillStyle = i % 2 ? "#fff" : "#ffe7a3";
    g.fillRect(Math.cos(angle) * radius, Math.sin(angle) * radius, 2.2, 2.2);
  }
  g.globalAlpha = 1;
  drawClueIcon(g, clue.id, 0, 0, 3.5, true);
  g.restore();
}

function drawClueIcon(g, id, x, y, scale, lit) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.lineCap = "round";
  g.lineJoin = "round";
  if (id === "glasses") drawGlasses(g, lit);
  else if (id === "slippers") drawSlippers(g, lit);
  else if (id === "yarn") drawYarn(g, lit);
  else if (id === "friend") {
    g.fillStyle = clueInk(lit, "#e7a0b0");
    g.beginPath();
    g.arc(0, 1, 6, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-4, -2);
    g.lineTo(-7, -8);
    g.lineTo(-1, -4);
    g.moveTo(4, -2);
    g.lineTo(7, -8);
    g.lineTo(1, -4);
    g.fill();
  } else if (id === "tag" || id === "bell" || id === "paw" || id === "ribbon" || id === "bobber" || id === "crumb" || id === "chart" || id === "cone" || id === "screw" || id === "vial" || id === "leash" || id === "brolly" || id === "grate" || id === "shingle" || id === "sock" || id === "flap") {
    g.fillStyle = clueInk(lit, "#f2c14b");
    g.beginPath();
    g.arc(0, 0, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = clueInk(lit, "#e07a3d");
    g.fillRect(-1.2, -1, 2.4, 6);
  } else drawHandbag(g, lit);
  g.restore();
}

function drawGlasses(g, lit) {
  const gold = clueInk(lit, "#e0c27a");
  const goldDark = clueInk(lit, "#b08a42");
  g.strokeStyle = goldDark;
  g.lineWidth = 1.05;
  g.beginPath();
  g.moveTo(-13, -1);
  g.lineTo(-16, 3);
  g.moveTo(13, -1);
  g.lineTo(16, 3);
  g.stroke();
  g.fillStyle = lit ? "rgba(176, 214, 232, 0.62)" : "rgba(190, 184, 176, 0.45)";
  g.beginPath();
  g.arc(-7, 0, 5.6, 0, Math.PI * 2);
  g.arc(7, 0, 5.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = gold;
  g.lineWidth = 1.25;
  g.beginPath();
  g.arc(-7, 0, 5.6, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(7, 0, 5.6, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(-1.6, -0.2);
  g.quadraticCurveTo(0, -2.4, 1.6, -0.2);
  g.stroke();
  g.fillStyle = goldDark;
  g.beginPath();
  g.arc(-12.4, -0.6, 0.85, 0, Math.PI * 2);
  g.arc(12.4, -0.6, 0.85, 0, Math.PI * 2);
  g.fill();
  if (lit) {
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.ellipse(-8.6, -1.8, 1.5, 0.55, -0.7, 0, Math.PI * 2);
    g.ellipse(5.4, -2, 1.3, 0.5, -0.5, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = clueInk(lit, "#f7f3ee");
  g.lineWidth = 0.55;
  g.beginPath();
  g.moveTo(-7, 5.4);
  g.quadraticCurveTo(0, 13, 7, 5.4);
  g.stroke();
  [[-6.2, 6.6], [-3, 9.6], [0, 11.2], [3, 9.6], [6.2, 6.6]].forEach((bead, index) => {
    g.fillStyle = clueInk(lit, index % 2 ? "#fffaf4" : "#f0b7c8");
    g.beginPath();
    g.arc(bead[0], bead[1], 1.05, 0, Math.PI * 2);
    g.fill();
  });
}

function drawSlippers(g, lit) {
  [-6, 6].forEach((x, index) => {
    g.save();
    g.translate(x, 1);
    g.scale(index ? -1 : 1, 1);
    g.fillStyle = clueInk(lit, "#c98aaa");
    g.beginPath();
    g.ellipse(0, 4.2, 7.2, 2.1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = clueInk(lit, "#f6c6e0");
    g.beginPath();
    g.ellipse(0, 0.4, 7.4, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = clueInk(lit, "#ffe4f4");
    g.beginPath();
    g.ellipse(-1, -0.8, 4.2, 1.8, -0.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = clueInk(lit, "#e7a4c4");
    g.lineWidth = 0.55;
    g.beginPath();
    g.moveTo(-4, -0.6);
    g.quadraticCurveTo(0, 1.2, 4, -0.8);
    g.moveTo(-3, 1.6);
    g.quadraticCurveTo(0, 3, 3.6, 1.2);
    g.stroke();
    g.fillStyle = clueInk(lit, "#fff8fc");
    g.beginPath();
    g.arc(4.6, -2.2, 1.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = clueInk(lit, "rgba(176, 92, 124, 0.35)");
    g.beginPath();
    g.ellipse(-3.5, 1.2, 2, 1.1, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

function drawYarn(g, lit) {
  g.fillStyle = clueInk(lit, "#c43758");
  g.beginPath();
  g.arc(-1, 0, 6.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = clueInk(lit, "#f08aa0");
  g.lineWidth = 0.75;
  g.beginPath();
  g.arc(-1, 0, 4.6, 0.3, 2.4);
  g.arc(-1, 0, 2.8, 2.2, 4.8);
  g.stroke();
  g.strokeStyle = clueInk(lit, "#8c243c");
  g.beginPath();
  g.arc(-1, 0, 5.6, -0.8, 1.2);
  g.stroke();
  g.fillStyle = lit ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)";
  g.beginPath();
  g.ellipse(-3, -1.6, 1.8, 0.9, -0.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = clueInk(lit, "#f08aa0");
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(4, 3);
  g.quadraticCurveTo(11, 7, 13, 1);
  g.stroke();
  g.strokeStyle = clueInk(lit, "#efe8df");
  g.lineWidth = 1.05;
  g.beginPath();
  g.moveTo(-5, -3);
  g.lineTo(7, -9);
  g.moveTo(-3, 2);
  g.lineTo(9, -1);
  g.stroke();
  g.fillStyle = clueInk(lit, "#d9cbb8");
  g.beginPath();
  g.arc(7, -9, 1.05, 0, Math.PI * 2);
  g.arc(9, -1, 1.05, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = clueInk(lit, "#f0a8bc");
  g.fillRect(-2, 5.2, 7, 4.6);
  g.strokeStyle = clueInk(lit, "#c86a84");
  g.lineWidth = 0.45;
  g.beginPath();
  g.moveTo(-2, 6.4);
  g.lineTo(5, 6.4);
  g.moveTo(-2, 7.8);
  g.lineTo(5, 7.8);
  g.moveTo(-2, 9.1);
  g.lineTo(5, 9.1);
  g.stroke();
}

function drawHandbag(g, lit) {
  g.strokeStyle = clueInk(lit, "#6d2a3a");
  g.lineWidth = 1.35;
  g.beginPath();
  g.moveTo(-5, -2);
  g.quadraticCurveTo(0, -11, 6, -2);
  g.stroke();
  g.fillStyle = clueInk(lit, "#9a3d52");
  g.beginPath();
  g.moveTo(-8, -2);
  g.lineTo(8, -2);
  g.quadraticCurveTo(9, 8, 6, 9);
  g.lineTo(-6, 9);
  g.quadraticCurveTo(-9, 8, -8, -2);
  g.closePath();
  g.fill();
  g.fillStyle = clueInk(lit, "#c45d72");
  g.fillRect(-6.2, -1, 2.6, 8);
  g.strokeStyle = clueInk(lit, "#f3d2c8");
  g.lineWidth = 0.45;
  g.setLineDash([0.9, 0.9]);
  g.strokeRect(-6.2, -0.4, 12.4, 8);
  g.setLineDash([]);
  g.fillStyle = clueInk(lit, "#e6c36a");
  g.fillRect(-2.1, -3.1, 4.2, 2);
  g.strokeStyle = clueInk(lit, "#f2d56a");
  g.lineWidth = 0.9;
  g.beginPath();
  g.arc(10, 1.5, 2.1, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = clueInk(lit, "#f4f0e6");
  g.lineWidth = 0.95;
  g.beginPath();
  g.moveTo(11.4, 2.6);
  g.lineTo(15.2, 7);
  g.moveTo(10.2, 3.2);
  g.lineTo(13.4, 8.4);
  g.stroke();
  g.fillStyle = clueInk(lit, "#f2c14b");
  g.beginPath();
  g.arc(15.4, 7.6, 1.15, 0, Math.PI * 2);
  g.fill();
}

function drawOwner(g, owner, time, theme, reunion, stars) {
  drawLady(g, owner.x, GROUND, time, theme, reunion ? (stars >= 3 ? "feast" : "reunion") : "idle");
}

function aimCamera(state, viewW, viewH) {
  const player = state.player;
  const groundCam = GROUND - viewH * 0.78;
  if (!Number.isFinite(state.camY)) state.camY = groundCam;
  if (!Number.isFinite(state.camX)) state.camX = 0;
  const targetX = player.x - viewW * 0.38 + player.facing * 70;
  const falling = !player.ride && player.y > GROUND + 24;
  const flying = Boolean(player.ride);
  const catAbove = GROUND - (player.y + PH);
  const tall = !flying && catAbove > 150 && !falling;
  let desiredY = groundCam;
  const catScreen = player.y - state.camY;
  if (flying) {
    desiredY = Math.max(0, Math.min(groundCam, player.y - viewH * 0.42));
  } else if (falling) {
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
  if (!tall && !flying) desiredY = Math.max(floorLow, Math.min(floorHigh, desiredY));
  if ((state.canHold || 0) > 0) {
    const prize = (state.level.cans || []).find((item) => !item.got && Math.abs(item.x - player.x) < 200);
    if (prize) {
      const look = prize.y - viewH * 0.32;
      if ((GROUND - look) / viewH >= 0.7) desiredY = look;
    }
  }
  if (state.snapCam) {
    state.camX = targetX;
    state.camY = falling ? groundCam : desiredY;
    state.snapCam = false;
  } else {
    state.camX += (targetX - state.camX) * 0.08;
    state.camY += (desiredY - state.camY) * (flying ? 0.12 : (state.canHold || 0) > 0 ? 0.14 : tall ? 0.06 : 0.045);
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
    if (enemy.kind !== "bird") continue;
    const px = enemy.perchX == null ? enemy.x : enemy.perchX;
    const py = enemy.perchY == null ? enemy.y : enemy.perchY;
    ctx.strokeStyle = "#c4925a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px - 34, py + 22);
    ctx.quadraticCurveTo(px, py + 12, px + 36, py + 20);
    ctx.stroke();
  }
  for (const enemy of level.enemies) {
    if (enemy.dive === "warn" || enemy.dive === "go") {
      ctx.save();
      ctx.globalAlpha = 0.28 + Math.sin(state.time * 16) * 0.08;
      ctx.fillStyle = "#3a2418";
      ctx.beginPath();
      ctx.ellipse(enemy.x, GROUND + 2, 18, 5, 0, 0, Math.PI * 2);
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
    ctx.save();
    ctx.translate(shot.x, shot.y);
    if (shot.kind === "egg") {
      ctx.fillStyle = "#f7f1e6";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (shot.kind === "wave") {
      ctx.strokeStyle = "rgba(90, 70, 50, 0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 16, Math.PI, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#8a5a32";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
  if (level.clue && !level.clue.got) drawClue(ctx, level.clue, state.time);
  if (level.ownerHere) {
    const reunion = state.won || Math.abs(state.player.x - level.owner.x) < 120;
    drawOwner(ctx, level.owner, state.time, level.theme, reunion, state.stars || 0);
  }
  drawCatShadow(ctx, state);
  if (state.player.ride) {
    ctx.save();
    ctx.translate(state.player.x + 16, state.player.y + 30);
    ctx.globalAlpha = 0.45 + Math.sin(state.time * 7) * 0.15;
    ctx.strokeStyle = "#d7f3ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (state.player.shield > 0) {
    ctx.save();
    ctx.translate(state.player.x + 16, state.player.y + 30);
    ctx.globalAlpha = 0.22 + Math.sin(state.time * 5) * 0.08;
    ctx.fillStyle = "#f7c6d8";
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
  if (state.player.invuln <= 0 || Math.sin(state.time * 40) > 0) {
    paintCat(ctx, state.cat, state.time);
    drawWear(ctx, state.player);
  }
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
  ctx.restore();
  if (state.fishing) drawFishing(state);
}

function drawFishing(state) {
  const fish = state.fishing;
  if (!fish) return;
  const dpr = state.dpr || 1;
  const w = view.width / dpr;
  const h = view.height / dpr;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "rgba(36, 24, 28, 0.35)";
  ctx.fillRect(0, 0, w, h);
  const cardW = Math.min(460, Math.max(280, w - 280));
  const cardH = Math.min(228, Math.max(168, h - 132));
  const x = (w - cardW) / 2;
  const y = Math.max(58, (h - cardH) / 2 - 4);
  round(ctx, x, y, cardW, cardH, 28);
  ctx.fillStyle = "rgba(255, 248, 242, 0.96)";
  ctx.fill();
  const bite = fish.t > fish.bite && !fish.caught && fish.t < fish.bite + 0.42;
  const title = fish.caught ? "A fish on the line." : bite ? "Reel!" : "Wait for the tug";
  ctx.fillStyle = bite ? "#c45a12" : "#3a2a22";
  ctx.font = "800 22px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, x + cardW / 2, y + 36);
  const span = 2.6;
  const mx = x + 36;
  const my = y + 52;
  const mw = cardW - 72;
  round(ctx, mx, my, mw, 18, 9);
  ctx.fillStyle = "#efe2d2";
  ctx.fill();
  const zone = Math.max(0.04, 0.42 / span);
  const start = Math.max(0, Math.min(1 - zone, fish.bite / span));
  round(ctx, mx + mw * start, my, mw * zone, 18, 9);
  ctx.fillStyle = bite ? "#f0b429" : "#f6d48a";
  ctx.fill();
  const mark = Math.max(0, Math.min(1, fish.t / span));
  ctx.fillStyle = "#2c241c";
  round(ctx, mx + mw * mark - 3, my - 4, 6, 26, 3);
  ctx.fill();
  const px = x + cardW * 0.58;
  const py = y + cardH * 0.7;
  const prx = cardW * 0.3;
  const pry = Math.min(46, cardH * 0.2);
  const water = ctx.createLinearGradient(0, py - pry, 0, py + pry);
  water.addColorStop(0, "#8fd4f2");
  water.addColorStop(1, "#2f7ed6");
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.ellipse(px, py, prx, pry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(px, py - 4, prx * 0.72, pry * 0.28, 0, 0, Math.PI * 2);
  ctx.stroke();
  const rodX = x + 48;
  const rodTop = y + 78;
  ctx.strokeStyle = "#c9843a";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rodX, py + 8);
  ctx.quadraticCurveTo(rodX + 30, rodTop, px - 16, rodTop + 8);
  ctx.stroke();
  ctx.fillStyle = "#8a5a32";
  ctx.beginPath();
  ctx.arc(rodX + 4, py + 4, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#efe4d4";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(rodX + 4, py + 4, 5, 0, Math.PI * 2);
  ctx.stroke();
  const bobX = px + Math.sin(fish.t * 2.4) * 16;
  const bobY = py + (bite ? Math.sin(fish.t * 26) * 7 : Math.sin(fish.t * 2) * 3);
  ctx.strokeStyle = "rgba(44, 32, 24, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px - 16, rodTop + 8);
  ctx.lineTo(bobX, bobY - 12);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(bobX, bobY, bite ? 16 : 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bite ? "#f0b429" : "#e23b3b";
  ctx.beginPath();
  ctx.arc(bobX, bobY + 2, bite ? 16 : 13, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = "#5c4638";
  ctx.font = "600 15px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.fillText(fish.caught ? "Nice cast." : "Tap Reel when the marker hits gold.", x + cardW / 2, y + cardH - 16);
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

function openMap() {
  for (const name of ["title", "select", "story", "complete", "settings", "credits", "shop"]) {
    const el = document.querySelector(`#${name}`);
    if (el) el.hidden = true;
  }
  document.querySelector("#overlay").hidden = true;
  hud.hidden = false;
  pad.hidden = false;
  screen = "map";
  ensureMap(progress);
  const world = WORLDS[progress.map.world] || WORLDS[0];
  audio.playMusic(world.tune);
  setMapChrome(true);
  const card = document.querySelector("#node-card");
  if (card) card.hidden = true;
}

function setMapChrome(onMap) {
  const dpad = document.querySelector("#dpad");
  const playButtons = document.querySelector("#play-buttons");
  const mapControls = document.querySelector("#map-controls");
  if (dpad) dpad.hidden = onMap;
  if (playButtons) playButtons.hidden = onMap;
  if (mapControls) mapControls.hidden = !onMap;
  for (const id of ["level-name", "fish-hud", "goal-tracker", "hearts", "progress"]) {
    const el = document.querySelector(`#${id}`);
    if (el) el.hidden = onMap;
  }
  const jump = document.querySelector("#jump");
  if (jump && !onMap) jump.textContent = "Jump";
}

function showNodeCard(id) {
  const card = document.querySelector("#node-card");
  if (!card) return;
  const level = LEVELS.find((item) => item.id === id);
  const title = document.querySelector("#node-title");
  const meta = document.querySelector("#node-meta");
  const button = document.querySelector("#node-play");
  const stars = level && progress.stars ? progress.stars[level.id] || 0 : 0;
  const fish = level && progress.bestFish ? progress.bestFish[level.id] : null;
  if (title) title.textContent = level ? level.name : id;
  if (meta) meta.textContent = `${stars ? "★".repeat(stars) : "Not cleared yet"}${fish ? ` · best fish ${fish}` : ""}`;
  const here = progress.map && progress.map.node === id;
  if (button) button.textContent = here ? "Play" : "Walk";
  card.hidden = false;
}

function doMapAction(action) {
  if (!action || action.type === "locked") {
    return;
  }
  if (action.type === "level") {
    const index = LEVELS.findIndex((level) => level.id === action.id);
    if (index >= 0) startLevel(index);
    return;
  }
  if (action.type === "shop") {
    document.querySelector("#overlay").hidden = false;
    document.querySelector("#shop-fish").textContent = `${progress.fishBank || 0} fish in the bank.`;
    show("shop");
    return;
  }
  if (action.type === "bonus") {
    progress.cleared = progress.cleared || {};
    if (!progress.cleared[action.id]) {
      progress.fishBank = (progress.fishBank || 0) + 6;
      progress.cleared[action.id] = true;
      saveProgress(progress);
      audio.chime();
    }
    return;
  }
  if (action.type === "check") {
    progress.cleared = progress.cleared || {};
    progress.cleared[action.id] = true;
    progress.map = progress.map || { world: 0, node: action.id };
    saveProgress(progress);
    audio.ding();
  }
}

function show(id) {
  for (const name of ["title", "select", "story", "complete", "settings", "credits", "shop"]) {
    const el = document.querySelector(`#${name}`);
    if (el) el.hidden = name !== id;
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
  setMapChrome(false);
  state.speech = { text: state.level.clue.open, after: "play" };
  show("play");
  paintSpeech();
}

function showComplete(current) {
  const finale = current.level.goal === "finale";
  const clue = current.level.clue;
  document.querySelector("#complete-kicker").textContent = finale ? "You found her" : "A clue";
  document.querySelector("#complete-title").textContent = finale
    ? `${progress.cat.name} found her.`
    : clue ? `Her ${clue.label.toLowerCase()}.` : "A clue.";
  const stars = "★★★".slice(0, current.stars) + "☆☆☆".slice(current.stars);
  document.querySelector("#stars").textContent = stars;
  const cans = current.level.cans || [];
  const filled = cans.filter((can) => can.got).length;
  const trail = finale
    ? REUNION_LINE
    : clue ? `${clue.say} On to ${clue.next}.` : "A trail of clues. Keep going.";
  document.querySelector("#complete-copy").textContent = `${trail} Fish ${current.fishGot} / ${current.level.fishValue}. Belly ${filled}/${cans.length || 3}.`;
  document.querySelector("#next-level").hidden = false;
  document.querySelector("#next-level").textContent = finale ? "New game plus" : "Back to the map";
  document.querySelector("#complete-credits").hidden = !finale;
  show("complete");
  drawReunion();
}

function paintHud() {
  if (!state) return;
  hearts.textContent = "♥".repeat(Math.max(0, state.player.health)) + "♡".repeat(Math.max(0, 3 - state.player.health));
  fishCount.textContent = `${state.fishGot}/${state.level.fishValue}`;
  const belly = document.querySelector("#belly");
  if (belly) {
    const pen = belly.getContext("2d");
    const fill = Math.max(0, Math.min(3, state.player.belly || 0)) / 3;
    pen.clearRect(0, 0, 36, 36);
    pen.fillStyle = "#fff6ee";
    pen.beginPath();
    pen.ellipse(18, 22, 12, 8, 0, 0, Math.PI * 2);
    pen.fill();
    pen.save();
    pen.beginPath();
    pen.rect(6, 22 - fill * 12, 24, 16);
    pen.clip();
    pen.fillStyle = state.player.shield > 0 ? "#f2c14b" : "#e07a3d";
    pen.beginPath();
    pen.ellipse(18, 22, 12, 8, 0, 0, Math.PI * 2);
    pen.fill();
    pen.restore();
    pen.strokeStyle = "#c47a5a";
    pen.lineWidth = 1.4;
    pen.beginPath();
    pen.ellipse(18, 22, 12, 8, 0, 0, Math.PI * 2);
    pen.stroke();
  }
  const combo = document.querySelector("#combo");
  if (combo) {
    combo.hidden = (state.comboT || 0) <= 0;
    combo.textContent = state.combo > 1 ? `x${state.combo}` : "";
  }
  const fill = document.querySelector("#progress-fill");
  if (fill) fill.style.width = `${Math.max(0, Math.min(1, state.player.x / Math.max(1, state.level.owner.x))) * 100}%`;
  paintSound();
  syncRidePad();
  const tracker = document.querySelector("#goal-tracker");
  if (tracker) {
    const pen = tracker.getContext("2d");
    pen.setTransform(3, 0, 0, 3, 0, 0);
    pen.clearRect(0, 0, 148, 32);
    const pack = state.level && state.level.world ? worldClues(state.level.world) : CLUES;
    const row = pack.length ? pack : CLUES;
    row.slice(0, 5).forEach((spec, index) => {
      const found = !!(state.progress.clues && state.progress.clues[spec.id]);
      drawClueIcon(pen, spec.id, 16 + index * (row.length > 4 ? 28 : 36), 16, 1.05, found);
    });
  }
  banner.hidden = state.bannerT <= 0;
  banner.textContent = state.banner;
  const nearWater = state.level.water.some((water) => {
    const px = state.player.x + PW / 2;
    return px > water.x - 40 && px < water.x + water.w + 40;
  });
  fishBtn.hidden = !(state.gotRod && nearWater);
  const ring = document.querySelector("#food-ring");
  if (ring) {
    const rideLeft = state.player.ride ? state.player.ride.ride || 0 : 0;
    const left = rideLeft || state.player.food || 0;
    const total = rideLeft ? 13.5 : 9;
    ring.hidden = left <= 0;
    if (left > 0) {
      const pen = ring.getContext("2d");
      pen.clearRect(0, 0, 36, 36);
      pen.strokeStyle = "rgba(255,255,255,0.45)";
      pen.lineWidth = 4;
      pen.beginPath();
      pen.arc(18, 18, 12, 0, Math.PI * 2);
      pen.stroke();
      pen.strokeStyle = rideLeft ? "#7ec8ff" : "#e2b84a";
      pen.beginPath();
      pen.arc(18, 18, 12, -Math.PI / 2, -Math.PI / 2 + (left / total) * Math.PI * 2);
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
    if (state && state.speech && state.mode === "play") {
      paintSpeech();
      drawWorld(state);
      paintHud();
    } else if (state && state.mode === "play") {
      const input = {
        left: held.left,
        right: held.right,
        up: held.up,
        down: held.down,
        jump: held.jump,
        jumpPressed: pressed.jump,
        scratch: held.scratch,
        scratchPressed: pressed.scratch,
        fish: held.fish,
        fishPressed: pressed.fish,
        action: held.action,
        actionPressed: pressed.action,
        reelPressed: pressed.reel,
        donePressed: pressed.done,
      };
      pressed.jump = pressed.scratch = pressed.fish = pressed.action = pressed.reel = pressed.done = false;
      step(state, dt, input);
      drawWorld(state);
      paintHud();
    } else if (screen === "map") {
      const input = {
        left: held.left,
        right: held.right,
        up: held.up,
        down: held.down,
        jumpPressed: pressed.jump,
      };
      pressed.jump = false;
      const action = stepMap(progress, input, dt);
      if (action) doMapAction(action);
      const tune = (WORLDS[progress.map.world] || WORLDS[0]).tune;
      if (tune && audio.current !== tune) audio.playMusic(tune);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      drawMap(ctx, view.width / dpr, view.height / dpr, dpr, progress, makeCat(progress.cat), performance.now() / 1000);
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

function paintSpeech() {
  const box = document.querySelector("#speech");
  if (!box) return;
  const text = state && state.speech ? state.speech.text : "";
  box.hidden = !text;
  const node = document.querySelector("#speech-text");
  if (node) node.textContent = text;
}

function advanceSpeech() {
  if (!state || !state.speech) return;
  const after = state.speech.after;
  state.speech = null;
  paintSpeech();
  if (after === "more" && state.speechNext) {
    state.speech = { text: state.speechNext, after: "complete" };
    state.speechNext = "";
    paintSpeech();
    return;
  }
  if (after === "complete") {
    state.mode = "complete";
    showComplete(state);
  }
}

function drawReunion() {
  const canvas = document.querySelector("#reunion");
  if (!canvas || document.querySelector("#complete").hidden) return;
  const finale = state && state.level && (state.level.goal === "finale" || state.level.goal === "reunion");
  const g = canvas.getContext("2d");
  const time = performance.now() / 1000;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#fff6ee";
  g.fillRect(0, 0, canvas.width, canvas.height);
  if (!finale) {
    const clue = state && state.level && state.level.clue;
    if (clue) {
      g.fillStyle = "rgba(255, 214, 120, 0.85)";
      g.beginPath();
      g.arc(canvas.width * 0.5, canvas.height * 0.55, 54, 0, Math.PI * 2);
      g.fill();
      drawClueIcon(g, clue.id, canvas.width * 0.5, canvas.height * 0.55, 7.2, true);
    }
    return;
  }
  const theme = state && state.level ? state.level.theme : "living";
  drawLady(g, 360, 250, time, theme, state && state.stars >= 3 ? "feast" : "reunion");
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

const pointers = new Map();

function padKeys() {
  return [
    ["left", "#left"],
    ["right", "#right"],
    ["up", "#up"],
    ["down", "#down"],
    ["jump", "#jump"],
    ["scratch", "#scratch"],
    ["fish", "#fish-btn"],
    ["action", "#action"],
    ["reel", "#reel"],
    ["done", "#fish-done"],
    ["left", "#map-left"],
    ["right", "#map-right"],
    ["up", "#map-up"],
    ["down", "#map-down"],
    ["jump", "#map-go"],
  ];
}

function nearestPad(x, y) {
  let best = null;
  let bestD = 96;
  for (const [key, selector] of padKeys()) {
    const el = document.querySelector(selector);
    if (!el || el.hidden || el.disabled || el.closest("[hidden]")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const near = x >= rect.left - 32 && x <= rect.right + 32 && y >= rect.top - 32 && y <= rect.bottom + 32;
    const dist = Math.hypot(x - cx, y - cy);
    if (near && dist < bestD) {
      best = key;
      bestD = dist;
    }
  }
  return best;
}

function syncRidePad() {
  const riding = !!(state && state.player && state.player.ride);
  for (const id of ["up", "down"]) {
    const el = document.querySelector(`#${id}`);
    if (!el) continue;
    el.disabled = !riding;
    el.classList.toggle("idle", !riding);
  }
  syncFishPad();
  if (!riding) {
    held.up = false;
    held.down = false;
    for (const [id, key] of pointers) {
      if (key === "up" || key === "down") pointers.delete(id);
    }
  }
}

function syncFishPad() {
  const fishing = !!(state && state.fishing);
  const dpad = document.querySelector("#dpad");
  const play = document.querySelector("#play-buttons");
  const controls = document.querySelector("#fish-controls");
  if (dpad) dpad.hidden = fishing;
  if (play) play.hidden = fishing;
  if (controls) controls.hidden = !fishing;
  const reel = document.querySelector("#reel");
  if (reel && fishing) {
    const fish = state.fishing;
    const bite = fish.t > fish.bite && !fish.caught && fish.t < fish.bite + 0.42;
    reel.textContent = fish.caught ? "Got" : bite ? "Reel" : "Cast";
  }
  if (!fishing) return;
  held.left = false;
  held.right = false;
  held.up = false;
  held.down = false;
  held.scratch = false;
  for (const [id, key] of [...pointers]) {
    if (key !== "reel" && key !== "done") pointers.delete(id);
  }
}

function paintPad() {
  for (const [key, selector] of padKeys()) {
    const el = document.querySelector(selector);
    if (el) el.classList.toggle("on", !!held[key]);
  }
}

function holdKey(key, on) {
  if (!key) return;
  const still = on ? true : [...pointers.values()].some((name) => name === key);
  held[key] = on || still;
  if (on && (key === "jump" || key === "scratch" || key === "fish" || key === "action" || key === "reel" || key === "done")) pressed[key] = true;
  paintPad();
}

function releasePads() {
  pointers.clear();
  for (const key of Object.keys(held)) held[key] = false;
  paintPad();
}

function bindPad() {
  const pad = document.querySelector("#pad");
  pad.addEventListener("pointerdown", (event) => {
    const key = nearestPad(event.clientX, event.clientY);
    if (!key) return;
    event.preventDefault();
    audio.unlock();
    pointers.set(event.pointerId, key);
    holdKey(key, true);
    try { pad.setPointerCapture(event.pointerId); } catch (error) { /* already captured */ }
  }, { passive: false });
  pad.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const prev = pointers.get(event.pointerId);
    const next = nearestPad(event.clientX, event.clientY);
    if (!next || next === prev) return;
    const horiz = (name) => name === "left" || name === "right";
    const vert = (name) => name === "up" || name === "down";
    if ((horiz(prev) && horiz(next)) || (vert(prev) && vert(next))) {
      pointers.set(event.pointerId, next);
      holdKey(prev, false);
      holdKey(next, true);
    }
  });
  const end = (event) => {
    const key = pointers.get(event.pointerId);
    if (!key) return;
    pointers.delete(event.pointerId);
    holdKey(key, false);
  };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);
  pad.addEventListener("lostpointercapture", end);
}

function boot() {
  resize();
  audio.setMix(progress.sound);
  audio.playMusic("music-inside");
  bindPad();
  document.querySelector("#play").addEventListener("click", () => {
    audio.unlock();
    fillSelect();
    show("select");
  });
  document.querySelector("#quiet").addEventListener("click", () => {
    location.href = "pet/index.html";
  });
  document.querySelector("#begin").addEventListener("click", () => {
    progress.cat = { ...progress.cat, ...readCat() };
    saveProgress(progress);
    openStory();
  });
  document.querySelector("#back-title").addEventListener("click", () => show("title"));
  document.querySelector("#title-settings").addEventListener("click", () => openSettings());
  document.querySelector("#pause").addEventListener("click", () => {
    if (state) state.mode = "pause";
    openSettings();
  });
  document.querySelector("#shop-close").addEventListener("click", () => openMap());
  const buy = (id, cost, apply) => {
    document.querySelector(id).addEventListener("click", () => {
      if ((progress.fishBank || 0) < cost) return;
      progress.fishBank -= cost;
      apply();
      saveProgress(progress);
      document.querySelector("#shop-fish").textContent = `${progress.fishBank} fish in the bank.`;
      audio.chime();
    });
  };
  buy("#buy-collar", 8, () => { progress.owned.collar = true; progress.cat.collar = true; });
  buy("#buy-hat", 12, () => { progress.owned.hat = true; progress.cat.hat = true; });
  buy("#buy-heart", 6, () => { progress.extraHeart = true; });
  document.querySelector("#easy-toggle").addEventListener("click", () => {
    progress.easy = !progress.easy;
    saveProgress(progress);
    document.querySelector("#easy-toggle").textContent = progress.easy ? "Easier on" : "Easier off";
  });
  document.querySelector("#view").addEventListener("pointerdown", (event) => {
    if (screen !== "map") return;
    const rect = view.getBoundingClientRect();
    const id = pickMap(event.clientX - rect.left, event.clientY - rect.top);
    if (!id) return;
    chooseNode(progress, id);
    showNodeCard(id);
  });
  document.querySelector("#node-play").addEventListener("click", () => {
    if (screen !== "map") return;
    const picked = selectedNode();
    if (picked && progress.map && picked !== progress.map.node) {
      chooseNode(progress, picked);
      showNodeCard(picked);
      return;
    }
    const action = enterCurrent(progress);
    if (action) doMapAction(action);
  });
  document.querySelector("#settings-close").addEventListener("click", () => {
    if (returnTo === "play" && state) {
      state.mode = "play";
      show("play");
    } else if (returnTo === "map") openMap();
    else show("title");
  });
  document.querySelector("#credits-open").addEventListener("click", () => show("credits"));
  document.querySelector("#credits-close").addEventListener("click", () => {
    if (state && state.won) show("complete");
    else openSettings();
  });
  document.querySelector("#story-next").addEventListener("click", nextStory);
  document.querySelector("#story-skip").addEventListener("click", () => openMap());
  document.querySelector("#speech").addEventListener("click", advanceSpeech);
  document.querySelector("#complete-credits").addEventListener("click", () => show("credits"));
  document.querySelector("#next-level").addEventListener("click", () => {
    if (state && state.level && state.level.goal === "finale") {
      progress.plus = true;
      progress.cleared = {};
      progress.stars = {};
      progress.foundOwner = false;
      progress.friend = false;
      progress.escaped = false;
      progress.home = false;
      progress.map = { world: 0, node: "living" };
      saveProgress(progress);
    }
    openMap();
  });
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
    if (key === "arrowdown" || key === "s") held.down = true;
    if (key === "arrowup" || key === "w") held.up = true;
    if (key === " " || key === "arrowup" || key === "w") {
      held.jump = true;
      pressed.jump = true;
      event.preventDefault();
    }
    if (key === "j" || key === "k") pressed.scratch = true;
    if (key === "f") pressed.fish = true;
    if (key === "e") pressed.action = true;
    if (key === "escape" && state && state.fishing) pressed.done = true;
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") held.left = false;
    if (key === "arrowright" || key === "d") held.right = false;
    if (key === "arrowdown" || key === "s") held.down = false;
    if (key === "arrowup" || key === "w") {
      held.up = false;
      held.jump = false;
    }
    if (key === " ") held.jump = false;
  });
  const releaseInput = () => releasePads();
  window.addEventListener("blur", releaseInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      releasePads();
      audio.pause();
    } else audio.resume();
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
  const wear = document.querySelector("#wear");
  if (wear) {
    const owned = progress.owned || {};
    const gifts = [];
    if (owned.collar) gifts.push(["collar", "Collar"]);
    if (owned.hat) gifts.push(["hat", "Hat"]);
    if (!gifts.length) {
      const note = document.createElement("button");
      note.type = "button";
      note.disabled = true;
      note.textContent = "Stars unlock gifts";
      wear.replaceChildren(note);
    } else {
      wear.replaceChildren(...gifts.map(([id, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.setAttribute("aria-pressed", progress.cat[id] ? "true" : "false");
        button.addEventListener("click", () => {
          progress.cat[id] = !progress.cat[id];
          button.setAttribute("aria-pressed", progress.cat[id] ? "true" : "false");
          saveProgress(progress);
        });
        return button;
      }));
    }
  }
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

const STORY = [
  { title: "She went for a walk.", copy: "The owner went out for a walk and never came back. Only you can find her." },
  { title: "A trail of clues.", copy: "She left her glasses, her slippers, a ball of yarn, and her keys." },
  { title: "Find her.", copy: "The map of the house is next. Follow what she dropped, all the way to tea. After that, the neighborhood, the vet, and the rainy way home." },
];
let storyPage = 0;

function openStory() {
  storyPage = 0;
  show("story");
  paintStory();
}

function nextStory() {
  storyPage += 1;
  if (storyPage >= STORY.length) openMap();
  else paintStory();
}

function paintStory() {
  const page = STORY[storyPage] || STORY[0];
  document.querySelector("#story-title").textContent = page.title;
  document.querySelector("#story-copy").textContent = page.copy;
  document.querySelector("#story-next").textContent = storyPage >= STORY.length - 1 ? "To the map" : "Next";
  const canvas = document.querySelector("#story-art");
  if (!canvas) return;
  const g = canvas.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const sky = g.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, storyPage === 1 ? "#9ae7ff" : storyPage === 2 ? "#ffd29a" : "#ffe0a8");
  sky.addColorStop(1, "#fff6ee");
  g.fillStyle = sky;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#e0903a";
  g.fillRect(0, canvas.height - 36, canvas.width, 36);
  if (storyPage === 1) {
    CLUES.forEach((spec, index) => drawClueIcon(g, spec.id, 120 + index * 110, canvas.height * 0.42, 2.4, true));
  }
  const cat = makeCat(progress.cat);
  cat.x = storyPage === 2 ? canvas.width * 0.5 : canvas.width * 0.28;
  cat.groundY = canvas.height - 36;
  cat.scale = 1.15;
  cat.facing = 1;
  cat.hideShadow = false;
  paintCat(g, cat, 0.4);
  if (storyPage !== 1) drawLady(g, canvas.width * 0.72, canvas.height - 36, 0.8, storyPage === 2 ? "neighbor" : "living", storyPage === 0 ? "idle" : "reunion");
}

let returnTo = "title";

function openSettings() {
  returnTo = screen === "play" || screen === "map" ? screen : "title";
  syncSound();
  const found = CLUES.filter((spec) => progress.clues && progress.clues[spec.id]).map((spec) => spec.label.toLowerCase());
  const goal = document.querySelector("#goal-line");
  if (goal) {
    goal.textContent = found.length
      ? `Find the owner. Clues so far: ${found.join(", ")}.`
      : "Find the owner. She left her glasses, slippers, yarn, and keys.";
  }
  document.querySelector("#unlock-all").textContent = progress.unlockAll ? "All levels open" : "Unlock all levels";
  const easy = document.querySelector("#easy-toggle");
  if (easy) easy.textContent = progress.easy ? "Easier on" : "Easier off";
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

function rideTest() {
  const trial = fresh(quietProgress(), 0);
  trial.mode = "play";
  for (let i = 0; i < 6; i++) step(trial, 1 / 60, still());
  const roomba = trial.level.hazards.find((item) => item.kind === "roomba");
  trial.player.x = roomba.x - 16;
  trial.player.y = GROUND - PH - 26;
  trial.player.vy = 80;
  trial.player.onGround = false;
  let started = false;
  for (let i = 0; i < 20; i++) {
    step(trial, 1 / 60, still());
    if (trial.player.ride) started = true;
  }
  const steer = { ...still(), right: true, jump: true, jumpPressed: false };
  const x0 = trial.player.x;
  const y0 = trial.player.y;
  for (let i = 0; i < 40; i++) step(trial, 1 / 60, steer);
  const moved = started && Math.abs(trial.player.x - x0) > 12;
  const flew = started && trial.player.y < y0 - 24;
  const sitting = trial.player.pose === "sit";
  if (trial.player.ride) trial.player.ride.fvy = 0;
  const up0 = trial.player.y;
  for (let i = 0; i < 24; i++) step(trial, 1 / 60, { ...still(), up: true });
  const rose = trial.player.y < up0 - 8;
  if (trial.player.ride) trial.player.ride.fvy = 0;
  const mid = trial.player.y;
  for (let i = 0; i < 24; i++) step(trial, 1 / 60, { ...still(), down: true });
  const sank = trial.player.y > mid + 6;
  const during = Number.isFinite(trial.player.x) && trial.player.y > 20 && trial.player.y < GROUND;
  if (trial.player.ride) trial.player.ride.ride = 0.02;
  for (let i = 0; i < 90; i++) step(trial, 1 / 60, still());
  const feet = trial.player.y + PH;
  const solid = trial.level.solids.some((block) => block.kind !== "pond" && feet >= block.y - 8 && feet <= block.y + 36 && trial.player.x + PW > block.x && trial.player.x < block.x + block.w);
  return {
    started,
    moved,
    flew,
    sitting,
    rose,
    sank,
    during,
    ended: !trial.player.ride,
    y: Math.round(trial.player.y),
    solid,
    finite: Number.isFinite(trial.player.x) && Number.isFinite(trial.player.y),
    inWorld: trial.player.y < 800 && trial.player.y > -20 && trial.player.x > -20 && trial.player.x < trial.level.width,
  };
}

function auditReach(level, levelIndex) {
  const stands = [];
  for (const block of level.solids) {
    if (block.kind === "pond") continue;
    if (!(block.kind === "floor" || block.ledge || block.h <= 28)) continue;
    for (let x = block.x + 18; x <= block.x + block.w - 18; x += 32) stands.push({ x, y: block.y });
  }
  const n = stands.length;
  const reach = new Array(n).fill(false);
  const queue = [];
  const jumpUp = levelIndex >= 1 ? 220 : 132;
  const link = (i) => {
    const a = stands[i];
    for (let j = 0; j < n; j++) {
      if (reach[j]) continue;
      const b = stands[j];
      const dx = Math.abs(a.x - b.x);
      const up = a.y - b.y;
      const ok = (Math.abs(up) <= 12 && dx <= 210)
        || (up > 12 && up <= 70 && dx <= 230)
        || (up > 70 && up <= jumpUp && dx <= 180)
        || (up < -12 && up >= -240 && dx <= 150);
      if (ok) {
        reach[j] = true;
        queue.push(j);
      }
    }
  };
  for (let i = 0; i < n; i++) {
    if (Math.abs(stands[i].y - GROUND) < 3 && stands[i].x < 180) {
      reach[i] = true;
      queue.push(i);
    }
  }
  while (queue.length) link(queue.pop());
  let grew = true;
  while (grew) {
    grew = false;
    for (const climb of level.climbs || []) {
      const foot = stands.some((stand, index) => reach[index] && Math.abs(stand.x - climb.x) < 40 && Math.abs(stand.y - climb.bot) < 36);
      if (!foot) continue;
      const topY = climb.ledgeY + 58;
      for (let j = 0; j < n; j++) {
        if (reach[j]) continue;
        if (Math.abs(stands[j].x - climb.ledgeX) < 56 && Math.abs(stands[j].y - topY) < 22) {
          reach[j] = true;
          queue.push(j);
          grew = true;
        }
      }
    }
    while (queue.length) link(queue.pop());
  }
  const reached = stands.filter((_, index) => reach[index]);
  const flight = (level.hazards || []).some((hazard) => hazard.kind === "roomba" && reached.some((stand) => Math.abs(stand.x - hazard.x) < 52 && Math.abs(stand.y - GROUND) < 6));
  const inside = (x, y) => level.solids.some((block) => block.kind !== "pond" && x > block.x + 6 && x < block.x + block.w - 6 && y > block.y + 6 && y < block.y + Math.min(block.h, 70) - 4);
  const can = (fish) => {
    if (inside(fish.x, fish.y) || fish.y > GROUND + 16 || fish.y < 36) return false;
    for (const stand of reached) {
      const dx = Math.abs(fish.x - stand.x);
      const up = stand.y - fish.y;
      if (up >= -50 && up <= jumpUp + 42 && dx <= (up > 96 ? 170 : 220)) return true;
    }
    return flight && fish.x > 36 && fish.x < level.owner.x - 46 && fish.y >= 68 && fish.y <= GROUND - 4 && !inside(fish.x, fish.y);
  };
  const moved = [];
  for (const fish of level.fish) {
    if (can(fish)) continue;
    let best = reached[0];
    let bestD = Infinity;
    for (const stand of reached) {
      const dist = Math.abs(stand.x - fish.x) + Math.abs(stand.y - fish.y) * 0.4;
      if (dist < bestD) {
        bestD = dist;
        best = stand;
      }
    }
    let nextX = best ? best.x : 160;
    let nextY = best ? Math.min(GROUND - 28, best.y - 36) : GROUND - 34;
    let guard = 0;
    while (inside(nextX, nextY) && guard < 8) {
      nextY -= 28;
      guard += 1;
    }
    if (inside(nextX, nextY) || nextY < 48) {
      nextX = 160;
      nextY = GROUND - 34;
    }
    moved.push({ fromX: Math.round(fish.x), fromY: Math.round(fish.y), toX: Math.round(nextX), toY: Math.round(nextY) });
    fish.x = nextX;
    fish.y = nextY;
  }
  if (level.clue && !can(level.clue)) {
    level.clue.x = Math.min(level.clue.x, level.owner.x - 120);
    level.clue.y = GROUND - 36;
  }
  const unreachable = level.fish.filter((fish) => !can(fish)).map((fish) => ({ x: Math.round(fish.x), y: Math.round(fish.y) }));
  if (level.clue && !can(level.clue)) unreachable.push({ clue: level.clue.id, x: Math.round(level.clue.x), y: Math.round(level.clue.y) });
  level.fishValue = level.fish.length;
  return {
    id: level.id,
    total: level.fish.length,
    flight,
    stands: reached.length,
    moved: moved.length,
    movedList: moved.slice(0, 16),
    unreachable,
  };
}

function fishAudit() {
  const bad = LEVELS.filter((level) => level.audit.unreachable.length);
  if (bad.length) {
    const detail = bad.map((level) => `${level.id}:${level.audit.unreachable.length}`).join(", ");
    throw new Error(`unreachable fish ${detail}`);
  }
  return LEVELS.map((level) => ({
    id: level.id,
    total: level.fishValue,
    moved: level.audit.moved,
    flight: level.audit.flight,
    sample: level.audit.movedList,
  }));
}

function rideControlTest() {
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#pad").hidden = false;
  if (!state) startLevel(0);
  state.player.ride = null;
  syncRidePad();
  const upBtn = document.querySelector("#up");
  const hiddenBefore = upBtn.disabled === true;
  state.player.ride = { ride: 8 };
  syncRidePad();
  const shown = upBtn.disabled === false;
  const up = document.querySelector("#up").getBoundingClientRect();
  const left = document.querySelector("#left").getBoundingClientRect();
  const right = document.querySelector("#right").getBoundingClientRect();
  const down = document.querySelector("#down").getBoundingClientRect();
  const pad = document.querySelector("#pad");
  const fire = (type, id, x, y) => {
    pad.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: "touch" }));
  };
  releasePads();
  syncRidePad();
  fire("pointerdown", 7, up.left + up.width / 2, up.top + up.height / 2);
  fire("pointerdown", 8, right.left + right.width / 2, right.top + right.height / 2);
  const both = held.up === true && held.right === true && held.down === false;
  fire("pointerup", 7, up.left + up.width / 2, up.top + up.height / 2);
  const rightStays = held.right === true && held.up === false;
  fire("pointerdown", 9, down.left + down.width / 2, down.top + down.height / 2);
  const downHeld = held.down === true && held.right === true;
  releasePads();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", bubbles: true }));
  const keyDown = held.down === true;
  window.dispatchEvent(new KeyboardEvent("keyup", { key: "s", bubbles: true }));
  const keyClear = held.down === false;
  state.player.ride = null;
  syncRidePad();
  const hiddenAfter = upBtn.disabled === true;
  const cross = up.bottom <= left.top + 6 && down.top >= left.bottom - 6 && left.right <= right.left + 4;
  return {
    hiddenBefore,
    shown,
    both,
    rightStays,
    downHeld,
    keyDown,
    keyClear,
    hiddenAfter,
    cross,
    ok: hiddenBefore && shown && both && rightStays && downHeld && keyDown && keyClear && hiddenAfter && cross,
  };
}

function spawnTest() {
  const bad = [];
  const safeOf = (level) => (level.spawn || 70) + 840;
  const scan = (level, tag) => {
    const spawn = level.spawn || 70;
    const safe = safeOf(level);
    for (const enemy of level.enemies) {
      const x = enemy.perchX == null ? enemy.x : Math.min(enemy.x, enemy.perchX);
      if (x < spawn - 4) bad.push({ id: level.id, tag, why: "behind", kind: enemy.kind, x: Math.round(x) });
      if (x < safe) bad.push({ id: level.id, tag, why: "safe", kind: enemy.kind, x: Math.round(x) });
    }
    for (const hazard of level.hazards || []) {
      if (hazard.x < safe) bad.push({ id: level.id, tag, why: "hazard", kind: hazard.kind, x: Math.round(hazard.x) });
    }
    for (let i = 0; i < level.enemies.length; i++) {
      for (let j = i + 1; j < level.enemies.length; j++) {
        const a = level.enemies[i];
        const b = level.enemies[j];
        if (Math.abs(a.y - b.y) < 40 && Math.hypot(a.x - b.x, a.y - b.y) < 48) {
          bad.push({ id: level.id, tag, why: "overlap", kind: a.kind, x: Math.round(a.x), other: b.kind });
        }
      }
    }
  };
  for (const level of LEVELS) scan(level, "template");
  const first = fresh(quietProgress(), 0);
  first.mode = "play";
  scan(first.level, "fresh");
  const again = fresh(quietProgress(), 0);
  again.mode = "play";
  scan(again.level, "restart");
  if (again.level.enemies.length !== first.level.enemies.length) bad.push({ why: "count", a: first.level.enemies.length, b: again.level.enemies.length });
  clearAround(again, again.level.spawn || 70);
  scan(again.level, "respawn");
  if (bad.length) throw new Error(`spawn ${JSON.stringify(bad.slice(0, 6))}`);
  return { ok: true, enemies: first.level.enemies.length };
}

function patrolTest() {
  const bad = [];
  const watch = ["squirrel", "mouse", "chicken", "rooster", "raccoon", "dog", "bulldog", "possum", "toy", "tech", "nurse", "alley"];
  for (let index = 0; index < LEVELS.length; index++) {
    const trial = fresh(quietProgress(), index);
    const tracked = trial.level.enemies.filter((enemy) => watch.includes(enemy.kind) && !enemy.chaser);
    const history = tracked.map(() => ({ dirs: [], xs: [] }));
    for (let frame = 0; frame < 360; frame++) {
      step(trial, 1 / 60, still());
      tracked.forEach((enemy, i) => {
        history[i].dirs.push(enemy.dir === -1 ? -1 : 1);
        history[i].xs.push(enemy.x);
      });
    }
    tracked.forEach((enemy, i) => {
      const dirs = history[i].dirs;
      let flips = 0;
      let windowFlips = 0;
      let worst = 0;
      for (let frame = 1; frame < dirs.length; frame++) {
        if (dirs[frame] !== dirs[frame - 1]) {
          flips += 1;
          windowFlips += 1;
        }
        if (frame > 60 && dirs[frame - 60] !== dirs[frame - 61]) windowFlips -= 1;
        if (windowFlips > worst) worst = windowFlips;
      }
      const xs = history[i].xs;
      const moved = Math.max(...xs) - Math.min(...xs);
      if (worst > 3) bad.push({ id: trial.level.id, kind: enemy.kind, x: Math.round(enemy.x), worst, flips });
      if (moved < 6 && flips > 2) bad.push({ id: trial.level.id, kind: enemy.kind, why: "stuck", flips, moved: Math.round(moved) });
    });
  }
  const wedge = fresh(quietProgress(), 1);
  const stuck = { kind: "squirrel", x: 400, y: GROUND - 20, min: 430, max: 390, dir: 1, hp: 1, home: GROUND - 20, alive: true };
  wedge.level.enemies.push(stuck);
  let wedgeFlips = 0;
  let prev = 1;
  for (let frame = 0; frame < 180; frame++) {
    step(wedge, 1 / 60, still());
    const dir = stuck.dir === -1 ? -1 : 1;
    if (dir !== prev) wedgeFlips += 1;
    prev = dir;
  }
  if (wedgeFlips > 4) bad.push({ kind: "wedge", flips: wedgeFlips });
  if (bad.length) throw new Error(`patrol ${JSON.stringify(bad.slice(0, 5))}`);
  return { ok: true, wedgeFlips };
}

function fishUiTest() {
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#pad").hidden = false;
  const progress = quietProgress();
  progress.rod = false;
  const yard = fresh(progress, 2);
  yard.player.x = yard.level.rod.x;
  yard.player.y = GROUND - PH;
  yard.player.onGround = true;
  step(yard, 1 / 60, still());
  const unlocked = yard.gotRod === true && yard.progress.rod === true;
  startLevel(3);
  state.speech = null;
  document.querySelector("#speech").hidden = true;
  state.gotRod = true;
  const spot = state.level.water[0];
  state.player.x = spot.x + 12;
  state.player.y = GROUND - PH;
  state.player.onGround = true;
  state.fishing = null;
  paintHud();
  const idle = document.querySelector("#dpad").hidden === false && document.querySelector("#play-buttons").hidden === false && document.querySelector("#fish-controls").hidden === true;
  state.fishing = { t: 0, bite: 0.15, caught: false, spot };
  paintHud();
  const reel = document.querySelector("#reel");
  const done = document.querySelector("#fish-done");
  const reelBox = reel.getBoundingClientRect();
  const doneBox = done.getBoundingClientRect();
  const hiddenPlay = document.querySelector("#dpad").hidden === true && document.querySelector("#jump").getBoundingClientRect().width === 0;
  const shown = reelBox.width > 70 && doneBox.width > 60;
  const apart = reelBox.left > doneBox.right + 80 && reelBox.left > window.innerWidth * 0.55;
  const bank = state.progress.fishBank;
  step(state, 0.2, { ...still(), reelPressed: true });
  const caught = !!(state.fishing && state.fishing.caught && state.progress.fishBank > bank);
  step(state, 0.05, { ...still(), donePressed: true });
  const closed = state.fishing == null;
  paintHud();
  const back = document.querySelector("#dpad").hidden === false && document.querySelector("#jump").getBoundingClientRect().width > 40;
  const ok = unlocked && idle && hiddenPlay && shown && apart && caught && closed && back;
  if (!ok) throw new Error(JSON.stringify({ unlocked, idle, hiddenPlay, shown, apart, caught, closed, back, bank: state.progress.fishBank }));
  return { ok: true };
}

function mapTest() {
  const snap = JSON.parse(JSON.stringify(progress));
  progress.cleared = {};
  progress.stars = {};
  progress.map = { world: 0, node: "living" };
  openMap();
  const onMap = screen === "map";
  progress.map.node = "porch";
  const blocked = enterCurrent(progress).type === "locked";
  progress.map.node = "living";
  const open = enterCurrent(progress);
  progress.cleared.living = true;
  progress.foundOwner = false;
  saveProgress(progress);
  const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
  const round = !!(raw.cleared && raw.cleared.living);
  const ids = ["sidewalk", "alley", "rooftops", "treetop", "dogpark", "waiting", "exam", "vents", "closet", "frontdesk", "rainy", "drains", "chase", "fencerun", "homecoming", "fishpond", "skirmish"];
  const won = ids.map((id) => simulate(id).won);
  progress.cleared = snap.cleared || {};
  progress.stars = snap.stars || {};
  progress.map = snap.map || { world: 0, node: "living" };
  progress.foundOwner = snap.foundOwner;
  saveProgress(progress);
  const ok = onMap && blocked && open.type === "level" && open.id === "living" && round && won.every(Boolean);
  if (!ok) throw new Error(JSON.stringify({ onMap, blocked, open, round, won }));
  return { ok: true, levels: won.length };
}

function mapLayoutTest() {
  openMap();
  progress.map = { world: 0, node: "living" };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  drawMap(ctx, view.width / dpr, view.height / dpr, dpr, progress, makeCat(progress.cat), 1.2);
  const report = mapHudReport();
  const cat = report.cat;
  if (!cat || cat.w < 70 || cat.h < 90) throw new Error(`cat too small ${JSON.stringify(cat)}`);
  const boxes = ["#map-up", "#map-down", "#map-left", "#map-right", "#map-go", "#pause"].map((sel) => {
    const rect = document.querySelector(sel).getBoundingClientRect();
    return { sel, l: rect.left, t: rect.top, r: rect.right, b: rect.bottom, w: rect.width };
  }).filter((box) => box.w > 8);
  const overlaps = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const catBox = { l: cat.x, t: cat.y, r: cat.x + cat.w, b: cat.y + cat.h };
  const covered = boxes.filter((box) => overlaps(catBox, box));
  if (covered.length) throw new Error(`cat covered ${covered.map((box) => box.sel).join(",")}`);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(boxes[i], boxes[j])) throw new Error(`overlap ${boxes[i].sel} ${boxes[j].sel}`);
    }
  }
  if (cat.cx < report.view.w * 0.32 || cat.cx > report.view.w * 0.74) throw new Error(`cat x ${Math.round(cat.cx)} of ${report.view.w}`);
  const up = document.querySelector("#map-up").getBoundingClientRect();
  const down = document.querySelector("#map-down").getBoundingClientRect();
  const left = document.querySelector("#map-left").getBoundingClientRect();
  const right = document.querySelector("#map-right").getBoundingClientRect();
  const cross = up.bottom <= left.top + 8 && down.top >= left.bottom - 8 && left.right <= right.left + 4;
  if (!cross) throw new Error("map d-pad is not a plus");
  setMapChrome(false);
  return { ok: true, cat };
}

function mapBranchTest() {
  const snap = JSON.parse(JSON.stringify(progress));
  progress.cleared = { living: true, porch: true, yard: true, nap: true };
  progress.stars = {};
  progress.map = { world: 0, node: "porch" };
  progress.skirmish = "held";
  const tap = (dir) => {
    const input = { left: false, right: false, up: false, down: false, jumpPressed: false };
    input[dir] = true;
    stepMap(progress, input, 1 / 60);
    input[dir] = false;
    for (let i = 0; i < 40; i++) stepMap(progress, input, 1 / 60);
  };
  tap("down");
  const fish = progress.map.node === "bowl";
  tap("up");
  const back = progress.map.node === "porch";
  tap("right");
  tap("up");
  const treats = progress.map.node === "treats";
  tap("down");
  tap("right");
  tap("up");
  const shop = progress.map.node === "shop";
  progress.map.node = "porch";
  const held = { left: false, right: true, up: false, down: false, jumpPressed: false };
  for (let i = 0; i < 160; i++) stepMap(progress, held, 1 / 60);
  const marched = progress.map.node === "neighbor";
  progress.cleared = snap.cleared || {};
  progress.stars = snap.stars || {};
  progress.map = snap.map || { world: 0, node: "living" };
  progress.skirmish = snap.skirmish;
  saveProgress(progress);
  if (!(fish && back && treats && shop && marched)) throw new Error(JSON.stringify({ fish, back, treats, shop, marched }));
  return { ok: true };
}

function storyTest() {
  progress.cat = progress.cat || { name: "Miso", gender: "girl", hair: "short", coat: "orange", eyes: "green" };
  openStory();
  document.querySelector("#story-skip").click();
  const skipped = screen === "map" && document.querySelector("#story").hidden === true;
  const trial = fresh(progress, 0);
  trial.mode = "play";
  const clue = trial.level.clue;
  trial.player.x = clue.x - 20;
  trial.player.y = GROUND - PH;
  trial.player.onGround = true;
  for (let i = 0; i < 40; i++) step(trial, 1 / 60, { ...still(), right: true });
  const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  const picked = !!(trial.won && trial.level.clue.got && saved.clues && saved.clues.glasses && trial.speech && trial.speech.text.includes("reading glasses"));
  const finale = simulate("neighbor");
  const reunions = LEVELS.filter((level) => level.ownerHere).map((level) => level.id);
  const ownerOnlyAtEnd = reunions.includes("neighbor") && reunions.includes("homecoming") && reunions.length === 2;
  return {
    skipped,
    picked,
    ownerOnlyAtEnd,
    reunion: finale.won === true && finale.id === "neighbor" && (finale.speech || "").includes("tea"),
    ok: skipped && picked && ownerOnlyAtEnd && finale.won === true && (finale.speech || "").includes("tea"),
  };
}

function inputTest() {
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#pad").hidden = false;
  releasePads();
  const pad = document.querySelector("#pad");
  const left = document.querySelector("#left").getBoundingClientRect();
  const right = document.querySelector("#right").getBoundingClientRect();
  const jump = document.querySelector("#jump").getBoundingClientRect();
  const fire = (type, id, x, y) => {
    pad.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: "touch" }));
  };
  const mid = (rect) => [rect.left + rect.width / 2, rect.top + rect.height / 2];
  const [lx, ly] = mid(left);
  const [rx, ry] = mid(right);
  const [jx, jy] = mid(jump);
  fire("pointerdown", 1, lx, ly);
  fire("pointerdown", 2, jx, jy);
  const both = held.left && held.jump;
  fire("pointerup", 2, jx, jy);
  const leftStays = held.left && !held.jump;
  fire("pointermove", 1, rx, ry);
  const slid = !held.left && held.right;
  fire("pointercancel", 1, rx, ry);
  const cleared = !held.left && !held.right && !held.jump;
  fire("pointerdown", 3, left.left - 20, ly);
  const near = held.left === true;
  releasePads();
  held.left = true;
  held.jump = true;
  window.dispatchEvent(new Event("blur"));
  const blurred = !held.left && !held.jump;
  return { both, leftStays, slid, cleared, near, blurred, ok: both && leftStays && slid && cleared && near && blurred };
}

function stepTest() {
  const bad = [];
  for (const level of LEVELS) {
    const index = LEVELS.indexOf(level);
    const trial = fresh(quietProgress(), index);
    trial.mode = "play";
    const solids = trial.level.solids.filter((block) => block.kind !== "floor" && block.kind !== "pond" && block.y < GROUND - 10 && block.w > 40);
    for (const block of solids.slice(0, 10)) {
      const floor = trial.level.solids.find((item) => item.kind === "floor" && block.x > item.x + 20 && block.x < item.x + item.w - 20);
      if (!floor) continue;
      if ((trial.level.hazards || []).some((hazard) => Math.abs(hazard.x - block.x) < 140)) continue;
      trial.player.x = Math.max(floor.x + 4, block.x - 28);
      trial.player.y = GROUND - PH;
      trial.player.vx = 0;
      trial.player.vy = 0;
      trial.player.jumped = false;
      trial.player.onGround = true;
      const start = trial.player.y;
      for (let i = 0; i < 30 && trial.player.x < block.x + 12; i++) step(trial, 1 / 60, { ...still(), right: true });
      if (trial.player.y < start - 10) bad.push({ id: level.id, y: Math.round(trial.player.y), block: block.kind });
    }
  }
  if (bad.length) throw new Error(`walked up ${JSON.stringify(bad.slice(0, 4))}`);
  return { ok: true, checked: LEVELS.length };
}

function birdDiveTest() {
  const bad = [];
  for (const id of ["living", "porch", "yard", "neighbor"]) {
    const index = LEVELS.findIndex((level) => level.id === id);
    const trial = fresh(quietProgress(), index);
    trial.mode = "play";
    let frames = 0;
    while (frames < 60 * 150 && !trial.won && trial.player.health > 0) {
      step(trial, 1 / 60, policy(trial));
      frames += 1;
      for (const enemy of trial.level.enemies) {
        if (enemy.kind !== "bird") continue;
        if ((enemy.dive === "warn" || enemy.dive === "go") && enemy.x < trial.player.x - 1) {
          bad.push({ id, frame: frames, bird: Math.round(enemy.x), cat: Math.round(trial.player.x), dive: enemy.dive });
        }
      }
    }
  }
  if (bad.length) throw new Error(`bird dived from behind ${JSON.stringify(bad.slice(0, 3))}`);
  return { ok: true, levels: 4 };
}

function behaviorCard() {
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#hud").hidden = true;
  document.querySelector("#pad").hidden = true;
  document.querySelector("#sound-prompt").hidden = true;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const w = view.width;
  const h = view.height;
  ctx.fillStyle = "#f6efe6";
  ctx.fillRect(0, 0, w, h);
  const cast = [
    ["mouse + cheese", { kind: "mouse", cheese: true, t: 0.5, dir: 1 }],
    ["squirrel wind-up", { kind: "squirrel", wind: 0.28, t: 0.4, dir: 1 }],
    ["chicken charge", { kind: "chicken", t: 0.7, dir: 1, phase: "charge" }],
    ["leaping fish", { kind: "fish", t: 1.3 }],
    ["rooster", { kind: "rooster", t: 0.5, dir: 1, hp: 2, big: true }],
    ["bird telegraph", { kind: "bird", species: "cardinal", t: 0.5, dive: "warn" }],
  ];
  cast.forEach((entry, index) => {
    const [label, extra] = entry;
    const x = (index + 0.5) * (w / cast.length);
    ctx.save();
    ctx.translate(x, h * 0.48);
    ctx.scale(2.3, 2.3);
    drawEnemy(ctx, { x: 0, y: 0, alive: true, home: 0, dir: 1, phase: "strut", ...extra }, 0.6);
    ctx.restore();
    if (extra.kind === "squirrel") {
      ctx.fillStyle = "#8a5a32";
      ctx.beginPath();
      ctx.arc(x + 70, h * 0.34, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3a2a22";
    ctx.font = "700 16px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x, h * 0.78);
  });
}

function enemyZoom() {
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#hud").hidden = true;
  document.querySelector("#pad").hidden = true;
  document.querySelector("#sound-prompt").hidden = true;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const w = view.width;
  const h = view.height;
  ctx.fillStyle = "#f6efe6";
  ctx.fillRect(0, 0, w, h);
  const kinds = ["mouse", "squirrel", "chicken", "rooster", "fish", "bird"];
  kinds.forEach((kind, index) => {
    const x = (index + 0.5) * (w / kinds.length);
    ctx.save();
    ctx.translate(x, h * 0.32);
    ctx.scale(2.15, 2.15);
    drawEnemy(ctx, { kind, species: kind === "bird" ? "jay" : "jay", x: 0, y: 0, alive: true, t: 0.05, dir: 1, phase: "strut", home: 0 }, 0.05);
    ctx.restore();
    ctx.save();
    ctx.translate(x, h * 0.68);
    ctx.scale(2.15, 2.15);
    drawEnemy(ctx, { kind, species: "robin", x: 0, y: 0, alive: true, t: 1.15, dir: 1, phase: "charge", home: 0 }, 1.15);
    ctx.restore();
    ctx.fillStyle = "#3a2a22";
    ctx.font = "700 16px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${kind}  stand / step`, x, h * 0.5);
  });
}

function frameMouse(id) {
  const index = LEVELS.findIndex((level) => level.id === id);
  startLevel(index);
  const mouse = state.level.enemies.find((enemy) => enemy.kind === "mouse" && enemy.cheese && !enemy.chaser)
    || state.level.enemies.find((enemy) => enemy.kind === "mouse" && !enemy.chaser)
    || state.level.enemies.find((enemy) => enemy.kind === "mouse");
  if (!mouse) return { id, missing: true };
  if (mouse.hole) mouse.popped = true;
  mouse.dir = 1;
  mouse.t = 0.45;
  state.player.x = mouse.x - 80;
  state.player.y = GROUND - PH;
  state.player.facing = 1;
  state.camX = mouse.x - 220;
  state.camY = Math.max(0, mouse.y - 150);
  state.hintedJump = true;
  state.bannerT = 0;
  state.snapCam = true;
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#hud").hidden = true;
  document.querySelector("#pad").hidden = true;
  document.querySelector("#sound-prompt").hidden = true;
  snapshot();
  const dpr = state.dpr || 1;
  const copy = document.createElement("canvas");
  copy.width = view.width;
  copy.height = view.height;
  copy.getContext("2d").drawImage(view, 0, 0);
  const zoom = 2.8;
  const sx = (mouse.x - state.camX) * dpr;
  const sy = (mouse.y - state.camY) * dpr;
  const sw = view.width / zoom;
  const sh = view.height / zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(copy, sx - sw / 2, sy - sh / 2, sw, sh, 0, 0, view.width, view.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(view.width / dpr / 2, view.height / dpr / 2);
  ctx.scale(zoom, zoom);
  drawEnemy(ctx, { ...mouse, x: 0, y: 0 }, state.time || 0.4);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { id, cheese: !!mouse.cheese, hole: !!mouse.hole };
}

function birdZoom() {
  document.querySelector("#overlay").hidden = true;
  document.querySelector("#hud").hidden = true;
  document.querySelector("#pad").hidden = true;
  document.querySelector("#sound-prompt").hidden = true;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const w = view.width;
  const h = view.height;
  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(0, 0, w, h);
  const names = ["jay", "cardinal", "sparrow", "robin", "crow", "pigeon"];
  names.forEach((name, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = (col + 0.5) * (w / 3);
    const y = (row + 0.46) * (h / 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2.35, 2.35);
    drawBird(ctx, { species: name, dive: index === 1 ? "warn" : null, x: index * 20 }, 0.8);
    ctx.restore();
    ctx.fillStyle = "#3a2a22";
    ctx.font = "700 18px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, x, y + h * 0.2);
  });
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
  rideTest,
  fishAudit,
  birdDiveTest,
  inputTest,
  rideControlTest,
  storyTest,
  spawnTest,
  patrolTest,
  fishUiTest,
  mapTest,
  mapLayoutTest,
  mapBranchTest,
  stepTest,
  enemyZoom,
  behaviorCard,
  frameMouse,
  birdZoom,
  audit,
  LEVELS,
  show,
};
