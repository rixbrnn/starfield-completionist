// Minimal SWF reader: vector shapes and sprites to SVG, enough for the game's interface icons
// (interface/factions.swf). Handles DefineShape 1-4 with solid and gradient fills, line styles,
// and sprites placed with PlaceObject2 (matrix + color transform). Bitmaps and masks are skipped.

import { inflateSync } from "node:zlib";

// ---------------------------------------------------------------- bit reader

class Reader {
  pos = 0;
  private bit = 0;
  readonly buf: Buffer;
  constructor(buf: Buffer) {
    this.buf = buf;
  }
  align() {
    if (this.bit) { this.bit = 0; this.pos++; }
  }
  u8() { this.align(); return this.buf[this.pos++]; }
  u16() { this.align(); const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
  u32() { this.align(); const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  fixed8() { this.align(); const v = this.buf.readInt16LE(this.pos) / 256; this.pos += 2; return v; }
  ub(n: number) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v = (v << 1) | ((this.buf[this.pos] >> (7 - this.bit)) & 1);
      if (++this.bit === 8) { this.bit = 0; this.pos++; }
    }
    return v >>> 0;
  }
  sb(n: number) {
    if (n === 0) return 0;
    const v = this.ub(n);
    return v & (1 << (n - 1)) ? v - 2 ** n : v;
  }
  fb(n: number) { return this.sb(n) / 65536; }
  str() { this.align(); const end = this.buf.indexOf(0, this.pos); const s = this.buf.toString("utf8", this.pos, end); this.pos = end + 1; return s; }
}

// ---------------------------------------------------------------- records

export interface Rect { xMin: number; xMax: number; yMin: number; yMax: number }
export interface Matrix { a: number; b: number; c: number; d: number; tx: number; ty: number }
export interface ColorTransform { rm: number; gm: number; bm: number; am: number; ra: number; ga: number; ba: number; aa: number }
type Color = [number, number, number, number]; // r, g, b, a (0-255)

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const NO_CX: ColorTransform = { rm: 1, gm: 1, bm: 1, am: 1, ra: 0, ga: 0, ba: 0, aa: 0 };

function rect(r: Reader): Rect {
  r.align();
  const n = r.ub(5);
  const out = { xMin: r.sb(n), xMax: r.sb(n), yMin: r.sb(n), yMax: r.sb(n) };
  r.align();
  return out;
}
function matrix(r: Reader): Matrix {
  r.align();
  const m = { ...IDENTITY };
  if (r.ub(1)) { const n = r.ub(5); m.a = r.fb(n); m.d = r.fb(n); }
  if (r.ub(1)) { const n = r.ub(5); m.b = r.fb(n); m.c = r.fb(n); }
  const n = r.ub(5);
  m.tx = r.sb(n);
  m.ty = r.sb(n);
  r.align();
  return m;
}
function cxform(r: Reader, withAlpha: boolean): ColorTransform {
  r.align();
  const hasAdd = r.ub(1), hasMult = r.ub(1), n = r.ub(4);
  const cx = { ...NO_CX };
  if (hasMult) { cx.rm = r.sb(n) / 256; cx.gm = r.sb(n) / 256; cx.bm = r.sb(n) / 256; if (withAlpha) cx.am = r.sb(n) / 256; }
  if (hasAdd) { cx.ra = r.sb(n); cx.ga = r.sb(n); cx.ba = r.sb(n); if (withAlpha) cx.aa = r.sb(n); }
  r.align();
  return cx;
}
function rgb(r: Reader, alpha: boolean): Color {
  return [r.u8(), r.u8(), r.u8(), alpha ? r.u8() : 255];
}

interface Gradient { kind: "linear" | "radial"; matrix: Matrix; stops: Array<{ ratio: number; color: Color }> }
type Fill = { kind: "solid"; color: Color } | Gradient | { kind: "none" };
interface Line { width: number; color: Color }

