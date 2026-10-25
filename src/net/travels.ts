import { C } from '../palette';
import type { Game } from '../game';
import type { Discovery } from '../systems/discovery';
import { FH, FW, GLIMPSED, LOOK_R, SEEN, WALK_R, packFog, unpackFog } from '../systems/discovery';
import { KEEPSAKES, PLACES, inPlace, keepsakeById, type KeepsakeId, type PlaceDef, type PlaceId } from '../world/places';
import { regionById } from '../world/map';
import { wrap } from '../gfx/font';

// A guest's travels: what they find exploring a friend's ranch is theirs.
// Hidden places, keepsakes, the map their dog walks (their own fog), a stamp
// for every ranch visited and any brace ribbons. Kept under its own key
// while visiting (the ranch being played is the host's, and our own game is
// not running), then folded into our own save the next time we load our
// ranch or start one (mergeTravels).

const KEY = 'comeby-travels-v1';

export interface Stamp {
  ranch: string; // the ranch's name (its sign), or "<dog>'S RANCH"
  host: string; // the host's dog
  first: number; // Date.now() of the first visit
  visits: number;
}

interface TravelsData {
  v: 1;
  stamps: Stamp[];
  found: PlaceId[];
  keep: KeepsakeId[];
  fog: string;
  coins: number; // found-place rewards still to pay into our own ranch
  ribbons: number; // brace placings as a guest
  seen?: string[]; // first-time co-op hints shown
}

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readData(): TravelsData {
  const empty: TravelsData = { v: 1, stamps: [], found: [], keep: [], fog: '', coins: 0, ribbons: 0 };
  try {
    const raw = store()?.getItem(KEY);
    if (!raw) return empty;
    const d = JSON.parse(raw) as TravelsData;
    return d && d.v === 1 ? { ...empty, ...d } : empty;
  } catch {
    return empty;
  }
}

export class Travels {
  found = new Set<PlaceId>();
  keep = new Set<KeepsakeId>();
  fog = new Uint8Array(FW * FH);
  private d = readData();
  private cell = -1;
  private inside: PlaceDef | null = null;

  constructor() {
    for (const id of this.d.found) this.found.add(id);
    for (const id of this.d.keep) this.keep.add(id);
    if (this.d.fog) unpackFog(this.d.fog, this.fog);
  }

  get stamps(): Stamp[] {
    return this.d.stamps;
  }

  // Also count what our own ranch has already found (from our own save).
  include(own: { found?: PlaceId[]; keep?: KeepsakeId[]; fog?: string } | undefined) {
    if (!own) return;
    for (const id of own.found ?? []) this.found.add(id);
    for (const id of own.keep ?? []) this.keep.add(id);
    if (own.fog) {
      const f = new Uint8Array(FW * FH);
      unpackFog(own.fog, f);
      for (let i = 0; i < f.length; i++) this.fog[i] = Math.max(this.fog[i], f[i]);
    }
  }

  private save() {
    this.d.found = [...this.found];
    this.d.keep = [...this.keep];
    this.d.fog = packFog(this.fog);
    try {
      store()?.setItem(KEY, JSON.stringify(this.d));
    } catch { /* quota or blocked: play on */ }
  }

  // The friend's ranch on our screen shows what we know as well as theirs.
  overlay(disc: Discovery) {
    for (const id of this.found) disc.found.add(id);
    for (const id of this.keep) disc.keepsakes.add(id);
    for (let i = 0; i < this.fog.length; i++) if (this.fog[i] > disc.fog[i]) disc.fog[i] = this.fog[i];
    disc.fogVer++;
  }

  // A stamp for this ranch: true the first time.
  stamp(ranch: string, host: string): boolean {
    const s = this.d.stamps.find((x) => x.ranch === ranch && x.host === host);
    if (s) s.visits++;
    else this.d.stamps.push({ ranch, host, first: Date.now(), visits: 1 });
    this.save();
    return !s;
  }

  ribbon() {
    this.d.ribbons++;
    this.save();
  }

  // A first-time hint: true if it has not been shown before (and marks it).
  firstTime(id: string): boolean {
    const seen = (this.d.seen ??= []);
    if (seen.includes(id)) return false;
    seen.push(id);
    this.save();
    return true;
  }

  private reveal(cx: number, cy: number, r: number, v: number, disc: Discovery) {
    let changed = false;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(FH - 1, Math.ceil(cy + r)); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(FW - 1, Math.ceil(cx + r)); x++) {
        const i = y * FW + x;
        if (this.fog[i] >= v || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        this.fog[i] = v;
        changed = true;
      }
    if (changed) {
      disc.reveal(cx, cy, r, v);
      this.dirty = true;
    }
  }

  private dirty = false;
  private saveT = 0;

