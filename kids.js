// shared by index.html and world.html: the girls' data, what they say, and their pixel sprites
// drawn in code on a 32×34 grid. edit the lines below to change what they say.
const KIDS = [
  { id: "rose",    name: "mivi",          draw: drawRoseBunny,    back: drawRoseBunnyBack,    side: drawRoseBunnySide,    says: ["mivi got you a rose mama ♡", "boop!", "smell my rose bố", "i love vimi"] },
  { id: "blossom", name: "vimi",          draw: drawBlossomBunny, back: drawBlossomBunnyBack, side: drawBlossomBunnySide, says: ["flowers on my ears ✿", "carry vimi pls bố", "mama look at my feet", "mama's girl ♡", "where is mivi?"] },
  { id: "teddy",   name: "teddy",         draw: drawBear,         back: drawBearBack,         side: drawBearSide,         says: ["teddy wants a hug ♡", "i'm fluffy", "papa is silly hehe", "teddy loves mama & papa", "papa's little girl ♡"] },
];
const KID_SAYS   = ["mẹ ơi!", "bố ơi!", "mama look!", "papa carry me", "con yêu mẹ ♡", "con yêu bố ♡", "play with me?", "con đói quá…", "wheee"];
const SLEEP_TALK = ["mmm… 5 more minutes", "zzz…", "*snore*", "i'm not sleepy… *yawn*", "mẹ ơi… zzz"];
const GOODNIGHT  = ["goodnight mama ♡", "goodnight papa ♡", "con đi ngủ đây ♡", "night night bố"];
const MORNING    = ["mẹ ơi con dậy rồi!", "good morning papa ☀", "i'm awake!!", "morning mama ♡"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const PAL = {
  O: "#4a2b3a",                                                       // outline
  w: "#fffaf2", s: "#eadfd3", P: "#ffc6d3", p: "#f39bb0", k: "#2b1b24", // rose bunny
  r: "#e2405a", R: "#a92440", g: "#86b35a", G: "#5b8538",
  b: "#cdb39c", B: "#a98f78", f: "#fbf1dc", q: "#f28aa2", n: "#7a9a62", // blossom bunny
  t: "#c7a385", T: "#a5826a", h: "#f6aaa0", H: "#fde4dc", d: "#4a2a24", // bear
};
const GW = 32, GH = 34;
const hash = (x, y) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

function grid() {
  const g = new Array(GW * GH).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < GW && y < GH) g[y * GW + x] = c; };
  const ell = (cx, cy, rx, ry, c) => {
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) set(x, y, c);
    }
  };
  return {
    g, set, ell,
    part(cx, cy, rx, ry, c) { ell(cx, cy, rx + 1, ry + 1, "O"); ell(cx, cy, rx, ry, c); },
    px(list, c) { list.forEach(([x, y]) => set(x, y, c)); },
    tex(from, fn) { for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (g[y * GW + x] === from) { const c = fn(x, y); if (c) set(x, y, c); } },
  };
}

function drawRoseBunny(d, f, sleep) {
  d.part(16, 23, 7, 6.5, "w");
  d.part(11.5, 30 - (f ? 0 : 1), 3.2, 2.3, "w");
  d.part(20.5, 30 - (f ? 1 : 0), 3.2, 2.3, "w");
  d.part(7, 15, 3, 8.5, "w");  d.ell(8.2, 16, 1.3, 6, "s");
  d.part(25, 15, 3, 8.5, "w"); d.ell(23.8, 16, 1.3, 6, "s");
  d.part(16, 9.5, 8.5, 7, "w");
  eyes(d, 12, 19, 10, sleep);
  d.px([[15, 12], [16, 12]], "p");
  d.px([[11, 12], [20, 12]], "P");
  d.part(21, 22, 2, 2.6, "w");
  d.ell(14.5, 25, 0.9, 3.4, "G"); d.ell(14.5, 25, 0.5, 3.2, "g");
  d.part(13.8, 20.6, 2.1, 1.2, "g");
  d.part(10, 18, 3.2, 2.7, "r");
  d.px([[9, 17], [10, 18], [11, 17], [9, 19]], "R");
  d.part(11.5, 21.8, 1.9, 2.2, "w");
}

