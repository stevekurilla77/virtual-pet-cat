import { appearanceFrom, catHit, drawBoxCat, drawCat, drawEffects, drawFeather, drawLaser, drawRoom, drawYarn, layoutRoom, previewBackdrop, speciesAt, speciesCount } from "./draw.js";
import { POSE_KEYS, POSES, clonePose } from "./poses.js";
import { clamp, clamp01, len, weightedPick } from "./util.js";

const BIRD_PITCH = { sparrow: 1, chickadee: 1.15, cardinal: 0.82, bluebird: 1.05, goldfinch: 1.28 };

export class Game {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.audio = audio;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.time = 0;
    this.w = 390;
    this.h = 700;
    this.dpr = 1;
    this.room = layoutRoom(390, 700, 56, 120);
    this.config = null;
    this.cat = null;
    this.mode = "auto";
    this.auto = null;
    this.lastAuto = "";
    this.command = null;
    this.birdShow = null;
    this.birdNoticed = false;
    this.birds = [];
    this.birdTimer = 7;
    this.yarn = null;
    this.tool = null;
    this.pointer = { x: 0, y: 0, down: false, id: null, sx: 0, sy: 0, lx: 0, ly: 0, moved: 0 };
    this.wand = { x: 0, y: 0, active: false, speed: 0, freeze: 0 };
    this.laser = { x: 0, y: 0, active: false, speed: 0 };
    this.pet = { touching: false, belly: 0, heart: 0, blink: 0, greeted: false, cool: 0 };
    this.grab = 0;
    this.lunge = null;
    this.pounceCd = 0;
    this.moods = { playful: 0.48, sleepy: 0.3, happy: 0.66 };
    this.effects = [];
    this.prints = [];
    this.glass = 0;
    this.flash = 0;
    this.zzzT = 0;
    this.running = false;
    this.ui = { top: 56, bottom: 120 };
    this.hint = "";
    this.onHud = null;
  }

  setConfig(config, intro) {
    this.config = config;
    this.moods = {
      playful: config.mood.playful,
      sleepy: config.mood.sleepy,
      happy: config.mood.happy,
    };
    const app = appearanceFrom(config);
    const room = this.room;
    this.cat = {
      x: room.napX || 140,
      groundY: room.ground,
      hop: 0,
      facing: 1,
      scale: 1,
      app,
      m: clonePose("sit"),
      curl: 0,
      back: 0,
      inBox: false,
      peek: 0.75,
      blink: 1,
      blinkClosing: false,
      blinkOpening: false,
      slowBlink: false,
      nextBlink: 1.4,
      squint: 0,
      mouth: "none",
      lick: 0,
      earTwitch: 0,
      earSide: 1,
      nextEar: 2.2,
      tailAmp: 8,
      tailSpeed: 1.6,
      purr: 0,
      squash: 1,
      walkPhase: 0,
      gazeX: 0.2,
      gazeY: -0.2,
      excited: 0,
      asleep: false,
      swat: 0,
      drawRot: 0,
      wigglePhase: 0,
      wiggleAmp: 0,
      backKick: 0,
      moving: false,
      boxAnchorX: 0,
      boxAnchorY: 0,
    };
    this.auto = intro ? { name: "hello", phase: "sit", t: 0, meowed: false } : null;
    this.command = null;
    this.birdShow = null;
    this.resize();
  }

  updateAppearance(config) {
    this.config = config;
    if (this.cat) this.cat.app = appearanceFrom(config);
  }

  resize(ui) {
    if (ui) this.ui = ui;
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.room = layoutRoom(this.w, this.h, this.ui.top, this.ui.bottom);
    this.room.reduced = this.reduced;
    if (!this.cat) return;
    this.cat.scale = clamp(Math.min(this.w / 165, this.h / 430), 1.25, 2.35);
    this.cat.groundY = this.room.ground;
    this.cat.x = clamp(this.cat.x, 36, this.w - 36);
  }

  setTool(tool) {
    this.audio.unlock();
    const next = this.tool === tool ? null : tool;
    this.tool = next;
    this.wand.active = false;
    this.laser.active = false;
    this.pet.touching = false;
    if (this.yarn) {
      this.yarn.engaged = false;
      this.yarn.held = false;
      this.yarn.vx = 0;
      this.yarn.vy = 0;
    }
    if (this.command && (this.command.name === "box" || this.command.name === "outbox")) {
      this.command = null;
    }
    if (next === "wand" || next === "laser" || next === "yarn") {
      const spot = this.nearCat();
      if (next === "wand") {
        this.wand.x = spot.x;
        this.wand.y = spot.y;
      } else if (next === "laser") {
        this.laser.x = spot.x;
        this.laser.y = spot.y;
      } else if (!this.yarn) {
        this.spawnYarn(spot.x, spot.y, 0, 0, false);
      } else {
        this.yarn.x = spot.x;
        this.yarn.y = spot.y;
      }
    }
    this.syncHint();
    this.emit();
  }

  toggleBox() {
    this.audio.unlock();
    this.tool = "box";
    this.wand.active = false;
    this.laser.active = false;
    this.cancelBird();
    this.pet.touching = false;
    if (this.yarn) this.yarn.engaged = false;
    if (this.cat.inBox || (this.command && this.command.name === "box")) {
      this.command = { name: "outbox", phase: "rise", t: 0 };
      this.cat.inBox = true;
    } else {
      this.lunge = null;
      this.grab = 0;
      this.command = { name: "box", phase: "go", t: 0 };
      this.cat.inBox = false;
    }
    this.hint = this.cat.inBox ? "Calling them out" : "Into the box";
    this.emit();
  }

  syncHint() {
    const name = this.config ? this.config.name : "Your cat";
    if (this.tool === "wand") this.hint = "Drag the feather";
    else if (this.tool === "laser") this.hint = "Drag the red dot";
    else if (this.tool === "yarn") this.hint = "Flick the yarn";
    else if (this.tool === "pet") this.hint = `Stroke ${name}. Mind the belly.`;
    else if (this.tool === "box") this.hint = "Tap the box";
    else this.hint = "";
  }

  emit() {
    if (!this.onHud) return;
    this.onHud({
      moods: this.moods,
      tool: this.tool,
      hint: this.hint,
      inBox: Boolean(this.cat && (this.cat.inBox || (this.command && this.command.name === "box"))),
    });
  }

  pointerDown(x, y, id) {
    this.audio.unlock();
    this.pointer = { x, y, down: true, id, sx: x, sy: y, lx: x, ly: y, moved: 0 };
    if (!this.cat || y >= this.room.playBottom - 2) return;
    const boxHit = hitBox(this.room.box, x, y);
    const petPoint = this.aboveFinger(x, y, 48);
    const hit = this.tool === "pet" ? catHit(this.cat, petPoint.x, petPoint.y) : catHit(this.cat, x, y);
    if ((this.tool === null || this.tool === "box" || (this.tool === "pet" && !hit.body)) && boxHit) {
      this.toggleBox();
      return;
    }
    if (this.tool === "wand") this.startWand(x, y);
    else if (this.tool === "laser") this.startLaser(x, y);
    else if (this.tool === "pet") this.startPet(petPoint.x, petPoint.y, hit);
    else if (this.tool === "yarn") this.grabYarn(x, y);
  }

  pointerMove(x, y) {
    if (!this.pointer.down) {
      this.pointer.x = x;
      this.pointer.y = y;
      return;
    }
    const dx = x - this.pointer.lx;
    const dy = y - this.pointer.ly;
    this.pointer.moved += Math.hypot(x - this.pointer.lx, y - this.pointer.ly);
    this.pointer.lx = x;
    this.pointer.ly = y;
    this.pointer.x = x;
    this.pointer.y = y;
    if (this.wand.active) {
      const toy = this.aboveFinger(x, y);
      this.wand.speed = len(dx, dy) * 60;
      this.wand.x = toy.x;
      this.wand.y = toy.y;
    }
    if (this.laser.active) {
      const toy = this.aboveFinger(x, y);
      this.laser.speed = len(dx, dy) * 60;
      this.laser.x = toy.x;
      this.laser.y = toy.y;
    }
    if (this.tool === "pet" && this.cat && this.grab <= 0) {
      const touch = this.aboveFinger(x, y, 48);
      const hit = catHit(this.cat, touch.x, touch.y);
      this.pet.touching = hit.body;
      if (hit.body) this.strokePet(touch.x, touch.y, hit, len(dx, dy));
    }
    if (this.tool === "yarn" && this.yarn && this.yarn.held) {
      const toy = this.aboveFinger(x, y, 64);
      this.yarn.x = toy.x;
      this.yarn.y = toy.y;
      this.yarn.vx = dx * 42;
      this.yarn.vy = dy * 42;
    }
  }

  pointerUp() {
    const wasDown = this.pointer.down;
    this.pointer.down = false;
    if (!wasDown) return;
    if (this.wand.active) this.wand.active = false;
    if (this.laser.active) this.laser.active = false;
    this.pet.touching = false;
    if (this.yarn && this.yarn.held) {
      this.yarn.held = false;
      const dx = this.pointer.x - this.pointer.sx;
      const dy = this.pointer.y - this.pointer.sy;
      if (Math.hypot(dx, dy) < 8) {
        this.yarn.vx = (this.cat && this.cat.facing ? this.cat.facing : 1) * (180 + Math.random() * 70);
        this.yarn.vy = -260;
      } else {
        this.yarn.vx = clamp(dx * 3.4, -640, 640);
        this.yarn.vy = clamp(dy * 3.4, -720, 420);
      }
      this.yarn.engaged = true;
      this.yarn.still = 0;
    }
    this.pet.belly = 0;
  }

  floorMinX() {
    return 96;
  }

  floorMaxX() {
    return Math.max(this.floorMinX() + 24, Math.min(this.w - 96, this.room.box.x - 28));
  }

  placeOnFloor(x, y) {
    return {
      x: clamp(x, this.floorMinX(), this.floorMaxX()),
      y: clamp(y, this.room.floorY + 28, this.room.ground - 8),
    };
  }

  nearCat() {
    const cat = this.cat;
    return this.placeOnFloor(cat.x + cat.facing * 54, this.room.ground - 18);
  }

  clampPlayY(y) {
    return clamp(y, this.room.playTop + 10, this.room.playBottom - 8);
  }

  aboveFinger(x, y, lift = 84) {
    return this.placeOnFloor(x, y - lift);
  }

  startWand(x, y) {
    this.cancelBird();
    this.leaveBoxForPlay();
    const toy = this.aboveFinger(x, y);
    this.wand.active = true;
    this.wand.x = toy.x;
    this.wand.y = toy.y;
    this.wand.freeze = 0;
    this.lunge = null;
  }

  startLaser(x, y) {
    this.cancelBird();
    this.leaveBoxForPlay();
    const toy = this.aboveFinger(x, y);
    this.laser.active = true;
    this.laser.x = toy.x;
    this.laser.y = toy.y;
    this.lunge = null;
  }

  startPet(x, y, hit) {
    if (!hit.body) return;
    this.cancelBird();
    this.pet.touching = true;
    if (!this.pet.greeted) {
      this.pet.greeted = true;
      this.audio.meow();
      this.cat.mouth = "meow";
    }
    this.strokePet(x, y, hit, 8);
  }

  grabYarn(x, y) {
    this.cancelBird();
    this.leaveBoxForPlay();
    const toy = this.aboveFinger(x, y, 64);
    if (!this.yarn) this.spawnYarn(toy.x, toy.y, 0, 0, true);
    this.yarn.held = true;
    this.yarn.x = toy.x;
    this.yarn.y = toy.y;
    this.yarn.vx = 0;
    this.yarn.vy = 0;
    this.yarn.engaged = true;
  }

  spawnYarn(x, y, vx, vy, engaged = false) {
    const spot = this.placeOnFloor(x, y);
    this.yarn = { x: spot.x, y: spot.y, vx, vy, r: 9, rot: 0, held: false, engaged, still: 0, batCd: 0 };
  }

  leaveBoxForPlay() {
    if (this.cat.inBox || (this.command && (this.command.name === "box" || this.command.name === "outbox"))) {
      this.cat.inBox = false;
      this.cat.hop = -20;
      this.command = null;
    }
  }

  cancelBird() {
    this.birdShow = null;
  }

  update(dt) {
    if (!this.cat || !this.running) return;
    this.time += dt;
    const cat = this.cat;
    cat.moving = false;
    cat.asleep = false;
    cat.mouth = "none";
    cat.lick = Math.max(0, cat.lick - dt * 3);
    cat.excited = 0;
    cat.wiggleAmp = 0;
    cat.backKick = 0;
    cat.tailAmp = 8;
    cat.tailSpeed = 1.7;
    cat.gazeX = 0.15;
    cat.gazeY = -0.15;
    cat.swat = Math.max(0, cat.swat - dt * 3);
    cat.squash += (1 - cat.squash) * Math.min(1, dt * 8);
    if (!this.pet.touching) cat.purr = Math.max(0, cat.purr - dt * 1.4);
    cat.squint += ((this.pet.touching ? 1 : this.hoverSquint()) - cat.squint) * Math.min(1, dt * 6);
    this.audio.setPurr(cat.purr > 0.2 && this.pet.touching && this.grab <= 0);
    this.pounceCd = Math.max(0, this.pounceCd - dt);
    this.pet.cool = Math.max(0, this.pet.cool - dt);
    this.glass = Math.max(0, this.glass - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    let hopSet = false;
    const setHop = (value) => {
      cat.hop = value;
      hopSet = true;
    };

    this.updateBlink(dt);
    this.updateEars(dt);
    this.updateBirds(dt);
    this.updateYarn(dt);
    this.updateMoodDrift(dt);

    const boxCommand = this.command && (this.command.name === "box" || this.command.name === "outbox");
    if (this.grab > 0) this.updateGrab(dt, setHop);
    else if (this.wand.active) this.updateWand(dt, setHop);
    else if (this.laser.active) this.updateLaser(dt, setHop);
    else if (this.pet.touching) this.updatePetHold(dt);
    else if (boxCommand) this.updateCommand(dt, setHop);
    else if (this.yarn && this.yarn.engaged) this.updateYarnChase(dt, setHop);
    else if (this.birdShow) this.updateBirdShow(dt, setHop);
    else if (this.command) this.updateCommand(dt, setHop);
    else this.updateAuto(dt, setHop);

    if (!hopSet) cat.hop += (0 - cat.hop) * Math.min(1, dt * 7);
    const gaitTarget = cat.moving ? 1 : 0;
    if (cat.gaitBlend == null) cat.gaitBlend = 0;
    cat.gaitBlend += (gaitTarget - cat.gaitBlend) * Math.min(1, dt * 3.2);
    this.updatePupil(dt);
    this.keepCatInRoom();
    cat.drawRot = (cat.m.bodyRot || 0) + Math.sin(cat.wigglePhase) * cat.wiggleAmp;
    this.updateEffects(dt);
    this.decayPrints(dt);
    if (this.maybeNoticeBird()) this.startBirdShow();
    this.emit();
  }

  hoverSquint() {
    if (this.tool !== "pet" || this.pointer.down || !this.cat) return 0;
    return catHit(this.cat, this.pointer.x, this.pointer.y).body ? 0.45 : 0;
  }

  updateBlink(dt) {
    const cat = this.cat;
    if (cat.asleep) return;
    if (cat.blinkClosing) {
      cat.blink -= dt * (cat.slowBlink ? 5.5 : 13);
      if (cat.blink <= 0) {
        cat.blink = 0;
        cat.blinkClosing = false;
        cat.blinkOpening = true;
      }
    } else if (cat.blinkOpening) {
      cat.blink += dt * (cat.slowBlink ? 4.2 : 9);
      if (cat.blink >= 1) {
        cat.blink = 1;
        cat.blinkOpening = false;
        cat.slowBlink = false;
        cat.nextBlink = this.time + 2.4 + Math.random() * 3.1;
      }
    } else if (this.time > cat.nextBlink) {
      cat.blinkClosing = true;
    }
  }

  forceBlink(slow) {
    const cat = this.cat;
    if (cat.blinkClosing || cat.blinkOpening) return;
    cat.slowBlink = Boolean(slow);
    cat.blinkClosing = true;
  }

  updateEars(dt) {
    const cat = this.cat;
    cat.earTwitch = Math.max(0, cat.earTwitch - dt * 3.2);
    if (this.time > cat.nextEar) {
      cat.earSide = Math.random() < 0.5 ? -1 : 1;
      cat.earTwitch = 1;
      cat.nextEar = this.time + 2.8 + Math.random() * 4;
    }
  }

  updateMoodDrift(dt) {
    const busyPlay = this.wand.active || this.laser.active || (this.yarn && this.yarn.engaged && !this.yarn.held);
    if (this.cat.asleep) {
      this.moods.sleepy = clamp01(this.moods.sleepy - dt * 0.034);
      this.moods.playful = clamp01(this.moods.playful - dt * 0.01);
      this.moods.happy = clamp01(this.moods.happy + dt * 0.008);
    } else if (busyPlay || this.pet.touching) {
      this.moods.playful = clamp01(this.moods.playful + dt * 0.045);
      this.moods.sleepy = clamp01(this.moods.sleepy - dt * 0.03);
      this.moods.happy = clamp01(this.moods.happy + dt * 0.02);
    } else {
      this.moods.sleepy = clamp01(this.moods.sleepy + dt * 0.0065);
      this.moods.playful = clamp01(this.moods.playful - dt * 0.004);
      this.moods.happy = clamp01(this.moods.happy + (0.62 - this.moods.happy) * dt * 0.03);
    }
    if (this.config) this.config.mood = { ...this.moods };
  }

  updatePupil(dt) {
    const cat = this.cat;
    const sun = this.room.sun;
    const inSun = Math.abs(cat.x - sun.x) < sun.rx * 0.9 && Math.abs(cat.hop) < 10;
    let target = 0.4;
    if (cat.asleep) target = 0.08;
    else if (cat.excited > 0.4) target = 0.9;
    else if (inSun && !cat.moving) target = 0.14;
    if (cat.pupil == null) cat.pupil = target;
    cat.pupil += (target - cat.pupil) * Math.min(1, dt * 4);
  }

  keepCatInRoom() {
    const cat = this.cat;
    if (!cat || cat.inBox) return;
    const entering = this.command && (this.command.name === "box" || this.command.name === "outbox");
    const minX = this.floorMinX();
    const maxX = entering ? Math.min(this.w - 48, this.room.box.x + this.room.box.w * 0.2) : this.floorMaxX();
    cat.x = clamp(cat.x, minX, Math.max(minX + 20, maxX));
  }

  desiredPose(name) {
    this.poseName = name;
  }

  lerpPose(dt) {
    const target = POSES[this.poseName] || POSES.sit;
    const m = this.cat.m;
    const k = Math.min(1, dt * 8);
    for (const key of POSE_KEYS) m[key] += (target[key] - m[key]) * k;
    const curlT = this.poseName === "curl" ? 1 : 0;
    const backT = this.poseName === "back" ? 1 : 0;
    this.cat.curl += (curlT - this.cat.curl) * Math.min(1, dt * 5);
    this.cat.back += (backT - this.cat.back) * Math.min(1, dt * 7);
  }

  moveTo(x, speed, dt, stop = 3.5) {
    const cat = this.cat;
    const dx = x - cat.x;
    const ad = Math.abs(dx);
    if (ad < stop) {
      cat.x += dx * 0.35;
      return true;
    }
    cat.facing = dx > 0 ? 1 : -1;
    const step = Math.min(ad, speed * dt);
    cat.x += Math.sign(dx) * step;
    cat.moving = true;
    cat.gait = this.poseName === "run" ? "gallop" : "walk";
    const stride = (cat.gait === "gallop" ? 72 : 52) * cat.scale;
    cat.walkPhase = ((cat.walkPhase || 0) + Math.min(0.08, step / stride)) % 1;
    return false;
  }

  lookAt(x, y) {
    const cat = this.cat;
    const dx = (x - cat.x) * cat.facing;
    const dy = y - (cat.groundY + cat.hop - 70 * cat.scale);
    const mag = Math.hypot(dx, dy) || 1;
    cat.gazeX = clamp(dx / mag, -1, 1) * 1.5;
    cat.gazeY = clamp(dy / mag, -1, 1) * 1.5;
  }

  updateWand(dt, setHop) {
    const cat = this.cat;
    this.desiredPose(this.lunge === "go" ? "pounce" : "stalk");
    this.lookAt(this.wand.x, this.wand.y);
    cat.excited = 0.7;
    cat.tailAmp = 15;
    cat.tailSpeed = 6;
    cat.facing = this.wand.x >= cat.x ? 1 : -1;
    const goal = this.wand.x - cat.facing * 36 * cat.scale;
    if (this.lunge === "wiggle") {
      this.lungeT -= dt;
      cat.wiggleAmp = 0.16;
      cat.wigglePhase += dt * 24;
      this.desiredPose("stalk");
      if (this.lungeT <= 0) {
        this.lunge = "go";
        this.lungeT = 0.28;
        this.audio.mrrp();
      }
    } else if (this.lunge === "go") {
      this.lungeT -= dt;
      this.desiredPose("pounce");
      setHop(-Math.sin((1 - this.lungeT / 0.28) * Math.PI) * 34);
      this.moveTo(this.wand.x, 280, dt);
      cat.swat = 1;
      if (this.lungeT <= 0) {
        this.lunge = null;
        this.pounceCd = 0.85;
        this.audio.pop();
      }
    } else {
      const arrived = this.moveTo(goal, 92, dt);
      if (this.wand.speed < 28) this.wand.freeze += dt;
      else this.wand.freeze = 0;
      this.wand.speed *= 0.9;
      if (arrived && this.wand.freeze > 0.32 && this.pounceCd <= 0) {
        this.lunge = "wiggle";
        this.lungeT = 0.42;
        this.wand.freeze = 0;
      }
    }
    cat.facing = this.wand.x >= cat.x ? 1 : -1;
    this.lerpPose(dt);
  }

  updateLaser(dt, setHop) {
    const cat = this.cat;
    cat.excited = 1;
    cat.tailAmp = 12;
    cat.tailSpeed = 8;
    this.lookAt(this.laser.x, this.laser.y);
    const above = this.laser.y < this.room.ground - 36;
    const goal = this.placeOnFloor(this.laser.x + (this.laser.x >= cat.x ? 18 : -18), this.room.ground - 12);
    const arrived = this.moveTo(above ? this.placeOnFloor(this.laser.x, this.room.ground - 12).x : goal.x, 250, dt);
    if (above && Math.abs(cat.x - this.laser.x) < 28) {
      const reach = clamp(this.room.ground - this.laser.y, 0, 92);
      setHop(-reach * 0.85);
      this.desiredPose(reach > 40 ? "pounce" : "sit");
      cat.swat = 0.8;
      if (this.pounceCd <= 0) {
        this.audio.chirp();
        this.pounceCd = 0.7;
      }
    } else if (arrived) {
      this.desiredPose("stalk");
      cat.swat = 1;
      cat.wiggleAmp = 0.08;
      cat.wigglePhase += dt * 20;
      if (this.pounceCd <= 0) {
        this.audio.pop();
        this.pounceCd = 0.45;
      }
    } else {
      this.desiredPose("run");
    }
    cat.facing = this.laser.x >= cat.x ? 1 : -1;
    this.lerpPose(dt);
  }

  updatePetHold(dt) {
    const cat = this.cat;
    if (!cat.inBox) this.desiredPose(cat.back > 0.2 ? "back" : "sit");
    this.pet.heart += dt;
    this.pet.blink += dt;
    cat.purr = Math.min(1, cat.purr + dt * 2.4);
    cat.tailAmp = 4;
    cat.tailSpeed = 1.1;
    const hit = catHit(cat, this.pointer.x, this.pointer.y);
    if (hit.belly && this.pet.cool <= 0 && this.grab <= 0) {
      this.pet.belly += dt;
      if (this.pet.belly > 2.25) this.startGrab();
    } else this.pet.belly = Math.max(0, this.pet.belly - dt * 0.4);
    if (this.pet.blink > 1.5) {
      this.forceBlink(true);
      this.pet.blink = 0;
    }
    this.lerpPose(dt);
  }

  strokePet(x, y, hit, dist) {
    if (!hit.body || dist < 1.2) return;
    const cat = this.cat;
    cat.purr = Math.min(1, cat.purr + 0.35);
    this.moods.happy = clamp01(this.moods.happy + 0.012);
    this.moods.playful = clamp01(this.moods.playful + 0.004);
    if (this.pet.heart > 0.22) {
      this.pet.heart = 0;
      this.effects.push({
        type: "heart",
        x: x + (Math.random() * 12 - 6),
        y: y - 16,
        life: 0,
        max: 1.1,
        s: 0.8 + Math.random() * 0.5,
        vy: -28,
      });
    }
  }

  startGrab() {
    this.grab = 1.45;
    this.pet.belly = 0;
    this.pet.cool = 4.2;
    this.pet.touching = false;
    this.audio.meow();
    this.moods.playful = clamp01(this.moods.playful + 0.2);
    this.cat.mouth = "meow";
  }

  updateGrab(dt, setHop) {
    const cat = this.cat;
    this.grab -= dt;
    this.desiredPose("back");
    cat.backKick = 1;
    cat.mouth = this.grab > 1.15 ? "meow" : "none";
    cat.excited = 0.4;
    cat.gazeX = 0;
    cat.gazeY = 1;
    setHop(-8);
    this.lerpPose(dt);
    if (this.grab <= 0) {
      this.desiredPose("sit");
      this.audio.mrrp();
    }
  }

  updateYarn(dt) {
    const yarn = this.yarn;
    if (!yarn) return;
    yarn.batCd = Math.max(0, yarn.batCd - dt);
    if (yarn.held) {
      yarn.rot += dt * 4;
      return;
    }
    yarn.vy += 980 * dt;
    yarn.x += yarn.vx * dt;
    yarn.y += yarn.vy * dt;
    yarn.rot += yarn.vx * dt * 0.04;
    const floor = this.room.ground - yarn.r * 0.2;
    if (yarn.y > floor) {
      yarn.y = floor;
      if (Math.abs(yarn.vy) > 40) {
        yarn.vy *= -0.42;
        yarn.vx *= 0.86;
      } else {
        yarn.vy = 0;
        yarn.vx *= Math.max(0, 1 - dt * 2.4);
      }
    }
    if (yarn.x < yarn.r + 8) {
      yarn.x = yarn.r + 8;
      yarn.vx = Math.abs(yarn.vx) * 0.7;
    }
    if (yarn.x > this.w - yarn.r - 8) {
      yarn.x = this.w - yarn.r - 8;
      yarn.vx = -Math.abs(yarn.vx) * 0.7;
    }
    const speed = Math.hypot(yarn.vx, yarn.vy);
    if (speed < 18) {
      yarn.still += dt;
      if (yarn.still > 5.5 && this.tool !== "yarn") yarn.engaged = false;
    } else yarn.still = 0;
  }

  updateYarnChase(dt, setHop) {
    const cat = this.cat;
    const yarn = this.yarn;
    this.lookAt(yarn.x, yarn.y);
    cat.excited = 0.55;
    cat.tailAmp = 11;
    cat.tailSpeed = 4;
    const airborne = yarn.y < this.room.ground - 30;
    const chase = this.placeOnFloor(yarn.x, this.room.ground - 12);
    const arrived = this.moveTo(chase.x, airborne ? 190 : 155, dt, 30);
    cat.facing = yarn.x >= cat.x ? 1 : -1;
    if (airborne && Math.abs(cat.x - yarn.x) < 36) {
      setHop(-Math.min(70, this.room.ground - yarn.y));
      this.desiredPose("pounce");
    } else this.desiredPose(arrived ? "stalk" : "run");
    const reach = Math.hypot(yarn.x - cat.x, yarn.y - (cat.groundY + cat.hop - 20));
    if (reach < 42 && yarn.batCd <= 0 && !yarn.held) {
      const away = Math.sign(yarn.x - cat.x) || cat.facing;
      yarn.vx = away * (160 + Math.random() * 140);
      yarn.vy = -180 - Math.random() * 90;
      yarn.batCd = 0.48;
      yarn.still = 0;
      cat.swat = 1;
      this.audio.pop();
      this.moods.playful = clamp01(this.moods.playful + 0.02);
    }
    this.lerpPose(dt);
  }

  updateCommand(dt, setHop) {
    const cat = this.cat;
    const cmd = this.command;
    cmd.t += dt;
    if (cmd.name === "box") {
      if (cmd.phase === "go") {
        const arrived = this.moveTo(this.room.boxX, 110, dt);
        this.desiredPose(arrived ? "sit" : "walk");
        if (arrived) {
          cmd.phase = "hop";
          cmd.t = 0;
          this.audio.rustle();
        }
      } else if (cmd.phase === "hop") {
        const k = Math.min(1, cmd.t / 0.42);
        setHop(-Math.sin(k * Math.PI) * 64);
        this.desiredPose("pounce");
        cat.x += (this.room.boxX - cat.x) * Math.min(1, dt * 8);
        if (cmd.t > 0.42) {
          cat.inBox = true;
          cat.peek = 0.95;
          cmd.phase = "in";
          cmd.t = 0;
          this.audio.mrrp();
          this.moods.happy = clamp01(this.moods.happy + 0.04);
        }
      } else {
        cat.inBox = true;
        cat.peek = 0.62 + Math.sin(this.time * 0.8) * 0.12;
        cat.facing = this.room.box.x > this.w * 0.5 ? -1 : 1;
        cat.tailAmp = 10;
        cat.tailSpeed = 2.4;
        this.anchorBox();
        if (cmd.t > 18 && this.tool !== "box") {
          this.command = { name: "outbox", phase: "rise", t: 0 };
        }
      }
    } else if (cmd.name === "outbox") {
      if (cmd.phase === "rise") {
        cat.inBox = true;
        cat.peek = 0.7 + Math.min(1, cmd.t / 0.25) * 0.4;
        this.anchorBox();
        if (cmd.t > 0.28) {
          cat.inBox = false;
          cat.x = this.room.boxX;
          cmd.phase = "hop";
          cmd.t = 0;
          this.audio.rustle();
        }
      } else {
        const k = Math.min(1, cmd.t / 0.36);
        setHop(-Math.sin(k * Math.PI) * 48);
        this.desiredPose("pounce");
        this.moveTo(this.room.boxX - 70, 80, dt);
        if (cmd.t > 0.36) {
          this.command = null;
          this.tool = this.tool === "box" ? null : this.tool;
          this.syncHint();
        }
      }
    }
    this.lerpPose(dt);
  }

  anchorBox() {
    const box = this.room.box;
    this.cat.boxAnchorX = box.x + box.w * 0.4;
    this.cat.boxAnchorY = box.y + 8;
  }

  maybeNoticeBird() {
    if (this.birdShow || this.birdNoticed) return false;
    if (this.wand.active || this.laser.active || this.pet.touching || this.grab > 0) return false;
    if (this.command && this.command.name === "box") return false;
    if (this.yarn && this.yarn.engaged && (this.yarn.held || Math.hypot(this.yarn.vx, this.yarn.vy) > 40)) return false;
    return this.birds.some((bird) => bird.state === "perch" || bird.state === "peck");
  }

  startBirdShow() {
    this.birdNoticed = true;
    if (this.yarn && !this.yarn.held) this.yarn.engaged = false;
    if (this.cat.inBox) {
      this.cat.inBox = false;
      this.cat.x = this.room.boxX;
    }
    this.command = null;
    this.birdShow = { phase: "notice", t: 0, chirped: 0, blinked: false };
    this.audio.tweet(1);
  }

  updateBirdShow(dt, setHop) {
    const cat = this.cat;
    const show = this.birdShow;
    show.t += dt;
    const spot = clamp(this.room.watchX, 50, this.room.box.x - 20);
    this.lookAt(this.room.feeder.x, this.room.feeder.y);
    cat.excited = 0.85;
    if (show.phase === "notice") {
      this.desiredPose("sit");
      cat.earTwitch = 1;
      cat.tailSpeed = 4;
      if (show.t > 0.32) this.nextBird(show, "go");
    } else if (show.phase === "go") {
      const arrived = this.moveTo(spot, 120, dt);
      this.desiredPose(arrived ? "sit" : "walk");
      if (arrived) this.nextBird(show, "look");
    } else if (show.phase === "look") {
      this.desiredPose("sit");
      cat.gazeY = -1.4;
      if (show.t > 0.45) this.nextBird(show, "chatter");
    } else if (show.phase === "chatter") {
      this.desiredPose("sit");
      cat.mouth = Math.sin(this.time * 28) > 0 ? "chatter" : "none";
      cat.tailAmp = 16;
      cat.tailSpeed = 9;
      cat.gazeY = -1.3;
      const chirps = Math.floor(show.t * 4.5);
      if (chirps > show.chirped) {
        show.chirped = chirps;
        this.audio.chirp();
        const head = this.headWorld();
        this.effects.push({ type: "mark", x: head.x + cat.facing * 20, y: head.y, life: 0, max: 0.4 });
      }
      if (show.t > 1.65) this.nextBird(show, "wiggle");
    } else if (show.phase === "wiggle") {
      this.desiredPose("stalk");
      cat.wiggleAmp = 0.18;
      cat.wigglePhase += dt * 26;
      cat.tailAmp = 18;
      cat.tailSpeed = 12;
      if (show.t > 0.82) {
        this.audio.meow();
        this.nextBird(show, "pounce");
      }
    } else if (show.phase === "pounce") {
      this.desiredPose("pounce");
      const k = Math.min(1, show.t / 0.36);
      setHop(-Math.sin(k * Math.PI) * 86 * cat.scale);
      cat.x += (spot - cat.x) * Math.min(1, dt * 10);
      cat.swat = 1;
      if (show.t > 0.36) {
        this.glass = 1;
        this.flash = 1;
        cat.squash = 0.7;
        this.audio.pop();
        this.scatterBirds();
        this.addPawPrint();
        this.moods.playful = clamp01(this.moods.playful + 0.14);
        this.moods.happy = clamp01(this.moods.happy + 0.08);
        this.moods.sleepy = clamp01(this.moods.sleepy - 0.06);
        this.nextBird(show, "after");
      }
    } else if (show.phase === "after") {
      this.desiredPose("sit");
      cat.gazeY = -0.8;
      if (!show.blinked && show.t > 0.25) {
        show.blinked = true;
        this.forceBlink(true);
      }
      if (show.t > 1.25) this.birdShow = null;
    }
    this.lerpPose(dt);
  }

  nextBird(show, phase) {
    show.phase = phase;
    show.t = 0;
  }

  headWorld() {
    const cat = this.cat;
    return {
      x: cat.x + cat.facing * cat.m.headX * cat.scale,
      y: cat.groundY + cat.hop + cat.m.headY * cat.scale,
    };
  }

  addPawPrint() {
    const win = this.room.win;
    this.prints.push({
      x: this.room.feeder.x - 16,
      y: win.y + win.h * 0.62,
      life: 1,
    });
    if (this.prints.length > 3) this.prints.shift();
  }

  decayPrints(dt) {
    this.prints.forEach((print) => {
      print.life -= dt * 0.18;
    });
    this.prints = this.prints.filter((print) => print.life > 0);
  }

  updateAuto(dt, setHop) {
    if (!this.auto) this.chooseAuto();
    const cat = this.cat;
    const auto = this.auto;
    auto.t += dt;
    const finish = () => {
      this.auto = null;
    };
    if (auto.name === "hello") {
      const arrived = this.moveTo(this.room.napX, 90, dt);
      this.desiredPose(arrived ? "sit" : "walk");
      if (auto.t > 0.45 && !auto.meowed) {
        auto.meowed = true;
        this.audio.meow();
        cat.mouth = "meow";
      }
      if (auto.t > 2.3) finish();
    } else if (auto.name === "wander" || auto.name === "sit") {
      if (auto.phase === "start") {
        auto.target = this.randomFloorX();
        auto.phase = "go";
        auto.hold = auto.name === "sit" ? 2.2 + Math.random() * 1.6 : 1.2 + Math.random() * 1.4;
        auto.t = 0;
      }
      const arrived = this.moveTo(auto.target, 86, dt);
      this.desiredPose(arrived ? "sit" : "walk");
      if (arrived && auto.t > auto.hold) finish();
    } else if (auto.name === "groom") {
      if (auto.phase === "start") {
        auto.phase = "lick";
        auto.t = 0;
        auto.hold = 4.2 + Math.random() * 2;
      }
      this.desiredPose("groom");
      cat.lick = Math.sin(this.time * 7) > 0.2 ? 1 : 0;
      cat.mouth = cat.lick > 0.6 ? "lick" : "none";
      this.moods.happy = clamp01(this.moods.happy + dt * 0.01);
      if (auto.t > auto.hold) finish();
    } else if (auto.name === "stretch") {
      if (auto.phase === "start") {
        auto.phase = "do";
        auto.t = 0;
      }
      this.desiredPose("stretch");
      if (auto.t > 0.8 && auto.t < 1.5 && this.moods.sleepy > 0.45) cat.mouth = "yawn";
      if (auto.t > 2.7) finish();
    } else if (auto.name === "nap") {
      if (auto.phase === "start") {
        auto.phase = "go";
        auto.t = 0;
      } else if (auto.phase === "go") {
        const arrived = this.moveTo(this.room.napX, 80, dt);
        this.desiredPose(arrived ? "sit" : "walk");
        if (arrived) {
          auto.phase = "curl";
          auto.t = 0;
          auto.hold = 9 + this.moods.sleepy * 8;
        }
      } else if (auto.phase === "curl") {
        this.desiredPose("curl");
        cat.asleep = cat.curl > 0.55;
        cat.blink = cat.asleep ? 0 : cat.blink;
        cat.tailAmp = 2;
        cat.tailSpeed = 0.6;
        if (auto.t > auto.hold) {
          auto.phase = "wake";
          auto.t = 0;
          cat.asleep = false;
        }
      } else {
        this.desiredPose("stretch");
        if (auto.t > 0.4 && auto.t < 1.3) cat.mouth = "yawn";
        if (auto.t > 1.8) finish();
      }
    } else if (auto.name === "window") {
      if (auto.phase === "start") {
        auto.phase = "go";
        auto.t = 0;
      } else if (auto.phase === "go") {
        const spot = clamp(this.room.watchX, 48, this.room.box.x - 16);
        const arrived = this.moveTo(spot, 90, dt);
        this.desiredPose(arrived ? "sit" : "walk");
        if (arrived) {
          auto.phase = "look";
          auto.t = 0;
          auto.hold = 3.2 + Math.random() * 2.4;
        }
      } else {
        this.desiredPose("sit");
        this.lookAt(this.room.feeder.x, this.room.feeder.y);
        cat.tailAmp = 6;
        if (auto.t > auto.hold) finish();
      }
    } else if (auto.name === "zoomies") {
      if (auto.phase === "start") {
        auto.phase = "run";
        auto.t = 0;
        auto.laps = 0;
        auto.dir = Math.random() < 0.5 ? -1 : 1;
        this.moods.playful = clamp01(Math.max(0.25, this.moods.playful - 0.16));
      }
      if (auto.phase === "run") {
        const left = 52;
        const right = this.room.box.x - 24;
        const target = auto.dir > 0 ? right : left;
        const arrived = this.moveTo(target, 250, dt);
        this.desiredPose("run");
        cat.excited = 1;
        cat.tailAmp = 10;
        cat.tailSpeed = 7;
        if (!this.reduced && Math.random() < dt * 8) {
          this.effects.push({
            type: "zoom",
            x: cat.x - cat.facing * 30,
            y: cat.groundY - 20 - Math.random() * 30,
            w: -cat.facing * (16 + Math.random() * 18),
            life: 0,
          });
        }
        if (arrived) {
          auto.dir *= -1;
          auto.laps += 1;
          if (auto.laps >= 4) {
            auto.phase = "flop";
            auto.t = 0;
          }
        }
      } else {
        this.desiredPose("sit");
        cat.mouth = auto.t < 0.8 ? "lick" : "none";
        cat.lick = auto.t < 0.8 ? 1 : 0;
        this.moods.sleepy = clamp01(this.moods.sleepy + dt * 0.04);
        if (auto.t > 1.5) finish();
      }
    } else if (auto.name === "box") {
      if (auto.phase === "start") {
        this.command = { name: "box", phase: "go", t: 0 };
        this.auto = null;
        this.updateCommand(dt, setHop);
        return;
      }
    }
    this.lerpPose(dt);
    void setHop;
  }

  chooseAuto() {
    const m = this.moods;
    const weights = {
      wander: 1.2,
      sit: 0.8,
      groom: 0.45 + m.happy * 0.95,
      stretch: 0.35 + m.sleepy * 0.7,
      nap: m.sleepy * m.sleepy * 3.1 + (m.sleepy > 0.72 ? 1.4 : 0),
      window: 0.62 + (1 - m.playful) * 0.25,
      zoomies: m.playful > 0.55 ? (m.playful - 0.4) * 3.3 : 0.08,
      box: 0.32 + m.sleepy * 0.4,
    };
    if (this.lastAuto && weights[this.lastAuto] != null) weights[this.lastAuto] *= 0.22;
    const name = weightedPick(weights);
    this.lastAuto = name;
    this.auto = { name, phase: "start", t: 0 };
  }

  randomFloorX() {
    const left = 48;
    const right = Math.max(left + 20, this.room.box.x - 30);
    return left + Math.random() * (right - left);
  }

  updateBirds(dt) {
    const perched = this.birds.some((bird) => bird.state === "perch" || bird.state === "peck" || bird.state === "fly");
    if (!perched && !this.birdShow) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.spawnFlock();
        this.birdTimer = 20 + Math.random() * 16;
      }
    }
    const win = this.room.win;
    for (const bird of this.birds) {
      bird.peckT = Math.max(0, bird.peckT - dt);
      if (bird.state === "fly") {
        bird.x += (bird.perchX - bird.x) * Math.min(1, dt * 2.1);
        bird.y += (bird.perchY - bird.y) * Math.min(1, dt * 2.1);
        if (Math.hypot(bird.perchX - bird.x, bird.perchY - bird.y) < 4) {
          bird.state = "perch";
          bird.x = bird.perchX;
          bird.y = bird.perchY;
          bird.leaveAt = this.time + 9 + Math.random() * 7;
          this.audio.tweet(BIRD_PITCH[bird.spec.id] || 1);
        }
      } else if (bird.state === "perch" || bird.state === "peck") {
        bird.peckIn -= dt;
        if (bird.peckIn <= 0) {
          bird.state = "peck";
          bird.peckT = 0.22;
          bird.peckIn = 0.8 + Math.random() * 1.3;
        }
        if (this.time > bird.leaveAt && !this.birdShow) {
          bird.state = "leave";
          bird.vx = (bird.x < win.x + win.w / 2 ? -1 : 1) * (70 + Math.random() * 30);
          bird.vy = -50 - Math.random() * 20;
        }
      } else if (bird.state === "scatter" || bird.state === "leave") {
        bird.x += bird.vx * dt;
        bird.y += bird.vy * dt;
        bird.vy -= 20 * dt;
        if (bird.x < win.x - 20 || bird.x > win.x + win.w + 20 || bird.y < win.y - 20) bird.state = "gone";
      }
    }
    const before = this.birds.length;
    this.birds = this.birds.filter((bird) => bird.state !== "gone");
    if (before && this.birds.length === 0) this.birdNoticed = false;
  }

  spawnFlock() {
    const count = Math.random() < 0.25 ? 1 : Math.random() < 0.7 ? 2 : 3;
    const used = new Set();
    const win = this.room.win;
    const feeder = this.room.feeder;
    const slots = [feeder.x - 30, feeder.x + 2, feeder.x + 32];
    for (let i = 0; i < count; i++) {
      let idx = Math.floor(Math.random() * speciesCount());
      let guard = 0;
      while (used.has(idx) && guard < 6) {
        idx = (idx + 1) % speciesCount();
        guard += 1;
      }
      used.add(idx);
      const fromLeft = Math.random() < 0.5;
      this.birds.push({
        spec: speciesAt(idx),
        x: fromLeft ? win.x + 12 : win.x + win.w - 12,
        y: win.y + 28 + Math.random() * 24,
        vx: 0,
        vy: 0,
        dir: fromLeft ? 1 : -1,
        state: "fly",
        perchX: slots[i % slots.length],
        perchY: feeder.y - 2,
        phase: Math.random() * Math.PI * 2,
        peckIn: 1,
        peckT: 0,
        leaveAt: this.time + 14,
      });
    }
  }

  scatterBirds() {
    const win = this.room.win;
    for (const bird of this.birds) {
      if (bird.state === "gone") continue;
      bird.state = "scatter";
      const side = bird.x < win.x + win.w / 2 ? -1 : 1;
      bird.vx = side * (110 + Math.random() * 50);
      bird.vy = -80 - Math.random() * 40;
      bird.dir = side;
    }
    this.audio.tweet(1.2);
    this.audio.tweet(0.85);
  }

  updateEffects(dt) {
    if (this.cat.asleep) {
      this.zzzT += dt;
      if (this.zzzT > 0.75) {
        this.zzzT = 0;
        const head = this.cat.inBox
          ? { x: this.cat.boxAnchorX, y: this.cat.boxAnchorY - 20 }
          : this.headWorld();
        this.effects.push({
          type: "zzz",
          x: head.x + 16,
          y: head.y - 10,
          life: 0,
          max: 1.6,
          s: 4 + Math.random() * 6,
          vy: -18,
        });
      }
    } else this.zzzT = 0;
    for (const fx of this.effects) {
      fx.life += dt;
      if (fx.vy) fx.y += fx.vy * dt;
    }
    this.effects = this.effects.filter((fx) => fx.life < fx.max);
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    drawRoom(ctx, this.room, this.time, this.birds, { glass: this.glass, flash: this.flash, prints: this.prints });
    if (this.cat && this.cat.inBox) drawBoxCat(ctx, this.cat, this.room.box, this.time);
    if (this.yarn) drawYarn(ctx, this.yarn);
    if (this.cat && !this.cat.inBox) drawCat(ctx, this.cat, this.time);
    if (this.tool === "wand") drawFeather(ctx, this.wand.x, this.wand.y, this.time);
    if (this.tool === "laser") drawLaser(ctx, this.laser.x, this.laser.y, this.time);
    drawEffects(ctx, this.effects);
  }

  // Test and tuning hooks. They are not shown in the room.
  debugSnapshot() {
    return {
      pose: this.poseName,
      auto: this.auto && this.auto.name,
      autoPhase: this.auto && this.auto.phase,
      bird: this.birdShow && this.birdShow.phase,
      birds: this.birds.map((bird) => bird.state),
      inBox: this.cat && this.cat.inBox,
      tool: this.tool,
      moods: { ...this.moods },
      curl: this.cat && this.cat.curl,
      x: this.cat && Math.round(this.cat.x),
    };
  }

  forceAction(name) {
    this.wand.active = false;
    this.laser.active = false;
    this.command = null;
    this.birdShow = null;
    this.cat.inBox = false;
    this.auto = { name, phase: "start", t: 0 };
  }

  forceBirds() {
    this.birds = [];
    this.spawnFlock();
    for (const bird of this.birds) {
      bird.state = "perch";
      bird.x = bird.perchX;
      bird.y = bird.perchY;
      bird.leaveAt = this.time + 30;
    }
    this.birdNoticed = false;
    this.birdTimer = 30;
  }
}

