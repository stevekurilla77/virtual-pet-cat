// Pre-rendered rooms and the woman waiting at the end of each one.

const GROUND = 470;

const CARDIGAN = {
  living: "#d96b86",
  porch: "#6eae84",
  yard: "#e2b84a",
  neighbor: "#a894e0",
};

function canvas(w, h) {
  const el = document.createElement("canvas");
  el.width = Math.max(1, Math.ceil(w));
  el.height = Math.max(1, Math.ceil(h));
  return el;
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift) => {
    const ca = (pa >> shift) & 255;
    const cb = (pb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t);
  };
  return `#${[16, 8, 0].map((shift) => ch(shift).toString(16).padStart(2, "0")).join("")}`;
}

function soften(hex) {
  return mix(hex, "#f4efe8", 0.28);
}

export function bakeScene(level) {
  const far = canvas(960, 420);
  const mid = canvas(720, 520);
  const near = canvas(level.width, 520);
  const anchors = { windows: [], fires: [], plants: [], swings: [] };
  paintFar(far.getContext("2d"), level.theme);
  paintMid(mid.getContext("2d"), level.theme);
  paintNear(near.getContext("2d"), level, anchors);
  return { far, mid, near, anchors };
}

function paintFar(g, theme) {
  const sky = g.createLinearGradient(0, 0, 0, 420);
  if (theme === "living") {
    sky.addColorStop(0, "#f6d7a8");
    sky.addColorStop(1, "#f3e2c4");
  } else if (theme === "porch") {
    sky.addColorStop(0, "#49b7ee");
    sky.addColorStop(0.55, "#9adfff");
    sky.addColorStop(1, "#fff0c4");
  } else if (theme === "yard") {
    sky.addColorStop(0, "#5ec8f2");
    sky.addColorStop(0.45, "#b7e98a");
    sky.addColorStop(1, "#e7f6b8");
  } else {
    sky.addColorStop(0, "#5d458c");
    sky.addColorStop(0.42, "#e07a4a");
    sky.addColorStop(1, "#ffc48a");
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 960, 420);
  g.fillStyle = theme === "neighbor" ? "#ffd2a4" : "#fff6cf";
  g.globalAlpha = 0.9;
  g.beginPath();
  g.arc(theme === "living" ? 760 : 180, theme === "neighbor" ? 120 : 78, theme === "living" ? 0 : 46, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.55;
  g.fillStyle = theme === "yard" ? "#8fd0f0" : "#ffffff";
  g.beginPath();
  g.ellipse(240, 70, 54, 16, 0, 0, Math.PI * 2);
  g.ellipse(620, 96, 70, 18, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  if (theme !== "living") {
    g.fillStyle = theme === "neighbor" ? "#6a3d62" : theme === "yard" ? "#67b15c" : "#7d9a62";
    g.globalAlpha = 0.45;
    g.beginPath();
    g.ellipse(160, 300, 180, 46, 0, 0, Math.PI * 2);
    g.ellipse(520, 318, 220, 40, 0, 0, Math.PI * 2);
    g.ellipse(860, 308, 160, 36, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
}

function paintMid(g, theme) {
  if (theme === "living") {
    g.fillStyle = soften("#f3d2ae");
    g.fillRect(0, 0, 720, 470);
    g.fillStyle = "rgba(255,236,214,0.45)";
    for (let x = 0; x < 720; x += 46) g.fillRect(x, 0, 18, 300);
    g.fillStyle = soften("#e7c49a");
    g.fillRect(0, 300, 720, 170);
    g.fillStyle = "#f8ead4";
    for (let x = 24; x < 720; x += 90) g.fillRect(x, 312, 70, 120);
    g.fillStyle = soften("#c9844e");
    g.fillRect(0, 458, 720, 14);
  } else if (theme === "porch") {
    g.fillStyle = soften("#f4e4d0");
    g.fillRect(0, 120, 720, 350);
    g.fillStyle = "rgba(214, 176, 140, 0.35)";
    for (let y = 132; y < 450; y += 16) g.fillRect(0, y, 720, 7);
    g.fillStyle = soften("#d7b48a");
    g.fillRect(0, 456, 720, 16);
  } else if (theme === "yard") {
    g.fillStyle = soften("#8ed56a");
    g.fillRect(0, 300, 720, 220);
    g.fillStyle = "rgba(255,255,255,0.16)";
    for (let x = 0; x < 720; x += 28) g.fillRect(x, 300, 14, 220);
    g.fillStyle = soften("#5ea84c");
    g.fillRect(0, 292, 720, 10);
  } else {
    g.fillStyle = soften("#c46a62");
    g.fillRect(0, 150, 720, 320);
    g.fillStyle = "rgba(120, 50, 48, 0.18)";
    for (let y = 162; y < 460; y += 18) {
      g.fillRect(0, y, 720, 2);
      const shift = ((y / 18) % 2) * 22;
      for (let x = shift; x < 720; x += 44) g.fillRect(x, y - 16, 2, 16);
    }
    g.fillStyle = soften("#8d4a55");
    g.fillRect(0, 458, 720, 14);
  }
}

function paintNear(g, level, anchors) {
  const step = 980;
  for (let x = 40; x < level.width - 700; x += step) {
    if (level.theme === "living") livingStamp(g, x, anchors);
    else if (level.theme === "porch") porchStamp(g, x, anchors);
    else if (level.theme === "yard") yardStamp(g, x, anchors);
    else neighborStamp(g, x, anchors);
  }
  finale(g, level, anchors);
}

function finale(g, level, anchors) {
  const x = level.owner.x;
  if (level.theme === "living") {
    fireplace(g, x - 70, anchors);
    armchair(g, x + 90);
    plant(g, x - 130);
  } else if (level.theme === "porch") {
    door(g, x - 20);
    mat(g, x + 10);
    pot(g, x - 90, "#e07a8c");
    pot(g, x + 80, "#f2c14b");
  } else if (level.theme === "yard") {
    oak(g, x - 30, anchors);
    gnome(g, x + 80);
  } else {
    doorway(g, x - 10);
    coop(g, x - 220);
    hay(g, x + 70);
  }
}

function livingStamp(g, x, anchors) {
  windowBay(g, x + 10, anchors);
  bookcase(g, x + 250);
  lamp(g, x + 390);
  armchair(g, x + 470);
  coffee(g, x + 560);
  plant(g, x + 200);
  yarn(g, x + 640);
  catTree(g, x + 730);
  clock(g, x + 860);
  rugOval(g, x + 500);
}

function porchStamp(g, x, anchors) {
  door(g, x + 40);
  mat(g, x + 70);
  railing(g, x + 180, 420);
  rocker(g, x + 250);
  swing(g, x + 430, anchors);
  pot(g, x + 620, "#ff7aa2");
  pot(g, x + 700, "#ffd36a");
  hanger(g, x + 780, anchors);
  mailbox(g, x + 880);
  light(g, x + 120);
}

function yardStamp(g, x, anchors) {
  fenceRun(g, x, 360);
  bed(g, x + 40, ["#ff7aa2", "#ffd36a", "#7ed957"]);
  bath(g, x + 200);
  feeder(g, x + 300, anchors);
  gnome(g, x + 390);
  oak(g, x + 500, anchors);
  bush(g, x + 700);
  hose(g, x + 800);
  can(g, x + 860);
  shed(g, x + 880);
}

function neighborStamp(g, x, anchors) {
  fenceRun(g, x, 300);
  coop(g, x + 40);
  hay(g, x + 180);
  shed(g, x + 280);
  trampoline(g, x + 460);
  grill(g, x + 640);
  line(g, x + 740, anchors);
  bowl(g, x + 900);
}

function windowBay(g, x, anchors) {
  anchors.windows.push(x + 70);
  g.fillStyle = soften("#b9dff3");
  roundRect(g, x, 78, 200, 150, 12);
  g.fill();
  g.strokeStyle = "#fff8ef";
  g.lineWidth = 8;
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x + 100, 86);
  g.lineTo(x + 100, 220);
  g.moveTo(x + 8, 152);
  g.lineTo(x + 192, 152);
  g.stroke();
  g.fillStyle = "#6aa7c9";
  g.globalAlpha = 0.7;
  g.beginPath();
  g.ellipse(x + 70, 130, 18, 8, 0.2, 0, Math.PI * 2);
  g.ellipse(x + 130, 118, 14, 6, -0.2, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  curtain(g, x - 8, 70, 28, 170, "#e07a8c");
  curtain(g, x + 178, 70, 28, 170, "#e07a8c");
}

function curtain(g, x, y, w, h, color) {
  g.fillStyle = soften(color);
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + w * 0.8, y + 30, x + w, y);
  g.lineTo(x + w, y + h);
  g.quadraticCurveTo(x + w * 0.4, y + h - 16, x, y + h);
  g.fill();
}

function bookcase(g, x) {
  g.fillStyle = soften("#c4925a");
  g.fillRect(x, 150, 86, 320);
  g.fillStyle = "#f8efe4";
  for (let i = 0; i < 4; i++) g.fillRect(x + 6, 168 + i * 70, 74, 8);
  const books = ["#d96b86", "#6eae84", "#e2b84a", "#6aa7c9", "#a894e0"];
  for (let shelf = 0; shelf < 4; shelf++) {
    let bx = x + 10;
    for (let i = 0; i < 5; i++) {
      g.fillStyle = soften(books[(shelf + i) % books.length]);
      g.fillRect(bx, 176 + shelf * 70, 10, 52);
      bx += 13;
    }
  }
}

function lamp(g, x) {
  g.strokeStyle = soften("#8d6a45");
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(x, GROUND);
  g.lineTo(x, 210);
  g.stroke();
  g.fillStyle = soften("#f6e2a8");
  g.beginPath();
  g.moveTo(x - 22, 230);
  g.lineTo(x + 22, 230);
  g.lineTo(x + 12, 180);
  g.lineTo(x - 12, 180);
  g.fill();
  g.fillStyle = "rgba(255, 214, 120, 0.35)";
  g.beginPath();
  g.moveTo(x - 10, 230);
  g.lineTo(x + 10, 230);
  g.lineTo(x + 40, GROUND);
  g.lineTo(x - 40, GROUND);
  g.fill();
}

function armchair(g, x) {
  g.fillStyle = soften("#d96b86");
  roundRect(g, x, GROUND - 78, 70, 70, 16);
  g.fill();
  g.fillStyle = soften("#f4c9d4");
  roundRect(g, x + 10, GROUND - 58, 50, 28, 10);
  g.fill();
  g.fillStyle = soften("#c45a74");
  g.fillRect(x - 8, GROUND - 70, 12, 48);
  g.fillRect(x + 66, GROUND - 70, 12, 48);
}

function coffee(g, x) {
  g.fillStyle = soften("#e2b84a");
  roundRect(g, x, GROUND - 36, 78, 28, 8);
  g.fill();
  g.fillStyle = soften("#f7e7b0");
  g.fillRect(x + 8, GROUND - 30, 62, 6);
}

function plant(g, x) {
  g.fillStyle = soften("#c47a4a");
  g.fillRect(x, GROUND - 28, 26, 24);
  g.fillStyle = soften("#3f9a55");
  g.beginPath();
  g.ellipse(x + 8, GROUND - 40, 14, 18, -0.4, 0, Math.PI * 2);
  g.ellipse(x + 20, GROUND - 46, 12, 16, 0.4, 0, Math.PI * 2);
  g.fill();
}

function yarn(g, x) {
  g.fillStyle = soften("#d96b86");
  g.beginPath();
  g.arc(x, GROUND - 12, 14, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#f8e4ea";
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(x, GROUND - 12, 8, 0.4, 2.2);
  g.stroke();
}

function catTree(g, x) {
  g.fillStyle = soften("#c4925a");
  g.fillRect(x + 16, GROUND - 120, 8, 120);
  g.fillStyle = soften("#f4c9d4");
  g.beginPath();
  g.ellipse(x + 20, GROUND - 118, 28, 10, 0, 0, Math.PI * 2);
  g.ellipse(x + 36, GROUND - 70, 22, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = soften("#e7e4df");
  g.beginPath();
  g.arc(x + 8, GROUND - 46, 16, 0, Math.PI * 2);
  g.fill();
}

function clock(g, x) {
  g.fillStyle = soften("#8d6a45");
  g.fillRect(x, GROUND - 150, 36, 150);
  g.fillStyle = soften("#f8efe4");
  g.beginPath();
  g.arc(x + 18, GROUND - 160, 22, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#5c4638";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 18, GROUND - 160);
  g.lineTo(x + 18, GROUND - 172);
  g.moveTo(x + 18, GROUND - 160);
  g.lineTo(x + 28, GROUND - 156);
  g.stroke();
}

function rugOval(g, x) {
  g.fillStyle = "rgba(217, 107, 134, 0.35)";
  g.beginPath();
  g.ellipse(x, GROUND - 6, 90, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(226, 184, 74, 0.8)";
  g.lineWidth = 3;
  g.stroke();
}

function fireplace(g, x, anchors) {
  anchors.fires.push(x + 50);
  g.fillStyle = soften("#a34b3c");
  g.fillRect(x, GROUND - 110, 120, 110);
  g.fillStyle = "#5c4638";
  g.fillRect(x + 28, GROUND - 70, 64, 70);
  g.fillStyle = soften("#e2b84a");
  g.fillRect(x - 10, GROUND - 118, 140, 14);
  g.fillStyle = soften("#f8efe4");
  g.fillRect(x + 8, GROUND - 146, 22, 26);
  g.fillRect(x + 40, GROUND - 150, 28, 30);
  g.fillRect(x + 78, GROUND - 142, 20, 22);
  g.fillStyle = "#f2c14b";
  g.fillRect(x + 14, GROUND - 138, 10, 8);
  g.fillRect(x + 48, GROUND - 140, 12, 8);
}

function door(g, x) {
  g.fillStyle = soften("#f7f1ea");
  g.fillRect(x - 16, 150, 120, 320);
  g.fillStyle = soften("#c45a4a");
  roundRect(g, x, 175, 84, 295, 8);
  g.fill();
  g.fillStyle = "#f2c14b";
  g.beginPath();
  g.arc(x + 68, 320, 4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = soften("#3f9a55");
  g.lineWidth = 6;
  g.beginPath();
  g.arc(x + 42, 168, 22, Math.PI, 0);
  g.stroke();
  g.fillStyle = "#e07a8c";
  g.beginPath();
  g.arc(x + 30, 160, 5, 0, Math.PI * 2);
  g.arc(x + 54, 160, 5, 0, Math.PI * 2);
  g.fill();
}

function mat(g, x) {
  g.fillStyle = soften("#6eae84");
  roundRect(g, x, GROUND - 12, 64, 14, 4);
  g.fill();
}

function railing(g, x, w) {
  g.fillStyle = soften("#fff6ea");
  g.fillRect(x, GROUND - 70, w, 8);
  for (let i = 0; i < w; i += 16) g.fillRect(x + i, GROUND - 62, 5, 62);
}

function rocker(g, x) {
  g.strokeStyle = soften("#8d6a45");
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x + 24, GROUND - 4, 26, Math.PI, 0);
  g.stroke();
  g.fillStyle = soften("#6aa7c9");
  roundRect(g, x + 8, GROUND - 58, 36, 28, 8);
  g.fill();
  g.fillRect(x + 8, GROUND - 86, 8, 36);
}

function swing(g, x, anchors) {
  anchors.swings.push(x + 40);
  g.strokeStyle = soften("#8d6a45");
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 10, 120);
  g.lineTo(x + 16, GROUND - 70);
  g.moveTo(x + 70, 120);
  g.lineTo(x + 64, GROUND - 70);
  g.stroke();
  g.fillStyle = soften("#f2c14b");
  roundRect(g, x, GROUND - 78, 80, 16, 8);
  g.fill();
}

function pot(g, x, color) {
  g.fillStyle = soften("#c47a4a");
  g.beginPath();
  g.moveTo(x, GROUND - 34);
  g.lineTo(x + 28, GROUND - 34);
  g.lineTo(x + 24, GROUND);
  g.lineTo(x + 4, GROUND);
  g.fill();
  g.fillStyle = soften(color);
  g.beginPath();
  g.ellipse(x + 14, GROUND - 40, 16, 12, 0, 0, Math.PI * 2);
  g.fill();
}

function hanger(g, x, anchors) {
  anchors.plants.push(x);
  g.strokeStyle = soften("#8d6a45");
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x, 90);
  g.lineTo(x, 150);
  g.stroke();
  g.fillStyle = soften("#6eae84");
  g.beginPath();
  g.ellipse(x, 168, 18, 22, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ff7aa2";
  g.beginPath();
  g.arc(x - 6, 164, 4, 0, Math.PI * 2);
  g.arc(x + 6, 172, 4, 0, Math.PI * 2);
  g.fill();
}

function mailbox(g, x) {
  g.fillStyle = soften("#8d6a45");
  g.fillRect(x + 10, GROUND - 70, 6, 70);
  g.fillStyle = soften("#6aa7c9");
  roundRect(g, x, GROUND - 92, 36, 26, 8);
  g.fill();
  g.fillStyle = "#f2c14b";
  g.fillRect(x + 28, GROUND - 84, 8, 6);
}

function light(g, x) {
  g.fillStyle = soften("#f8efe4");
  g.beginPath();
  g.arc(x, 120, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255, 230, 160, 0.35)";
  g.beginPath();
  g.arc(x, 128, 18, 0, Math.PI * 2);
  g.fill();
}

function fenceRun(g, x, w) {
  g.fillStyle = soften("#f7f1ea");
  for (let i = 0; i < w; i += 18) {
    g.beginPath();
    g.moveTo(x + i, GROUND - 46);
    g.lineTo(x + i + 8, GROUND - 58);
    g.lineTo(x + i + 16, GROUND - 46);
    g.lineTo(x + i + 16, GROUND);
    g.lineTo(x + i, GROUND);
    g.fill();
  }
  g.fillStyle = soften("#e7d3be");
  g.fillRect(x, GROUND - 36, w, 5);
}

function bed(g, x, colors) {
  g.fillStyle = soften("#6b4a32");
  g.fillRect(x, GROUND - 28, 110, 28);
  colors.forEach((color, i) => {
    g.fillStyle = soften(color);
    g.beginPath();
    g.ellipse(x + 18 + i * 28, GROUND - 36, 12, 16, 0, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = soften("#7ed957");
  g.fillRect(x + 70, GROUND - 22, 8, 16);
  g.fillRect(x + 86, GROUND - 26, 10, 20);
}

function bath(g, x) {
  g.strokeStyle = soften("#8d6a45");
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x, GROUND);
  g.lineTo(x, GROUND - 36);
  g.moveTo(x + 28, GROUND);
  g.lineTo(x + 28, GROUND - 36);
  g.stroke();
  g.fillStyle = soften("#d7e7ef");
  g.beginPath();
  g.ellipse(x + 14, GROUND - 40, 20, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#8ec8e8";
  g.beginPath();
  g.ellipse(x + 14, GROUND - 42, 12, 4, 0, 0, Math.PI * 2);
  g.fill();
}

function feeder(g, x, anchors) {
  anchors.plants.push(x);
  g.fillStyle = soften("#8d6a45");
  g.fillRect(x, GROUND - 90, 5, 90);
  g.fillStyle = soften("#c45a4a");
  g.beginPath();
  g.moveTo(x - 16, GROUND - 90);
  g.lineTo(x + 22, GROUND - 90);
  g.lineTo(x + 3, GROUND - 108);
  g.fill();
  g.fillStyle = soften("#f8efe4");
  g.fillRect(x - 12, GROUND - 88, 28, 10);
}

function gnome(g, x) {
  g.fillStyle = soften("#6aa7c9");
  g.fillRect(x, GROUND - 28, 16, 28);
  g.fillStyle = "#f0c7a8";
  g.beginPath();
  g.arc(x + 8, GROUND - 34, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = soften("#d96b86");
  g.beginPath();
  g.moveTo(x - 2, GROUND - 36);
  g.lineTo(x + 18, GROUND - 36);
  g.lineTo(x + 8, GROUND - 52);
  g.fill();
}

function oak(g, x, anchors) {
  anchors.swings.push(x + 20);
  g.fillStyle = soften("#8d5a32");
  g.fillRect(x, GROUND - 150, 22, 150);
  g.fillStyle = soften("#3f9a55");
  g.beginPath();
  g.arc(x - 10, GROUND - 170, 36, 0, Math.PI * 2);
  g.arc(x + 28, GROUND - 180, 40, 0, Math.PI * 2);
  g.arc(x + 10, GROUND - 150, 34, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = soften("#6b4a32");
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 20, GROUND - 168);
  g.lineTo(x + 20, GROUND - 70);
  g.stroke();
  g.fillStyle = soften("#c4925a");
  roundRect(g, x + 4, GROUND - 74, 34, 8, 3);
  g.fill();
}

function bush(g, x) {
  g.fillStyle = soften("#3f9a55");
  g.beginPath();
  g.arc(x, GROUND - 18, 20, 0, Math.PI * 2);
  g.arc(x + 18, GROUND - 14, 16, 0, Math.PI * 2);
  g.fill();
}

function hose(g, x) {
  g.strokeStyle = soften("#3f9a55");
  g.lineWidth = 4;
  g.beginPath();
  g.arc(x, GROUND - 16, 16, 0.2, 5);
  g.stroke();
}

function can(g, x) {
  g.fillStyle = soften("#6aa7c9");
  g.fillRect(x, GROUND - 26, 18, 22);
  g.strokeStyle = soften("#d7e7ef");
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x + 4, GROUND - 20, 6, Math.PI, 0);
  g.moveTo(x + 18, GROUND - 20);
  g.lineTo(x + 28, GROUND - 28);
  g.stroke();
}

function shed(g, x) {
  g.fillStyle = soften("#c45a4a");
  g.fillRect(x, GROUND - 90, 80, 90);
  g.fillStyle = soften("#8d4a3c");
  g.beginPath();
  g.moveTo(x - 6, GROUND - 90);
  g.lineTo(x + 40, GROUND - 122);
  g.lineTo(x + 86, GROUND - 90);
  g.fill();
  g.fillStyle = "#f8efe4";
  g.fillRect(x + 30, GROUND - 48, 22, 48);
}

function coop(g, x) {
  g.fillStyle = soften("#e2b84a");
  g.fillRect(x, GROUND - 70, 90, 70);
  g.fillStyle = soften("#c47a4a");
  g.beginPath();
  g.moveTo(x - 4, GROUND - 70);
  g.lineTo(x + 45, GROUND - 98);
  g.lineTo(x + 94, GROUND - 70);
  g.fill();
  g.fillStyle = "#6b4a32";
  g.beginPath();
  g.arc(x + 24, GROUND - 28, 12, Math.PI, 0);
  g.fill();
  g.strokeStyle = soften("#f7f1ea");
  g.lineWidth = 2;
  for (let i = 0; i < 40; i += 8) {
    g.beginPath();
    g.moveTo(x + 50, GROUND - 10 - i);
    g.lineTo(x + 82, GROUND - 10 - i);
    g.stroke();
  }
}

function hay(g, x) {
  g.fillStyle = soften("#e2b84a");
  roundRect(g, x, GROUND - 32, 40, 32, 6);
  g.fill();
  g.strokeStyle = "#c4923a";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x + 8, GROUND - 28);
  g.lineTo(x + 32, GROUND - 6);
  g.moveTo(x + 20, GROUND - 30);
  g.lineTo(x + 10, GROUND - 4);
  g.stroke();
}

function trampoline(g, x) {
  g.strokeStyle = soften("#5c4638");
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x, GROUND);
  g.lineTo(x + 10, GROUND - 28);
  g.moveTo(x + 70, GROUND);
  g.lineTo(x + 60, GROUND - 28);
  g.stroke();
  g.fillStyle = soften("#6aa7c9");
  g.beginPath();
  g.ellipse(x + 35, GROUND - 30, 40, 10, 0, 0, Math.PI * 2);
  g.fill();
}

function grill(g, x) {
  g.fillStyle = soften("#5c4638");
  g.beginPath();
  g.ellipse(x + 16, GROUND - 36, 20, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x + 12, GROUND - 24, 4, 24);
  g.fillRect(x + 22, GROUND - 24, 4, 24);
  g.fillStyle = "#c45a4a";
  g.fillRect(x + 4, GROUND - 40, 24, 4);
}

function line(g, x, anchors) {
  anchors.plants.push(x + 40);
  g.strokeStyle = soften("#8d6a45");
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x, GROUND);
  g.lineTo(x, GROUND - 90);
  g.moveTo(x + 80, GROUND);
  g.lineTo(x + 80, GROUND - 90);
  g.moveTo(x, GROUND - 90);
  g.lineTo(x + 80, GROUND - 90);
  g.stroke();
  g.fillStyle = soften("#d7e7ef");
  g.fillRect(x + 16, GROUND - 78, 16, 20);
  g.fillStyle = soften("#d96b86");
  g.fillRect(x + 40, GROUND - 74, 18, 16);
}

function bowl(g, x) {
  g.fillStyle = "rgba(120, 190, 220, 0.75)";
  g.beginPath();
  g.ellipse(x, GROUND - 10, 34, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#7fd4f5";
  g.beginPath();
  g.ellipse(x - 6, GROUND - 14, 8, 4, 0.4, 0, Math.PI * 2);
  g.fill();
}

function doorway(g, x) {
  g.fillStyle = soften("#f7f1ea");
  g.fillRect(x - 20, 120, 150, 350);
  g.fillStyle = "#2c241c";
  roundRect(g, x, 160, 100, 310, 10);
  g.fill();
  const glow = g.createLinearGradient(x, 160, x, GROUND);
  glow.addColorStop(0, "rgba(255, 214, 140, 0.15)");
  glow.addColorStop(1, "rgba(255, 186, 90, 0.85)");
  g.fillStyle = glow;
  g.fillRect(x + 8, 180, 84, 290);
  g.fillStyle = "#f8efe4";
  g.fillRect(x + 46, 250, 6, 40);
}

function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function drawMotion(g, level, time, anchors) {
  const drift = 0.5 + 0.5 * Math.sin(time * 0.35);
  for (const x of anchors.windows) {
    g.save();
    g.translate(x, 150);
    g.rotate(Math.sin(time * 0.8) * 0.04);
    g.fillStyle = "rgba(224, 122, 140, 0.28)";
    g.fillRect(-18, -70, 14, 150);
    g.restore();
  }
  for (const x of anchors.fires) {
    g.fillStyle = `rgba(255, 170, 60, ${0.25 + drift * 0.35})`;
    g.beginPath();
    g.ellipse(x, GROUND - 40, 10 + drift * 6, 16 + drift * 8, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (const x of anchors.plants) {
    g.save();
    g.translate(x, GROUND - 20);
    g.rotate(Math.sin(time * 1.2 + x) * 0.08);
    g.fillStyle = "rgba(63, 154, 85, 0.35)";
    g.beginPath();
    g.ellipse(0, -8, 8, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  for (const x of anchors.swings) {
    g.save();
    g.translate(x, 140);
    g.rotate(Math.sin(time * 0.9 + x) * 0.06);
    g.strokeStyle = "rgba(90, 60, 40, 0.35)";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, 80);
    g.stroke();
    g.restore();
  }
}

export function drawLady(g, x, y, time, theme, mode) {
  const reunion = mode === "reunion" || mode === "feast";
  const feast = mode === "feast";
  const cardigan = CARDIGAN[theme] || CARDIGAN.living;
  const apron = theme === "yard" || theme === "neighbor";
  const rock = reunion ? 0 : Math.sin(time * 1.5) * 2;
  const wave = Math.sin(time * 2.2);
  g.save();
  g.translate(x, y + rock);
  g.fillStyle = "rgba(50, 32, 24, 0.18)";
  g.beginPath();
  g.ellipse(0, 2, 34, 7, 0, 0, Math.PI * 2);
  g.fill();

  const skin = "#f0c7a8";
  const skinShade = "#e2b292";
  g.fillStyle = skinShade;
  g.beginPath();
  g.ellipse(-10, -4, 8, 4, 0, 0, Math.PI * 2);
  g.ellipse(12, -4, 8, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = skinShade;
  g.lineWidth = 8;
  g.lineCap = "round";
  if (reunion) {
    g.beginPath();
    g.moveTo(-8, -68);
    g.quadraticCurveTo(-16, -36, -6, -16);
    g.moveTo(10, -68);
    g.quadraticCurveTo(4, -30, 14, -18);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(-8, -68);
    g.lineTo(-10, -8);
    g.moveTo(10, -68);
    g.lineTo(12, -8);
    g.stroke();
  }

  g.fillStyle = "#f7e4ea";
  g.beginPath();
  g.moveTo(-26, -74);
  g.quadraticCurveTo(-32, -30, -18, -16);
  g.lineTo(22, -16);
  g.quadraticCurveTo(34, -30, 26, -74);
  g.fill();
  g.fillStyle = "#e07a8c";
  for (const spot of [[-12, -48], [6, -40], [14, -58], [-4, -28]]) {
    g.beginPath();
    g.ellipse(spot[0], spot[1], 3.2, 2.2, 0.4, 0, Math.PI * 2);
    g.fill();
  }
  if (apron) {
    g.fillStyle = "#f8efe4";
    g.beginPath();
    g.moveTo(-16, -72);
    g.lineTo(16, -72);
    g.lineTo(14, -24);
    g.lineTo(-14, -24);
    g.fill();
    g.strokeStyle = "#e2b84a";
    g.lineWidth = 2;
    g.strokeRect(-8, -48, 16, 12);
  }

  g.save();
  g.translate(0, -74);
  g.rotate(reunion ? 0.42 : wave * 0.02);
  g.fillStyle = cardigan;
  roundRect(g, -22, -40, 44, 46, 12);
  g.fill();
  g.fillStyle = "#f7e4ea";
  g.beginPath();
  g.moveTo(-6, -36);
  g.lineTo(6, -36);
  g.lineTo(4, 2);
  g.lineTo(-4, 2);
  g.fill();
  g.fillStyle = "#f2c14b";
  g.beginPath();
  g.arc(-12, -16, 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5c4638";
  g.beginPath();
  g.moveTo(-14, -18);
  g.quadraticCurveTo(-12, -14, -10, -18);
  g.fill();

  g.strokeStyle = cardigan;
  g.lineWidth = 9;
  g.lineCap = "round";
  g.beginPath();
  if (reunion) {
    g.moveTo(-16, -28);
    g.quadraticCurveTo(-36, -10, -28, 18);
    g.moveTo(16, -28);
    g.quadraticCurveTo(34, -6, 22, 20);
  } else {
    g.moveTo(-16, -28);
    g.quadraticCurveTo(-34, -8, -26, 8 + wave * 6);
    g.moveTo(16, -28);
    g.quadraticCurveTo(30, 0, 24, 16);
  }
  g.stroke();
  hand(g, reunion ? -28 : -26, reunion ? 20 : 10 + wave * 6, skin);
  hand(g, reunion ? 22 : 24, reunion ? 22 : 18, skin);
  if (feast) {
    g.fillStyle = "#fffaf4";
    g.beginPath();
    g.ellipse(24, 30, 13, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e23b3b";
    g.beginPath();
    g.arc(24, 26, 4.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2c14b";
    g.beginPath();
    g.arc(29, 27, 2.4, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = "#e7e4df";
  g.beginPath();
  g.arc(-2, -62, 18, 0, Math.PI * 2);
  g.arc(12, -58, 8, 0, Math.PI * 2);
  g.ellipse(-16, -52, 8, 12, 0.4, 0, Math.PI * 2);
  g.ellipse(14, -50, 7, 11, -0.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = skin;
  g.beginPath();
  g.arc(0, -58, 15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = skinShade;
  g.beginPath();
  g.ellipse(-8, -50, 4, 2.2, 0, 0, Math.PI * 2);
  g.ellipse(8, -50, 4, 2.2, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#5c4638";
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(-6, -60, 4.2, 0, Math.PI * 2);
  g.arc(6, -60, 4.2, 0, Math.PI * 2);
  g.moveTo(-2, -60);
  g.lineTo(2, -60);
  g.stroke();
  g.fillStyle = "#3d6b4f";
  g.beginPath();
  g.arc(-6, -60, 1.5, 0, Math.PI * 2);
  g.arc(6, -60, 1.5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#c47a6a";
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(0, -50, 5, 0.15, Math.PI - 0.15);
  g.stroke();
  g.fillStyle = "#5c4638";
  g.fillRect(-1, -56, 2, 4);
  g.restore();

  if (reunion) {
    const hearts = feast ? 7 : 4;
    for (let i = 0; i < hearts; i++) {
      const rise = ((time * 0.6 + i * 0.25) % 1);
      g.globalAlpha = 1 - rise;
      g.fillStyle = "#e07a8c";
      heart(g, -10 + i * 12, -150 - rise * 36, 5);
      g.globalAlpha = 1;
    }
  }
  g.restore();
}

function hand(g, x, y, skin) {
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(x, y, 5.5, 4.5, 0, 0, Math.PI * 2);
  g.fill();
  for (const dx of [-3.2, 0, 3.2]) {
    g.beginPath();
    g.ellipse(x + dx, y - 4, 1.2, 2.2, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function heart(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.3);
  g.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.2, y - s, x, y - s * 0.3);
  g.bezierCurveTo(x + s * 0.2, y - s, x + s, y - s * 0.4, x, y + s * 0.3);
  g.fill();
}
