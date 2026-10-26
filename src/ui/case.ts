import { REGIONS, YARDS } from '../world/map';

// Sentence case for the game's prose. The game's strings are written in
// capitals (the old font had no lower case); this turns them into ordinary
// sentences where they are drawn: "YOUR DUCKS ARE OUT IN THE HOME MEADOW.
// HEAD EAST!" becomes "Your ducks are out in the Home Meadow. Head east!".
// Kept as they are: names (places, buyers, tiers, the dog's and ranch's),
// keys ("hold Q", "press B", Space, Tab), pad buttons in brackets "(A)",
// and anything already in mixed case. Headings and buttons stay capitals.

const KEYS: Record<string, string> = { SPACE: 'Space', TAB: 'Tab', ESC: 'Esc', SHIFT: 'Shift', ENTER: 'Enter', WASD: 'WASD' };

const title = (s: string) => s.toLowerCase().replace(/(^|[\s'(-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

let NAMES: string[] | null = null;
let extra: string[] = [];
let extraKey = '';
const cache = new Map<string, string>();

function staticNames(): string[] {
  const out = new Set<string>(['RANCH LEDGER', 'LEDGER', 'SHOW GROUND', 'VALLEY CUP', 'CROSSROADS']);
  // Places with names of their own (not "the ranch", which is just that).
  for (const r of REGIONS) if (!/^the /i.test(r.name)) out.add(r.name.toUpperCase());
  for (const y of YARDS) {
    out.add(y.name.replace(/^THE /, ''));
    out.add(y.place.replace(/^THE /, ''));
  }
  for (const s of ['SHEARER', 'MILLER', 'DROVER', 'SALE YARD']) out.add(s);
  return [...out].filter((n) => n.length > 2);
}

// The dog's, the ranch's and the helpers' names, as they change.
export function setNames(names: string[]) {
  const key = names.join('|');
  if (key === extraKey) return;
  extraKey = key;
  extra = names.filter((n) => n && n.length > 1).map((n) => n.toUpperCase());
  cache.clear();
}

export function sentence(s: string): string {
  if (!s || /[a-z]/.test(s)) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  NAMES ??= staticNames();
  // Protect what keeps its capitals, as placeholders, longest first.
  const keep: string[] = [];
  const hold = (v: string) => `\u0001${keep.push(v) - 1}\u0002`;
  let t = s;
  t = t.replace(/\([A-Z0-9 /+]{1,8}\)/g, (m) => hold(m)); // pad buttons: (A) (LB)
  const names = [...extra, ...NAMES].sort((a, b) => b.length - a.length);
  for (const n of names) {
    const re = new RegExp(`(^|[^A-Z])(${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![A-Z])`, 'g');
    t = t.replace(re, (_, a: string, b: string) => a + hold(title(b)));
  }
  t = t.replace(/\b[A-Z]\/[A-Z]\b/g, (m) => hold(m)); // Q/E
  t = t.replace(/\b(SPACE|TAB|ESC|SHIFT|ENTER|WASD)\b/g, (m) => hold(KEYS[m]));
  t = t.replace(/\bX(\d)/g, (_, d: string) => hold('x') + d); // X1.5 pay
  // Single letters are keys ("HOLD Q", "PRESS B"), but for A and I.
  t = t.replace(/(^|[^A-Z'])([B-HJ-Z])(?![A-Z'])/g, (_, a: string, b: string) => a + hold(b));
  t = t.replace(/\bI\b/g, () => hold('I'));
  t = t.toLowerCase();
  // Capitals to start each sentence.
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
  t = t.replace(/\u0001(\d+)\u0002/g, (_, i: string) => keep[Number(i)]);
  // A name or key may open a sentence: fine as it is. A lone "a" opening one:
  t = t.replace(/(^|[.!?]\s+)a\b/g, (_, a: string) => `${a}A`);
  if (cache.size > 800) cache.clear();
  cache.set(s, t);
  return t;
}
