// Obstacles and the bird shapes. Hazards sit on open floor, with a safe first look.

const GROUND = 470;

const KITS = [
  ["yarn", "books", "roomba", "slip", "pendulum", "flap", "box"],
  ["rocker", "wind", "board", "swing", "sprinkler", "cart", "spring", "post", "balloon", "hook", "flap", "box"],
  ["geyser", "mower", "roses", "mud", "bees", "vine", "post", "balloon", "hook", "flap"],
  ["dog", "spark", "tramp", "grill", "doors", "coop", "post", "balloon", "hook", "flap"],
];

const SPECIES = [
  ["jay", "jay", "jay"],
  ["cardinal", "cardinal", "cardinal", "cardinal", "cardinal", "cardinal"],
  ["sparrow", "robin", "sparrow"],
  ["crow", "finch", "crow"],
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
    if (enemy.kind === "bird") enemy.species = SPECIES[index][bird++] || SPECIES[index][0];
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
}

const ROUTE = [
  ["curtain", "bookshelf", "post"],
  ["porch", "trellis", "post"],
  ["fence", "trunk", "post"],
  ["coop", "shed", "post"],
];

function addRoutes(level, index) {
  const floors = level.solids.filter((block) => block.kind === "floor" && block.w > 760 && block.x > 700 && block.x + block.w < level.owner.x - 180);
  const floor = floors[1] || floors[0];
  if (!floor) {
    level.climbs = [];
    return;
  }
  const base = floor.x + Math.min(220, floor.w * 0.28);
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
  level.cans = [{ x: tiers[2].x + tiers[2].w * 0.62, y: tiers[2].y - 26, got: false }];
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
  if (climb && !player.onGround) {
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
  const ledge = findLedge(state);
  if (ledge) player.ledgeCoyote = 0.14;
  const airborne = player.leftGround == null ? 1 : player.leftGround;
  if (!player.onGround && airborne > 0.22 && player.vy > -40 && player.ledgeCoyote > 0 && ledge) {
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
    if (chest > block.y + 22 || chest < block.y - 42) continue;
    const reach = player.x + 32 > block.x - 22 && player.x < block.x + block.w + 22;
    if (!reach) continue;
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
        state.banner = "Wet food!";
        state.bannerT = 1.6;
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
      state.foodHint = true;
      state.banner = "Wet food energy.";
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
  return { slip, wind, bounce };
}

function rideRoomba(state, hazard, dt, audio, input) {
  const player = state.player;
  hazard.cool = Math.max(0, (hazard.cool || 0) - dt);
  const feet = player.y + 58;
  const over = !player.ride && hazard.cool <= 0 && player.vy >= 0 && feet < GROUND - 2 && feet > GROUND - 40 && Math.abs(player.x + 16 - hazard.x) < 24;
  if (over) {
    player.ride = hazard;
    hazard.ride = 10;
    hazard.rideLock = 0.28;
    state.banner = "Jump to hop off. Left and right nudge.";
    state.bannerT = 2.2;
    audio.hum(true, 10);
  }
  if (player.ride !== hazard) return;
  hazard.rideLock = Math.max(0, (hazard.rideLock || 0) - dt);
  hazard.ride -= dt;
  if (input.left) hazard.dir = -1;
  if (input.right) hazard.dir = 1;
  let dir = hazard.dir || 1;
  const ahead = hazard.x + dir * 34;
  if (!floorAt(state.level, ahead) || ahead < 48 || ahead > state.level.owner.x - 120 || wallAt(state.level, ahead)) dir *= -1;
  hazard.dir = dir;
  hazard.x = Math.max(36, Math.min(state.level.width - 48, hazard.x + dir * 88 * dt));
  player.x = hazard.x - 16;
  player.y = GROUND - 72;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.facing = dir > 0 ? 1 : -1;
  for (const enemy of state.level.enemies) {
    if (enemy.alive === false || enemy.flee) continue;
    if (Math.abs(enemy.x - hazard.x) < 36 && Math.abs(enemy.y - (GROUND - 20)) < 40) {
      enemy.alive = false;
      enemy.flee = 1;
      enemy.vy = -180;
      enemy.vx = dir * 140;
      state.particles.push({ x: enemy.x, y: enemy.y, vx: dir * 20, vy: -40, life: 0.45, max: 0.45, kind: "star", color: "#fff6c8" });
      state.particles.push({ x: enemy.x, y: enemy.y - 8, vx: -dir * 16, vy: -10, life: 0.35, max: 0.35, kind: "puff", color: "#efe7dc" });
    }
  }
  audio.hum(true, hazard.ride);
  if (hazard.ride < 2 && Math.floor(hazard.ride * 2) !== hazard.beep) {
    hazard.beep = Math.floor(hazard.ride * 2);
    audio.blip(880, 0.07, 0.04);
  }
  const hopOff = hazard.ride <= 0 || (hazard.rideLock <= 0 && input.jumpPressed && !player.prevJump);
  if (hopOff) {
    player.ride = null;
    player.vy = -260;
    player.onGround = false;
    hazard.ride = 0;
    hazard.cool = 3.2;
    audio.hum(false, 0);
    audio.blip(320, 0.12, 0.05);
  }
}

function floorAt(level, x) {
  return level.solids.some((block) => block.kind === "floor" && x > block.x + 12 && x < block.x + block.w - 12 && Math.abs(block.y - GROUND) < 6);
}

function wallAt(level, x) {
  return level.solids.some((block) => block.kind !== "floor" && block.kind !== "pond" && x > block.x && x < block.x + block.w && block.y < GROUND - 8 && block.y + block.h > GROUND - 24);
}

function slide(hazard, dt) {
  if (hazard.ride > 0) return;
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
  g.translate(hazard.x, GROUND);
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
    g.fillStyle = "#5c6b73";
    g.beginPath();
    g.ellipse(0, -8, 18, 8, 0, 0, Math.PI * 2);
    g.fill();
    const blink = hazard.ride > 0 && Math.sin(time * (hazard.ride < 2 ? 18 : 8)) > 0;
    g.fillStyle = blink ? "#fff" : "#7ec8ff";
    g.beginPath();
    g.arc(0, -8, 4, 0, Math.PI * 2);
    g.fill();
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
  jay: { body: "#2f6fbe", belly: "#f7f9fc", wing: "#1c4f93", tail: "#163e74", mask: "#16181c", beak: "#2c3036" },
  cardinal: { body: "#d23b45", belly: "#e56a70", wing: "#a82432", tail: "#8e1c28", mask: "#1a1a1a", beak: "#f0d78c", crest: true },
  sparrow: { body: "#8d7048", belly: "#ead8b4", wing: "#6d5434", tail: "#5c4630", mask: "#5a4636", beak: "#c4a06a", streak: true },
  robin: { body: "#6e675f", belly: "#e07a45", wing: "#514c47", tail: "#3e3a36", mask: "#3a3532", beak: "#e2b84a" },
  crow: { body: "#2a2e33", belly: "#3c424a", wing: "#1b1e22", tail: "#141618", mask: "#111214", beak: "#d8c07a" },
  finch: { body: "#b7b48a", belly: "#efe6c2", wing: "#8d8a62", tail: "#6e6c4c", mask: "#5c5840", beak: "#d2b48a" },
};

export function drawBird(g, enemy, time) {
  const look = BIRDS[enemy.species] || BIRDS.jay;
  const diving = enemy.dive === "go";
  const warn = enemy.dive === "warn";
  const flap = diving ? 0.15 : Math.sin(time * (warn ? 22 : 14) + (enemy.x || 0)) * (warn ? 0.9 : 0.55);
  g.rotate(diving ? 0.5 : 0);
  g.fillStyle = look.tail;
  g.beginPath();
  g.moveTo(-12, 0);
  g.lineTo(-22, -6);
  g.lineTo(-20, 2);
  g.lineTo(-22, 7);
  g.fill();
  g.fillStyle = look.body;
  g.beginPath();
  g.ellipse(-1, 1, 12, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = look.belly;
  g.beginPath();
  g.ellipse(1, 3, 7, 4, 0, 0, Math.PI * 2);
  g.fill();
  if (look.streak) {
    g.strokeStyle = "rgba(80,50,30,0.35)";
    g.beginPath();
    g.moveTo(-6, 0);
    g.lineTo(4, 2);
    g.moveTo(-4, 3);
    g.lineTo(5, 4);
    g.stroke();
  }
  g.save();
  g.translate(-2, -1);
  g.rotate(flap);
  g.fillStyle = look.wing;
  g.beginPath();
  g.ellipse(-2, -6, 9, 3.4, -0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.fillStyle = look.body;
  g.beginPath();
  g.arc(8, -2, 5.2, 0, Math.PI * 2);
  g.fill();
  if (look.crest) {
    g.fillStyle = look.body;
    g.beginPath();
    g.moveTo(6, -6);
    g.lineTo(9, -13);
    g.lineTo(12, -5);
    g.fill();
  }
  if (look.mask) {
    g.fillStyle = look.mask;
    g.beginPath();
    g.ellipse(10, -2, 3.2, 2.2, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#f7f4ea";
  g.beginPath();
  g.arc(10, -3, 1.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1d2430";
  g.beginPath();
  g.arc(10.4, -3, 0.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = look.beak;
  g.beginPath();
  g.moveTo(12, -2);
  g.lineTo(18, -1);
  g.lineTo(12, 1);
  g.fill();
  if (!diving) {
    g.strokeStyle = look.mask;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(2, 7);
    g.lineTo(1, 11);
    g.moveTo(6, 7);
    g.lineTo(7, 11);
    g.stroke();
  }
}

export function birdSheet(g, w, h) {
  const names = Object.keys(BIRDS);
  names.forEach((name, index) => {
    const x = (index + 0.5) * (w / (names.length + 1));
    g.save();
    g.translate(x, h * 0.42);
    g.scale(3.1, 3.1);
    drawBird(g, { species: name, dive: null, x: index }, 0.4);
    g.restore();
    g.fillStyle = "#5c4638";
    g.font = "600 15px 'Avenir Next', 'Segoe UI', sans-serif";
    g.textAlign = "center";
    g.fillText(name, x, h * 0.72);
  });
}
