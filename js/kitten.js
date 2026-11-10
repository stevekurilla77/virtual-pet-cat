// Painted kitten. Soft fur, real proportions, no cartoon outline.

import { COATS, EYES } from "./coats.js";
import { clonePose } from "./poses.js";

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex(r, g, b) {
  const h = (v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

function tone(coat) {
  return {
    light: mix(coat.base, "#fffaf6", coat.base === "#FFFEFC" ? 0.15 : 0.42),
    mid: coat.base,
    dark: coat.shade,
    deep: mix(coat.shade, "#2a211c", 0.35),
    belly: coat.belly,
  };
}

function fur(ctx, seed, count, x, y, w, h, angle, color, length, alpha) {
  let s = seed;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = 0.65;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    s = (s * 16807 + 11) % 2147483647;
    const u = (s % 1000) / 1000;
    s = (s * 16807 + 11) % 2147483647;
    const v = (s % 1000) / 1000;
    const px = x + u * w;
    const py = y + v * h;
    const wobble = ((s % 100) / 100 - 0.5) * 0.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(angle + wobble) * length, py + Math.sin(angle + wobble) * length);
    ctx.stroke();
  }
  ctx.restore();
}

function shade(ctx, x0, y0, x1, y1, light, mid, dark) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, light);
  g.addColorStop(0.42, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
}

function edge(ctx, color) {
  ctx.strokeStyle = mix(color, "#2a211c", 0.25);
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function paintCat(ctx, cat, time) {
  if (cat.inBox) return;
  const air = Math.min(1, Math.abs(cat.hop) / 90);
  ctx.save();
  ctx.translate(cat.x, cat.groundY + 3);
  ctx.globalAlpha = 0.2 * (1 - air * 0.5);
  ctx.fillStyle = "#5c4636";
  ctx.beginPath();
  ctx.ellipse(0, 0, (cat.curl > 0.6 ? 26 : 34) * cat.scale * (1 - air * 0.2), 8 * cat.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cat.x + Math.sin(time * 46) * (cat.purr || 0) * 0.28, cat.groundY + cat.hop);
  ctx.scale(cat.facing * cat.scale, cat.scale);
  const squash = cat.squash || 1;
  ctx.scale(1 + (1 - squash) * 0.28, squash);
  const rot = cat.drawRot || 0;
  ctx.translate(0, -24);
  ctx.rotate(rot);
  ctx.translate(0, 24);

  const scratch = Math.max(0, Math.min(1, cat.scratch || 0));
  if (scratch < 0.98 && cat.back < 0.98) {
    ctx.save();
    ctx.globalAlpha *= (1 - scratch) * (1 - cat.back);
    if (cat.curl < 0.98) {
      ctx.save();
      ctx.globalAlpha *= 1 - cat.curl;
      active(ctx, cat, time);
      ctx.restore();
    }
    if (cat.curl > 0.02) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, cat.curl);
      curled(ctx, cat, time);
      ctx.restore();
    }
    ctx.restore();
  }
  if (scratch < 0.98 && cat.back > 0.02) {
    ctx.save();
    ctx.globalAlpha *= (1 - scratch) * Math.min(1, cat.back);
    rolled(ctx, cat, time);
    ctx.restore();
  }
  if (scratch > 0.02) {
    ctx.save();
    ctx.globalAlpha *= scratch;
    scratching(ctx, cat, time);
    ctx.restore();
  }
  ctx.restore();
}

function active(ctx, cat, time) {
  const m = cat.m;
  const f = cat.app.hair === "long" ? 1 : 0;
  const breath = Math.sin(time * (cat.asleep ? 1.5 : 2.6)) * (cat.asleep ? 1.6 : 0.7);
  const tuck = m.legTuck;
  const colors = tone(cat.app.coat);
  const phase = cat.walkPhase || 0;
  const blend = cat.gaitBlend || 0;
  const gallop = cat.gait === "gallop";
  ctx.save();
  if (blend > 0.02 && tuck < 0.75) {
    if (gallop) {
      ctx.translate(0, -Math.max(0, Math.sin(phase * Math.PI * 2)) * 5 * blend);
      ctx.translate(0, -14);
      ctx.scale(1 + Math.sin(phase * Math.PI * 2) * 0.07 * blend, 1);
      ctx.translate(0, 14);
    } else {
      ctx.translate(Math.sin(phase * Math.PI * 2) * 1.4 * blend, Math.sin(phase * Math.PI * 4) * 1.15 * blend);
      ctx.rotate(Math.sin(phase * Math.PI * 2) * 0.04 * blend);
    }
  }
  tail(ctx, cat, m, time, f, colors);
  if (cat._hideBody) {
    ctx.restore();
    return;
  }
  if (tuck < 0.72) drawLegs(ctx, cat, m, breath, colors, "far");
  torso(ctx, cat, m, breath, f, tuck, colors, time);
  if (tuck < 0.72) drawLegs(ctx, cat, m, breath, colors, "near");
  else sitLegs(ctx, cat, m, breath, colors);
  const y = (m.bodyY + breath) * 0.35;
  const neckX = tuck > 0.62 ? 6 : 16 + (1 - tuck) * 8;
  const neckY = tuck > 0.62 ? -30 : y - 16;
  ctx.save();
  ctx.translate(neckX, neckY);
  head(ctx, cat, time, f, colors);
  ctx.restore();
  ctx.restore();
}

