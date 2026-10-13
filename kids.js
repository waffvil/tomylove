// shared by index.html and house.html: the girls' data, what they say, and their pixel sprites
// drawn in code on a 32×34 grid. edit the lines below to change what they say.
const KIDS = [
  { id: "rose",    name: "mivi",          draw: drawRoseBunny,    says: ["mivi got you a rose mama ♡", "boop!", "smell my rose bố", "i love vimi"] },
  { id: "blossom", name: "vimi",          draw: drawBlossomBunny, says: ["flowers on my ears ✿", "carry vimi pls bố", "mama look at my feet", "mama's girl ♡", "where is mivi?"] },
  { id: "teddy",   name: "teddy",         draw: drawBear,         says: ["teddy wants a hug ♡", "i'm fluffy", "papa is silly hehe", "teddy loves mama & papa", "papa's little girl ♡"] },
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

function sprite(kid, frame, sleep = false) {
  const d = grid();
  kid.draw(d, frame, sleep);
  const c = document.createElement("canvas");
  c.width = GW; c.height = GH;
  const ctx = c.getContext("2d");
  d.g.forEach((col, i) => { if (col) { ctx.fillStyle = PAL[col]; ctx.fillRect(i % GW, Math.floor(i / GW), 1, 1); } });
  return c;
}