function drawBlossomBunny(d, f, sleep) {
  d.part(16, 23, 7, 6.5, "b");
  [[11.5, f ? 0 : 1], [20.5, f ? 1 : 0]].forEach(([x, up]) => {
    d.part(x, 30 - up, 3.2, 2.3, "b"); d.ell(x, 30.3 - up, 2, 1.5, "f");
  });
  d.part(6.5, 17, 3.2, 10, "b");  d.ell(7.4, 17.5, 1.7, 8, "f");
  d.part(25.5, 17, 3.2, 10, "b"); d.ell(24.6, 17.5, 1.7, 8, "f");
  d.part(16, 9.5, 8.5, 7, "b");
  eyes(d, 12, 19, 10, sleep);
  d.px([[15, 12], [16, 12]], "B");
  d.part(11.5, 22, 2, 2.6, "b");
  d.part(20.5, 22, 2, 2.6, "b");
  d.tex("f", (x, y) => { const h = hash(x, y) % 10; return h < 3 ? "q" : h === 3 ? "n" : null; });
}

function drawBear(d, f, sleep) {
  d.part(16, 24, 7.5, 6.5, "t");
  d.part(8, 21, 3, 3.2, "t");
  d.part(24, 21, 3, 3.2, "t");
  [[11, f ? 0 : 1], [21, f ? 1 : 0]].forEach(([x, up]) => {
    d.part(x, 30.5 - up, 3.4, 2.5, "t"); d.ell(x, 30.6 - up, 2.1, 1.6, "h");
  });
  d.part(9, 4.5, 3, 3, "t");  d.ell(9.3, 4.8, 1.7, 1.7, "h");
  d.part(23, 4.5, 3, 3, "t"); d.ell(22.7, 4.8, 1.7, 1.7, "h");
  d.part(16, 11, 8.5, 7.2, "t");
  d.tex("t", (x, y) => hash(x, y) % 10 < 3 ? "T" : null);
  eyes(d, 12, 19, 11, sleep);
  d.px([[15, 13], [16, 13], [15, 14], [16, 14]], "d");
  d.px([[13, 15], [14, 16], [17, 16], [18, 15], [15, 16], [16, 16]], "d");
  // chest heart
  [".hh.hh.", "hhhhhhh", "hhhhhhh", ".hhhhh.", "..hhh..", "...h..."].forEach((row, y) =>
    [...row].forEach((c, x) => { if (c === "h") d.set(16 + x, 20 + y, "h"); }));
  d.set(17, 21, "H");
}

function eyes(d, l, r, y, sleep) {
  if (sleep) d.px([[l - 1, y], [l, y], [r, y], [r + 1, y]], "O");
  else d.px([[l, y], [r, y]], "k");
}

// views for walking around the world: "front" (towards you), "back" (away) and "side" (facing right; mirror it for left)
const STEP = (f) => (f ? [14, 18] : [11.5, 20.5]); // where the two feet are in a side-view step

function bunnyBack(d, f, fur, sole, earLining) {
  d.part(16, 23, 7, 6.5, fur);
  d.part(11.5, 30 - (f ? 0 : 1), 3.2, 2.3, fur); d.ell(11.5, 30.6 - (f ? 0 : 1), 1.8, 1.2, sole);
  d.part(20.5, 30 - (f ? 1 : 0), 3.2, 2.3, fur); d.ell(20.5, 30.6 - (f ? 1 : 0), 1.8, 1.2, sole);
  d.part(10.5, 21.5, 2, 2.6, fur); d.part(21.5, 21.5, 2, 2.6, fur);
  d.part(7, 15, 3, 8.5, fur); d.part(25, 15, 3, 8.5, fur);
  if (earLining) { d.ell(5.6, 16, 1, 6, earLining); d.ell(26.4, 16, 1, 6, earLining); }
  d.part(16, 9.5, 8.5, 7, fur);
  d.part(16, 25.5, 2.6, 2.3, fur === "w" ? "s" : "f"); // fluffy tail
}
function bunnySide(d, f, fur, nose, earLining) {
  const [a, b] = STEP(f);
  d.part(a, 30, 3.2, 2.3, fur);
  d.part(15, 23, 6.5, 6.5, fur);
  d.part(8.5, 25, 2.4, 2.2, fur === "w" ? "s" : "f");
  d.part(b, 30.3, 3.2, 2.3, fur);
  d.part(18, 10, 7.5, 6.8, fur);
  d.part(13.5, 14.5, 2.8, 8, fur);                 // floppy ear hanging down the back of her head
  if (earLining) d.ell(12.3, 15.5, 0.9, 6, earLining);
  d.px([[22, 10]], "k");
  d.px([[25, 12]], nose);
  d.part(19.5, 21.5, 2, 2.4, fur);
}

