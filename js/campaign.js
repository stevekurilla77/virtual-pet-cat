// Worlds, map nodes, and the level recipes for Sunbeam's four-world trip.

export const TUNES = {
  "tune-house": { tempo: 96, notes: [262, 330, 392, 330, 294, 370, 440, 370] },
  "tune-street": { tempo: 112, notes: [294, 370, 440, 494, 440, 370, 330, 294] },
  "tune-vet": { tempo: 84, notes: [220, 277, 330, 277, 247, 311, 370, 311] },
  "tune-rain": { tempo: 76, notes: [196, 247, 294, 247, 220, 262, 330, 262] },
};

const clue = (id, label, say, open) => ({ id, label, say, open, next: "the map" });

function street(decor, gap, extra = []) {
  return [
    ["set", 760, [150, 70, 150, decor]],
    ["gap", gap],
    ["floor", 680],
    ["gap", gap + 8],
    ["stairs", 3, 40, "fence"],
    ["floor", 640],
    ["bed"],
    ["gap", gap + 4],
    ["set", 740, [120, 120, 140, "branch"], [400, 64, 130, "sill"]],
    ["gap", gap],
    ["floor", 820],
    ...extra,
  ];
}

function rooms(decor, gap) {
  return [
    ["set", 700, [160, 80, 160, decor]],
    ["gap", gap],
    ["floor", 640],
    ["stairs", 3, 36, "shelf"],
    ["floor", 600],
    ["bed"],
    ["pond", 380],
    ["gap", gap],
    ["set", 720, [200, 100, 120, "sill"]],
    ["floor", 860],
  ];
}