export function renderPreview(ctx, config, w, h, time) {
  ctx.clearRect(0, 0, w, h);
  previewBackdrop(ctx, w, h);
  const blinkCycle = time % 3.8;
  let blink = 1;
  if (blinkCycle < 0.1) blink = 1 - blinkCycle / 0.1;
  else if (blinkCycle < 0.2) blink = (blinkCycle - 0.1) / 0.1;
  const earCycle = time % 4.8;
  const earTwitch = earCycle < 0.16 ? 1 - earCycle / 0.16 : 0;
  const cat = {
    x: w * 0.5,
    groundY: h * 0.8,
    hop: 0,
    facing: 1,
    scale: Math.min(w / 150, h / 130) * 1.05,
    app: appearanceFrom(config),
    m: clonePose("sit"),
    curl: 0,
    back: 0,
    inBox: false,
    blink,
    squint: 0,
    mouth: "none",
    lick: 0,
    earTwitch,
    earSide: 1,
    tailAmp: 9,
    tailSpeed: 1.5,
    purr: 0,
    squash: 1,
    walkPhase: 0,
    gazeX: 0.2,
    gazeY: -0.25,
    excited: 0,
    pupil: 0.42,
    asleep: false,
    swat: 0,
    drawRot: 0,
  };
  cat.m.stride = 0;
  drawCat(ctx, cat, time);
}

function hitBox(box, x, y) {
  return x >= box.x - 12 && x <= box.x + box.w + 16 && y >= box.y - 16 && y <= box.y + box.h + 12;
}