function drawRoseBunnyBack(d, f) {
  bunnyBack(d, f, "w", "P");
  d.part(9.2, 18.5, 2, 1.8, "r");          // the rose peeking out
}
function drawRoseBunnySide(d, f) {
  bunnySide(d, f, "w", "p");
  d.px([[21, 12]], "P");
  d.ell(23, 23, 0.6, 3, "G");
  d.part(23.5, 19, 2.5, 2.2, "r"); d.px([[23, 18], [24, 19]], "R");
  d.part(21.5, 21.5, 1.4, 0.9, "g");
}
function drawBlossomBunnyBack(d, f) {
  bunnyBack(d, f, "b", "f", "f");
  d.tex("f", (x, y) => { const h = hash(x, y) % 10; return h < 3 ? "q" : h === 3 ? "n" : null; });
}
function drawBlossomBunnySide(d, f) {
  bunnySide(d, f, "b", "B", "f");
  d.tex("f", (x, y) => { const h = hash(x, y) % 10; return h < 3 ? "q" : h === 3 ? "n" : null; });
}
function drawBearBack(d, f) {
  d.part(16, 24, 7.5, 6.5, "t");
  d.part(8, 21, 3, 3.2, "t"); d.part(24, 21, 3, 3.2, "t");
  [[11, f ? 0 : 1], [21, f ? 1 : 0]].forEach(([x, up]) => { d.part(x, 30.5 - up, 3.4, 2.5, "t"); d.ell(x, 31 - up, 2, 1.3, "h"); });
  d.part(9, 4.5, 3, 3, "t"); d.part(23, 4.5, 3, 3, "t");
  d.part(16, 11, 8.5, 7.2, "t");
  d.part(16, 27, 2, 1.8, "t");
  d.tex("t", (x, y) => hash(x, y) % 10 < 3 ? "T" : null);
}
function drawBearSide(d, f) {
  const [a, b] = STEP(f);
  d.part(a, 30.5, 3.3, 2.5, "t");
  d.part(15, 24, 7, 6.5, "t");
  d.part(8.2, 26, 1.8, 1.6, "t");
  d.part(b, 30.8, 3.3, 2.5, "t");
  d.part(13, 5, 3, 3, "t"); d.ell(13.3, 5.3, 1.6, 1.6, "h");
  d.part(17, 11, 8, 7, "t");
  d.part(24, 13.5, 3.2, 2.6, "t");
  d.part(19.5, 21.5, 2.6, 3, "t");
  d.tex("t", (x, y) => hash(x, y) % 10 < 3 ? "T" : null);
  d.px([[21, 10]], "k");
  d.px([[27, 12], [27, 13], [26, 12]], "d");
  d.px([[25, 15], [24, 15]], "d");
  d.px([[21, 23], [22, 23], [21, 24]], "h");
}

function sprite(kid, frame, sleep = false, view = "front") {
  const d = grid();
  const draw = view === "back" ? kid.back : view === "side" ? kid.side : kid.draw;
  draw(d, frame, sleep);
  const c = document.createElement("canvas");
  c.width = GW; c.height = GH;
  const ctx = c.getContext("2d");
  d.g.forEach((col, i) => { if (col) { ctx.fillStyle = PAL[col]; ctx.fillRect(i % GW, Math.floor(i / GW), 1, 1); } });
  return c;
}