export const EXTRA_LEVELS = [
  {
    id: "sidewalk", name: "Sidewalk and Hedges", world: 1, theme: "street", music: "tune-street", fish: 24,
    goal: "clue", kit: ["can", "hose", "post", "balloon", "box"],
    clue: clue("tag", "Tag", "A collar tag! They came down this sidewalk...", "Sidewalk and hedges. Where is the little bell?"),
    plan: street("planter", 104),
    mice: [0.22, 0.55], foes: [["raccoon", 0.4], ["crow", 0.7]],
  },
  {
    id: "alley", name: "Garbage Alley", world: 1, theme: "street", music: "tune-street", fish: 26,
    goal: "clue", kit: ["can", "pretzel", "box", "post", "spring"],
    clue: clue("bell", "Bell", "A tiny bell by the cans. Up on the roofs next...", "Garbage alley. Don't knock the cans."),
    plan: street("mailbox", 108, [["gap", 110], ["floor", 700]]),
    mice: [0.3], foes: [["raccoon", 0.25], ["raccoon", 0.62], ["possum", 0.78]],
  },
  {
    id: "rooftops", name: "Rooftops", world: 1, theme: "street", music: "tune-street", fish: 28,
    goal: "clue", kit: ["wind", "post", "balloon", "hook"],
    clue: clue("paw", "Paw prints", "Paw prints across the shingles. The trees are next...", "Rooftops. Hop the gutters."),
    plan: [
      ["set", 820, [180, 90, 160, "rail"], [460, 150, 140, "perch"]],
      ["gap", 112], ["stairs", 3, 42, "fence"], ["floor", 640], ["bed"],
      ["gap", 118], ["set", 760, [200, 120, 150, "branch"]], ["gap", 108], ["floor", 900],
    ],
    mice: [0.48], foes: [["crow", 0.2], ["crow", 0.66], ["toy", 0.84]],
  },
  {
    id: "treetop", name: "Treetop Trail", world: 1, theme: "street", music: "tune-street", fish: 26,
    goal: "clue", kit: ["post", "balloon", "hook", "hose"],
    clue: clue("ribbon", "Ribbon", "A ribbon in the branches. The dog park is close...", "Treetop trail. The trunk can be climbed."),
    plan: street("branch", 106),
    mice: [0.34], foes: [["crow", 0.18], ["squirrel", 0.5], ["squirrel", 0.72]],
  },
  {
    id: "dogpark", name: "Dog Park Fence", world: 1, theme: "street", music: "tune-street", fish: 30,
    goal: "rescue", kit: ["can", "post", "hose", "box", "spring"],
    clue: clue("friend", "Friend", "There you are, little one. I've got you.", "The dog park. Someone is barking."),
    plan: street("fence", 110, [["floor", 760]]),
    mice: [0.2], foes: [["dog", 0.36], ["dog", 0.58], ["bulldog", 0.9, { hp: 3, big: true, boss: true }]],
  },
  {
    id: "waiting", name: "Waiting Room", world: 2, theme: "vet", music: "tune-vet", fish: 24,
    goal: "clue", kit: ["cart", "ice", "post", "box"],
    clue: clue("chart", "Chart", "A chart with your name. The exam rooms are that way...", "The waiting room. Soft paws."),
    plan: rooms("counter", 100),
    mice: [0.4], foes: [["tech", 0.28], ["parrot", 0.62], ["alley", 0.8]],
  },
  {
    id: "exam", name: "Exam Rooms", world: 2, theme: "vet", music: "tune-vet", fish: 26,
    goal: "clue", kit: ["cart", "ice", "sensor", "post"],
    clue: clue("cone", "Cone", "A plastic cone. Not today. The vents are open...", "Exam rooms. The floors are shiny."),
    plan: rooms("shelf", 104),
    foes: [["tech", 0.22], ["tech", 0.55], ["toy", 0.74]],
  },
  {
    id: "vents", name: "Vents and Ducts", world: 2, theme: "vet", music: "tune-vet", fish: 26,
    goal: "clue", kit: ["vent", "post", "box", "spring"],
    clue: clue("screw", "Screw", "A loose vent screw. The supply closet smells like treats...", "Vents. In one duct and out the next."),
    plan: [
      ["floor", 640], ["gap", 96], ["stairs", 3, 34, "shelf"], ["floor", 560], ["bed"],
      ["gap", 100], ["set", 700, [160, 96, 140, "sill"], [400, 150, 120, "perch"]],
      ["gap", 104], ["floor", 820],
    ],
    mice: [0.45], foes: [["tech", 0.3], ["possum", 0.7]],
  },
  {
    id: "closet", name: "Lab and Supply Closet", world: 2, theme: "vet", music: "tune-vet", fish: 28,
    goal: "clue", kit: ["cart", "ice", "box", "post", "sensor"],
    clue: clue("vial", "Treats", "Treats in the closet. The front desk is the way out...", "The supply closet. Quiet paws."),
    plan: rooms("cage", 108),
    foes: [["tech", 0.26], ["parrot", 0.5], ["toy", 0.78]],
  },
  {
    id: "frontdesk", name: "Front Desk Dash", world: 2, theme: "vet", music: "tune-vet", fish: 30,
    goal: "escape", kit: ["cart", "sensor", "ice", "post", "box"],
    clue: clue("leash", "Leash", "The front doors. She is waiting just outside.", "Front desk. The doors slide. Run."),
    plan: rooms("counter", 112, ),
    foes: [["tech", 0.2], ["parrot", 0.48], ["nurse", 0.9, { hp: 3, big: true, boss: true }]],
  },
  {
    id: "rainy", name: "Rainy Streets", world: 3, theme: "night", music: "tune-rain", fish: 26,
    goal: "clue", kit: ["wind", "umbrella", "hose", "can", "post"],
    clue: clue("brolly", "Umbrella", "A lost umbrella. Home is through the rain...", "Rainy streets. The wind pushes."),
    plan: street("mailbox", 112),
    mice: [0.33], foes: [["crow", 0.24], ["raccoon", 0.58], ["alley", 0.8]],
  },
  {
    id: "drains", name: "Storm Drains", world: 3, theme: "night", music: "tune-rain", fish: 26,
    goal: "clue", kit: ["wind", "hose", "box", "spring"],
    clue: clue("grate", "Grate", "A grate that smells like the backyard...", "Storm drains. Mind the water."),
    plan: [
      ["floor", 700], ["pond", 460], ["gap", 114], ["floor", 640], ["bed"],
      ["gap", 118], ["stairs", 3, 40, "fence"], ["floor", 860],
    ],
    foes: [["possum", 0.3], ["raccoon", 0.55], ["crow", 0.75]],
  },
  {
    id: "chase", name: "Rooftop Chase", world: 3, theme: "night", music: "tune-rain", fish: 28,
    goal: "clue", kit: ["wind", "umbrella", "post", "balloon"],
    clue: clue("shingle", "Shingle", "A shingle from our roof. The fence run is next...", "Rooftop chase. Keep moving."),
    plan: street("rail", 116),
    foes: [["crow", 0.18], ["alley", 0.42], ["pigeon", 0.66], ["toy", 0.84]],
  },
  {
    id: "fencerun", name: "Backyard Fence Run", world: 3, theme: "night", music: "tune-rain", fish: 26,
    goal: "clue", kit: ["wind", "hose", "post", "can"],
    clue: clue("sock", "Sock", "Her sock on the fence. The house is just ahead...", "The backyard fence. Almost home."),
    plan: street("fence", 108),
    mice: [0.4], foes: [["dog", 0.28], ["raccoon", 0.6], ["crow", 0.82]],
  },
  {
    id: "homecoming", name: "The Final Climb", world: 3, theme: "night", music: "tune-rain", fish: 32,
    goal: "finale", kit: ["wind", "umbrella", "post", "balloon", "hook"],
    clue: clue("flap", "Cat flap", "The cat flap. She left it unlatched.", "The last climb. The window is lit."),
    plan: [
      ["floor", 720], ["gap", 110], ["stairs", 4, 40, "fence"], ["floor", 640], ["bed"],
      ["gap", 116], ["set", 800, [200, 140, 160, "perch"]], ["floor", 980],
    ],
    foes: [["crow", 0.2], ["alley", 0.45], ["rooster", 0.92, { hp: 3, big: true, boss: true }]],
  },
  {
    id: "fishpond", name: "The Fishing Spot", world: 0, theme: "porch", music: "music-porch", fish: 12,
    goal: "clue", kit: ["post", "box"], rod: true,
    clue: clue("bobber", "Bobber", "A quiet pond. The rod is happy here.", "A fishing spot. Cast when you are ready."),
    plan: [["floor", 640], ["pond", 520], ["floor", 700]],
    mice: [], foes: [["fish", 0.5]],
  },
  {
    id: "skirmish", name: "A Quick Shoo", world: 0, theme: "yard", music: "music-yard", fish: 8,
    goal: "clue", kit: ["box"],
    clue: clue("crumb", "Crumb", "The rascal drops a fish and flaps off.", "A little chase. Shoo them and go."),
    plan: [["floor", 720], ["gap", 100], ["floor", 680]],
    foes: [["crow", 0.35], ["mouse", 0.6]],
  },
];