function fillStyles(r: Reader, shapeVersion: number): Fill[] {
  let count = r.u8();
  if (count === 0xff && shapeVersion >= 2) count = r.u16();
  const fills: Fill[] = [];
  for (let i = 0; i < count; i++) fills.push(fillStyle(r, shapeVersion));
  return fills;
}
function fillStyle(r: Reader, shapeVersion: number): Fill {
  const type = r.u8();
  const alpha = shapeVersion >= 3;
  if (type === 0x00) return { kind: "solid", color: rgb(r, alpha) };
  if (type === 0x10 || type === 0x12 || type === 0x13) {
    const m = matrix(r);
    r.align();
    r.ub(2); r.ub(2); // spread, interpolation modes
    const n = r.ub(4);
    const stops = [];
    for (let i = 0; i < n; i++) stops.push({ ratio: r.u8(), color: rgb(r, alpha) });
    if (type === 0x13) r.fixed8(); // focal point (drawn as a plain radial gradient)
    return { kind: type === 0x10 ? "linear" : "radial", matrix: m, stops };
  }
  if (type >= 0x40 && type <= 0x43) { r.u16(); matrix(r); return { kind: "none" }; } // bitmap fill: not supported
  throw new Error("unknown fill style type 0x" + type.toString(16));
}
function lineStyles(r: Reader, shapeVersion: number): Line[] {
  let count = r.u8();
  if (count === 0xff) count = r.u16();
  const lines: Line[] = [];
  for (let i = 0; i < count; i++) {
    const width = r.u16();
    if (shapeVersion < 4) { lines.push({ width, color: rgb(r, shapeVersion >= 3) }); continue; }
    r.ub(2); const join = r.ub(2); const hasFill = r.ub(1); r.ub(1); r.ub(1); r.ub(1); r.ub(5); r.ub(1); r.ub(2);
    if (join === 2) r.u16();
    if (hasFill) { const f = fillStyle(r, shapeVersion); lines.push({ width, color: f.kind === "solid" ? f.color : [255, 255, 255, 255] }); }
    else lines.push({ width, color: rgb(r, true) });
  }
  return lines;
}

// An edge in twips; c is the quadratic control point of a curve.
interface Edge { x0: number; y0: number; x1: number; y1: number; cx?: number; cy?: number }
export interface Shape { id: number; bounds: Rect; fills: Array<{ fill: Fill; edges: Edge[] }>; lines: Array<{ line: Line; edges: Edge[] }> }

function shape(body: Buffer, version: number): Shape {
  const r = new Reader(body);
  const id = r.u16();
  const bounds = rect(r);
  if (version === 4) { rect(r); r.u8(); } // edge bounds, flags
  let fills = fillStyles(r, version);
  let lines = lineStyles(r, version);
  const out: Shape = { id, bounds, fills: [], lines: [] };
  // Each style set gets its own slots in out.fills / out.lines.
  let fillBase = out.fills.length;
  let lineBase = out.lines.length;
  const addStyles = () => {
    fillBase = out.fills.length;
    lineBase = out.lines.length;
    for (const fill of fills) out.fills.push({ fill, edges: [] });
    for (const line of lines) out.lines.push({ line, edges: [] });
  };
  addStyles();

  r.align();
  let fillBits = r.ub(4), lineBits = r.ub(4);
  let x = 0, y = 0, fill0 = 0, fill1 = 0, line = 0;
  const add = (e: Edge) => {
    if (fill1) out.fills[fillBase + fill1 - 1].edges.push(e);
    if (fill0) out.fills[fillBase + fill0 - 1].edges.push(e.cx === undefined ? { x0: e.x1, y0: e.y1, x1: e.x0, y1: e.y0 } : { x0: e.x1, y0: e.y1, x1: e.x0, y1: e.y0, cx: e.cx, cy: e.cy });
    if (line) out.lines[lineBase + line - 1].edges.push(e);
  };
  for (;;) {
    if (r.ub(1) === 0) {
      const flags = r.ub(5);
      if (flags === 0) break;
      if (flags & 1) { const n = r.ub(5); x = r.sb(n); y = r.sb(n); }
      if (flags & 2) fill0 = r.ub(fillBits);
      if (flags & 4) fill1 = r.ub(fillBits);
      if (flags & 8) line = r.ub(lineBits);
      if (flags & 16) {
        fills = fillStyles(r, version);
        lines = lineStyles(r, version);
        addStyles();
        r.align();
        fillBits = r.ub(4);
        lineBits = r.ub(4);
      }
    } else if (r.ub(1)) {
      const n = r.ub(4) + 2;
      let dx = 0, dy = 0;
      if (r.ub(1)) { dx = r.sb(n); dy = r.sb(n); } else if (r.ub(1)) dy = r.sb(n); else dx = r.sb(n);
      add({ x0: x, y0: y, x1: x + dx, y1: y + dy });
      x += dx; y += dy;
    } else {
      const n = r.ub(4) + 2;
      const cx = x + r.sb(n), cy = y + r.sb(n);
      const ax = cx + r.sb(n), ay = cy + r.sb(n);
      add({ x0: x, y0: y, x1: ax, y1: ay, cx, cy });
      x = ax; y = ay;
    }
  }
  return out;
}

export interface Placement { depth: number; id: number; matrix: Matrix; cx: ColorTransform; clip: boolean }
export interface Sprite { id: number; placements: Placement[] }