function torso(ctx, cat, m, breath, f, tuck, colors, time) {
  const y = (m.bodyY + breath) * 0.35;
  const fluff = f * 9;
  const trace = () => {
    ctx.beginPath();
    if (tuck > 0.62) {
      const rump = rumpAnchor(cat, time);
      ctx.moveTo(rump.x, rump.y);
      ctx.bezierCurveTo(rump.x - 8, -26, -18, -40 - fluff, -2, -34 - fluff * 0.3);
      ctx.bezierCurveTo(12, -32, 20 + fluff, -20, 14, -8);
      ctx.bezierCurveTo(10, -2, -6, 1, rump.x, rump.y);
    } else {
      const rump = rumpAnchor(cat, time);
      const gallop = cat.gait === "gallop" ? Math.sin((cat.walkPhase || 0) * Math.PI * 2) * 8 * (cat.gaitBlend || 0) : 0;
      const chest = 22 + fluff * 0.2 + Math.max(0, gallop);
      const top = -24 - fluff * 0.25;
      ctx.moveTo(rump.x, rump.y);
      ctx.bezierCurveTo(rump.x - 4, top, -2, top - 2, chest * 0.45, top + 6);
      ctx.bezierCurveTo(chest + 2, -14, chest, -8, chest - 8, -7);
      ctx.bezierCurveTo(6, -5, rump.x + 12, -8, rump.x, rump.y);
    }
    ctx.closePath();
  };
  trace();
  shade(ctx, -10, y - 28, 8, y + 18, colors.light, colors.mid, colors.dark);
  ctx.fill();
  ctx.save();
  trace();
  ctx.clip();
  patternBody(ctx, cat, y, tuck);
  fur(ctx, 41, f ? 80 : 54, -34, y - 26, 58, 34, 1.15, colors.deep, f ? 7.5 : 3.8, f ? 0.32 : 0.24);
  fur(ctx, 77, 24, -8, y - 16, 28, 18, 1.4, colors.light, f ? 5 : 2.6, 0.2);
  ctx.restore();
  if (tuck > 0.55 && cat.app.coat.pattern !== "point" && cat.app.coat.pattern !== "tortie") {
    ctx.fillStyle = colors.belly;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(4, -16, 8 + f * 2, 6 + f, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  trace();
  edge(ctx, colors.deep);
}

function patternBody(ctx, cat, y, tuck) {
  const coat = cat.app.coat;
  if (coat.pattern === "tabby") {
    ctx.strokeStyle = coat.stripe;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-16 + i * 8, y - 2, 11, 0.15, Math.PI - 0.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (coat.pattern === "calico" || coat.pattern === "tortie") {
    blob(ctx, coat.orange, -8, y - 4, 14, 10, 0.4, 0.85);
    if (coat.pattern === "calico") blob(ctx, coat.ink, 8, y + 2, 10, 8, -0.2, 0.8);
    else blob(ctx, coat.orange, 10, y + 4, 7, 5, 0.5, 0.7);
  } else if (coat.pattern === "point") {
    ctx.fillStyle = coat.point;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(16, y + 10, 8, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function blob(ctx, color, x, y, rx, ry, rot, alpha) {
  const g = ctx.createRadialGradient(x, y, 1, x, y, Math.max(rx, ry));
  g.addColorStop(0, color);
  g.addColorStop(1, mix(color, color, 0));
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function coatLeg(coat, colors, far) {
  const base = far ? mix(colors.mid, colors.dark, 0.5) : colors.mid;
  return base;
}

function sitLegs(ctx, cat, m, breath, colors) {
  const coat = cat.app.coat;
  const y = (m.bodyY + breath) * 0.35;
  const fore = coat.pattern === "point" ? coat.point : coatLeg(coat, colors, false);
  const paw = coat.pattern === "tuxedo" ? "#f3f0ec" : fore;
  frontLeg(ctx, { x: 2, y: y + 4 }, { x: 1, y: -1 }, fore, paw, false, coat);
  if (m.groom > 0.15) {
    const px = 10 + (m.headX - 8) * m.groom;
    const py = -1 + (m.headY + 8) * m.groom;
    frontLeg(ctx, { x: 10, y: y + 2 }, { x: px, y: py }, fore, paw, false, coat);
  } else if (cat.swat > 0.05) {
    frontLeg(ctx, { x: 10, y: y + 2 }, { x: 16 + 18 * cat.swat, y: -4 - 12 * cat.swat }, fore, paw, false, coat);
  } else {
    frontLeg(ctx, { x: 11, y: y + 4 }, { x: 12, y: -1 }, fore, paw, false, coat);
  }
  ctx.fillStyle = coat.pattern === "tuxedo" ? "#f3f0ec" : coatLeg(coat, colors, true);
  ctx.beginPath();
  ctx.ellipse(-10, -1.5, 6.5, 3.2, 0.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawLegs(ctx, cat, m, breath, colors, side) {
  const coat = cat.app.coat;
  const y = (m.bodyY + breath) * 0.35;
  const phase = cat.walkPhase || 0;
  const blend = cat.gaitBlend || 0;
  const gallop = cat.gait === "gallop";
  const roll = Math.sin(phase * Math.PI * 2) * 2.2 * blend;
  const specs = side === "far"
    ? [
        { kind: "hind", phase: gallop ? 0 : 0, hip: { x: -24 + roll, y: -16 }, rest: -18 },
        { kind: "fore", phase: gallop ? 0.5 : 0.5, hip: { x: 8, y: -15 }, rest: 10 },
      ]
    : [
        { kind: "hind", phase: gallop ? 0.06 : 0.5, hip: { x: -14 + roll, y: -14 }, rest: -6 },
        { kind: "fore", phase: gallop ? 0.5 : 0, hip: { x: 16 + m.stretch * 4, y: -14 }, rest: 20 },
      ];
  for (const spec of specs) {
    const step = gallop ? gallopStep(phase, spec.phase) : walkStep(phase, spec.phase);
    const x = spec.rest + step.x * blend + (1 - blend) * 0;
    const footY = -1.2 + step.y * blend;
    const far = side === "far";
    const leg = coat.pattern === "point" && footY > -8 ? coat.point : coatLeg(coat, colors, far);
    const pawColor = coat.pattern === "tuxedo" ? "#f3f0ec" : coat.pattern === "point" ? coat.point : leg;
    if (spec.kind === "hind") hindLeg(ctx, spec.hip, { x, y: footY }, leg, pawColor, far, coat);
    else frontLeg(ctx, spec.hip, { x, y: footY }, leg, pawColor, far, coat);
  }
}

function walkStep(phase, offset) {
  const p = (((phase || 0) + offset) % 1 + 1) % 1;
  const span = 13;
  if (p < 0.62) {
    const u = p / 0.62;
    return { x: span * (1 - 2 * u), y: 0 };
  }
  const u = (p - 0.62) / 0.38;
  return { x: span * (-1 + 2 * u), y: -Math.sin(u * Math.PI) * 6.5 };
}

function gallopStep(phase, offset) {
  const p = (((phase || 0) + offset) % 1 + 1) % 1;
  const span = 16;
  if (p < 0.4) {
    const u = p / 0.4;
    return { x: span * (0.35 - u), y: 0 };
  }
  const u = (p - 0.4) / 0.6;
  return { x: span * (-0.65 + 1.3 * u), y: -Math.sin(u * Math.PI) * 9 };
}

function frontLeg(ctx, shoulder, foot, color, pawColor, far, coat) {
  const elbow = {
    x: shoulder.x - 2 + (foot.x - shoulder.x) * 0.2,
    y: shoulder.y + (foot.y - shoulder.y) * 0.5,
  };
  const wrist = { x: foot.x, y: foot.y - 4.6 };
  taper(ctx, shoulder, elbow, far ? 8.5 : 11, far ? 6.4 : 8, color);
  taper(ctx, elbow, wrist, far ? 6.2 : 7.6, far ? 4.6 : 5.4, color);
  if (coat.pattern === "tabby") bands(ctx, elbow, wrist, coat.stripe, far ? 0.35 : 0.5);
  pawShape(ctx, foot.x, foot.y, pawColor, far);
}

function hindLeg(ctx, hip, foot, color, pawColor, far, coat) {
  const stifle = {
    x: hip.x + 4,
    y: hip.y + (foot.y - hip.y) * 0.46,
  };
  const hock = { x: foot.x - 3.2, y: foot.y - 7.5 };
  taper(ctx, hip, stifle, far ? 11 : 14, far ? 7.5 : 9, color);
  taper(ctx, stifle, hock, far ? 6.2 : 7.2, far ? 4.4 : 5.2, color);
  taper(ctx, hock, { x: foot.x, y: foot.y - 3.4 }, far ? 4.4 : 5, far ? 3.8 : 4.2, color);
  if (coat.pattern === "tabby") bands(ctx, hock, { x: foot.x, y: foot.y - 3 }, coat.stripe, far ? 0.35 : 0.5);
  pawShape(ctx, foot.x, foot.y, pawColor, far);
}

function taper(ctx, a, b, w0, w1, color) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * w0 * 0.5, a.y + ny * w0 * 0.5);
  ctx.lineTo(b.x + nx * w1 * 0.5, b.y + ny * w1 * 0.5);
  ctx.lineTo(b.x - nx * w1 * 0.5, b.y - ny * w1 * 0.5);
  ctx.lineTo(a.x - nx * w0 * 0.5, a.y - ny * w0 * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(a.x, a.y, w0 * 0.5, 0, Math.PI * 2);
  ctx.arc(b.x, b.y, w1 * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function bands(ctx, a, b, color, alpha) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  for (const t of [0.35, 0.62]) {
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    ctx.beginPath();
    ctx.moveTo(x - 2.2, y);
    ctx.lineTo(x + 2.2, y + 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

function pawShape(ctx, x, y, color, far) {
  const w = far ? 5.4 : 6.6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - 0.4, w * 0.52, w * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(color, "#e8b4bc", far ? 0.22 : 0.38);
  for (const toe of [-1.7, 0, 1.6]) {
    ctx.beginPath();
    ctx.ellipse(x + toe * (far ? 0.85 : 1), y + 0.7, 0.75, 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function rumpAnchor(cat, time = 0) {
  const m = cat.m || {};
  const f = cat.app && cat.app.hair === "long" ? 1 : 0;
  const fluff = f * 9;
  const tuck = m.legTuck == null ? 1 : m.legTuck;
  if (cat.inBox) return { x: -9, y: 13, mode: "box" };
  if ((cat.scratch || 0) > 0.72) return { x: -8, y: -22, mode: "scratch" };
  if ((cat.curl || 0) > 0.72) {
    const rx = 22 + f * 5;
    const ry = 16 + f * 3;
    return { x: -2 - rx * 0.25, y: -16 + ry * 0.2, mode: "curl" };
  }
  if ((cat.back || 0) > 0.72) return { x: -16, y: -20, mode: "back" };
  if (tuck > 0.62) return { x: -26 - fluff * 0.85, y: -10, mode: "sit" };
  const gallop = cat.gait === "gallop" ? Math.sin((cat.walkPhase || 0) * Math.PI * 2) * 8 * (cat.gaitBlend || 0) : 0;
  return { x: -28 - fluff * 0.2 - Math.max(0, -gallop), y: -12, mode: "stand" };
}

export function tailGeometry(cat, time = 0) {
  const m = cat.m || {};
  const f = cat.app && cat.app.hair === "long" ? 1 : 0;
  const rump = rumpAnchor(cat, time);
  const lift = m.tailLift == null ? 0.7 : m.tailLift;
  const wag = Math.sin(time * (cat.tailSpeed || 1.5)) * (cat.tailAmp || 6) * 0.42;
  const p0 = { x: rump.x + 8, y: rump.y + 1 };
  const p1 = { x: rump.x - 14 - lift * 8 - f * 4, y: rump.y - 8 - lift * 14 + wag * 0.12 };
  const p2 = { x: rump.x - 4 + wag * 0.28, y: rump.y - 24 - lift * 18 - f * 6 + wag };
  const gap = Math.hypot(p0.x - rump.x, p0.y - rump.y);
  return { rump, p0, p1, p2, gap, mode: rump.mode, attached: gap < 12 };
}

function tail(ctx, cat, m, time, f, colors) {
  const geo = tailGeometry(cat, time);
  const { p0, p1, p2 } = geo;
  if (cat._probe) {
    const m2 = ctx.getTransform();
    const map = (p) => ({ x: m2.a * p.x + m2.c * p.y + m2.e, y: m2.b * p.x + m2.d * p.y + m2.f });
    cat._probePts = [0, 0.08, 0.16, 0.24].map((t) => map(quad(p0, p1, p2, t)));
  }
  if (cat._hideTail) return;
  const coat = cat.app.coat;
  const furColor = coat.pattern === "point" ? coat.point : colors.mid;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = colors.dark;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = (f ? 12 : 6.5) + 2;
  strokeCurve(ctx, p0, p1, p2);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = furColor;
  ctx.lineWidth = f ? 11 : 5.2;
  strokeCurve(ctx, p0, p1, p2);
  if (f) {
    ctx.strokeStyle = colors.light;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const t = 0.3 + i * 0.14;
      const p = quad(p0, p1, p2, t);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 4, p.y - 7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (coat.pattern === "tabby") {
    ctx.strokeStyle = coat.stripe;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.3;
    for (let i = 1; i <= 4; i++) {
      const p = quad(p0, p1, p2, i / 5);
      ctx.beginPath();
      ctx.moveTo(p.x - 2, p.y - 3);
      ctx.lineTo(p.x + 2, p.y + 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function strokeCurve(ctx, p0, p1, p2) {
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
  ctx.stroke();
}

function quad(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function head(ctx, cat, time, f, colors) {
  const coat = cat.app.coat;
  const earTwitch = cat.earTwitch || 0;
  const side = cat.earSide || 1;
  ear(ctx, -12, -6, 1, -0.32 - (cat.m.earBack || 0) * 0.35 + (side < 0 ? earTwitch : 0) * 0.3, cat, f, "far", colors);
  const trace = () => {
    ctx.beginPath();
    ctx.ellipse(0, 0.4, 13.2 + f * 0.4, 12.3 + f * 0.3, 0, 0, Math.PI * 2);
  };
  trace();
  shade(ctx, -8, -12, 6, 12, colors.light, colors.mid, colors.dark);
  ctx.fill();
  ctx.save();
  trace();
  ctx.clip();
  if (coat.pattern === "tabby") {
    ctx.strokeStyle = coat.stripe;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(-3, -3.5);
    ctx.lineTo(0, -7);
    ctx.lineTo(3, -3.5);
    ctx.lineTo(6, -8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (coat.pattern === "calico") {
    blob(ctx, coat.orange, -6, -6, 7, 5, 0.3, 0.9);
    blob(ctx, coat.ink, 7, 2, 5, 4, -0.2, 0.75);
  } else if (coat.pattern === "tortie") {
    blob(ctx, coat.orange, -2, -7, 7, 4, 0.2, 0.85);
  } else if (coat.pattern === "point") {
    const g = ctx.createRadialGradient(2, 2, 2, 2, 3, 14);
    g.addColorStop(0, coat.point);
    g.addColorStop(0.55, coat.point);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-16, -16, 34, 32);
  }
  fur(ctx, 19, f ? 36 : 22, -12, -10, 24, 20, 1.2, colors.deep, f ? 4.5 : 2.4, 0.16);
  ctx.restore();
  trace();
  edge(ctx, colors.deep);
  ear(ctx, 9.5, -7, 1.05, 0.28 - (cat.m.earBack || 0) * 0.28 + (side > 0 ? earTwitch : 0) * 0.3, cat, f, "near", colors);

  if (f) {
    ctx.fillStyle = colors.light;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(-11, 5, 4.2, 2.6, 0.4, 0, Math.PI * 2);
    ctx.ellipse(8, 6, 4.4, 2.7, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const muzzle = coat.pattern === "tuxedo" || coat.pattern === "calico" ? "#f7f4f0" : colors.belly;
  ctx.fillStyle = muzzle;
  ctx.beginPath();
  ctx.ellipse(-0.2, 5.6, 4.6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(muzzle, "#fff", 0.28);
  ctx.beginPath();
  ctx.ellipse(-2.2, 6.2, 1.5, 1, 0.15, 0, Math.PI * 2);
  ctx.ellipse(1.8, 6.2, 1.5, 1, -0.15, 0, Math.PI * 2);
  ctx.fill();

  eye(ctx, -5.2, 0.2, 0.86, cat, true);
  eye(ctx, 4.8, 0.2, 1, cat, false);
  nose(ctx, -0.2, 4.9, coat.nose);
  mouth(ctx, cat);
  whiskers(ctx, cat);
  if ((cat.squint || 0) > 0.35) {
    ctx.fillStyle = "rgba(214, 120, 130, 0.28)";
    ctx.beginPath();
    ctx.ellipse(-6, 5, 3.2, 1.6, 0, 0, Math.PI * 2);
    ctx.ellipse(8, 6.5, 3.4, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (cat.app.gender === "girl") ribbon(ctx, colors);
  else collar(ctx);
  void time;
}

function ear(ctx, x, y, sc, rot, cat, fluff, which, colors) {
  const coat = cat.app.coat;
  let outer = colors.mid;
  if (coat.pattern === "point") outer = coat.point;
  else if (coat.pattern === "calico") outer = which === "far" ? coat.ink : coat.orange;
  else if (coat.pattern === "tortie" && which === "near") outer = coat.orange;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  ctx.beginPath();
  ctx.moveTo(-7.4, 5);
  ctx.quadraticCurveTo(-7.2, -2, 0, -12);
  ctx.quadraticCurveTo(7.2, -2, 7.4, 5);
  ctx.closePath();
  ctx.fillStyle = outer;
  ctx.fill();
  edge(ctx, colors.deep);
  ctx.beginPath();
  ctx.moveTo(-2.6, 3);
  ctx.quadraticCurveTo(-2.4, -3, 0, -7.5);
  ctx.quadraticCurveTo(2.6, -3, 2.6, 3);
  ctx.closePath();
  ctx.fillStyle = coat.innerEar;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  if (fluff) {
    ctx.strokeStyle = outer;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-1, -12);
    ctx.lineTo(0, -17);
    ctx.moveTo(1.5, -12);
    ctx.lineTo(2, -16);
    ctx.stroke();
  }
  ctx.restore();
}

function eye(ctx, x, y, sc, cat, far) {
  const coat = cat.app.coat;
  const open = cat.asleep ? 0 : (cat.blink == null ? 1 : cat.blink) * (1 - (cat.squint || 0) * 0.5);
  const pupil = cat.pupil == null ? 0.4 : cat.pupil;
  ctx.save();
  ctx.translate(x, y);
  const rx = 3.15 * sc;
  const ryFull = 3.7 * sc;
  if (open < 0.2) {
    ctx.strokeStyle = mix(coat.base, "#2c241e", 0.55);
    ctx.lineWidth = 1.05;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-rx, 0);
    ctx.quadraticCurveTo(0, (cat.squint || 0) > 0.3 || cat.asleep ? -2.1 : 1.4, rx, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const ry = ryFull * (0.35 + open * 0.65);
  ctx.fillStyle = "rgba(50, 32, 24, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 0.6, rx + 1.1, ry + 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fbf8f5";
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  const iris = ctx.createRadialGradient(-0.8, -1, 0.3, 0.2, 0.4, rx);
  iris.addColorStop(0, mix(cat.app.eye, "#fffef8", 0.35));
  iris.addColorStop(0.62, cat.app.eye);
  iris.addColorStop(1, cat.app.eyeDeep);
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(0.2, 0.25, rx * 0.74, Math.min(ry * 0.82, rx * 0.9), 0, 0, Math.PI * 2);
  ctx.fill();
  const gazeX = (cat.gazeX || 0) * 0.55 * (far ? 0.8 : 1);
  const gazeY = (cat.gazeY || 0) * 0.4;
  const pw = Math.max(0.55, rx * (0.12 + pupil * 0.42));
  const ph = Math.max(pw, Math.min(ry * 0.78, rx * 0.95));
  ctx.fillStyle = "#161311";
  ctx.beginPath();
  ctx.ellipse(0.35 + gazeX, 0.35 + gazeY, Math.min(pw, rx * 0.7), ph, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.ellipse(-rx * 0.28, -ry * 0.28, 1.15, 1.45, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(rx * 0.22, ry * 0.18, 0.45, 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(40, 24, 18, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, -ry * 0.35, rx * 0.95, ry * 0.45, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

function nose(ctx, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0.2);
  ctx.quadraticCurveTo(1.35, 0.7, 0.85, 1.35);
  ctx.quadraticCurveTo(0, 1.7, -0.85, 1.35);
  ctx.quadraticCurveTo(-1.35, 0.7, 0, 0.2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.ellipse(-0.4, 0.45, 0.35, 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function mouth(ctx, cat) {
  ctx.strokeStyle = "rgba(70, 36, 36, 0.65)";
  ctx.lineWidth = 0.7;
  ctx.lineCap = "round";
  const mouth = cat.mouth || "none";
  if (mouth === "meow" || mouth === "yawn" || mouth === "chatter") {
    ctx.fillStyle = "#6a3040";
    ctx.beginPath();
    ctx.ellipse(-0.2, 6.5, mouth === "yawn" ? 1.6 : 0.9, mouth === "yawn" ? 1.6 : 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (mouth === "lick" || (cat.lick || 0) > 0.65) {
    ctx.fillStyle = "#e7a0b0";
    ctx.beginPath();
    ctx.ellipse(-0.2, 6.6, 0.65, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(-1.1, 6.05);
  ctx.quadraticCurveTo(-0.2, 6.55, 0.7, 6.05);
  ctx.stroke();
}

function whiskers(ctx, cat) {
  ctx.strokeStyle = cat.app.whisker;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 0.55;
  const lines = [
    [-2.2, 5.7, -16, 3.2],
    [-2.1, 6.4, -17, 6.6],
    [-1.8, 7.1, -14, 9.6],
    [1.8, 5.7, 16, 3.4],
    [1.9, 6.4, 17, 6.8],
    [1.6, 7.1, 14, 9.8],
  ];
  for (const [x1, y1, x2, y2] of lines) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, y1 - 0.4, x2, y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function ribbon(ctx) {
  ctx.save();
  ctx.translate(11, -16);
  ctx.rotate(-0.4);
  ctx.fillStyle = "#b94a62";
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.ellipse(-3.2, 0, 3.1, 1.7, -0.4, 0, Math.PI * 2);
  ctx.ellipse(3.2, 0, 3.1, 1.7, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function collar(ctx) {
  ctx.save();
  ctx.strokeStyle = "#8d3d32";
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(1, 8, 10, 0.35, Math.PI - 0.2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#e2c15a";
  ctx.beginPath();
  ctx.arc(2, 17.5, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function scratching(ctx, cat, time) {
  const f = cat.app.hair === "long" ? 1 : 0;
  const colors = tone(cat.app.coat);
  const swing = Math.sin(cat.scratchPhase || time * 14);
  const was = cat.scratch;
  cat.scratch = Math.max(cat.scratch || 0, 0.85);
  tail(ctx, cat, cat.m || {}, time, f, colors);
  cat.scratch = was;
  const hind = (x, footX) => {
    ctx.strokeStyle = colors.mid;
    ctx.lineWidth = 5 + f;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, -18);
    ctx.quadraticCurveTo(x - 2, -8, footX, 1);
    ctx.stroke();
    ctx.fillStyle = colors.light;
    ctx.beginPath();
    ctx.ellipse(footX, 2, 4.2 + f, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  hind(-8, -7);
  hind(2, 5);
  ctx.beginPath();
  ctx.ellipse(0, -34, 13 + f * 3, 20 + f, -0.15, 0, Math.PI * 2);
  shade(ctx, -6, -52, 8, -16, colors.light, colors.mid, colors.dark);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -34, 13 + f * 3, 20 + f, -0.15, 0, Math.PI * 2);
  ctx.clip();
  patternBody(ctx, cat, -34, 0.2);
  fur(ctx, 12, 4, -10, -48, 24, 28, 0.7, colors.deep, f ? 5 : 2.4, 0.18);
  ctx.restore();
  const reach = (y, lift) => {
    const pawY = y + lift;
    const pawX = 18 + f * 2;
    ctx.strokeStyle = colors.mid;
    ctx.lineWidth = 4 + f * 0.6;
    ctx.beginPath();
    ctx.moveTo(4, y + 4);
    ctx.quadraticCurveTo(7, pawY, pawX, pawY);
    ctx.stroke();
    ctx.fillStyle = colors.light;
    ctx.beginPath();
    ctx.ellipse(pawX + 1, pawY, 3.2, 2.3, 0.5, 0, Math.PI * 2);
    ctx.fill();
  };
  reach(-48, swing * 4);
  reach(-38, -swing * 4);
  ctx.save();
  ctx.translate(4, -54);
  ctx.rotate(-0.15);
  head(ctx, cat, time, f, colors);
  ctx.restore();
}

function curled(ctx, cat, time) {
  const f = cat.app.hair === "long" ? 1 : 0;
  const colors = tone(cat.app.coat);
  const breath = Math.sin(time * 1.4) * 1.1;
  const rx = 22 + f * 5;
  const ry = 16 + f * 3 + breath * 0.3;
  const curlWas = cat.curl;
  cat.curl = Math.max(cat.curl || 0, 0.8);
  tail(ctx, cat, cat.m || {}, time, f, colors);
  cat.curl = curlWas;
  if (cat._hideBody) return;
  ctx.beginPath();
  ctx.ellipse(-2, -16, rx, ry, 0.1, 0, Math.PI * 2);
  shade(ctx, -10, -30, 4, -4, colors.light, colors.mid, colors.dark);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-2, -16, rx, ry, 0.1, 0, Math.PI * 2);
  ctx.clip();
  patternBody(ctx, cat, -16, 1);
  fur(ctx, 9, 30, -20, -28, 40, 24, 0.8, colors.deep, f ? 5 : 2.5, 0.16);
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(-2, -16, rx, ry, 0.1, 0, Math.PI * 2);
  edge(ctx, colors.deep);
  const asleep = cat.asleep;
  cat.asleep = true;
  ctx.save();
  ctx.translate(8, -24 + breath * 0.2);
  ctx.rotate(0.35);
  head(ctx, cat, time, f, colors);
  ctx.restore();
  cat.asleep = asleep;
}

function rolled(ctx, cat, time) {
  const colors = tone(cat.app.coat);
  const f = cat.app.hair === "long" ? 1 : 0;
  const kick = Math.sin(time * 9) * (cat.backKick || 0);
  const backWas = cat.back;
  cat.back = Math.max(cat.back || 0, 0.8);
  tail(ctx, cat, cat.m || {}, time, f, colors);
  cat.back = backWas;
  if (cat._hideBody) return;
  ctx.beginPath();
  ctx.ellipse(0, -22, 24 + f * 4, 14 + f * 2, 0.15, 0, Math.PI * 2);
  shade(ctx, -8, -36, 6, -8, colors.dark, colors.mid, colors.light);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -24, 14, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = colors.belly;
  ctx.fill();
  edge(ctx, colors.deep);
  const paws = [
    [-12, -34],
    [-2, -38],
    [10, -36],
    [16, -30],
  ];
  paws.forEach((paw, i) => {
    frontLeg(ctx, { x: paw[0] * 0.35, y: -24 }, { x: paw[0], y: paw[1] + (i > 1 ? kick : -kick) }, colors.mid, colors.mid, false, cat.app.coat);
    ctx.fillStyle = "#e7a8b4";
    ctx.beginPath();
    ctx.ellipse(paw[0], paw[1] - 1, 1.6, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.save();
  ctx.translate(22, -16);
  ctx.rotate(-0.7);
  head(ctx, cat, time, f, colors);
  ctx.restore();
}

export function paintBoxCat(ctx, cat, box, time) {
  const f = cat.app.hair === "long" ? 1 : 0;
  const colors = tone(cat.app.coat);
  const rise = (cat.peek || 0.7) * 16;
  const bob = Math.sin(time * 1.5) * 1.2;
  ctx.save();
  ctx.translate(box.x + box.w * 0.42, box.y + 4 - rise + bob);
  ctx.scale((cat.facing || -1) * cat.scale * 0.9, cat.scale * 0.9);
  const boxed = { ...cat, inBox: true, _probe: cat._probe, _hideTail: cat._hideTail };
  tail(ctx, boxed, cat.m || {}, time, f, colors);
  if (cat._probe) cat._probePts = boxed._probePts;
  if (cat._hideBody) {
    ctx.restore();
    return;
  }
  ctx.fillStyle = colors.mid;
  ctx.beginPath();
  ctx.ellipse(0, 14, 12 + f * 3, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  head(ctx, cat, time, f, colors);
  ctx.restore();
}

const SHEET_POSES = ["sit", "walk", "run", "groom", "stretch", "pounce", "curl", "back", "box"];

function auditCat(poseName, hair, facing) {
  const eye = EYES.green;
  return {
    x: 0,
    groundY: 0,
    hop: 0,
    facing,
    scale: 1.1,
    squash: 1,
    drawRot: poseName === "pounce" ? -0.35 : 0,
    app: {
      hair,
      coat: COATS.orange,
      eye: eye.color,
      eyeDeep: eye.deep,
      whisker: "#4a3428",
      gender: "girl",
    },
    m: clonePose(poseName === "box" ? "sit" : poseName),
    curl: poseName === "curl" ? 1 : 0,
    back: poseName === "back" ? 1 : 0,
    inBox: false,
    gait: poseName === "run" ? "gallop" : "walk",
    gaitBlend: poseName === "walk" || poseName === "run" ? 1 : 0,
    walkPhase: 0.35,
    tailSpeed: 1.6,
    tailAmp: 8,
    blink: 1,
    asleep: poseName === "curl",
    peek: 0.8,
    purr: 0,
  };
}

function inkNear(ctx, x, y) {
  const px = Math.round(x);
  const py = Math.round(y);
  let best = 0;
  for (let dy = -4; dy <= 4; dy += 2) {
    for (let dx = -4; dx <= 4; dx += 2) {
      const sx = px + dx;
      const sy = py + dy;
      if (sx < 0 || sy < 0 || sx >= ctx.canvas.width || sy >= ctx.canvas.height) continue;
      const alpha = ctx.getImageData(sx, sy, 1, 1).data[3];
      if (alpha > best) best = alpha;
    }
  }
  return best;
}

function paintAudit(ctx, cat, poseName, time) {
  if (poseName === "box") paintBoxCat(ctx, cat, { x: -20, y: -30, w: 70, h: 36 }, time);
  else paintCat(ctx, cat, time);
}

export function auditTailPose(poseName, hair, facing) {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 220;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const cat = auditCat(poseName, hair, facing);
  const time = 0.4;
  const draw = (hideTail, hideBody) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(120, 168);
    cat._probe = true;
    cat._hideTail = hideTail;
    cat._hideBody = hideBody;
    cat._probePts = null;
    paintAudit(ctx, cat, poseName, time);
  };
  draw(true, false);
  const bodyPoint = cat._probePts && cat._probePts[0];
  const bodyCovers = Boolean(bodyPoint && inkNear(ctx, bodyPoint.x, bodyPoint.y) > 20);
  draw(false, true);
  const tailPts = cat._probePts || [];
  const tailCovers = tailPts.length > 0 && tailPts.every((point) => inkNear(ctx, point.x, point.y) > 20);
  const geo = tailGeometry(cat, time);
  cat._probe = false;
  cat._hideTail = false;
  cat._hideBody = false;
  return {
    pose: poseName,
    hair,
    facing,
    mode: geo.mode,
    gap: Math.round(geo.gap * 10) / 10,
    bodyCovers,
    tailCovers,
    ok: Boolean(bodyCovers && tailCovers && geo.attached),
  };
}

export function renderTailSheet(canvas) {
  const rows = [
    ["short", 1],
    ["short", -1],
    ["long", 1],
    ["long", -1],
  ];
  const cellW = 120;
  const cellH = 104;
  canvas.width = SHEET_POSES.length * cellW;
  canvas.height = rows.length * cellH;
  const ctx = canvas.getContext("2d");
  const results = [];
  rows.forEach(([hair, facing], row) => {
    SHEET_POSES.forEach((pose, col) => {
      const cat = auditCat(pose, hair, facing);
      ctx.save();
      ctx.translate(col * cellW, row * cellH);
      ctx.fillStyle = "#f4e4d4";
      ctx.fillRect(0, 0, cellW, cellH);
      ctx.fillStyle = "#6a4632";
      ctx.font = "11px sans-serif";
      ctx.fillText(`${pose} ${hair === "long" ? "long" : "short"} ${facing > 0 ? "R" : "L"}`, 6, 14);
      ctx.translate(cellW * 0.55, cellH * 0.8);
      ctx.scale(0.82, 0.82);
      paintAudit(ctx, cat, pose, 0.4);
      ctx.restore();
      results.push(auditTailPose(pose, hair, facing));
    });
  });
  return results;
}