  // Each frame on a friend's ranch: our dog clears our map, finds places and
  // picks up keepsakes, all for our own game.
  update(game: Game, dt: number) {
    const d = game.dog, disc = game.discovery;
    const c = Math.floor(d.y / 16) * FW + Math.floor(d.x / 16);
    if (c !== this.cell) {
      this.cell = c;
      this.reveal(d.x / 16, d.y / 16, WALK_R, SEEN, disc);
    }
    const at = PLACES.find((p) => inPlace(p, d.x, d.y, 0.85)) ?? null;
    if (at !== this.inside) {
      this.inside = at;
      if (at) {
        game.place = { text: at.name, t: 2.4 };
        if (!this.found.has(at.id)) this.discover(game, at);
      }
    }
    for (const p of PLACES) {
      if (!p.keepsake || !p.item || this.keep.has(p.keepsake) || !this.found.has(p.id)) continue;
      if (Math.hypot(d.x - p.item[0], d.y - p.item[1]) < 11) this.take(game, p.keepsake, p.item);
    }
    // The fog is saved now and then, not every step.
    if (this.dirty && (this.saveT -= dt) <= 0) {
      this.saveT = 3;
      this.dirty = false;
      this.save();
    }
  }

  private discover(game: Game, p: PlaceDef) {
    this.found.add(p.id);
    game.discovery.found.add(p.id);
    const reward = 5 * regionById(p.region).tier;
    this.d.coins += reward;
    const n = PLACES.filter((q) => this.found.has(q.id)).length;
    game.showBanner(p.name, `YOURS TO KEEP: HIDDEN PLACE ${n}/${PLACES.length}  +${reward}$ AT HOME`, 3.2);
    game.audio?.stinger('steady');
    game.fx.ring(game.dog.x, game.dog.y - 2, 34, C.butter, 0.7, 4);
    if (p.kind === 'lookout') this.reveal(p.cx / 2, p.cy / 2, LOOK_R, GLIMPSED, game.discovery);
    if (p.rx) this.reveal(p.cx / 2, p.cy / 2, Math.max(p.rx, p.ry) / 2 + 2, SEEN, game.discovery);
    this.save();
  }

  private take(game: Game, id: KeepsakeId, at: [number, number]) {
    this.keep.add(id);
    game.discovery.keepsakes.add(id);
    const k = keepsakeById(id);
    game.showBanner(`FOUND ${k.name}`, `YOURS TO KEEP: KEEPSAKE ${this.keep.size}/${KEEPSAKES.length}`, 3);
    game.audio?.play('coin', { x: at[0], y: at[1] });
    game.fx.float(at[0], at[1] - 10, k.short, C.butter, 1.4);
    for (let i = 0; i < 10; i++)
      game.fx.add({ kind: 'spark', x: at[0], y: at[1] - 4, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 45, max: 0.5, color: C.butter });
    this.save();
  }
}

// Fold the travels into our own ranch (after a load, or at a new game).
export function mergeTravels(game: Game) {
  const d = readData();
  const disc = game.discovery;
  const before = { found: disc.found.size, keep: disc.keepsakes.size };
  for (const id of d.found) if (PLACES.some((p) => p.id === id)) disc.found.add(id);
  for (const id of d.keep) if (KEEPSAKES.some((k) => k.id === id)) disc.keepsakes.add(id);
  if (d.fog) {
    const f = new Uint8Array(FW * FH);
    unpackFog(d.fog, f);
    for (let i = 0; i < f.length; i++) if (f[i] > disc.fog[i]) disc.fog[i] = f[i];
    disc.fogVer++;
  }
  const places = disc.found.size - before.found, keeps = disc.keepsakes.size - before.keep;
  if (d.coins > 0) game.earn(d.coins);
  if (places || keeps || d.coins > 0) {
    const bits = [places ? `${places} HIDDEN PLACE${places > 1 ? 'S' : ''}` : '', keeps ? `${keeps} KEEPSAKE${keeps > 1 ? 'S' : ''}` : '', d.coins ? `+${d.coins}$` : ''].filter(Boolean);
    game.tip = { text: `FROM YOUR TRAVELS: ${bits.join(', ')}.`, t: 7 };
    game.ledgerNew = true;
  }
  if (d.coins > 0) {
    d.coins = 0;
    try {
      store()?.setItem(KEY, JSON.stringify(d));
    } catch { /* fine */ }
  }
}

// Ledger lines: the ranches visited and anything won there.
export function travelLines(w: number): { s: string; c: string }[] {
  const d = readData();
  if (!d.stamps.length) return [];
  const names = d.stamps.map((s) => s.ranch);
  const out: { s: string; c: string }[] = [];
  for (const l of wrap(`RANCHES VISITED ${d.stamps.length}: ${names.join(', ')}`, w)) out.push({ s: l, c: out.length ? C.sage : C.wool });
  if (d.ribbons) out.push({ s: `BRACE RIBBONS ${d.ribbons}`, c: C.sage });
  return out;
}
