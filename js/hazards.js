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
      hop: ["yarn", "roomba", "mower", "roses", "dog", "spark", "grill", "sprinkler"].includes(kind),
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
}

export function updateHazards(state, dt, audio) {
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
    if (hazard.kind === "roomba" && near && player.onGround && player.y + 58 > GROUND - 18 && Math.abs(player.x + 16 - hazard.x) < 18) {
      if (player.vy >= 0 && player.y + 40 < GROUND - 8) bounce = -80;
      else poke(state, audio);
    }
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

function slide(hazard, dt) {
  if (hazard.kind === "yarn" || hazard.kind === "roomba" || hazard.kind === "mower" || hazard.kind === "cart") {
    const speed = hazard.kind === "yarn" ? 64 : hazard.kind === "mower" ? 78 : 36;
    hazard.x += hazard.dir * speed * dt;
    if (hazard.x < hazard.min || hazard.x > hazard.max) hazard.dir *= -1;
  }
}

function poke(state, audio) {
  if (state.player.invuln > 0 || state._poke) return;
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
    g.fillStyle = "#9ad7ff";
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
