// Co-op wire format. The relay (server/) passes binary frames through and
// only reads byte 0, the route: from the host the guest slot to send to
// (0 = every guest), from a guest the relay writes in the sender's slot.
// Byte 1 is the kind of message, then its body.
//
// Positions are quantised to 1/8 px and velocities to 1/8 px/s (int16),
// levels to bytes. JSON is used only for rare, structured things (the world,
// the ranch's numbers, player names and looks).

export const K_JSON = 1; // utf-8 JSON after the kind byte
export const K_SNAP = 2; // host -> guests: the world at a moment
export const K_DOG = 3; // guest -> host: my dog, and what it just did

export const MAX_DOGS = 4; // the host's dog and up to three guests'

export const SNAP_HZ = 15;
export const DOG_HZ = 20;
export const INTERP_MS = 100; // guests draw the world this far behind

const enc = new TextEncoder();
const dec = new TextDecoder();

// A growable byte buffer.
export class Writer {
  private buf = new ArrayBuffer(1024);
  private dv = new DataView(this.buf);
  n = 0;

  private room(k: number) {
    if (this.n + k <= this.buf.byteLength) return;
    let size = this.buf.byteLength * 2;
    while (size < this.n + k) size *= 2;
    const next = new ArrayBuffer(size);
    new Uint8Array(next).set(new Uint8Array(this.buf, 0, this.n));
    this.buf = next;
    this.dv = new DataView(next);
  }

  reset() {
    this.n = 0;
    return this;
  }

  u8(v: number) {
    this.room(1);
    this.dv.setUint8(this.n, v & 255);
    this.n += 1;
  }

  i8(v: number) {
    this.room(1);
    this.dv.setInt8(this.n, Math.max(-128, Math.min(127, Math.round(v))));
    this.n += 1;
  }

  u16(v: number) {
    this.room(2);
    this.dv.setUint16(this.n, Math.max(0, Math.min(65535, Math.round(v))));
    this.n += 2;
  }

  i16(v: number) {
    this.room(2);
    this.dv.setInt16(this.n, Math.max(-32768, Math.min(32767, Math.round(v))));
    this.n += 2;
  }

  u32(v: number) {
    this.room(4);
    this.dv.setUint32(this.n, v >>> 0);
    this.n += 4;
  }

  // Position (1/8 px) and level (0..1 as a byte) helpers.
  pos(v: number) {
    this.i16(v * 8);
  }

  lvl(v: number) {
    this.u8(Math.max(0, Math.min(255, Math.round(v * 255))));
  }

  str(s: string) {
    const b = enc.encode(s);
    this.u32(b.length);
    this.room(b.length);
    new Uint8Array(this.buf, this.n, b.length).set(b);
    this.n += b.length;
  }

  // A copy of what has been written.
  bytes(): ArrayBuffer {
    return this.buf.slice(0, this.n);
  }
}

export class Reader {
  private dv: DataView;
  n = 0;

  constructor(private buf: ArrayBuffer) {
    this.dv = new DataView(buf);
  }

  get left() {
    return this.buf.byteLength - this.n;
  }

  u8() {
    return this.dv.getUint8(this.n++);
  }

  i8() {
    return this.dv.getInt8(this.n++);
  }

  u16() {
    const v = this.dv.getUint16(this.n);
    this.n += 2;
    return v;
  }

  i16() {
    const v = this.dv.getInt16(this.n);
    this.n += 2;
    return v;
  }

  u32() {
    const v = this.dv.getUint32(this.n);
    this.n += 4;
    return v;
  }

  pos() {
    return this.i16() / 8;
  }

  lvl() {
    return this.u8() / 255;
  }

  str(): string {
    const len = this.u32();
    const s = dec.decode(new Uint8Array(this.buf, this.n, len));
    this.n += len;
    return s;
  }
}

export function jsonFrame(route: number, msg: unknown): ArrayBuffer {
  const w = new Writer();
  w.u8(route);
  w.u8(K_JSON);
  w.str(JSON.stringify(msg));
  return w.bytes();
}

// ---- Small enums as bytes ----

export const FACES = ['r', 'l', 'u', 'd'] as const;
export const faceId = (f: string) => Math.max(0, FACES.indexOf(f as (typeof FACES)[number]));

// Palette colours by index, for particles sent across.
export const COLOURS = ['#A3AD6E', '#8E9F6C', '#6F8F7C', '#487282', '#42315A', '#D4D0C6', '#E2D27A', '#C8483C'];
export const colourId = (c: string) => Math.max(0, COLOURS.indexOf(c.toUpperCase()));

// What the host is doing, for the guests' read-only cards.
export const HOST_MODES = ['play', 'summary', 'build', 'ledger', 'title', 'pause', 'look', 'result'] as const;
export type HostMode = (typeof HOST_MODES)[number];

// ---- Messages ----

// A guest's dog, as the guest sends it.
export interface DogState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number;
  hy: number;
  face: number;
  lying: boolean;
  sprint: boolean;
  sniff?: boolean; // nose down on a scent (systems/loot.ts)
  dig?: boolean; // digging
}

export interface DogEvent {
  kind: 'bark' | 'nip' | 'ping';
  seq: number;
  x: number;
  y: number;
  hx: number;
  hy: number;
  target: number; // nip: the animal id the guest saw at its nose (0 = none); ping: which word
}

export function writeDog(w: Writer, t: number, d: DogState, events: DogEvent[]) {
  w.reset();
  w.u8(0);
  w.u8(K_DOG);
  w.u32(t);
  w.pos(d.x);
  w.pos(d.y);
  w.pos(d.vx);
  w.pos(d.vy);
  w.i8(d.hx * 127);
  w.i8(d.hy * 127);
  w.u8(d.face | (d.lying ? 4 : 0) | (d.sprint ? 8 : 0) | (d.sniff ? 16 : 0) | (d.dig ? 32 : 0));
  w.u8(events.length);
  for (const e of events) {
    w.u8(e.kind === 'bark' ? 1 : e.kind === 'nip' ? 2 : 3);
    w.u16(e.seq);
    w.pos(e.x);
    w.pos(e.y);
    w.i8(e.hx * 127);
    w.i8(e.hy * 127);
    w.u32(e.target);
  }
}

export function readDog(r: Reader): { t: number; dog: DogState; events: DogEvent[] } {
  const t = r.u32();
  const x = r.pos(), y = r.pos(), vx = r.pos(), vy = r.pos();
  const hx = r.i8() / 127, hy = r.i8() / 127;
  const f = r.u8();
  const dog: DogState = { x, y, vx, vy, hx, hy, face: f & 3, lying: !!(f & 4), sprint: !!(f & 8), sniff: !!(f & 16), dig: !!(f & 32) };
  const events: DogEvent[] = [];
  const n = r.u8();
  for (let i = 0; i < n; i++) {
    const k = r.u8();
    const seq = r.u16();
    const ex = r.pos(), ey = r.pos(), ehx = r.i8() / 127, ehy = r.i8() / 127;
    events.push({ kind: k === 1 ? 'bark' : k === 2 ? 'nip' : 'ping', seq, x: ex, y: ey, hx: ehx, hy: ehy, target: r.u32() });
  }
  return { t, dog, events };
}
