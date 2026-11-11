// Obstacles and the bird shapes. Hazards sit on open floor, with a safe first look.

const GROUND = 470;

const KITS = [
  ["yarn", "books", "slip", "pendulum", "flap", "box"],
  ["rocker", "wind", "board", "swing", "sprinkler", "cart", "spring", "post", "balloon", "hook", "flap", "box"],
  ["geyser", "mower", "roses", "mud", "bees", "vine", "post", "balloon", "hook", "flap"],
  ["dog", "spark", "tramp", "grill", "doors", "coop", "post", "balloon", "hook", "flap"],
];

const SPECIES = [
  ["jay", "jay", "jay"],
  ["cardinal", "cardinal", "cardinal", "cardinal", "cardinal", "cardinal"],
  ["sparrow", "robin", "sparrow"],
  ["crow", "pigeon", "crow"],
];

export function dressLevel(level, index) {
  const floors = level.solids.filter((block) => block.kind === "floor" && block.w > 420);
  const spots = [];
  for (const floor of floors) {
    const x = floor.x + Math.min(floor.w * 0.62, floor.w - 120);
    if (x < 640 || x > level.owner.x - 360) continue;
    if ((level.checkpoints || []).some((mark) => Math.abs(mark.x - x) < 200)) continue;
    if (level.enemies.some((enemy) => Math.abs(enemy.x - x) < 120)) continue;
    spots.push({ x, floor });
  }
  level.hazards = KITS[index].map((kind, i) => {
    const spot = spots[i % Math.max(1, spots.length)] || { x: 900 + i * 640, floor: floors[0] };
    const x = spot.x + (i > spots.length ? 48 : 0);
    return {
      kind,
      x,
      y: GROUND,
      min: spot.floor ? spot.floor.x + 80 : x - 80,
      max: spot.floor ? spot.floor.x + spot.floor.w - 80 : x + 80,
      dir: 1,
      t: i * 0.7,
      hop: ["yarn", "mower", "roses", "dog", "spark", "grill", "sprinkler"].includes(kind),
    };
  });
  let bird = 0;
  for (const enemy of level.enemies) {
    if (enemy.kind === "bird") {
      enemy.species = SPECIES[index][bird++] || SPECIES[index][0];
      enemy.perchX = enemy.x;
      enemy.perchY = enemy.y;
      enemy.home = enemy.y;
    }
    if (enemy.kind === "rooster") enemy.hp = 3;
  }
  const door = level.hazards.find((hazard) => hazard.kind === "flap");
  if (door) {
    level.fish.push(
      { x: door.x + 20, y: GROUND - 96, golden: false, phase: 0.2, got: false, bonus: false },
      { x: door.x + 52, y: GROUND - 120, golden: false, phase: 1.1, got: false },
    );
    level.fishValue += 2;
  }
  addRoutes(level, index);
  placeRoombas(level);
  addJuice(level, index);
  spiceEnemies(level);
}

function spiceEnemies(level) {
  const extras = [];
  let mice = 0;
  let birds = 0;
  for (const enemy of level.enemies) {
    if (enemy.kind === "mouse" && !enemy.chaser) {
      mice += 1;
      if (mice % 3 === 0) enemy.hole = true;
      if (mice % 2 === 0) enemy.cheese = true;
      if (mice % 4 === 0) enemy.group = true;
    }
    if (enemy.kind === "bird") {
      birds += 1;
      if (birds % 3 === 2) {
        enemy.perchX = (enemy.perchX || enemy.x) + 28;
        enemy.perchY = (enemy.perchY || enemy.y) - 16;
        enemy.flock = true;
      }
    }
  }
  const floors = level.solids.filter((block) => block.kind === "floor" && block.w > 560 && block.x > 240);
  floors.slice(0, 2).forEach((floor, i) => {
    const x = floor.x + floor.w * (0.4 + i * 0.2);
    if (x > level.owner.x - 160) return;
    extras.push({
      kind: "squirrel",
      x,
      y: GROUND - 20,
      min: floor.x + 50,
      max: floor.x + floor.w - 50,
      hp: 1,
      home: GROUND - 20,
      ground: true,
    });
  });
  const shelf = level.solids.find((block) => block.ledge && block.y < GROUND - 70 && block.w > 70);
  if (shelf) {
    extras.push({
      kind: "squirrel",
      x: shelf.x + shelf.w * 0.5,
      y: shelf.y - 16,
      min: shelf.x + 8,
      max: shelf.x + shelf.w - 8,
      hp: 1,
      home: shelf.y - 16,
    });
  }
  level.enemies.push(...extras);
  openTheStart(level);
}

function openTheStart(level) {
  const spawn = level.spawn || 70;
  const safe = spawn + 840;
  const kept = [];
  for (const enemy of level.enemies) {
    const x = enemy.perchX == null ? enemy.x : Math.min(enemy.x, enemy.perchX);
    if (x < safe) continue;
    const piled = kept.some((other) => other.kind === enemy.kind && Math.hypot(other.x - enemy.x, (other.y || 0) - (enemy.y || 0)) < 72);
    if (piled) continue;
    kept.push(enemy);
  }
  kept.sort((a, b) => a.x - b.x);
  for (let i = 1; i < kept.length; i++) {
    const prev = kept[i - 1];
    const enemy = kept[i];
    if (Math.abs((prev.y || 0) - (enemy.y || 0)) > 48) continue;
    const gap = enemy.x - prev.x;
    if (gap >= 96) continue;
    const shift = 96 - gap;
    enemy.x += shift;
    if (enemy.perchX != null) enemy.perchX += shift;
    if (enemy.min != null) enemy.min += shift;
    if (enemy.max != null) enemy.max += shift;
  }
  level.enemies = kept;
  let hop = 0;
  for (const hazard of level.hazards || []) {
    if (hazard.x >= safe) continue;
    hazard.x = safe + 80 + hop * 170;
    hop += 1;
    if (hazard.min != null) hazard.min = Math.max(hazard.min, hazard.x - 70);
    if (hazard.max != null) hazard.max = Math.max(hazard.max, hazard.x + 140);
  }
}

const ROUTE = [
  ["curtain", "bookshelf", "post"],
  ["porch", "trellis", "post"],
  ["fence", "trunk", "post"],
  ["coop", "shed", "post"],
];