function sprite(body: Buffer, version: number): Sprite {
  const id = body.readUInt16LE(0);
  const placed = new Map<number, Placement>();
  // First frame only: icons are static.
  for (const tag of tags(body.subarray(4))) {
    if (tag.type === 1) break;
    if (tag.type === 26 || tag.type === 70) {
      const r = new Reader(tag.body);
      const flags = r.u8();
      if (tag.type === 70) r.u8();
      const depth = r.u16();
      const prev = placed.get(depth);
      const p: Placement = prev ? { ...prev } : { depth, id: 0, matrix: IDENTITY, cx: NO_CX, clip: false };
      if (flags & 0x02) p.id = r.u16();
      if (flags & 0x04) p.matrix = matrix(r);
      if (flags & 0x08) p.cx = cxform(r, true);
      if (flags & 0x10) r.u16();
      if (flags & 0x20) r.str();
      if (flags & 0x40) { r.u16(); p.clip = true; }
      placed.set(depth, p);
    } else if (tag.type === 28) {
      placed.delete(tag.body.readUInt16LE(0));
    }
  }
  void version;
  return { id, placements: [...placed.values()].sort((a, b) => a.depth - b.depth) };
}

function* tags(buf: Buffer) {
  let pos = 0;
  while (pos + 2 <= buf.length) {
    const code = buf.readUInt16LE(pos);
    pos += 2;
    let len = code & 0x3f;
    if (len === 0x3f) { len = buf.readInt32LE(pos); pos += 4; }
    const type = code >> 6;
    yield { type, body: buf.subarray(pos, pos + len) };
    pos += len;
    if (type === 0) return;
  }
}

// ---------------------------------------------------------------- file

export interface SwfFile { shapes: Map<number, Shape>; sprites: Map<number, Sprite>; symbols: Map<string, number> }

export function readSwf(data: Buffer): SwfFile {
  const sig = data.toString("latin1", 0, 3);
  if (sig === "CWS") data = Buffer.concat([data.subarray(0, 8), inflateSync(data.subarray(8))]);
  else if (sig !== "FWS") throw new Error("not an uncompressed or zlib SWF: " + sig);
  const header = new Reader(data);
  header.pos = 8;
  rect(header);
  header.u16(); header.u16();
  const file: SwfFile = { shapes: new Map(), sprites: new Map(), symbols: new Map() };
  const versions: Record<number, number> = { 2: 1, 22: 2, 32: 3, 83: 4 };
  for (const tag of tags(data.subarray(header.pos))) {
    if (tag.type in versions) {
      const s = shape(tag.body, versions[tag.type]);
      file.shapes.set(s.id, s);
    } else if (tag.type === 39) {
      const s = sprite(tag.body, data[3]);
      file.sprites.set(s.id, s);
    } else if (tag.type === 76 || tag.type === 56) {
      const r = new Reader(tag.body);
      const n = r.u16();
      for (let i = 0; i < n; i++) { const id = r.u16(); file.symbols.set(r.str(), id); }
    }
  }
  return file;
}

// ---------------------------------------------------------------- SVG

const multiply = (m: Matrix, n: Matrix): Matrix => ({
  a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
  tx: m.a * n.tx + m.c * n.ty + m.tx, ty: m.b * n.tx + m.d * n.ty + m.ty,
});
const combineCx = (outer: ColorTransform, inner: ColorTransform): ColorTransform => ({
  rm: outer.rm * inner.rm, gm: outer.gm * inner.gm, bm: outer.bm * inner.bm, am: outer.am * inner.am,
  ra: outer.rm * inner.ra + outer.ra, ga: outer.gm * inner.ga + outer.ga, ba: outer.bm * inner.ba + outer.ba, aa: outer.am * inner.aa + outer.aa,
});
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
function color(c: Color, cx: ColorTransform): { hex: string; opacity: number } {
  const r = clamp(c[0] * cx.rm + cx.ra), g = clamp(c[1] * cx.gm + cx.ga), b = clamp(c[2] * cx.bm + cx.ba), a = clamp(c[3] * cx.am + cx.aa);
  return { hex: "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""), opacity: a / 255 };
}
const num = (v: number) => String(Math.round(v * 100) / 100);
const tw = (v: number) => num(v / 20);

// Joins a fill's edges into closed loops (fill0 edges were already reversed when read).
function pathData(edges: Edge[]): string {
  const key = (x: number, y: number) => x + "," + y;
  const byStart = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = key(e.x0, e.y0);
    if (!byStart.has(k)) byStart.set(k, []);
    byStart.get(k)!.push(e);
  }
  const used = new Set<Edge>();
  let d = "";
  for (const first of edges) {
    if (used.has(first)) continue;
    d += "M" + tw(first.x0) + " " + tw(first.y0);
    let e: Edge | undefined = first;
    while (e && !used.has(e)) {
      used.add(e);
      d += e.cx === undefined ? "L" + tw(e.x1) + " " + tw(e.y1) : "Q" + tw(e.cx) + " " + tw(e.cy!) + " " + tw(e.x1) + " " + tw(e.y1);
      e = (byStart.get(key(e.x1, e.y1)) ?? []).find((n) => !used.has(n));
    }
    d += "Z";
  }
  return d;
}
function strokeData(edges: Edge[]): string {
  return edges.map((e) => "M" + tw(e.x0) + " " + tw(e.y0) + (e.cx === undefined ? "L" + tw(e.x1) + " " + tw(e.y1) : "Q" + tw(e.cx) + " " + tw(e.cy!) + " " + tw(e.x1) + " " + tw(e.y1))).join("");
}