// ---------- who they are (the island reads this to give each girl her own mind) ----------
// traits go from 0 (not at all) to 1 (very):
//   curious · playful · cuddly · calm · brave · sociable · generous · creative · mischief · girly · foodie · shy
// loves:  things she starts out liking. she learns the rest herself as she plays, and her tastes
//         keep changing with how things actually go for her. any activity name works, e.g.
//   explore flowers butterfly pond fishing swing slide seesaw sandbox beach shells sunbathe picnic shop icecream
//   apples garden myplot bench nap cloudgaze kite fountain kitty puddles chat tag hide stroll teaparty dressup
//   eat cook tv piano read draw toys bath window tagalong missmama
// meh:    things she starts out not caring for
// the three sisters love each other equally and always want to be together
// body:   how fast she gets hungry / tired / bored / lonely / grubby (1 = normal, 1.3 = faster)
// yes / no: what she says when a sister asks her to play
// the rest is how she talks to you, what she grows, how fast she walks and when she goes to bed
const PERSONALITY = {
  rose: {
    about: "mivi: an angel. very polite, a sweet baby girl, a typical girlie girl and a sweet princess. our sweetheart. same age as vimi",
    title: "our polite little princess 👑",
    traits: { curious: 0.5, playful: 0.6, cuddly: 0.7, calm: 0.7, brave: 0.4, sociable: 0.75, generous: 0.95, creative: 0.7, mischief: 0.1, girly: 1, foodie: 0.4, shy: 0.2 },
    loves: ["flowers", "teaparty", "dressup", "piano", "fountain", "myplot"], meh: ["puddles", "fishing"],
    body: { hunger: 1, energy: 1, fun: 1, love: 1, clean: 0.9 },
    speed: 34, bedtime: 21.75,
    crops: { rose: 1, tulip: 0.9, lavender: 0.75, daisy: 0.6, strawberry: 0.6 },
    yes: ["yes please! ♡", "i'd love to ♡", "of course!"],
    no: ["not right now, sorry ♡", "maybe later please?", "could we play after this?"],
    tap: ["thank you mama ♡", "you're so kind papa ♡", "*curtsies* 👑", "may i have a hug please?", "i love you mama, thank you for visiting ♡", "papa you're the best, thank you!"],
    called: ["coming mama! thank you for waiting ♡", "yes mama, coming ♡", "of course papa ♡"],
    yum: ["thank you for the food ♡", "it's delicious, thank you!", "so yummy, thank you ♡"],
    plant: (c) => [`i'll plant ${c.name} ${c.emoji}, they're so pretty`, `${c.name} for a princess garden 👑`, `mama will love ${c.name} ${c.emoji}`],
  },
  blossom: {
    about: "vimi: a bit outgoing, always the first to charge into something. same age as mivi",
    title: "first to charge in 💨",
    traits: { curious: 0.95, playful: 1, cuddly: 0.4, calm: 0.2, brave: 1, sociable: 0.85, generous: 0.5, creative: 0.5, mischief: 0.7, girly: 0.3, foodie: 0.5, shy: 0 },
    loves: ["swing", "slide", "tag", "kite", "puddles", "explore", "hide", "ball"], meh: ["read", "bench"],
    body: { hunger: 1, energy: 1.1, fun: 1.3, love: 0.9, clean: 1.2 },
    speed: 39, bedtime: 21.75,
    crops: { sunflower: 1, watermelon: 0.9, pumpkin: 0.8, tomato: 0.6, carrot: 0.5 },
    yes: ["YES let's go!! 💨", "okay okay okay!", "race you there!"],
    no: ["nah, i'm busy!", "laterrr!", "after this one!"],
    tap: ["hehe again!", "race me papa!", "watch this!!", "i'm the fastest!", "let's go let's go!", "papa throw me in the air!"],
    called: ["zoooom! 💨", "coming!!", "race you mama!"],
    yum: ["NOM NOM", "yum yum yum!", "more please!!"],
    plant: (c) => [`${c.name}! the BIGGEST ones ever ${c.emoji}`, `let's try ${c.name} ${c.emoji}!`, `i bet i can grow ${c.name} taller than papa`],
  },
  teddy: {
    about: "teddy: the youngest. very shy, a little baby. she loves mama and papa nhiều lắm",
    title: "our shy little baby 🧸",
    traits: { curious: 0.3, playful: 0.5, cuddly: 1, calm: 0.7, brave: 0.1, sociable: 0.5, generous: 0.6, creative: 0.4, mischief: 0.2, girly: 0.4, foodie: 0.8, shy: 1 },
    loves: ["tagalong", "missmama", "toys", "picnic", "icecream", "nap", "kitty", "myplot"], meh: ["explore", "tag", "fishing"],
    body: { hunger: 1.2, energy: 1.2, fun: 1, love: 1.8, clean: 1 },
    speed: 28, bedtime: 21.25,
    crops: { strawberry: 1, blueberry: 0.85, carrot: 0.7, daisy: 0.6 },
    yes: ["…okay ♡", "teddy too? yay ♡", "hold my hand?"],
    no: ["*shakes head*", "teddy is shy…", "maybe later…"],
    tap: ["*hides face* 🙈", "…hehe ♡", "con thương mẹ nhiều lắm ♡", "papa… up please?", "teddy loves mama and papa nhiều lắm", "mama don't go…", "*hugs your finger*"],
    called: ["mama!! 🥺", "teddy coming…", "wait for teddy!"],
    yum: ["*nom*… yummy", "teddy likes it ♡", "mmm…"],
    plant: (c) => [`${c.name} ${c.emoji}… for mama and papa`, `teddy wants ${c.name}…`, `little ${c.name} ${c.emoji} hehe`],
  },
};