function addRoutes(level, index) {
  const goal = (level.owner.x || level.width || 4000) * 0.42;
  const floors = level.solids.filter((block) => block.kind === "floor" && block.w > 640 && block.x < goal && block.x + block.w > goal + 260);
  floors.sort((a, b) => Math.abs(a.x + a.w * 0.5 - goal) - Math.abs(b.x + b.w * 0.5 - goal));
  const floor = floors[0] || level.solids.find((block) => block.kind === "floor" && block.w > 700 && block.x + block.w > goal);
  if (!floor) {
    level.climbs = [];
    return;
  }
  const base = Math.max(floor.x + 90, Math.min(floor.x + floor.w - 320, goal));
  const tiers = [
    { x: base + 36, y: GROUND - 76, w: 108, kind: "shelf" },
    { x: base + 78, y: GROUND - 148, w: 96, kind: "sill" },
    { x: base - 16, y: GROUND - 214, w: 176, kind: "perch" },
  ];
  for (const tier of tiers) level.solids.push({ ...tier, h: 16, ledge: true });
  const names = ROUTE[index];
  level.climbs = [
    { x: base, top: GROUND - 76, bot: GROUND, kind: names[0], ledgeX: tiers[0].x + 20, ledgeY: tiers[0].y - 58 },
    { x: base + 54, top: GROUND - 148, bot: GROUND - 60, kind: names[1], ledgeX: tiers[1].x + 16, ledgeY: tiers[1].y - 58 },
    { x: base + 8, top: GROUND - 214, bot: GROUND - 132, kind: names[2], ledgeX: tiers[2].x + 12, ledgeY: tiers[2].y - 58 },
  ];
  const bonus = [
    { x: tiers[0].x + 40, y: tiers[0].y - 28 },
    { x: tiers[1].x + 30, y: tiers[1].y - 28 },
    { x: tiers[2].x + 28, y: tiers[2].y - 34, golden: true },
  ];
  level.cans = [
    { x: tiers[2].x + tiers[2].w * 0.58, y: tiers[2].y - 26, got: false },
    { x: tiers[1].x + tiers[1].w * 0.55, y: tiers[1].y - 24, got: false },
    { x: tiers[0].x + 48, y: tiers[0].y - 24, got: false },
  ];
  for (const fish of bonus) {
    level.fish.push({ x: fish.x, y: fish.y, golden: Boolean(fish.golden), phase: fish.x * 0.01, got: false });
  }
  level.fishValue += bonus.length;
}

export function nearClimb(state, pad = 26) {
  const player = state.player;
  let found = null;
  for (const climb of state.level.climbs || []) {
    if (player.y + 58 < climb.top + 6 || player.y > climb.bot) continue;
    if (Math.abs(player.x + 16 - climb.x) < pad) found = climb;
  }
  return found;
}

export function applyClimb(state, dt, input, audio) {
  const player = state.player;
  if (player.clingLock > 0) player.clingLock -= dt;
  if (player.mantle) {
    player.mantle.t -= dt;
    player.x += (player.mantle.x - player.x) * 0.45;
    player.y += (player.mantle.y - player.y) * 0.45;
    player.vx = 0;
    player.vy = 0;
    if (player.mantle.t <= 0) {
      player.x = player.mantle.x;
      player.y = player.mantle.y;
      player.onGround = true;
      player.wasGround = false;
      player.mantle = null;
      player.airJump = state.levelIndex >= 1;
    }
    return "mantle";
  }
  const climb = (player.clingLock || 0) <= 0 ? nearClimb(state) : null;
  if (climb && !player.onGround && (player.jumped || input.action)) {
    player.cling = climb;
    player.x += (climb.x - 16 - player.x) * 0.5;
    if (input.action) {
      const nearTop = player.y < climb.top + 78;
      player.vy = nearTop ? -58 : -150;
      if ((player.climbSnd || 0) <= 0) {
        audio.scratch();
        player.climbSnd = 0.2;
      }
    } else player.vy = Math.min(player.vy, 80);
    if (player.climbSnd > 0) player.climbSnd -= dt;
    if (input.jumpPressed) {
      player.vy = -560;
      player.vx = (player.x + 16 < climb.x ? -1 : 1) * -220;
      player.vx = player.x + 16 < climb.x ? 240 : -240;
      player.cling = null;
      player.clingLock = 0.18;
      player.airJump = state.levelIndex >= 1;
      audio.scratch();
      return null;
    }
    if (player.y <= climb.top + 8) {
      player.mantle = { x: climb.ledgeX, y: climb.ledgeY, t: 0.18 };
      audio.scratch();
    }
    return "cling";
  }
  player.cling = null;
  if (player.ledgeCoyote > 0) player.ledgeCoyote -= dt;
  const ledge = player.jumped ? findLedge(state) : null;
  if (ledge) player.ledgeCoyote = 0.1;
  if (!player.onGround && player.jumped && player.vy > -20 && player.ledgeCoyote > 0 && ledge) {
    player.mantle = { x: ledge.x, y: ledge.y, t: 0.18 };
    player.vy = 0;
    audio.scratch();
    return "mantle";
  }
  return null;
}

function findLedge(state) {
  const player = state.player;
  const chest = player.y + 14;
  for (const block of state.level.solids) {
    if (!block.ledge || block.kind === "floor" || block.kind === "pond") continue;
    if (block.y > GROUND - 24) continue;
    if (chest > block.y + 8 || chest < block.y - 20) continue;
    const nearEdge = Math.abs(player.x + 32 - block.x) < 16 || Math.abs(player.x - (block.x + block.w)) < 16;
    if (!nearEdge) continue;
    const landX = Math.max(block.x + 4, Math.min(block.x + block.w - 36, player.x));
    return { x: landX, y: block.y - 58 };
  }
  return null;
}

export function updateCans(state, dt, audio) {
  const player = state.player;
  player.food = Math.max(0, (player.food || 0) - dt);
  player.pounceCd = Math.max(0, (player.pounceCd || 0) - dt);
  state.canHold = Math.max(0, (state.canHold || 0) - dt);
  for (const can of state.level.cans || []) {
    if (can.got) continue;
    const close = Math.abs(can.x - (player.x + 16)) < 130 && Math.abs(can.y - (player.y + 24)) < 90;
    if (close) {
      state.canHold = Math.max(state.canHold, 1.05);
      if (!state.foodHint) {
        state.foodHint = true;
        state.banner = "Wet food fills your belly: stars + a purr shield!";
        state.bannerT = 2.6;
      }
    }
  }
  for (const can of state.level.cans || []) {
    if (can.got) continue;
    const dx = can.x - (player.x + 16);
    const dy = can.y - (player.y + 28);
    if (dx * dx + dy * dy < 64 * 64) {
      can.got = true;
      player.food = 9;
      player.belly = Math.min(3, (player.belly || 0) + 1);
      state.foodHint = true;
      if (player.belly >= 3 && !player.shieldGot) {
        player.shield = 1;
        player.shieldGot = true;
        state.banner = "A full belly. Purr shield ready.";
      } else state.banner = "Wet food energy. Your belly is filling.";
      state.bannerT = 1.6;
      audio.chime();
      for (let i = 0; i < 10; i++) {
        state.particles.push({
          x: can.x, y: can.y,
          vx: (Math.random() - 0.5) * 90,
          vy: -30 - Math.random() * 70,
          life: 0.5, max: 0.5, kind: "spark", color: "#ffe08a",
        });
      }
    }
  }
}

