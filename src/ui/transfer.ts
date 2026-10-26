import { C } from '../palette';
import { prose } from './case';
import { panel } from './frame';
import { text } from '../gfx/font';
import type { Game } from '../game';
import { SAVE_KEY, saveData, type SaveData } from '../systems/save';
import { SPECIES } from '../entities/species';
import { TIERS, tierOf } from '../systems/progression';
import { dimView } from './feel';
import { safeArea } from './safe';

// MOVE A RANCH (title) / MOVE THIS RANCH (pause menu): take the save to
// another phone or computer as a text code or a file, or bring one here.
//
// A code is the save's JSON squeezed with deflate and written in URL-safe
// base64 behind a short header: COMEBY1. (COMEBY0. where the browser cannot
// compress). A file holds the same code. Whatever comes in is checked line
// by line before anything is touched, and replacing a ranch always asks
// first.
//
// Copying, pasting, saving and opening files are things a browser only lets
// a page do straight after a tap, so those buttons act in the tap itself
// (a pointerup listener, as textfield.ts does for the keyboard); keys and
// pads fall back to the browser's own prompt for the code.

type Row = { id: 'copy' | 'file' | 'paste' | 'open' | 'back' | 'yes' | 'no'; label: string };

const st = {
  from: 'pause' as 'pause' | 'title',
  sel: 0,
  note: '',
  noteGood: false,
  incoming: null as SaveData | null,
  busy: false,
};

export const transferState = st; // read by scripts/transfertest.mjs

export function openTransfer(game: Game) {
  st.from = game.mode === 'title' ? 'title' : 'pause';
  st.sel = 0;
  st.note = '';
  st.incoming = null;
  game.mode = 'transfer';
  game.input.clearQueue();
}

function close(game: Game) {
  st.incoming = null;
  game.mode = st.from;
  game.input.clearQueue();
}

const say = (s: string, good = false) => {
  st.note = s;
  st.noteGood = good;
};

// ---- The code ----

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toB64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

function fromB64(s: string): Uint8Array | null {
  const out: number[] = [];
  let acc = 0, bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 255);
    }
  }
  return new Uint8Array(out);
}

const canSqueeze = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

export async function encodeSave(json: string): Promise<string> {
  const raw = new TextEncoder().encode(json);
  if (canSqueeze) return 'COMEBY1.' + toB64(await pipe(raw, new CompressionStream('deflate-raw')));
  return 'COMEBY0.' + toB64(raw);
}

// A code (or a file's text, or plain save JSON) back to a checked save, or
// a line for the player saying what is wrong with it.
export async function decodeSave(input: string): Promise<SaveData | string> {
  const s = input.replace(/\s+/g, '');
  if (!s) return 'NOTHING THERE TO LOAD';
  let json: string;
  if (s.startsWith('{')) json = input;
  else {
    const m = /^COMEBY([01])\.([A-Za-z0-9_-]+)$/.exec(s);
    if (!m) return "THAT IS NOT A COME BY SAVE CODE";
    const bytes = fromB64(m[2]);
    if (!bytes) return "THAT IS NOT A COME BY SAVE CODE";
    try {
      if (m[1] === '1') {
        if (!canSqueeze) return 'THIS BROWSER CANNOT OPEN THAT CODE';
        json = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
      } else json = new TextDecoder().decode(bytes);
    } catch {
      return 'THE CODE IS CUT SHORT: COPY ALL OF IT';
    }
  }
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return 'THE CODE IS CUT SHORT: COPY ALL OF IT';
  }
  return checkSave(d);
}

// Everything loadInto (systems/save.ts) relies on, so a bad file can never
// leave a broken ranch behind.
export function checkSave(d: unknown): SaveData | string {
  const bad = 'THAT SAVE IS DAMAGED';
  if (!d || typeof d !== 'object') return bad;
  const o = d as Record<string, unknown>;
  if (o.v !== 1) return 'THAT SAVE IS FROM A NEWER GAME';
  const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const arr = (v: unknown) => Array.isArray(v);
  const obj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!int(o.day, 1, 1e6) || !int(o.tier, 1, TIERS.length) || !num(o.coins) || typeof o.won !== 'boolean' || !num(o.tut)) return bad;
  if (!arr(o.tips) || !(o.tips as unknown[]).every((t) => typeof t === 'string')) return bad;
  if (!obj(o.totals) || !obj(o.upgrades) || !arr(o.owned) || !arr(o.buildings) || !arr(o.wild) || !arr(o.helpers)) return bad;
  if (!Object.values(o.upgrades as object).every(num)) return bad;
  const animal = (a: unknown) => {
    const x = a as Record<string, unknown>;
    return obj(a) && typeof x.id === 'string' && x.id in SPECIES && num(x.stress) && (x.x === undefined || num(x.x)) && (x.y === undefined || num(x.y));
  };
  for (const b of o.buildings as unknown[]) {
    const x = b as Record<string, unknown>;
    if (!obj(b) || typeof x.kind !== 'string' || !int(x.tx, 0, 1e4) || !int(x.ty, 0, 1e4) || !int(x.rot, 0, 3) || !num(x.level)) return bad;
    if (x.animals !== undefined && !(arr(x.animals) && (x.animals as unknown[]).every(animal))) return bad;
  }
  if (!(o.wild as unknown[]).every(animal)) return bad;
  if (!(o.helpers as unknown[]).every((h) => obj(h) && typeof (h as Record<string, unknown>).name === 'string')) return bad;
  for (const k of ['orders', 'decor']) if (o[k] !== undefined && !arr(o[k])) return bad;
  for (const k of ['trials', 'look', 'weather', 'discovery']) if (o[k] !== undefined && !obj(o[k])) return bad;
  return d as SaveData;
}

function storedSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

// The ranch as it stands: the game being played, or the save on the title.
function currentJson(game: Game): string | null {
  return st.from === 'pause' && !game.demo ? JSON.stringify(saveData(game)) : storedSave();
}

function summaryOf(d: { day: number; tier: number; look?: { name?: string; ranch?: string } }): string {
  const name = d.look?.ranch || tierOf(d.tier).name;
  return `DAY ${d.day}, ${name}`;
}

// ---- Actions (run straight from the tap where a browser needs that) ----

async function copyCode(game: Game) {
  const json = currentJson(game);
  if (!json) return say('NO RANCH TO MOVE YET');
  const code = await encodeSave(json);
  try {
    await navigator.clipboard.writeText(code);
    say(`CODE COPIED (${code.length} LETTERS). PASTE IT ON THE OTHER DEVICE.`, true);
  } catch {
    // No clipboard here (or not without a tap): the browser's own box.
    window.prompt('Your Come By save code. Copy all of it:', code);
    say('PASTE THE CODE ON THE OTHER DEVICE', true);
  }
}

async function saveFile(game: Game) {
  const json = currentJson(game);
  if (!json) return say('NO RANCH TO MOVE YET');
  const code = await encodeSave(json);
  const d = JSON.parse(json) as SaveData;
  const name = `come-by-day-${d.day}.txt`;
  const file = new File([code + '\n'], name, { type: 'text/plain' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  // Phones: the share sheet (save to Files, send to yourself). Elsewhere a download.
  if (game.input.touchMode && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Come By save' });
      return say('SAVE SENT', true);
    } catch { /* cancelled: fall through to a download */ }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  say(`SAVED ${name.toUpperCase()}`, true);
}

async function pasteCode() {
  let s = '';
  try {
    s = await navigator.clipboard.readText();
  } catch { /* not allowed: ask */ }
  if (!/COMEBY[01]\.|^\s*\{/.test(s)) s = window.prompt('Paste your Come By save code:') ?? '';
  await take(s);
}

let picker: HTMLInputElement | null = null;
function openFile() {
  if (!picker) {
    picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.txt,.json,text/plain,application/json';
    picker.style.display = 'none';
    document.body.appendChild(picker);
    picker.addEventListener('change', () => {
      const f = picker?.files?.[0];
      if (picker) picker.value = '';
      if (!f) return;
      if (f.size > 2_000_000) return say('THAT FILE IS FAR TOO BIG FOR A SAVE');
      f.text().then(take, () => say('COULD NOT READ THAT FILE'));
    });
  }
  picker.click();
}

async function take(s: string) {
  if (!s.trim()) return;
  st.busy = true;
  const d = await decodeSave(s);
  st.busy = false;
  if (typeof d === 'string') return say(d);
  st.incoming = d;
  st.sel = 1; // NO is the default: replacing a ranch is a choice
  say('');
}

// Replace the save, then load it as CONTINUE does (main.ts).
function accept(game: Game) {
  const d = st.incoming;
  if (!d) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
  } catch {
    return say('NO ROOM TO STORE IT ON THIS DEVICE');
  }
  st.incoming = null;
  game.loading = true; // this game must not save over it on the way out
  game.fadeTo(() => (game.request = 'continue'));
}

function act(game: Game, id: Row['id']) {
  if (st.busy) return;
  if (id === 'back') close(game);
  else if (id === 'no') {
    st.incoming = null;
    st.sel = 0;
  } else if (id === 'yes') accept(game);
  else if (id === 'copy') void copyCode(game);
  else if (id === 'file') void saveFile(game);
  else if (id === 'paste') void pasteCode();
  else if (id === 'open') openFile();
}

// ---- Screen ----

function rows(game: Game): Row[] {
  if (st.incoming) return [{ id: 'yes', label: storedSave() ? 'YES, REPLACE IT' : 'YES, LOAD IT' }, { id: 'no', label: 'NO' }];
  const have = !!currentJson(game);
  const out: Row[] = [];
  if (have) out.push({ id: 'copy', label: 'COPY A SAVE CODE' }, { id: 'file', label: 'SAVE IT AS A FILE' });
  out.push({ id: 'paste', label: 'PASTE A SAVE CODE' }, { id: 'open', label: 'LOAD A SAVE FILE' }, { id: 'back', label: 'BACK' });
  return out;
}

export function transferKeys(game: Game) {
  const inp = game.input;
  const rs = rows(game);
  st.sel = Math.min(st.sel, rs.length - 1);
  if (inp.pressed('up')) st.sel = (st.sel + rs.length - 1) % rs.length;
  if (inp.pressed('down')) st.sel = (st.sel + 1) % rs.length;
  if (inp.pressed('cancel') || inp.pressed('pause')) {
    if (st.incoming) act(game, 'no');
    else close(game);
  } else if (inp.pressed('confirm')) act(game, rs[st.sel].id);
}

// Taps on the buttons, handled in the event so the browser allows them.
interface Hit { id: Row['id']; x: number; y: number; w: number; h: number; at: number }
let hits: Hit[] = [];
let gameRef: Game | null = null;
let tapped = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerup', (e) => {
    const g = gameRef;
    if (!g || g.mode !== 'transfer') return;
    const [x, y] = g.screen.toInternal(e.clientX, e.clientY);
    const now = performance.now();
    for (const h of hits) {
      if (now - h.at > 250 || x < h.x || y < h.y || x >= h.x + h.w || y >= h.y + h.h) continue;
      tapped = now;
      act(g, h.id);
      return;
    }
  }, true);
}

