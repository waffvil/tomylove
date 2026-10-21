// ======================================================================
// our little island ♡ the girls live here by themselves: a top-down island
// (old pokémon style) and their little house. they choose what to do, feed
// themselves (the fridge, the shop, the ice cream cart, the apple trees and
// the strawberry patch never run out), follow the real clock and weather,
// and remember it all. you can play with them, but they never need you to.
// ======================================================================
"use strict";

let pipWin = null; // the little pop-out window, when it's open
const $ = (s) => pipWin?.document.querySelector(s) || document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s), ...(pipWin ? pipWin.document.querySelectorAll(s) : [])];
// timers live on whichever window is showing, so they keep running when the main tab is in the background
const later = (fn, ms = 0) => { const h = pipWin || window; return { h, id: h.setTimeout(fn, ms) }; };
const cancel = (t) => { if (t) try { t.h.clearTimeout(t.id); } catch {} };
const store = {
  get(k) { try { return localStorage.getItem("tomylove." + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("tomylove." + k, v); } catch {} },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const Q = new URLSearchParams(location.search); // ?hour=21.5&weather=rain to preview other times

// ---------- sounds (only after you've touched something) ----------
let ac = null;
let muted = store.get("muted") === "1";
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
function tone(freq, { type = "triangle", dur = 0.15, vol = 0.12, at = 0, slide = null } = {}) {
  if (muted || !ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.03);
}
const sfx = {
  squeak() { tone(1250, { type: "sine", slide: 1750, dur: 0.09, vol: 0.12 }); tone(1500, { type: "sine", slide: 2100, dur: 0.1, vol: 0.1, at: 0.11 }); },
  pop()    { tone(500, { type: "sine", slide: 1100, dur: 0.09, vol: 0.14 }); },
  boing()  { tone(180, { slide: 520, dur: 0.22, vol: 0.12 }); },
  splash() { [700, 500, 900].forEach((f, i) => tone(f, { type: "sine", slide: f * 0.5, dur: 0.12, vol: 0.06, at: i * 0.05 })); },
  rustle() { tone(2600, { type: "square", slide: 1800, dur: 0.05, vol: 0.02 }); tone(2200, { type: "square", slide: 1500, dur: 0.05, vol: 0.02, at: 0.06 }); },
  gift()   { [784, 988, 1175, 1568].forEach((f, i) => tone(f, { type: "triangle", dur: 0.3, vol: 0.09, at: i * 0.07 })); },
  knock()  { tone(140, { type: "sine", dur: 0.08, vol: 0.25 }); tone(140, { type: "sine", dur: 0.08, vol: 0.25, at: 0.16 }); },
  quack()  { tone(600, { type: "sawtooth", slide: 380, dur: 0.12, vol: 0.05 }); },
  meow()   { tone(760, { type: "sine", slide: 1150, dur: 0.12, vol: 0.08 }); tone(1150, { type: "sine", slide: 600, dur: 0.24, vol: 0.08, at: 0.12 }); },
  door()   { tone(320, { type: "triangle", slide: 240, dur: 0.14, vol: 0.07 }); },
  wish()   { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, { type: "sine", dur: 0.45, vol: 0.05, at: i * 0.09 })); },
  lullaby() { [523.25, 523.25, 783.99, 783.99, 880, 880, 783.99].forEach((f, i) => tone(f, { type: "sine", dur: 0.55, vol: 0.07, at: i * 0.3 })); },
};
const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319];
document.addEventListener("pointerdown", audio, { capture: true });
function renderSound() { $("#soundBtn").textContent = muted ? "🔈" : "🔊"; }
$("#soundBtn").addEventListener("click", () => { muted = !muted; store.set("muted", muted ? "1" : "0"); renderSound(); audio(); sfx.pop(); });
renderSound();

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  cancel(toastTimer); toastTimer = later(() => t.classList.remove("show"), ms);
}

// ======================================================================
// places: the island and the house, each its own little tile map
// ======================================================================
const T = 16;
const GRASS = 0, PATH = 1, SAND = 2, WATER = 3, FLOWERS = 4, TALL = 5, PLAZA = 6, DOCK = 7, SOIL = 8, WALL = 9, FLOOR = 10, TILES = 11;
const PAVED = new Set([PATH, PLAZA, DOCK, FLOOR, TILES]);
const INK = "#4a2b3a";
const ISL = "island", HOM = "house";
const tileOf = (px, py) => [Math.floor(px / T), Math.floor(py / T)];
const feetOf = (tx, ty) => [tx * T + 8, ty * T + 12];

function makeArea(id, W, H, fill, edge) {
  const A = { id, W, H, PW: W * T, PH: H * T, tiles: new Uint8Array(W * H).fill(fill), solid: new Uint8Array(W * H), objs: [] };
  A.in = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  A.at = (x, y) => (A.in(x, y) ? A.tiles[y * W + x] : edge);
  A.set = (x, y, v) => { if (A.in(x, y)) A.tiles[y * W + x] = v; };
  A.block = (x, y) => { if (A.in(x, y)) A.solid[y * W + x] = 1; };
  A.walk = (x, y) => A.in(x, y) && !A.solid[y * W + x] && A.tiles[y * W + x] !== WATER && A.tiles[y * W + x] !== WALL;
  A.add = (o) => { A.objs.push(o); (o.solid || []).forEach(([dx, dy]) => A.block(o.tx + dx, o.ty + dy)); return o; };
  A.rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) A.set(x, y, v); };
  A.ellipse = (cx, cy, rx, ry, v) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) A.set(x, y, v); };
  A.all = (fn) => { const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fn(x, y)) out.push([x, y]); return out; };
  A.near = (x, y, v) => DIRS4.some(([dx, dy]) => A.at(x + dx, y + dy) === v);
  return A;
}
const box2 = (w, h, x0 = 0, y0 = 0) => [...Array(w)].flatMap((_, x) => [...Array(h)].map((_, y) => [x + x0, y + y0]));

// ---------- the island ----------
const ISLAND = makeArea(ISL, 52, 38, GRASS, WATER);
const TALL_PATCHES = [[18, 26, 2.6, 1.8], [46, 24, 2.4, 1.9]];
{
  const I = ISLAND;
  for (let x = 0; x < I.W; x++) {
    const sandTop = 30 + Math.round(Math.sin(x / 5) * 0.7), shore = 33 + Math.round(Math.sin(x / 6 + 1) * 0.8);
    for (let y = sandTop; y < I.H; y++) I.set(x, y, y >= shore ? WATER : SAND);
  }
  I.ellipse(43, 10, 5.2, 3.4, WATER);  // the pond
  I.ellipse(7, 6, 4.6, 3.1, FLOWERS);  // the flower field
  TALL_PATCHES.forEach(([x, y, rx, ry]) => I.ellipse(x, y, rx, ry, TALL)); // tall grass to hide in
  I.rect(21, 17, 37, 24, PLAZA);       // the town square
  I.rect(10, 23, 13, 25, SAND);        // sandbox in the park
  I.rect(15, 7, 19, 8, SOIL);          // strawberry patch
  const hPath = (y, x0, x1) => I.rect(x0, y, x1, y + 1, PATH);
  const vPath = (x, y0, y1) => I.rect(x, y0, x + 1, y1, PATH);
  hPath(14, 3, 49);                    // the main road
  I.rect(38, 2, 49, 5, PATH);          // the girls' farm paths, top right
  I.rect(49, 6, 49, 13, PATH);
  vPath(25, 10, 13);                   // front door
  vPath(25, 16, 16);                   // into the square
  vPath(25, 25, 29);                   // down to the beach
  vPath(9, 16, 16);                    // park gate
  hPath(20, 38, 39);                   // up to the picnic hill
  I.rect(17, 9, 17, 13, PATH);         // garden gate
  I.rect(43, 10, 43, 13, DOCK);        // the little jetty
  [38, 42, 46].forEach((x) => I.rect(x, 3, x + 2, 4, SOIL)); // one plot each
}

// ---------- the house ----------
const HOME = makeArea(HOM, 24, 15, FLOOR, WALL);
{
  const H = HOME;
  H.rect(0, 0, 23, 2, WALL); H.rect(0, 14, 23, 14, WALL); H.rect(0, 0, 0, 14, WALL); H.rect(23, 0, 23, 14, WALL);
  H.rect(9, 3, 9, 13, WALL); H.set(9, 11, FLOOR); H.set(9, 12, FLOOR);           // bedroom | living room
  H.rect(17, 3, 17, 13, WALL); [5, 6, 11, 12].forEach((y) => H.set(17, y, FLOOR)); // living room | kitchen & bathroom
  H.rect(18, 9, 22, 9, WALL);                                                     // kitchen | bathroom
  H.rect(18, 3, 22, 8, TILES); H.rect(18, 10, 22, 13, TILES);
}
const AREAS = { [ISL]: ISLAND, [HOM]: HOME };
const DOOR = [25, 10];        // the tile in front of the island door
const HOME_ENTRY = [12, 13];  // just inside it
HOME.block(12, 14);
const EXITS = { [ISL]: { tile: DOOR, to: HOM, arrive: HOME_ENTRY }, [HOM]: { tile: HOME_ENTRY, to: ISL, arrive: DOOR } };

// ---------- pathfinding (A*, four directions, a little heap) ----------
function findPath(A, sx, sy, tx, ty) {
  if (!A.walk(tx, ty)) return null;
  const W = A.W, N = W * A.H, start = sy * W + sx, goal = ty * W + tx;
  if (start === goal) return [];
  const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [];
  const push = (f, i) => {
    heap.push([f, i]);
    for (let c = heap.length - 1; c > 0;) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let c = 0; ;) {
        const l = c * 2 + 1, r = l + 1; let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
      }
    }
    return top;
  };
  g[start] = 0; push(Math.abs(tx - sx) + Math.abs(ty - sy), start);
  while (heap.length) {
    const i = pop()[1];
    if (done[i]) continue;
    done[i] = 1;
    if (i === goal) { const path = []; for (let c = i; c !== start; c = came[c]) path.unshift([c % W, (c / W) | 0]); return path; }
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (!A.walk(nx, ny)) continue;
      const j = ny * W + nx, ng = g[i] + (PAVED.has(A.tiles[j]) ? 1 : 1.3); // they like paths
      if (ng < g[j]) { g[j] = ng; came[j] = i; push(ng + Math.abs(tx - nx) + Math.abs(ty - ny), j); }
    }
  }
  return null;
}
function nearestWalkable(A, tx, ty) {
  for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (A.walk(tx + dx, ty + dy)) return [tx + dx, ty + dy];
  }
  return EXITS[A.id].tile;
}
function randomTile(A, minDist = 0, from = null, ok = () => true) {
  for (let i = 0; i < 80; i++) {
    const x = irand(1, A.W - 2), y = irand(2, A.H - 3);
    if (A.walk(x, y) && ok(x, y) && (!from || Math.abs(x - from[0]) + Math.abs(y - from[1]) >= minDist)) return [x, y];
  }
  return EXITS[A.id].tile;
}

// ======================================================================
// pixel art helpers
// ======================================================================
function R(g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function box(g, x, y, w, h, fill) { R(g, INK, x, y, w, h); R(g, fill, x + 1, y + 1, w - 2, h - 2); }
function disc(g, cx, cy, r, fill, outline = INK) {
  for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = x * x + y * y;
    if (d <= r * r) R(g, fill, cx + x, cy + y, 1, 1);
    else if (outline && d <= (r + 1) * (r + 1)) R(g, outline, cx + x, cy + y, 1, 1);
  }
}
function oval(g, cx, cy, rx, ry, fill, outline = INK) {
  for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
    const d = (x / rx) ** 2 + (y / ry) ** 2, d2 = (x / (rx + 1)) ** 2 + (y / (ry + 1)) ** 2;
    if (d <= 1) R(g, fill, cx + x, cy + y, 1, 1);
    else if (outline && d2 <= 1) R(g, outline, cx + x, cy + y, 1, 1);
  }
}
function pixels(g, rows, x, y, colors) { rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== "." && colors[ch]) R(g, colors[ch], x + i, y + j, 1, 1); })); }
const canvasOf = (w, h, fn) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); fn(g); return c; };
const HEART = [".x.x.", "xxxxx", ".xxx.", "..x.."];
const FONT = {
  S: ["xxx", "x..", "xxx", "..x", "xxx"], H: ["x.x", "x.x", "xxx", "x.x", "x.x"], O: ["xxx", "x.x", "x.x", "x.x", "xxx"], P: ["xxx", "x.x", "xxx", "x..", "x.."],
  E: ["xxx", "x..", "xx.", "x..", "xxx"], N: ["x.x", "xxx", "xxx", "xxx", "x.x"], M: ["x.x", "xxx", "xxx", "x.x", "x.x"], V: ["x.x", "x.x", "x.x", "x.x", ".x."], T: ["xxx", ".x.", ".x.", ".x.", ".x."],
};
function text(g, str, x, y, c) { [...str].forEach((ch, i) => FONT[ch] && pixels(g, FONT[ch], x + i * 4, y, { x: c })); }
function line(g, c, x0, y0, x1, y1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) R(g, c, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}

// ======================================================================
// things on the island
// ======================================================================
const I = ISLAND;
function tree(tx, ty, kind) {
  const ok = [[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => [GRASS, FLOWERS, TALL].includes(I.at(tx + dx, ty + dy)) && !I.solid[(ty + dy) * I.W + tx + dx]);
  if (!ok) return null;
  return I.add({ type: "tree", kind, tx, ty, base: (ty + 2) * T, solid: [[0, 1], [1, 1]], apples: kind === "apple" ? 4 : 0, hit: [tx * T, ty * T - 12, 32, 44] });
}
const HOUSE = I.add({ type: "house", tx: 22, ty: 3, base: 10 * T, solid: box2(8, 6, 0, 1), doorT: 0, hit: [22 * T, 3 * T, 128, 112] });
I.add({ type: "mailbox", tx: 28, ty: 10, base: 11 * T, solid: [[0, 0]], hit: [28 * T, 10 * T - 10, 16, 26] });
const SIGN_TEXT = { home: "mivi, vimi & teddy's house ♡ (tap it to peek inside)", park: "the park ♡ swings, slide, seesaw & sandbox", beach: "the beach ♡ ice cream this way 🍦", square: "the town square ⛲ make a wish!" };
[[23, 10, "home"], [11, 16, "park"], [27, 28, "beach"], [21, 16, "square"]].forEach(([x, y, say]) => I.add({ type: "sign", tx: x, ty: y, base: (y + 1) * T, solid: [[0, 0]], say, hit: [x * T, y * T - 8, 16, 22] }));

// the garden: a strawberry patch inside a little fence
function fence(tx, ty, dir) { I.add({ type: "fence", dir, tx, ty, base: (ty + 1) * T - 3, solid: [[0, 0]] }); }
for (let x = 14; x <= 20; x++) { fence(x, 6, "h"); if (x !== 17) fence(x, 9, "h"); }
for (let y = 7; y <= 8; y++) { fence(14, y, "v"); fence(20, y, "v"); }
const PLANTS = [15, 16, 17, 18, 19].map((x) => I.add({ type: "plant", tx: x, ty: 7, base: 8 * T - 4, solid: [[0, 0]], g: rand(0.5, 3), wet: rand(0, 1), hit: [x * T, 7 * T - 4, 16, 20] }));

// the girls' own garden plots in the top right: each grows whatever she likes
const CROPS = {
  rose:       { name: "roses", one: "a rose", emoji: "🌹", grow: 1100, c: "#e2405a", a: "#ff8fa0", shape: "bush", flower: true },
  tulip:      { name: "tulips", one: "a tulip", emoji: "🌷", grow: 800, c: "#ff8fb4", a: "#ffd0de", shape: "cups", flower: true },
  lavender:   { name: "lavender", one: "some lavender", emoji: "💜", grow: 900, c: "#b59cf0", a: "#d9ccff", shape: "spikes", flower: true },
  daisy:      { name: "daisies", one: "a daisy", emoji: "🌼", grow: 700, c: "#ffffff", a: "#ffd966", shape: "cups", flower: true },
  sunflower:  { name: "sunflowers", one: "a sunflower", emoji: "🌻", grow: 1200, c: "#ffd966", a: "#8a5a2b", shape: "tall", flower: true },
  strawberry: { name: "strawberries", one: "strawberries", emoji: "🍓", grow: 900, c: "#e2405a", a: "#ffd966", shape: "bush" },
  blueberry:  { name: "blueberries", one: "blueberries", emoji: "🫐", grow: 1000, c: "#6a7fe0", a: "#b8c4ff", shape: "bush" },
  carrot:     { name: "carrots", one: "a carrot", emoji: "🥕", grow: 900, c: "#ff9a4a", shape: "tops" },
  tomato:     { name: "tomatoes", one: "a tomato", emoji: "🍅", grow: 1000, c: "#ff5a4a", shape: "stake" },
  watermelon: { name: "watermelons", one: "a watermelon", emoji: "🍉", grow: 1500, c: "#5fae55", a: "#3f7d3a", shape: "melon" },
  pumpkin:    { name: "pumpkins", one: "a pumpkin", emoji: "🎃", grow: 1400, c: "#ff9a3a", a: "#e07a2a", shape: "melon", keep: true },
};
const PLOTS = ["rose", "blossom", "teddy"].map((owner, i) => {
  const x0 = 38 + i * 4, plot = { owner, x0, tiles: [] };
  for (let y = 3; y <= 4; y++) for (let x = x0; x <= x0 + 2; x++)
    plot.tiles.push(I.add({ type: "crop", plot, tx: x, ty: y, base: (y + 1) * T - 3, solid: [[0, 0]], crop: null, g: 0, wet: 0, hit: [x * T, y * T - 12, 16, 28] }));
  return plot;
});
const plotOf = (k) => PLOTS.find((p) => p.owner === k.id);
const tendFrom = (t) => [t.tx, t.ty === 3 ? 2 : 5];

// the park, fenced in, gate at the top
for (let x = 3; x <= 15; x++) { if (x !== 9 && x !== 10) fence(x, 17, "h"); fence(x, 28, "h"); }
for (let y = 18; y <= 27; y++) { fence(3, y, "v"); fence(15, y, "v"); }
const SWINGS = I.add({ type: "swings", tx: 4, ty: 18, base: 19 * T + 2, solid: [[0, 1], [4, 1]], hit: [4 * T, 18 * T - 10, 80, 42] });
const SWING_SEATS = [[5, 19], [7, 19]];
const SLIDE = I.add({ type: "slide", tx: 11, ty: 18, base: 21 * T, solid: [[0, 1], [1, 1], [0, 2], [1, 2]], hit: [11 * T, 18 * T, 36, 48] });
const SEESAW = I.add({ type: "seesaw", tx: 4, ty: 23, base: 23 * T + 6, solid: [[2, 0]], seats: [[4, 23], [8, 23]], game: null, hit: [4 * T, 23 * T - 6, 80, 22] });
const CASTLE = I.add({ type: "castle", tx: 11, ty: 24, base: 25 * T - 3, level: 0 });
const SANDBOX = [[10, 24, "right"], [12, 24, "left"], [11, 25, "up"]];

// the town square: a fountain and the girls' little shop
const FOUNTAIN = I.add({ type: "fountain", tx: 25, ty: 19, base: 22 * T - 4, solid: box2(3, 3), hit: [25 * T, 19 * T - 2, 48, 50] });
const FOUNTAIN_SPOTS = [[24, 20, "right"], [28, 20, "left"], [26, 22, "up"], [26, 18, "down"]];
const SHOP = I.add({ type: "shop", tx: 32, ty: 16, base: 20 * T, solid: box2(5, 3, 0, 1), doorT: 0, hit: [32 * T, 16 * T, 80, 64] });
const SHOP_DOOR = [34, 20];

// the beach: ice cream cart, an umbrella and a towel
const CART = I.add({ type: "cart", tx: 31, ty: 30, base: 31 * T - 2, solid: [[0, 0], [1, 0]], hit: [31 * T, 30 * T - 18, 32, 34] });
const CART_SPOTS = [[31, 31], [32, 31]];
I.add({ type: "umbrella", tx: 16, ty: 31, base: 32 * T - 2, solid: [[0, 0]], hit: [16 * T - 8, 31 * T - 28, 32, 40] });
const TOWEL = { approach: [14, 31], pos: [15 * T, 31 * T + 11] };

// the picnic hill
const PICNIC = { x0: 40, y0: 18, x1: 43, y1: 19 };
const PICNIC_SPOTS = [[40, 18], [42, 18], [41, 19], [43, 19]];
I.add({ type: "basket", tx: 44, ty: 18, base: 19 * T, solid: [[0, 0]], hit: [44 * T, 18 * T, 16, 16] });

// benches (each is two seats)
const BENCHES = [[5, 27], [22, 22], [29, 22], [33, 12]].map(([x, y]) => I.add({ type: "bench", tx: x, ty: y, base: y * T + 2 }));
const BENCH_SPOTS = BENCHES.flatMap((b) => [[b.tx, b.ty], [b.tx + 1, b.ty]]);

// trees: a wall of them around the edge, and some to sit under
for (let x = 0; x < I.W; x += 2) tree(x, 0, (x / 2) % 3 === 1 ? "cherry" : "green");
for (let y = 2; y < 29; y += 2) { tree(0, y, y % 6 === 2 ? "cherry" : "green"); tree(50, y, y % 6 === 4 ? "cherry" : "green"); }
[[12, 2, "cherry"], [31, 9, "cherry"], [33, 3, "apple"], [36, 5, "apple"], [19, 19, "green"], [21, 27, "cherry"], [47, 17, "green"],
 [36, 11, "green"], [13, 20, "cherry"], [5, 11, "green"], [38, 28, "cherry"]].forEach(([x, y, k]) => tree(x, y, k));
[[21, 8], [21, 9], [30, 8], [2, 13], [48, 12], [49, 16], [16, 16], [18, 16], [30, 26], [34, 26], [44, 28], [12, 29], [6, 29], [29, 11], [36, 15], [46, 14 + 2]]
  .forEach(([x, y], i) => { if (I.walk(x, y) && [GRASS, FLOWERS].includes(I.at(x, y))) I.add({ type: "bush", v: i % 3, tx: x, ty: y, base: (y + 1) * T - 2, solid: [[0, 0]], hit: [x * T - 1, y * T, 18, 16] }); });
const APPLE_TREES = I.objs.filter((o) => o.type === "tree" && o.kind === "apple");
[[3, 31], [46, 31], [8, 32], [47, 30]].forEach(([x, y]) => { if (I.walk(x, y)) I.add({ type: "rock", tx: x, ty: y, base: (y + 1) * T - 2, solid: [[0, 0]] }); });
[[20, 13], [31, 13], [38, 13], [13, 13], [27, 12], [37, 17], [21, 24], [37, 24]].forEach(([x, y]) => { if (I.walk(x, y)) I.add({ type: "lamp", tx: x, ty: y, base: (y + 1) * T - 1, solid: [[0, 0]] }); });

// handy places
const SPOTS = {
  pond: I.all((x, y) => y < 15 && x > 36 && I.walk(x, y) && I.near(x, y, WATER) && I.at(x, y) !== DOCK),
  shore: I.all((x, y) => y > 28 && I.walk(x, y) && I.near(x, y, WATER)),
  flowers: I.all((x, y) => I.at(x, y) === FLOWERS && I.walk(x, y)),
  sand: I.all((x, y) => y > 28 && I.at(x, y) === SAND && I.walk(x, y) && !I.near(x, y, WATER)),
  shade: I.objs.filter((o) => o.type === "tree" && o.tx > 1 && o.tx < 50 && o.ty > 0).map((o) => [o.tx + (o.tx > 25 ? 0 : 1), o.ty + 2]).filter(([x, y]) => I.walk(x, y)),
  field: I.all((x, y) => x >= 39 && x <= 48 && y >= 21 && y <= 27 && I.at(x, y) === GRASS && I.walk(x, y)),
};
const facing = (A, x, y, type) => { for (const [dx, dy, d] of [[1, 0, "right"], [-1, 0, "left"], [0, 1, "down"], [0, -1, "up"]]) if (A.at(x + dx, y + dy) === type) return d; return "down"; };
const lilies = I.all((x, y) => I.at(x, y) === WATER && y < 15 && hash(x, y) % 4 === 0 && x !== 43);
const newShells = () => SPOTS.sand.filter(([x, y]) => hash(x * 3, y * 7) % 7 === 0).map(([x, y]) => ({ x: x * T + 4 + (hash(x, y) % 8), y: y * T + 6 + (hash(y, x) % 6), kind: hash(x, y) % 3 }));
let shells = newShells();
const PUDDLES = I.all((x, y) => I.walk(x, y) && [GRASS, PATH, PLAZA].includes(I.at(x, y)) && y > 2 && hash(x * 5, y * 11) % 23 === 0).slice(0, 18);
const HIDE_SPOTS = [...I.objs.filter((o) => o.type === "tree" && o.tx > 1 && o.tx < 50 && o.ty > 0).flatMap((o) => [[o.tx, o.ty], [o.tx + 1, o.ty]]),
  ...I.all((x, y) => I.at(x, y) === TALL)].filter(([x, y]) => I.walk(x, y) && findPath(I, ...DOOR, x, y));

// ======================================================================
// things in the house
// ======================================================================
const H_ = HOME;
const KID_BED = { rose: 0, blossom: 1, teddy: 2 };
const BED_LOOK = [
  { wood: "#f6a5c0", blanket: "#ffd0dc", dot: "#e2405a", leaf: "#86b35a", letter: "M" },   // mivi: roses
  { wood: "#e7c9a6", blanket: "#fff1a8", dot: "#f28aa2", leaf: "#fffaf2", letter: "V" },   // vimi: flowers
  { wood: "#c7a385", blanket: "#ffc4d6", dot: "#ff7fa8", leaf: null, letter: "T" },        // teddy: hearts
];
const BEDS = [1, 4, 7].map((bx, i) => {
  const o = H_.add({ type: "bed", i, tx: bx, ty: 3, base: 3 * T, solid: box2(2, 3), hit: [bx * T, 3 * T - 4, 32, 48] });
  o.over = (g) => g.drawImage(SPR.bedOver[i], bx * T, 3 * T - 4);
  o.overBase = 6 * T;
  return { obj: o, approach: [bx, 6], pos: [(bx + 1) * T, 5 * T + 2] };
});
[3, 6].forEach((x) => H_.add({ type: "nightstand", tx: x, ty: 3, base: 3 * T + 4, solid: [[0, 0]], hit: [x * T, 3 * T - 10, 16, 26] }));
H_.add({ type: "chest", tx: 1, ty: 13, base: 14 * T - 1, solid: [[0, 0], [1, 0]], hit: [T, 13 * T - 4, 32, 20] });
H_.add({ type: "dresser", tx: 5, ty: 13, base: 14 * T - 1, solid: [[0, 0], [1, 0]], hit: [5 * T, 13 * T - 10, 32, 26] });
H_.add({ type: "shelf", tx: 10, ty: 3, base: 4 * T, solid: [[0, 0]], hit: [10 * T, 3 * T - 24, 16, 40] });
const TV = H_.add({ type: "tv", tx: 12, ty: 3, base: 4 * T, solid: [[0, 0], [1, 0]], hit: [12 * T, 3 * T - 16, 32, 32] });
const PIANO = H_.add({ type: "piano", tx: 15, ty: 3, base: 4 * T, solid: [[0, 0], [1, 0]], hit: [15 * T, 3 * T - 14, 32, 30] });
H_.add({ type: "pianobench", tx: 15, ty: 4, base: 4 * T + 4 });
const SOFA = H_.add({ type: "sofa", tx: 11, ty: 7, base: 7 * T, solid: box2(4, 1), hit: [11 * T, 7 * T - 6, 64, 28] });
SOFA.over = (g) => g.drawImage(SPR.sofaBack, 11 * T, 7 * T + 6);
SOFA.overBase = 8 * T + 4;
const SOFA_SEATS = [11 * T + 12, 11 * T + 32, 11 * T + 52].map((x) => ({ pos: [x, 7 * T + 14], approach: [Math.floor(x / T), 8] }));
[[10, 13], [16, 13]].forEach(([x, y]) => H_.add({ type: "pot", tx: x, ty: y, base: (y + 1) * T - 1, solid: [[0, 0]], hit: [x * T, y * T - 12, 16, 28] }));
const FRIDGE = H_.add({ type: "fridge", tx: 18, ty: 3, base: 4 * T, solid: [[0, 0]], openT: 0, hit: [18 * T, 3 * T - 22, 16, 38] });
const STOVE = H_.add({ type: "stove", tx: 20, ty: 3, base: 4 * T, solid: [[0, 0]], on: false, hit: [20 * T, 3 * T - 8, 16, 24] });
H_.add({ type: "counter", tx: 19, ty: 3, base: 4 * T, solid: [[0, 0]], fruit: false });
H_.add({ type: "sink", tx: 21, ty: 3, base: 4 * T, solid: [[0, 0]], hit: [21 * T, 3 * T - 8, 16, 24] });
H_.add({ type: "counter", tx: 22, ty: 3, base: 4 * T, solid: [[0, 0]], fruit: true });
const TABLE = H_.add({ type: "table", tx: 19, ty: 5, base: 7 * T - 2, solid: box2(3, 2), hit: [19 * T, 5 * T - 4, 48, 34] });
const CHAIRS = [{ tile: [18, 5], face: "right" }, { tile: [22, 5], face: "left" }, { tile: [20, 7], face: "up" }];
CHAIRS.forEach((c) => H_.add({ type: "chair", face: c.face, tx: c.tile[0], ty: c.tile[1], base: c.tile[1] * T + 6 }));
const TUB = H_.add({ type: "tub", tx: 20, ty: 11, base: 11 * T, solid: box2(3, 2), hit: [20 * T, 11 * T - 4, 48, 34] });
TUB.over = (g) => drawTubFront(g);
TUB.overBase = 13 * T;
const TUB_SEAT = { approach: [19, 12], pos: [21 * T + 8, 12 * T + 6] };
H_.add({ type: "bathsink", tx: 18, ty: 10, base: 11 * T, solid: [[0, 0]], hit: [18 * T, 10 * T - 12, 16, 28] });
// things on the walls (drawn first, tappable)
const WINDOWS = [[3 * T + 1, 18, 14, 18], [6 * T + 1, 18, 14, 18], [14 * T, 17, 16, 20], [21 * T, 17, 16, 20]];
WINDOWS.forEach(([x, y, w, h]) => H_.add({ type: "window", tx: 0, ty: 0, base: 0, rect: [x, y, w, h], hit: [x, y, w, h] }));
H_.add({ type: "clock", tx: 0, ty: 0, base: 0, hit: [11 * T, 16, 16, 20] });
H_.add({ type: "frame", tx: 0, ty: 0, base: 0, hit: [16 * T - 8, 16, 16, 16] });
H_.add({ type: "mat", tx: 0, ty: 0, base: 0, hit: [12 * T, 13 * T, 16, 32] });
const RUG_SPOTS = [[11, 10], [13, 11], [15, 10], [12, 12], [14, 9]];
const BEDROOM_RUG = [[3, 9], [5, 8], [6, 10], [4, 10]];

// ======================================================================
// sprites (drawn once)
// ======================================================================
const SPR = {};
// soft shading for pixel art: an ordered dither picks between neighbouring tones
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);
const dither = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
function vnoise(x, y, s, seed = 0) {
  const xi = Math.floor(x / s), yi = Math.floor(y / s), fx = x / s - xi, fy = y / s - yi;
  const h = (a, b) => (hash(a + seed * 131, b + 977) % 1000) / 1000, sm = (t) => t * t * (3 - 2 * t);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1), u = sm(fx), v = sm(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const pickTone = (tones, v, x, y, spread = 0.9) => tones[clamp(Math.floor(v * tones.length + dither(x, y) * spread), 0, tones.length - 1)];
// a leafy blob made of circles, lit from the top left, with a darker outline
function canopy(g, blobs, tones, outline, seed = 1) {
  const W = g.canvas.width, H = g.canvas.height;
  const inside = (x, y) => blobs.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
  const top = Math.min(...blobs.map(([, cy, r]) => cy - r)), bot = Math.max(...blobs.map(([, cy, r]) => cy + r));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) { R(g, outline, x, y, 1, 1); continue; }
    let best = null, bv = -1;
    blobs.forEach((b) => { const d = b[2] - Math.hypot(x - b[0], y - b[1]); if (d > bv) { bv = d; best = b; } });
    const lx = (best[0] - x) / best[2], ly = (best[1] - y) / best[2];
    let v = 0.5 + lx * 0.3 + ly * 0.45 - ((y - top) / (bot - top)) * 0.25 + (vnoise(x, y, 3, seed) - 0.5) * 0.35;
    R(g, pickTone(tones, v, x, y), x, y, 1, 1);
  }
  // little leaf clusters catching the light
  for (let i = 0; i < 26; i++) {
    const x = hash(i, seed) % W, y = hash(seed, i) % H;
    if (inside(x, y) && inside(x + 2, y + 2) && inside(x - 1, y - 1)) pixels(g, ["x.x", ".x."], x - 1, y, { x: tones[tones.length - 1] });
  }
}
function trunk(g, x, y, h) {
  R(g, INK, x - 1, y, 10, h); R(g, "#a47652", x, y, 8, h - 1); R(g, "#c09068", x + 1, y, 2, h - 2); R(g, "#8a5f40", x + 6, y, 2, h - 1);
  for (let j = 3; j < h - 2; j += 4) R(g, "#8a5f40", x + 3, y + j, 2, 1);
  R(g, INK, x - 3, y + h - 2, 14, 2); R(g, "#a47652", x - 2, y + h - 2, 12, 1);
}
const TREE_BLOBS = [[16, 13, 12], [8, 21, 8], [24, 21, 8], [16, 25, 9], [11, 12, 7], [22, 14, 8]];
SPR.green = canvasOf(32, 44, (g) => { trunk(g, 12, 30, 14); canopy(g, TREE_BLOBS, ["#5f9f52", "#72b25f", "#86c970", "#9ad884", "#b2e59a"], "#3f6b3e", 3); });
SPR.apple = canvasOf(32, 44, (g) => { trunk(g, 12, 30, 14); canopy(g, TREE_BLOBS, ["#58984d", "#6aab59", "#7ec168", "#92d27c", "#a9e092"], "#3b663a", 7); });
SPR.cherry = canvasOf(32, 44, (g) => {
  trunk(g, 12, 30, 14);
  canopy(g, TREE_BLOBS, ["#e58aac", "#f2a2bf", "#fbb8cf", "#ffcadb", "#ffdfe9"], "#b85d80", 5);
  for (let i = 0; i < 22; i++) { const x = 3 + (hash(i, 9) % 26), y = 3 + (hash(9, i) % 28); if (g.getImageData(x, y, 1, 1).data[3]) R(g, i % 3 ? "#ffffff" : "#ff8fb4", x, y, 1, 1); }
});
SPR.bush = [0, 1, 2].map((v) => canvasOf(18, 15, (g) => {
  canopy(g, [[9, 9, 6], [5, 10, 4], [13, 10, 4], [9, 6, 4]], ["#5f9f52", "#72b25f", "#86c970", "#9ad884", "#b2e59a"], "#3f6b3e", 11 + v);
  const dots = v === 0 ? "#ff8fb4" : v === 1 ? "#fff6c9" : "#e2405a";
  [[5, 7], [11, 5], [13, 10], [7, 11], [9, 8]].forEach(([x, y], i) => { if (i < 4 + v % 2) { R(g, dots, x, y, 2, 2); R(g, "#fff", x, y, 1, 1); } });
}));
const APPLE_AT = [[9, 18], [20, 12], [24, 24], [13, 27], [17, 20]];

SPR.house = canvasOf(128, 112, (g) => {
  box(g, 6, 50, 116, 62, "#fff3df");
  for (let y = 56; y < 110; y += 6) R(g, "#f6e6cc", 7, y, 114, 1);
  for (let y = 0; y <= 52; y++) {
    const inset = Math.max(0, 22 - Math.floor(y / 2.3));
    R(g, INK, inset, y, 128 - inset * 2, 1);
    if (y > 0 && y < 52) R(g, Math.floor(y / 6) % 2 ? "#ef94b3" : "#f6a5c0", inset + 1, y, 126 - inset * 2, 1);
  }
  for (let y = 6; y < 50; y += 6) for (let x = 28 + (y % 12); x < 102; x += 12) R(g, "#e07fa2", x, y, 1, 5);
  R(g, "#fff1a8", 2, 49, 124, 2); R(g, INK, 2, 51, 124, 1);
  box(g, 94, 2, 12, 18, "#e98aa8"); box(g, 92, 0, 16, 4, "#f4a6c0");
  disc(g, 64, 26, 7, "#fff6c9"); pixels(g, HEART, 62, 25, { x: "#f48fb4" });
  [[14, 64], [86, 64]].forEach(([x, y]) => {
    box(g, x, y, 22, 17, "#bfe3ff"); R(g, INK, x + 11, y, 1, 17); R(g, INK, x, y + 8, 22, 1); R(g, "#fff", x + 2, y + 2, 3, 1); R(g, "#fff", x + 13, y + 2, 2, 1);
    box(g, x - 4, y - 1, 4, 19, "#ffb7d0"); box(g, x + 22, y - 1, 4, 19, "#ffb7d0");
    box(g, x - 2, y + 17, 26, 6, "#d9a77a");
    for (let i = 0; i < 6; i++) { R(g, "#86b35a", x + i * 4, y + 15, 2, 2); R(g, ["#f48fb4", "#ffd966", "#fff"][i % 3], x + i * 4 + (i % 2), y + 13, 2, 2); }
  });
  // doorway (the door itself is drawn on top unless it's open)
  box(g, 46, 72, 21, 40, "#ffd966"); R(g, "#5c3a2c", 48, 74, 17, 38);
  box(g, 42, 108, 29, 4, "#d9a77a");
  // porch lamp and flower pots
  box(g, 70, 76, 5, 7, "#fff6c9"); R(g, INK, 72, 74, 1, 2);
  [[34, 100], [104, 100], [112, 100]].forEach(([x, y]) => { box(g, x, y, 8, 8, "#e98a6a"); disc(g, x + 4, y - 2, 3, "#86c970"); R(g, "#f48fb4", x + 3, y - 4, 2, 2); });
});
SPR.houseDoor = canvasOf(17, 38, (g) => { R(g, "#f6a5c0", 0, 0, 17, 38); R(g, "#ef94b3", 2, 2, 13, 1); R(g, "#ef94b3", 2, 20, 13, 1); pixels(g, HEART, 6, 8, { x: "#fff" }); R(g, "#ffd966", 13, 22, 2, 2); });

SPR.shop = canvasOf(80, 64, (g) => {
  box(g, 3, 22, 74, 42, "#fff3df");
  for (let y = 28; y < 62; y += 6) R(g, "#f6e6cc", 4, y, 72, 1);
  box(g, 0, 10, 80, 7, "#f48fb4");
  box(g, 16, 0, 48, 12, "#fff1a8"); text(g, "SHOP", 23, 3, INK); pixels(g, HEART, 41, 4, { x: "#f48fb4" });
  for (let x = 0; x < 80; x++) {
    const seg = Math.floor(x / 8), c = seg % 2 ? "#fffaf2" : "#ffb7d0", sc = Math.round(Math.sin(((x % 8) / 8) * Math.PI) * 3);
    R(g, c, x, 17, 1, 7 + sc); R(g, INK, x, 24 + sc, 1, 1);
  }
  R(g, INK, 0, 17, 1, 8); R(g, INK, 79, 17, 1, 8);
  // windows full of goodies
  box(g, 6, 32, 24, 18, "#d7efff"); box(g, 50, 32, 24, 18, "#d7efff");
  R(g, "#d9a77a", 6, 44, 24, 1); R(g, "#d9a77a", 50, 44, 24, 1);
  pixels(g, [".xxxx.", "xyyyyx", "xxxxxx"], 9, 40, { x: "#c98a52", y: "#f0c27a" });   // bread
  pixels(g, [".g.", "rrr", "rwr", ".r."], 18, 40, { g: "#86b35a", r: "#e2405a", w: "#fff" });
  pixels(g, ["ww", "ww", "pw"], 24, 41, { w: "#fffaf2", p: "#f48fb4" });
  pixels(g, ["..r..", "wwwww", "ppppp", "ppppp"], 53, 39, { r: "#e2405a", w: "#fffaf2", p: "#ffb7d0" }); // cake
  pixels(g, [".p.", "ppp", ".x.", ".x."], 62, 39, { p: "#ffb7d0", x: "#e0a96d" });
  pixels(g, [".y.", "yyy", ".x.", ".x."], 67, 39, { y: "#fff1a8", x: "#e0a96d" });
  box(g, 6, 50, 24, 4, "#ffd966"); box(g, 50, 50, 24, 4, "#ffd966");
  // the doorway (door drawn on top unless it's open)
  box(g, 31, 34, 18, 30, "#f48fb4"); R(g, "#5c3a2c", 33, 36, 14, 28);
});
SPR.shopDoor = canvasOf(14, 28, (g) => { R(g, "#ffd966", 0, 0, 14, 28); box(g, 2, 3, 10, 8, "#d7efff"); text(g, "OPEN", -1, 13, INK); R(g, INK, 11, 17, 1, 1); R(g, "#fff", 11, 18, 2, 2); });
SPR.fountain = canvasOf(48, 48, (g) => {
  oval(g, 24, 30, 22, 15, "#e9e1f0"); oval(g, 24, 30, 18, 11, "#a9dcf3", "#c9bfd8");
  R(g, "#cbe9f8", 14, 26, 6, 1); R(g, "#cbe9f8", 30, 34, 5, 1);
  box(g, 21, 12, 7, 18, "#e9e1f0"); R(g, "#d5cbe0", 22, 13, 2, 16);
  oval(g, 24, 12, 8, 4, "#e9e1f0"); oval(g, 24, 11, 6, 2, "#a9dcf3", null);
});
SPR.cart = canvasOf(32, 34, (g) => {
  R(g, INK, 16, 2, 1, 16);
  for (let y = 0; y < 9; y++) { const w = Math.round(14 * Math.sqrt(1 - ((8 - y) / 9) ** 2)) + 1; for (let x = -w; x <= w; x++) R(g, Math.floor((x + 15) / 4) % 2 ? "#fff1a8" : "#fffaf2", 16 + x, y, 1, 1); R(g, INK, 16 - w - 1, y, 1, 1); R(g, INK, 16 + w + 1, y, 1, 1); }
  R(g, INK, 1, 9, 31, 1);
  box(g, 3, 16, 27, 13, "#ffb7d0"); R(g, "#fffaf2", 4, 17, 25, 3); for (let x = 5; x < 28; x += 6) R(g, "#ff9fbf", x, 21, 3, 7);
  pixels(g, [".p.", "ppp", ".x.", ".x."], 14, 22, { p: "#fff", x: "#e0a96d" });
  disc(g, 8, 30, 2, "#fff1a8"); disc(g, 24, 30, 2, "#fff1a8");
});
SPR.umbrella = canvasOf(32, 40, (g) => {
  R(g, INK, 15, 6, 2, 34);
  for (let y = 0; y < 12; y++) { const w = Math.round(15 * Math.sqrt(1 - ((11 - y) / 12) ** 2)); for (let x = -w; x <= w; x++) R(g, Math.floor((x + 16) / 5) % 2 ? "#ffb7d0" : "#fffaf2", 16 + x, y, 1, 1); R(g, INK, 16 - w - 1, y, 1, 1); R(g, INK, 16 + w, y, 1, 1); }
  R(g, INK, 0, 12, 32, 1);
});
SPR.swings = canvasOf(80, 42, (g) => {
  box(g, 2, 2, 76, 5, "#f48fb4");
  [[5, 1], [75, -1]].forEach(([x, s]) => { for (let y = 6; y < 42; y++) { const dx = Math.floor((y - 6) / 9) * s; R(g, INK, x - 1 - dx, y, 1, 1); R(g, "#f48fb4", x - dx, y, 2, 1); R(g, INK, x + 2 - dx, y, 1, 1); } });
});
SPR.slide = canvasOf(36, 48, (g) => {
  for (let y = 6; y < 44; y++) { R(g, INK, 2, y, 1, 1); R(g, INK, 9, y, 1, 1); }
  for (let y = 10; y < 44; y += 6) R(g, "#d9a77a", 3, y, 6, 2);
  box(g, 1, 4, 12, 4, "#ffd966");
  for (let i = 0; i < 34; i++) { const x = 10 + Math.floor(i * 0.7), y = 6 + i; R(g, INK, x, y, 9, 1); R(g, "#ffc4d6", x + 1, y, 7, 1); R(g, "#fff", x + 2, y, 1, 1); }
});
SPR.mailbox = canvasOf(12, 24, (g) => { R(g, INK, 5, 10, 2, 14); box(g, 0, 2, 12, 9, "#f48fb4"); R(g, "#fff", 2, 4, 4, 1); box(g, 9, 0, 3, 6, "#ffd966"); });
SPR.sign = canvasOf(16, 22, (g) => { R(g, INK, 7, 10, 2, 12); box(g, 0, 0, 16, 12, "#d9a77a"); R(g, "#c08a5e", 2, 3, 12, 1); R(g, "#c08a5e", 2, 6, 9, 1); pixels(g, HEART, 10, 6, { x: "#f48fb4" }); });
SPR.rock = canvasOf(14, 10, (g) => { disc(g, 7, 6, 5, "#d8d0e0"); R(g, "#ece6f2", 4, 3, 3, 1); R(g, "#bdb3c9", 8, 8, 3, 1); });
SPR.lamp = canvasOf(11, 30, (g) => { box(g, 4, 8, 3, 22, "#6b3a55"); box(g, 1, 2, 9, 8, "#fff6c9"); box(g, 0, 0, 11, 3, "#6b3a55"); box(g, 2, 27, 7, 3, "#6b3a55"); });
SPR.basket = canvasOf(16, 14, (g) => { R(g, INK, 3, 0, 10, 1); R(g, INK, 2, 1, 1, 5); R(g, INK, 13, 1, 1, 5); box(g, 0, 5, 16, 9, "#d9a77a"); R(g, "#c08a5e", 1, 8, 14, 1); R(g, "#c08a5e", 1, 11, 14, 1); R(g, "#ffc4d6", 2, 5, 12, 2); R(g, "#e2405a", 4, 3, 2, 2); R(g, "#fff1a8", 9, 3, 3, 2); });
SPR.bench = canvasOf(32, 16, (g) => { box(g, 0, 0, 32, 5, "#d9a77a"); box(g, 0, 6, 32, 5, "#e8b98c"); R(g, INK, 2, 11, 2, 5); R(g, INK, 28, 11, 2, 5); });
SPR.fenceH = canvasOf(16, 14, (g) => { box(g, 0, 4, 16, 3, "#fffaf2"); box(g, 0, 8, 16, 3, "#fffaf2"); [1, 11].forEach((x) => { box(g, x, 1, 4, 13, "#fffaf2"); R(g, "#f0e2d0", x + 1, 11, 2, 2); }); });
SPR.fenceV = canvasOf(16, 18, (g) => { box(g, 6, 0, 4, 18, "#fffaf2"); R(g, "#f0e2d0", 7, 14, 2, 3); });
SPR.cat = {
  sit: canvasOf(14, 12, (g) => pixels(g, ["..o.....o.....", ".owo...owo....", ".owwwwwwwo....", ".owkwwwkwo....", ".owwwpwwwo..o.", "..owwwwwo..owo", "..owwwwwwo.owo", "..owwgwwwwoowo", "..owwggwwwwwo.", "...ooooooooo.."], 0, 1, { o: INK, w: "#fffaf2", k: "#2b1b24", p: "#f39bb0", g: "#cfc6d6" })),
  walk: [0, 1].map((f) => canvasOf(16, 12, (g) => pixels(g, ["o.....o.........", "owo..owo........", "owwwwwwo.......o", "owkwwkwo......ow", "owwpwwwooooooow.", ".owwwwwwwwgggwo.", "..owwwwwwwggwwo.", "..owwwwwwwwwwwo.", f ? "..ow.ow...ow.ow." : "...owo.....owo..", f ? "..oo.oo...oo.oo." : "...ooo.....ooo.."], 0, 1, { o: INK, w: "#fffaf2", k: "#2b1b24", p: "#f39bb0", g: "#cfc6d6" }))),
  sleep: canvasOf(16, 9, (g) => pixels(g, ["...oo....oo.....", "..owwoooowwo....", ".owwwwwwwwwwoo..", "owkkwwwggwwwwwo.", "owwpwwwgggwwwwwo", ".owwwwwwwwwwwwwo", "..owwwwwwwwwwwo.", "...oooooooooooo."], 0, 1, { o: INK, w: "#fffaf2", k: "#2b1b24", p: "#f39bb0", g: "#cfc6d6" })),
};

// house things
SPR.bed = BED_LOOK.map((c) => canvasOf(32, 48, (g) => {
  box(g, 0, 0, 32, 16, c.wood); R(g, "#fff", 2, 2, 28, 1);
  pixels(g, HEART, 13, 5, { x: "#fff" });
  box(g, 1, 12, 30, 34, "#fffaf2");
  box(g, 5, 13, 22, 9, "#ffffff"); R(g, "#efe6f2", 6, 20, 20, 1);
  R(g, INK, 1, 46, 3, 2); R(g, INK, 28, 46, 3, 2);
}));
SPR.bedOver = BED_LOOK.map((c) => canvasOf(32, 48, (g) => {
  box(g, 1, 20, 30, 27, c.blanket);
  R(g, "#fffaf2", 2, 21, 28, 3); R(g, INK, 2, 24, 28, 1);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const x = 5 + i * 9 + (j % 2) * 4, y = 28 + j * 6;
    if (x > 26) continue;
    if (c.leaf === null) pixels(g, HEART, x - 2, y - 1, { x: c.dot });
    else { R(g, c.dot, x, y, 3, 3); R(g, c.leaf, x + 3, y + 1, 2, 1); if (c.leaf === "#fffaf2") R(g, "#ffd966", x + 1, y + 1, 1, 1); }
  }
}));
SPR.nightstand = canvasOf(16, 26, (g) => { box(g, 1, 12, 14, 14, "#e7c9a6"); R(g, INK, 2, 18, 12, 1); R(g, "#ffd966", 7, 15, 2, 1); R(g, "#ffd966", 7, 21, 2, 1); R(g, INK, 7, 6, 2, 6); box(g, 3, 0, 10, 7, "#ffc4d6"); R(g, "#fff", 5, 2, 2, 1); });
SPR.chest = canvasOf(32, 20, (g) => { box(g, 0, 4, 32, 16, "#ffd966"); box(g, 0, 0, 32, 7, "#f48fb4"); R(g, "#fff", 2, 2, 28, 1); box(g, 13, 6, 6, 5, "#fffaf2"); pixels(g, HEART, 13, 12, { x: "#f48fb4" }); R(g, "#86b35a", 4, 0, 3, 2); R(g, "#9db8ff", 24, 0, 4, 2); });
SPR.dresser = canvasOf(32, 26, (g) => { box(g, 0, 8, 32, 18, "#fffaf2"); R(g, INK, 1, 16, 30, 1); R(g, "#f48fb4", 7, 12, 4, 1); R(g, "#f48fb4", 21, 12, 4, 1); R(g, "#f48fb4", 14, 20, 4, 1); box(g, 9, 0, 14, 9, "#d7efff"); R(g, "#fff", 11, 2, 3, 1); R(g, "#ffb7d0", 2, 5, 4, 3); });
SPR.shelf = canvasOf(16, 40, (g) => {
  box(g, 0, 0, 16, 40, "#d9a77a");
  [3, 14, 25].forEach((y, j) => { R(g, "#c08a5e", 1, y + 9, 14, 2); for (let i = 0; i < 6; i++) R(g, ["#f48fb4", "#ffd966", "#9db8ff", "#86c970", "#fffaf2", "#ff9fbf"][(i + j * 2) % 6], 2 + i * 2, y + 2 + ((i + j) % 2), 2, 7 - ((i + j) % 2)); });
  R(g, INK, 1, 36, 14, 1);
});
SPR.tv = canvasOf(32, 32, (g) => {
  box(g, 0, 18, 32, 14, "#e7c9a6"); R(g, INK, 15, 20, 1, 11); R(g, "#ffd966", 12, 25, 2, 1); R(g, "#ffd966", 18, 25, 2, 1);
  R(g, INK, 10, 0, 1, 4); R(g, INK, 21, 0, 1, 4); R(g, INK, 11, 3, 1, 1); R(g, INK, 20, 3, 1, 1);
  box(g, 3, 4, 26, 16, "#ffb7d0"); R(g, "#ffd0de", 4, 5, 24, 1);
  R(g, "#f48fb4", 25, 9, 2, 2); R(g, "#ffd966", 25, 13, 2, 2);
});
SPR.piano = canvasOf(32, 30, (g) => {
  box(g, 0, 0, 32, 22, "#ffb7d0"); R(g, "#ffd0de", 2, 2, 28, 2); pixels(g, HEART, 13, 7, { x: "#fff" });
  box(g, 0, 18, 32, 7, "#fffaf2"); for (let x = 3; x < 31; x += 4) R(g, INK, x, 19, 1, 5); for (let x = 2; x < 30; x += 4) if ((x / 4) % 7 !== 2) R(g, "#2b1b24", x + 1, 19, 2, 3);
  R(g, INK, 2, 25, 2, 5); R(g, INK, 28, 25, 2, 5);
});
SPR.pianobench = canvasOf(24, 8, (g) => { box(g, 0, 0, 24, 5, "#f48fb4"); R(g, INK, 2, 5, 2, 3); R(g, INK, 20, 5, 2, 3); });
SPR.sofa = canvasOf(64, 20, (g) => {
  box(g, 0, 0, 64, 20, "#ffb7d0"); box(g, 2, 4, 60, 14, "#ffc9da");
  R(g, "#ffb7d0", 22, 5, 1, 12); R(g, "#ffb7d0", 42, 5, 1, 12); box(g, 0, 2, 6, 18, "#f48fb4"); box(g, 58, 2, 6, 18, "#f48fb4");
});
SPR.sofaBack = canvasOf(64, 14, (g) => { box(g, 0, 0, 64, 14, "#f48fb4"); R(g, "#ff9fbf", 2, 2, 60, 2); for (let x = 6; x < 60; x += 10) pixels(g, HEART, x, 6, { x: "#ffd0de" }); });
SPR.pot = canvasOf(16, 28, (g) => { box(g, 3, 18, 10, 10, "#e98a6a"); R(g, "#f4a58a", 4, 19, 8, 1); [[8, 12, 5], [4, 8, 3], [12, 6, 3], [8, 3, 3]].forEach(([x, y, r]) => disc(g, x, y, r, "#86c970")); disc(g, 7, 9, 2, "#a6de90", null); });
SPR.fridge = canvasOf(16, 38, (g) => { box(g, 0, 0, 16, 38, "#fff1a8"); R(g, INK, 1, 13, 14, 1); R(g, "#fff8d6", 2, 2, 2, 9); R(g, INK, 12, 5, 1, 6); R(g, INK, 12, 17, 1, 9); R(g, INK, 2, 36, 2, 2); R(g, INK, 12, 36, 2, 2); });
SPR.counter = canvasOf(16, 24, (g) => { box(g, 0, 6, 16, 18, "#fffaf2"); box(g, -1, 4, 18, 4, "#f48fb4"); R(g, INK, 7, 14, 2, 1); R(g, "#d7efff", 2, 10, 12, 1); });
SPR.stove = canvasOf(16, 24, (g) => { box(g, 0, 6, 16, 18, "#fffaf2"); box(g, -1, 4, 18, 4, "#d8d0e0"); box(g, 2, 12, 12, 9, "#e9e1f0"); R(g, "#2b1b24", 4, 14, 8, 5); R(g, "#ffd966", 3, 9, 2, 2); R(g, "#ffd966", 11, 9, 2, 2); box(g, 4, 0, 9, 6, "#9db8ff"); R(g, INK, 12, 2, 3, 1); });
SPR.sink = canvasOf(16, 24, (g) => { box(g, 0, 6, 16, 18, "#fffaf2"); box(g, -1, 4, 18, 4, "#f48fb4"); R(g, "#bfe3ff", 3, 5, 10, 2); R(g, INK, 7, 0, 2, 5); R(g, INK, 7, 0, 4, 1); R(g, "#ffd966", 7, 14, 2, 1); });
SPR.table = canvasOf(48, 34, (g) => {
  box(g, 0, 0, 48, 30, "#fffaf2");
  for (let y = 1; y < 29; y++) for (let x = 1; x < 47; x++) if (Math.floor(x / 4) % 2 || Math.floor(y / 4) % 2) R(g, "#ffc4d6", x, y, 1, 1);
  R(g, INK, 0, 30, 48, 1); R(g, "#e8b98c", 2, 31, 4, 3); R(g, "#e8b98c", 42, 31, 4, 3);
});
SPR.chair = canvasOf(16, 16, (g) => { box(g, 2, 4, 12, 9, "#ffb7d0"); R(g, "#ffd0de", 3, 5, 10, 2); R(g, INK, 3, 13, 2, 3); R(g, INK, 11, 13, 2, 3); });
SPR.tub = canvasOf(48, 34, (g) => { oval(g, 24, 15, 22, 13, "#fffaf2"); oval(g, 24, 13, 18, 9, "#bfe3ff", "#d8eef9"); R(g, INK, 39, 2, 3, 4); R(g, "#ffd966", 38, 5, 2, 2); });
SPR.bathsink = canvasOf(16, 28, (g) => { box(g, 2, 0, 12, 11, "#d7efff"); R(g, "#fff", 4, 2, 3, 1); box(g, 0, 14, 16, 14, "#fffaf2"); R(g, "#bfe3ff", 3, 16, 10, 3); R(g, INK, 7, 11, 2, 4); R(g, "#ffb7d0", 12, 12, 2, 3); });
SPR.tubFront = canvasOf(48, 34, (g) => {
  oval(g, 24, 15, 22, 13, "#fffaf2");
  g.clearRect(0, 0, 48, 17);
  R(g, INK, 3, 17, 42, 1); R(g, "#ffb7d0", 6, 21, 36, 2);
  [[8, 28], [37, 28]].forEach(([x, y]) => { R(g, INK, x - 1, y, 5, 6); R(g, "#ffd966", x, y + 1, 3, 4); });
});
function drawTubFront(g) {
  const x = 20 * T, y = 11 * T - 4;
  if (KIDS.some((k) => k.area === HOM && k.pose === "tub")) {
    for (let i = 0; i < 9; i++) disc(g, x + 8 + i * 4, y + 15 + ((i * 7) % 3), 2 + (i % 2), "#ffffff", "#cfe8f6");
    pixels(g, ["..yy.", ".yyyo", "yyyy.", ".yy.."], x + 33, y + 10 + Math.round(Math.sin(world.t * 3)), { y: "#ffd966", o: "#ff9a5a" });
  }
  g.drawImage(SPR.tubFront, x, y);
}

// ---------- the ground of each place (drawn once) ----------
function paintIsland(g) {
  const A = ISLAND, W = A.PW, H = A.PH;
  const land = (t) => t !== WATER && t !== DOCK;
  const greenish = (t) => t === GRASS || t === FLOWERS || t === TALL;
  // how far each pixel is from a kind of tile (only looks a few tiles around)
  const distTo = (px, py, test, reach = 3) => {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    let best = 99;
    for (let y = ty - reach; y <= ty + reach; y++) for (let x = tx - reach; x <= tx + reach; x++) {
      if (!test(A.at(x, y))) continue;
      const dx = Math.max(x * T - px, 0, px - (x * T + T - 1)), dy = Math.max(y * T - py, 0, py - (y * T + T - 1));
      best = Math.min(best, Math.hypot(dx, dy));
    }
    return best;
  };
  const P = {
    grass: ["#b6e198", "#c1e7a4", "#cbedaf", "#d4f1b9", "#ddf5c6"],
    tall: ["#86c26c", "#93cb79", "#9fd385", "#abdb91"],
    path: ["#e4c695", "#ebd1a3", "#f1dbb2", "#f6e5c3"],
    sand: ["#f0d7a3", "#f6e2b5", "#fbebc6", "#fff3d8"],
    wet: ["#ddbf88", "#e4ca97", "#ead3a4"],
    soil: ["#ad7f59", "#b98b63", "#c4976e"],
    water: ["#7cbfe2", "#88c8e8", "#95d0ee", "#a4daf3", "#b5e3f7"],
    plaza: ["#e6dbec", "#ece3f1", "#f2ebf6"],
  };
  const img = g.createImageData(W, H), data = img.data;
  const rgb = {}; const toRGB = (c) => (rgb[c] = rgb[c] || [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  const fc = (FOUNTAIN.tx + 1.5) * T, fcy = (FOUNTAIN.ty + 1.5) * T;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    let t = A.at(Math.floor(px / T), Math.floor(py / T));
    const n = vnoise(px, py, 40) * 0.6 + vnoise(px, py, 11, 2) * 0.4;
    // smooth curves for the coast and the pond instead of tile steps
    const u = px / T - 0.5, wob = (vnoise(px, py, 6, 8) - 0.5) * 3;
    const shoreY = (33 + Math.sin(u / 6 + 1) * 0.8) * T - 8 + wob, sandY = (30 + Math.sin(u / 5) * 0.7) * T - 8 + wob;
    const pe = Math.sqrt(((u - 43) / 5.2) ** 2 + ((py / T - 0.5 - 10) / 3.4) ** 2) + wob / 60;
    let coast = null;
    if (t !== DOCK && t !== PATH && py > 26 * T) { if (py >= shoreY) { t = WATER; coast = py - shoreY; } else if (py >= sandY) t = SAND; else if (t === SAND) t = GRASS; }
    if (t !== DOCK && Math.abs(u - 43) < 7 && py < 15 * T && py > 5 * T) { if (pe <= 1) { t = WATER; coast = (1 - pe) * 3.4 * T; } else if (t === WATER) t = GRASS; }
    let c;
    if (t === WATER || t === DOCK) {
      const d = coast ?? distTo(px, py, land, 4);
      if (d < 2.2 + Math.sin(px * 0.35 + py * 0.2) * 0.8) c = "#f2fbff";
      else if (d < 4 && (px + py * 3) % 7 === 0) c = "#e2f5fd";
      else c = pickTone(P.water, 1 - clamp(d / 52, 0, 1) * 0.85 + (n - 0.5) * 0.25, px, py);
    } else if (t === SAND) {
      const dw = py > 26 * T ? shoreY - py : distTo(px, py, (v) => v === WATER, 1), dg = py > 26 * T ? py - sandY + 2 : distTo(px, py, greenish, 1), jag = 2 + vnoise(px, py, 3, 5) * 3;
      if (dg < jag) c = pickTone(P.grass, n * 0.6 + 0.2, px, py);
      else if (dg < jag + 1.3) c = "#dcc38f";
      else if (dw < 9) c = pickTone(P.wet, dw / 9, px, py);
      else c = pickTone(P.sand, n + (Math.sin(px * 0.3 + py * 0.9 + Math.sin(py * 0.2) * 3) > 0.985 ? -0.2 : 0), px, py);
    } else if (t === PATH || t === SOIL) {
      const dg = distTo(px, py, greenish, 1), jag = 1.5 + vnoise(px, py, 3, 7) * 3;
      if (dg < jag) c = pickTone(P.grass, n * 0.5 + 0.15, px, py);
      else if (dg < jag + 1.3) c = t === PATH ? "#d6b783" : "#8f6646";
      else c = pickTone(t === PATH ? P.path : P.soil, n, px, py);
    } else if (t === PLAZA) {
      const dg = distTo(px, py, (v) => v !== PLAZA, 1);
      const row = Math.floor(py / 5), bx = (px + (row % 2) * 4) % 8, by = py % 5;
      const ring = Math.hypot(px - fc, py - fcy);
      if (dg < 3) c = dg < 1 ? "#c9b8d2" : "#ddd0e4";
      else if (bx === 0 || by === 0) c = "#d3c4db";
      else if (ring > 38 && ring < 47) c = by === 1 ? "#ffe4ee" : "#f6d3e0";
      else c = by === 1 ? "#f7f2fa" : by === 4 ? "#ddd0e4" : P.plaza[hash(Math.floor((px + (row % 2) * 4) / 8), row) % 3];
    } else {
      const inTall = TALL_PATCHES.some(([cx, cy, rx, ry]) => ((px - cx * T - 8) / (rx * T + 4 + vnoise(px, py, 4, 3) * 6)) ** 2 + ((py - cy * T - 8) / (ry * T + 4 + vnoise(px, py, 4, 4) * 6)) ** 2 <= 1);
      const tones = inTall ? P.tall : P.grass;
      const dw = Math.abs(u - 43) < 7 && py < 15 * T && py > 5 * T ? (pe - 1) * 3.4 * T : 9;
      c = dw < 3 ? "#a9d58e" : pickTone(tones, n, px, py);
    }
    const [r, gg, b] = toRGB(c), i = (py * W + px) * 4;
    data[i] = r; data[i + 1] = gg; data[i + 2] = b; data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);

  // details on top: grass tufts, pebbles, ripples, flowers
  for (let y = 0; y < A.H; y++) for (let x = 0; x < A.W; x++) {
    const t = A.at(x, y), px = x * T, py = y * T, h = hash(x, y), r = (i) => hash(x * 7 + i, y * 13 + i * 3);
    if (t === TALL || ((t === GRASS) && A.near(x, y, TALL))) {
      for (let i = 0; i < 9; i++) {
        const bx = px + (r(i) % 15), by = py + 1 + (r(i + 4) % 13);
        if (!TALL_PATCHES.some(([cx, cy, rx, ry]) => ((bx - cx * T - 8) / (rx * T + 2)) ** 2 + ((by - cy * T - 8) / (ry * T + 2)) ** 2 <= 1)) continue;
        pixels(g, ["x...x", ".x.x.", "..x.."], bx - 2, by, { x: i % 2 ? "#5f9f52" : "#6fae55" }); R(g, "#c3e8a8", bx, by + 2, 1, 1);
      }
    }
    if (t === GRASS || t === FLOWERS) {
      for (let i = 0; i < 3; i++) if (r(i) % 3) { const bx = px + (r(i) % 13), by = py + (r(i + 9) % 13); pixels(g, ["x.x", ".x."], bx, by, { x: "#9fd283" }); R(g, "#e6f8d4", bx, by - 1, 1, 1); }
      if (t === GRASS && h % 19 === 0 && y > 2) { const fx = px + 3 + (h % 9), fy = py + 3 + ((h >> 3) % 9), c = ["#f48fb4", "#ffd966", "#fff", "#ffb7d0", "#c9b6ff"][(h >> 2) % 5]; R(g, "#7fb865", fx, fy + 2, 1, 2); R(g, c, fx, fy - 1, 1, 1); R(g, c, fx - 1, fy, 3, 1); R(g, c, fx, fy + 1, 1, 1); R(g, "#ffe680", fx, fy, 1, 1); }
      if (t === GRASS && h % 41 === 3) { pixels(g, [".x.", "xxx", ".x."], px + 6, py + 7, { x: "#a9dc8f" }); }
      if (t === GRASS && h % 97 === 5 && y > 2) { R(g, INK, px + 6, py + 6, 5, 4); R(g, "#f48fb4", px + 7, py + 6, 3, 2); R(g, "#fff", px + 8, py + 6, 1, 1); R(g, "#fffaf2", px + 8, py + 8, 1, 2); } // a tiny mushroom
      if (t === FLOWERS) [[3, 3], [11, 4], [7, 9], [2, 12], [12, 12], [8, 1]].forEach(([ox, oy], i) => {
        const fx = px + ox + ((h >> i) % 2), fy = py + oy, c = ["#f48fb4", "#ffd966", "#ffb7d0", "#fff1a8", "#fff", "#c9b6ff"][(h + i) % 6];
        R(g, "#6fae55", fx, fy + 2, 1, 2); R(g, "#86c970", fx + 1, fy + 3, 1, 1);
        R(g, c, fx - 1, fy - 1, 3, 3); R(g, c, fx, fy - 2, 1, 5); R(g, c, fx - 2, fy, 5, 1);
        R(g, (h + i) % 6 === 1 ? "#f48fb4" : "#ffd966", fx, fy, 1, 1);
      });
    } else if (t === PATH) {
      for (let i = 0; i < 3; i++) if (r(i) % 2) { const sx = px + 2 + (r(i) % 11), sy = py + 2 + (r(i + 5) % 11); R(g, "#d4b582", sx, sy + 1, 3, 1); R(g, "#e2c697", sx, sy, 3, 1); R(g, "#fbefd8", sx, sy, 1, 1); }
    } else if (t === SAND) {
      if (h % 9 === 0) { R(g, "#ecd6a6", px + (h % 10), py + 5 + (h % 6), 3, 1); R(g, "#ecd6a6", px + (h % 10) + 3, py + 4 + (h % 6), 2, 1); }
      if (h % 53 === 0 && y > 30) pixels(g, ["..x..", "xxxxx", ".xxx.", "x...x"], px + 5, py + 6, { x: "#ff9a7a" }); // a starfish
      if (h % 13 === 1) R(g, "#e0d6cc", px + (h % 12), py + ((h >> 4) % 12), 2, 1);
    } else if (t === SOIL) {
      for (let j = 3; j < T; j += 5) R(g, "#9d7150", px, py + j, T, 1);
    } else if (t === WATER && y > 20 && h % 9 === 0) R(g, "#d7f1fc", px + (h % 10), py + ((h >> 3) % 12), 3, 1);
  }
  // dock planks
  A.all((x, y) => A.at(x, y) === DOCK).forEach(([x, y]) => {
    const px = x * T, py = y * T;
    box(g, px + 1, py, 14, T, "#e8b98c");
    for (let j = 3; j < T; j += 4) { R(g, "#c99a6d", px + 2, py + j, 12, 1); R(g, "#f2cba2", px + 2, py + j - 2, 12, 1); }
    R(g, INK, px + 1, py + T - 1, 3, 1); R(g, INK, px + 12, py + T - 1, 3, 1);
    R(g, "rgba(60,90,130,.25)", px + 1, py + T, 14, 2);
  });
  // stones around the pond
  A.all((x, y) => y < 15 && y > 5 && land(A.at(x, y)) && A.near(x, y, WATER) && A.at(x, y) !== DOCK).forEach(([x, y]) => {
    for (let i = 0; i < 3; i++) {
      const h = hash(x * 3 + i, y * 5), sx = x * T + 2 + (h % 11), sy = y * T + 2 + ((h >> 4) % 11);
      const pe = Math.hypot((sx / T - 0.5 - 43) / 5.2, (sy / T - 0.5 - 10) / 3.4);
      if (pe < 1.04 || pe > 1.16) continue;
      oval(g, sx, sy, 2 + (h % 2), 1 + (h % 2), "#e3dcea", "#b8adc6"); R(g, "#f6f2fa", sx - 1, sy - 1, 1, 1);
    }
  });
  lilies.forEach(([x, y]) => { const px = x * T + 3 + (hash(x, y) % 6), py = y * T + 4; oval(g, px + 3, py + 3, 4, 3, "#8fcf7a", "#5f9e52"); R(g, "#a4dc8e", px + 1, py + 2, 2, 1); R(g, "#7cbfe2", px + 3, py + 3, 3, 1); if (hash(y, x) % 3 === 0) { R(g, "#ffb7d0", px + 1, py, 3, 2); R(g, "#fff", px + 2, py, 1, 1); } });
  // soft shadows under everything that stands up
  const shadow = (cx, cy, rx, ry) => oval(g, Math.round(cx), Math.round(cy), rx, ry, "rgba(60,70,50,.17)", null);
  A.objs.forEach((o) => {
    const x = o.tx * T, y = o.ty * T;
    if (o.type === "tree") shadow(x + 19, y + 30, 15, 5);
    else if (o.type === "bush") shadow(x + 10, y + 14, 8, 3);
    else if (o.type === "house") { R(g, "rgba(60,70,50,.17)", x + 6, y + 112, 120, 5); R(g, "rgba(60,70,50,.17)", x + 122, y + 52, 6, 62); }
    else if (o.type === "shop") { R(g, "rgba(60,70,50,.17)", x + 4, y + 64, 76, 4); R(g, "rgba(60,70,50,.17)", x + 77, y + 24, 5, 42); }
    else if (o.type === "fountain") shadow(x + 27, y + 42, 22, 5);
    else if (o.type === "lamp") shadow(x + 9, y + 14, 5, 2);
    else if (["sign", "mailbox", "rock", "basket"].includes(o.type)) shadow(x + 9, y + 14, 6, 2);
    else if (o.type === "bench") R(g, "rgba(60,70,50,.17)", x + 2, y + 14, 30, 3);
    else if (o.type === "fence") R(g, "rgba(60,70,50,.13)", x, y + 15, 16, 2);
    else if (o.type === "swings") shadow(x + 40, y + 34, 36, 4);
    else if (o.type === "slide") shadow(x + 18, y + 46, 16, 4);
    else if (o.type === "cart" || o.type === "umbrella") shadow(x + 10, y + 14, 14, 3);
  });
  // sandbox frame
  box(g, 10 * T - 2, 23 * T - 2, 4 * T + 4, 3, "#d9a77a"); box(g, 10 * T - 2, 26 * T, 4 * T + 4, 3, "#c99568");
  box(g, 10 * T - 2, 23 * T - 2, 3, 3 * T + 5, "#d9a77a"); box(g, 14 * T - 1, 23 * T - 2, 3, 3 * T + 5, "#d9a77a");
  // picnic blanket in her gingham, with a little shadow
  const bx = PICNIC.x0 * T + 2, by = PICNIC.y0 * T + 2, bw = (PICNIC.x1 - PICNIC.x0 + 1) * T - 4, bh = (PICNIC.y1 - PICNIC.y0 + 1) * T - 4;
  R(g, "rgba(60,70,50,.17)", bx + 2, by + 2, bw + 1, bh + 1);
  R(g, INK, bx - 1, by - 1, bw + 2, bh + 2);
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) R(g, Math.floor(i / 4) % 2 && Math.floor(j / 4) % 2 ? "#ff9fbf" : Math.floor(i / 4) % 2 || Math.floor(j / 4) % 2 ? "#ffc4d6" : "#fffbe8", bx + i, by + j, 1, 1);
  // beach towel
  const tx = TOWEL.approach[0] * T + 2, ty = TOWEL.approach[1] * T + 3;
  R(g, "rgba(60,70,50,.15)", tx + 1, ty + 1, 30, 12);
  R(g, INK, tx - 1, ty - 1, 30, 12);
  for (let i = 0; i < 28; i++) R(g, Math.floor(i / 4) % 2 ? "#fff1a8" : "#ffb7d0", tx + i, ty, 1, 10);
  // the girls' garden plots: a little wooden frame and a name plaque each
  PLOTS.forEach((p, i) => {
    const x = p.x0 * T - 2, y = 3 * T - 2, w = 3 * T + 4, h = 2 * T + 4, c = ["#e2405a", "#ffd966", "#a5826a"][i];
    R(g, "rgba(60,70,50,.17)", x + 2, y + h, w, 3);
    [[x, y, w, 3], [x, y + h - 3, w, 3], [x, y, 3, h], [x + w - 3, y, 3, h]].forEach(([a, b, ww, hh]) => box(g, a, b, ww, hh, "#d9a77a"));
    R(g, INK, x + 1, y - 9, 1, 8); box(g, x - 3, y - 15, 11, 9, "#fffaf2"); R(g, c, x - 2, y - 14, 9, 2); text(g, ["M", "V", "T"][i], x + 1, y - 12 + 1, INK);
  });
  // the doormat outside the front door
  box(g, 25 * T + 1, 10 * T + 1, 14, 6, "#d9a77a"); pixels(g, HEART, 25 * T + 5, 10 * T + 2, { x: "#f48fb4" });
}
function paintHouse(g) {
  const A = HOME;
  R(g, "#3d2834", 0, 0, A.PW, A.PH);
  for (let y = 0; y < A.H; y++) for (let x = 0; x < A.W; x++) {
    const t = A.at(x, y), px = x * T, py = y * T, h = hash(x + 99, y + 7);
    if (t === FLOOR) {
      R(g, "#f4d6b4", px, py, T, T);
      for (let j = 0; j < 4; j++) { R(g, "#e7c49d", px, py + j * 4 + 3, T, 1); R(g, "#dfb98f", px + ((h >> (j * 4)) % 16), py + j * 4, 1, 3); }
    } else if (t === TILES) {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) R(g, (x * 2 + i + y * 2 + j) % 2 ? "#ffe1ec" : "#fffaf2", px + i * 8, py + j * 8, 8, 8);
    } else if (t === WALL) {
      if (y <= 2 && x > 0 && x < 23) {
        const kitchen = x >= 18;
        for (let i = 0; i < T; i++) R(g, kitchen ? ((px + i) % 8 < 1 ? "#d8eef0" : "#f2fbfb") : ((px + i) % 8 < 4 ? "#ffd6e2" : "#fff3f6"), px + i, py, 1, T);
        if (kitchen) for (let j = 0; j < T; j += 8) R(g, "#d8eef0", px, py + j, T, 1);
        if (y === 0) { R(g, "#b97a96", px, py, T, 7); R(g, INK, px, py + 7, T, 1); }
        if (y === 2) { R(g, "#fffaf0", px, py + 6, T, 10); R(g, "#e9c6d4", px, py + 6, T, 1); for (let i = 3; i < T; i += 6) R(g, "#f3dfe7", px + i, py + 8, 1, 7); R(g, INK, px, py + T - 1, T, 1); }
      } else {
        R(g, "#e7b9cc", px, py, T, T); R(g, "#f5d7e2", px + 1, py + 1, T - 2, T - 3);
        if (A.at(x, y - 1) !== WALL) R(g, INK, px, py, T, 1);
        if (A.at(x, y + 1) !== WALL) R(g, INK, px, py + T - 1, T, 1);
        if (A.at(x - 1, y) !== WALL) R(g, INK, px, py, 1, T);
        if (A.at(x + 1, y) !== WALL) R(g, INK, px + T - 1, py, 1, T);
      }
    }
  }
  // string lights over the beds
  for (let x = 1 * T; x < 9 * T; x++) { const y = 8 + Math.round(Math.sin((x / (3 * T)) * Math.PI) * -2 + 2); R(g, INK, x, y, 1, 1); }
  // initials over each bed
  BED_LOOK.forEach((c, i) => text(g, c.letter, [1, 4, 7][i] * T + 15, 24, c.dot));
  // rugs
  oval(g, 5 * T, 9 * T + 8, 46, 20, "#ffd0de"); oval(g, 5 * T, 9 * T + 8, 40, 15, "#ffe1ec", "#ff9fbf");
  for (let a = 0; a < 12; a++) pixels(g, HEART, 5 * T - 2 + Math.round(Math.cos(a / 12 * Math.PI * 2) * 30), 9 * T + 6 + Math.round(Math.sin(a / 12 * Math.PI * 2) * 10), { x: "#ff9fbf" });
  const rx = 11 * T + 4, ry = 9 * T + 4, rw = 5 * T - 8, rh = 4 * T - 8;
  R(g, INK, rx - 1, ry - 1, rw + 2, rh + 2);
  for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) R(g, i < 2 || j < 2 || i >= rw - 2 || j >= rh - 2 ? "#f48fb4" : Math.floor(i / 5) % 2 || Math.floor(j / 5) % 2 ? "#fff1a8" : "#fffbe8", rx + i, ry + j, 1, 1);
  box(g, 19 * T + 1, 12 * T + 2, 14, 12, "#ffb7d0");
  // the front door and doormat
  R(g, "#5c3a2c", 12 * T + 1, 14 * T, 14, T); R(g, "#ffd966", 12 * T, 14 * T, 1, T); R(g, "#ffd966", 13 * T - 1, 14 * T, 1, T);
  box(g, 12 * T, 13 * T + 4, T, 10, "#d9a77a"); pixels(g, HEART, 12 * T + 5, 13 * T + 7, { x: "#f48fb4" });
}
const GROUND = { [ISL]: canvasOf(ISLAND.PW, ISLAND.PH, paintIsland), [HOM]: canvasOf(HOME.PW, HOME.PH, paintHouse) };

// ======================================================================
// time and weather
// ======================================================================
const FIXED_HOUR = Q.has("hour") ? parseFloat(Q.get("hour")) : null;
function hourNow() { if (FIXED_HOUR !== null) return FIXED_HOUR; const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; }
const isNight = () => { const h = hourNow(); return h >= 22 || h < 7; };
const bedtime = () => { const h = hourNow(); return h >= 21.75 || h < 7; };
const day = () => !isNight();
const mealTime = () => { const h = hourNow(); return (h >= 7 && h < 9.5) || (h >= 12 && h < 13.5) || (h >= 18 && h < 19.75); };
const TINT = [[0, "#1c1240", 0.52], [5, "#2a1e50", 0.46], [6.5, "#ff9ab0", 0.16], [8, "#ffffff", 0], [17, "#ffffff", 0],
  [18.7, "#ff9a5a", 0.16], [19.8, "#d0507a", 0.24], [21, "#2a1e55", 0.44], [24, "#1c1240", 0.52]];
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function tintNow() {
  const h = hourNow();
  for (let i = 0; i < TINT.length - 1; i++) {
    const [h0, c0, a0] = TINT[i], [h1, c1, a1] = TINT[i + 1];
    if (h >= h0 && h < h1) { const t = (h - h0) / (h1 - h0), A = hex(c0), B = hex(c1); return { rgb: A.map((v, j) => Math.round(v + (B[j] - v) * t)), a: a0 + (a1 - a0) * t }; }
  }
  return { rgb: hex(TINT[0][1]), a: TINT[0][2] };
}
function weatherNow() {
  if (Q.has("weather")) return Q.get("weather");
  const r = hash(Math.floor(Date.now() / 3600000), 913) % 100; // the same weather for everyone, changing every hour
  return r < 12 ? "rain" : r < 32 ? "cloudy" : "sunny";
}
const world = { t: 0, parts: [], pa: ISL, treat: 0, ball: null, bubbles: [], party: 0, partyAt: [0, 0], partyArea: ISL, duckGoal: null,
  weather: weatherNow(), wet: 0, plates: 0, tvUser: false, drawings: 0, photo: false };
const raining = () => world.weather === "rain";
const outdoor = () => day() && !raining();

// ======================================================================
// critters
// ======================================================================
const butterflies = [...Array(6)].map((_, i) => ({ x: rand(60, I.PW - 60), y: rand(60, 440), vx: 0, vy: 0, a: rand(0, 6), c: ["#f48fb4", "#ffd966", "#fff", "#ffb7d0", "#b7d8ff", "#ffd966"][i] }));
const fireflies = [...Array(30)].map(() => ({ x: rand(20, I.PW - 20), y: rand(30, 470), a: rand(0, 6) }));
const pondTiles = I.all((x, y) => I.at(x, y) === WATER && y < 15);
const ducks = [0, 1, 2].map((i) => ({ x: (41 + i * 2) * T, y: (9 + (i % 2)) * T, vx: rand(-6, 6), vy: rand(-3, 3), small: i === 2 }));
const fish = [0, 1, 2].map(() => { const [x, y] = pick(pondTiles); return { x: x * T + 8, y: y * T + 8, a: rand(0, 6) }; });
const clouds = [...Array(5)].map((_, i) => ({ x: rand(-100, I.PW), y: rand(0, I.PH), r: rand(50, 90), v: rand(4, 8) }));
const cat = { x: 0, y: 0, dir: 1, path: [], state: "sit", t: 3, frame: 0, dist: 0, petBy: null, hop: 0, follow: null };
[cat.x, cat.y] = feetOf(24, 12);
function particle(type, x, y, color, n = 1, spread = 6, vy = -20, area = world.pa) {
  for (let i = 0; i < n; i++) world.parts.push({ type, area, x: x + rand(-spread, spread), y: y + rand(-spread / 2, spread / 2), vx: rand(-10, 10), vy: vy + rand(-8, 4), life: rand(0.9, 1.6), color });
}

// ======================================================================
// the girls
// ======================================================================
let sleepLog = {};
try { sleepLog = JSON.parse(store.get("sleep") || "{}") || {}; } catch {}
const saveSleep = () => store.set("sleep", JSON.stringify(sleepLog));
const overlay = $("#overlay");
const START = [[25, 16], [27, 16], [23, 16]];
// what each girl likes a bit more than the others
const ACT_NAME = { flowers: "picking flowers", myplot: "my garden", garden: "the strawberry patch", piano: "the piano", teaparty: "tea parties", fountain: "making wishes", read: "storybooks", swing: "the swings", slide: "the slide", tag: "playing tag",
  seesaw: "the seesaw", explore: "exploring", kite: "my kite", ball: "playing ball", bubbles: "bubbles", fishing: "fishing", puddles: "puddles", hide: "hide and seek", butterfly: "butterflies", kitty: "kitty", beach: "the beach",
  eat: "yummy food", picnic: "picnics", icecream: "ice cream", nap: "naps", bednap: "naps", tv: "cartoons", toys: "my toys", cook: "cooking", draw: "drawing", bath: "bubble baths", dressup: "dressing up", tagalong: "my big sisters",
  missmama: "mama & papa", chat: "chatting", stroll: "holding hands", sandbox: "sandcastles", shop: "the shop", sunbathe: "sunbathing", cloudgaze: "cloud watching", apples: "apples", window: "the window", mail: "the mail", pond: "the ducks" };
// ======================================================================
// the girls' minds. each one notices what's around her, has moods, feelings
// about her sisters, memories, things she has learned she likes, and goals she
// works on. she weighs every option for her own reasons and picks the best one,
// asks her sisters to play (they can say no), and changes her mind when
// something better comes up. who they are lives in PERSONALITY in kids.js.
// ======================================================================
const PERSONA = PERSONALITY;
const TRAITS = ["curious", "playful", "cuddly", "calm", "brave", "sociable", "generous", "creative", "mischief", "girly", "foodie", "shy"];
Object.values(PERSONA).forEach((P) => {
  P.traits = Object.assign(Object.fromEntries(TRAITS.map((t) => [t, 0.5])), P.traits);
  P.body = Object.assign({ hunger: 1, energy: 1, fun: 1, love: 1, clean: 1 }, P.body);
  P.acts = {};
  (P.loves || []).forEach((id) => { P.acts[id] = 0.6; });
  (P.meh || []).forEach((id) => { P.acts[id] = -0.4; });
  // short names the rest of the island uses
  P.bold = P.traits.brave; P.social = P.traits.sociable; P.shy = P.traits.shy; P.curious = P.traits.curious;
});
const NEEDS = ["hunger", "energy", "fun", "love", "clean"];
const MOODS = ["happy", "lonely", "grumpy", "excited", "proud"];
const MOOD_FACE = { happy: "🥰", lonely: "🥺", grumpy: "😤", excited: "🤩", proud: "😌" };
const MOOD_WORD = { happy: "happy", lonely: "lonely", grumpy: "grumpy", excited: "excited", proud: "proud of herself" };

// what each thing is like for her: how much it helps each need (below zero uses it up), which
// traits enjoy it, whether it needs a sister (with) or is nicer with one there (join), and if it's quiet.
const ACT_INFO = {
  explore:   { gain: { fun: 0.3, energy: -0.2 }, traits: { curious: 1, brave: 0.5 }, say: ["go exploring", "exploring"] },
  flowers:   { gain: { fun: 0.3, love: 0.1 }, traits: { generous: 0.7, calm: 0.4, creative: 0.4, girly: 0.6 }, join: true, quiet: true, say: ["pick flowers", "picking flowers"] },
  butterfly: { gain: { fun: 0.6, energy: -0.3 }, traits: { playful: 0.8, curious: 0.6 }, join: true, say: ["chase butterflies", "chasing butterflies"] },
  pond:      { gain: { fun: 0.4, energy: 0.1 }, traits: { calm: 0.7, curious: 0.4 }, join: true, quiet: true, say: ["go to the pond", "feeding the ducks"] },
  fishing:   { gain: { fun: 0.5 }, traits: { calm: 0.6, brave: 0.4, curious: 0.4 }, quiet: true, say: ["go fishing", "fishing"] },
  swing:     { gain: { fun: 0.8, energy: -0.1 }, traits: { playful: 0.7, girly: 0.3 }, join: true, say: ["go on the swings", "on the swings"] },
  slide:     { gain: { fun: 0.9, energy: -0.3 }, traits: { playful: 0.6, brave: 0.8 }, say: ["play on the slide", "on the slide"] },
  seesaw:    { gain: { fun: 0.8, love: 0.3 }, traits: { playful: 0.7, sociable: 0.6 }, with: true, say: ["go on the seesaw", "on the seesaw"] },
  sandbox:   { gain: { fun: 0.6, clean: -0.2 }, traits: { creative: 1, calm: 0.3 }, join: true, say: ["build a sandcastle", "building a sandcastle"] },
  beach:     { gain: { fun: 0.5 }, traits: { brave: 0.6, curious: 0.4 }, join: true, say: ["go to the beach", "at the beach"] },
  shells:    { gain: { fun: 0.3 }, traits: { generous: 0.7, curious: 0.6 }, join: true, say: ["look for shells", "looking for shells"] },
  sunbathe:  { gain: { energy: 0.5, fun: 0.2 }, traits: { calm: 0.9 }, quiet: true, say: ["lie in the sun", "sunbathing"] },
  picnic:    { gain: { hunger: 1, love: 0.2 }, traits: { foodie: 0.7, sociable: 0.4 }, join: true, say: ["have a picnic", "having a picnic"] },
  shop:      { gain: { hunger: 0.9, fun: 0.2 }, traits: { foodie: 0.6, curious: 0.3 }, say: ["go to the shop", "shopping"] },
  icecream:  { gain: { hunger: 0.7, fun: 0.4 }, traits: { foodie: 1, playful: 0.3 }, join: true, say: ["get ice cream", "eating ice cream"] },
  apples:    { gain: { hunger: 0.7 }, traits: { foodie: 0.5, brave: 0.3 }, say: ["pick an apple", "picking apples"] },
  garden:    { gain: { fun: 0.3, clean: -0.1 }, traits: { calm: 0.5, generous: 0.5, creative: 0.3 }, join: true, quiet: true, say: ["look after the strawberry patch", "in the strawberry patch"] },
  myplot:    { gain: { fun: 0.3, love: 0.1 }, traits: { creative: 0.6, calm: 0.5, generous: 0.5 }, say: ["look after my garden", "in her garden"] },
  bench:     { gain: { energy: 0.5 }, traits: { calm: 0.8 }, join: true, quiet: true, say: ["sit on the bench", "resting"] },
  nap:       { gain: { energy: 1 }, traits: { calm: 0.5, cuddly: 0.3 }, quiet: true, say: ["have a nap", "napping"] },
  cloudgaze: { gain: { energy: 0.4, fun: 0.3 }, traits: { calm: 0.8, creative: 0.5 }, quiet: true, say: ["watch the clouds", "watching clouds"] },
  kite:      { gain: { fun: 0.8, energy: -0.2 }, traits: { playful: 0.8, brave: 0.6 }, say: ["fly my kite", "flying her kite"] },
  fountain:  { gain: { fun: 0.3, love: 0.2 }, traits: { girly: 0.6, generous: 0.5, calm: 0.3 }, join: true, say: ["make a wish", "making a wish"] },
  kitty:     { gain: { love: 0.6, fun: 0.4 }, traits: { cuddly: 1, generous: 0.3 }, say: ["pet kitty", "petting kitty"] },
  puddles:   { gain: { fun: 1, clean: -0.6 }, traits: { playful: 1, mischief: 0.8, brave: 0.6 }, join: true, say: ["jump in puddles", "jumping in puddles"] },
  chat:      { gain: { love: 0.9, fun: 0.2 }, traits: { sociable: 1, cuddly: 0.5 }, with: true, say: ["chat", "chatting"] },
  tag:       { gain: { fun: 1, love: 0.2, energy: -0.5 }, traits: { playful: 1, mischief: 0.6, brave: 0.4 }, with: true, say: ["play tag", "playing tag"] },
  hide:      { gain: { fun: 0.9, love: 0.2 }, traits: { mischief: 0.9, playful: 0.6 }, with: true, say: ["play hide and seek", "playing hide and seek"] },
  stroll:    { gain: { love: 0.8, fun: 0.2 }, traits: { cuddly: 1, sociable: 0.5 }, with: true, say: ["go for a walk holding hands", "holding hands"] },
  teaparty:  { gain: { love: 0.7, fun: 0.5, hunger: 0.2 }, traits: { girly: 1, sociable: 0.6 }, with: true, say: ["have a tea party", "having a tea party"] },
  sign:      { gain: { fun: 0.1 }, traits: { curious: 0.5 }, quiet: true, say: ["read the sign", "reading the sign"] },
  mail:      { gain: { fun: 0.2 }, traits: { curious: 0.5, generous: 0.4 }, quiet: true, say: ["check the mail", "checking the mail"] },
  ball:      { gain: { fun: 0.9, energy: -0.3 }, traits: { playful: 1, brave: 0.3 }, join: true, say: ["play ball", "playing ball"] },
  bubbles:   { gain: { fun: 0.9 }, traits: { playful: 0.8, mischief: 0.4 }, join: true, say: ["pop bubbles", "popping bubbles"] },
  idle:      { gain: { energy: 0.1 }, traits: { calm: 0.6, creative: 0.4 }, quiet: true, say: ["daydream", "daydreaming"] },
  tagalong:  { gain: { love: 1 }, traits: { cuddly: 1, sociable: 0.6, shy: 0.6 }, say: ["go be with my sisters", "with her sisters"] },
  missmama:  { gain: { love: 0.7 }, traits: { cuddly: 1, shy: 0.6 }, quiet: true, say: ["wait for mama at the window", "waiting for mama"] },
  dressup:   { gain: { fun: 0.5, love: 0.1 }, traits: { girly: 1, creative: 0.5 }, say: ["dress up", "dressing up"] },
  eat:       { gain: { hunger: 1.2 }, traits: { foodie: 0.6, calm: 0.3 }, join: true, say: ["eat something yummy", "eating"] },
  cook:      { gain: { fun: 0.5, hunger: 0.3 }, traits: { creative: 0.7, generous: 0.8 }, say: ["make pancakes", "cooking"] },
  tv:        { gain: { fun: 0.6, energy: 0.3 }, traits: { calm: 0.6, cuddly: 0.4 }, join: true, quiet: true, say: ["watch cartoons", "watching cartoons"] },
  piano:     { gain: { fun: 0.6 }, traits: { creative: 1, calm: 0.5, girly: 0.4 }, say: ["play the piano", "playing the piano"] },
  read:      { gain: { fun: 0.4, energy: 0.2 }, traits: { calm: 0.9, curious: 0.5 }, quiet: true, say: ["read a storybook", "reading"] },
  draw:      { gain: { fun: 0.5, love: 0.2 }, traits: { creative: 1, generous: 0.5, calm: 0.4 }, quiet: true, say: ["draw a picture", "drawing"] },
  toys:      { gain: { fun: 0.7 }, traits: { playful: 0.6, creative: 0.5, cuddly: 0.3 }, say: ["play with my toys", "playing with her toys"] },
  bath:      { gain: { clean: 1.5, energy: 0.2, fun: 0.2 }, traits: { calm: 0.5, girly: 0.4 }, say: ["have a bubble bath", "in the bath"] },
  bednap:    { gain: { energy: 1.2 }, traits: { calm: 0.5, cuddly: 0.5 }, quiet: true, say: ["nap in my bed", "napping"] },
  window:    { gain: { fun: 0.1 }, traits: { calm: 0.6, curious: 0.3 }, quiet: true, say: ["look out the window", "at the window"] },
};
// roughly where each thing happens, so far-away things are a little less tempting
const PLACE = {
  flowers: [ISL, 7, 6], butterfly: [ISL, 10, 10], pond: [ISL, 40, 12], fishing: [ISL, 43, 10], swing: [ISL, 6, 19], slide: [ISL, 10, 20], seesaw: [ISL, 6, 23], sandbox: [ISL, 11, 24],
  beach: [ISL, 20, 31], shells: [ISL, 20, 30], sunbathe: [ISL, 14, 31], picnic: [ISL, 41, 18], shop: [ISL, 34, 20], icecream: [ISL, 31, 31], apples: [ISL, 34, 6], garden: [ISL, 17, 8],
  bench: [ISL, 22, 22], cloudgaze: [ISL, 43, 24], kite: [ISL, 43, 24], fountain: [ISL, 26, 20], puddles: [ISL, 25, 15], sign: [ISL, 23, 11], mail: [ISL, 28, 11], explore: [ISL, 25, 15],
  eat: [HOM, 20, 6], cook: [HOM, 20, 4], tv: [HOM, 12, 8], piano: [HOM, 15, 4], read: [HOM, 12, 10], draw: [HOM, 20, 6], toys: [HOM, 4, 9], bath: [HOM, 19, 12], bednap: [HOM, 4, 6],
  window: [HOM, 14, 3], dressup: [HOM, 5, 12], missmama: [HOM, 14, 3], teaparty: [HOM, 20, 6],
};
const NEED_WHY = { hunger: ["tummy's rumbling", "my tummy's rumbling…"], energy: ["needs a rest", "i need a little rest…"], fun: ["bored", "i'm bored hehe"], love: ["wants some love", "i want cuddles…"], clean: ["feeling grubby", "i'm all grubby"] };
const TRAIT_WHY = {
  curious: ["curious", "i wonder what's there…"], playful: ["feeling playful", "i feel playful!"], cuddly: ["feeling cuddly", "i feel cuddly ♡"], calm: ["wants something quiet", "something quiet…"],
  brave: ["feeling brave", "i'm feeling brave!"], sociable: ["wants company", "i want company!"], generous: ["wants to make someone happy", "i want to make someone happy ♡"],
  creative: ["wants to make something", "i want to make something!"], mischief: ["feeling cheeky", "hehe i feel cheeky"], girly: ["feeling like a princess", "princess time 👑"],
  foodie: ["loves yummy things", "yummy things!"], shy: ["feeling shy", "…teddy feels shy"],
};
const YES = (k) => PERSONA[k.id].yes, NO = (k) => PERSONA[k.id].no;
// a little taste of her own for each thing, so the three grow apart from each other
const strHash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const taste = (k, id) => (strHash(k.id + ":" + id) - 0.5) * 0.5;

const bedtimeFor = (k) => { const h = hourNow(); return h >= PERSONA[k.id].bedtime || h < 7; };
function initMind(k) {
  const P = PERSONA[k.id];
  k.speed = P.speed;
  k.mind = { likes: { ...P.acts }, crops: { ...P.crops }, planted: {}, memories: [], goal: null, paused: null, lastGoal: null, goalT: 0, dreams: 0, thought: "", why: "just woke up",
    aff: {}, mood: { happy: 0.4, lonely: 0, grumpy: 0, excited: 0, proud: 0 }, history: [], cur: null, rematch: null, rethinkT: rand(3, 6), pendingWith: null };
}
function remember(k, text) { const m = k.mind.memories; if (m[0]?.text === text) return; m.unshift({ t: Date.now(), text }); m.length = Math.min(m.length, 30); }
function think(k, text, ms = 2300) { k.mind.thought = text; say(k, text, ms, true); }
const likeOf = (k, id) => k.mind.likes[id] ?? 0;
// the three sisters love each other equally, always: no favourites, no falling out
const close = () => 0.9;
function bondAdd() {}
// and they share their time fairly: she goes to whichever sister she's been with least lately
const together = (k, o) => k.mind.together?.[o.id] || 0;
const fairest = (k, list) => list.slice().sort((a, b) => together(k, a) - together(k, b) + rand(-5, 5))[0];
function bond(a, b, v) { bondAdd(a, b, v); bondAdd(b, a, v); }
const moodOf = (k) => MOODS.reduce((a, b) => (k.mind.mood[b] > k.mind.mood[a] ? b : a), "happy");
function feel(k, text, moods = {}) {
  for (const key in moods) k.mind.mood[key] = clamp((k.mind.mood[key] || 0) + moods[key], 0, 1);
  if (text) remember(k, text);
}
function moodFace(k) {
  if (k.asleep) return "😴";
  if (k.needs.energy < 20) return "🥱";
  if (k.needs.hunger < 25) return "😋";
  const m = moodOf(k);
  return k.mind.mood[m] > 0.3 ? MOOD_FACE[m] : "😊";
}
const free = (o) => !busy(o) && INTERRUPTIBLE.includes(o.act) && !o.seatFrom;

// ---------- weighing an option, for her own reasons ----------
function partnersFor(k) {
  const g = k.mind.goal;
  return others(k).filter((o) => o.area === k.area && free(o)).sort((a, b) => (g?.with === b.id) - (g?.with === a.id) || together(k, a) - together(k, b));
}
function goalActs(k) { const g = k.mind.goal; return g ? g.acts || GOALS[g.id]?.acts || [] : []; }
function score(k, id, partner = null, asked = false) {
  const info = ACT_INFO[id], m = k.mind, n = k.needs, tr = PERSONA[k.id].traits, parts = {};
  let needTop = null, traitTop = null, friend = null;
  // her needs: the emptier one is, the more she wants what fills it
  let need = 0, nb = 0;
  for (const key of NEEDS) {
    const g = info.gain[key] || 0;
    if (!g) continue;
    const lack = (100 - n[key]) / 100, v = g > 0 ? g * lack * lack * 4 : g * lack * 2;
    need += v;
    if (v > nb) { nb = v; needTop = key; }
  }
  parts.need = need;
  // who she is
  let self = 0, sum = 0, tb = 0;
  for (const [t, a] of Object.entries(info.traits)) { const v = tr[t] * a; self += v; sum += a; if (v > tb) { tb = v; traitTop = t; } }
  parts.self = (sum ? self / sum : 0.5) * 1.4;
  // shy teddy doesn't like to start games, but says yes when her sisters ask
  if (info.with && !asked) parts.self -= tr.shy * 0.6;
  // what she has learned she likes
  parts.like = (m.likes[id] || 0) * 1.1;
  // how she feels right now
  const mo = m.mood;
  parts.mood = mo.lonely * (info.with ? 1.5 : info.join ? 0.5 : id === "tagalong" || id === "missmama" ? 1.2 : -0.3) + mo.excited * (info.gain.fun || 0) * 0.8
    + mo.grumpy * (info.quiet ? 0.6 : info.with ? -0.8 : 0) + mo.happy * (info.with ? 0.3 : 0);
  // her sisters
  if (info.with) {
    friend = partner || partnersFor(k)[0] || null;
    parts.friend = friend ? (close(k, friend) - 0.3) * 1.2 * (0.5 + tr.sociable) : -3;
  } else if (info.join) {
    const there = others(k).filter((o) => o.act === id && o.area === k.area).sort((a, b) => close(k, b) - close(k, a))[0];
    if (there) { friend = there; parts.friend = close(k, there) * (0.4 + tr.sociable); }
  }
  // she wants to be wherever her sisters are
  const spot = PLACE[id], awake = others(k).filter((o) => !o.asleep && !o.hidden);
  const area = spot ? spot[0] : ACTS[id]?.area || k.area;
  let tog = awake.filter((o) => o.area === area).length * 0.5 + awake.filter((o) => o.act === id).length * 1.1;
  if (spot) tog += awake.filter((o) => o.area === area && Math.hypot(o.x - spot[1] * T, o.y - spot[2] * T) < 10 * T).length * 0.9;
  if (tog) parts.together = tog * (0.6 + tr.sociable * 0.4 + mo.lonely);
  // what she's working towards
  const g = m.goal;
  if (g && goalActs(k).includes(id) && (!g.with || !info.with || !friend || friend.id === g.with)) parts.goal = 1.6;
  // she gets bored of doing the same thing
  const times = m.history.filter((h) => h === id).length;
  parts.bored = -(times * 0.35 + (m.history[m.history.length - 1] === id ? 0.5 : 0)) * (0.6 + tr.curious * 0.8);
  // far away is less tempting, more so when she's tired (and brave vimi doesn't mind)
  const pl = PLACE[id];
  if (pl) {
    const tiles = pl[0] !== k.area ? 26 : Math.hypot(pl[1] * T - k.x, pl[2] * T - k.y) / T;
    parts.far = -(tiles / 30) * (0.4 + (100 - n.energy) / 100) * (1.2 - tr.brave * 0.5);
  }
  // weather and time
  const out = ACTS[id]?.area === ISL;
  if (out && raining() && id !== "puddles") parts.weather = -1.4 * (1 - tr.brave * 0.4);
  if (hourNow() >= 20 && !bedtimeFor(k)) parts.weather = (parts.weather || 0) + (out ? -0.8 : 0.4);
  if (isNight() && out) parts.weather = (parts.weather || 0) - 2.5 * (1 - PERSONA[k.id].traits.brave * 0.3); // it's dark out there
  // exciting things happening right now
  let w = 0;
  if (id === "ball" || id === "bubbles") w += 2.5 * (0.5 + tr.playful);
  if (id === "picnic" && world.treat) w += 1.5;
  if (id === "eat") w += (world.plates > 0 ? 0.8 : 0) + (mealTime() ? 0.9 : 0);
  if (id === "cook" && mealTime()) w += 0.6;
  if (id === "tv" && world.tvUser) w += 1.2;
  if (id === "bath" && hourNow() >= 19.5 && n.clean < 85) w += 0.8;
  if (id === "myplot") { const p = plotOf(k).tiles; w += p.filter((t) => t.crop && t.g >= 1).length * 0.25 + p.filter((t) => !t.crop).length * 0.08 + (raining() ? 0 : p.filter((t) => t.crop && t.g < 1 && t.wet < 0.2).length * 0.15); }
  if (id === "garden" && PLANTS.some((p) => p.g >= 3)) w += 0.4;
  if (id === "kitty" && cat.state === "nap") w -= 0.3;
  if (w) parts.world = w;
  const total = Object.values(parts).reduce((s, v) => s + v, 0);
  return { id, total, parts, needTop, traitTop, friend };
}
// why she chose it: the two biggest reasons, about her and in her own words
function reasons(k, c) {
  const why = [], add = (v, third, first) => { if (v > 0.25 && third) why.push([v, third, first || third]); };
  add(c.parts.need, NEED_WHY[c.needTop]?.[0], NEED_WHY[c.needTop]?.[1]);
  add(c.parts.self - 0.5, TRAIT_WHY[c.traitTop]?.[0], TRAIT_WHY[c.traitTop]?.[1]);
  add(c.parts.like, likeOf(k, c.id) > 0.45 ? "loves it" : "likes it", likeOf(k, c.id) > 0.45 ? "i love it ♡" : "i like it");
  if (c.friend) add(c.parts.friend, ACT_INFO[c.id].with ? `wants to be with ${c.friend.name}` : `${c.friend.name} is there`, ACT_INFO[c.id].with ? `i want to be with ${c.friend.name}` : `${c.friend.name} is there!`);
  if (k.mind.goal) add(c.parts.goal, `wants to ${k.mind.goal.text.replace(/\bmy\b/g, "her")}`, `i want to ${k.mind.goal.text}`);
  add(c.parts.mood, `feeling ${MOOD_WORD[moodOf(k)]}`, `i feel ${MOOD_WORD[moodOf(k)].replace("herself", "myself")}`);
  add(c.parts.world, "ooh!", "ooh!");
  return why.sort((a, b) => b[0] - a[0]).slice(0, 2);
}
// pick the best, with only a tiny wobble between near-equal options
function bestOf(options) {
  const top = Math.max(...options.map((o) => o.total)), ws = options.map((o) => Math.exp((o.total - top) / 0.25));
  let r = Math.random() * ws.reduce((s, w) => s + w, 0);
  for (let i = 0; i < options.length; i++) if ((r -= ws[i]) <= 0) return options[i];
  return options[0];
}
// she asks a sister to play; the sister decides for herself
function ask(p, k, id) {
  const now = ACT_INFO[p.act] ? score(p, p.act).total + 0.5 : 0.5;
  const want = score(p, id, k, true).total + close(p, k) * 0.8 + 0.4 + (p.mind.goal?.with === k.id ? 1 : 0) + PERSONA[p.id].traits.generous * 0.3;
  if (want + rand(-0.2, 0.2) >= now) {
    later(() => say(p, pick(YES(p)), 1300), 500);
    p.mind.pendingWith = k;
    p.mind.why = `${ACT_INFO[id].say[0]} with ${k.name} · ${k.name} asked & she loves her sisters`;
    return true;
  }
  const no = p.needs.energy < 30 ? "i'm too sleepy…" : p.needs.hunger < 30 ? "i'm hungry…" : pick([...NO(p), `not now, i'm ${ACT_INFO[p.act]?.say[1] || "busy"}`]);
  later(() => say(p, no, 1600), 500);
  later(() => say(k, k.id === "teddy" ? pick(["aww…", "…okay", "*sniff*"]) : k.id === "rose" ? pick(["that's okay ♡ maybe later", "okay, no worries"]) : pick(["aww okay…", "hmph!", "fiiine"]), 1300), 1900);
  remember(k, `i asked ${p.name} to ${ACT_INFO[id].say[0]} but she said no`);
  feel(k, null, { grumpy: 0.05 * (1 - PERSONA[k.id].traits.calm * 0.5), lonely: 0.05 + PERSONA[k.id].traits.shy * 0.06 });
  bondAdd(k, p, -0.02);
  return false;
}

// ---------- deciding what to do next ----------
function chooseActivity(k) {
  const m = k.mind;
  if (ACTS.sleep.w(k) > 0) { m.why = "it's bedtime 🌙"; doActivity(k, "sleep"); return; }
  checkGoal(k);
  if (m.announce) { m.announce = false; think(k, `today i want to ${m.goal.text}`); }
  let options = Object.keys(ACT_INFO).filter((id) => ACTS[id] && ACTS[id].w(k) > 0).map((id) => score(k, id));
  // once in a while she just follows a whim (curious vimi more than the others)
  if (options.length && Math.random() < 0.02 + PERSONA[k.id].traits.curious * 0.03) {
    const c = pick(options.filter((o) => !ACT_INFO[o.id].with && o.id !== "idle"));
    if (c) { m.why = `${ACT_INFO[c.id].say[0]} · just felt like it ✨`; doActivity(k, c.id); if (Math.random() < 0.5) think(k, `ooh! ${ACT_INFO[c.id].say[0]}, why not ✨`); return; }
  }
  const go = (c) => {
    const why = reasons(k, c), info = ACT_INFO[c.id];
    m.why = `${info.say[0]}${why.length ? " · " + why.map((w) => w[1]).join(" & ") : ""}`;
    doActivity(k, c.id);
    if (why.length && Math.random() < 0.3 && !k.bubble.classList.contains("show")) think(k, `${info.say[0]}… ${why[0][2]}`);
  };
  for (let tries = 0; tries < 4 && options.length; tries++) {
    const c = bestOf(options);
    if (!ACT_INFO[c.id].with) return go(c);
    if (c.id === "hide") {
      const yes = others(k).filter((o) => o.area === ISL && free(o)).filter((o) => ask(o, k, "hide"));
      if (yes.length) { k.wantHiders = yes; return go(c); }
    } else {
      const p = partnersFor(k)[0];
      if (p && ask(p, k, c.id)) { k.wantWith = p; return go({ ...c, friend: p }); }
    }
    options = options.filter((o) => o !== c);
  }
  m.why = "daydreaming ☁️";
  doActivity(k, "idle");
}
// every few seconds she looks around and may change her mind
function rethink(k) {
  if (k.held || k.patted || k.spin > 0 || k.asleep || k.seatFrom || k.hidden || !k.step || !INTERRUPTIBLE.includes(k.act) || !ACT_INFO[k.act]) return;
  const cur = score(k, k.act).total + 1.5; // she's already into it
  const better = Object.keys(ACT_INFO).filter((id) => id !== k.act && !ACT_INFO[id].with && ACTS[id] && ACTS[id].w(k) > 0).map((id) => score(k, id)).sort((a, b) => b.total - a.total)[0];
  if (!better || better.total <= cur) return;
  endStep(k); k.steps = []; k.path = [];
  const why = reasons(k, better);
  k.mind.why = `${ACT_INFO[better.id].say[0]} · changed her mind${why[0] ? " & " + why[0][1] : ""}`;
  doActivity(k, better.id);
  if (Math.random() < 0.5) think(k, `actually… ${ACT_INFO[better.id].say[0]}!`);
}

// ---------- goals: things she wants to get done ----------
function socialGoal(k) {
  const tr = PERSONA[k.id].traits, until = Date.now() + 6 * 60e3;
  for (const o of others(k)) {
    if ((o.mind.mood.lonely > 0.5 || o.mind.mood.grumpy > 0.5) && close(k, o) > 0.55 && !o.asleep && tr.shy < 0.7)
      return { id: "cheer", social: true, acts: tr.cuddly > 0.6 ? ["stroll", "chat", "teaparty"] : ["chat", "tag"], with: o.id, text: `cheer up ${o.name}`, until };
  }
  if (k.mind.rematch) { const o = KIDS.find((x) => x.id === k.mind.rematch); k.mind.rematch = null; if (o) return { id: "rematch", social: true, acts: ["tag"], with: o.id, text: `get ${o.name} back at tag`, until }; }
  return null;
}
function checkGoal(k) {
  const m = k.mind, g = m.goal;
  if (g?.social) {
    if (g.done) { feel(k, `i did it: ${g.text} ✓`, { proud: 0.5, happy: 0.2 }); hearts(k, 6); m.goal = m.paused; m.paused = null; }
    else if (Date.now() > g.until) { m.goal = m.paused; m.paused = null; }
    else return;
  }
  const s = socialGoal(k);
  if (s) { if (m.goal && !m.goal.social) m.paused = m.goal; m.goal = s; return; }
  if (!m.goal && world.t > m.goalT && day()) { newGoal(k); m.announce = Math.random() < 0.5; }
}

// ---------- learning from how things went ----------
function mindStart(k, id, withKid = null) {
  const m = k.mind;
  m.cur = { id, t: world.t, needs: { ...k.needs }, happy: m.mood.happy, with: withKid?.id || null };
  m.history.push(id);
  if (m.history.length > 6) m.history.shift();
}
function mindFinish(k) {
  const m = k.mind, c = m.cur;
  if (!c) return;
  m.cur = null;
  const info = ACT_INFO[c.id];
  if (!info || world.t - c.t < 4) return;
  const n = k.needs, d = (key) => n[key] - c.needs[key], lack = (key) => (100 - c.needs[key]) / 100;
  let sat = d("fun") / 40 + d("love") / 40 + (d("hunger") / 30) * (0.3 + lack("hunger")) + (d("energy") / 30) * (0.3 + lack("energy")) + (d("clean") / 40) * lack("clean")
    + (m.mood.happy - c.happy) * 2 + taste(k, c.id);
  const mate = c.with && KIDS.find((o) => o.id === c.with);
  if (mate) sat += (close(k, mate) - 0.5) * 0.6;
  sat = clamp(sat, -1, 1);
  const was = m.likes[c.id] || 0;
  m.likes[c.id] = clamp(was + (sat - was) * 0.2, -1, 1.2);
  feel(k, null, { happy: sat * 0.15, excited: Math.max(0, (info.gain.fun || 0) * sat * 0.2) });
  if (mate) {
    bondAdd(k, mate, sat > 0 ? 0.015 : -0.02);
    if (sat > 0.5) remember(k, `${info.say[1]} with ${mate.name} ♡`);
    if (m.goal?.social && m.goal.with === mate.id && m.goal.acts.includes(c.id)) m.goal.done = true;
  } else if (info.join) {
    others(k).filter((o) => o.act === c.id && o.area === k.area && Math.hypot(o.x - k.x, o.y - k.y) < 60).forEach((o) => { bondAdd(k, o, 0.008); if (sat > 0.6) remember(k, `${info.say[1]} with ${o.name}`); });
  }
  if (was < 0.5 && m.likes[c.id] >= 0.5) remember(k, `i found out i really love to ${info.say[0]} ♡`);
  else if (was > -0.3 && m.likes[c.id] <= -0.3) remember(k, `i don't really like to ${info.say[0]}`);
  else if (sat > 0.75 && !mate) remember(k, `so much fun ${info.say[1]}`);
}

// ---------- every frame: moods drift with what's going on ----------
function mindTick(k, dt) {
  const m = k.mind, mo = m.mood, n = k.needs, tr = PERSONA[k.id].traits;
  const base = { happy: 0.35, lonely: 0, grumpy: 0, excited: 0, proud: 0 };
  for (const key of MOODS) mo[key] += (base[key] - mo[key]) * dt * 0.012;
  const near = others(k).some((o) => o.area === k.area && !o.hidden && Math.hypot(o.x - k.x, o.y - k.y) < 90);
  mo.lonely += dt * (near || k.asleep ? -0.03 : 0.007 * (0.5 + tr.sociable + tr.shy * 0.6) * PERSONA[k.id].body.love); // she misses her sisters when they're apart
  mo.grumpy += dt * ((n.hunger < 25 ? 0.006 : 0) + (n.energy < 20 ? 0.006 : 0) - (k.patted ? 0.05 : 0));
  mo.happy += dt * ((n.fun + n.love) / 200 - 0.5) * 0.01 + (k.patted ? dt * 0.05 : 0);
  for (const key of MOODS) mo[key] = clamp(mo[key], 0, 1);
  // time spent near each sister (fades over a few minutes), so she shares herself out fairly
  m.together = m.together || {};
  others(k).forEach((o) => { m.together[o.id] = (m.together[o.id] || 0) * Math.exp(-dt / 300) + (o.area === k.area && Math.hypot(o.x - k.x, o.y - k.y) < 90 ? dt : 0); });
  if ((m.rethinkT -= dt) <= 0) { m.rethinkT = rand(4, 7); rethink(k); }
}

// a little dream for the day
const GOALS = {
  grow: { text: (k) => `grow ${CROPS[favCrop(k)].name} ${CROPS[favCrop(k)].emoji}`, acts: ["myplot"], key: "harvest" },
  fish: { text: () => "catch a fish 🎣", acts: ["fishing"], key: "fish" },
  gift: { text: () => "give mama a present 🎁", acts: ["flowers", "draw", "myplot", "mail", "garden"], key: "gift" },
  castle: { text: () => "build the tallest sandcastle 🏰", acts: ["sandbox"], key: "castle" },
  kite: { text: () => "fly my kite super high 🪁", acts: ["kite"], key: "kite" },
  wish: { text: () => "make a wish at the fountain ⛲", acts: ["fountain"], key: "wish" },
  cook: { text: () => "make pancakes for everyone 🥞", acts: ["cook"], key: "cook" },
  tea: { text: () => "have a fancy tea party 🫖", acts: ["teaparty"], key: "tea" },
  icecream: { text: () => "eat the biggest ice cream 🍦", acts: ["icecream"], key: "icecream" },
  swing: { text: () => "swing really really high 🎀", acts: ["swing"], key: "swing" },
  hugs: { text: () => "get lots of cuddles from mama 🥺", acts: ["missmama"], key: "pat" },
  play: { text: () => "play with my sisters 💕", acts: ["tag", "hide", "seesaw", "chat", "stroll", "teaparty", "tagalong"], key: "play" },
  pretty: { text: () => "look like a real princess 👑", acts: ["dressup"], key: "dressup" },
};
const GOAL_FIT = { rose: ["gift", "tea", "wish", "grow", "pretty", "swing", "play"], blossom: ["fish", "kite", "castle", "swing", "grow", "play", "icecream"], teddy: ["hugs", "icecream", "grow", "gift", "play", "cook"] };
const favCrop = (k) => Object.entries(k.mind.crops).sort((a, b) => b[1] - a[1])[0][0];
function newGoal(k) { const id = pick(GOAL_FIT[k.id].filter((g) => g !== k.mind.lastGoal)); k.mind.goal = { id, text: GOALS[id].text(k) }; k.mind.lastGoal = id; }
function achieve(k, key) {
  const g = k.mind.goal;
  if (!g || g.social || GOALS[g.id]?.key !== key) return;
  k.mind.dreams++; remember(k, `my dream came true: ${g.text}`);
  k.mind.goal = null; k.mind.goalT = world.t + rand(300, 900);
  hearts(k, 8); particle("star", k.x, k.y - 34, "#ffd966", 8, 10, -24, k.area); k.hop = 1; feel(k, null, { proud: 0.5, happy: 0.2 });
  later(() => say(k, pick(["i did it!! 🌟", "yay! my dream came true ✨", "mama look, i did it!"]), 2200), 900);
}
KIDS.forEach((k, i) => {
  k.spr = { front: [sprite(k, 0), sprite(k, 1)], back: [sprite(k, 0, false, "back"), sprite(k, 1, false, "back")], side: [sprite(k, 0, false, "side"), sprite(k, 1, false, "side")] };
  k.sleepSpr = sprite(k, 0, true);
  const [x, y] = feetOf(...START[i]);
  Object.assign(k, {
    area: ISL, x, y, dir: "down", frame: 0, dist: 0, path: [], speed: 34,
    needs: { hunger: 80, energy: 85, fun: 70, love: 80, clean: 85 },
    steps: [], step: null, act: "idle", label: "looking around", pose: "stand", item: null, carry: null, gift: null, claims: [],
    held: false, asleep: false, hidden: false, hop: 0, last: null, lift: 0, seatFrom: null, hopping: false,
  });
  initMind(k);
  k.bubble = document.createElement("div"); k.bubble.className = "bubble"; overlay.appendChild(k.bubble);
  k.tag = document.createElement("div"); k.tag.className = "tag"; k.tag.textContent = k.name; overlay.appendChild(k.tag);
});
const areaOf = (k) => AREAS[k.area];
const others = (k) => KIDS.filter((o) => o !== k);
let selected = null;
let gifts = parseInt(store.get("gifts") || "0", 10) || 0;
const renderGifts = () => { $("#gifts").textContent = `🌸 ${gifts}`; };
renderGifts();

function say(k, msg, ms = 2000, thought = false) {
  k.bubble.textContent = thought ? "💭 " + msg : msg;
  k.bubble.classList.toggle("think", thought);
  k.bubble.classList.add("show");
  cancel(k.bubbleTimer);
  k.bubbleTimer = later(() => k.bubble.classList.remove("show"), ms);
}
const hearts = (k, n = 5) => particle("heart", k.x, k.y - 30, pick(["#f48fb4", "#ff7fa8", "#ffb7d0"]), n, 8, -20, k.area);
const tileOfKid = (k) => tileOf(k.x, k.y);
function faceTo(k, x, y) { const dx = x - k.x, dy = y - k.y; k.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"); }
const up = (k, key, v) => { k.needs[key] = clamp(k.needs[key] + v, 0, 100); };
const hungry = (k) => (100 - k.needs.hunger) / 100;

// walking along a path of tiles
function setPath(k, tx, ty) {
  const A = areaOf(k), [sx, sy] = tileOfKid(k);
  const p = findPath(A, sx, sy, tx, ty);
  k.path = (p || []).map(([x, y]) => feetOf(x, y));
  if (p && !p.length) k.path = [feetOf(tx, ty)];
  return !!p;
}
function walk(k, dt, speed = k.speed) {
  let budget = speed * dt, moved = 0;
  while (k.path.length && budget > 0) {
    const [tx, ty] = k.path[0];
    const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy);
    if (d > 0.01) faceTo(k, tx, ty);
    const s = Math.min(d, budget);
    if (d > 0) { k.x += (dx / d) * s; k.y += (dy / d) * s; }
    budget -= s; moved += s;
    if (d - s < 0.01) { k.x = tx; k.y = ty; k.path.shift(); }
  }
  if (!k.path.length && !moved) return true;
  k.dist += moved;
  if (k.dist > 7) {
    k.dist = 0; k.frame ^= 1;
    const t = areaOf(k).at(...tileOfKid(k));
    if (t === TALL && Math.random() < 0.5) particle("leaf", k.x, k.y - 6, "#7fbe68", 2, 4, -18, k.area);
    if (world.wet > 0.5 && k.area === ISL && Math.random() < 0.15) particle("splash", k.x, k.y, "#e8f7ff", 1, 3, -10, ISL);
  }
  return !k.path.length;
}

// ======================================================================
// what they do
// ======================================================================
// an activity is a list of steps: { go: [tx, ty], area } walks there (through the
// front door if it's the other place), { stay: seconds, ... } does something there,
// { run(dt, s) } is custom and returns true when it's done.
// a step's `claim` reserves a seat so two girls don't sit on each other.
const taken = (key, k) => KIDS.some((o) => o !== k && o.claims && o.claims.includes(key));
const freeIndex = (k, n, prefix) => { const ids = [...Array(n).keys()].filter((i) => !taken(prefix + i, k)); return ids.length ? pick(ids) : -1; };
const busy = (o) => o.held || o.patted || o.asleep || o.hidden || ["tag", "chat", "sleep", "bednap", "slide", "swing", "seesaw", "hide", "party", "stroll", "teaparty", "bath", "called", "landed"].includes(o.act);
const INTERRUPTIBLE = ["idle", "explore", "pond", "bench", "beach", "flowers", "sign", "window", "toys", "read", "cloudgaze", "garden", "missmama"];
function partnerFor(k) {
  if (k.wantWith && k.wantWith.area === k.area && !k.wantWith.held) return k.wantWith; // the sister who said yes
  const opts = others(k).filter((o) => o.area === k.area && !busy(o) && INTERRUPTIBLE.includes(o.act) && !o.seatFrom);
  if (!opts.length) return null;
  // she picks whoever she feels closest to (and mivi always looks out for a lonely teddy)
  return fairest(k, opts);
}
function recruit(p, act, steps) {
  endStep(p); snapOff(p); mindFinish(p);
  mindStart(p, act, p.mind.pendingWith); p.mind.pendingWith = null;
  p.act = act; p.path = []; p.steps = steps; p.claims = steps.map((s) => s.claim).filter(Boolean);
  startStep(p, p.steps.shift());
}
function travel(k, to) {
  return [
    { go: EXITS[k.area].tile, area: k.area, label: to === HOM ? "heading home 🏠" : "heading outside 🌴" },
    { run() { cross(k); return true; } },
  ];
}
function cross(k) {
  const ex = EXITS[k.area];
  k.area = ex.to; [k.x, k.y] = feetOf(...ex.arrive);
  k.dir = k.area === ISL ? "down" : "up";
  k.path = [];
  HOUSE.doorT = 0.7;
  if (ac && !muted && !document.hidden) sfx.door();
  if (cam.target === k && cam.mode !== "free" && cam.area !== k.area) switchArea(k.area);
}
function hopStep(k, to, onto, from) {
  return { run(dt, s) {
    if (!s.a) { s.a = [k.x, k.y]; k.hopping = true; }
    const u = Math.min(1, s.t / 0.32);
    k.x = s.a[0] + (to[0] - s.a[0]) * u; k.y = s.a[1] + (to[1] - s.a[1]) * u; k.lift = Math.sin(u * Math.PI) * 7;
    if (u < 1) return false;
    k.lift = 0; k.hopping = false; k.seatFrom = onto ? from : null;
    return true;
  } };
}
// walk up to something, hop onto it, do the thing, hop off again
function seatSteps(k, area, approach, pos, stay, label) {
  return [{ go: approach, area, label, claim: stay.claim }, hopStep(k, pos, true, approach), stay, hopStep(k, feetOf(...approach), false)];
}
function snapOff(k) {
  if (k.seatFrom) { [k.x, k.y] = feetOf(...k.seatFrom); k.seatFrom = null; }
  k.hopping = false; k.lift = 0; k.hidden = false;
}

const FOOD = { blueberry: "blueberries", carrot: "a crunchy carrot", tomato: "a tomato", watermelon: "watermelon", cookie: "a cookie", strawberry: "strawberries", milk: "strawberry milk", onigiri: "an onigiri", apple: "an apple", icecream: "ice cream", bread: "fresh bread",
  banhmi: "a bánh mì", cake: "cake", pancake: "pancakes", pho: "phở", rice: "cơm", tea: "tea" };
const YUM = ["yum!", "nom nom", "ngon quá!", "so yummy", "mmm ♡"];
function mealFood() {
  const h = hourNow();
  if (h >= 6 && h < 10.5) return pick(["pancake", "banhmi", "milk"]);
  if (h >= 11 && h < 14.5) return pick(["rice", "onigiri", "banhmi"]);
  if (h >= 17 && h < 21) return pick(["pho", "rice", "pho"]);
  return pick(["cookie", "strawberry", "apple", "milk", "cake"]);
}
function eatStep(k, food, extra = {}) {
  return { ...extra, stay: rand(6, 9), label: `eating ${FOOD[food]} 😋`, pose: extra.pose || "sit", item: food,
    start(s) { k.carry = null; if (Math.random() < 0.45) say(k, pick([...YUM, ...PERSONA[k.id].yum]), 1400); extra.start?.(s); },
    end() { if (food === "icecream") achieve(k, "icecream"); },
    tick(dt) { up(k, "hunger", 10 * dt); if (Math.random() < dt * 1.2) particle("crumb", k.x + 6, k.y - 14, "#e9c9a8", 1, 2, 10, k.area); if (food === "pho" && Math.random() < dt * 2) particle("steam", k.x + 7, k.y - 18, "#ffffff", 1, 2, -12, k.area); } };
}
// somewhere nice to sit and eat on the island
function eatOutside(k, food) {
  const seats = [...BENCH_SPOTS.map((t, i) => ({ t, key: "bench" + i, face: "down" })), ...FOUNTAIN_SPOTS.map(([x, y, f], i) => ({ t: [x, y], key: "fountain" + i, face: f })), ...PICNIC_SPOTS.map((t, i) => ({ t, key: "picnic" + i, face: "down" }))]
    .filter((s) => !taken(s.key, k))
    .sort((a, b) => Math.hypot(a.t[0] * T - k.x, a.t[1] * T - k.y) - Math.hypot(b.t[0] * T - k.x, b.t[1] * T - k.y)).slice(0, 4);
  if (!seats.length) return [eatStep(k, food, { pose: "stand" })];
  const s = pick(seats);
  return [{ go: s.t, area: ISL, label: `taking ${FOOD[food]} somewhere to sit`, claim: s.key }, eatStep(k, food, { face: s.face, claim: s.key })];
}

const WISHES = ["i wish mama & papa are happy forever ♡", "i wish for more strawberries", "i wish we all go on holiday together", "i wish papa makes mama laugh every day", "i wish my sisters and me stay best friends", "i wish mama gets lots of cuddles"];
const CLOUDS = ["that cloud looks like a bunny!", "that one's a heart ♡", "a teddy cloud!", "the sky is so pretty", "that one looks like papa hehe"];
const CHAT = ["hehe", "💕", "best sisters ♡", "wanna play?", "i love u", "🎀", "secret: mama is the best", "papa is so silly", "shhh hehe", "pinky promise", "look a butterfly!", "i'm hungry hehe", "let's go to the beach later"];

const ACTS = {
  // ---------------- out on the island ----------------
  explore: { area: ISL, w: () => 1.1,
    plan(k) { const t = randomTile(I, 10, k.area === ISL ? tileOfKid(k) : DOOR); return [{ go: t, area: ISL, label: pick(["exploring", "going on an adventure", "wandering around"]) }, { stay: rand(1.5, 3), label: "looking around", face: pick(["down", "left", "right"]) }]; } },
  flowers: { area: ISL, w: (k) => (day() ? 1 : 0) - (k.gift ? 0.6 : 0),
    plan(k) {
      return [{ go: pick(SPOTS.flowers), area: ISL, label: "going to the flower field" },
        { stay: rand(3, 5), label: "picking flowers 🌷", pose: "crouch", face: "down",
          tick(dt) { if (Math.random() < dt * 2) particle("petal", k.x + rand(-6, 6), k.y - 6, pick(["#f48fb4", "#ffd966", "#fff"]), 1, 3, -14, ISL); },
          end() { if (!k.gift) { k.gift = "flower"; say(k, pick(["this one's for mama!", "for papa ♡", "found a pretty one!"])); } } }];
    } },
  butterfly: { area: ISL, w: () => (outdoor() ? 0.8 : 0),
    plan(k) {
      const b = pick(butterflies);
      return [{ label: "chasing a butterfly 🦋", dur: rand(6, 9), run(dt, s) {
        s.re = (s.re || 0) - dt;
        if (s.re <= 0) { s.re = 0.6; const t = tileOf(b.x, b.y + 10); setPath(k, ...(I.walk(...t) ? t : nearestWalkable(I, ...t))); }
        walk(k, dt, k.speed * 1.5);
        if (s.t > s.dur) { say(k, pick(["it flew away!", "come back!", "almost!"])); return true; }
      } }];
    } },
  pond: { area: ISL, w: () => 0.8,
    plan(k) {
      const [x, y] = pick(SPOTS.pond), feed = Math.random() < 0.45;
      return [{ go: [x, y], area: ISL, label: "going to the pond" },
        { stay: rand(8, 13), label: feed ? "feeding the ducks 🦆" : pick(["skipping stones 🪨", "looking at the fish 🐟"]), pose: "sit", face: facing(I, x, y, WATER),
          tick(dt) {
            up(k, "fun", 2 * dt);
            const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[k.dir];
            if (feed) {
              world.duckGoal = { x: k.x + d[0] * 30, y: k.y - 4 + d[1] * 26, until: world.t + 1 };
              if (Math.random() < dt * 1.5) particle("crumb", k.x + d[0] * rand(10, 26), k.y - 8 + d[1] * rand(8, 20), "#e9c9a8", 2, 3, -20, ISL);
            } else if (Math.random() < dt * 0.5) particle("splash", k.x + d[0] * rand(18, 40), k.y - 4 + d[1] * rand(14, 30), "#e8f7ff", 4, 3, -14, ISL);
          } }];
    } },
  fishing: { area: ISL, w: (k) => (!taken("dock", k) && !raining() ? 0.6 : 0),
    plan(k) {
      return [{ go: [43, 10], area: ISL, label: "going fishing 🎣", claim: "dock" },
        { stay: rand(16, 24), label: "fishing on the jetty 🎣", pose: "fish", face: "up", claim: "dock",
          tick(dt, s) {
            s.c = (s.c || 0) + dt; s.next = s.next || rand(5, 9);
            if (s.c < s.next) return;
            s.c = 0; s.next = rand(5, 9);
            particle("splash", k.x + 3, k.y - 44, "#e8f7ff", 5, 3, -16, ISL);
            if (Math.random() < 0.55) { say(k, pick(["caught a fish! 🐟", "a fishy!! 🐟", "look papa a fish!"]), 1500); up(k, "fun", 12); remember(k, "i caught a fish 🐟"); achieve(k, "fish"); later(() => say(k, pick(["bye bye fishy 👋", "back you go ♡"]), 1300), 1600); }
            else say(k, pick(["it got away!", "nibble nibble…", "so close!"]), 1300);
          } }];
    } },
  swing: { area: ISL, w: (k) => (outdoor() && freeIndex(k, 2, "swing") >= 0 ? 1.1 : 0),
    plan(k) {
      const i = Math.max(0, freeIndex(k, 2, "swing"));
      return [{ go: SWING_SEATS[i], area: ISL, label: "going to the swings", claim: "swing" + i },
        { stay: rand(10, 16), label: "on the swing 🎀", pose: "swing", face: "down", claim: "swing" + i,
          start() { k.swingSeat = i; const o = KIDS.find((o) => o !== k && o.pose === "swing"); if (o) say(k, `let's swing together ${o.name}!`, 1600); else if (Math.random() < 0.6) say(k, pick(["wheee!", "higher!", "push me papa!"])); },
          tick(dt) { up(k, "fun", 4 * dt); }, end() { k.swingSeat = null; achieve(k, "swing"); } }];
    } },
  slide: { area: ISL, w: (k) => (outdoor() && !taken("slide", k) ? 0.9 : 0),
    plan(k) {
      const top = [SLIDE.tx * T + 6, SLIDE.ty * T + 6], bottom = [SLIDE.tx * T + 30, SLIDE.ty * T + 44];
      const steps = [];
      for (let r = irand(2, 3); r > 0; r--) {
        steps.push({ go: [SLIDE.tx - 1, SLIDE.ty + 2], area: ISL, label: "playing on the slide 🛝", claim: "slide" });
        steps.push({ label: "climbing up the slide", run(dt) { k.dir = "up"; k.dist += dt; if (k.dist > 0.18) { k.dist = 0; k.frame ^= 1; } k.x += (top[0] - k.x) * Math.min(1, dt * 2); k.y += (top[1] - k.y) * Math.min(1, dt * 2); return Math.hypot(top[0] - k.x, top[1] - k.y) < 1.5; } });
        steps.push({ label: "sliding down!", run(dt, s) { if (!s.said) { s.said = 1; if (Math.random() < 0.6) say(k, pick(["wheee!", "weeee!", "again!"]), 1200); } k.dir = "down"; k.frame = 0; k.x += (bottom[0] - k.x) * Math.min(1, dt * 5); k.y += (bottom[1] - k.y) * Math.min(1, dt * 5); return Math.hypot(bottom[0] - k.x, bottom[1] - k.y) < 1.5; } });
        steps.push({ run() { [k.x, k.y] = feetOf(...nearestWalkable(I, ...tileOf(k.x, k.y))); up(k, "fun", 12); return true; } });
      }
      return steps;
    } },
  seesaw: { area: ISL, w: (k) => (outdoor() && k.area === ISL && !taken("seesaw", k) && partnerFor(k) ? 0.7 : 0),
    plan(k) {
      const p = partnerFor(k);
      if (!p) return ACTS.explore.plan(k);
      const game = { riders: [k, p], dur: rand(10, 14), on: false };
      SEESAW.game = game;
      const ride = (me, i) => ({ stay: Infinity, label: `on the seesaw with ${(i ? k : p).name}`, pose: "seesaw", face: i ? "left" : "right", claim: "seesaw",
        tick(dt, s) {
          const both = game.riders.every((r) => r.act === "seesaw" && r.pose === "seesaw");
          if (game.riders.some((r) => r.act !== "seesaw")) { s.dur = 0; return; }
          if (!both) { s.wait = (s.wait || 0) + dt; s.t = 0; if (s.wait > 25) s.dur = 0; return; }
          game.on = true; up(me, "fun", 4 * dt);
          if (Math.random() < dt * 0.3) say(me, pick(["up!", "down!", "wheee", "hehe"]), 900);
          if (s.t > game.dur) s.dur = 0;
        },
        end() { game.on = false; achieve(me, "play"); bond(k, p, 0.03); } });
      recruit(p, "seesaw", [{ go: SEESAW.seats[1], area: ISL, label: "going to the seesaw", claim: "seesaw" }, ride(p, 1)]);
      say(k, `seesaw ${p.name}?`, 1400);
      return [{ go: SEESAW.seats[0], area: ISL, label: "going to the seesaw", claim: "seesaw" }, ride(k, 0)];
    } },
  sandbox: { area: ISL, w: (k) => (outdoor() && freeIndex(k, 3, "sand") >= 0 ? 0.7 : 0),
    plan(k) {
      const i = Math.max(0, freeIndex(k, 3, "sand")), [x, y, face] = SANDBOX[i];
      return [{ go: [x, y], area: ISL, label: "going to the sandbox", claim: "sand" + i },
        { stay: rand(8, 12), label: "building a sandcastle 🏰", pose: "crouch", face, claim: "sand" + i, end() { if (CASTLE.level >= 4.5) { remember(k, "i built a giant sandcastle 🏰"); achieve(k, "castle"); } },
          start() { if (CASTLE.level >= 4.9) { CASTLE.level = 0; say(k, "a new one!"); } },
          tick(dt) { CASTLE.level = Math.min(4.95, CASTLE.level + dt * 0.1); up(k, "fun", 2 * dt); up(k, "clean", -0.8 * dt); if (Math.random() < dt * 3) particle("crumb", CASTLE.tx * T + 10, CASTLE.ty * T + 6, "#e9cf9a", 1, 5, -20, ISL); } }];
    } },
  beach: { area: ISL, w: () => (outdoor() ? 0.9 : 0),
    plan(k) {
      const [x, y] = pick(SPOTS.shore);
      return [{ go: [x, y], area: ISL, label: "going to the beach" },
        { stay: rand(6, 10), label: pick(["paddling in the sea 🌊", "watching the waves"]), face: facing(I, x, y, WATER),
          tick(dt) { up(k, "fun", 2 * dt); if (Math.random() < dt * 1.5) particle("splash", k.x + rand(-8, 8), k.y + 8, "#e8f7ff", 2, 4, -16, ISL); } }];
    } },
  shells: { area: ISL, w: (k) => (outdoor() && shells.length && !k.gift ? 0.6 : 0),
    plan(k) {
      const s = pick(shells);
      return [{ go: tileOf(s.x, s.y + 4), area: ISL, label: "looking for seashells 🐚" },
        { stay: 1.6, label: "picking up a shell", pose: "crouch", face: "down",
          end() { const i = shells.indexOf(s); if (i >= 0) shells.splice(i, 1); if (!k.gift) k.gift = "shell"; say(k, pick(["a shell for mama!", "so pretty", "listen, the sea!"])); } }];
    } },
  sunbathe: { area: ISL, w: (k) => (outdoor() && hourNow() > 10 && hourNow() < 18 && !taken("towel", k) ? 0.4 : 0),
    plan(k) { return seatSteps(k, ISL, TOWEL.approach, TOWEL.pos, { stay: rand(15, 25), label: "sunbathing on the beach 🏖️", pose: "lie", claim: "towel", tick(dt) { up(k, "energy", 1 * dt); } }, "going to lie on the beach towel"); } },
  picnic: { area: ISL, w: (k) => (freeIndex(k, 4, "picnic") >= 0 ? hungry(k) ** 2 * 3 + (world.treat ? 6 : 0) + (outdoor() ? 0.15 : 0) : 0),
    plan(k) {
      const i = Math.max(0, freeIndex(k, 4, "picnic")), spot = PICNIC_SPOTS[i];
      const food = world.treat ? "cake" : pick(["onigiri", "strawberry", "cookie", "milk", "banhmi"]);
      return [{ go: spot, area: ISL, label: "going for a picnic 🧺", claim: "picnic" + i },
        eatStep(k, food, { claim: "picnic" + i, start() { faceTo(k, 42 * T, 19 * T); if (food === "cake" && world.treat) world.treat--; } })];
    } },
  shop: { area: ISL, w: (k) => hungry(k) ** 2 * 3 + 0.15,
    plan(k) {
      const food = pick(["bread", "banhmi", "milk", "strawberry", "cookie", "cake"]);
      return [{ go: SHOP_DOOR, area: ISL, label: "going to the shop 🛒" },
        { stay: rand(3, 5), label: "shopping 🛒", face: "up",
          start() { k.hidden = true; SHOP.doorT = 0.5; },
          end() { k.hidden = false; k.dir = "down"; SHOP.doorT = 0.5; k.carry = food; say(k, `got ${FOOD[food]}!`, 1400); } },
        ...eatOutside(k, food)];
    } },
  icecream: { area: ISL, w: (k) => (outdoor() && freeIndex(k, 2, "cart") >= 0 ? 0.35 + hungry(k) + (hourNow() > 12 && hourNow() < 18 ? 0.4 : 0) : 0),
    plan(k) {
      const i = Math.max(0, freeIndex(k, 2, "cart")), flavour = pick(["strawberry", "vanilla", "mango", "taro"]);
      const [x, y] = pick(SPOTS.sand);
      return [{ go: CART_SPOTS[i], area: ISL, label: "going to get ice cream 🍦", claim: "cart" + i },
        { stay: 2.2, label: "buying ice cream 🍦", face: "up", claim: "cart" + i, end() { k.carry = "icecream"; say(k, `${flavour} please!`, 1300); } },
        { go: [x, y], area: ISL, label: "carrying her ice cream 🍦" },
        eatStep(k, "icecream", { face: "down" })];
    } },
  apples: { area: ISL, w: (k) => (APPLE_TREES.some((o) => o.apples > 0) ? hungry(k) * 1.6 + 0.2 : 0),
    plan(k) {
      const o = pick(APPLE_TREES.filter((o) => o.apples > 0)) || APPLE_TREES[0];
      const t = [o.tx + irand(0, 1), o.ty + 2];
      return [{ go: I.walk(...t) ? t : nearestWalkable(I, ...t), area: ISL, label: "going to the apple tree 🍎" },
        { stay: 1.4, label: "shaking the apple tree 🍎", face: "up", start() { o.shake = 1.5; },
          end() { if (o.apples > 0) { o.apples--; particle("apple", o.tx * T + 16, o.ty * T + 6, "#e2405a", 1, 6, 0, ISL); } } },
        { stay: 1, label: "picking up an apple", pose: "crouch", face: "down", end() { k.carry = "apple"; } },
        eatStep(k, "apple", { face: "down" })];
    } },
  garden: { area: ISL, w: () => (outdoor() ? 0.6 + (PLANTS.some((p) => p.g >= 3) ? 0.8 : 0) + (PLANTS.some((p) => p.wet < 0.2) ? 0.4 : 0) : 0),
    plan(k) {
      const order = PLANTS.map((p, i) => i).filter((i) => !taken("plant" + i, k))
        .sort((a, b) => (PLANTS[b].g >= 3) - (PLANTS[a].g >= 3) || PLANTS[a].wet - PLANTS[b].wet).slice(0, irand(1, 3));
      if (!order.length) return ACTS.explore.plan(k);
      return order.flatMap((i) => {
        const p = PLANTS[i];
        return [{ go: [p.tx, 8], area: ISL, label: "going to the strawberry patch 🍓", claim: "plant" + i },
          { stay: rand(3.5, 5), pose: "crouch", face: "up", claim: "plant" + i,
            start(s) { s.ripe = p.g >= 3; k.label = s.ripe ? "picking strawberries 🍓" : "watering the strawberries 💧"; k.item = s.ripe ? null : "can"; },
            tick(dt, s) { if (!s.ripe && Math.random() < dt * 6) particle("drop", p.tx * T + 8 + rand(-3, 3), 7 * T + 4, "#9fd0f2", 1, 1, 10, ISL); },
            end(s) {
              if (s.ripe) {
                p.g = 0; p.wet = 0.6;
                if (!k.gift && Math.random() < 0.5) { k.gift = "strawberry"; say(k, "strawberries for mama!"); }
                else { up(k, "hunger", 15); say(k, pick(["so sweet!", "nom 🍓", "the best one!"]), 1300); }
              } else p.wet = 1;
              up(k, "fun", 6); up(k, "clean", -4);
            } }];
      });
    } },
  bench: { area: ISL, w: (k) => (freeIndex(k, BENCH_SPOTS.length, "bench") >= 0 ? 0.35 + (k.needs.energy < 50 ? 0.8 : 0) : 0),
    plan(k) {
      const i = Math.max(0, freeIndex(k, BENCH_SPOTS.length, "bench"));
      return [{ go: BENCH_SPOTS[i], area: ISL, label: "going to sit down", claim: "bench" + i },
        { stay: rand(6, 10), label: "resting on the bench", pose: "sit", face: "down", claim: "bench" + i, tick(dt) { up(k, "energy", 2 * dt); } }];
    } },
  nap: { area: ISL, w: (k) => (outdoor() && k.needs.energy < 30 ? 6 : 0),
    plan(k) {
      return [{ go: pick(SPOTS.shade), area: ISL, label: "finding a shady spot" },
        { stay: rand(25, 45), label: "napping under a tree 💤", pose: "nap", tick(dt) { up(k, "energy", 2.2 * dt); if (Math.random() < dt * 0.5) particle("z", k.x + 4, k.y - 14, "#9db8ff", 1, 2, -12, ISL); } }];
    } },
  cloudgaze: { area: ISL, w: () => (day() && world.weather !== "rain" ? 0.35 : 0),
    plan(k) {
      return [{ go: pick(SPOTS.field), area: ISL, label: "finding a comfy patch of grass" },
        { stay: rand(12, 20), label: "watching the clouds ☁️", pose: "lie", tick(dt, s) { up(k, "energy", 0.8 * dt); s.c = (s.c || 0) + dt; if (s.c > 6) { s.c = 0; if (Math.random() < 0.6) say(k, pick(CLOUDS), 1800); } } }];
    } },
  kite: { area: ISL, w: (k) => (outdoor() && !taken("kite", k) ? 0.45 : 0),
    plan(k) {
      return [{ go: pick(SPOTS.field), area: ISL, label: "taking the kite out 🪁", claim: "kite" },
        { stay: rand(15, 24), label: "flying her kite 🪁", pose: "kite", face: "up", claim: "kite", tick(dt) { up(k, "fun", 3 * dt); }, end() { remember(k, "my kite flew so high 🪁"); achieve(k, "kite"); },
          start() { if (Math.random() < 0.5) say(k, pick(["look how high!", "fly kite fly!", "mama look up!"]), 1500); } }];
    } },
  fountain: { area: ISL, w: (k) => (day() && freeIndex(k, 4, "fountain") >= 0 ? 0.45 : 0),
    plan(k) {
      const i = Math.max(0, freeIndex(k, 4, "fountain")), [x, y, face] = FOUNTAIN_SPOTS[i];
      return [{ go: [x, y], area: ISL, label: "going to the fountain ⛲", claim: "fountain" + i },
        { stay: 4, label: "making a wish ⛲", face, claim: "fountain" + i,
          start() { const c = [FOUNTAIN.tx * T + 24, FOUNTAIN.ty * T + 26]; world.parts.push({ type: "coin", area: ISL, x: k.x, y: k.y - 18, vx: (c[0] - k.x) / 0.8, vy: (c[1] - k.y + 18) / 0.8 - 40, life: 0.8, color: "#ffd966" }); },
          end() { remember(k, "i made a wish ⛲"); achieve(k, "wish"); say(k, pick(WISHES), 2600); particle("star", FOUNTAIN.tx * T + 24, FOUNTAIN.ty * T + 20, "#ffd966", 6, 10, -20, ISL); hearts(k, 3); up(k, "love", 10); } }];
    } },
  kitty: { area: ISL, w: (k) => (!cat.petBy && !taken("cat", k) && cat.state !== "home" ? 0.65 : 0),
    plan(k) {
      return [{ label: "looking for kitty 🐱", claim: "cat", dur: 16, run(dt, s) {
        if (!s.pet) {
          if (s.t > s.dur) return true;
          s.re = (s.re || 0) - dt;
          if (s.re <= 0) { s.re = 0.7; const t = tileOf(cat.x + (k.x < cat.x ? -14 : 14), cat.y); setPath(k, ...(I.walk(...t) ? t : nearestWalkable(I, ...t))); }
          walk(k, dt);
          if (Math.hypot(cat.x - k.x, cat.y - k.y) < 20 && !cat.petBy) {
            s.pet = s.t; cat.petBy = k; cat.path = []; k.path = []; faceTo(k, cat.x, cat.y); k.pose = "crouch"; k.label = "petting kitty 🐱";
            say(k, pick(["kitty!! 🐱", "soft kitty", "hehe she purrs", "good kitty ♡"]), 1500);
          }
          return false;
        }
        k.frame = 0; up(k, "love", 3 * dt); up(k, "fun", 2 * dt);
        return s.t - s.pet > 5;
      }, end() { if (cat.petBy === k) cat.petBy = null; } }];
    } },
  puddles: { area: ISL, rain: true, w: () => (world.wet > 0.35 && day() && PUDDLES.length ? 2 : 0),
    plan(k) {
      const t = pick(PUDDLES);
      return [{ go: t, area: ISL, label: "running to the puddles 💦" },
        { stay: rand(6, 9), label: "jumping in puddles 💦", face: "down",
          tick(dt, s) { s.j = (s.j || 0) + dt; if (s.j > 0.55) { s.j = 0; k.hop = 1; particle("splash", k.x, k.y, "#cfeaff", 5, 6, -26, ISL); if (Math.random() < 0.2) say(k, pick(["splash!!", "hehe!!", "jump!"]), 900); } up(k, "fun", 4 * dt); up(k, "clean", -2.5 * dt); },
          end() { say(k, pick(["i'm all muddy hehe", "bath time later…", "best day ever"]), 1600); } }];
    } },
  chat: { area: null, w: (k) => (partnerFor(k) ? ((100 - k.needs.love) / 100) * 2 + 0.6 : 0),
    plan(k) {
      const p = partnerFor(k);
      if (!p) return ACTS.idle.plan(k);
      recruit(p, "chat", [{ stay: 16, label: `chatting with ${k.name} 💬`, faceKid: k }]);
      const A = areaOf(k), [px, py] = tileOfKid(p);
      const spot = [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]].find(([x, y]) => A.walk(x, y)) || [px, py];
      return [{ go: spot, area: k.area, label: `going to ${p.name}` },
        { stay: rand(8, 11), label: `chatting with ${p.name} 💬`, faceKid: p,
          start(s) { s.lines = dialogue(k, p); },
          tick(dt, s) { s.c = (s.c || 0) + dt; if (s.c > 1.9) { s.c = 0; const l = s.lines.shift(); if (l) say(l[0], l[1], 1800); else say(Math.random() < 0.5 ? k : p, pick(CHAT), 1600); } },
          end() { hearts(k, 4); hearts(p, 3); up(k, "love", 20); up(p, "love", 20); bond(k, p, 0.05); achieve(k, "play"); achieve(p, "play"); remember(k, `i had a lovely chat with ${p.name}`); if (p.act === "chat" && p.step) p.step.dur = 0; } }];
    } },
  tag: { area: ISL, w: (k) => (outdoor() && k.area === ISL && partnerFor(k) ? 0.6 : 0),
    plan(k) {
      const p = partnerFor(k);
      if (!p) return ACTS.explore.plan(k);
      const game = { it: k, first: k, other: p, swaps: 0, t: 0 };
      say(k, pick(["tag! you're it… no wait, i'm it!", "let's play tag!", "i'm gonna get you!"]), 1600);
      recruit(p, "tag", [tagStep(p, game)]);
      return [tagStep(k, game)];
    } },
  hide: { area: ISL, w: (k) => (outdoor() && k.area === ISL && others(k).some((o) => o.area === ISL && !busy(o) && INTERRUPTIBLE.includes(o.act)) ? 0.5 : 0),
    plan(k) {
      const hiders = (k.wantHiders || others(k)).filter((o) => o.area === ISL && !busy(o) && INTERRUPTIBLE.includes(o.act));
      if (!hiders.length) return ACTS.explore.plan(k);
      const spots = HIDE_SPOTS.slice().sort(() => Math.random() - 0.5);
      const game = { found: new Set(), over: false, spots: new Map() };
      hiders.forEach((h, i) => {
        game.spots.set(h, spots[i]);
        recruit(h, "hide", [
          { go: spots[i], area: ISL, label: "running to hide 🙈" },
          { label: "hiding 🙈", pose: "crouch", run() { return game.found.has(h) || game.over; } },
          { stay: 1.5, label: "found!", start() { h.hop = 1; } },
        ]);
      });
      // she counts, then looks in a couple of wrong places before finding each sister
      const steps = [{ stay: 6, label: "counting… 🙈", face: "up", tick(dt, s) { const n = Math.floor(s.t) + 1; if (n !== s.n) { s.n = n; say(k, n < 6 ? `${n}…` : "ready or not!", 900); } } }];
      hiders.forEach((h) => [pick(HIDE_SPOTS), game.spots.get(h)].forEach((spot) => {
        steps.push({ go: spot, area: ISL, label: "looking for her sisters 👀" });
        steps.push({ label: "looking…", run(dt, s) {
          if (s.t < 0.4) return false;
          const f = hiders.find((o) => !game.found.has(o) && Math.hypot(o.x - k.x, o.y - k.y) < 20);
          if (f) { game.found.add(f); say(k, pick(["found you!", "gotcha!", "i see you!"]), 1400); later(() => say(f, pick(["aww!", "hehe how?", "no fair!"]), 1400), 400); hearts(f, 3); }
          return true;
        } });
      }));
      steps.push({ stay: 1.5, label: "that was fun!", start() { game.over = true; achieve(k, "play"); hiders.forEach((h) => { bond(k, h, 0.03); achieve(h, "play"); }); say(k, pick(["found everyone!", "my turn to hide next!", "that was fun!"]), 1500); } });
      return steps;
    } },
  stroll: { area: ISL, w: (k) => (outdoor() && k.area === ISL && partnerFor(k) ? 0.5 : 0),
    plan(k) {
      const p = partnerFor(k);
      if (!p) return ACTS.explore.plan(k);
      recruit(p, "stroll", [{ label: `holding hands with ${k.name} 🤝`, run(dt) {
        if (k.act !== "stroll" || k.area !== p.area || k.held) return true;
        const back = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[k.dir];
        const side = { up: [1, 0], down: [-1, 0], left: [0, 1], right: [0, -1] }[k.dir];
        let gx = k.x + side[0] * 21 + back[0] * 3, gy = k.y + side[1] * 8 + back[1] * 3;
        if (!I.walk(...tileOf(gx, gy))) { gx = k.x + back[0] * 14; gy = k.y + back[1] * 10; }
        const dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy);
        if (d > 1) { const st = Math.min(d, k.speed * 1.3 * dt); p.x += (dx / d) * st; p.y += (dy / d) * st; p.dist += st; if (p.dist > 7) { p.dist = 0; p.frame ^= 1; } }
        p.dir = k.dir;
        if (Math.random() < dt * 0.6) particle("heart", (k.x + p.x) / 2, Math.min(k.y, p.y) - 22, "#ff7fa8", 1, 2, -20, ISL);
        return false;
      } }]);
      return [{ go: randomTile(I, 10, tileOfKid(k)), area: ISL, label: `holding hands with ${p.name} 🤝`, start() { say(k, pick(["hold my hand!", "let's go for a walk", "come with me!"]), 1400); } },
        { stay: 2, label: `holding hands with ${p.name} 🤝`, end() { hearts(k, 3); hearts(p, 3); up(k, "love", 15); up(p, "love", 15); bond(k, p, 0.05); achieve(k, "play"); achieve(p, "play"); remember(k, `${p.name} and i held hands`); } }];
    } },
  sign: { area: ISL, w: () => 0.12,
    plan(k) { return [{ go: [23, 11], area: ISL, label: "reading the sign" }, { stay: 3, face: "up", label: "reading the sign", start() { say(k, SIGN_TEXT.home, 2600); } }]; } },
  mail: { area: ISL, w: (k) => (!k.gift ? 0.25 : 0),
    plan(k) {
      return [{ go: [28, 11], area: ISL, label: "checking the mail 📬" },
        { stay: 2, face: "up", label: "checking the mail 📬", end() { if (!k.gift && Math.random() < 0.6) { k.gift = "letter"; say(k, "a letter for mama!", 1600); } else say(k, "no mail today…", 1300); } }];
    } },
  ball: { area: ISL, w: () => (world.ball ? 3 : 0),
    plan(k) {
      return [{ label: "playing ball ⚽", dur: rand(12, 18), run(dt, s) {
        const b = world.ball;
        if (!b) return true;
        s.re = (s.re || 0) - dt;
        if (Math.hypot(b.x - k.x, b.y - k.y) > 10) {
          if (s.re <= 0) { s.re = 0.5; const t = tileOf(b.x, b.y); setPath(k, ...(I.walk(...t) ? t : nearestWalkable(I, ...t))); }
          walk(k, dt, k.speed * 1.4);
        } else if (Math.hypot(b.vx, b.vy) < 40) {
          const mate = KIDS.find((o) => o !== k && o.act === "ball" && o.area === ISL);
          const ang = mate && Math.random() < 0.6 ? Math.atan2(mate.y - b.y, mate.x - b.x) : rand(0, Math.PI * 2), pw = rand(90, 150);
          b.vx = Math.cos(ang) * pw; b.vy = Math.sin(ang) * pw; b.vh = rand(30, 70);
          faceTo(k, b.x + b.vx, b.y + b.vy); k.hop = 0.6;
          if (Math.random() < 0.3) say(k, pick(["kick!", "pass!", "goal!!", "catch!"]), 1100);
          up(k, "fun", 8);
        }
        return s.t > s.dur;
      } }];
    } },
  bubbles: { area: ISL, w: () => (world.bubbles.length ? 5 : 0),
    plan(k) {
      return [{ label: "popping bubbles 🫧", dur: rand(8, 14), run(dt, s) {
        if (!world.bubbles.length) return true;
        if (!s.b || s.b.popped) { s.b = world.bubbles.reduce((best, b) => (!best || Math.hypot(b.x - k.x, b.y - k.y) < Math.hypot(best.x - k.x, best.y - k.y) ? b : best), null); s.re = 0; }
        const b = s.b;
        s.re -= dt;
        if (s.re <= 0) { s.re = 0.5; const t = tileOf(b.x, b.y); setPath(k, ...(I.walk(...t) ? t : nearestWalkable(I, ...t))); }
        walk(k, dt, k.speed * 1.4);
        if (Math.hypot(b.x - k.x, b.y - k.y) < 12 && b.alt < 34) {
          k.hop = 1; popBubble(b);
          if (Math.random() < 0.4) say(k, pick(["pop!", "got one!", "hehe bubbles"]), 1000);
          up(k, "fun", 5);
        }
        return s.t > s.dur;
      } }];
    } },
  party: { area: null, w: () => 0,
    plan(k) {
      const A = AREAS[world.partyArea], a = (KIDS.indexOf(k) / KIDS.length) * Math.PI * 2, c = world.partyAt;
      const t = tileOf(c[0] + Math.cos(a) * 22, c[1] + Math.sin(a) * 16);
      return [{ go: A.walk(...t) ? t : nearestWalkable(A, ...t), area: world.partyArea, label: "going to the party!" },
        { stay: Math.max(2, world.party), label: "dancing 💃", pose: "dance", tick(dt, s) { s.dur = s.t + Math.max(0, world.party); up(k, "fun", 4 * dt); } }];
    } },
  idle: { area: null, w: () => 0.6,
    plan(k) { return [{ stay: rand(3, 6), label: "daydreaming ☁️", start() { if (Math.random() < 0.4) say(k, pick([...k.says, ...KID_SAYS])); } }]; } },

  myplot: { area: ISL, w: (k) => {
      if (!day()) return 0;
      const p = plotOf(k), ripe = p.tiles.filter((t) => t.crop && t.g >= 1).length, empty = p.tiles.filter((t) => !t.crop).length, dry = raining() ? 0 : p.tiles.filter((t) => t.crop && t.g < 1 && t.wet < 0.2).length;
      return ripe + empty + dry ? 0.12 + ripe * 0.4 + empty * 0.12 + dry * 0.25 : 0; // only when there's a job to do
    },
    plan(k) {
      const p = plotOf(k);
      const jobs = p.tiles.map((t) => ({ t, kind: t.crop && t.g >= 1 ? 0 : !t.crop ? 1 : t.wet < 0.35 && !raining() ? 2 : 9 })).filter((j) => j.kind < 9).sort((a, b) => a.kind - b.kind).slice(0, irand(2, 4));
      if (!jobs.length) return [{ go: tendFrom(pick(p.tiles)), area: ISL, label: "visiting her garden 🌱" },
        { stay: rand(5, 8), label: pick(["admiring her garden 🌱", "singing to her plants 🎶", "pulling out tiny weeds"]), pose: "crouch", tick(dt) { if (Math.random() < dt) particle("note", k.x + rand(-6, 6), k.y - 30, "#86c970", 1, 2, -14, ISL); } }];
      return jobs.flatMap(({ t, kind }) => {
        const [ax, ay] = tendFrom(t);
        return [{ go: [ax, ay], area: ISL, label: "going to her garden 🌱" },
          { stay: rand(2.5, 4), pose: "crouch", face: ay < t.ty ? "down" : "up",
            start(s) {
              if (kind === 0) k.label = `picking her ${CROPS[t.crop].name} ${CROPS[t.crop].emoji}`;
              else if (kind === 1) { s.choice = chooseCrop(k); k.label = `planting ${CROPS[s.choice.id].name} ${CROPS[s.choice.id].emoji}`; if (Math.random() < 0.7) think(k, s.choice.why, 2600); }
              else { k.label = "watering her garden 💧"; k.item = "can"; }
            },
            tick(dt) {
              if (kind === 2 && Math.random() < dt * 6) particle("drop", t.tx * T + 8 + rand(-3, 3), t.ty * T + 2, "#9fd0f2", 1, 1, 10, ISL);
              if (kind === 1 && Math.random() < dt * 3) particle("crumb", t.tx * T + 8, t.ty * T + 10, "#8f6646", 1, 3, -16, ISL);
            },
            end(s) {
              up(k, "fun", 5); up(k, "clean", -2);
              if (kind === 1 && s.choice) { t.crop = s.choice.id; t.g = 0; t.wet = 1; k.mind.planted[t.crop] = (k.mind.planted[t.crop] || 0) + 1; remember(k, `i planted ${CROPS[t.crop].name} ${CROPS[t.crop].emoji}`); }
              else if (kind === 2) t.wet = 1;
              else if (kind === 0 && t.crop) harvest(k, t);
            } }];
      });
    } },
  tagalong: { area: null, w: (k) => (sisterToFollow(k) ? 0.3 + ((100 - k.needs.love) / 100) * 3 : 0),
    plan(k) {
      const o = sisterToFollow(k);
      if (!o) return ACTS.idle.plan(k);
      return [{ label: `following ${o.name} 🐾`, dur: rand(15, 25), run(dt, s) {
        if (o.area !== k.area || o.hidden || o.asleep || s.t > s.dur) return true;
        if (!s.said) {
          s.said = 1;
          say(k, k.id === "teddy" ? pick([`wait for me ${o.name}!`, "can teddy come too?", `${o.name}… 🥺`]) : pick([`${o.name}! wait for me 💕`, "can i come too?", `i missed you ${o.name}!`]), 1600);
          later(() => say(o, o.id === "rose" ? `of course ${k.name}, hold my hand ♡` : o.id === "teddy" ? "…yay ♡ hold hands?" : `come on ${k.name}! 💨`), 1000);
        }
        const d = Math.hypot(o.x - k.x, o.y - k.y);
        s.re = (s.re || 0) - dt;
        if (d > 26 && s.re <= 0) { s.re = 0.5; setPath(k, ...tileOf(o.x, o.y)); }
        if (d > 22) walk(k, dt, k.speed * 1.3); else { k.path = []; k.frame = 0; faceTo(k, o.x, o.y); }
        up(k, "love", 1.2 * dt);
        return false;
      }, end() { bond(k, o, 0.05); achieve(k, "play"); remember(k, `${o.name} and i stayed together ♡`); } }];
    } },

  // ---------------- at home ----------------
  missmama: { area: HOM, w: (k) => (!taken("window", k) && !isNight() ? ((100 - k.needs.love) / 100) * (PERSONA[k.id].shy * 2.5 + 0.2) : 0),
    plan(k) {
      return [{ go: [14, 3], area: HOM, label: "going to the window", claim: "window" },
        { stay: rand(8, 12), label: "waiting for mama & papa at the window 🥺", face: "up", claim: "window",
          tick(dt, s) { s.c = (s.c || 0) + dt; if (s.c > 4) { s.c = 0; if (Math.random() < 0.5) say(k, pick(k.id === "teddy" ? ["con nhớ mẹ…", "when is mama coming?", "teddy loves mama and papa nhiều lắm", "papa… 🥺"] : ["i miss mama and papa…", "i hope mama comes soon ♡"]), 1800); } } }];
    } },
  dressup: { area: HOM, w: (k) => (!taken("dresser", k) && day() ? 0.1 + (PERSONA[k.id].acts.dressup ?? 0) * 0.35 : 0),
    plan(k) {
      return [{ go: [5, 12], area: HOM, label: "going to the dresser 👗", claim: "dresser" },
        { stay: rand(5, 7), label: "trying on outfits 👗", face: "down", claim: "dresser",
          tick(dt) { if (Math.random() < dt * 2) particle("star", k.x + rand(-8, 8), k.y - 30, pick(["#ffd966", "#ffb7d0"]), 1, 2, -14, HOM); },
          end() {
            if (k.accByYou && Date.now() - k.accByYou < 3 * 3600e3) { say(k, k.id === "rose" ? "i'll keep mama's one on, thank you ♡" : "keeping papa's one ♡", 1800); return; }
            k.acc = pick(k.id === "rose" ? ["tiara", "crown", "bow", "tiara"] : k.id === "blossom" ? ["party", "glasses", "crown", null] : ["bow", "bow", null]);
            k.hop = 1;
            say(k, k.acc ? pick(k.id === "rose" ? ["a real princess! 👑", "how do i look, mama? ♡"] : ["ta-da!", "do i look cute?"]) : "just me today hehe", 1800);
            remember(k, k.acc ? `i wore ${ACC_NAME[k.acc]}` : "i tried on outfits"); achieve(k, "dressup");
          } }];
    } },
  eat: { area: HOM, w: (k) => (freeIndex(k, 3, "chair") >= 0 ? hungry(k) ** 2 * 5 + (mealTime() && k.needs.hunger < 85 ? 3 : 0) + (world.plates > 0 && k.needs.hunger < 92 ? 1.5 : 0) : 0),
    plan(k) {
      const i = freeIndex(k, 3, "chair");
      if (i < 0) return ACTS.window.plan(k);
      const c = CHAIRS[i], plated = world.plates > 0, food = plated ? "pancake" : mealFood(), steps = [];
      if (!plated) steps.push({ go: [18, 4], area: HOM, label: "getting food from the fridge" },
        { stay: 1.6, face: "up", label: "looking in the fridge", start() { FRIDGE.openT = 1.6; }, end() { k.carry = food; } });
      steps.push({ go: c.tile, area: HOM, label: "going to the table", claim: "chair" + i },
        eatStep(k, food, { face: c.face, claim: "chair" + i, start() { if (plated) world.plates = Math.max(0, world.plates - 1); } }));
      return steps;
    } },
  cook: { area: HOM, w: (k) => (!taken("stove", k) && world.plates === 0 ? 0.2 + (mealTime() ? 0.8 : 0) : 0),
    plan(k) {
      return [{ go: [20, 4], area: HOM, label: "going to cook 🍳", claim: "stove" },
        { stay: rand(8, 11), label: "making pancakes 🥞", face: "up", claim: "stove",
          start() { STOVE.on = true; if (Math.random() < 0.6) say(k, pick(["i'm making pancakes!", "chef teddy… i mean me!", "who wants pancakes?"]), 1600); },
          tick(dt) { if (Math.random() < dt * 3) particle("steam", 20 * T + 8 + rand(-3, 3), 3 * T - 2, "#ffffff", 1, 2, -14, HOM); },
          end() { STOVE.on = false; world.plates = 3; remember(k, "i made pancakes for everyone 🥞"); achieve(k, "cook"); say(k, "pancakes for everyone! 🥞", 1800); KIDS.filter((o) => o.area === HOM && o !== k && !busy(o) && INTERRUPTIBLE.includes(o.act)).forEach((o) => { say(o, "yay pancakes!", 1300); interrupt(o, "eat"); }); } }];
    } },
  tv: { area: HOM, w: (k) => (freeIndex(k, 3, "sofa") >= 0 ? 0.5 + (world.tvUser ? 1.5 : 0) + (raining() ? 0.5 : 0) : 0),
    plan(k) {
      const i = Math.max(0, freeIndex(k, 3, "sofa")), s = SOFA_SEATS[i];
      return seatSteps(k, HOM, s.approach, s.pos, { stay: rand(14, 22), label: "watching cartoons 📺", pose: "sofa", face: "up", claim: "sofa" + i,
        tick(dt, st) { up(k, "fun", 2 * dt); up(k, "energy", 0.4 * dt); st.c = (st.c || 0) + dt; if (st.c > 7) { st.c = 0; if (Math.random() < 0.5) say(k, pick(["hahaha", "again again!", "this is my favourite one", "shhh it's the good part"]), 1400); } } }, "going to the sofa");
    } },
  piano: { area: HOM, w: (k) => (!taken("piano", k) ? 0.45 : 0),
    plan(k) {
      return seatSteps(k, HOM, [15, 4], [16 * T, 4 * T + 10], { stay: rand(10, 16), label: "playing the piano 🎹", pose: "piano", face: "up", claim: "piano",
        tick(dt, s) {
          s.n = (s.n || 0) + dt;
          if (s.n > 0.36) {
            s.n = 0; k.frame ^= 1;
            particle("note", 16 * T + rand(-10, 10), 3 * T - 6, pick(["#f48fb4", "#ffd966", "#9db8ff"]), 1, 2, -16, HOM);
            if (cam.area === HOM && ac && !muted && Math.random() < 0.85) tone(pick(PENTA) / (Math.random() < 0.3 ? 2 : 1), { type: "triangle", dur: 0.45, vol: 0.035 });
          }
          up(k, "fun", 2.5 * dt);
        } }, "going to the piano");
    } },
  read: { area: HOM, w: (k) => (freeIndex(k, RUG_SPOTS.length, "rug") >= 0 ? 0.5 : 0),
    plan(k) {
      const i = Math.max(0, freeIndex(k, RUG_SPOTS.length, "rug"));
      return [{ go: [10, 4], area: HOM, label: "picking a storybook 📚" }, { stay: 1.4, face: "up", label: "picking a storybook 📚" },
        { go: RUG_SPOTS[i], area: HOM, label: "finding a cosy spot", claim: "rug" + i },
        { stay: rand(12, 18), label: "reading a storybook 📖", pose: "sit", item: "book", face: "down", claim: "rug" + i,
          tick(dt, s) { up(k, "fun", 1.5 * dt); s.c = (s.c || 0) + dt; if (s.c > 7) { s.c = 0; if (Math.random() < 0.4) say(k, pick(["once upon a time…", "the bunny princess…", "and they lived happily ever after ♡"]), 1700); } } }];
    } },
  draw: { area: HOM, w: (k) => (freeIndex(k, 3, "chair") >= 0 ? 0.5 : 0),
    plan(k) {
      const i = freeIndex(k, 3, "chair");
      if (i < 0) return ACTS.window.plan(k);
      const c = CHAIRS[i];
      return [{ go: c.tile, area: HOM, label: "getting her crayons 🖍️", claim: "chair" + i },
        { stay: rand(10, 14), label: "drawing a picture 🖍️", pose: "sit", item: "crayon", face: c.face, claim: "chair" + i,
          tick(dt) { up(k, "fun", 2 * dt); },
          end() { if (!k.gift) { k.gift = "drawing"; say(k, pick(["i drew mama & papa!", "a picture for mama!", "look what i drew!"]), 1800); } else { world.drawings++; say(k, "on the fridge it goes!", 1500); } } }];
    } },
  toys: { area: HOM, w: (k) => (freeIndex(k, BEDROOM_RUG.length, "toyrug") >= 0 ? 0.5 : 0),
    plan(k) {
      const i = Math.max(0, freeIndex(k, BEDROOM_RUG.length, "toyrug"));
      return [{ go: [1, 12], area: HOM, label: "getting her toys 🧸" }, { stay: 1.2, face: "down", label: "opening the toy chest" },
        { go: BEDROOM_RUG[i], area: HOM, label: "playing with her toys 🧸", claim: "toyrug" + i },
        { stay: rand(10, 15), label: pick(["playing with her toys 🧸", "building with blocks 🧱", "having a dolly tea party 🫖"]), pose: "crouch", face: "down", claim: "toyrug" + i,
          tick(dt) { up(k, "fun", 2.5 * dt); if (Math.random() < dt * 0.6) particle("star", k.x + rand(-8, 8), k.y - 10, pick(["#ffd966", "#ffb7d0"]), 1, 2, -14, HOM); } }];
    } },
  bath: { area: HOM, w: (k) => (!taken("tub", k) ? ((100 - k.needs.clean) / 100) ** 2 * 6 + (hourNow() >= 19.5 && !bedtime() && k.needs.clean < 85 ? 2.5 : 0) : 0),
    plan(k) {
      return seatSteps(k, HOM, TUB_SEAT.approach, TUB_SEAT.pos, { stay: rand(12, 18), label: "having a bubble bath 🛁", pose: "tub", face: "down", claim: "tub",
        start() { if (Math.random() < 0.6) say(k, pick(["bubble bath!!", "rubber ducky! 🦆", "splish splash"]), 1500); },
        tick(dt) { up(k, "clean", 8 * dt); if (Math.random() < dt * 2) particle("bubble", k.x + rand(-14, 14), k.y - 12, "#ffffff", 1, 2, -10, HOM); },
        end() { k.needs.clean = 100; say(k, pick(["all clean! ✨", "i smell like strawberries", "squeaky clean!"]), 1500); } }, "running a bubble bath 🛁");
    } },
  bednap: { area: HOM, w: (k) => (day() && k.needs.energy < 30 ? 5 : 0), plan: (k, o) => bedSteps(k, false, o) },
  sleep: { area: HOM, w: (k) => (bedtimeFor(k) && !(k.upLate > world.t) ? 500 : 0), plan: (k, o) => bedSteps(k, true, o) },
  window: { area: HOM, w: (k) => (!taken("window", k) ? 0.25 : 0),
    plan(k) {
      return [{ go: [14, 3], area: HOM, label: "going to the window", claim: "window" },
        { stay: rand(6, 10), label: "looking out the window 🪟", face: "up", claim: "window",
          start() { say(k, isNight() ? "i can see the stars ✨" : raining() ? pick(["it's raining…", "drip drop drip", "can we jump in puddles later?"]) : pick(["it's so sunny!", "i can see kitty!", "hi butterflies!"]), 1800); } }];
    } },
  teaparty: { area: HOM, w: (k) => (partnerFor(k) && k.area === HOM && [0, 1, 2].filter((i) => !taken("chair" + i, k)).length >= 2 ? 0.35 : 0),
    plan(k) {
      const p = partnerFor(k), seats = [0, 1, 2].filter((i) => !taken("chair" + i, k));
      if (!p || seats.length < 2) return ACTS.window.plan(k);
      const sip = (me, i, mate) => [{ go: CHAIRS[i].tile, area: HOM, label: "going to the tea party 🫖", claim: "chair" + i },
        { stay: 14, label: `having a tea party with ${mate.name} 🫖`, pose: "sit", item: "tea", face: CHAIRS[i].face, claim: "chair" + i,
          start() { world.tea = (world.tea || 0) + 1; }, tick(dt, s) { up(me, "love", 1.5 * dt); s.c = (s.c || 0) + dt; if (s.c > 3) { s.c = 0; if (Math.random() < 0.5) say(me, pick(["more tea, madam?", "pinky up!", "*sip* ♡", "so fancy"]), 1300); } },
          end() { world.tea = Math.max(0, (world.tea || 1) - 1); hearts(me, 3); bond(me, mate, 0.04); achieve(me, "tea"); achieve(me, "play"); remember(me, `tea party with ${mate.name} 🫖`); } }];
      recruit(p, "teaparty", sip(p, seats[1], k));
      say(k, `tea party ${p.name}? 🫖`, 1400);
      return sip(k, seats[0], p);
    } },
};
const THINK = { myplot: "🌱", tagalong: "🐾", missmama: "🥺", dressup: "👗", ball: "⚽", bubbles: "🫧", hide: "🙈", stroll: "🤝", flowers: "🌷", butterfly: "🦋", pond: "🦆", swing: "🎀", slide: "🛝", sandbox: "🏰", beach: "🌊", shells: "🐚", picnic: "🍓",
  nap: "💤", chat: "💬", tag: "🏃‍♀️", fishing: "🎣", seesaw: "⚖️", shop: "🛒", icecream: "🍦", apples: "🍎", garden: "🌱", kite: "🪁", fountain: "⛲", kitty: "🐱", puddles: "💦",
  eat: "🍽️", cook: "🍳", tv: "📺", piano: "🎹", read: "📖", draw: "🖍️", toys: "🧸", bath: "🛁", bednap: "😴", sleep: "🌙", teaparty: "🫖", cloudgaze: "☁️" };

// bedtime, or a little nap: brush teeth first at night, then into her own bed
function bedSteps(k, night, opts = {}) {
  const b = BEDS[KID_BED[k.id] ?? 0];
  const bed = seatSteps(k, HOM, b.approach, b.pos, {
    stay: night ? Infinity : rand(40, 80), pose: "bed", label: night ? "sleeping in her bed 💤" : "napping in her bed 💤", claim: "bed" + k.id,
    start() {
      k.asleep = true; sleepLog[k.id] = sleepLog[k.id] || Date.now(); saveSleep();
      if (!opts.quiet && Math.random() < 0.7) say(k, night ? pick(GOODNIGHT) : "just a little nap…", 1600);
    },
    tick(dt, s) {
      up(k, "energy", (night ? 0.4 : 1.5) * dt);
      if (Math.random() < dt * 0.5) particle("z", k.x + 8, k.y - 26, "#9db8ff", 1, 2, -10, HOM);
      if (cam.area === HOM && Math.random() < dt * 0.012) say(k, pick(SLEEP_TALK), 1800);
      if (night && !bedtimeFor(k) && Math.random() < dt * (hourNow() > 8.5 ? 0.2 : 0.025)) s.dur = 0; // morning!
    },
    end() {
      k.asleep = false; delete sleepLog[k.id]; saveSleep();
      if (bedtime()) say(k, pick(["mama i can't sleep…", "i'm not sleepy!", "*yawn* where are we going?"]), 1600);
      else say(k, night ? pick(MORNING) : pick(["that was a nice nap ♡", "*yawn* i'm awake!", "i had a dream about mama"]), 1600);
    },
  }, night ? "going to bed 🌙" : "going for a nap 😴");
  if (opts.inBed) { k.seatFrom = b.approach; [k.x, k.y] = b.pos; k.asleep = true; k.pose = "bed"; return bed.slice(2); }
  if (!night || opts.quick) return bed;
  return [{ go: [18, 11], area: HOM, label: "brushing her teeth 🪥" }, { stay: 3, label: "brushing her teeth 🪥", face: "up", item: "toothbrush" }, ...bed];
}

function tagStep(k, game) {
  return { label: "playing tag 🏃‍♀️", run(dt, s) {
    game.t += dt / 2;
    const other = k === game.first ? game.other : game.first;
    if (other.area !== k.area || other.act !== "tag") return true;
    if (game.it === k) {
      s.re = (s.re || 0) - dt;
      if (s.re <= 0) { s.re = 0.4; setPath(k, ...tileOfKid(other)); }
      walk(k, dt, k.speed * 1.55);
      if (Math.hypot(other.x - k.x, other.y - k.y) < 19 && game.t > 1) {
        game.swaps++; game.it = other; game.t = 0;
        feel(k, null, { excited: 0.15, proud: 0.1 }); feel(other, null, { excited: 0.1, grumpy: 0.04 * (1 - PERSONA[other.id].traits.playful) });
        say(k, pick(["tag!", "got you!", "you're it!"]), 1200); hearts(k, 2);
        other.path = []; other.wait = 1;
      }
    } else {
      if (k.wait > 0) { k.wait -= dt; k.frame = 0; }
      else if (walk(k, dt, k.speed * 1.45)) setPath(k, ...randomTile(I, 6, tileOfKid(game.it)));
    }
    if (game.swaps >= 4 || game.t > 14) { if (!s.done) {
      s.done = 1; achieve(k, "play"); bond(k, other, 0.02); say(k, pick(["hehe i'm tired", "again later!", "that was fun!"]), 1500);
      if (game.it === k && PERSONA[k.id].traits.brave + PERSONA[k.id].traits.mischief > 1) { k.mind.rematch = other.id; remember(k, `${other.name} won at tag`); }
    } return true; }
    return false;
  } };
}

// ---------- choosing and running ----------
function sisterToFollow(k) {
  const o = others(k).filter((o) => o.area === k.area && !o.asleep && !o.hidden && !o.held && o.act !== "tagalong");
  return o.length ? fairest(k, o) : null;
}
// picking what to plant: her favourites, sometimes something new (vimi loves trying new things)
function chooseCrop(k) {
  const P = PERSONA[k.id], m = k.mind;
  let best = null;
  Object.keys(CROPS).forEach((id) => {
    const growing = plotOf(k).tiles.filter((t) => t.crop === id).length;
    const novel = !m.planted[id], like = m.crops[id] ?? 0.1, v = like + (novel ? P.curious * 0.5 : 0) + rand(0, 0.45) - growing * 0.3; // she likes a bit of everything
    if (!best || v > best.v) best = { id, v, novel, like };
  });
  const c = CROPS[best.id];
  best.why = best.novel && best.like < 0.5 ? pick([`i've never grown ${c.name} before! ${c.emoji}`, `let's see what ${c.name} are like…`]) : pick(P.plant(c));
  return best;
}
// harvest time: what she does with it is up to her
function harvest(k, t) {
  const id = t.crop, c = CROPS[id];
  t.crop = null; t.g = 0;
  k.mind.crops[id] = clamp((k.mind.crops[id] ?? 0.3) + rand(-0.05, 0.25), -0.5, 1.5);
  remember(k, `i grew ${c.name} ${c.emoji}`); achieve(k, "harvest");
  particle("star", k.x, k.y - 30, "#ffd966", 5, 8, -20, ISL); k.hop = 1;
  const sis = others(k).filter((o) => o.area === ISL && !o.asleep && !o.hidden && !busy(o));
  if (c.flower || c.keep) {
    if (!k.gift && (k.id === "teddy" || Math.random() < 0.7)) { k.gift = id; say(k, k.id === "teddy" ? `${c.one} for mama… ♡` : `${c.one} for mama! ${c.emoji}`, 2000); }
    else { world.vase = id; say(k, `for the vase at home ${c.emoji}`, 1800); }
  } else if (k.id === "teddy" && !k.gift && Math.random() < 0.6) { k.gift = id; say(k, `teddy saved ${c.one} for mama ♡`, 2000); }
  else if (sis.length && Math.random() < 0.25 + PERSONA[k.id].social * 0.3 + (k.id === "rose" ? 0.3 : 0)) { k.carry = id; k.steps.unshift(...shareSteps(k, pick(sis), id)); }
  else { k.carry = id; k.steps.unshift(eatStep(k, id, { face: "down" })); }
}
function shareSteps(k, o, id) {
  return [{ label: `bringing ${CROPS[id].one} to ${o.name}`, dur: 20, run(dt, s) {
    if (o.area !== k.area || s.t > s.dur) return true;
    s.re = (s.re || 0) - dt;
    if (s.re <= 0) { s.re = 0.6; const tt = tileOf(o.x + (k.x < o.x ? -14 : 14), o.y); setPath(k, ...(I.walk(...tt) ? tt : nearestWalkable(I, ...tt))); }
    walk(k, dt);
    if (Math.hypot(o.x - k.x, o.y - k.y) >= 26) return false;
    k.carry = null; k.path = []; faceTo(k, o.x, o.y);
    say(k, k.id === "rose" ? `for you ${o.name} ♡` : `${o.name}! try this!`, 1600);
    later(() => say(o, o.id === "rose" ? "thank you so much ♡" : o.id === "teddy" ? "…thank you ♡" : "yay!! thanks!", 1500), 600);
    up(o, "hunger", 20); up(o, "love", 12); up(k, "love", 8); bond(k, o, 0.08); hearts(k, 3); hearts(o, 4);
    remember(o, `${k.name} gave me ${CROPS[id].one}`); remember(k, `i shared ${CROPS[id].name} with ${o.name}`);
    return true;
  } }];
}
function doActivity(k, id, opts) {
  snapOff(k); mindFinish(k);
  k.act = id; k.last = id; k.path = []; k.step = null;
  const a = ACTS[id];
  let steps = a.plan(k, opts) || [];
  if (!steps.length) steps = ACTS.idle.plan(k);
  if (a.area && a.area !== k.area && !("go" in steps[0])) steps = [...travel(k, a.area), ...steps];
  k.steps = steps;
  k.claims = steps.map((s) => s.claim).filter(Boolean);
  mindStart(k, id, k.wantWith || k.wantHiders?.[0] || null);
  k.wantWith = null; k.wantHiders = null;
  if (THINK[id] && Math.random() < 0.3 && !k.bubble.classList.contains("show")) say(k, THINK[id], 1200);
}
function startStep(k, s) {
  if (!s) return;
  if ("go" in s && s.area && s.area !== k.area) { const tr = travel(k, s.area); k.steps.unshift(...tr.slice(1), s); s = tr[0]; }
  k.step = s;
  s.t = 0;
  k.pose = s.pose || "stand";
  k.item = s.item || null;
  if (s.face) k.dir = s.face;
  if ("go" in s) setPath(k, ...s.go); else if (!s.run) k.path = [];
  if ("stay" in s) s.dur = s.stay;
  if (s.label) k.label = s.label;
  s.start?.call(s, s);
}
function endStep(k) {
  const s = k.step;
  k.step = null;
  if (!s) return;
  s.end?.call(s, s);
  k.item = null;
  k.pose = "stand";
}
function interrupt(k, id, opts) {
  if (k.held) return;
  endStep(k);
  doActivity(k, id, opts);
}

function updateKid(k, dt) {
  world.pa = k.area;
  const n = k.needs;
  const b = PERSONA[k.id].body;
  if (!k.asleep) { n.energy -= 0.011 * dt * b.energy; n.hunger -= 0.04 * dt * b.hunger; n.fun -= 0.025 * dt * b.fun; n.clean -= 0.005 * dt * b.clean; }
  else n.hunger -= 0.004 * dt;
  n.love -= 0.009 * dt * b.love;
  for (const key in n) n[key] = clamp(n[key], 3, 100);
  mindTick(k, dt);
  k.hop = Math.max(0, k.hop - dt * 4);
  if (k.held) { k.dist += dt; if (k.dist > 0.09) { k.dist = 0; k.frame ^= 1; } return; }
  if (k.patted) {
    k.patT = (k.patT || 0) + dt;
    up(k, "love", 12 * dt);
    if (k.patT > 0.3) { k.patT = 0; particle("heart", k.x + rand(-6, 6), k.y - 30, pick(["#f48fb4", "#ff7fa8", "#ffb7d0"]), 1, 3); tone(rand(300, 360), { type: "sine", dur: 0.18, vol: 0.05 }); }
    return;
  }
  if (k.spin > 0) {
    k.spin -= dt; k.spinT = (k.spinT || 0) + dt;
    if (k.spinT > 0.08) { k.spinT = 0; k.dir = { down: "left", left: "up", up: "right", right: "down" }[k.dir]; }
    if (Math.random() < dt * 8) particle("star", k.x + rand(-10, 10), k.y - 34, pick(["#ffd966", "#fff"]), 1, 2);
    return;
  }
  if (k.lift > 0 && !k.hopping) k.lift = Math.max(0, k.lift - dt * 60);

  if (!k.step) {
    if (!k.steps.length) chooseActivity(k);
    startStep(k, k.steps.shift());
    if (!k.step) return;
  }
  const s = k.step;
  s.t += dt;
  if ("go" in s) {
    if (walk(k, dt, s.speed || k.speed)) { k.frame = 0; endStep(k); return; }
    // if someone's in the way for too long, she squeezes past
    const left = k.path.length ? Math.hypot(k.path[0][0] - k.x, k.path[0][1] - k.y) + k.path.length * T : 0;
    if (left < (s.best ?? Infinity) - 2) { s.best = left; s.stuck = 0; } else if ((s.stuck = (s.stuck || 0) + dt) > 1.6) { k.ghost = 1.2; s.stuck = 0; s.best = left; }
    return;
  }
  if (s.run) { if (s.run.call(s, dt, s)) { k.frame = 0; endStep(k); } return; }
  if (s.faceKid) faceTo(k, s.faceKid.x, s.faceKid.y);
  s.tick?.call(s, dt, s);
  if (k.pose === "dance") {
    s.beat = (s.beat || 0) + dt;
    if (s.beat > 0.4) {
      s.beat = 0; k.frame ^= 1; k.hop = 1;
      k.dir = { down: "left", left: "up", up: "right", right: "down" }[k.dir];
      particle("note", k.x + rand(-10, 10), k.y - 34, pick(["#f48fb4", "#ffd966", "#9db8ff"]), 1, 2);
    }
  } else if (k.pose !== "piano") k.frame = 0;
  if (s.t >= s.dur) endStep(k);
}

// ---------- kitty: she wanders, naps in the sun, follows the girls, sleeps on the porch at night ----------
function catWalk(dt, speed) {
  if (!cat.path.length) return true;
  const [tx, ty] = cat.path[0], dx = tx - cat.x, dy = ty - cat.y, d = Math.hypot(dx, dy);
  if (d < 0.6) { cat.x = tx; cat.y = ty; cat.path.shift(); return !cat.path.length; }
  if (Math.abs(dx) > 0.3) cat.dir = dx > 0 ? 1 : -1;
  const s = Math.min(d, speed * dt);
  cat.x += (dx / d) * s; cat.y += (dy / d) * s;
  cat.dist += s; if (cat.dist > 5) { cat.dist = 0; cat.frame ^= 1; }
  return false;
}
function catGo(tx, ty) { const p = findPath(I, ...tileOf(cat.x, cat.y), tx, ty); cat.path = (p || []).map(([x, y]) => [x * T + 8, y * T + 12]); }
function updateCat(dt) {
  cat.hop = Math.max(0, cat.hop - dt * 4);
  if (cat.petBy) { cat.state = "pet"; cat.path = []; if (Math.random() < dt * 1.5) particle("heart", cat.x, cat.y - 12, "#ffb7d0", 1, 2, -14, ISL); return; }
  if (cat.state === "pet") { cat.state = "sit"; cat.t = 2; }
  if (isNight() && cat.state !== "home") { cat.state = "home"; catGo(24, 11); }
  if (!isNight() && cat.state === "home" && !cat.path.length) { cat.state = "sit"; cat.t = 2; }
  if (cat.path.length) { catWalk(dt, cat.state === "follow" ? 30 : 20); return; }
  if (cat.state === "home") return;
  cat.t -= dt;
  if (cat.state === "follow" && cat.follow && cat.follow.area === ISL && cat.t > 0) { const t = tileOf(cat.follow.x + 14, cat.follow.y); if (Math.random() < dt * 2) catGo(...(I.walk(...t) ? t : nearestWalkable(I, ...t))); return; }
  if (cat.t > 0) return;
  const r = Math.random();
  if (r < 0.45) { cat.state = "walk"; catGo(...randomTile(I, 0, null, (x, y) => Math.abs(x * T - cat.x) < 140 && Math.abs(y * T - cat.y) < 110)); cat.t = rand(1, 3); }
  else if (r < 0.72) { cat.state = "nap"; cat.t = rand(15, 35); }
  else if (r < 0.88) { const k = pick(KIDS.filter((k) => k.area === ISL && !k.hidden)); if (k) { cat.state = "follow"; cat.follow = k; cat.t = rand(10, 20); } }
  else { cat.state = "sit"; cat.t = rand(3, 7); }
}

function updateWorld(dt) {
  world.t += dt;
  world.pa = ISL;
  const night = isNight();
  if ((world.wT = (world.wT || 0) - dt) <= 0) { world.wT = 10; world.weather = weatherNow(); }
  world.wet = raining() ? Math.min(1, world.wet + dt / 90) : Math.max(0, world.wet - dt / 400);
  butterflies.forEach((b) => {
    b.a += dt * rand(0.5, 1.5);
    b.vx += Math.cos(b.a) * 40 * dt; b.vy += Math.sin(b.a * 1.3) * 40 * dt;
    b.vx *= 0.97; b.vy *= 0.97;
    b.x = clamp(b.x + b.vx * dt, 40, I.PW - 40); b.y = clamp(b.y + b.vy * dt, 50, 450);
  });
  fireflies.forEach((f) => { f.a += dt; f.x += Math.cos(f.a * 0.7) * 6 * dt; f.y += Math.sin(f.a * 0.9) * 5 * dt; });
  clouds.forEach((c) => { c.x += c.v * dt; if (c.x - c.r > I.PW) { c.x = -c.r * 2; c.y = rand(0, I.PH); } });
  ducks.forEach((d) => {
    const g = world.duckGoal;
    if (g && g.until > world.t) {
      d.vx = clamp(d.vx + Math.sign(g.x - d.x) * 14 * dt, -12, 12); d.vy = clamp(d.vy + Math.sign(g.y - d.y) * 10 * dt, -8, 8);
      if (Math.hypot(g.x - d.x, g.y - d.y) < 8) { d.vx *= 0.9; d.vy *= 0.9; }
    }
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (I.at(...tileOf(d.x, d.y)) !== WATER || I.at(...tileOf(d.x + Math.sign(d.vx) * 8, d.y)) !== WATER) { d.vx = -d.vx; d.x += d.vx * dt * 2; }
    if (I.at(...tileOf(d.x, d.y + Math.sign(d.vy) * 6)) !== WATER) { d.vy = -d.vy; d.y += d.vy * dt * 2; }
    if (Math.random() < dt * 0.1) { d.vx = rand(-7, 7); d.vy = rand(-3, 3); }
  });
  fish.forEach((f) => { f.a += dt * 0.6; const nx = f.x + Math.cos(f.a) * 8 * dt, ny = f.y + Math.sin(f.a * 1.7) * 5 * dt; if (I.at(...tileOf(nx, ny)) === WATER && ny < 14 * T) { f.x = nx; f.y = ny; } else f.a += 2; });
  if (Math.random() < dt * 0.25) { const [x, y] = pick(pondTiles); particle("splash", x * T + 8, y * T + 8, "#e8f7ff", 5, 3, -18); }
  if (!night && Math.random() < dt * 1.2) { const o = pick(I.objs.filter((o) => o.type === "tree" && o.kind === "cherry")); particle("petal", o.tx * T + rand(4, 28), o.ty * T + rand(0, 16), pick(["#ffb7d0", "#fff", "#ff9fbf"]), 1, 2, 6); }
  // smoke from the chimney when someone's home
  const home = KIDS.filter((k) => k.area === HOM);
  if (home.length && Math.random() < dt * (STOVE.on ? 3 : 0.8)) particle("smoke", HOUSE.tx * T + 100, HOUSE.ty * T - 2, "#fffaf2", 1, 2, -12, ISL);
  I.objs.forEach((o) => { if (o.shake) o.shake = Math.max(0, o.shake - dt * 3); });
  HOUSE.doorT = Math.max(0, HOUSE.doorT - dt); SHOP.doorT = Math.max(0, SHOP.doorT - dt); FRIDGE.openT = Math.max(0, FRIDGE.openT - dt);
  // the garden grows (faster when watered, and the rain waters it)
  PLOTS.forEach((p) => p.tiles.forEach((t) => { if (!t.crop) return; if (raining()) t.wet = 1; t.wet = Math.max(0, t.wet - dt / 600); if (t.g < 1) t.g = Math.min(1, t.g + (dt / CROPS[t.crop].grow) * (t.wet > 0.05 ? 1 : 0.15)); }));
  PLANTS.forEach((p) => { if (raining()) p.wet = 1; p.wet = Math.max(0, p.wet - dt / 900); p.g = Math.min(3, p.g + dt * (p.wet > 0.05 ? 1 / 500 : 1 / 2500)); });
  // apples grow back
  APPLE_TREES.forEach((o) => { if (o.apples < 5) { o.grow = (o.grow || 0) + dt; if (o.grow > 240) { o.grow = 0; o.apples++; } } });
  updateCat(dt);
  // the ball rolls, bounces, and stops at walls and water
  const b = world.ball;
  if (b) {
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    if (I.walk(...tileOf(nx, b.y))) b.x = nx; else b.vx = -b.vx * 0.6;
    if (I.walk(...tileOf(b.x, ny))) b.y = ny; else b.vy = -b.vy * 0.6;
    const f = Math.exp(-1.1 * dt); b.vx *= f; b.vy *= f;
    b.roll += (Math.hypot(b.vx, b.vy) * dt) / 3;
    b.vh -= 300 * dt; b.h += b.vh * dt;
    if (b.h < 0) { b.h = 0; b.vh = Math.abs(b.vh) > 25 ? -b.vh * 0.45 : 0; }
  }
  world.bubbles.forEach((bb) => {
    bb.life -= dt; bb.alt += 3 * dt;
    bb.x += bb.vx * dt + Math.sin(world.t * 2 + bb.ph) * 5 * dt; bb.y += bb.vy * dt;
    if (bb.life <= 0 || bb.alt > 60) popBubble(bb, true);
  });
  world.bubbles = world.bubbles.filter((bb) => !bb.popped);
  if (world.party > 0) {
    world.party -= dt;
    if (Math.random() < dt * 4) particle(pick(["note", "star"]), world.partyAt[0] + rand(-40, 40), world.partyAt[1] - rand(10, 40), pick(["#f48fb4", "#ffd966", "#9db8ff", "#fff"]), 1, 2, -20, world.partyArea);
  }
  if (raining() && cam.area === ISL && Math.random() < dt * 14) {
    const x = cam.x + rand(0, canvas.width), y = cam.y + rand(0, canvas.height), t = I.at(...tileOf(x, y));
    world.parts.push({ type: "ring", area: ISL, x, y, vx: 0, vy: 0, life: 0.5, color: t === WATER ? "#e8f7ff" : "#cfe3f2" });
  }
  world.parts = world.parts.filter((p) => {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.type === "petal") { p.vx += Math.sin(world.t * 3 + p.y) * 10 * dt; p.vy = Math.min(p.vy + 10 * dt, 14); }
    else if (p.type === "smoke" || p.type === "steam") { p.vx = Math.sin(world.t * 2 + p.y * 0.1) * 6; }
    else if (p.type === "coin") p.vy += 100 * dt;
    else if (!["heart", "z", "note", "star", "bubble", "ring"].includes(p.type)) p.vy += 90 * dt;
    return p.life > 0;
  });
}

// ======================================================================
// drawing
// ======================================================================
const view = $("#view"), canvas = $("#scene"), ctx = canvas.getContext("2d");
let scale = 2, mapMode = false;
const cam = { area: ISL, x: 0, y: 0, mode: "auto", target: null, switchT: 0 };

const ITEMS = {
  cookie: [".xx.", "xyxx", "xxyx", ".xx."], strawberry: [".g.", "rrr", "rwr", ".r."], milk: ["ww", "ww", "pw"], onigiri: [".w.", "www", "wkw"],
  flower: ["p.p", ".y.", "p.p", ".g."], shell: [".pp.", "pwwp", "pppp"], apple: [".g.", "rrr", "rrr", ".r."], icecream: [".p.", "ppp", ".x.", ".x."],
  bread: [".xx.", "xyyx", "xxxx"], banhmi: [".xxxx", "xgrgx", "xxxx."], cake: [".r.", "www", "ppp"], pancake: ["yyy", "xxx", "xxx"],
  pho: ["wyw", "xxx", ".x."], rice: [".ww.", "wwww", "pppp"], letter: ["wwww", "wppw", "wwww"], drawing: ["wwww", "wpyw", "wbgw", "wwww"],
  can: ["..bb", "bbb.", "bbb."], blueberry: [".u.", "uuu", ".u."], carrot: ["..g", ".o.", "o.."], tomato: [".g.", "rrr", "rrr"], watermelon: ["gggg", "rrrr", ".rr."],
  rose: ["rr.", "rrr", ".g."], tulip: ["p.p", "ppp", ".g."], lavender: ["v", "v", "v", "g"], daisy: ["w.w", ".y.", "w.w", ".g."], sunflower: [".y.", "yny", ".y.", ".g."], pumpkin: [".g.", "ooo", "ooo"], book: ["pp", "pp", "pw"], crayon: ["p", "p", "w"], tea: ["w.", "ww"], toothbrush: ["b", "w", "w"],
};
const ITEM_COLORS = { u: "#6a7fe0", o: "#ff9a4a", v: "#b59cf0", n: "#8a5a2b", x: "#d9a77a", y: "#ffd966", g: "#86b35a", r: "#e2405a", w: "#fffaf2", p: "#f48fb4", k: "#2b1b24", b: "#9fd0f2" };

function seesawTilt() {
  const g = SEESAW.game;
  if (!g) return 0;
  if (g.on) return Math.sin(world.t * 2.4) * 0.2;
  const seated = g.riders.filter((r) => r.act === "seesaw" && r.pose === "seesaw");
  if (seated.length === 1) return seated[0] === g.riders[0] ? -0.2 : 0.2; // her side goes down
  return 0;
}
function kidDraw(k) {
  if (k.hidden) return;
  const x = Math.round(k.x), y = Math.round(k.y), pose = k.pose;
  if (pose === "bed") { ctx.drawImage(k.asleep ? k.sleepSpr : k.spr.front[0], x - 16, y - 32); return; }
  if (pose === "nap" || pose === "lie") {
    ctx.fillStyle = "rgba(60,40,70,.15)"; ctx.fillRect(x - 15, y - 2, 30, 4);
    ctx.save(); ctx.translate(x, y - 8); ctx.rotate(-Math.PI / 2); ctx.drawImage(pose === "nap" ? k.sleepSpr : k.spr.front[0], -16, -17); ctx.restore();
    return;
  }
  let oy = 0;
  if (pose === "sit" || pose === "sofa" || pose === "piano") oy = 3;
  if (pose === "fish") oy = 3;
  if (pose === "tub") oy = 4;
  if (pose === "crouch") oy = 2 + Math.round(Math.abs(Math.sin(world.t * 6)));
  if (pose === "swing") oy = Math.round(Math.sin(world.t * 2.6 + (k.swingSeat || 0) * 1.3) * 4) - 2;
  if (pose === "seesaw") oy = Math.round((k.x - (SEESAW.tx + 2) * T - 8) * seesawTilt()) - 3;
  oy -= Math.round(k.hop * 4) + Math.round(k.lift);
  if (!["tub", "sofa", "swing", "seesaw"].includes(pose)) { ctx.fillStyle = "rgba(60,40,70,.18)"; ctx.fillRect(x - 8, y - 1, 16, 3); }
  const v = k.held || k.patted ? "front" : k.dir === "up" ? "back" : k.dir === "down" ? "front" : "side";
  const img = k.patted ? k.sleepSpr : k.spr[v][k.frame];
  ctx.save();
  ctx.translate(x, y + oy);
  if (k.held) ctx.rotate(Math.sin(world.t * 12) * 0.15);
  if (k.patted) ctx.scale(1 + Math.sin(world.t * 10) * 0.03, 1 - Math.sin(world.t * 10) * 0.03);
  if (k.dir === "left" && v === "side") ctx.scale(-1, 1);
  ctx.drawImage(img, -16, -32);
  if (k.acc) drawAcc(k, v);
  const it = k.item || k.carry || (k.gift && !k.held ? k.gift : null);
  if (it && ITEMS[it] && v !== "back") pixels(ctx, ITEMS[it], v === "side" ? 8 : 6, -16, ITEM_COLORS);
  ctx.restore();
  // the swing seat and ropes in front of her
  if (pose === "swing") { const sy = y + oy + 1, top = SWINGS.ty * T - 6; R(ctx, "#8a6a55", x - 5, top, 1, sy - top); R(ctx, "#8a6a55", x + 5, top, 1, sy - top); box(ctx, x - 7, sy, 15, 4, "#ffd966"); }
  // a fishing rod, and her kite way up in the sky
  if (pose === "fish") { const bob = Math.round(Math.sin(world.t * 3) * 1); line(ctx, "#8a6a55", x + 6, y + oy - 14, x + 4, y - 38); line(ctx, "rgba(255,255,255,.8)", x + 4, y - 38, x + 3, y - 44 + bob); R(ctx, "#e2405a", x + 2, y - 45 + bob, 3, 2); R(ctx, "#fff", x + 2, y - 43 + bob, 3, 1); }
  if (pose === "kite") {
    const kx = x + 28 + Math.round(Math.sin(world.t * 0.9) * 10), ky = y - 86 + Math.round(Math.cos(world.t * 1.3) * 6);
    line(ctx, "rgba(255,255,255,.85)", x + 4, y + oy - 18, kx, ky + 6);
    pixels(ctx, ["...x...", "..xpx..", ".xpppx.", "xpypypx", ".xpppx.", "..xpx..", "...x..."], kx - 3, ky - 3, { x: INK, p: "#ffb7d0", y: "#ffd966" });
    for (let i = 1; i < 5; i++) R(ctx, i % 2 ? "#ffd966" : "#f48fb4", kx + Math.round(Math.sin(world.t * 3 + i) * 2), ky + 4 + i * 3, 2, 2);
  }
  // blocks next to her when she plays with toys
  if (k.act === "toys" && pose === "crouch") { box(ctx, x - 13, y - 5, 5, 5, "#ffd966"); box(ctx, x + 8, y - 5, 5, 5, "#9db8ff"); box(ctx, x + 10, y - 10, 5, 5, "#ffb7d0"); }
  // a little umbrella when it rains
  if (raining() && k.area === ISL && !k.held && k.act !== "puddles" && !["tub", "bed"].includes(pose)) {
    const ux = x + (v === "side" ? (k.dir === "left" ? -4 : 4) : 3), uy = y + oy - 40;
    R(ctx, INK, ux, uy, 1, 16);
    for (let i = 0; i < 6; i++) { const w = Math.round(12 * Math.sqrt(1 - ((5 - i) / 6) ** 2)); R(ctx, INK, ux - w - 1, uy - 6 + i, w * 2 + 3, 1); R(ctx, Math.floor(i / 2) % 2 ? "#fff1a8" : KID_UMBRELLA[k.id], ux - w, uy - 6 + i, w * 2 + 1, 1); }
    R(ctx, INK, ux - 13, uy, 27, 1);
  }
  // tall grass hides her feet
  const [tx, ty] = tileOf(k.x, k.y);
  if (k.area === ISL && I.at(tx, ty) === TALL && !k.held && pose !== "swing") {
    for (let i = -9; i <= 9; i += 3) pixels(ctx, ["x.x", ".x.", ".x."], x + i - 1, y - 6 + (Math.abs(i) % 2), { x: "#7fbe68" });
    R(ctx, "#a6d98d", x - 10, y - 3, 20, 4);
  }
}
const KID_UMBRELLA = { rose: "#ff9fbf", blossom: "#ffd966", teddy: "#c7a385" };

// ---------- dress up ----------
const ACC = [null, "bow", "crown", "glasses", "party", "tiara"];
const ACC_NAME = { bow: "a pink bow 🎀", crown: "a flower crown 🌸", glasses: "cool sunglasses 😎", party: "a party hat 🥳", tiara: "a little tiara 👑" };
const ACC_COLORS = { p: "#ff7fa8", k: "#e2405a", y: "#ffd966", g: "#86b35a", w: "#ffffff", b: "#2b1b24", l: "#fff1a8", r: "#f48fb4" };
function drawAcc(k, v) {
  const bear = k.id === "teddy";
  const [ax, ay] = v === "side" ? [bear ? 17 : 18, bear ? 4 : 3] : [16, bear ? 4 : 3];
  const X = (x) => -16 + x, Y = (y) => -32 + y;
  if (k.acc === "bow") pixels(ctx, ["pp...pp", "ppp.ppp", "pppkppp", "ppp.ppp", "pp...pp"], X(bear || v === "side" ? ax - 3 : ax - 9), Y(ay - (bear ? 4 : 2)), ACC_COLORS);
  if (k.acc === "crown") pixels(ctx, ["pyp.ypy.pyp", ".g...g...g.", "ggggggggggg"], X(ax - 5), Y(ay - 3), ACC_COLORS);
  if (k.acc === "party") pixels(ctx, ["...w...", "...p...", "..pyp..", "..ypy..", ".pypyp.", ".ypypy.", "pypypyp"], X(ax - 3), Y(ay - 9), ACC_COLORS);
  if (k.acc === "tiara") pixels(ctx, ["y.y.y", "yyryy", "yyyyy"], X(ax - 2), Y(ay - 3), ACC_COLORS);
  if (k.acc === "glasses" && v !== "back") {
    const ey = bear ? 11 : 10;
    if (v === "front") { R(ctx, "#2b1b24", X(10), Y(ey - 1), 5, 3); R(ctx, "#2b1b24", X(17), Y(ey - 1), 5, 3); R(ctx, "#2b1b24", X(15), Y(ey - 1), 2, 1); R(ctx, "#fff", X(11), Y(ey - 1), 1, 1); R(ctx, "#fff", X(18), Y(ey - 1), 1, 1); }
    else { const ex = bear ? 21 : 22; R(ctx, "#2b1b24", X(ex - 2), Y(ey - 1), 5, 3); R(ctx, "#2b1b24", X(ex - 7), Y(ey - 1), 5, 1); R(ctx, "#fff", X(ex - 1), Y(ey - 1), 1, 1); }
  }
}

// ---------- objects ----------
const DRAW = {
  tree(g, o) {
    const sx = o.shake ? Math.round(Math.sin(world.t * 40) * o.shake) : 0;
    g.drawImage(SPR[o.kind], o.tx * T + sx, o.ty * T - 12);
    if (o.kind === "apple") for (let i = 0; i < o.apples; i++) { const [ax, ay] = APPLE_AT[i % APPLE_AT.length]; R(g, INK, o.tx * T + sx + ax - 1, o.ty * T - 12 + ay - 1, 4, 4); R(g, "#e2405a", o.tx * T + sx + ax, o.ty * T - 12 + ay, 2, 2); R(g, "#ff8a9a", o.tx * T + sx + ax, o.ty * T - 12 + ay, 1, 1); }
  },
  house(g, o) {
    const x = o.tx * T, y = o.ty * T;
    g.drawImage(SPR.house, x, y);
    if (o.doorT <= 0) g.drawImage(SPR.houseDoor, x + 48, y + 74);
    if (KIDS.some((k) => k.area === HOM)) R(g, "#ffd966", x + 71, y + 77, 3, 5);
  },
  shop(g, o) { g.drawImage(SPR.shop, o.tx * T, o.ty * T); if (o.doorT <= 0) g.drawImage(SPR.shopDoor, o.tx * T + 33, o.ty * T + 36); },
  bush: (g, o) => g.drawImage(SPR.bush[o.v], o.tx * T - 1, o.ty * T + 1),
  mailbox: (g, o) => g.drawImage(SPR.mailbox, o.tx * T + 2, o.ty * T - 8),
  sign: (g, o) => g.drawImage(SPR.sign, o.tx * T, o.ty * T - 8),
  rock: (g, o) => g.drawImage(SPR.rock, o.tx * T + 1, o.ty * T + 5),
  lamp: (g, o) => g.drawImage(SPR.lamp, o.tx * T + 3, o.ty * T - 15),
  basket: (g, o) => g.drawImage(SPR.basket, o.tx * T, o.ty * T + 2),
  bench: (g, o) => g.drawImage(SPR.bench, o.tx * T, o.ty * T + 1),
  fence: (g, o) => (o.dir === "h" ? g.drawImage(SPR.fenceH, o.tx * T, o.ty * T + 2) : g.drawImage(SPR.fenceV, o.tx * T, o.ty * T - 2)),
  umbrella: (g, o) => g.drawImage(SPR.umbrella, o.tx * T - 8, o.ty * T - 28),
  cart: (g, o) => g.drawImage(SPR.cart, o.tx * T, o.ty * T - 18),
  slide: (g, o) => g.drawImage(SPR.slide, o.tx * T, o.ty * T),
  swings(g, o) {
    g.drawImage(SPR.swings, o.tx * T, o.ty * T - 10);
    SWING_SEATS.forEach(([sx], i) => {
      if (KIDS.some((k) => k.pose === "swing" && k.swingSeat === i && k.area === ISL)) return;
      const x = sx * T + 8, top = o.ty * T - 6, sy = o.ty * T + 22 + Math.round(Math.sin(world.t * 1.5 + i) * 0.5);
      R(g, "#8a6a55", x - 5, top, 1, sy - top); R(g, "#8a6a55", x + 5, top, 1, sy - top); box(g, x - 7, sy, 15, 4, "#ffd966");
    });
  },
  seesaw(g, o) {
    const t = seesawTilt(), cx = (o.tx + 2) * T + 8, cy = o.ty * T + 10;
    pixels(g, ["...xx...", "..xyyx..", ".xyyyyx.", "xxxxxxxx"], cx - 4, cy - 1, { x: INK, y: "#ffd966" });
    for (let i = -38; i <= 38; i++) { const yy = Math.round(cy - 3 + i * t); R(g, INK, cx + i, yy - 1, 1, 4); R(g, Math.abs(i) > 32 ? "#f48fb4" : "#ffb7d0", cx + i, yy, 1, 2); }
    [-34, 34].forEach((i) => { const yy = Math.round(cy - 3 + i * t); R(g, INK, cx + i, yy - 5, 1, 4); R(g, INK, cx + i - 2, yy - 6, 5, 1); });
  },
  castle(g, o) {
    const lv = Math.floor(o.level), x = o.tx * T + 4, y = o.ty * T + 12;
    if (lv <= 0) { R(g, "#e9cf9a", x, y - 2, 10, 3); return; }
    box(g, x - 2, y - 4 - lv * 2, 14, 5 + lv * 2, "#f3d79f");
    if (lv >= 2) { box(g, x - 3, y - 9 - lv * 2, 5, 6, "#f3d79f"); box(g, x + 8, y - 9 - lv * 2, 5, 6, "#f3d79f"); }
    if (lv >= 3) box(g, x + 2, y - 13 - lv * 2, 6, 9, "#f3d79f");
    if (lv >= 4) { R(g, INK, x + 5, y - 20 - lv * 2, 1, 6); R(g, "#f48fb4", x + 6, y - 20 - lv * 2, 4, 3); }
  },
  fountain(g, o) {
    const x = o.tx * T, y = o.ty * T - 2;
    g.drawImage(SPR.fountain, x, y);
    // water arcs out of the top
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1, ph = (world.t * 1.6 + i * 0.25) % 1;
      for (let j = 0; j < 6; j++) { const u = (j / 6 + ph) % 1; R(g, j % 2 ? "#d5f0ff" : "#ffffff", Math.round(x + 24 + side * u * 14), Math.round(y + 8 - Math.sin(u * Math.PI) * 6 + u * 16), 1, 2); }
    }
    if (Math.floor(world.t * 3) % 2) { R(g, "#ffffff", x + 12, y + 30, 3, 1); R(g, "#ffffff", x + 33, y + 33, 2, 1); }
  },
  plant(g, o) {
    const x = o.tx * T, y = o.ty * T, s = Math.floor(o.g);
    oval(g, x + 8, y + 12, 6, 3, o.wet > 0.2 ? "#a77a55" : "#b98a63", null);
    const leaf = "#86c970", dark = "#5f9e52";
    if (s === 0) { R(g, dark, x + 8, y + 8, 1, 4); R(g, leaf, x + 6, y + 7, 2, 2); R(g, leaf, x + 9, y + 7, 2, 2); return; }
    disc(g, x + 8, y + 7, s === 1 ? 3 : 5, leaf, dark); disc(g, x + 6, y + 5, 2, "#a6de90", null);
    if (s === 2) [[4, 4], [11, 6], [8, 2]].forEach(([dx, dy]) => { R(g, "#fff", x + dx, y + dy, 2, 2); R(g, "#ffd966", x + dx, y + dy, 1, 1); });
    if (s === 3) [[4, 6], [10, 8], [8, 3], [12, 4]].forEach(([dx, dy]) => { R(g, "#e2405a", x + dx, y + dy, 3, 3); R(g, "#ffd966", x + dx + 1, y + dy + 1, 1, 1); });
  },
  crop(g, o) {
    const x = o.tx * T, y = o.ty * T;
    oval(g, x + 8, y + 11, 6, 3, o.wet > 0.2 ? "#8f6646" : "#a77a55", null);
    if (!o.crop) { R(g, "#7a5438", x + 5, y + 10, 6, 1); return; }
    const c = CROPS[o.crop], st = o.g >= 1 ? 3 : Math.floor(o.g * 3), dry = o.wet < 0.15 && st < 3, ripe = st === 3;
    const leaf = dry ? "#b5c46a" : "#86c970", dark = dry ? "#8a9a4a" : "#5f9e52";
    if (dry) pixels(g, [".b.", "bbb", ".b."], x + 12, y - 6 + Math.round(Math.sin(world.t * 3)), { b: "#7fc3ec" }); // thirsty!
    if (st === 0) { R(g, dark, x + 8, y + 7, 1, 4); R(g, leaf, x + 6, y + 6, 2, 2); R(g, leaf, x + 9, y + 6, 2, 2); return; }
    if (st === 1) { R(g, dark, x + 8, y + 5, 1, 6); disc(g, x + 6, y + 6, 2, leaf, dark); disc(g, x + 10, y + 5, 2, leaf, dark); return; }
    switch (c.shape) {
      case "bush":
        disc(g, x + 8, y + 6, 5, leaf, dark); disc(g, x + 6, y + 4, 2, "#a6de90", null);
        if (ripe) [[4, 6], [10, 8], [8, 3], [12, 4], [6, 9]].forEach(([dx, dy]) => { R(g, c.c, x + dx, y + dy, 3, 3); R(g, c.a || "#fff", x + dx + 1, y + dy, 1, 1); });
        else [[5, 5], [11, 7]].forEach(([dx, dy]) => R(g, "#fff", x + dx, y + dy, 2, 2));
        break;
      case "tall":
        R(g, dark, x + 7, y - 10 + (ripe ? 0 : 6), 2, 20 - (ripe ? 0 : 6)); disc(g, x + 5, y + 4, 2, leaf, dark); disc(g, x + 11, y + 1, 2, leaf, dark);
        if (ripe) { disc(g, x + 8, y - 11, 5, c.c, "#c9a020"); disc(g, x + 8, y - 11, 2, c.a, null); } else disc(g, x + 8, y - 5, 2, "#a6de90", dark);
        break;
      case "cups":
        R(g, leaf, x + 4, y + 8, 8, 2);
        [[4, 1], [8, -2], [12, 1]].forEach(([dx, dy]) => { R(g, dark, x + dx, y + dy + 3, 1, 8 - dy); if (ripe) { R(g, INK, x + dx - 2, y + dy - 1, 5, 5); R(g, c.c, x + dx - 1, y + dy, 3, 3); R(g, c.a, x + dx, y + dy, 1, 1); } else R(g, "#a6de90", x + dx - 1, y + dy + 1, 3, 3); });
        break;
      case "spikes":
        for (let i = 0; i < 4; i++) { const sx = x + 3 + i * 3; R(g, dark, sx, y + 1, 1, 10); for (let j = 0; j < 5; j++) R(g, ripe ? (j % 2 ? c.c : c.a) : "#a6de90", sx - 1 + (j % 2), y - 1 + j * 2, 2, 2); }
        break;
      case "tops":
        [[5, 0], [8, -2], [11, 0]].forEach(([dx, dy]) => { R(g, leaf, x + dx - 1, y + dy + 2, 3, 5); R(g, dark, x + dx, y + dy + 3, 1, 5); });
        if (ripe) [4, 8, 12].forEach((dx) => { R(g, INK, x + dx - 2, y + 8, 5, 3); R(g, c.c, x + dx - 1, y + 8, 3, 2); });
        break;
      case "stake":
        R(g, "#c99a6d", x + 8, y - 6, 1, 16); disc(g, x + 7, y + 3, 4, leaf, dark); disc(g, x + 9, y - 2, 3, leaf, dark);
        if (ripe) [[5, 2], [10, 0], [7, 6], [11, 5]].forEach(([dx, dy]) => disc(g, x + dx, y + dy, 1, c.c, INK));
        break;
      case "melon":
        R(g, dark, x + 2, y + 6, 12, 1); disc(g, x + 4, y + 5, 2, leaf, dark);
        if (ripe) { oval(g, x + 9, y + 8, 6, 4, c.c, INK); for (let i = -4; i <= 4; i += 3) R(g, c.a, x + 9 + i, y + 5, 1, 7); R(g, "#fff", x + 6, y + 6, 2, 1); }
        else oval(g, x + 9, y + 8, 3, 2, c.c, dark);
        break;
    }
    if (ripe && Math.floor(world.t * 2 + o.tx) % 6 === 0) R(g, "#fff", x + 2, y - 2, 1, 1); // ready to pick ✨
  },
  // the house
  bed: (g, o) => g.drawImage(SPR.bed[o.i], o.tx * T, 3 * T - 4),
  nightstand: (g, o) => g.drawImage(SPR.nightstand, o.tx * T, 3 * T - 10),
  chest: (g, o) => g.drawImage(SPR.chest, o.tx * T, o.ty * T - 4),
  dresser: (g, o) => g.drawImage(SPR.dresser, o.tx * T, o.ty * T - 10),
  shelf: (g, o) => g.drawImage(SPR.shelf, o.tx * T, 3 * T - 24),
  tv(g, o) {
    const x = o.tx * T, y = 3 * T - 16;
    g.drawImage(SPR.tv, x, y);
    if (tvOn()) {
      const f = Math.floor(world.t * 4);
      R(g, ["#bfe3ff", "#ffe1ec", "#fff1a8"][Math.floor(world.t / 3) % 3], x + 6, y + 7, 17, 10);
      R(g, "#86c970", x + 6, y + 14, 17, 3);
      pixels(g, f % 2 ? [".x.x.", ".x.x.", "xxxxx", "xkxkx", "xxxxx"] : ["x...x", ".x.x.", "xxxxx", "xkxkx", "xxxxx"], x + 8 + (f % 8), y + 9 + (f % 2), { x: "#fffaf2", k: "#2b1b24" });
      R(g, "#fff", x + 7, y + 8, 2, 1);
    } else { R(g, "#4a4a6a", x + 6, y + 7, 17, 10); R(g, "#6a6a8a", x + 7, y + 8, 3, 1); }
  },
  piano: (g, o) => g.drawImage(SPR.piano, o.tx * T, 3 * T - 14),
  pianobench: (g, o) => g.drawImage(SPR.pianobench, o.tx * T + 4, o.ty * T + 2),
  sofa: (g, o) => g.drawImage(SPR.sofa, o.tx * T, o.ty * T - 4),
  pot: (g, o) => g.drawImage(SPR.pot, o.tx * T, o.ty * T - 12),
  fridge(g, o) {
    const x = o.tx * T, y = 3 * T - 22;
    g.drawImage(SPR.fridge, x, y);
    for (let i = 0; i < Math.min(4, world.drawings); i++) { const px = x + 2 + (i % 2) * 6, py = y + 16 + Math.floor(i / 2) * 9; box(g, px, py, 6, 7, "#fffaf2"); R(g, ["#f48fb4", "#9db8ff", "#86c970", "#ffd966"][i], px + 2, py + 2, 2, 2); R(g, "#e2405a", px + 2, py - 1, 2, 2); }
    if (o.openT > 0) { box(g, x + 15, y + 1, 7, 34, "#fff8d6"); R(g, "#fff6c9", x + 1, y + 1, 14, 34); R(g, "#ffe680", x + 1, y + 12, 14, 1); R(g, "#ffe680", x + 1, y + 24, 14, 1); R(g, "#e2405a", x + 3, y + 8, 3, 3); R(g, "#fffaf2", x + 8, y + 6, 3, 5); R(g, "#ffd966", x + 4, y + 19, 6, 3); R(g, "#86c970", x + 3, y + 28, 8, 3); }
  },
  counter(g, o) { g.drawImage(SPR.counter, o.tx * T, 3 * T - 8); if (o.fruit) { disc(g, o.tx * T + 8, 3 * T - 7, 3, "#fffaf2"); R(g, "#e2405a", o.tx * T + 6, 3 * T - 10, 2, 2); R(g, "#ffd966", o.tx * T + 9, 3 * T - 10, 2, 2); } },
  stove(g, o) { g.drawImage(SPR.stove, o.tx * T, 3 * T - 8); if (o.on) { R(g, "#ff9a5a", o.tx * T + 4, 3 * T + 5, 8, 1); if (Math.floor(world.t * 6) % 2) R(g, "#ffd966", o.tx * T + 6, 3 * T + 4, 4, 1); } },
  sink: (g, o) => g.drawImage(SPR.sink, o.tx * T, 3 * T - 8),
  table(g, o) {
    const x = o.tx * T, y = o.ty * T - 4;
    g.drawImage(SPR.table, x, y);
    if (world.vase && CROPS[world.vase]) { const c = CROPS[world.vase]; box(g, x + 21, y + 10, 7, 8, "#bfe3ff"); R(g, "#fff", x + 22, y + 11, 1, 3); R(g, "#5f9e52", x + 22, y + 4, 1, 6); R(g, "#5f9e52", x + 25, y + 3, 1, 7); [[20, 2], [24, 0], [27, 3], [22, 5]].forEach(([dx, dy]) => { R(g, INK, x + dx - 1, y + dy - 1, 4, 4); R(g, c.c, x + dx, y + dy, 2, 2); R(g, c.a || "#fff", x + dx, y + dy, 1, 1); }); }
    else { disc(g, x + 24, y + 13, 4, "#fffaf2"); R(g, "#e2405a", x + 21, y + 10, 2, 2); R(g, "#ffd966", x + 24, y + 9, 3, 2); R(g, "#86c970", x + 26, y + 11, 2, 2); }
    for (let i = 0; i < world.plates; i++) { const px = x + 6 + i * 14, py = y + 20; oval(g, px + 3, py + 2, 4, 2, "#fffaf2"); R(g, "#f0c27a", px, py, 7, 2); R(g, "#e0a96d", px, py - 2, 7, 2); R(g, "#ffd966", px + 2, py - 3, 2, 1); }
    if (world.tea) { [[8, 6], [36, 6], [22, 22]].forEach(([dx, dy]) => { box(g, x + dx, y + dy, 5, 4, "#fffaf2"); R(g, "#f48fb4", x + dx + 1, y + dy + 1, 3, 1); }); box(g, x + 30, y + 16, 7, 6, "#ffb7d0"); R(g, INK, x + 37, y + 17, 2, 1); }
  },
  chair: (g, o) => g.drawImage(SPR.chair, o.tx * T, o.ty * T),
  tub: (g, o) => g.drawImage(SPR.tub, o.tx * T, o.ty * T - 4),
  bathsink: (g, o) => g.drawImage(SPR.bathsink, o.tx * T, o.ty * T - 12),
  window(g, o) {
    const [x, y, w, h] = o.rect, t = tintNow();
    const sky = raining() ? [176, 192, 214] : [191, 227, 255];
    const c = sky.map((v, i) => Math.round(v + (t.rgb[i] - v) * Math.min(1, t.a * 1.7)));
    box(g, x - 1, y - 1, w + 2, h + 2, `rgb(${c.join(",")})`);
    if (isNight()) for (let i = 0; i < 4; i++) R(g, "#fff6c9", x + 2 + ((i * 5 + o.rect[0]) % (w - 3)), y + 2 + ((i * 7) % (h - 6)), 1, 1);
    else if (!raining()) { R(g, "#fff", x + 2, y + 4, 5, 2); R(g, "#fff", x + 4, y + 3, 3, 1); }
    if (raining()) for (let i = 0; i < 5; i++) R(g, "#e8f4ff", x + 1 + ((i * 3 + Math.floor(world.t * 10)) % (w - 2)), y + ((i * 4 + Math.floor(world.t * 30)) % (h - 3)), 1, 3);
    R(g, "#d9a77a", x + Math.floor(w / 2), y, 1, h); R(g, "#d9a77a", x, y + Math.floor(h / 2), w, 1);
    R(g, "#ffb7d0", x - 2, y - 2, 3, h + 4); R(g, "#ffb7d0", x + w - 1, y - 2, 3, h + 4); box(g, x - 2, y + h, w + 4, 3, "#fffaf0");
  },
  clock(g) {
    const cx = 11 * T + 8, cy = 26, d = new Date(), hr = FIXED_HOUR ?? d.getHours() + d.getMinutes() / 60, mn = FIXED_HOUR !== null ? (FIXED_HOUR % 1) * 60 : d.getMinutes();
    disc(g, cx, cy, 6, "#fffaf2"); R(g, "#f48fb4", cx, cy - 6, 1, 1);
    const ha = ((hr % 12) / 12) * Math.PI * 2, ma = (mn / 60) * Math.PI * 2;
    line(g, INK, cx, cy, Math.round(cx + Math.sin(ha) * 3), Math.round(cy - Math.cos(ha) * 3));
    line(g, "#f48fb4", cx, cy, Math.round(cx + Math.sin(ma) * 5), Math.round(cy - Math.cos(ma) * 5));
  },
  frame(g) { const x = 16 * T - 7, y = 17; box(g, x, y, 14, 12, "#ffd966"); R(g, "#fffaf2", x + 2, y + 2, 10, 8); pixels(g, HEART, x + 5, y + 4, { x: "#f48fb4" }); R(g, "#6b3a55", x + 3, y + 7, 2, 2); R(g, "#d9a77a", x + 10, y + 7, 2, 2); },
  mat() {},
};
const tvOn = () => world.tvUser || KIDS.some((k) => k.area === HOM && k.act === "tv" && k.pose === "sofa");

function drawBall() {
  const b = world.ball, x = Math.round(b.x), y = Math.round(b.y);
  ctx.fillStyle = "rgba(60,40,70,.2)"; ctx.fillRect(x - 4, y - 1, 8, 2);
  const cy = y - 4 - Math.round(b.h);
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
    const d = i * i + j * j;
    if (d <= 11) R(ctx, Math.floor((i + 4 + b.roll) / 3) % 2 ? "#f48fb4" : "#fff1a8", x + i, cy + j, 1, 1);
    else if (d <= 18) R(ctx, INK, x + i, cy + j, 1, 1);
  }
  R(ctx, "#fff", x - 2, cy - 2, 1, 1);
}
function drawBubbles() {
  world.bubbles.forEach((b) => {
    const x = Math.round(b.x), y = Math.round(b.y - b.alt), r = b.r;
    ctx.fillStyle = "rgba(60,40,70,.12)"; ctx.fillRect(x - 2, Math.round(b.y), 4, 1);
    for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) {
      const d = Math.sqrt(i * i + j * j);
      if (d <= r - 0.6) R(ctx, "rgba(255,255,255,.28)", x + i, y + j, 1, 1);
      else if (d <= r + 0.5) R(ctx, (i + j) % 3 === 0 ? "#ff9fc6" : "#8fd0f2", x + i, y + j, 1, 1);
    }
    R(ctx, "#fff", x - 1, y - r + 1, 2, 1);
  });
}
function drawCat() {
  const x = Math.round(cat.x), y = Math.round(cat.y) - Math.round(cat.hop * 3);
  ctx.fillStyle = "rgba(60,40,70,.16)"; ctx.fillRect(x - 6, Math.round(cat.y) - 1, 12, 2);
  ctx.save(); ctx.translate(x, y);
  if (cat.dir < 0) ctx.scale(-1, 1);
  if (cat.path.length) ctx.drawImage(SPR.cat.walk[cat.frame], -8, -12);
  else if (cat.state === "nap" || cat.state === "home") ctx.drawImage(SPR.cat.sleep, -8, -9);
  else ctx.drawImage(SPR.cat.sit, -6, -12);
  ctx.restore();
  if ((cat.state === "nap" || (cat.state === "home" && !cat.path.length)) && Math.random() < 0.01) particle("z", cat.x + 4, cat.y - 10, "#9db8ff", 1, 1, -10, ISL);
}
function drawCritters(night) {
  if (!night && !raining()) butterflies.forEach((b) => {
    const flap = Math.sin(world.t * 18 + b.a) > 0, x = Math.round(b.x), y = Math.round(b.y);
    pixels(ctx, flap ? ["x.x", "xyx", "x.x"] : [".x.", "xyx", ".x."], x - 1, y - 1, { x: b.c, y: INK });
  });
  shells.forEach((s) => pixels(ctx, s.kind === 0 ? [".pp.", "pwwp", "pppp"] : s.kind === 1 ? ["xxx", "xwx"] : [".y.", "yyy"], Math.round(s.x), Math.round(s.y), { p: "#ffb7d0", w: "#fff", x: "#f6c9a8", y: "#fff1a8" }));
  if (world.treat) [[41, 18], [42, 19]].forEach(([tx, ty], i) => { if (i < world.treat) pixels(ctx, ITEMS.cake, tx * T + 5, ty * T + 6, ITEM_COLORS); });
}
function drawWater() {
  // fish under the surface, ducks on top, little moving waves
  fish.forEach((f) => { ctx.fillStyle = "rgba(60,90,130,.25)"; ctx.fillRect(Math.round(f.x) - 3, Math.round(f.y) - 1, 6, 2); ctx.fillRect(Math.round(f.x) + (Math.cos(f.a) > 0 ? -5 : 3), Math.round(f.y) - 2, 2, 4); });
  const x0 = Math.floor(cam.x / T) - 1, y0 = Math.floor(cam.y / T) - 1, x1 = x0 + Math.ceil(canvas.width / T) + 2, y1 = y0 + Math.ceil(canvas.height / T) + 2;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (I.at(x, y) !== WATER) continue;
    const ph = (world.t * 1.2 + (x * 0.7 + y * 1.3)) % 4;
    if (ph < 1.4) R(ctx, "#d5f0ff", x * T + 3 + Math.round(ph * 3), y * T + 9 - (y % 2) * 4, 4, 1);
  }
  ducks.forEach((d) => {
    const x = Math.round(d.x), y = Math.round(d.y), f = d.vx < 0;
    if (d.small) { pixels(ctx, f ? [".y..", "oyyy", ".yy."] : ["..y.", "yyyo", ".yy."], x - 2, y - 1, { y: "#fff1a8", o: "#ffb35c" }); return; }
    pixels(ctx, f ? [".ww...", "owww..", ".wwwww", "..www."] : ["...ww.", "..wwwo", "wwwww.", ".www.."], x - 3, y - 2, { w: "#fff", o: "#ffb35c" });
    R(ctx, INK, x + (f ? -2 : 2), y - 2, 1, 1);
    R(ctx, "rgba(255,255,255,.6)", x - 4, y + 2, 8, 1);
  });
}
function drawPuddles() {
  if (world.wet < 0.05) return;
  PUDDLES.forEach(([x, y]) => {
    const px = x * T + 8, py = y * T + 10, rx = 5 + (hash(x, y) % 4);
    ctx.globalAlpha = world.wet * 0.75;
    oval(ctx, px, py, rx, 3, "#b9dcf2", null); R(ctx, "#e8f6ff", px - 2, py - 1, 3, 1);
    ctx.globalAlpha = 1;
  });
}
function drawSky(night, tint) {
  // cloud shadows drifting over the island, then rain on top
  if (!night) {
    ctx.fillStyle = `rgba(70,50,110,${world.weather === "sunny" ? 0.05 : 0.09})`;
    clouds.forEach((c) => { ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.55, 0, 0, Math.PI * 2); ctx.ellipse(c.x + c.r * 0.6, c.y + 8, c.r * 0.6, c.r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); });
  }
  if (world.weather !== "sunny") { ctx.fillStyle = raining() ? "rgba(90,105,140,.18)" : "rgba(120,120,150,.08)"; ctx.fillRect(cam.x, cam.y, canvas.width, canvas.height); }
}
function drawRain() {
  if (!raining()) return;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "rgba(230,240,255,.7)";
  for (let i = 0; i < 90; i++) {
    const sp = 180 + (hash(i, 5) % 80), x0 = hash(i, 1) % (w + 40), y = (hash(i, 2) % (h + 20) + world.t * sp) % (h + 20) - 10;
    ctx.fillRect(Math.round(cam.x + ((x0 - y * 0.2) % (w + 40) + w + 40) % (w + 40) - 20), Math.round(cam.y + y), 1, 4);
  }
}
function drawNight(tint, night) {
  if (tint.a <= 0.01) return;
  const [r, g, b] = tint.rgb;
  ctx.fillStyle = `rgba(${r},${g},${b},${tint.a})`;
  ctx.fillRect(cam.x, cam.y, canvas.width, canvas.height);
  const glow = Math.min(1, tint.a * 2.5);
  if (glow < 0.15) return;
  ctx.globalCompositeOperation = "lighter";
  const light = (x, y, rad, a, c = "255,220,140") => {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = gr; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  const hx = HOUSE.tx * T, hy = HOUSE.ty * T, home = KIDS.filter((k) => k.area === HOM), awake = home.some((k) => !k.asleep);
  const wa = home.length ? (awake ? 0.55 : 0.25) : 0.12;
  light(hx + 25, hy + 72, 24, wa * glow); light(hx + 97, hy + 72, 24, wa * glow); light(hx + 72, hy + 80, 12, 0.5 * glow);
  light(SHOP.tx * T + 18, SHOP.ty * T + 42, 22, 0.35 * glow); light(SHOP.tx * T + 62, SHOP.ty * T + 42, 22, 0.35 * glow);
  I.objs.filter((o) => o.type === "lamp").forEach((o) => light(o.tx * T + 8, o.ty * T - 9, 30, 0.45 * glow));
  if (night && !raining()) fireflies.forEach((f) => { const a = (Math.sin(world.t * 3 + f.a * 5) + 1) / 2; light(f.x, f.y, 5, 0.6 * a * glow, "220,255,150"); });
  ctx.globalCompositeOperation = "source-over";
  if (home.length) [[hx + 14, hy + 64], [hx + 86, hy + 64]].forEach(([x, y]) => { R(ctx, `rgba(255,230,150,${awake ? 0.75 : 0.35})`, x + 1, y + 1, 10, 7); R(ctx, `rgba(255,230,150,${awake ? 0.75 : 0.35})`, x + 12, y + 1, 9, 7); R(ctx, `rgba(255,230,150,${awake ? 0.75 : 0.35})`, x + 1, y + 9, 10, 7); R(ctx, `rgba(255,230,150,${awake ? 0.75 : 0.35})`, x + 12, y + 9, 9, 7); });
}
function drawHouseLight(tint) {
  const dark = clamp(tint.a / 0.52, 0, 1);
  const home = KIDS.filter((k) => k.area === HOM), awake = home.some((k) => !k.asleep), sleeping = home.some((k) => k.asleep);
  const lights = awake && dark > 0.25;
  const amb = dark * (lights ? 0.16 : 0.5) + (raining() ? 0.05 : 0);
  if (amb > 0.01) { ctx.fillStyle = `rgba(28,18,64,${amb})`; ctx.fillRect(cam.x, cam.y, canvas.width, canvas.height); }
  if (dark < 0.2 && !tvOn()) return;
  ctx.globalCompositeOperation = "lighter";
  const light = (x, y, rad, a, c = "255,214,150") => {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = gr; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  if (dark >= 0.2) {
    if (lights || sleeping) [3, 6].forEach((x) => light(x * T + 8, 3 * T - 6, 26, (lights ? 0.3 : 0.22) * dark));
    if (lights) { light(13 * T, 9 * T, 70, 0.14 * dark); light(20 * T + 8, 6 * T, 46, 0.14 * dark); light(20 * T + 8, 12 * T, 36, 0.1 * dark); }
    // the fairy lights over the beds
    for (let i = 0; i < 9; i++) { const x = T + 6 + i * 13, y = 9 + Math.round(Math.sin(((x - T) / (3 * T)) * Math.PI) * -2 + 2); light(x, y + 1, 5, 0.5 * dark, i % 2 ? "255,170,200" : "255,230,140"); }
  }
  if (tvOn()) light(12 * T + 16, 3 * T, 30, 0.18 + 0.05 * Math.sin(world.t * 7), "160,200,255");
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 9; i++) { const x = T + 6 + i * 13, y = 9 + Math.round(Math.sin(((x - T) / (3 * T)) * Math.PI) * -2 + 2); R(ctx, i % 2 ? "#ffb7d0" : "#ffe680", x, y, 2, 2); }
}
function drawParticles() {
  world.parts.forEach((p) => {
    if (p.area !== cam.area) return;
    ctx.globalAlpha = Math.min(1, p.life * 1.5);
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.type === "heart") pixels(ctx, HEART, x - 2, y - 2, { x: p.color });
    else if (p.type === "z") pixels(ctx, ["xxx", "..x", ".x.", "xxx"], x - 1, y - 2, { x: p.color });
    else if (p.type === "petal") R(ctx, p.color, x, y, 2, 1);
    else if (p.type === "leaf" || p.type === "drop") R(ctx, p.color, x, y, 1, 2);
    else if (p.type === "note") pixels(ctx, [".xx", ".x.", ".x.", "xx."], x - 1, y - 2, { x: p.color });
    else if (p.type === "star") pixels(ctx, [".x.", "xxx", ".x."], x - 1, y - 1, { x: p.color });
    else if (p.type === "smoke" || p.type === "steam") { ctx.globalAlpha = Math.min(0.7, p.life * 0.5); disc(ctx, x, y, p.type === "smoke" ? 2 + Math.round((1.6 - p.life) * 2) : 1, p.color, null); }
    else if (p.type === "bubble") { disc(ctx, x, y, 2, "rgba(255,255,255,.6)", "#cfe8f6"); }
    else if (p.type === "ring") { ctx.globalAlpha = p.life * 1.4; const r = Math.round((0.5 - p.life) * 8) + 1; R(ctx, p.color, x - r, y, r * 2 + 1, 1); R(ctx, p.color, x, y - 1, 1, 1); }
    else if (p.type === "apple") { R(ctx, INK, x - 1, y - 1, 4, 4); R(ctx, p.color, x, y, 2, 2); }
    else if (p.type === "coin") { R(ctx, INK, x - 1, y - 1, 4, 4); R(ctx, p.color, x, y, 2, 2); }
    else R(ctx, p.color, x, y, 1, 1);
  });
  ctx.globalAlpha = 1;
}

function draw() {
  const A = AREAS[cam.area], night = isNight(), tint = tintNow(), isl = cam.area === ISL;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = isl ? "#9fd6f0" : "#3d2834"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  ctx.drawImage(GROUND[cam.area], 0, 0);
  if (isl) { drawWater(); drawPuddles(); }
  // everything that stands up, sorted so things in front cover things behind
  const list = [];
  A.objs.forEach((o) => { list.push({ y: o.base, fn: () => DRAW[o.type](ctx, o) }); if (o.over) list.push({ y: o.overBase, fn: () => o.over(ctx, o) }); });
  KIDS.forEach((k) => { if (k.area === cam.area && !k.hidden) list.push({ y: k.y + (k.pose === "swing" ? 4 : 0) + (k.held ? 100 : 0), fn: () => kidDraw(k) }); });
  if (isl) { list.push({ y: cat.y, fn: drawCat }); if (world.ball) list.push({ y: world.ball.y, fn: drawBall }); }
  list.sort((a, b) => a.y - b.y).forEach((d) => d.fn());
  if (isl) { drawCritters(night); drawBubbles(); }
  drawParticles();
  if (isl) { drawSky(night, tint); drawNight(tint, night); drawRain(); } else drawHouseLight(tint);
  // a little marker over whoever you picked
  if (selected && selected.area === cam.area && !selected.hidden && !world.photo) {
    const bob = Math.round(Math.sin(world.t * 5)), lying = ["nap", "lie"].includes(selected.pose);
    pixels(ctx, ["xxxxx", ".xxx.", "..x.."], Math.round(selected.x) - 2, Math.round(selected.y) - (lying ? 26 : 44) + bob - Math.round(selected.lift), { x: "#ffd966" });
  }
}

// ---------- fitting to the screen + the camera ----------
function fit() {
  const A = AREAS[cam.area], w = view.clientWidth, h = view.clientHeight;
  if (mapMode) {
    const s = Math.min(w / A.PW, h / A.PH);
    canvas.width = A.PW; canvas.height = A.PH;
    Object.assign(canvas.style, { width: A.PW * s + "px", height: A.PH * s + "px", left: (w - A.PW * s) / 2 + "px", top: (h - A.PH * s) / 2 + "px" });
    scale = s;
  } else {
    scale = cam.area === HOM ? clamp(Math.floor(Math.min(w / A.PW, h / A.PH)), 2, 4) : clamp(Math.round(w / 380), 2, 4);
    canvas.width = Math.ceil(w / scale); canvas.height = Math.ceil(h / scale);
    Object.assign(canvas.style, { width: canvas.width * scale + "px", height: canvas.height * scale + "px", left: "0px", top: "0px" });
  }
  ctx.imageSmoothingEnabled = false;
  view.style.background = cam.area === HOM ? "#3d2834" : "";
  if (cam.area === ISL) tintBackdrop();
}
addEventListener("resize", fit);

function camTarget() {
  if (cam.mode === "free") return null;
  const k = cam.target;
  if (!k || k.area !== cam.area) return null;
  return [k.x, k.y - 16];
}
function clampCam() {
  const A = AREAS[cam.area];
  cam.x = canvas.width >= A.PW ? (A.PW - canvas.width) / 2 : clamp(cam.x, 0, A.PW - canvas.width);
  cam.y = canvas.height >= A.PH ? (A.PH - canvas.height) / 2 : clamp(cam.y, 0, A.PH - canvas.height);
}
function snapCam() { const t = camTarget(); if (t) { cam.x = t[0] - canvas.width / 2; cam.y = t[1] - canvas.height / 2; } clampCam(); }
function updateCamera(dt) {
  if (mapMode) { cam.x = 0; cam.y = 0; return; }
  if (cam.mode === "auto") {
    cam.switchT -= dt;
    if (!cam.target || cam.switchT <= 0) {
      const awake = KIDS.filter((k) => !k.asleep && !k.hidden);
      const fun = awake.filter((k) => !["idle", "explore", "bench", "sign", "window"].includes(k.act));
      cam.target = pick(fun.length ? fun : awake.length ? awake : KIDS);
      cam.switchT = rand(22, 35);
    }
    if (cam.target && cam.target.area !== cam.area && !switching) switchArea(cam.target.area);
  }
  const t = camTarget();
  if (t) {
    const e = 1 - Math.exp(-dt * 3);
    cam.x += (t[0] - canvas.width / 2 - cam.x) * e; cam.y += (t[1] - canvas.height / 2 - cam.y) * e;
  }
  clampCam();
}
function setCamMode(mode, target = null) {
  cam.mode = mode;
  if (target) cam.target = target;
  if (mode === "auto") cam.switchT = 0;
  $("#autoBtn").classList.toggle("on", mode === "auto");
}
let switching = false;
function switchArea(id, then) {
  if (switching) return;
  if (cam.area === id) { then?.(); return; }
  switching = true;
  $("#fade").classList.add("on");
  later(() => {
    cam.area = id; fit(); snapCam(); renderPlace();
    $("#fade").classList.remove("on");
    switching = false;
    then?.();
  }, 170);
}
function renderPlace() {
  const home = KIDS.filter((k) => k.area === HOM);
  const b = $("#placeBtn");
  b.innerHTML = cam.area === ISL
    ? `🏠 peek inside <small>${home.length ? (home.every((k) => k.asleep) ? "all asleep 💤" : `${home.length} home`) : "nobody home"}</small>`
    : `🌴 back outside <small>${KIDS.length - home.length ? `${KIDS.length - home.length} outside` : "everyone's home"}</small>`;
  $("#toyBtn").title = cam.area === ISL ? "toys and things" : "toys and things (ball and bubbles go outside)";
}

function placeOverlays() {
  const r = canvas.getBoundingClientRect(), v = view.getBoundingClientRect();
  const sx = r.width / canvas.width, ox = r.left - v.left, oy = r.top - v.top;
  KIDS.forEach((k) => {
    const here = k.area === cam.area && !k.hidden;
    k.bubble.style.visibility = here ? "visible" : "hidden";
    k.tag.classList.toggle("show", here && (k === selected || mapMode));
    if (!here) return;
    const lying = ["nap", "lie"].includes(k.pose);
    const bx = ox + (k.x - cam.x) * sx, by = oy + (k.y - (lying ? 18 : 34) - k.lift - cam.y) * sx;
    const bw = k.bubble.offsetWidth || 0, bh = k.bubble.offsetHeight || 0;
    k.bubble.style.left = clamp(bx, bw / 2 + 4, v.width - bw / 2 - 4) + "px";
    k.bubble.style.top = clamp(by, bh + 4, v.height - 4) + "px";
    k.tag.style.left = ox + (k.x - cam.x) * sx + "px";
    k.tag.style.top = oy + (k.y + 3 - cam.y) * sx + "px";
  });
}

// ======================================================================
// touching things
// ======================================================================
const toWorld = (e) => { const r = canvas.getBoundingClientRect(); return { x: cam.x + (e.clientX - r.left) / (r.width / canvas.width), y: cam.y + (e.clientY - r.top) / (r.height / canvas.height) }; };
function kidAt(p) {
  const hits = KIDS.filter((k) => k.area === cam.area && !k.hidden && Math.abs(p.x - k.x) < (["nap", "lie"].includes(k.pose) ? 16 : 12) && p.y < k.y + 3 && p.y > k.y - (["nap", "lie"].includes(k.pose) ? 18 : 30) - k.lift);
  return hits.sort((a, b) => b.y - a.y)[0] || null;
}
function objAt(A, p) {
  return A.objs.filter((o) => o.hit && p.x >= o.hit[0] && p.x < o.hit[0] + o.hit[2] && p.y >= o.hit[1] && p.y < o.hit[1] + o.hit[3]).sort((a, b) => b.base - a.base)[0] || null;
}
function select(k) {
  selected = k;
  $$(".chip").forEach((c) => c.classList.toggle("sel", c.dataset.id === k?.id));
  $("#card").hidden = !k;
  if (k) { setCamMode("follow", k); if (k.area !== cam.area) switchArea(k.area); renderCard(); }
}

function tapKid(k) {
  audio(); select(k);
  if (k.asleep) {
    particle("heart", k.x, k.y - 28, "#ffb7d0", 2, 4, -12, k.area);
    say(k, pick(["zzz… love you mama", "*snore*", "mmm… papa…", "zzz ♡"]), 1500);
    tone(330, { type: "sine", dur: 0.3, vol: 0.04 });
    return;
  }
  if (k.act === "missmama") {
    sfx.gift(); hearts(k, 12); k.hop = 1; up(k, "love", 40); achieve(k, "pat"); remember(k, "mama came to see me!! ♡");
    say(k, k.id === "teddy" ? "MAMA!! 🥺♡ con nhớ mẹ nhiều lắm" : "mama you came!! ♡", 2400);
    if (k.step) k.step.dur = 0;
    return;
  }
  if (k.gift) {
    gifts++; store.set("gifts", String(gifts)); renderGifts();
    feel(k, null, { proud: 0.4, happy: 0.3 });
    sfx.gift(); hearts(k, 8); achieve(k, "gift"); remember(k, "i gave mama a present 🎁");
    if (CROPS[k.gift]) { const c = CROPS[k.gift]; if (c.flower) world.vase = k.gift; toast(`${k.name} grew ${c.one} ${c.emoji} in her own garden, just for you ♡`, 3600); say(k, k.id === "rose" ? "i grew it for you, mama ♡ thank you for loving me" : k.id === "teddy" ? "…for mama ♡" : "i grew it myself!! 🌱", 2400); particle("petal", k.x, k.y - 20, c.c, 8, 8, -20, k.area); k.gift = null; return; }
    if (k.gift === "letter") { toast(pick(LETTERS), 4200); say(k, "it's for you mama ♡", 1800); }
    else if (k.gift === "drawing") { world.drawings++; toast("she drew you and papa holding hands ♡ (it's on the fridge now)", 3600); say(k, "do you like it?", 1800); }
    else say(k, { shell: pick(["a seashell for you mama ♡", "for papa! listen, the sea"]), strawberry: pick(["the reddest one for mama ♡", "i grew it myself!"]) }[k.gift] || pick(["this flower is for you mama ♡", "for papa ♡ hehe", "i picked it myself!"]), 2400);
    particle("petal", k.x, k.y - 20, "#f48fb4", 8, 8, -20, k.area);
    k.gift = null;
    return;
  }
  k.taps = (k.taps || []).filter((t) => world.t - t < 2.2);
  k.taps.push(world.t);
  if (k.taps.length >= 5) {
    k.taps = []; k.spin = 1.3;
    feel(k, "you spun me round and round!", { excited: 0.3, grumpy: 0.1 * PERSONA[k.id].traits.calm });
    sfx.boing(); tone(900, { type: "sine", slide: 300, dur: 0.6, vol: 0.08 });
    say(k, pick(["hehe stop it papa! 😵‍💫", "i'm dizzy…", "the world is spinning!", "again again!"]), 1800);
    return;
  }
  sfx.squeak(); k.hop = 1;
  up(k, "love", k.id === "teddy" ? 12 : 8);
  feel(k, null, { happy: 0.08, lonely: -0.2 });
  hearts(k, k.id === "teddy" ? 6 : 4);
  // shy teddy hides her face the first time, then melts
  if (k.id === "teddy" && world.t - (k.lastTap || -99) > 30) { k.lastTap = world.t; say(k, "*hides face* 🙈", 1200); later(() => say(k, pick(["…hehe ♡", "con thương mẹ nhiều lắm ♡"]), 1600), 1300); return; }
  k.lastTap = world.t;
  if (Math.random() < 0.15 && k.mind.memories.length) { say(k, `mama! guess what? ${pick(k.mind.memories.slice(0, 4)).text}`, 2600); return; }
  say(k, pick([...PERSONA[k.id].tap, ...PERSONA[k.id].tap, ...k.says, ...KID_SAYS]));
}
const LETTERS = ["a letter: “papa loves mama the mostest” ♡", "a letter: “you're my favourite person in da entire world”", "a letter: “the girls say goodnight mama ♡”", "a letter: “có anh ở đây” ♡", "a letter: “you + me = M + V. forever and ever”"];
const homeNames = () => { const h = KIDS.filter((k) => k.area === HOM).map((k) => k.name); return h.length ? h.join(" & ").replace(/ & (?=.* & )/, ", ") : ""; };

// ---------- toys ----------
function viewCenter() {
  const A = AREAS[cam.area], [cx, cy] = mapMode ? [A.PW / 2, A.PH / 2] : [cam.x + canvas.width / 2, cam.y + canvas.height / 2 + 8];
  return feetOf(...nearestWalkable(A, ...tileOf(cx, cy)));
}
const outsideNow = () => KIDS.filter((k) => k.area === ISL && !k.held && !k.patted && !k.asleep && !k.hidden);
function throwBall([x, y]) {
  world.ball = { x, y, vx: rand(-40, 40), vy: rand(-20, 20), h: 40, vh: 0, roll: 0 };
  sfx.boing(); toast("a ball! ⚽ tap it to kick it");
  joinIn(outsideNow().sort((a, b) => (Math.hypot(a.x - x, a.y - y) - PERSONA[a.id].bold * 900) - (Math.hypot(b.x - x, b.y - y) - PERSONA[b.id].bold * 900)).slice(0, 2), "ball", ["ball!!", "my ball!", "kick it to me!"]);
}
// vimi charges in first, mivi follows nicely, teddy peeks… then joins
function joinIn(kids, act, lines) {
  kids.forEach((k) => {
    const P = PERSONA[k.id], delay = (1 - P.bold) * 2600;
    const go = () => {
      if (k.held || k.hidden) return;
      interrupt(k, act);
      say(k, P.bold > 0.8 ? pick(["ME FIRST!! 💨", "i'm coming!!", ...lines]) : P.shy > 0.5 ? pick(["can teddy play too?", "*peeks*… hehe", "teddy wants to play ♡"]) : pick(lines), 1400);
    };
    if (P.shy > 0.5 && !k.asleep) { say(k, "*peeks* 👀", 1000); later(go, delay); } else if (delay < 400) go(); else later(go, delay);
  });
}
function popBubble(b, quiet = false) {
  if (b.popped) return;
  b.popped = true;
  for (let i = 0; i < 6; i++) particle("star", b.x + Math.cos(i) * b.r, b.y - b.alt + Math.sin(i) * b.r, pick(["#c9efff", "#ffc4dd", "#fff"]), 1, 1, -20, ISL);
  if (!quiet) tone(rand(1300, 1700), { type: "sine", slide: 2400, dur: 0.06, vol: 0.06 });
}
function blowBubbles([x, y]) {
  toast("bubbles! 🫧 pop them before the girls do");
  for (let i = 0; i < 14; i++) later(() => {
    world.bubbles.push({ x: x + rand(-50, 50), y: y + rand(-30, 30), alt: rand(4, 12), r: irand(3, 5), vx: rand(-6, 6), vy: rand(-4, 4), life: rand(12, 20), ph: rand(0, 6) });
    tone(rand(700, 1100), { type: "sine", slide: 1500, dur: 0.08, vol: 0.03 });
  }, i * 130);
  later(() => joinIn(outsideNow(), "bubbles", ["bubbles!!", "pop pop pop!"]), 400);
}
function danceParty(c) {
  world.party = 12; world.partyAt = c; world.partyArea = cam.area;
  toast("dance party! 🎵");
  const tune = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 587];
  for (let i = 0; i < 48; i++) {
    tone(tune[i % tune.length], { type: "square", dur: 0.16, vol: 0.035, at: i * 0.25 });
    if (i % 2 === 0) tone([131, 165, 196, 147][Math.floor(i / 8) % 4], { type: "triangle", dur: 0.22, vol: 0.08, at: i * 0.25 });
  }
  joinIn(KIDS.filter((k) => k.area === cam.area && !k.held && !k.hidden), "party", ["party!!", "dance with me!", "yay music!"]);
}
function giveTreat() {
  sfx.pop(); world.treat = 2;
  toast("cake on the picnic blanket! 🍰 (they'll find it)");
  KIDS.filter((k) => k.area === ISL && !k.held && !k.asleep && !k.hidden).sort((a, b) => a.needs.hunger - b.needs.hunger).slice(0, 2).forEach((k) => { interrupt(k, "picnic"); say(k, "cake!!", 1200); });
}
function dressUp() {
  const k = selected;
  if (!k) { toast("tap a girl first, then dress her up 🎀"); return; }
  k.acc = ACC[(ACC.indexOf(k.acc ?? null) + 1) % ACC.length];
  k.accByYou = Date.now();
  save();
  sfx.gift(); k.hop = 1; particle("star", k.x, k.y - 34, "#ffd966", 6, 8, -20, k.area);
  toast(k.acc ? `${k.name} is wearing ${ACC_NAME[k.acc]}` : `${k.name} took it off`);
  if (!k.asleep) say(k, k.acc ? pick(["do i look cute?", "ta-da! 🎀", "mama look!", "so pretty!"]) : "hehe", 1500);
}
function takePhoto() {
  const shown = KIDS.filter((k) => k.area === cam.area && !k.hidden && k.x > cam.x && k.x < cam.x + canvas.width && k.y > cam.y && k.y < cam.y + canvas.height + 24);
  shown.forEach((k) => { if (k.asleep) return; if (!k.held && !k.patted && !k.seatFrom && !["nap", "swing", "lie"].includes(k.pose)) k.dir = "down"; k.hop = 1; say(k, pick(["cheese!", "✌️", "say kimchi!", "pose!"]), 1400); });
  tone(1800, { type: "square", dur: 0.03, vol: 0.05 });
  later(() => {
    tone(2600, { type: "square", dur: 0.04, vol: 0.06 }); tone(900, { type: "sine", slide: 400, dur: 0.15, vol: 0.06, at: 0.04 });
    world.photo = true; draw(); world.photo = false;
    const S = mapMode ? 1.5 : 3, pw = Math.round(canvas.width * S), ph = Math.round(canvas.height * S);
    const out = canvasOf(pw + 48, ph + 120, (g) => {
      g.fillStyle = "#fffaf0"; g.fillRect(0, 0, pw + 48, ph + 120);
      g.strokeStyle = "#6b3a55"; g.lineWidth = 6; g.strokeRect(3, 3, pw + 42, ph + 114);
      g.imageSmoothingEnabled = false; g.drawImage(canvas, 24, 24, pw, ph);
      g.fillStyle = "#6b3a55"; g.font = "600 30px 'Pixelify Sans', monospace";
      g.fillText(cam.area === HOM ? "home sweet home ♡" : "our little island ♡", 28, ph + 76);
      g.font = "600 20px 'Pixelify Sans', monospace"; g.textAlign = "right";
      g.fillText(new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }).toLowerCase(), pw + 20, ph + 76);
      [[pw - 34, ph + 88, "#f48fb4"], [pw - 6, ph + 82, "#ffd966"]].forEach(([x, y, c]) => HEART.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === "x") R(g, c, x + i * 4, y + j * 4, 4, 4); })));
    });
    const fl = $("#flash"); fl.classList.add("on"); requestAnimationFrame(() => requestAnimationFrame(() => fl.classList.remove("on")));
    out.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `our-little-island-${Date.now()}.png`, { type: "image/png" });
      if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) navigator.share({ files: [file], title: "our little island" }).catch(() => {});
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); later(() => URL.revokeObjectURL(a.href), 5000); }
      toast(shown.length ? "photo saved ♡ 📸" : "photo saved 📸 (nobody was in it… follow a girl first!)");
    }, "image/png");
  }, 450);
}
function tapToy(p) {
  if (cam.area !== ISL) return false;
  const bub = world.bubbles.find((b) => Math.hypot(p.x - b.x, p.y - (b.y - b.alt)) < b.r + 4);
  if (bub) { popBubble(bub); return true; }
  const b = world.ball;
  if (b && Math.hypot(p.x - b.x, p.y - (b.y - 4 - b.h)) < 10) {
    const ang = Math.atan2(b.y - p.y - 4, b.x - p.x) + rand(-0.4, 0.4);
    b.vx = Math.cos(ang) * 160; b.vy = Math.sin(ang) * 160; b.vh = 70;
    sfx.boing();
    return true;
  }
  if (Math.abs(p.x - cat.x) < 10 && p.y < cat.y + 3 && p.y > cat.y - 13) {
    sfx.meow(); cat.hop = 1; particle("heart", cat.x, cat.y - 12, "#ffb7d0", 3, 4, -16, ISL);
    if (cat.state === "nap" || cat.state === "home") { cat.state = "sit"; cat.t = 3; toast("kitty woke up… mrrp? 🐱"); }
    return true;
  }
  return false;
}

// what tapping each thing does
const TAP = {
  house() { sfx.knock(); setCamMode("free"); switchArea(HOM, () => { const n = homeNames(); toast(n ? (KIDS.filter((k) => k.area === HOM).every((k) => k.asleep) ? `shhh… ${n} ${KIDS.filter((k) => k.area === HOM).length > 1 ? "are" : "is"} sleeping 💤` : `${n} ${KIDS.filter((k) => k.area === HOM).length > 1 ? "are" : "is"} home ♡`) : "nobody's home… they're out playing ♡"); }); },
  tree(o) {
    o.shake = 1.5; sfx.rustle();
    for (let i = 0; i < 10; i++) particle(o.kind === "cherry" ? "petal" : "leaf", o.tx * T + rand(2, 30), o.ty * T + rand(-8, 12), o.kind === "cherry" ? pick(["#ffb7d0", "#fff", "#ff9fbf"]) : pick(["#8fd17a", "#b5e6a0"]), 1, 2, 4, ISL);
    if (o.kind === "apple" && o.apples > 0 && Math.random() < 0.5) { o.apples--; particle("apple", o.tx * T + 16, o.ty * T + 4, "#e2405a", 1, 8, 0, ISL); toast("an apple fell! 🍎 (someone will eat it)"); }
  },
  mailbox() { sfx.pop(); toast(pick(LETTERS), 3600); },
  sign(o) { sfx.pop(); toast(SIGN_TEXT[o.say]); },
  basket() { sfx.pop(); toast("the picnic basket ♡ it's always full, they help themselves"); },
  swings() { const k = KIDS.find((k) => k.pose === "swing" && k.area === ISL); if (!k) return false; say(k, "higher papa!!", 1200); k.hop = 1; sfx.boing(); },
  seesaw() { sfx.boing(); const r = KIDS.filter((k) => k.pose === "seesaw"); r.forEach((k) => { k.hop = 1; }); if (r[0]) say(r[0], "wheee!", 1000); else return false; },
  slide() { return false; },
  fountain() { sfx.wish(); particle("star", FOUNTAIN.tx * T + 24, FOUNTAIN.ty * T + 18, "#ffd966", 8, 12, -20, ISL); toast(pick(["you made a wish ⛲ ♡", "plink! a wish for the girls ♡", "the fountain sparkles ✨"])); },
  shop() { sfx.door(); SHOP.doorT = 0.6; const k = KIDS.find((k) => k.hidden); toast(k ? `${k.name} is inside shopping 🛒` : "the girls' little shop ♡ everything's free for them"); },
  cart() { sfx.pop(); toast(pick(["ice cream! 🍦 strawberry, vanilla, mango or taro", "the ice cream cart is open all day ♡"])); },
  umbrella() { sfx.pop(); toast("a comfy spot for sunbathing 🏖️"); },
  crop(o) {
    const k = KIDS.find((k) => k.id === o.plot.owner);
    sfx.splash(); o.wet = 1; for (let i = 0; i < 6; i++) particle("drop", o.tx * T + 8 + rand(-4, 4), o.ty * T - rand(0, 6), "#9fd0f2", 1, 1, 10, ISL);
    if (!o.crop) toast(`${k.name}'s garden 🌱 she'll decide what to plant here`);
    else toast(`${k.name}'s ${CROPS[o.crop].name} ${CROPS[o.crop].emoji} ${o.g >= 1 ? "are ready to pick!" : `are ${Math.round(o.g * 100)}% grown · you watered them 💧`}`);
  },
  plant(o) {
    sfx.splash(); o.wet = 1; for (let i = 0; i < 6; i++) particle("drop", o.tx * T + 8 + rand(-4, 4), o.ty * T - rand(0, 6), "#9fd0f2", 1, 1, 10, ISL);
    toast(o.g >= 3 ? "ripe strawberries! 🍓 the girls will pick them" : "you watered the strawberries 💧");
  },
  // in the house
  bed(o) {
    const k = KIDS.find((k) => k.area === HOM && k.pose === "bed" && BEDS[KID_BED[k.id]].obj === o);
    if (k) { tapKid(k); return; }
    const owner = KIDS.find((k) => KID_BED[k.id] === o.i);
    sfx.pop(); toast(`${owner.name}'s bed ♡ (drag her here to tuck her in)`);
  },
  fridge() { sfx.door(); FRIDGE.openT = 1.4; toast(`the fridge is always full ♡ ${world.drawings ? `${world.drawings} drawing${world.drawings > 1 ? "s" : ""} on the door` : "they help themselves"}`); },
  stove() { sfx.pop(); toast(STOVE.on ? "something yummy is cooking 🥞" : "the girls make pancakes here 🍳"); },
  tv() { world.tvUser = !world.tvUser; tone(world.tvUser ? 1800 : 700, { type: "square", dur: 0.05, vol: 0.04 }); toast(world.tvUser ? "cartoons on! 📺 (they'll come watch)" : "tv off"); },
  piano() { const notes = [0, 2, 4, 5, 4, 2, 0].map((i) => PENTA[i]); notes.forEach((f, i) => tone(f, { type: "triangle", dur: 0.4, vol: 0.06, at: i * 0.16 })); particle("note", 16 * T, 3 * T - 10, "#f48fb4", 4, 8, -18, HOM); },
  shelf() { sfx.pop(); toast("storybooks 📚 the bunny princess is their favourite"); },
  tub() { sfx.splash(); particle("bubble", 21 * T + 8, 11 * T + 6, "#ffffff", 6, 12, -10, HOM); },
  bathsink() { sfx.pop(); toast("three little toothbrushes 🪥"); },
  chest() { sfx.boing(); particle("star", 2 * T, 13 * T - 4, "#ffd966", 6, 10, -24, HOM); toast("the toy chest 🧸"); },
  dresser() { sfx.pop(); toast("their dress-up clothes 🎀"); },
  pot() { sfx.rustle(); },
  bush(o) { sfx.rustle(); o.shake = 1; for (let i = 0; i < 5; i++) particle("leaf", o.tx * T + 8, o.ty * T + 6, pick(["#86c970", "#b2e59a"]), 1, 6, -18, ISL); },
  table() { sfx.pop(); toast(world.plates ? "pancakes on the table 🥞" : "the family table ♡"); },
  nightstand() { sfx.pop(); },
  sofa() { sfx.boing(); },
  window() { sfx.pop(); toast(isNight() ? "the stars are out ✨" : raining() ? "it's raining on the island 🌧️" : "a lovely day on the island ☀️"); },
  clock() { const d = new Date(); toast(`it's ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "am" : "pm"} ${bedtime() ? "· bedtime 🌙" : mealTime() ? "· meal time 🍽️" : ""}`); },
  frame() { sfx.gift(); toast("a photo of mama & papa ♡"); },
  mat() { setCamMode("free"); switchArea(ISL); },
};
function tapWorld(p) {
  audio();
  world.pa = cam.area;
  const A = AREAS[cam.area], [tx, ty] = tileOf(p.x, p.y);
  const o = objAt(A, p);
  if (o && TAP[o.type] && TAP[o.type](o, p) !== false) return true;
  if (cam.area === ISL) {
    if (I.at(tx, ty) === WATER) {
      sfx.splash(); particle("splash", p.x, p.y, "#e8f7ff", 8, 4, -24, ISL);
      const d = ducks.find((d) => Math.hypot(d.x - p.x, d.y - p.y) < 14);
      if (d) { sfx.quack(); d.vx = -d.vx * 2; }
      return true;
    }
    if (I.at(tx, ty) === TALL) { sfx.rustle(); particle("leaf", p.x, p.y, "#7fbe68", 6, 6, -24, ISL); }
  }
  // with a girl picked: call her over
  if (selected && selected.area === cam.area && !selected.asleep && A.walk(tx, ty)) {
    const k = selected;
    const come = () => {
      if (k.held || k.area !== cam.area) return;
      endStep(k); snapOff(k); k.act = "called"; k.claims = [];
      k.steps = [{ go: [tx, ty], area: k.area, label: "coming to you!", speed: k.speed * (k.id === "teddy" ? 1.35 : 1.15) }, { stay: 3, label: "waiting for you ♡", face: "down", start() { k.hop = 1; } }];
      say(k, pick([...PERSONA[k.id].called, "đợi con!"]), 1300);
    };
    // she has a mind of her own: vimi sometimes finishes what she's doing first (teddy always runs straight to you)
    if (k.id === "blossom" && likeOf(k, k.act) > 0.6 && Math.random() < 0.35 && !["called", "landed"].includes(k.act)) { say(k, pick(["one more minute papa!", "wait, i'm almost done!", "just one more go!"]), 1500); later(come, 2600); }
    else come();
    particle("heart", p.x, p.y, "#ffd966", 2, 2, -20, cam.area);
    return true;
  }
  return false;
}

let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  const p = toWorld(e);
  canvas.setPointerCapture(e.pointerId);
  drag = { k: kidAt(p), p, cx: e.clientX, cy: e.clientY, camX: cam.x, camY: cam.y, moved: false };
  const k = drag.k, d = drag;
  // hold your finger on her for a pat
  if (k) d.patTimer = later(() => {
    if (drag !== d || d.moved) return;
    d.pat = true; k.patted = true; if (!k.seatFrom) k.dir = "down";
    audio(); select(k);
    say(k, k.asleep ? "mmm… ♡" : pick(["mmm ♡", "hehe", "pat pat", "more pls"]), 1200);
  }, 420);
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag || drag.pat) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) > 6) {
    drag.moved = true;
    const k = drag.k;
    if (k) {
      audio(); sfx.squeak(); select(k);
      if (k.asleep && bedtimeFor(k)) k.upLate = world.t + 180; // woken by you: she stays up with you a few minutes
      endStep(k); mindFinish(k); k.seatFrom = null; k.hopping = false; k.lift = 0;
      feel(k, "you carried me around!", { excited: 0.2 + 0.2 * PERSONA[k.id].traits.brave, happy: 0.1 * PERSONA[k.id].traits.cuddly });
      k.steps = []; k.path = []; k.held = true; k.act = "held"; k.claims = []; k.label = "being carried by you ♡"; k.pose = "stand";
      if (!k.bubble.classList.contains("show")) say(k, pick(["wheee!", "put me down papa!", "mama i'm flying", "hehe"]), 1400);
    } else if (!mapMode) setCamMode("free");
  }
  if (!drag.moved) return;
  const A = AREAS[cam.area];
  if (drag.k) { const p = toWorld(e); drag.k.x = clamp(p.x, 4, A.PW - 4); drag.k.y = clamp(p.y + 18, 20, A.PH - 4); }
  else if (!mapMode) { cam.x = drag.camX - (e.clientX - drag.cx) / scale; cam.y = drag.camY - (e.clientY - drag.cy) / scale; }
});
function drop() {
  if (!drag) return;
  const d = drag; drag = null;
  cancel(d.patTimer);
  if (d.pat) {
    d.k.patted = false; d.k.hop = d.k.seatFrom ? 0 : 1;
    achieve(d.k, "pat"); feel(d.k, "mama gave me pats ♡", { happy: 0.2 * (0.5 + PERSONA[d.k.id].traits.cuddly), lonely: -0.4 });
    if (!d.k.asleep) say(d.k, pick(d.k.id === "rose" ? ["thank you mama ♡", "that was lovely, thank you", "i love pats ♡"] : d.k.id === "teddy" ? ["more… please? 🥺", "con thương mẹ nhiều lắm", "mama's hands are warm ♡"] : ["hehe more!", "that tickles!", "again again!"]), 1600);
    return;
  }
  if (!d.moved) { if (d.k) tapKid(d.k); else if (!(tapToy(d.p) || tapWorld(d.p))) select(null); return; }
  const k = d.k;
  if (!k) return;
  k.held = false;
  const A = areaOf(k), [tx, ty] = tileOf(k.x, k.y);
  // in the house: drop her on her bed to tuck her in, or on the doormat to send her out
  if (k.area === HOM) {
    const bed = BEDS.find((b) => k.x >= b.obj.tx * T && k.x < (b.obj.tx + 2) * T && k.y >= 3 * T && k.y < 7 * T);
    if (bed) {
      const mine = BEDS[KID_BED[k.id]];
      [k.x, k.y] = feetOf(...mine.approach);
      doActivity(k, bedtime() ? "sleep" : "bednap", { quick: true });
      sfx.lullaby(); say(k, bed === mine ? pick(GOODNIGHT) : "this isn't my bed hehe", 1600);
      return;
    }
    if (Math.abs(tx - HOME_ENTRY[0]) <= 1 && ty >= HOME_ENTRY[1]) {
      [k.x, k.y] = feetOf(...HOME_ENTRY); k.act = "landed"; k.claims = [];
      k.steps = [...travel(k, ISL).slice(1), { stay: 1.5, label: "outside!", start() { say(k, "outside time!", 1200); } }];
      return;
    }
  }
  // on the island: drop her at the front door and she goes in
  if (k.area === ISL && Math.abs(tx - DOOR[0]) <= 1 && ty >= DOOR[1] - 2 && ty <= DOOR[1]) {
    [k.x, k.y] = feetOf(...DOOR); k.act = "landed"; k.claims = [];
    k.steps = [...travel(k, HOM).slice(1), { stay: 4, label: "home sweet home ♡", face: "down" }];
    if (bedtime()) { sfx.lullaby(); say(k, pick(GOODNIGHT)); } else say(k, "going home!", 1200);
    return;
  }
  if (k.area === ISL && A.at(tx, ty) === WATER) { feel(k, "i got dropped in the water!", { grumpy: 0.35 - 0.25 * PERSONA[k.id].traits.brave, excited: 0.2 * PERSONA[k.id].traits.brave }); sfx.splash(); particle("splash", k.x, k.y, "#e8f7ff", 12, 6, -30, ISL); say(k, pick(["splash!! 💦", "i'm all wet papa!", "brrr cold!"]), 1600); up(k, "clean", -10); }
  const [lx, ly] = A.walk(tx, ty) ? [tx, ty] : nearestWalkable(A, tx, ty);
  const [fx, fy] = feetOf(lx, ly);
  k.lift = 14 + clamp(fy - k.y, 0, 30); // she drops down from where you let go
  k.x = fx; k.y = fy;
  if (!(k.area === ISL && A.at(tx, ty) === WATER)) say(k, pick(["ta-da!", "again again!", "hehe", "where am i?"]), 1400);
  k.steps = [{ stay: 1.2, label: "landed!" }];
  k.act = "landed"; k.claims = [];
}
canvas.addEventListener("pointerup", drop);
canvas.addEventListener("pointercancel", drop);

$("#autoBtn").addEventListener("click", () => { audio(); sfx.pop(); if (mapMode) toggleMap(); select(null); setCamMode("auto"); toast("following whoever is having the most fun 🎥"); });
function toggleMap() { mapMode = !mapMode; $("#mapBtn").classList.toggle("on", mapMode); fit(); }
$("#mapBtn").addEventListener("click", () => { audio(); sfx.pop(); toggleMap(); });
$("#placeBtn").addEventListener("click", () => { audio(); sfx.door(); setCamMode("free"); switchArea(cam.area === ISL ? HOM : ISL); });
const closeTray = () => { $("#tray").classList.remove("open"); $("#toyBtn").classList.remove("on"); };
$("#toyBtn").addEventListener("click", () => { audio(); sfx.pop(); const open = $("#tray").classList.toggle("open"); $("#toyBtn").classList.toggle("on", open); });
$("#tray").addEventListener("click", (e) => {
  const b = e.target.closest("[data-toy]");
  if (!b) return;
  audio();
  const toy = b.dataset.toy;
  closeTray();
  const outside = (fn) => (cam.area === ISL ? fn() : switchArea(ISL, fn));
  if (toy === "treat") outside(giveTreat);
  if (toy === "ball") outside(() => throwBall(viewCenter()));
  if (toy === "bubbles") outside(() => blowBubbles(viewCenter()));
  if (toy === "party") danceParty(viewCenter());
  if (toy === "dress") dressUp();
  if (toy === "photo") takePhoto();
});

// ---------- the girls' chips and card ----------
const MOOD = moodFace;
const where = (k) => (k.area === HOM ? "at home" : k.hidden ? "in the shop" : "outside");
KIDS.forEach((k) => {
  const c = document.createElement("button");
  c.type = "button"; c.className = "chip"; c.dataset.id = k.id;
  c.innerHTML = `<canvas width="${GW}" height="${GH}"></canvas><span class="txt"><b></b><small></small></span>`;
  c.querySelector("b").textContent = k.name;
  c.querySelector("canvas").getContext("2d").drawImage(k.spr.front[0], 0, 0);
  c.addEventListener("click", () => { audio(); sfx.pop(); if (mapMode) toggleMap(); select(selected === k ? null : k); if (!selected) setCamMode("auto"); });
  k.chip = c;
  $("#chips").appendChild(c);
});
const BARS = [["hunger", "🍓", "tummy"], ["energy", "⚡", "energy"], ["fun", "🎈", "fun"], ["love", "💗", "love"], ["clean", "🫧", "clean"]];
$("#cardBars").innerHTML = BARS.map(([key, icon, name]) => `<div class="bar" title="${name}"><span>${icon}</span><i><span data-need="${key}"></span></i></div>`).join("");
$("#cardX").addEventListener("click", () => { audio(); sfx.pop(); select(null); setCamMode("auto"); });
function renderCard() {
  const k = selected;
  if (!k) return;
  $("#cardName").textContent = `${k.name} ${MOOD(k)}`;
  $("#cardDoing").textContent = `${k.asleep ? "fast asleep 💤" : k.label} · ${where(k)}`;
  const pic = $("#cardPic").getContext("2d"); pic.clearRect(0, 0, GW, GH); pic.drawImage(k.asleep ? k.sleepSpr : k.spr.front[0], 0, 0);
  $$("#cardBars [data-need]").forEach((s) => { const v = Math.round(k.needs[s.dataset.need]); s.style.width = v + "%"; s.classList.toggle("low", v < 30); });
  const m = k.mind, plot = plotOf(k).tiles.filter((t) => t.crop), ripe = plot.filter((t) => t.g >= 1).length;
  const loves = Object.entries(m.likes).filter(([id]) => ACT_NAME[id]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => ACT_NAME[id].replace(/^my /, "her "));
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const meh = Object.entries(m.likes).filter(([id, v]) => ACT_NAME[id] && v < -0.2).sort((a, b) => a[1] - b[1]).slice(0, 1).map(([id]) => ACT_NAME[id].replace(/^my /, "her "));
  $("#talkIn").placeholder = k.teach ? `what does it mean? say it another way…` : `say something to ${k.name}…`;
  const tk = k.id + "|" + (k.teach || ""), tEl = $("#teach");
  if (tEl.dataset.key !== tk) {
    tEl.dataset.key = tk; tEl.hidden = !k.teach;
    tEl.innerHTML = k.teach ? `<p>teach her: “${esc(clip(k.teach, 24))}” means…</p>` + TEACH_CHIPS.map((it) => `<button type="button" data-mean="${it}">${CHIP_FACE[it]} ${esc(MEANS[it])}</button>`).join("") + `<button type="button" data-mean="">✕ never mind</button>` : "";
  }
  $("#talkLog").innerHTML = (k.talkLog || []).slice(-2).map((l) => `<p><b>${esc(l.who === "you" ? "you" : l.who)}:</b> ${esc(l.text)}</p>`).join("");
  $("#cardMind").innerHTML = [
    `<p class="title">${esc(PERSONA[k.id].title)} · feeling ${MOOD_WORD[moodOf(k)]}</p>`,
    `<p>💭 ${esc(k.asleep ? "dreaming…" : m.why)}</p>`,
    `<p>${m.goal?.social ? "🎯" : "⭐"} ${m.goal ? `${m.goal.social ? "wants to" : "dream:"} ${esc(m.goal.text.replace(/\bmy\b/g, "her"))}` : `${m.dreams} dream${m.dreams === 1 ? "" : "s"} come true`}</p>`,
    `<p>🌱 ${plot.length ? plot.map((t) => CROPS[t.crop].emoji).join("") + (ripe ? ` · ${ripe} ready` : "") : "her garden is empty"}</p>`,
    `<p>♡ loves ${esc(loves.join(" & "))}${meh.length ? ` · 😑 not ${esc(meh.join(" or "))}` : ""}</p>`,
    `<p>💞 loves ${others(k).map((o) => o.name).join(" & ")} the same</p>`,
    m.memories[0] ? `<p>📔 “${esc(m.memories[0].text)}”</p>` : "",
  ].join("");
}
function renderChips() {
  KIDS.forEach((k) => { k.chip.querySelector("small").textContent = `${MOOD(k)} ${k.asleep ? "asleep in bed" : k.label}${k.area === HOM && !k.asleep ? " · home" : ""}`; });
  renderCard(); renderPlace();
}

// ======================================================================
// remembering everything
// ======================================================================
function save() {
  if (!document.hidden || pipWin) store.set("seen", String(Date.now()));
  store.set("world", JSON.stringify({
    v: 2, t: Date.now(),
    kids: Object.fromEntries(KIDS.map((k) => [k.id, { needs: k.needs, area: k.area, x: k.x, y: k.y, gift: k.gift, acc: k.acc || null, accByYou: k.accByYou || 0, asleep: k.asleep,
      mind: { likes: k.mind.likes, crops: k.mind.crops, planted: k.mind.planted, memories: k.mind.memories, goal: k.mind.goal, lastGoal: k.mind.lastGoal, dreams: k.mind.dreams, aff: k.mind.aff, thought: k.mind.thought, why: k.mind.why, mood: k.mind.mood, history: k.mind.history, rematch: k.mind.rematch } }])),
    plots: PLOTS.map((p) => p.tiles.map((t) => [t.crop, +t.g.toFixed(3), +t.wet.toFixed(2)])), vase: world.vase || null,
    castle: CASTLE.level, shells: shells.length, plants: PLANTS.map((p) => [+p.g.toFixed(2), +p.wet.toFixed(2)]), apples: APPLE_TREES.map((o) => o.apples), drawings: world.drawings,
  }));
}
// while you're away they look after themselves: they eat, play, bathe and sleep on their own
function catchUp(seconds) {
  const s = Math.min(seconds, 24 * 3600);
  if (s < 5) return;
  KIDS.forEach((k) => {
    const n = k.needs;
    if (s > 600) { n.hunger = Math.max(n.hunger, rand(60, 90)); n.fun = Math.max(n.fun, rand(50, 80)); n.clean = Math.max(n.clean, rand(55, 85)); n.love = Math.max(n.love, 45); n.energy = Math.max(n.energy, k.asleep ? 80 : rand(45, 75)); }
    else { n.hunger -= 0.04 * s; n.fun -= 0.025 * s; n.love -= 0.008 * s; if (!k.asleep) n.energy -= 0.011 * s; }
    for (const key in n) n[key] = clamp(n[key], 15, 100);
    const f = Math.exp(-s / 600), mo = k.mind.mood;
    for (const key of MOODS) mo[key] = (key === "happy" ? 0.35 : 0) + (mo[key] - (key === "happy" ? 0.35 : 0)) * f;
  });
  PLANTS.forEach((p) => { p.g = Math.min(3, p.g + s / 700); p.wet = s > 900 ? rand(0.3, 1) : p.wet; });
  APPLE_TREES.forEach((o) => { o.apples = Math.min(5, o.apples + Math.floor(s / 240)); });
  PLOTS.forEach((p) => {
    const k = KIDS.find((k) => k.id === p.owner);
    p.tiles.forEach((t) => {
      if (!t.crop) { if (s > 1800) { const c = chooseCrop(k); t.crop = c.id; t.g = rand(0, 0.4); t.wet = rand(0.3, 1); k.mind.planted[c.id] = (k.mind.planted[c.id] || 0) + 1; } return; }
      t.g = Math.min(1, t.g + s / CROPS[t.crop].grow);
      if (t.g >= 1 && s > 3600) { const id = t.crop; remember(k, `i grew ${CROPS[id].name} ${CROPS[id].emoji}`); if (!k.gift && (CROPS[id].flower || k.id === "teddy")) k.gift = id; const c = chooseCrop(k); t.crop = c.id; t.g = rand(0, 0.5); t.wet = 1; }
      else if (s > 900) t.wet = rand(0.3, 1);
    });
  });
  if (s > 3600 * 3) shells = newShells(); // the tide brings new shells
  if (s > 1200) KIDS.forEach((k) => { awayMemories(k, s); if (!k.held) placeSomewhere(k); });
}
// after a long time away, put each girl somewhere that makes sense for the time
function placeSomewhere(k) {
  endStep(k); k.steps = []; k.claims = []; k.path = []; snapOff(k); k.asleep = false;
  if (bedtimeFor(k) || sleepLog[k.id]) { k.area = HOM; doActivity(k, "sleep", { inBed: true, quiet: true }); return; }
  if (Math.random() < (raining() ? 0.75 : 0.35)) { k.area = HOM; [k.x, k.y] = feetOf(...randomTile(HOME)); }
  else { k.area = ISL; [k.x, k.y] = feetOf(...randomTile(I)); }
  k.act = "idle"; k.label = "looking around";
}
cam.target = KIDS[0];
(function load() {
  let saved = null;
  try { saved = JSON.parse(store.get("world") || "null"); } catch {}
  if (saved) {
    KIDS.forEach((k) => {
      const d = saved.kids?.[k.id];
      if (!d) return;
      Object.assign(k.needs, d.needs);
      k.gift = d.gift || null;
      k.acc = ACC.includes(d.acc) ? d.acc : null;
      k.accByYou = d.accByYou || 0;
      if (d.mind) { const m = d.mind; Object.assign(k.mind.likes, m.likes); Object.assign(k.mind.crops, m.crops); Object.assign(k.mind, { planted: m.planted || {}, memories: m.memories || [], goal: m.goal && GOALS[m.goal.id] ? m.goal : null, lastGoal: m.lastGoal || null, dreams: m.dreams || 0, aff: m.aff || {}, thought: m.thought || "", why: m.why || "just woke up", history: (m.history || []).slice(-6), rematch: m.rematch || null }); if (m.mood) Object.assign(k.mind.mood, m.mood); if (k.mind.goal?.social && !(k.mind.goal.until > Date.now())) k.mind.goal = null; }
      if (saved.v === 2 && AREAS[d.area]) {
        k.area = d.area;
        const A = AREAS[d.area], t = tileOf(d.x, d.y);
        [k.x, k.y] = feetOf(...(A.walk(...t) ? t : nearestWalkable(A, ...t)));
      }
    });
    if (typeof saved.castle === "number") CASTLE.level = saved.castle;
    if (typeof saved.shells === "number") shells = shells.slice(0, saved.shells);
    if (saved.plants) saved.plants.forEach(([g, w], i) => { if (PLANTS[i]) { PLANTS[i].g = g; PLANTS[i].wet = w; } });
    if (saved.apples) saved.apples.forEach((n, i) => { if (APPLE_TREES[i]) APPLE_TREES[i].apples = n; });
    world.drawings = saved.drawings || 0;
    world.vase = saved.vase || null;
    if (saved.plots) saved.plots.forEach((tiles, i) => tiles.forEach(([crop, g, wet], j) => { const t = PLOTS[i]?.tiles[j]; if (t && (!crop || CROPS[crop])) Object.assign(t, { crop, g, wet }); }));
  }
  // first visit: each girl has already planted a few of her favourites
  if (!saved?.plots) PLOTS.forEach((p) => { const k = KIDS.find((k) => k.id === p.owner); p.tiles.forEach((t, i) => { if (i % 2 === 0) { t.crop = Object.keys(PERSONA[k.id].crops)[i % 3]; t.g = rand(0.2, 1); t.wet = rand(0.2, 1); k.mind.planted[t.crop] = 1; } }); });
  // anyone asleep (here, or tucked in on the main page) is in her bed
  KIDS.forEach((k) => {
    if (sleepLog[k.id] || saved?.kids?.[k.id]?.asleep || bedtimeFor(k)) { k.area = HOM; doActivity(k, "sleep", { inBed: true, quiet: true }); }
  });
  if (saved?.t) catchUp((Date.now() - saved.t) / 1000);
  // look at someone awake if we can, wherever she is
  cam.target = KIDS.find((k) => !k.asleep) || KIDS[0];
  cam.area = cam.target.area;
})();
setInterval(save, 8000);
addEventListener("pagehide", save);
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (pipWin) return; // still showing in the little window
  if (document.hidden) { hiddenAt = Date.now(); save(); }
  else if (hiddenAt) { const away = (Date.now() - hiddenAt) / 1000; catchUp(away); hiddenAt = 0; syncSleep(); if (away > 1800) openDiary(true); }
});
// bedtime shared with the nursery on the main page (if both are open)
function syncSleep() {
  try { sleepLog = JSON.parse(store.get("sleep") || "{}") || {}; } catch { return; }
  KIDS.forEach((k) => {
    if (k.asleep && !sleepLog[k.id] && k.step && k.pose === "bed") { k.upLate = world.t + 180; k.step.dur = 0; }
    else if (!k.asleep && sleepLog[k.id] && !k.held) { k.area = HOM; interrupt(k, bedtimeFor(k) ? "sleep" : "bednap", { inBed: true, quiet: true }); }
  });
}
addEventListener("storage", (e) => { if (e.key === "tomylove.sleep") syncSleep(); });
addEventListener("pageshow", (e) => { if (e.persisted) syncSleep(); });

function tickClock() {
  const d = new Date(), h = FIXED_HOUR ?? d.getHours() + d.getMinutes() / 60, hh = Math.floor(h), mm = FIXED_HOUR !== null ? Math.round((h % 1) * 60) : d.getMinutes();
  const icon = isNight() ? "🌙" : raining() ? "🌧️" : world.weather === "cloudy" ? "⛅" : "☀️";
  $("#clock").textContent = `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"} ${icon}`;
}
// the sea around the map gets dark at night too
function tintBackdrop() { if (cam.area !== ISL) return; const t = tintNow(), sea = [159, 214, 240]; view.style.background = `rgb(${sea.map((v, i) => Math.round(v + (t.rgb[i] - v) * t.a)).join(",")})`; }

fit(); snapCam();
tickClock(); setInterval(tickClock, 15000);
setInterval(tintBackdrop, 5000);
renderChips();
later(() => toast("tap a girl to follow her · hold to pat · drag to carry · tap the house to peek inside ♡", 5200), 800);

// ---------- bumping: the girls (and kitty) can't walk through each other ----------
const STILL = new Set(["swing", "seesaw", "bed", "tub", "sofa", "piano", "nap", "lie", "sit", "fish", "kite", "crouch"]);
const pinned = (k) => !!(k.seatFrom || k.hopping || k.asleep || STILL.has(k.pose) || (k.act === "slide" && k.step?.run));
const solidKid = (k) => !k.held && !k.hidden && !(k.ghost > 0);
function nudge(o, dx, dy) {
  const A = AREAS[o.area || ISL], nx = o.x + dx, ny = o.y + dy;
  if (A.walk(...tileOf(nx, o.y))) o.x = nx;
  if (A.walk(...tileOf(o.x, ny))) o.y = ny;
}
function separate(dt) {
  KIDS.forEach((k) => { if (k.ghost > 0) k.ghost -= dt; });
  const bodies = KIDS.filter(solidKid).map((k) => ({ o: k, area: k.area, rx: 13, ry: 7, fixed: pinned(k), moving: k.path.length > 0 }));
  if (!cat.petBy) bodies.push({ o: cat, area: ISL, rx: 8, ry: 5, fixed: false, moving: cat.path.length > 0, isCat: true });
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    if (a.area !== b.area || (a.fixed && b.fixed)) continue;
    if (a.o.act === "stroll" && b.o.act === "stroll") continue; // holding hands
    const rx = (a.rx + b.rx) / 2, ry = (a.ry + b.ry) / 2;
    let dx = b.o.x - a.o.x, dy = b.o.y - a.o.y;
    const d = Math.hypot(dx / rx, dy / ry);
    if (d >= 1) continue;
    if (d < 0.01) { dx = rand(-1, 1); dy = rand(-1, 1); }
    const len = Math.hypot(dx, dy) || 1, push = Math.min((1 - d) * Math.min(rx, ry), 60 * dt);
    let nx = dx / len, ny = dy / len;
    // two girls walking into each other step to the side and slide past
    if (a.moving && b.moving) { nx += -ny * 0.6; ny += nx * 0.6; }
    const share = a.fixed ? [0, 1] : b.fixed ? [1, 0] : a.isCat ? [1, 0.15] : b.isCat ? [0.15, 1] : [0.5, 0.5];
    nudge(a.o, -nx * push * share[0] * 2, -ny * push * share[0] * 2);
    nudge(b.o, nx * push * share[1] * 2, ny * push * share[1] * 2);
  }
}

// ---------- the mini map: the whole place, where everyone is, and what you're looking at ----------
const mini = $("#mini"), mctx = mini.getContext("2d"), MINI = { [ISL]: 3, [HOM]: 5 }, miniBase = {};
const KID_DOT = { rose: "#e2405a", blossom: "#ffd966", teddy: "#a5826a" };
function miniSize() { const small = view.clientWidth < 620, s = MINI[cam.area] * (small ? 0.72 : 1), A = AREAS[cam.area]; return [Math.round(A.W * s), Math.round(A.H * s)]; }
function miniFor(id) {
  if (miniBase[id]) return miniBase[id];
  const A = AREAS[id];
  const full = canvasOf(A.PW, A.PH, (g) => { g.drawImage(GROUND[id], 0, 0); A.objs.slice().sort((a, b) => a.base - b.base).forEach((o) => { try { DRAW[o.type](g, o); } catch {} }); });
  return (miniBase[id] = full);
}
function drawMini() {
  const [w, h] = miniSize(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (mini.width !== w * dpr || mini.height !== h * dpr) { mini.width = w * dpr; mini.height = h * dpr; mini.style.width = w + "px"; mini.style.height = h + "px"; $("#card").style.top = h + 22 + "px"; }
  const A = AREAS[cam.area], s = (w * dpr) / A.PW, g = mctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(miniFor(cam.area), 0, 0, mini.width, mini.height);
  const t = tintNow();
  if (t.a > 0.05) { g.fillStyle = `rgba(${t.rgb.join(",")},${t.a * (cam.area === HOM ? 0.6 : 1)})`; g.fillRect(0, 0, mini.width, mini.height); }
  // what's on screen right now
  if (!mapMode) { g.strokeStyle = "#fffaf0"; g.lineWidth = 2 * dpr; g.strokeRect(cam.x * s, cam.y * s, canvas.width * s, canvas.height * s); g.strokeStyle = "rgba(74,43,58,.6)"; g.lineWidth = 1 * dpr; g.strokeRect(cam.x * s - dpr, cam.y * s - dpr, canvas.width * s + 2 * dpr, canvas.height * s + 2 * dpr); }
  if (cam.area === ISL) { g.fillStyle = "#fffaf2"; g.strokeStyle = "#4a2b3a"; g.lineWidth = dpr; g.beginPath(); g.arc(cat.x * s, (cat.y - 4) * s, 2.2 * dpr, 0, Math.PI * 2); g.fill(); g.stroke(); }
  // the girls: little faces where they are; whoever's in the other place waits by the door
  const door = cam.area === ISL ? feetOf(...DOOR) : feetOf(...HOME_ENTRY);
  let away = 0;
  g.imageSmoothingEnabled = false;
  KIDS.forEach((k) => {
    let x, y;
    if (k.area === cam.area) { x = k.x * s; y = (k.y - 8) * s; }
    else { x = door[0] * s + (away - 1) * 9 * dpr; y = (door[1] - (cam.area === ISL ? 4 : 10)) * s; away++; }
    const r = 6 * dpr;
    g.fillStyle = k === selected ? "#ffd966" : "#fffaf0"; g.strokeStyle = KID_DOT[k.id]; g.lineWidth = 2 * dpr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.drawImage(k.asleep ? k.sleepSpr : k.spr.front[0], 4, 2, 24, 20, x - r * 0.85, y - r * 0.75, r * 1.7, r * 1.42);
    if (k.area !== cam.area) { g.fillStyle = "#4a2b3a"; g.font = `${7 * dpr}px sans-serif`; g.textAlign = "center"; g.fillText(cam.area === ISL ? "⌂" : "↑", x, y + r + 7 * dpr); }
  });
}
mini.addEventListener("pointerdown", (e) => {
  e.stopPropagation(); audio(); sfx.pop();
  const r = mini.getBoundingClientRect(), A = AREAS[cam.area];
  const wx = ((e.clientX - r.left) / r.width) * A.PW, wy = ((e.clientY - r.top) / r.height) * A.PH;
  // tapping a girl's face picks her
  const k = KIDS.find((k) => k.area === cam.area && Math.hypot(k.x - wx, k.y - 8 - wy) < 6 / (r.width / A.PW) + 4);
  if (k) { if (mapMode) toggleMap(); select(k); return; }
  if (mapMode) toggleMap();
  setCamMode("free");
  cam.x = wx - canvas.width / 2; cam.y = wy - canvas.height / 2; clampCam();
});

// ======================================================================
// talking to them, their diary and their conversations: all their own, no AI
// ======================================================================
const clip = (t, n = 90) => String(t || "").replace(/\s+/g, " ").trim().slice(0, n);

// ---------- talking to them (simple rules, no AI) ----------
const SAY_OK = {
  rose: ["of course mama ♡", "yes mama, thank you ♡", "okay papa, i'd love to ♡"],
  blossom: ["okay!! 💨", "yesss let's go!", "race you there!"],
  teddy: ["…okay mama ♡", "teddy go…", "okay papa ♡"],
};
const SAY_LATER = { rose: ["just one moment please, mama ♡"], blossom: ["after this one!! 💨", "one more minute papa!"], teddy: ["okay… after this?"] };
const LOVE_BACK = {
  rose: ["i love you too mama, sooo much ♡", "thank you mama, i love you to the moon 🌙", "i love you more, papa ♡"],
  blossom: ["I LOVE YOU MORE!! 💕", "love you love you love you!", "hehe i love you to infinity!"],
  teddy: ["con thương mẹ nhiều lắm ♡", "teddy loves mama and papa nhiều lắm…", "*hugs you tight* 🥺♡"],
};
const ASK_ACTS = [
  [/ice ?cream|\bkem\b|🍦/i, "icecream"], [/flower|\bhoa\b|bouquet|🌷|🌸/i, "flowers"], [/garden|plant|grow|water/i, "myplot"], [/swing/i, "swing"], [/slide/i, "slide"],
  [/see ?saw/i, "seesaw"], [/kite/i, "kite"], [/fish/i, "fishing"], [/shell/i, "shells"], [/beach|sea|swim|paddle/i, "beach"], [/sand ?castle|sandbox/i, "sandbox"],
  [/\btv\b|cartoon|telly/i, "tv"], [/piano|music|song|sing/i, "piano"], [/bath|wash|clean|shower|\btam\b/i, "bath"], [/read|book|story/i, "read"], [/draw|paint|picture|colou?r/i, "draw"],
  [/cook|pancake|bake/i, "cook"], [/tea ?party|\btea\b/i, "teaparty"], [/hide|seek/i, "hide"], [/\btag\b|chase/i, "tag"], [/kitty|\bcat\b|\bmeo\b|🐱/i, "kitty"], [/duck|pond/i, "pond"],
  [/dress|outfit|tiara|pretty/i, "dressup"], [/wish|fountain/i, "fountain"], [/shop/i, "shop"], [/picnic/i, "picnic"], [/apple/i, "apples"], [/puddle/i, "puddles"],
  [/cloud/i, "cloudgaze"], [/toy|block|doll/i, "toys"], [/window/i, "window"], [/mail|letter/i, "mail"], [/explore|adventure|walk/i, "explore"],
  [/hungry|\beat\b|food|an com|an di|an gi|snack|dinner|lunch|breakfast|🍓|🍰/i, (k) => (k.area === HOM ? "eat" : pick(["picnic", "shop", "apples"]))],
  [/sleep|\bbed\b|\bnap\b|di ngu|ngu trua/i, (k) => (bedtimeFor(k) ? "sleep" : "bednap")],
];
// how mama & papa actually talk: no accents needed (yeu = yêu), stretched words (hiiii, muahhh), slang and emoji
function norm(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
    .replace(/([a-z])\1{2,}/g, "$1$1").replace(/\s+/g, " ").trim();
}
const SAYS = {
  love: /\b(i+ ?l+o+v+e+ ?(you+|u+)|l+o+v+e+|l+u+v+|w+u+v+|l+u+b+|i+u+|y+e+u+|thuong|ily(sm)?|143|ilu)\b|❤|♥|💕|💗|💖|🥰|😍|<3/,
  kiss: /\b(k+i+s+(s+e*s*)?|kiss(ies|y|es)|m+u+a+h*|m+w+a+h+|smooch|xoxo|thom|hun (ma|cai)|chut chut)\b|😘|💋|😚|😙/,
  hug: /\b(h+u+g+s*|cuddles?|snuggles?|om (con|ma|em|nao)|om)\b|🤗|🫂/,
  miss: /\b(miss(ed)? (you+|u+|ya)|nho (con|em|qua|lam)?)\b/,
  hi: /^(h+a+i+|h+i+|h+e+y+|h+e+l+o+|h+e+l+l+o+|h+e+l+u+|hiya|yo+|sup|wassup|chao|xin chao|ola|hallo)\b|\b(h+a+i+|h+i+|h+e+y+|h+e+l+l+o+|chao) (mivi|vimi|teddy|baby|con|em|cutie|bub)/,
  morning: /\b(good ?morning|g+m+|morning|chao buoi sang|buoi sang)\b|☀/,
  night: /\b(good ?night|g+n+|nini|night night|nighty|ngu ngon|di ngu|ngu di|sweet dreams)\b|🌙|😴/,
  bye: /\b(bye+|b+y+e+ b+y+e+|bai|tam biet|see (you|u|ya)|cya|ttyl|gotta go|di day)\b|👋/,
  praise: /\b(good girl|well done|proud|clever|smart|gioi|ngoan|amazing|cute+|cutie|adorable|de thuong|xinh|beautiful|pretty|precious|bestest|the best)\b/,
  sorry: /\b(sorry|soz|xin loi|my bad)\b/,
  eaten: /\b(an com chua|an chua|an gi chua|have you eaten|did you eat|hungry\?)/,
  how: /\b(how are (you|u)|how r (you|u)|hru|you okay|u ok|(are )?you good|feel(ing)?|co sao khong|khoe khong)\b/,
};
// what you meant, worked out without doing anything yet
function intentOf(t, k) {
  if (SAYS.kiss.test(t)) return "kiss";
  if (SAYS.hug.test(t)) return "hug";
  if (SAYS.miss.test(t)) return "miss";
  if (SAYS.night.test(t)) return "night";
  if (SAYS.bye.test(t)) return "bye";
  if (SAYS.morning.test(t)) return "morning";
  if (SAYS.eaten.test(t)) return "eaten";
  if (SAYS.love.test(t)) return "love";
  if (SAYS.praise.test(t)) return "praise";
  if (SAYS.sorry.test(t)) return "sorry";
  if (SAYS.how.test(t)) return "how";
  if (/what.*(doing|up to)|wyd|lam gi/.test(t)) return "doing";
  if (/dream|want to do|wish for/.test(t)) return "dream";
  if (/remember|what happened|your day|today/.test(t)) return "remember";
  if (/\b(come|here|over here|lai day|qua day|come here)\b/.test(t)) return "come";
  if (/\b(dance|party)\b/.test(t)) return "party";
  const other = KIDS.find((o) => o !== k && t.includes(o.name));
  if (other && /play|with|choi/.test(t)) return "with:" + other.id;
  if (/\b(lets? play|play with me|choi (di|voi)|wanna play)\b/.test(t)) return "play";
  if (SAYS.hi.test(t)) return "hi";
  const hit = ASK_ACTS.find(([re]) => re.test(t));
  if (hit) return "act:" + (typeof hit[1] === "function" ? hit[1](k) : hit[1]);
  return null;
}
const MEANS = { love: "i love you", kiss: "kisses", hug: "a hug", hi: "hello", bye: "bye bye", night: "goodnight", miss: "i miss you", praise: "good girl", eaten: "have you eaten?",
  how: "how are you?", sorry: "sorry", morning: "good morning", play: "let's play", doing: "what are you doing?", come: "come here", party: "dance party", dream: "what's your dream?", remember: "what did you do today?" };
const meaning = (it) => MEANS[it] || (it.startsWith("act:") ? ACT_INFO[it.slice(4)]?.say[0] || it.slice(4) : it.startsWith("with:") ? `play with ${KIDS.find((o) => o.id === it.slice(5))?.name}` : it);
const TEACH_CHIPS = ["love", "kiss", "hug", "hi", "bye", "night", "miss", "praise", "eaten", "how", "sorry", "play"];
const CHIP_FACE = { love: "❤️", kiss: "😘", hug: "🤗", hi: "👋", bye: "👋", night: "🌙", miss: "🥺", praise: "🌟", eaten: "🍚", how: "💭", sorry: "🙏", play: "🎈" };

// words you've taught them (all three learn them, and they keep them)
let WORDS = {};
try { WORDS = JSON.parse(store.get("words") || "{}") || {}; } catch {}
function learnedIntent(t) {
  const key = Object.keys(WORDS).sort((a, b) => b.length - a.length).find((w) => t === w || ` ${t} `.includes(` ${w} `));
  return key ? WORDS[key] : null;
}
function teach(k, phrase, intent) {
  phrase = norm(phrase || "").slice(0, 40);
  if (!phrase || !intent) return;
  WORDS[phrase] = intent; store.set("words", JSON.stringify(WORDS));
  k.teach = null;
  hearts(k, 6); k.hop = 1; feel(k, null, { proud: 0.3, happy: 0.2 });
  KIDS.forEach((o) => remember(o, o === k ? `mama taught me “${phrase}” means ${meaning(intent)}` : `${k.name} told me “${phrase}” means ${meaning(intent)}`));
  const line = k.id === "rose" ? `ohh! “${phrase}” means ${meaning(intent)} ♡ thank you for teaching me!` : k.id === "teddy" ? `“${phrase}”… means ${meaning(intent)}… teddy remembers ♡` : `OHHH “${phrase}” = ${meaning(intent)}!! i'll tell my sisters!! 💨`;
  say(k, line, 2600); logTalk(k, k.name, line);
  later(() => respond(k, intent), 2700);
}

function hear(k, text) {
  const t = norm(text);
  logTalk(k, "you", text);
  up(k, "love", 6);
  if (k.asleep) { const r = pick(["zzz… mama…", "*snore* ♡", "mmm… love you…"]); say(k, r, 2600); logTalk(k, k.name, r); return; }
  // "forget bubu", or teaching outright: "bubu means i love you"
  const f = t.match(/^forget (.+)$/);
  if (f && WORDS[f[1]]) { delete WORDS[f[1]]; store.set("words", JSON.stringify(WORDS)); const r = `okay, i forgot “${f[1]}” ♡`; say(k, r, 2200); logTalk(k, k.name, r); return; }
  const m = t.match(/^(.+?) (means|= ?|is like|nghia la) (.+)$/);
  if (m) { const it = learnedIntent(m[3]) || intentOf(m[3], k); if (it) return teach(k, m[1], it); }
  const intent = learnedIntent(t) || intentOf(t, k);
  if (intent) {
    // she asked what something meant a moment ago, and you just said it another way
    if (k.teach && Date.now() - k.teachT < 120e3) return teach(k, k.teach, intent);
    k.teach = null;
    return respond(k, intent, t);
  }
  // she doesn't understand: she asks, and you can teach her
  k.teach = t; k.teachT = Date.now();
  const w = clip(text, 24);
  const r = k.id === "rose" ? `what does “${w}” mean, mama? 🤔` : k.id === "teddy" ? `*tilts head*… “${w}”? 🥺` : `“${w}”?? what's that papa? 🤔`;
  say(k, r, 3200); logTalk(k, k.name, r);
}
function respond(k, intent) {
  const reply = (r, ms = 2800) => { say(k, r, ms); logTalk(k, k.name, r); };
  const love = (v, mem) => { feel(k, null, { happy: 0.3, lonely: -0.5 }); up(k, "love", v); hearts(k, 10); k.hop = 1; if (mem) remember(k, mem); };
  switch (intent) {
    case "kiss":
      love(25, "mama gave me kissies 😘"); achieve(k, "pat"); particle("heart", k.x, k.y - 34, "#ff7fa8", 6, 10, -24, k.area);
      return reply(k.id === "rose" ? pick(["*muah* thank you mama ♡ 😘", "kissies back! muah muah ♡", "*blushes* i love kissies ♡"]) : k.id === "teddy" ? pick(["*blushes*… muah ♡", "*hides face* 🙈 …hehe muah", "teddy kiss mama too… muah ♡"]) : pick(["MUAH MUAH MUAH 😘💨", "kissies attack!! 😘😘😘", "*smooch* hehe gotcha!"]));
    case "hug":
      love(25, "mama gave me a big hug 🤗");
      return reply(k.id === "rose" ? "*hugs you tight* thank you mama ♡" : k.id === "teddy" ? pick(["*squeezes* don't let go mama 🥺♡", "ôm ôm ♡ teddy loves hugs"]) : "BIG BEAR HUG!! 🤗💨");
    case "miss": love(20); return reply(k.id === "teddy" ? "teddy missed you sooo much… con nhớ mẹ nhiều lắm 🥺♡" : k.id === "rose" ? "i missed you too mama, thank you for coming back ♡" : "I MISSED YOU MORE!! 💨💕");
    case "night":
      if (bedtimeFor(k) || hourNow() >= 20) { k.upLate = 0; interrupt(k, "sleep", { quick: true }); return reply(pick(GOODNIGHT)); }
      return reply(k.id === "blossom" ? "but it's not night time yet hehe 🌞" : "night night? but the sun is still up… ☀️");
    case "bye": hearts(k, 4); return reply(k.id === "teddy" ? "bye bye mama… come back soon? 🥺👋" : k.id === "rose" ? "bye bye mama, thank you for visiting ♡ 👋" : "byeee!! come back soon!! 👋💨");
    case "morning": hearts(k, 4); return reply(pick(MORNING));
    case "eaten": return reply(k.needs.hunger > 70 ? (k.id === "rose" ? "yes mama, i ate already, thank you ♡" : k.id === "teddy" ? "teddy ate… *pats tummy* ♡" : "YES i ate SO much!!") : "not yet… i'm a bit hungry 🥺");
    case "love": love(25, "mama said she loves me ♡"); achieve(k, "pat"); return reply(pick(LOVE_BACK[k.id]));
    case "praise": up(k, "love", 15); hearts(k, 6); k.hop = 1; remember(k, "mama said i'm a good girl"); return reply(k.id === "rose" ? "thank you mama, that makes me so happy ♡" : k.id === "teddy" ? "*blushes* …hehe ♡" : "i KNOW hehe 😎💕");
    case "sorry": return reply(k.id === "teddy" ? "it's okay mama… *hug* ♡" : "it's okay! i still love you ♡");
    case "how": { const n = k.needs; return reply(n.hunger < 35 ? "i'm a little bit hungry…" : n.energy < 30 ? "*yawn* a bit sleepy…" : n.love < 40 ? "i missed you mama…" : n.clean < 30 ? "i'm all grubby hehe" : k.id === "rose" ? "i'm wonderful, thank you for asking ♡" : k.id === "teddy" ? "teddy is happy now mama's here ♡" : "SUPER GOOD!! 💨"); }
    case "doing": return reply(`i'm ${k.label.replace(/\bher\b/g, "my")}!`);
    case "dream": return reply(k.mind.goal ? `today i want to ${k.mind.goal.text}!` : "i already did my dream today ✨");
    case "remember": return reply(k.mind.memories[0] ? `${k.mind.memories[0].text}!` : "nothing yet… stay and play with me?");
    case "come": { const [x, y] = tileOf(...viewCenter()); tapWorld({ x: x * T + 8, y: y * T + 10 }); return; }
    case "party": danceParty(viewCenter()); return reply(pick(SAY_OK[k.id]));
    case "hi": hearts(k, 4); return reply(k.id === "rose" ? "hello mama! thank you for visiting ♡" : k.id === "teddy" ? "*waves shyly* …hi mama ♡" : "HI PAPA!! 👋💨");
    case "play": {
      const fav = Object.entries(k.mind.likes).filter(([id]) => ACT_INFO[id] && !ACT_INFO[id].with && ACTS[id] && ACTS[id].w(k) > 0).sort((a, b) => b[1] - a[1])[0];
      if (!fav) return reply("hmm… what should we play? 🤔");
      interrupt(k, fav[0]);
      return reply(`yay! let's ${ACT_INFO[fav[0]].say[0]}! 🎈`);
    }
  }
  if (intent.startsWith("with:")) {
    const other = KIDS.find((o) => o.id === intent.slice(5));
    if (!other || other.area !== k.area || other.asleep) return reply(`${other?.name || "she"} is ${other?.asleep ? "sleeping" : "somewhere else"} right now…`);
    endStep(other); snapOff(other); other.act = "idle"; other.steps = []; // free her up to be asked
    interrupt(k, other.id === "teddy" && k.id === "rose" ? "chat" : pick(["chat", "tag", "seesaw"].filter((a) => ACTS[a].w(k) > 0)) || "chat");
    return reply(`okay! ${other.name}, come play! 💕`);
  }
  if (intent.startsWith("act:")) {
    const act = intent.slice(4);
    if (!ACTS[act] || ACTS[act].w(k) <= 0) return reply(isNight() ? "but it's night time, mama… 🌙" : raining() && ACTS[act]?.area === ISL ? "but it's raining… 🌧️" : "i can't right now… maybe later? ♡");
    k.mind.likes[act] = (k.mind.likes[act] ?? 0) + 0.05; // she likes doing what mama suggests
    // free will: vimi might finish what she's doing first
    if (k.id === "blossom" && likeOf(k, k.act) > 0.6 && Math.random() < 0.35) { reply(pick(SAY_LATER.blossom)); later(() => { if (!k.held) interrupt(k, act); }, 4000); return; }
    interrupt(k, act);
    return reply(`${pick(SAY_OK[k.id])} ${act === "myplot" ? "to my garden 🌱" : ""}`.trim());
  }
}
function logTalk(k, who, text) { (k.talkLog = k.talkLog || []).push({ who, text: clip(text, 120) }); k.talkLog = k.talkLog.slice(-4); if (k === selected) renderCard(); }

// ---------- conversations between the sisters ----------
function dialogue(k, p) {
  const t = [], name = (x) => x.name;
  const km = k.mind.memories.find((m) => !m.text.includes(p.name));
  if (km) t.push([[k, `${name(p)}! guess what… ${km.text}`], [p, pick(["wow!! 😮", "no way!", "so cool!", "tell me everything!"])], [k, "hehe ♡"]]);
  if (k.needs.hunger < 55) t.push([[k, "i'm hungry…"], [p, pick(["let's get ice cream! 🍦", "the fridge is always full!", "picnic?? 🧺"])], [k, "yes please!"]]);
  const ted = k.id === "teddy" ? k : p.id === "teddy" ? p : null, big = ted === k ? p : k;
  if (ted && ted.needs.love < 75) t.push([[ted, "i miss mama…"], [big, big.id === "rose" ? "she'll come soon, teddy ♡ i'll stay with you" : "mama loves you sooo much!"], [ted, "…okay ♡"]]);
  const kc = plotOf(k).tiles.find((x) => x.crop), pc = plotOf(p).tiles.find((x) => x.crop);
  if (kc && pc) t.push([[k, `my ${CROPS[kc.crop].name} are growing ${CROPS[kc.crop].emoji}`], [p, `mine are ${CROPS[pc.crop].name} ${CROPS[pc.crop].emoji}!`], [k, pick(["let's swap some later!", "ours are the best gardens ♡"])]]);
  if (k.mind.goal) t.push([[k, `today i want to ${k.mind.goal.text}`], [p, pick(["i'll help you!", "you can do it! 💪", "ooh can i come?"])]]);
  const viv = k.id === "blossom" ? k : p.id === "blossom" ? p : null, mi = k.id === "rose" ? k : p.id === "rose" ? p : null;
  if (viv && mi) t.push([[viv, "race you to the beach!! 💨"], [mi, "okay, but no pushing please ♡"], [viv, "hehe deal!"]]);
  if (viv && ted) t.push([[viv, "teddy! wanna go on the slide??"], [ted, "…is it high?"], [viv, "i'll hold your hand!"], [ted, "okay ♡"]]);
  t.push([[k, pick(CHAT)], [p, pick(CHAT)]]);
  return pick(t).map(([w, s]) => [w, s]);
}
// ---------- their diary ----------
const DIARY_VOICE = {
  rose: (list) => `dear diary ♡ ${list}. thank you for reading, love mivi 👑`,
  blossom: (list) => `DIARY!! ${list}!! tomorrow i'm gonna do even MORE 💨 — vimi`,
  teddy: (list) => `teddy's diary… ${list}. teddy misses mama and papa nhiều lắm ♡ — teddy 🧸`,
};
function diaryFor(k, since) {
  const seen = new Set(), raw = k.mind.memories.filter((m) => m.t > since).reverse().filter((m) => !seen.has(m.text) && seen.add(m.text)).map((m) => m.text);
  // "i grew roses, i grew tulips" → "i grew roses and tulips"
  const and = (a) => (a.length === 1 ? a[0] : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
  const items = [];
  raw.forEach((t) => { const m = t.match(/^i (grew|planted) (.*)$/); const prev = m && items.find((x) => x.verb === m[1]); if (prev) prev.things.push(m[2]); else items.push(m ? { verb: m[1], things: [m[2]] } : { text: t }); });
  const lines = items.map((x) => x.text || `i ${x.verb} ${and(x.things)}`).slice(-6);
  if (!lines.length) return null;
  const items2 = lines;
  const list = and(items2);
  return DIARY_VOICE[k.id](list);
}
function openDiary(away) {
  const since = away ? Number(store.get("seen") || 0) : Date.now() - 24 * 3600e3;
  const pages = KIDS.map((k) => ({ k, text: diaryFor(k, since) })).filter((p) => p.text);
  if (away && !pages.length) return;
  $("#diaryTitle").textContent = away ? "while you were away… 📔" : "their diary 📔";
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  $("#diaryBody").innerHTML = pages.length ? pages.map(({ k, text }) => `<div class="page"><canvas width="${GW}" height="${GH}" data-kid="${k.id}"></canvas><p>${esc(text)}</p></div>`).join("") : "<p class='empty'>nothing written yet today… come back later ♡</p>";
  $$("#diaryBody canvas").forEach((c) => c.getContext("2d").drawImage(KIDS.find((k) => k.id === c.dataset.kid).spr.front[0], 0, 0));
  $("#diary").hidden = false;
}
const AWAY = { swing: "i played on the swings", slide: "i went down the slide a hundred times", flowers: "i picked pretty flowers", tag: "we played tag", kite: "i flew my kite", fishing: "i went fishing", puddles: "i jumped in puddles",
  teaparty: "we had a tea party", dressup: "i dressed up like a princess", piano: "i played the piano", read: "i read a storybook", tv: "i watched cartoons", toys: "i played with my toys", icecream: "i had ice cream",
  sandbox: "i built a sandcastle", beach: "i paddled in the sea", kitty: "i petted kitty", draw: "i drew a picture", cook: "i made pancakes", tagalong: "i followed my sisters everywhere", missmama: "i waited for mama at the window",
  myplot: "i looked after my garden", explore: "i went exploring", picnic: "i had a picnic", butterfly: "i chased butterflies", hide: "we played hide and seek", seesaw: "i played on the seesaw" };
function awayMemories(k, s) {
  const favs = Object.entries(k.mind.likes).filter(([id]) => AWAY[id]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
  const n = clamp(Math.floor(s / 1200), 1, 3);
  for (let i = 0; i < n; i++) { const id = pick(favs); if (id) { const m = { t: Date.now() - rand(0.2, 0.9) * s * 1000, text: AWAY[id] }; k.mind.memories.splice(1, 0, m); } }
  const sis = pick(others(k)); if (Math.random() < 0.6) k.mind.memories.splice(1, 0, { t: Date.now() - rand(0.1, 0.8) * s * 1000, text: `${sis.name} and i had the best time` });
  k.mind.memories.sort((a, b) => b.t - a.t); k.mind.memories.length = Math.min(k.mind.memories.length, 30);
}

// ---------- the pop-out window: a little island that stays on top while you do other things ----------
async function popOut() {
  if (pipWin) { pipWin.close(); return; }
  if (!window.documentPictureInPicture) { toast("this browser can't pop out a little window yet (try chrome on a computer) 🪟", 3600); return; }
  const w = await documentPictureInPicture.requestWindow({ width: 440, height: 420 });
  [...document.styleSheets].forEach((ss) => {
    try { const st = w.document.createElement("style"); st.textContent = [...ss.cssRules].map((r) => r.cssText).join("\n"); w.document.head.appendChild(st); }
    catch { if (ss.href) { const l = w.document.createElement("link"); l.rel = "stylesheet"; l.href = ss.href; w.document.head.appendChild(l); } }
  });
  w.document.title = "our little island ♡";
  w.document.body.classList.add("pip");
  const win = document.querySelector(".win"), home = win.parentNode, next = win.nextSibling;
  pipWin = w;
  w.document.body.appendChild(win);
  document.body.classList.add("popped");
  w.addEventListener("resize", fit);
  w.addEventListener("pagehide", () => { home.insertBefore(win, next); pipWin = null; document.body.classList.remove("popped"); fit(); schedule(); });
  fit(); schedule();
}

let last = performance.now(), frameN = 0, loopToken = 0, slowT = 0, clockT = 0;
// each frame is scheduled on the window you're looking at (the pop-out keeps going when the main tab is hidden)
function schedule() { const tok = ++loopToken; (pipWin || window).requestAnimationFrame(() => { if (tok === loopToken) frame(); }); }
function frame() {
  const now = performance.now(), dt = Math.min(now - last, 100) / 1000;
  last = now;
  updateWorld(dt);
  KIDS.forEach((k) => updateKid(k, dt));
  separate(dt);
  updateCamera(dt);
  draw();
  placeOverlays();
  frameN = (frameN + 1) % 3600;
  if (frameN % 3 === 0) drawMini();
  if ((slowT += dt) > 0.5) { slowT = 0; renderChips(); if ((clockT += 0.5) >= 10) { clockT = 0; tickClock(); tintBackdrop(); } }
  schedule();
}
schedule();

// buttons for talking, the diary and the pop-out
$("#talk").addEventListener("submit", (e) => { e.preventDefault(); const i = $("#talkIn"), t = i.value.trim(); if (!t || !selected) return; audio(); sfx.pop(); i.value = ""; hear(selected, t); });
$("#talk").addEventListener("pointerdown", (e) => e.stopPropagation());
$("#teach").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mean]"), k = selected;
  if (!b || !k || !k.teach) return;
  audio(); sfx.pop();
  if (b.dataset.mean) teach(k, k.teach, b.dataset.mean);
  else { k.teach = null; renderCard(); }
});
$("#diaryBtn").addEventListener("click", () => { audio(); sfx.pop(); openDiary(false); });
$("#diaryX").addEventListener("click", () => { audio(); sfx.pop(); $("#diary").hidden = true; });
$("#popBtn").addEventListener("click", () => { audio(); sfx.pop(); popOut(); });
if (!window.documentPictureInPicture) $("#popBtn").hidden = true;
// coming back after a while: they wrote about their day
later(() => { const seen = Number(store.get("seen") || 0); if (seen && Date.now() - seen > 1800e3) openDiary(true); store.set("seen", String(Date.now())); }, 1200);