export function drawCans(g, level, time) {
  for (const can of level.cans || []) {
    if (can.got) continue;
    const bob = Math.sin(time * 3 + can.x) * 4;
    g.save();
    g.translate(can.x, can.y + bob);
    g.fillStyle = "rgba(255, 220, 120, 0.45)";
    g.beginPath();
    g.arc(0, 0, 16 + Math.sin(time * 5) * 1.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f7f3ee";
    g.beginPath();
    g.ellipse(0, 2, 18, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e23b55";
    g.fillRect(-16, -6, 32, 14);
    g.fillStyle = "#fff";
    g.fillRect(-3, -4, 6, 5);
    g.strokeStyle = "#c45a4a";
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(6, -7, 3, 0.2, Math.PI);
    g.stroke();
    g.fillStyle = "#fff8e0";
    g.fillRect(8, -9, 3, 2);
    g.strokeStyle = "rgba(255, 244, 180, 0.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -28);
    g.lineTo(-6, -20);
    g.lineTo(6, -20);
    g.closePath();
    g.stroke();
    g.fillStyle = "rgba(255, 250, 210, 0.9)";
    g.beginPath();
    g.arc(12, -16, 2.2, 0, Math.PI * 2);
    g.arc(-14, -12, 1.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}

export function drawClimbs(g, level, time) {
  for (const climb of level.climbs || []) {
    const h = climb.bot - climb.top;
    g.save();
    g.translate(climb.x, climb.top);
    g.fillStyle = climbColor(climb.kind);
    g.fillRect(-7, 0, 14, h);
    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.lineWidth = 1.4;
    for (let y = 10; y < h - 8; y += 16) {
      g.beginPath();
      g.moveTo(-4, y);
      g.lineTo(3, y + 7);
      g.moveTo(4, y + 2);
      g.lineTo(-3, y + 9);
      g.stroke();
    }
    const bob = Math.sin(time * 3 + climb.x) * 3;
    g.fillStyle = "#fff8f2";
    g.beginPath();
    g.arc(16, h * 0.45 + bob, 7, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#c47a3a";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(13, h * 0.45 + bob);
    g.lineTo(19, h * 0.45 + bob - 4);
    g.moveTo(13, h * 0.45 + bob + 3);
    g.lineTo(19, h * 0.45 + bob - 1);
    g.stroke();
    g.restore();
  }
}

function climbColor(kind) {
  if (kind === "curtain") return "#e7a0b0";
  if (kind === "bookshelf") return "#c4925a";
  if (kind === "trellis") return "#6eae84";
  if (kind === "porch") return "#f4efe4";
  if (kind === "fence") return "#f7f1ea";
  if (kind === "trunk") return "#8d5a32";
  if (kind === "coop") return "#e2b84a";
  if (kind === "shed") return "#c45a4a";
  return "#d7b48a";
}

export function updateHazards(state, dt, audio, input = {}) {
  const player = state.player;
  const hazards = state.level.hazards || [];
  let slip = 1;
  let wind = 0;
  let bounce = 0;
  for (const hazard of hazards) {
    hazard.t += dt;
    slide(hazard, dt);
    const near = Math.abs(player.x + 16 - hazard.x) < 70 && player.y + 58 > GROUND - 70;
    if (hazard.kind === "slip" && near) slip = 0.35;
    if (hazard.kind === "mud" && near) slip = 0.45;
    if (hazard.kind === "wind" && Math.abs(player.x - hazard.x) < 160) {
      wind += Math.sin(hazard.t * 0.8) * 70;
      if (hazard.t % 3 < dt) audio.blip(140, 0.2, 0.05);
    }
    if (hazard.kind === "roomba") rideRoomba(state, hazard, dt, audio, input);
    if (hazard.kind === "cushion" && near && player.vy > 80) bounce = -520;
    if (hazard.kind === "ball" && near && player.onGround && Math.abs(player.x + 16 - hazard.x) < 20) bounce = -220;
    if (hazard.kind === "boost" && near && player.onGround) player.boost = 0.5;
    if (hazard.kind === "drop") bounce = Math.min(bounce, dropItem(hazard, player, dt) || 0);
    if (hazard.kind === "yarn" && near && player.onGround && Math.abs(player.x + 16 - hazard.x) < 16) poke(state, audio);
    if (hazard.kind === "mower" && near && player.onGround && Math.abs(player.x + 16 - hazard.x) < 28) {
      if (Math.floor(hazard.t / 1.4) !== hazard.honk) {
        hazard.honk = Math.floor(hazard.t / 1.4);
        audio.blip(78, 0.22, 0.06);
      }
      poke(state, audio);
    }
    if (hazard.kind === "roses" && near && player.onGround) poke(state, audio);
    if (hazard.kind === "geyser" && near && Math.sin(hazard.t * 2.2) > 0.15) bounce = -560;
    if (hazard.kind === "tramp" && near && player.vy >= 0) bounce = -820;
    if (hazard.kind === "balloon" && near) bounce = -460;
    if (hazard.kind === "spring" && near && player.vy < 0) bounce = -640;
    if (hazard.kind === "sprinkler" && sprinklerOn(hazard) && near && player.y + 58 > GROUND - 36) poke(state, audio);
    if (hazard.kind === "spark" && sparkOn(hazard) && near && player.y + 58 > GROUND - 28) poke(state, audio);
    if (hazard.kind === "grill" && grillOn(hazard) && near) poke(state, audio);
    if (hazard.kind === "dog") dog(state, hazard, dt, audio);
    if (hazard.kind === "bees") bees(state, hazard, dt, audio);
    if (hazard.kind === "books" && near && player.land > 0.05) hazard.tip = Math.min(1, (hazard.tip || 0) + dt);
    if (hazard.kind === "board" && near && player.onGround) {
      hazard.stood = (hazard.stood || 0) + dt;
      if (hazard.stood > 1 && !hazard.down) {
        hazard.down = 1.4;
        audio.blip(180, 0.16, 0.05);
      }
    } else if (hazard.kind === "board") hazard.stood = 0;
    if (hazard.down > 0) hazard.down -= dt;
    if (hazard.kind === "coop" && Math.sin(hazard.t * 0.7) > 0.92 && !hazard.popped) {
      hazard.popped = true;
      audio.cluck();
    }
    if (hazard.kind === "coop" && Math.sin(hazard.t * 0.7) < 0) hazard.popped = false;
    if (hazard.kind === "box" && Math.abs(player.x + 16 - hazard.x) < 28 && Math.abs(player.y + 40 - (GROUND - 20)) < 30) {
      hazard.x += player.vx * dt;
    }
    if (hazard.kind === "flap" && near && !hazard.seen) {
      hazard.seen = true;
      state.banner = "A cat door. Two fish were napping inside.";
      state.bannerT = 1.8;
    }
  }
  if (player.grapple) {
    const hook = player.grapple;
    player.vx += (hook.x - (player.x + 16)) * 3.2 * dt;
    player.vy += (hook.y - (player.y + 20)) * 2.4 * dt;
    hook.life -= dt;
    if (hook.life <= 0) player.grapple = null;
  }
  if (!player.ride) {
    let near = 9999;
    for (const hazard of hazards) {
      if (hazard.kind !== "roomba") continue;
      near = Math.min(near, Math.hypot(player.x + 16 - hazard.x, player.y + 40 - GROUND));
    }
    const loud = near < 420 ? Math.max(0, 1 - near / 420) * 0.75 : 0;
    audio.hum(loud > 0.04, 10, loud);
  }
  return { slip, wind, bounce };
}

const RIDE_TIME = 13.5;

function placeRoombas(level) {
  const floors = level.solids.filter((block) => block.kind === "floor" && block.w > 680 && block.x > 240 && block.x < Math.min(level.owner.x * 0.45, 2800));
  floors.sort((a, b) => a.x - b.x);
  const floor = floors[0];
  if (!floor) return;
  const have = level.hazards.filter((hazard) => hazard.kind === "roomba");
  if (have.length) return;
  const x = Math.max(floor.x + 140, Math.min(floor.x + floor.w - 140, floor.x + floor.w * 0.48));
  level.hazards.push({
    kind: "roomba",
    x,
    y: GROUND,
    min: floor.x + 90,
    max: floor.x + floor.w - 90,
    dir: 1,
    t: 0.4,
    hop: false,
    flyY: GROUND,
  });
  const arc = [
    { x: x - 90, y: GROUND - 170 },
    { x: x - 36, y: GROUND - 220 },
    { x: x + 20, y: GROUND - 246 },
    { x: x + 78, y: GROUND - 200 },
    { x: x + 120, y: GROUND - 156 },
  ];
  for (const spot of arc) {
    const buried = level.solids.some((block) => block.kind !== "pond" && spot.x > block.x && spot.x < block.x + block.w && spot.y > block.y && spot.y < block.y + block.h);
    if (buried || spot.x > level.owner.x - 80 || spot.x < 80) continue;
    level.fish.push({ x: spot.x, y: spot.y, golden: false, phase: spot.x * 0.01, got: false, sky: true });
    level.fishValue += 1;
  }
}

function addJuice(level, index) {
  const floors = level.solids.filter((block) => block.kind === "floor" && block.w > 680);
  const pick = (n) => floors[n] || floors[floors.length - 1];
  const cushion = pick(0);
  const ball = pick(1);
  const boost = pick(Math.min(2, floors.length - 1));
  const drop = pick(Math.min(3, floors.length - 1));
  if (cushion) {
    level.hazards.push({ kind: "cushion", x: cushion.x + cushion.w * 0.5, y: GROUND, min: 0, max: 0, dir: 1, t: 0.2 });
  }
  if (ball && ball.w > 200) {
    level.hazards.push({ kind: "ball", x: ball.x + 120, y: GROUND, min: ball.x + 90, max: ball.x + ball.w - 90, dir: index % 2 ? -1 : 1, t: 0.6 });
  }
  if (boost) {
    level.hazards.push({ kind: "boost", x: boost.x + boost.w * 0.46, y: GROUND, min: 0, max: 0, dir: 1, t: 0 });
  }
  if (drop) {
    level.hazards.push({ kind: "drop", x: drop.x + drop.w * 0.62, y: GROUND, min: 0, max: 0, dir: 1, t: 0.3, drop: GROUND - 168, phase: "rest" });
  }
  if ((level.checkpoints || []).length < 2) {
    const mid = floors.find((block) => block.x < level.width * 0.62 && block.x + block.w > level.width * 0.38) || floors[0];
    if (mid) level.checkpoints.push({ x: mid.x + mid.w * 0.55, y: GROUND - 58 });
  }
  const chaseAt = Math.max((level.spawn || 70) + 980, 1100);
  if (chaseAt < level.owner.x - 280) {
    level.enemies.push({
      kind: "mouse",
      x: chaseAt,
      y: GROUND - 22,
      min: chaseAt - 40,
      max: Math.max(chaseAt + 80, level.owner.x - 240),
      hp: 1,
      home: GROUND - 22,
      chaser: true,
    });
  }
  const secretX = (floors[floors.length - 1] || { x: 400, w: 200 }).x + 80;
  level.fish.push({ x: secretX, y: GROUND - 250, golden: false, phase: 0.4, got: false, sky: true, secret: true });
  level.fishValue += 1;
}

function rideRoomba(state, hazard, dt, audio, input) {
  const player = state.player;
  hazard.cool = Math.max(0, (hazard.cool || 0) - dt);
  hazard.flyY = hazard.flyY || GROUND;
  const feet = player.y + 58;
  const discY = hazard.ride > 0 ? hazard.flyY : GROUND;
  const top = discY - 30;
  const over = !player.ride && hazard.cool <= 0 && player.vy >= 0 && feet < top + 16 && feet > top - 40 && Math.abs(player.x + 16 - hazard.x) < 70;
  if (over) {
    player.ride = hazard;
    hazard.ride = RIDE_TIME;
    hazard.fvx = 0;
    hazard.fvy = -30;
    hazard.flyY = GROUND - 24;
    if (!state.rideHint) {
      state.rideHint = true;
      state.banner = "Up and down fly. Left and right steer. It sets you down gently.";
      state.bannerT = 2.8;
    }
    audio.hum(true, RIDE_TIME, 1);
  }
  if (player.ride !== hazard) return;
  hazard.ride -= dt;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  hazard.fvx += dir * 640 * dt;
  if (!dir) hazard.fvx *= Math.max(0, 1 - 2.4 * dt);
  hazard.fvx = Math.max(-210, Math.min(210, hazard.fvx));
  const rise = !!(input.up || input.jump);
  const drop = !!input.down;
  const climb = rise && !drop ? -480 : drop && !rise ? 520 : rise && drop ? 0 : 80;
  hazard.fvy += climb * dt;
  hazard.fvy *= Math.max(0, 1 - 1.6 * dt);
  hazard.fvy = Math.max(-160, Math.min(120, hazard.fvy));
  hazard.x += hazard.fvx * dt;
  hazard.flyY += hazard.fvy * dt;
  const left = 48;
  const right = state.level.owner.x - 110;
  if (hazard.x < left || hazard.x > right) {
    hazard.x = Math.max(left, Math.min(right, hazard.x));
    hazard.fvx *= -0.2;
  }
  if (hazard.flyY < 78) {
    hazard.flyY = 78;
    hazard.fvy = Math.max(0, hazard.fvy);
  }
  if (hazard.flyY > GROUND - 18) {
    hazard.flyY = GROUND - 18;
    hazard.fvy = Math.min(0, hazard.fvy);
  }
  const bob = Math.sin(state.time * 9) * 1.8;
  player.x = hazard.x - 16;
  player.y = hazard.flyY - 62 + bob;
  player.vx = hazard.fvx;
  player.vy = hazard.fvy;
  player.onGround = false;
  if (dir) player.facing = dir;
  if (Math.abs(hazard.fvx) + Math.abs(hazard.fvy) > 40 && state.time % 0.08 < dt) {
    state.particles.push({
      x: hazard.x + (Math.random() - 0.5) * 16,
      y: hazard.flyY + 4,
      vx: -hazard.fvx * 0.15,
      vy: 30,
      life: 0.35,
      max: 0.35,
      kind: "puff",
      color: "rgba(236, 244, 248, 0.85)",
    });
  }
  audio.hum(true, hazard.ride, 1);
  if (hazard.ride < 2 && Math.floor(hazard.ride * 2) !== hazard.beep) {
    hazard.beep = Math.floor(hazard.ride * 2);
    audio.blip(880, 0.07, 0.04);
  }
  if (hazard.ride <= 0) landRide(state, hazard, audio);
}

function landRide(state, hazard, audio) {
  const player = state.player;
  const spot = landingSpot(state.level, hazard.x, hazard.flyY || GROUND);
  player.ride = null;
  player.x = spot.x - 16;
  player.y = spot.y - 58;
  player.vx = 0;
  player.vy = -120;
  player.onGround = false;
  hazard.ride = 0;
  hazard.cool = 4;
  hazard.fvx = 0;
  hazard.fvy = 0;
  hazard.x = spot.x;
  hazard.flyY = GROUND;
  const floor = state.level.solids.find((block) => block.kind === "floor" && spot.x > block.x + 20 && spot.x < block.x + block.w - 20);
  if (floor) {
    hazard.min = floor.x + 70;
    hazard.max = floor.x + floor.w - 70;
  }
  audio.hum(false, 0);
  audio.blip(320, 0.12, 0.05);
  state.banner = "Whoops — soft landing.";
  state.bannerT = 1.1;
}

function landingSpot(level, x, fromY) {
  let best = null;
  for (const block of level.solids) {
    if (block.kind === "pond") continue;
    if (!(block.kind === "floor" || block.ledge || block.h <= 24)) continue;
    if (x < block.x + 22 || x > block.x + block.w - 22) continue;
    if (block.y < fromY - 6) continue;
    if (!best || block.y < best.y) best = { x, y: block.y };
  }
  if (best) return best;
  let near = null;
  for (const block of level.solids) {
    if (block.kind !== "floor") continue;
    const cx = Math.max(block.x + 28, Math.min(block.x + block.w - 28, x));
    const dist = Math.abs(cx - x);
    if (!near || dist < near.dist) near = { x: cx, y: block.y, dist };
  }
  return near || { x: level.spawn + 24, y: GROUND };
}

function dropItem(hazard, player, dt) {
  if (hazard.phase === "down") {
    hazard.drop = Math.min(GROUND - 14, (hazard.drop || GROUND - 168) + 320 * dt);
    if (hazard.drop >= GROUND - 16) {
      hazard.phase = "wait";
      hazard.wait = 0.7;
      if (Math.abs(player.x + 16 - hazard.x) < 26 && player.y + 58 > GROUND - 36) return -240;
    }
  } else if (hazard.phase === "wait") {
    hazard.wait -= dt;
    if (hazard.wait <= 0) hazard.phase = "up";
  } else if (hazard.phase === "up") {
    hazard.drop = Math.max(GROUND - 168, (hazard.drop || GROUND) - 90 * dt);
    if (hazard.drop <= GROUND - 166) hazard.phase = "rest";
  } else if (Math.abs(player.x + 16 - hazard.x) < 64) {
    hazard.phase = "down";
  } else hazard.drop = GROUND - 168;
  return 0;
}

function slide(hazard, dt) {
  if (hazard.ride > 0) return;
  if (hazard.kind === "ball") {
    hazard.x += hazard.dir * 72 * dt;
    hazard.hop = Math.abs(Math.sin(hazard.t * 8)) * 10;
    if (hazard.x < hazard.min || hazard.x > hazard.max) hazard.dir *= -1;
    return;
  }
  if (hazard.kind === "yarn" || hazard.kind === "roomba" || hazard.kind === "mower" || hazard.kind === "cart") {
    const speed = hazard.kind === "yarn" ? 64 : hazard.kind === "mower" ? 78 : 36;
    hazard.x += hazard.dir * speed * dt;
    if (hazard.x < hazard.min || hazard.x > hazard.max) hazard.dir *= -1;
  }
}

function poke(state, audio) {
  if (state.player.ride || state.player.invuln > 0 || state._poke) return;
  audio.blip(160, 0.08, 0.05);
  state._poke = 0;
}

function sprinklerOn(hazard) {
  return Math.sin(hazard.t * 2.4) > 0.35;
}
function sparkOn(hazard) {
  return Math.sin(hazard.t * 3) > 0.2;
}
function grillOn(hazard) {
  return Math.sin(hazard.t * 2) > 0.45;
}

function dog(state, hazard, dt, audio) {
  const player = state.player;
  const reach = 86;
  const dist = player.x + 16 - hazard.x;
  hazard.lunge = hazard.lunge || 0;
  if (Math.abs(dist) < reach && hazard.lunge <= 0) {
    hazard.warn = 0.45;
    hazard.lunge = 0.45;
    audio.blip(150, 0.14, 0.08);
  }
  if (hazard.warn > 0) hazard.warn -= dt;
  if (hazard.lunge > 0 && hazard.warn <= 0) {
    hazard.lunge -= dt;
    if (Math.abs(dist) < 36 && player.y + 58 > GROUND - 24) poke(state, audio);
  }
}

function bees(state, hazard, dt, audio) {
  const player = state.player;
  const close = Math.abs(player.x - hazard.x) < 36 && Math.abs(player.y + 30 - (GROUND - 30)) < 36;
  if (close && player.scratch > 0) {
    hazard.angry = 3;
    audio.blip(720, 0.1, 0.05);
  }
  if (hazard.angry > 0) {
    hazard.angry -= dt;
    if (close) poke(state, audio);
  }
}

export function nearest(level, kind, x, reach) {
  return (level.hazards || []).find((hazard) => hazard.kind === kind && Math.abs(hazard.x - x) < reach);
}

export function drawHazards(g, state) {
  for (const hazard of state.level.hazards || []) drawOne(g, hazard, state.time);
}

function drawOne(g, hazard, time) {
  g.save();
  const lift = hazard.kind === "roomba" && hazard.ride > 0 ? (hazard.flyY || GROUND) : GROUND;
  g.translate(hazard.x, lift);
  if (hazard.kind === "yarn") {
    g.rotate(hazard.t * 4);
    g.fillStyle = "#d23d55";
    g.beginPath();
    g.arc(0, -12, 11, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#fff";
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(0, -12, 6, 0.4, 2.4);
    g.stroke();
  } else if (hazard.kind === "books") {
    const tip = hazard.tip || 0;
    g.rotate(tip * 0.8);
    ["#d96b86", "#6eae84", "#7aa2e0"].forEach((color, i) => {
      g.fillStyle = color;
      g.fillRect(-16, -18 - i * 8, 32, 7);
    });
  } else if (hazard.kind === "roomba") {
    const flying = hazard.ride > 0;
    const face = hazard.dir === -1 ? -1 : 1;
    if (flying) {
      g.fillStyle = "rgba(180, 220, 235, 0.28)";
      g.beginPath();
      g.ellipse(0, 4, 70, 10, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#2f363c";
    g.beginPath();
    g.ellipse(0, -16, 66, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#3e474e";
    g.beginPath();
    g.ellipse(0, -20, 62, 11, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#d5dbe0";
    g.beginPath();
    g.ellipse(0, -24, 46, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(70, 78, 84, 0.45)";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(0, -24, 46, 8, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = flying && hazard.ride < 2 && Math.sin(time * 16) > 0 ? "#b6f5c4" : "#7d8a84";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, -24, 14, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#4a545c";
    g.beginPath();
    g.arc(0, -24, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#eef2f4";
    g.beginPath();
    g.arc(-2, -26, 2.2, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.scale(face, 1);
    g.fillStyle = "#8d979e";
    g.beginPath();
    g.ellipse(40, -12, 18, 7, 0, -0.6, 0.9);
    g.fill();
    g.fillStyle = "#1c2226";
    for (const spot of [[28, -6], [40, -5], [50, -7]]) {
      g.beginPath();
      g.arc(spot[0], spot[1], 1.6, 0, Math.PI * 2);
      g.fill();
    }
    g.save();
    g.translate(58, -8);
    g.rotate(time * 16);
    g.strokeStyle = "#5c6770";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-5, 0);
    g.lineTo(5, 0);
    g.moveTo(0, -5);
    g.lineTo(0, 5);
    g.stroke();
    g.restore();
    g.restore();
  } else if (hazard.kind === "cushion") {
    const squash = 1 + Math.sin(time * 6) * 0.04;
    g.fillStyle = "#f0a0c0";
    g.beginPath();
    g.ellipse(0, -8, 22 * squash, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#c45a78";
    g.stroke();
  } else if (hazard.kind === "ball") {
    const y = -12 - (hazard.hop || 0);
    g.fillStyle = "#7eb6f5";
    g.beginPath();
    g.arc(0, y, 11, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#2c4a6e";
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.beginPath();
    g.arc(0, y, 11, time * 4, time * 4 + 1.2);
    g.stroke();
  } else if (hazard.kind === "boost") {
    g.fillStyle = "rgba(255, 214, 90, 0.85)";
    g.beginPath();
    g.moveTo(-28, -4);
    g.lineTo(0, -16);
    g.lineTo(28, -4);
    g.lineTo(0, 2);
    g.fill();
  } else if (hazard.kind === "drop") {
    const y = (hazard.drop || GROUND - 168) - GROUND;
    g.fillStyle = hazard.phase === "down" ? "#e07a3d" : "#f2c14b";
    g.beginPath();
    g.ellipse(0, y, 12, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#8a4b22";
    g.stroke();
  } else if (hazard.kind === "slip" || hazard.kind === "mud") {
    g.fillStyle = hazard.kind === "mud" ? "rgba(120, 84, 48, 0.55)" : "rgba(255,255,255,0.45)";
    g.fillRect(-40, -6, 80, 8);
  } else if (hazard.kind === "pendulum") {
    const ang = Math.sin(time * 1.3) * 0.5;
    g.translate(0, -150);
    g.rotate(ang);
    g.strokeStyle = "#8d6a45";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, 70);
    g.stroke();
    g.fillStyle = "#e2b84a";
    g.beginPath();
    g.arc(0, 78, 8, 0, Math.PI * 2);
    g.fill();
  } else if (hazard.kind === "rocker") {
    g.rotate(Math.sin(time * 1.4) * 0.18);
    g.strokeStyle = "#8d6a45";
    g.beginPath();
    g.arc(0, -4, 22, Math.PI, 0);
    g.stroke();
    g.fillStyle = "#7eb6f5";
    g.fillRect(-12, -36, 24, 16);
  } else if (hazard.kind === "wind") {
    g.strokeStyle = `rgba(255,255,255,${0.25 + Math.sin(time * 3) * 0.15})`;
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = -30 - i * 16 + Math.sin(time * 2 + i) * 6;
      g.beginPath();
      g.moveTo(-30, y);
      g.lineTo(20, y - 4);
      g.stroke();
    }
  } else if (hazard.kind === "board") {
    g.fillStyle = hazard.down > 0 ? "#c4925a" : "#e7c49a";
    g.fillRect(-28, hazard.down > 0 ? 8 : -8, 56, 8);
  } else if (hazard.kind === "swing") {
    const ox = Math.sin(time) * 36;
    g.strokeStyle = "#8d6a45";
    g.beginPath();
    g.moveTo(ox - 16, -90);
    g.lineTo(ox - 10, -20);
    g.moveTo(ox + 16, -90);
    g.lineTo(ox + 10, -20);
    g.stroke();
    g.fillStyle = "#f2c14b";
    g.fillRect(ox - 22, -24, 44, 8);
  } else if (hazard.kind === "sprinkler") {
    g.fillStyle = "#8d9aa3";
    g.fillRect(-6, -12, 12, 12);
    if (sprinklerOn(hazard)) {
      g.strokeStyle = "rgba(120, 190, 230, 0.7)";
      g.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(0, -12);
        g.quadraticCurveTo(i * 10, -30, i * 16, -8);
        g.stroke();
      }
    }
  } else if (hazard.kind === "cart") {
    g.fillStyle = "#d7e4ee";
    g.fillRect(-16, -22, 32, 16);
    g.fillStyle = "#333";
    g.beginPath();
    g.arc(-8, -4, 4, 0, Math.PI * 2);
    g.arc(8, -4, 4, 0, Math.PI * 2);
    g.fill();
  } else if (hazard.kind === "spring") {
    g.fillStyle = "#e23b3b";
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(10, -28);
    g.lineTo(-4, -28);
    g.fill();
  } else if (hazard.kind === "geyser") {
    if (Math.sin(hazard.t * 2.2) > 0) {
      g.fillStyle = "rgba(120,190,230,0.65)";
      g.fillRect(-6, -50 - Math.sin(hazard.t * 8) * 8, 12, 50);
    }
    g.fillStyle = "#6b8f9a";
    g.fillRect(-8, -6, 16, 6);
  } else if (hazard.kind === "mower") {
    g.fillStyle = "#d23d55";
    g.fillRect(-20, -16, 40, 14);
    g.fillStyle = "#333";
    g.fillRect(16, -22, 10, 8);
  } else if (hazard.kind === "roses") {
    g.fillStyle = "#3f9a55";
    g.fillRect(-18, -20, 36, 20);
    g.fillStyle = "#d23d55";
    g.beginPath();
    g.arc(-6, -22, 5, 0, Math.PI * 2);
    g.arc(6, -18, 4, 0, Math.PI * 2);
    g.fill();
  } else if (hazard.kind === "bees") {
    g.fillStyle = "#6eae84";
    g.beginPath();
    g.ellipse(0, -16, 14, 10, 0, 0, Math.PI * 2);
    g.fill();
    const angry = hazard.angry > 0;
    g.fillStyle = angry ? "#2a2a2a" : "#f2c14b";
    for (let i = 0; i < 3; i++) {
      const buzz = Math.sin(time * 20 + i) * (angry ? 10 : 4);
      g.beginPath();
      g.ellipse(-8 + i * 8, -28 + buzz, 3, 2, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (hazard.kind === "vine") {
    const ang = Math.sin(time * 0.9) * 0.25;
    g.translate(0, -160);
    g.rotate(ang);
    g.strokeStyle = "#3f9a55";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, 90);
    g.stroke();
  } else if (hazard.kind === "dog") {
    g.strokeStyle = "rgba(90,60,40,0.35)";
    g.beginPath();
    g.arc(0, -8, 86, Math.PI, 0);
    g.stroke();
    const bite = hazard.lunge > 0 && hazard.warn <= 0 ? 18 : 0;
    g.fillStyle = "#c49a6c";
    g.beginPath();
    g.ellipse(bite, -16, 16, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2a211c";
    g.beginPath();
    g.arc(bite + 8, -18, 2, 0, Math.PI * 2);
    g.fill();
  } else if (hazard.kind === "spark") {
    g.strokeStyle = "#8d9aa3";
    g.strokeRect(-4, -40, 8, 40);
    if (sparkOn(hazard)) {
      g.fillStyle = "#9ad7ff";
      g.beginPath();
      g.arc(0, -16, 7, 0, Math.PI * 2);
      g.fill();
    }
  } else if (hazard.kind === "tramp") {
    g.strokeStyle = "#333";
    g.beginPath();
    g.moveTo(-24, 0);
    g.lineTo(-16, -16);
    g.moveTo(24, 0);
    g.lineTo(16, -16);
    g.stroke();
    g.fillStyle = "#6aa7c9";
    g.beginPath();
    g.ellipse(0, -16, 28, 7, 0, 0, Math.PI * 2);
    g.fill();
  } else if (hazard.kind === "grill") {
    g.fillStyle = "#444";
    g.beginPath();
    g.ellipse(0, -14, 16, 8, 0, 0, Math.PI * 2);
    g.fill();
    if (grillOn(hazard)) {
      g.fillStyle = "rgba(255,120,40,0.8)";
      g.beginPath();
      g.ellipse(0, -28, 8, 12, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (hazard.kind === "doors") {
    const open = Math.sin(hazard.t * 0.9) > 0;
    g.fillStyle = open ? "rgba(186, 224, 244, 0.35)" : "#c9d6e0";
    g.fillRect(open ? 10 : -16, -70, open ? 8 : 32, 70);
  } else if (hazard.kind === "coop") {
    const open = Math.sin(hazard.t * 0.7) > 0.4;
    g.fillStyle = "#e2b84a";
    g.fillRect(-20, -40, 40, 40);
    g.fillStyle = open ? "#6b4a32" : "#f8efe4";
    g.fillRect(-8, -28, 16, 28);
  } else if (hazard.kind === "post") {
    g.fillStyle = "#c4925a";
    g.fillRect(-5, -90, 10, 90);
    g.fillStyle = "#e7d3be";
    g.fillRect(-12, -88, 24, 10);
  } else if (hazard.kind === "balloon") {
    g.fillStyle = "#e07a8c";
    g.beginPath();
    g.ellipse(0, -70, 12, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#8d6a45";
    g.beginPath();
    g.moveTo(0, -54);
    g.lineTo(0, -10);
    g.stroke();
  } else if (hazard.kind === "hook") {
    g.strokeStyle = "#8d6a45";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, -130, 8, 0, Math.PI);
    g.stroke();
  } else if (hazard.kind === "flap") {
    g.fillStyle = "#f4c9d4";
    g.beginPath();
    g.arc(0, -22, 16, 0, Math.PI, true);
    g.fill();
  } else if (hazard.kind === "box") {
    g.fillStyle = "#e2b84a";
    g.fillRect(-14, -28, 28, 28);
    g.strokeStyle = "#8d6a45";
    g.strokeRect(-14, -28, 28, 28);
  }
  g.restore();
}

const BIRDS = {
  jay: { body: "#2f6fbe", belly: "#f4f7fb", wing: "#1d4e96", tail: "#163e74", mask: "#1a1c20", beak: "#2c3036", crest: true, collar: true, bar: "#f7f9fc" },
  cardinal: { body: "#d23b45", belly: "#e25a62", wing: "#a82432", tail: "#8e1c28", mask: "#1a1a1a", beak: "#f0c14a", crest: true },
  sparrow: { body: "#8d6844", belly: "#ead7b0", wing: "#6a5034", tail: "#5a4632", mask: "#4e4034", beak: "#c4a06a", streak: true },
  robin: { body: "#6d675f", belly: "#e07a3d", wing: "#4e4944", tail: "#3c3834", mask: "#3a342f", beak: "#e2b84a" },
  crow: { body: "#2a2e33", belly: "#3a4048", wing: "#1b1e22", tail: "#141618", mask: "#111214", beak: "#2a2e33" },
  pigeon: { body: "#8d8f97", belly: "#d7d3cc", wing: "#6e727c", tail: "#5c616a", mask: "#4a4e57", beak: "#c46a86", neck: "#7d8f78" },
};

function birdShape(g, draw, fill) {
  g.beginPath();
  draw();
  g.fillStyle = fill;
  g.fill();
  g.save();
  g.strokeStyle = fill;
  g.globalAlpha = 0.45;
  g.lineWidth = 1;
  g.lineJoin = "round";
  g.stroke();
  g.restore();
}

export function drawBird(g, enemy, time) {
  const look = BIRDS[enemy.species] || BIRDS.jay;
  const diving = enemy.dive === "go";
  const warn = enemy.dive === "warn";
  const flap = diving ? 0.25 : Math.sin(time * (warn ? 20 : 9) + (enemy.x || 0)) * (warn ? 1.05 : 0.7);
  g.save();
  if (diving) g.rotate(0.55);
  g.lineJoin = "round";
  birdShape(g, () => {
    g.moveTo(-18, 2);
    g.lineTo(-40, -14);
    g.lineTo(-30, 0);
    g.lineTo(-40, 6);
    g.lineTo(-30, 8);
    g.lineTo(-38, 16);
    g.lineTo(-16, 8);
  }, look.tail);
  birdShape(g, () => g.ellipse(-2, 4, 22, 13, 0, 0, Math.PI * 2), look.body);
  g.fillStyle = look.belly;
  g.beginPath();
  g.ellipse(4, 8, 13, 8, 0, 0, Math.PI * 2);
  g.fill();
  if (look.streak) {
    g.strokeStyle = "rgba(70, 48, 28, 0.55)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-8, 2);
    g.lineTo(8, 5);
    g.moveTo(-6, 7);
    g.lineTo(8, 9);
    g.moveTo(-4, 11);
    g.lineTo(6, 12);
    g.stroke();
  }
  if (look.neck) {
    g.fillStyle = look.neck;
    g.beginPath();
    g.ellipse(12, 0, 6, 5, 0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.save();
  g.translate(-2, 2);
  g.rotate(flap);
  birdShape(g, () => g.ellipse(-6, -14, 18, 8, -0.25, 0, Math.PI * 2), look.wing);
  if (look.bar) {
    g.fillStyle = look.bar;
    g.fillRect(-16, -18, 10, 3.2);
    g.fillStyle = look.mask;
    g.fillRect(-16, -14, 12, 2.2);
  }
  g.restore();
  g.save();
  g.translate(-6, 6);
  g.rotate(flap * 0.45);
  g.globalAlpha = 0.85;
  birdShape(g, () => g.ellipse(0, -6, 12, 5, 0.2, 0, Math.PI * 2), look.wing);
  g.restore();
  birdShape(g, () => g.arc(16, -4, 10, 0, Math.PI * 2), look.body);
  if (look.crest) {
    birdShape(g, () => {
      g.moveTo(10, -10);
      g.lineTo(16, -26);
      g.lineTo(20, -8);
    }, look.body);
  }
  if (look.collar) {
    g.fillStyle = look.mask;
    g.beginPath();
    g.ellipse(8, 2, 5, 3.2, 0.6, 0, Math.PI * 2);
    g.fill();
  }
  if (look.mask) {
    g.fillStyle = look.mask;
    g.beginPath();
    g.ellipse(20, -4, look.species === "cardinal" ? 7 : 5.5, 4.2, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#f7f4ea";
  g.beginPath();
  g.arc(20, -6, 2.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1d2430";
  g.beginPath();
  g.arc(20.8, -6, 1.15, 0, Math.PI * 2);
  g.fill();
  birdShape(g, () => {
    g.moveTo(24, -4);
    g.lineTo(34, -1);
    g.lineTo(24, 2);
  }, look.beak);
  if (!diving) {
    const step = Math.sin(time * 7 + (enemy.x || 0));
    g.strokeStyle = look.mask;
    g.globalAlpha = 0.85;
    g.lineWidth = 1.15;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(1, 15);
    g.quadraticCurveTo(0, 22, -2 + step, 26);
    g.moveTo(8, 15);
    g.quadraticCurveTo(9, 22, 11 - step, 26);
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = "#e7c9a4";
    g.beginPath();
    g.ellipse(-2 + step, 27, 3.2, 1.3, 0, 0, Math.PI * 2);
    g.ellipse(11 - step, 27, 3.2, 1.3, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (warn) {
    g.fillStyle = "#1c1916";
    g.font = "800 16px 'Avenir Next', 'Segoe UI', sans-serif";
    g.textAlign = "center";
    g.fillText("!", 0, -30);
  }
  g.restore();
}

export function birdSheet(g, w, h) {
  const names = Object.keys(BIRDS);
  names.forEach((name, index) => {
    const x = (index + 0.5) * (w / (names.length + 1));
    g.save();
    g.translate(x, h * 0.42);
    g.scale(1.15, 1.15);
    drawBird(g, { species: name, dive: null, x: index }, 0.4);
    g.restore();
    g.fillStyle = "#5c4638";
    g.font = "600 15px 'Avenir Next', 'Segoe UI', sans-serif";
    g.textAlign = "center";
    g.fillText(name, x, h * 0.72);
  });
}