export const WORLDS = [
  {
    id: "home", name: "Home Sweet Home", tune: "tune-house", mission: "Find the owner",
    sky: ["#f6d7a8", "#f3e2c4"], ground: "#e7c49a", path: "#f2c14b", ink: "#5c4638",
    need: null,
    path: ["living", "porch", "yard", "nap", "neighbor"],
    nodes: {
      living: { kind: "level", level: "living", x: 0.16, y: 0.62, label: "1" },
      porch: { kind: "level", level: "porch", x: 0.34, y: 0.42, label: "2" },
      bowl: { kind: "fish", level: "fishpond", x: 0.34, y: 0.78, label: "Fish", from: "porch" },
      yard: { kind: "level", level: "yard", x: 0.52, y: 0.58, label: "3" },
      treats: { kind: "bonus", x: 0.52, y: 0.28, label: "Treats", from: "yard" },
      shop: { kind: "shop", x: 0.68, y: 0.3, label: "Shop", from: "nap" },
      nap: { kind: "check", x: 0.68, y: 0.62, label: "Rest" },
      neighbor: { kind: "boss", level: "neighbor", x: 0.86, y: 0.5, label: "Tea" },
    },
  },
  {
    id: "neighborhood", name: "The Neighborhood", tune: "tune-street", mission: "Rescue a friend",
    sky: ["#9adfff", "#fff0c4"], ground: "#8ed56a", path: "#f2c14b", ink: "#24502a",
    need: "neighbor",
    path: ["sidewalk", "alley", "rooftops", "treetop", "dogpark"],
    nodes: {
      sidewalk: { kind: "level", level: "sidewalk", x: 0.14, y: 0.66, label: "1" },
      alley: { kind: "level", level: "alley", x: 0.32, y: 0.46, label: "2" },
      fish2: { kind: "fish", level: "fishpond", x: 0.32, y: 0.78, label: "Fish", from: "alley" },
      rooftops: { kind: "level", level: "rooftops", x: 0.5, y: 0.36, label: "3" },
      treats2: { kind: "bonus", x: 0.5, y: 0.72, label: "Treats", from: "rooftops" },
      treetop: { kind: "level", level: "treetop", x: 0.68, y: 0.5, label: "4" },
      shop2: { kind: "shop", x: 0.68, y: 0.24, label: "Shop", from: "treetop" },
      dogpark: { kind: "boss", level: "dogpark", x: 0.86, y: 0.6, label: "Park" },
    },
  },
  {
    id: "vet", name: "Escape from the Vet", tune: "tune-vet", mission: "Find the front door",
    sky: ["#d7e6f2", "#f7f1ea"], ground: "#c9d6e0", path: "#8fb8d6", ink: "#2c3d4f",
    need: "dogpark",
    path: ["waiting", "exam", "vents", "closet", "frontdesk"],
    nodes: {
      waiting: { kind: "level", level: "waiting", x: 0.16, y: 0.6, label: "1" },
      exam: { kind: "level", level: "exam", x: 0.34, y: 0.4, label: "2" },
      treats3: { kind: "bonus", x: 0.34, y: 0.76, label: "Treats", from: "exam" },
      vents: { kind: "level", level: "vents", x: 0.52, y: 0.55, label: "3" },
      shop3: { kind: "shop", x: 0.52, y: 0.26, label: "Shop", from: "vents" },
      closet: { kind: "level", level: "closet", x: 0.7, y: 0.42, label: "4" },
      frontdesk: { kind: "boss", level: "frontdesk", x: 0.86, y: 0.62, label: "Out" },
    },
  },
  {
    id: "night", name: "Back into the House", tune: "tune-rain", mission: "Get home through the rain",
    sky: ["#2a2440", "#6a4a68"], ground: "#3d4a58", path: "#f2c14b", ink: "#f6efe6",
    need: "frontdesk",
    path: ["rainy", "drains", "chase", "fencerun", "homecoming"],
    nodes: {
      rainy: { kind: "level", level: "rainy", x: 0.14, y: 0.64, label: "1" },
      drains: { kind: "level", level: "drains", x: 0.32, y: 0.46, label: "2" },
      fish4: { kind: "fish", level: "fishpond", x: 0.32, y: 0.78, label: "Fish", from: "drains" },
      chase: { kind: "level", level: "chase", x: 0.5, y: 0.38, label: "3" },
      shop4: { kind: "shop", x: 0.5, y: 0.74, label: "Shop", from: "chase" },
      fencerun: { kind: "level", level: "fencerun", x: 0.68, y: 0.52, label: "4" },
      homecoming: { kind: "boss", level: "homecoming", x: 0.86, y: 0.4, label: "Home" },
    },
  },
];

export function worldOf(index) {
  return WORLDS[index] || WORLDS[0];
}

export function nodeOf(world, id) {
  return world.nodes[id];
}

export function worldClues(worldIndex) {
  return EXTRA_LEVELS.filter((level) => level.world === worldIndex && level.clue && level.id !== "fishpond" && level.id !== "skirmish").map((level) => level.clue);
}
