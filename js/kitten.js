// Painted kitten. Soft fur, real proportions, no cartoon outline.

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

  if (cat.back < 0.98) {
    ctx.save();
    ctx.globalAlpha *= 1 - cat.back;
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
  if (cat.back > 0.02) {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, cat.back);
    rolled(ctx, cat, time);
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
  tail(ctx, cat, m, time, f, colors);
  torso(ctx, cat, m, breath, f, tuck, colors);
  legs(ctx, cat, m, breath, f, tuck, colors);
  const y = (m.bodyY + breath) * 0.35;
  const neckX = tuck > 0.62 ? 6 : 16 + (1 - tuck) * 8;
  const neckY = tuck > 0.62 ? -30 : y - 16;
  ctx.save();
  ctx.translate(neckX, neckY);
  head(ctx, cat, time, f, colors);
  ctx.restore();
}

function torso(ctx, cat, m, breath, f, tuck, colors) {
  const y = (m.bodyY + breath) * 0.35;
  const fluff = f * 9;
  const trace = () => {
    ctx.beginPath();
    if (tuck > 0.62) {
      ctx.moveTo(-28 - fluff, -6);
      ctx.bezierCurveTo(-36 - fluff, -26, -18, -40 - fluff, -2, -34 - fluff * 0.3);
      ctx.bezierCurveTo(12, -32, 20 + fluff, -20, 14, -8);
      ctx.bezierCurveTo(10, -2, -6, 1, -28 - fluff, -6);
    } else {
      const rump = -26 - (1 - tuck) * 4 - fluff * 0.3;
      const chest = 18 + (1 - tuck) * 10;
      const top = y - 14 - fluff * 0.3;
      ctx.moveTo(rump, y + 2);
      ctx.bezierCurveTo(rump - 6, top, -4, top - 4, chest * 0.35, top + 2);
      ctx.bezierCurveTo(chest, top + 4, chest + 4, y + 6, chest - 4, y + 12);
      ctx.bezierCurveTo(4, y + 16, rump + 8, y + 10, rump, y + 2);
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
  if (cat.app.coat.pattern !== "point" && cat.app.coat.pattern !== "tortie") {
    ctx.fillStyle = colors.belly;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(6 + tuck * 2, y + 6, 9 + f * 3, 7 + f, 0.4, 0, Math.PI * 2);
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

function legs(ctx, cat, m, breath, f, tuck, colors) {
  const coat = cat.app.coat;
  const y = m.bodyY + breath;
  const paw = coat.pattern === "tuxedo" ? "#f4f1ee" : coat.pattern === "point" ? coat.point : colors.mid;
  if (tuck > 0.6 && m.stretch < 0.35) {
    const x0 = 4;
    limb(ctx, x0, y + 2, x0 - 1, -1, paw, colors, f ? 6.2 : 5.2);
    if (m.groom > 0.15) {
      const px = x0 + 8 + (m.headX - x0 - 4) * m.groom;
      const py = -1 + (m.headY + 10) * m.groom;
      limb(ctx, x0 + 8, y + 1, px, py, colors.mid, colors, 4.4);
    } else if (cat.swat > 0.05) {
      limb(ctx, x0 + 8, y, x0 + 18 + 16 * cat.swat, -6 - 14 * cat.swat, paw, colors, 4.6);
    } else {
      limb(ctx, x0 + 9, y + 2, x0 + 8, -1, paw, colors, f ? 6.2 : 5.2);
    }
    ctx.fillStyle = colors.dark;
    ctx.beginPath();
    ctx.ellipse(-12, -2, 6, 3.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const phase = cat.walkPhase || 0;
  const stride = m.stride || 0;
  const hips = [
    { x: -18, y: y + 4, shift: 0.2, w: 4.6 },
    { x: -8, y: y + 6, shift: Math.PI, w: 5.2 },
    { x: 8, y: y + 5, shift: 1.1, w: 4.4 },
    { x: 16 + m.stretch * 10, y: y + 6, shift: Math.PI + 1.1, w: 5 },
  ];
  hips.forEach((hip, index) => {
    const swing = Math.sin(phase * Math.PI * 2 + hip.shift) * 9 * stride;
    const lift = Math.max(0, Math.sin(phase * Math.PI * 2 + hip.shift)) * 7 * stride;
    let footX = hip.x + swing;
    let footY = -1.5 - lift;
    if (m.stretch > 0.2 && index >= 2) {
      footX = hip.x + 22 * m.stretch;
      footY = -1;
    }
    if (index === 3 && cat.swat > 0) {
      footX += 14 * cat.swat;
      footY -= 12 * cat.swat;
    }
    limb(ctx, hip.x, hip.y, footX, footY, paw, colors, hip.w);
  });
}

function limb(ctx, x0, y0, x1, y1, color, colors, width) {
  const kneeX = x0 * 0.45 + x1 * 0.55 + 1.5;
  const kneeY = y0 * 0.42 + y1 * 0.58;
  ctx.strokeStyle = colors.dark;
  ctx.lineCap = "round";
  ctx.lineWidth = width + 1.4;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(kneeX, kneeY, x1, y1);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x1, y1, width * 0.72, width * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(color, "#fffaf6", 0.35);
  for (const toe of [-2.2, 0, 2.1]) {
    ctx.beginPath();
    ctx.ellipse(x1 + toe, y1 + 1.2, 1.05, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function tail(ctx, cat, m, time, f, colors) {
  const lift = m.tailLift;
  const wag = Math.sin(time * (cat.tailSpeed || 1.5)) * (cat.tailAmp || 6) * 0.42;
  const p0 = { x: -24, y: m.bodyY + 2 };
  const p1 = { x: p0.x - 18 - lift * 6 - f * 6, y: p0.y - 12 - lift * 14 };
  const p2 = { x: p0.x - 4 + wag * 0.25, y: p0.y - 28 - lift * 18 - f * 8 + wag };
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
  ear(ctx, -9, -9, 0.82, -0.45 - (cat.m.earBack || 0) * 0.4 + (side < 0 ? earTwitch : 0) * 0.35, cat, f, "far", colors);
  const trace = () => {
    ctx.beginPath();
    ctx.ellipse(0, 1, 16.5 + f * 2.2, 14.4 + f * 1.8, -0.08, 0, Math.PI * 2);
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
  ear(ctx, 5, -11, 1, 0.22 - (cat.m.earBack || 0) * 0.3 + (side > 0 ? earTwitch : 0) * 0.35, cat, f, "near", colors);

  if (f) {
    ctx.fillStyle = colors.light;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(-10, 6, 6, 3.5, 0.6, 0, Math.PI * 2);
    ctx.ellipse(9, 7, 6.5, 3.6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const muzzle = coat.pattern === "tuxedo" || coat.pattern === "calico" ? "#f7f4f0" : colors.belly;
  ctx.fillStyle = muzzle;
  ctx.beginPath();
  ctx.ellipse(6.5, 5.5, 7.2, 4.6, 0.15, 0, Math.PI * 2);
  ctx.fill();

  eye(ctx, -2.2, -0.5, 0.92, cat, true);
  eye(ctx, 5.6, 0.4, 1, cat, false);
  nose(ctx, 7.4, 4.2, coat.nose);
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
  ctx.moveTo(-5.5, 4);
  ctx.quadraticCurveTo(-6.5, -6, 0, -13);
  ctx.quadraticCurveTo(6.5, -6, 5.5, 4);
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
  const rx = 5.3 * sc;
  const ryFull = 6.2 * sc;
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
    ctx.ellipse(8.4, 9.2, mouth === "yawn" ? 2.6 : 1.7, mouth === "yawn" ? 3.2 : 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (mouth === "lick" || (cat.lick || 0) > 0.65) {
    ctx.fillStyle = "#e7a0b0";
    ctx.beginPath();
    ctx.ellipse(8.4, 10, 1.1, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(7.4, 8.6);
  ctx.quadraticCurveTo(8.3, 9.5, 9.3, 8.6);
  ctx.stroke();
}

function whiskers(ctx, cat) {
  ctx.strokeStyle = cat.app.whisker;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 0.55;
  const lines = [
    [2, 6.5, -16, 4],
    [2.5, 8, -17, 8.5],
    [3, 9.2, -14, 12],
    [10, 6.8, 22, 4.5],
    [10, 8.2, 23, 9],
    [9.5, 9.4, 20, 13],
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
  ctx.translate(-11, 6);
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

function curled(ctx, cat, time) {
  const f = cat.app.hair === "long" ? 1 : 0;
  const colors = tone(cat.app.coat);
  const breath = Math.sin(time * 1.4) * 1.1;
  const rx = 22 + f * 5;
  const ry = 16 + f * 3 + breath * 0.3;
  ctx.strokeStyle = cat.app.coat.pattern === "point" ? cat.app.coat.point : colors.mid;
  ctx.lineWidth = f ? 9 : 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(-2, -16, rx * 0.9, 0.2, Math.PI * 1.2);
  ctx.stroke();
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
    limb(ctx, paw[0] * 0.3, -24, paw[0], paw[1] + (i > 1 ? kick : -kick), colors.mid, colors, 4);
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
  const wag = Math.sin(time * (cat.tailSpeed || 2)) * 6;
  ctx.save();
  ctx.strokeStyle = cat.app.coat.pattern === "point" ? cat.app.coat.point : colors.mid;
  ctx.lineWidth = f ? 8 : 4.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(box.x + 18, box.y + 26);
  ctx.quadraticCurveTo(box.x - 10, box.y + 8, box.x - 4, box.y - 6 + wag * 0.4);
  ctx.stroke();
  ctx.restore();
  const rise = (cat.peek || 0.7) * 16;
  const bob = Math.sin(time * 1.5) * 1.2;
  ctx.save();
  ctx.translate(box.x + box.w * 0.42, box.y + 4 - rise + bob);
  ctx.scale((cat.facing || -1) * cat.scale * 0.9, cat.scale * 0.9);
  ctx.fillStyle = colors.mid;
  ctx.beginPath();
  ctx.ellipse(0, 14, 12 + f * 3, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  head(ctx, cat, time, f, colors);
  ctx.restore();
}