export function drawTransfer(game: Game, g: CanvasRenderingContext2D, W: number, H: number) {
  gameRef = game;
  const ui = game.ui;
  const touch = game.input.touchMode;
  const S = safeArea(game.screen);
  dimView(g, game.view());
  const pw = Math.min(W - 16 - S.left - S.right, 190);
  const rs = rows(game);
  const rh = touch ? 15 : 12, gap = touch ? 4 : 3;
  const head: { s: string; c: string }[] = [];
  if (st.incoming) {
    const cur = storedSave();
    head.push({ s: cur ? 'REPLACE THIS RANCH?' : 'LOAD THIS RANCH?', c: C.butter });
    if (cur) {
      try {
        head.push({ s: `HERE NOW: ${summaryOf(JSON.parse(cur))}`, c: C.wool });
      } catch { /* a broken save here: nothing to say about it */ }
    }
    head.push({ s: `COMING IN: ${summaryOf(st.incoming)}`, c: C.wool });
    if (cur) head.push({ s: 'THE RANCH HERE NOW WILL BE GONE.', c: C.sage });
  } else {
    head.push({ s: st.from === 'title' ? 'MOVE A RANCH' : 'MOVE THIS RANCH', c: C.butter });
    for (const l of prose('TAKE IT TO ANOTHER PHONE OR COMPUTER AS A CODE OR A FILE, OR BRING ONE HERE.', pw - 16)) head.push({ s: l, c: C.wool });
  }
  const notes = st.note ? prose(st.note, pw - 16) : [];
  const ph = 10 + head.length * 7 + 4 + rs.length * (rh + gap) + (notes.length ? notes.length * 7 + 3 : 0);
  const x0 = Math.round(W / 2 - pw / 2), y0 = Math.max(S.top + 4, Math.round(H / 2 - ph / 2));
  panel(g, x0, y0, pw, ph);
  head.forEach((r, i) => text(g, r.s, W / 2, y0 + 6 + i * 7, r.c, { align: 'center' }));
  let y = y0 + 10 + head.length * 7;
  const now = performance.now();
  hits = [];
  rs.forEach((r, i) => {
    const bx = x0 + 8, bw = pw - 16;
    if (ui.hovering(bx, y, bw, rh)) st.sel = i;
    const on = st.sel === i;
    panel(g, bx, y, bw, rh, on || ui.isActive(`tr-${r.id}`) ? C.teal : C.plum, on ? C.butter : C.sage);
    text(g, r.label, W / 2, y + Math.floor((rh - 5) / 2), C.wool, { align: 'center' });
    hits.push({ id: r.id, x: bx - 4, y: y - 1, w: bw + 8, h: rh + 2, at: now });
    // The tap itself acted (above); this only keeps the pointer from the world.
    if (ui.click(`tr-${r.id}`, bx - 4, y - 1, bw + 8, rh + 2) && now - tapped > 400) act(game, r.id);
    y += rh + gap;
  });
  notes.forEach((l, i) => text(g, l, W / 2, y + 1 + i * 7, st.noteGood ? C.butter : C.wool, { align: 'center' }));
  if (st.busy) text(g, '...', W / 2, y0 + ph + 4, C.wool, { align: 'center', shadow: C.plum });
  ui.captureAll('transfer-bg');
}
