export const STORAGE_KEY = "sunbeam-cat";

export const EYES = {
  green: { id: "green", name: "Green", color: "#2FBF62", deep: "#147A38" },
  gold: { id: "gold", name: "Gold", color: "#F0B429", deep: "#C47E08" },
  blue: { id: "blue", name: "Blue", color: "#3C92E8", deep: "#1E5EAB" },
  copper: { id: "copper", name: "Copper", color: "#E4843A", deep: "#B85A16" },
  hazel: { id: "hazel", name: "Hazel", color: "#8FBF45", deep: "#5C8620" },
};

export const COATS = {
  orange: {
    id: "orange",
    name: "Orange tabby",
    pattern: "tabby",
    base: "#F4A04A",
    shade: "#E1842E",
    stripe: "#D26522",
    belly: "#FFE3C2",
    nose: "#F3A3B5",
    innerEar: "#F7B7C6",
    point: null,
  },
  brown: {
    id: "brown",
    name: "Brown tabby",
    pattern: "tabby",
    base: "#C4A06A",
    shade: "#A8844E",
    stripe: "#6E4E32",
    belly: "#F4E2C4",
    nose: "#E89AAB",
    innerEar: "#F0B4C0",
    point: null,
  },
  gray: {
    id: "gray",
    name: "Gray",
    pattern: "solid",
    base: "#B7BDC9",
    shade: "#8E96A6",
    stripe: "#7E8796",
    belly: "#ECEFF4",
    nose: "#F0A8B8",
    innerEar: "#F3C3CE",
    point: null,
  },
  black: {
    id: "black",
    name: "Black",
    pattern: "solid",
    base: "#2A2A30",
    shade: "#15151A",
    stripe: "#3A3A42",
    belly: "#3C3C46",
    nose: "#C98998",
    innerEar: "#C47E90",
    point: null,
  },
  white: {
    id: "white",
    name: "White",
    pattern: "solid",
    base: "#FFFEFC",
    shade: "#E4DDD6",
    stripe: "#D9D0C8",
    belly: "#FFFFFF",
    nose: "#F3A8B8",
    innerEar: "#F8C4D0",
    point: null,
  },
  tuxedo: {
    id: "tuxedo",
    name: "Tuxedo",
    pattern: "tuxedo",
    base: "#2C2C34",
    shade: "#16161C",
    stripe: "#3A3A44",
    belly: "#FFFEFC",
    nose: "#F3A8B8",
    innerEar: "#E7A8B6",
    point: null,
  },
  calico: {
    id: "calico",
    name: "Calico",
    pattern: "calico",
    base: "#FFFEFC",
    shade: "#E6DFD8",
    stripe: "#2C2C34",
    belly: "#FFFFFF",
    nose: "#F3A8B8",
    innerEar: "#F6C0CC",
    point: null,
    orange: "#F4A04A",
    ink: "#2A2A30",
  },
  tortie: {
    id: "tortie",
    name: "Tortoiseshell",
    pattern: "tortie",
    base: "#2C2C32",
    shade: "#16161C",
    stripe: "#E07A32",
    belly: "#3A322C",
    nose: "#D98998",
    innerEar: "#C47E90",
    point: null,
    orange: "#E8833A",
    ink: "#1A1A1E",
  },
  siamese: {
    id: "siamese",
    name: "Siamese",
    pattern: "point",
    base: "#F6E6D2",
    shade: "#E7D3B8",
    stripe: "#5C4638",
    belly: "#FFF3E6",
    nose: "#C98490",
    innerEar: "#A87868",
    point: "#5E4638",
  },
  cream: {
    id: "cream",
    name: "Cream",
    pattern: "solid",
    base: "#F8E2C0",
    shade: "#E8CC9C",
    stripe: "#E0C090",
    belly: "#FFF6E8",
    nose: "#F3A8B8",
    innerEar: "#F8C6D0",
    point: null,
  },
};

export const COAT_ORDER = [
  "orange",
  "brown",
  "gray",
  "black",
  "white",
  "tuxedo",
  "calico",
  "tortie",
  "siamese",
  "cream",
];

export const EYE_ORDER = ["green", "gold", "blue", "copper", "hazel"];

export function defaultCat() {
  return {
    v: 1,
    name: "Miso",
    gender: "girl",
    hair: "short",
    coat: "orange",
    eyes: "green",
    mute: false,
    mood: { playful: 0.48, sleepy: 0.3, happy: 0.66 },
    bond: 0,
    wear: 0,
    unlockAll: false,
    day: "",
    goals: { birds: 0, scratch: 0, play: 0 },
    goalBonus: {},
  };
}

export function cleanName(value) {
  const text = String(value || "")
    .replace(/[\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 14);
  return text || "Miso";
}

export function normalizeCat(raw) {
  const base = defaultCat();
  if (!raw || typeof raw !== "object") return base;
  const coat = COATS[raw.coat] ? raw.coat : base.coat;
  const eyes = EYES[raw.eyes] ? raw.eyes : base.eyes;
  const gender = raw.gender === "boy" ? "boy" : "girl";
  const hair = raw.hair === "long" ? "long" : "short";
  const mood = raw.mood || {};
  const goals = raw.goals || {};
  const bonus = raw.goalBonus || {};
  return {
    v: 1,
    name: cleanName(raw.name),
    gender,
    hair,
    coat,
    eyes,
    mute: Boolean(raw.mute),
    mood: {
      playful: clampMood(mood.playful, base.mood.playful),
      sleepy: clampMood(mood.sleepy, base.mood.sleepy),
      happy: clampMood(mood.happy, base.mood.happy),
    },
    bond: clampBond(raw.bond),
    wear: clampMood(raw.wear, 0),
    unlockAll: Boolean(raw.unlockAll),
    day: typeof raw.day === "string" ? raw.day.slice(0, 12) : "",
    goals: {
      birds: clampCount(goals.birds),
      scratch: clampCount(goals.scratch),
      play: clampCount(goals.play),
    },
    goalBonus: {
      birds: Boolean(bonus.birds),
      scratch: Boolean(bonus.scratch),
      play: Boolean(bonus.play),
    },
  };
}

function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(9, Math.round(n)));
}

function clampBond(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function clampMood(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function loadCat() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeCat(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveCat(cat) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCat(cat)));
  } catch {
    // Private mode and full storage still get a working session.
  }
}

export function swatchBackground(coat) {
  if (coat.pattern === "tabby") {
    return `repeating-linear-gradient(115deg, ${coat.base} 0 5px, ${coat.stripe} 5px 7px)`;
  }
  if (coat.pattern === "tuxedo") {
    return "linear-gradient(160deg, #2c2c34 0 58%, #fffefc 58%)";
  }
  if (coat.pattern === "calico") {
    return "conic-gradient(from 210deg, #fffefc 0 34%, #f4a04a 0 62%, #2a2a30 0 100%)";
  }
  if (coat.pattern === "tortie") {
    return "conic-gradient(from 20deg, #2c2c32 0 46%, #e8833a 0 78%, #1a1a1e 0 100%)";
  }
  if (coat.pattern === "point") {
    return "radial-gradient(circle at 50% 42%, #f6e6d2 0 42%, #5e4638 43%)";
  }
  return coat.base;
}