/** Renders a symbol (sprite or shape id) to a standalone SVG sized to its bounds. */
export function symbolToSvg(file: SwfFile, id: number, idPrefix = "g"): string {
  const defs: string[] = [];
  const body: string[] = [];
  const box = { xMin: Infinity, yMin: Infinity, xMax: -Infinity, yMax: -Infinity };
  let gradients = 0;

  const paint = (fill: Fill, cx: ColorTransform): string => {
    if (fill.kind === "solid") {
      const c = color(fill.color, cx);
      return `fill="${c.hex}"${c.opacity < 1 ? ` fill-opacity="${num(c.opacity)}"` : ""}`;
    }
    if (fill.kind === "none") return `fill="none"`;
    const gid = idPrefix + gradients++;
    const m = fill.matrix;
    const stops = fill.stops.map((s) => { const c = color(s.color, cx); return `<stop offset="${num(s.ratio / 255)}" stop-color="${c.hex}"${c.opacity < 1 ? ` stop-opacity="${num(c.opacity)}"` : ""}/>`; }).join("");
    const transform = `gradientTransform="matrix(${num(m.a)} ${num(m.b)} ${num(m.c)} ${num(m.d)} ${tw(m.tx)} ${tw(m.ty)})"`;
    defs.push(fill.kind === "linear"
      ? `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="-819.2" x2="819.2" y1="0" y2="0" ${transform}>${stops}</linearGradient>`
      : `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="819.2" ${transform}>${stops}</radialGradient>`);
    return `fill="url(#${gid})"`;
  };

  const draw = (charId: number, m: Matrix, cx: ColorTransform) => {
    const s = file.shapes.get(charId);
    if (s) {
      for (const [x, y] of [[s.bounds.xMin, s.bounds.yMin], [s.bounds.xMax, s.bounds.yMin], [s.bounds.xMin, s.bounds.yMax], [s.bounds.xMax, s.bounds.yMax]]) {
        const px = m.a * x + m.c * y + m.tx, py = m.b * x + m.d * y + m.ty;
        box.xMin = Math.min(box.xMin, px); box.xMax = Math.max(box.xMax, px);
        box.yMin = Math.min(box.yMin, py); box.yMax = Math.max(box.yMax, py);
      }
      const parts: string[] = [];
      for (const { fill, edges } of s.fills) if (edges.length) parts.push(`<path ${paint(fill, cx)} fill-rule="evenodd" d="${pathData(edges)}"/>`);
      for (const { line, edges } of s.lines) {
        if (!edges.length) continue;
        const c = color(line.color, cx);
        parts.push(`<path fill="none" stroke="${c.hex}"${c.opacity < 1 ? ` stroke-opacity="${num(c.opacity)}"` : ""} stroke-width="${tw(Math.max(line.width, 20))}" stroke-linecap="round" stroke-linejoin="round" d="${strokeData(edges)}"/>`);
      }
      body.push(`<g transform="matrix(${num(m.a)} ${num(m.b)} ${num(m.c)} ${num(m.d)} ${tw(m.tx)} ${tw(m.ty)})">${parts.join("")}</g>`);
      return;
    }
    const sp = file.sprites.get(charId);
    if (!sp) return;
    for (const p of sp.placements) {
      if (p.clip || !p.id) continue; // masks are not drawn
      draw(p.id, multiply(m, p.matrix), combineCx(cx, p.cx));
    }
  };
  draw(id, IDENTITY, NO_CX);
  // body transforms are in twips -> scale the whole drawing by 1/20 through tw() on translations
  // and keep a/b/c/d as-is; the viewBox uses pixel units.
  const vb = [box.xMin / 20, box.yMin / 20, (box.xMax - box.xMin) / 20, (box.yMax - box.yMin) / 20].map(num).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${body.join("")}</svg>`;
}
