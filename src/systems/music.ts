// Generative folk music, all synthesised: a tin whistle and a fiddle on
// persistent voices (so a tune is one oscillator gliding from note to note),
// plucked harp and bass from the sample bank, a string pad, a reed drone and
// a soft bodhran. Notes are scheduled a fraction of a second ahead on the
// audio clock. Each region has its own key, mode, meter and tempo; every
// section of eight chords gets a fresh tune built from a motif, repeated,
// sequenced and brought home to a cadence, so it never loops but always
// sounds composed. The flock's mood steers it: a calm drive fills it out, a
// panic thins the tune and brings in tremolo strings and a heartbeat.

import { type Bank, mtof } from './synth';

export type PieceId = 'title' | 'ranch' | 'meadow' | 'hills' | 'rocky' | 'ford' | 'high' | 'dusk' | 'night' | 'trial' | 'lullaby';
export type StingerKind = 'calm' | 'steady' | 'rattled' | 'tierup' | 'summary' | 'gate' | 'sour' | 'sold' | 'missed';

export interface MusicState {
  piece: PieceId;
  energy: number; // 0..1 how hard the dog is working a flock
  tension: number; // 0..1 flock panic by day, predators close by night
  rest: boolean; // summary / build / ledger: soft and sparse
  muffle: boolean; // paused
  // The sky, 0..1 each: rain darkens it, fog hushes it, wind lifts the drone.
  rain?: number;
  fog?: number;
  wind?: number;
}

export interface NoteLog {
  t: number;
  inst: string;
  midi: number;
  dur: number;
  vel: number;
  info?: string;
}

type Meter = '6/8' | '3/4' | '4/4';
type Lead = 'whistle' | 'fiddle' | 'harp' | 'bell';
type Cells = { mid: number[][]; slow: number[][]; cad: number[][] };

interface Chord {
  root: number; // semitones above the key's tonic
  tones: number[]; // semitones above the root
}

interface Note {
  at: number; // eighth-note ticks from the section start
  len: number;
  midi: number;
  vel: number;
  orn?: 'cut' | 'slide' | 'roll';
  slur?: boolean; // joined to the note before (no re-attack)
}

interface Piece {
  id: PieceId;
  key: number; // tonic pitch class, 0 = C
  mode: number[];
  meter: Meter;
  bpm: number; // beats per minute (the dotted quarter in 6/8)
  slot: number; // bars per chord
  open: string[][]; // four-chord phrases that end away from home
  close: string[][]; // four-chord phrases that come home
  tense: string[][]; // for a panicking flock / prowling predators
  leads: Lead[];
  range: [number, number]; // whistle register for the tune
  arps: number[][]; // harp patterns per bar: voicing index, -1 = rest
  drone: number;
  pad: number;
  harp: number;
  bells?: boolean; // music box instead of harp (night)
  perc?: boolean; // a light bodhran when the drive gets going
  dark?: number; // 0..1 how muted the pad is
  orn: number; // ornament density
  theme?: number; // chance a section quotes the main theme
  leadP?: number; // chance a section has a tune (instead of the mood's)
  cells?: Cells; // rhythm cells (instead of the meter's)
  march?: boolean; // a pipe-band drum pattern, always on
  rock?: boolean; // the harp keeps every beat, however still the dog is
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const IONIAN = MAJOR;
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// Roman numerals against the major scale: 'IV', 'vi', 'bVII', 'iv', 'Vsus4',
// 'Iadd9', 'V7', 'iio'. Upper case is major, lower case minor.
function chord(sym: string): Chord {
  let s = sym, flat = 0;
  while (s[0] === 'b') { flat--; s = s.slice(1); }
  const m = /^(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/.exec(s);
  if (!m) throw new Error(`bad chord ${sym}`);
  const minor = m[1] === m[1].toLowerCase();
  const root = (MAJOR[NUMERALS.indexOf(m[1].toUpperCase())] + flat + 12) % 12;
  let tones = minor ? [0, 3, 7] : [0, 4, 7];
  switch (m[2]) {
    case 'sus4': tones = [0, 5, 7]; break;
    case 'sus2': tones = [0, 2, 7]; break;
    case '7': tones = minor ? [0, 3, 7, 10] : [0, 4, 7, 10]; break;
    case 'add9': tones = [...tones, 14]; break;
    case 'o': tones = [0, 3, 6]; break;
  }
  return { root, tones };
}

const ION_OPEN = [['I', 'IV', 'I', 'V'], ['I', 'vi', 'IV', 'V'], ['I', 'V', 'vi', 'IV'], ['I', 'iii', 'IV', 'V'], ['vi', 'IV', 'I', 'V'], ['I', 'I', 'IV', 'V'], ['IV', 'I', 'ii', 'V'], ['I', 'IVadd9', 'vi', 'Vsus4']];
const ION_CLOSE = [['I', 'IV', 'V', 'I'], ['IV', 'V', 'I', 'I'], ['vi', 'IV', 'V', 'I'], ['ii', 'V', 'I', 'I'], ['IV', 'I', 'V', 'I'], ['IV', 'IV', 'I', 'I'], ['ii', 'IV', 'V', 'I'], ['I', 'vi', 'IV', 'I']];
const ION_TENSE = [['vi', 'iii', 'IV', 'iv'], ['vi', 'IV', 'bVII', 'V'], ['vi', 'V', 'IV', 'iv'], ['ii', 'vi', 'bVI', 'V'], ['vi', 'bVI', 'bVII', 'V'], ['iv', 'I', 'bVI', 'V']];
const MIX_OPEN = [['I', 'bVII', 'IV', 'I'], ['I', 'bVII', 'I', 'v'], ['I', 'IV', 'bVII', 'IV'], ['I', 'v', 'bVII', 'IV'], ['IV', 'I', 'bVII', 'v']];
const MIX_CLOSE = [['bVII', 'IV', 'I', 'I'], ['I', 'bVII', 'IV', 'I'], ['v', 'bVII', 'I', 'I'], ['IV', 'bVII', 'I', 'I']];
const MIX_TENSE = [['vi', 'v', 'bVII', 'IV'], ['ii', 'v', 'bVI', 'bVII'], ['iv', 'bVII', 'v', 'v'], ['vi', 'bVI', 'bVII', 'v']];
const DOR_OPEN = [['i', 'IV', 'i', 'bVII'], ['i', 'bIII', 'IV', 'i'], ['i', 'bVII', 'IV', 'v'], ['i', 'IV', 'bVII', 'bIII'], ['i', 'ii', 'bIII', 'IV'], ['i', 'i', 'bVII', 'IV']];
const DOR_CLOSE = [['bVII', 'IV', 'i', 'i'], ['bIII', 'bVII', 'i', 'i'], ['IV', 'v', 'i', 'i'], ['bIII', 'IV', 'i', 'i'], ['IV', 'bVII', 'i', 'i'], ['v', 'bVII', 'i', 'i']];
const DOR_TENSE = [['i', 'bVI', 'bVII', 'v'], ['iv', 'v', 'i', 'bVI'], ['i', 'v', 'bVI', 'v'], ['ii', 'v', 'i', 'bVI']];
const AEO_OPEN = [['i', 'bVI', 'bIII', 'bVII'], ['i', 'bVII', 'bVI', 'bVII'], ['i', 'iv', 'bVII', 'bIII'], ['i', 'bIII', 'bVII', 'iv'], ['bVI', 'bVII', 'i', 'v']];
const AEO_CLOSE = [['bVI', 'bVII', 'i', 'i'], ['iv', 'v', 'i', 'i'], ['bVI', 'iv', 'bVII', 'i'], ['bIII', 'bVII', 'i', 'i'], ['bVI', 'iv', 'V', 'i']];
const AEO_TENSE = [['i', 'bII', 'i', 'V'], ['i', 'iio', 'V', 'i'], ['iv', 'bII', 'i', 'i'], ['i', 'bVI', 'bII', 'V']];

const ARP68 = [[0, 1, 2, 3, 2, 1], [0, 2, 1, 3, 2, 1], [0, 1, 2, 1, 3, 1]];
const ARP34 = [[0, 1, 2, 3, 2, 1], [0, 2, 3, 2, 1, 2], [0, 1, 3, 1, 2, 1]];
const ARP44 = [[0, 1, 2, 1, 3, 1, 2, 1], [0, 2, 1, 2, 3, 2, 1, 2], [0, 1, 2, 3, 2, 1, 2, 1]];

const PIECES: Record<PieceId, Piece> = {
  // The main theme over harp and drone: G major, a slow 6/8 air.
  title: { id: 'title', key: 7, mode: IONIAN, meter: '6/8', bpm: 54, slot: 1, open: ION_OPEN, close: ION_CLOSE, tense: ION_TENSE, leads: ['harp', 'whistle'], range: [74, 90], arps: [ARP68[0]], drone: 0.6, pad: 0.8, harp: 0.9, orn: 1, theme: 1 },
  // Home: the theme's key, and now and then the theme itself.
  ranch: { id: 'ranch', key: 7, mode: IONIAN, meter: '6/8', bpm: 58, slot: 1, open: ION_OPEN, close: ION_CLOSE, tense: ION_TENSE, leads: ['whistle', 'harp', 'fiddle'], range: [74, 90], arps: ARP68, drone: 0.3, pad: 0.7, harp: 1, perc: true, orn: 1, theme: 0.3 },
  // Ducks and first steps: bright D major, a lilting jig pace.
  meadow: { id: 'meadow', key: 2, mode: IONIAN, meter: '6/8', bpm: 62, slot: 1, open: ION_OPEN, close: ION_CLOSE, tense: ION_TENSE, leads: ['whistle', 'harp'], range: [74, 91], arps: ARP68, drone: 0.2, pad: 0.55, harp: 1, perc: true, orn: 1.2 },
  // Sheep on the rolling hills: E dorian waltz.
  hills: { id: 'hills', key: 4, mode: DORIAN, meter: '3/4', bpm: 84, slot: 1, open: DOR_OPEN, close: DOR_CLOSE, tense: DOR_TENSE, leads: ['whistle', 'fiddle', 'harp'], range: [71, 88], arps: ARP34, drone: 0.35, pad: 0.7, harp: 0.9, orn: 1 },
  // Goats on the rocks: A dorian over a strong drone, a stepping 4/4.
  rocky: { id: 'rocky', key: 9, mode: DORIAN, meter: '4/4', bpm: 88, slot: 1, open: DOR_OPEN, close: DOR_CLOSE, tense: DOR_TENSE, leads: ['whistle', 'fiddle'], range: [69, 88], arps: ARP44, drone: 0.75, pad: 0.5, harp: 0.9, perc: true, orn: 1.5 },
  // Cattle at the river: C major, slow, harp flowing like water.
  ford: { id: 'ford', key: 0, mode: IONIAN, meter: '4/4', bpm: 72, slot: 1, open: ION_OPEN, close: ION_CLOSE, tense: ION_TENSE, leads: ['harp', 'whistle', 'fiddle'], range: [72, 91], arps: [ARP44[2], ARP44[0]], drone: 0.25, pad: 0.7, harp: 1, orn: 0.8 },
  // Ponies under a big sky: D mixolydian, long chords, open drone.
  high: { id: 'high', key: 2, mode: MIXOLYDIAN, meter: '3/4', bpm: 66, slot: 2, open: MIX_OPEN, close: MIX_CLOSE, tense: MIX_TENSE, leads: ['whistle', 'fiddle'], range: [74, 93], arps: ARP34, drone: 1, pad: 0.8, harp: 0.6, orn: 0.7 },
  // The light going: A minor, the fiddle takes the tune.
  dusk: { id: 'dusk', key: 9, mode: AEOLIAN, meter: '3/4', bpm: 70, slot: 1, open: AEO_OPEN, close: AEO_CLOSE, tense: AEO_TENSE, leads: ['fiddle', 'whistle', 'harp'], range: [69, 86], arps: ARP34, drone: 0.4, pad: 0.9, harp: 0.8, dark: 0.3, orn: 0.8 },
  // The Show Ground: a pipe-band march in A mixolydian over a strong drone,
  // the whistle playing chanter. Formal, and it never lets up.
  trial: { id: 'trial', key: 9, mode: MIXOLYDIAN, meter: '4/4', bpm: 96, slot: 1, open: MIX_OPEN, close: MIX_CLOSE, tense: MIX_TENSE, leads: ['whistle', 'whistle', 'fiddle'], range: [69, 86], arps: [[0, -1, 2, -1, 1, -1, 3, -1]], drone: 1, pad: 0.35, harp: 0.7, orn: 1.4, leadP: 0.9, march: true, cells: { mid: [[3, 1, 2, 2], [3, 1, 3, 1], [2, 2, 3, 1], [2, 1, 1, 2, 2], [3, 1, 4], [2, 2, 2, 2]], slow: [[4, 4], [3, 1, 4], [6, 2]], cad: [[4, 4], [2, 2, 4], [6, -2], [3, 1, 4]] } },
  // Resting on the ranch: a music-box lullaby rocking over soft harp,
  // sometimes the main theme, very slowly.
  lullaby: { id: 'lullaby', key: 7, mode: IONIAN, meter: '6/8', bpm: 40, slot: 1, open: ION_OPEN, close: ION_CLOSE, tense: ION_TENSE, leads: ['bell'], range: [76, 91], arps: [[0, -1, -1, 2, -1, -1], [0, -1, 2, -1, 3, -1]], drone: 0.25, pad: 0.6, harp: 0.55, dark: 0.45, orn: 0, theme: 0.4, leadP: 0.8, rock: true },
  // Night: D minor, a music box and a low whistle, very still.
  night: { id: 'night', key: 2, mode: AEOLIAN, meter: '3/4', bpm: 54, slot: 2, open: AEO_OPEN, close: AEO_CLOSE, tense: AEO_TENSE, leads: ['whistle', 'fiddle'], range: [64, 81], arps: ARP34, drone: 0.6, pad: 0.8, harp: 0, bells: true, dark: 0.7, orn: 0.5 },
};

// "Come By", the main theme: a G major air in 6/8, two eight-bar strains.
// [midi, eighths] per bar, with one chord per bar.
const THEME: { chords: string[]; bars: [number, number][][] }[] = [
  {
    chords: ['I', 'vi', 'IV', 'V', 'I', 'vi', 'V', 'I'],
    bars: [
      [[74, 3], [79, 2], [81, 1]], [[83, 2], [81, 1], [79, 3]], [[76, 2], [79, 1], [84, 3]], [[81, 2], [78, 1], [74, 3]],
      [[74, 3], [79, 2], [81, 1]], [[83, 2], [86, 1], [83, 3]], [[81, 2], [83, 1], [81, 2], [78, 1]], [[79, 6]],
    ],
  },
  {
    chords: ['IV', 'I', 'IV', 'V', 'IV', 'I', 'V', 'I'],
    bars: [
      [[84, 3], [88, 2], [86, 1]], [[83, 3], [79, 3]], [[76, 2], [79, 1], [84, 2], [83, 1]], [[81, 6]],
      [[84, 3], [88, 2], [86, 1]], [[83, 2], [79, 1], [74, 2], [79, 1]], [[81, 2], [83, 1], [81, 2], [78, 1]], [[79, 6]],
    ],
  },
];
const THEME_KEY = 7;

const CELLS: Record<Meter, { mid: number[][]; slow: number[][]; cad: number[][] }> = {
  '6/8': { mid: [[3, 3], [2, 1, 3], [2, 1, 2, 1], [3, 2, 1], [1, 1, 1, 3], [3, 1, 1, 1]], slow: [[6], [3, 3], [2, 1, 3]], cad: [[6], [3, 3], [3, -3], [2, 1, 3]] },
  '3/4': { mid: [[2, 2, 2], [3, 1, 2], [4, 2], [2, 4], [2, 1, 1, 2], [1, 1, 2, 2]], slow: [[6], [4, 2], [2, 4]], cad: [[6], [4, 2], [4, -2], [2, 4]] },
  '4/4': { mid: [[2, 2, 2, 2], [3, 1, 2, 2], [4, 2, 2], [2, 2, 4], [3, 1, 4], [2, 1, 1, 4], [1, 1, 2, 4]], slow: [[8], [4, 4], [6, 2]], cad: [[8], [4, 4], [2, 2, 4], [6, -2]] },
};

const sub = (m: Meter) => (m === '6/8' ? 3 : 2);
const barTicks = (m: Meter) => (m === '4/4' ? 8 : 6);
// How much a position in the bar wants a chord tone: 3 on the downbeat,
// 2 on the other main beat (6/8 and 4/4), 1 on the remaining beats, 0 off.
function weight(m: Meter, inBar: number) {
  if (inBar === 0) return 3;
  if ((m === '6/8' && inBar === 3) || (m === '4/4' && inBar === 4)) return 2;
  return inBar % sub(m) === 0 ? 1 : 0;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const x = clamp01(v); return x * x * (3 - 2 * x); };

// Move a set of voices to a new chord with the least total motion.
function voiceLead(prev: number[], pcs: number[], lo: number, hi: number): number[] {
  const n = prev.length;
  let best: number[] = prev, bestCost = 1e9;
  const perm = (arr: number[], k: number) => {
    if (k === n) {
      let cost = 0;
      const out: number[] = [];
      for (let i = 0; i < n; i++) {
        let m = prev[i] + ((((arr[i] - prev[i]) % 12) + 18) % 12) - 6; // nearest octave
        while (m < lo) m += 12;
        while (m > hi) m -= 12;
        out.push(m);
        cost += Math.abs(m - prev[i]);
      }
      // Avoid unisons between voices.
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (out[i] === out[j]) cost += 4;
      if (cost < bestCost) { bestCost = cost; best = out; }
      return;
    }
    for (let i = k; i < n; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      perm(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  perm(pcs.slice(0, n), 0);
  return best;
}

// The piece's scale, bent where a borrowed chord needs it (a minor iv in a
// major key lowers the sixth while it lasts).
function chordScale(mode: number[], c: Chord): number[] {
  const sc = mode.slice();
  for (const t of c.tones) {
    const pc = (c.root + t) % 12;
    if (sc.includes(pc)) continue;
    let bi = -1, bd = 2;
    sc.forEach((s, i) => {
      const d = Math.min((s - pc + 12) % 12, (pc - s + 12) % 12);
      if (d < bd) { bd = d; bi = i; }
    });
    if (bi >= 0) sc[bi] = pc;
    else sc.push(pc);
  }
  return sc.sort((a, b) => a - b);
}

// ---- Voices ----

interface MonoOpts {
  wave: PeriodicWave | OscillatorType;
  level: number;
  attack: number;
  release: number;
  sustain: number;
  vibRate: number;
  vibDepth: number; // cents
  vibDelay: number;
  slide: number; // legato glide time
  breath: number;
  chiff: number;
  cutoff: number;
  body?: [number, number, number][]; // peaking filters [freq, gain dB, Q]
}

// A monophonic instrument that lives for the whole session: notes are
// automation on one oscillator and one envelope, so a legato phrase glides
// and no nodes are created per note.
class Mono {
  private osc: OscillatorNode;
  private env: GainNode;
  private vib: GainNode;
  private bEnv: GainNode | null = null;
  private bpf: BiquadFilterNode | null = null;
  private lastF = 0;
  readonly out: GainNode;

  constructor(private ctx: BaseAudioContext, private o: MonoOpts) {
    this.out = ctx.createGain();
    this.osc = ctx.createOscillator();
    if (typeof o.wave === 'string') this.osc.type = o.wave as OscillatorType;
    else this.osc.setPeriodicWave(o.wave);
    this.osc.frequency.value = 440;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vibRate;
    this.vib = ctx.createGain();
    this.vib.gain.value = 0;
    lfo.connect(this.vib).connect(this.osc.detune);
    this.env = ctx.createGain();
    this.env.gain.value = 0;
    let node: AudioNode = this.osc;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.cutoff;
    lp.Q.value = 0.5;
    node.connect(lp);
    node = lp;
    for (const [f, g, q] of o.body ?? []) {
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking';
      pk.frequency.value = f;
      pk.gain.value = g;
      pk.Q.value = q;
      node.connect(pk);
      node = pk;
    }
    node.connect(this.env).connect(this.out);
    this.osc.start();
    lfo.start();
  }

  // Breath (or bow) noise needs the noise buffer, which may arrive later.
  addBreath(noise: AudioBuffer) {
    if (this.bEnv || !this.o.breath) return;
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    this.bpf = this.ctx.createBiquadFilter();
    this.bpf.type = 'bandpass';
    this.bpf.frequency.value = 2000;
    this.bpf.Q.value = 0.9;
    this.bEnv = this.ctx.createGain();
    this.bEnv.gain.value = 0;
    src.connect(this.bpf).connect(this.bEnv).connect(this.out);
    src.start();
  }

  note(t: number, midi: number, dur: number, vel: number, orn: Note['orn'], slur: boolean, tie: boolean) {
    const o = this.o, f = mtof(midi), fp = this.osc.frequency;
    if (slur && this.lastF) {
      fp.setValueAtTime(this.lastF, t);
      fp.exponentialRampToValueAtTime(f, t + o.slide);
    } else if (orn === 'slide') {
      fp.setValueAtTime(f * 0.891, t);
      fp.exponentialRampToValueAtTime(f, t + 0.09);
    } else if (orn === 'cut') {
      fp.setValueAtTime(f * 1.189, t);
      fp.setValueAtTime(f, t + 0.032);
    } else if (orn === 'roll' && dur > 0.4) {
      fp.setValueAtTime(f, t);
      fp.setValueAtTime(f * 1.189, t + 0.1);
      fp.setValueAtTime(f, t + 0.13);
      fp.setValueAtTime(f * 0.891, t + 0.23);
      fp.setValueAtTime(f, t + 0.26);
    } else fp.setValueAtTime(f, t);
    this.lastF = f;

    const peak = vel * o.level;
    const g = this.env.gain;
    if (!slur) {
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(peak, t + o.attack);
      g.setTargetAtTime(peak * o.sustain, t + o.attack, 0.3);
    } else g.setTargetAtTime(peak * o.sustain, t, 0.06);
    const rel = t + Math.max(o.attack + 0.02, dur - o.release);
    if (!tie) g.setTargetAtTime(0, rel, o.release / 4);

    const v = this.vib.gain;
    if (!slur) v.setValueAtTime(0, t);
    if (dur > 0.45) {
      v.setValueAtTime(slur ? o.vibDepth * 0.5 : 0, t + o.vibDelay);
      v.linearRampToValueAtTime(o.vibDepth, t + o.vibDelay + 0.35);
    }

    if (this.bEnv && this.bpf) {
      const b = this.bEnv.gain;
      this.bpf.frequency.setValueAtTime(Math.min(8000, f * 2.2), t);
      if (!slur) {
        b.setValueAtTime(0, t);
        b.linearRampToValueAtTime(peak * o.chiff, t + 0.012);
        b.setTargetAtTime(peak * o.breath, t + 0.014, 0.04);
      }
      if (!tie) b.setTargetAtTime(0, rel, o.release / 4);
    }
  }

  silence(t: number) {
    this.env.gain.cancelScheduledValues(t);
    this.env.gain.setTargetAtTime(0, t, 0.05);
    if (this.bEnv) {
      this.bEnv.gain.cancelScheduledValues(t);
      this.bEnv.gain.setTargetAtTime(0, t, 0.05);
    }
    this.lastF = 0;
  }
}

function waveOf(ctx: BaseAudioContext, harmonics: number[]): PeriodicWave {
  const real = new Float32Array(harmonics.length + 1);
  const imag = new Float32Array(harmonics.length + 1);
  harmonics.forEach((h, i) => (imag[i + 1] = h));
  return ctx.createPeriodicWave(real, imag);
}

// ---- The engine ----

interface Section {
  chords: Chord[];
  melody: Note[];
  counter: Note[];
  lead: Lead | null;
  arp: number[];
  len: number; // ticks
  tense: boolean;
}

const LOOKAHEAD = 0.3;
const LEVEL = 1.4; // the whole band, before the music volume

export class Music {
  log: NoteLog[] | null = null; // tests: every scheduled note
  private sum: GainNode;
  private muffle: BiquadFilterNode;
  private revIn: GainNode;
  private conv: ConvolverNode;
  private hasIr = false;
  private whistle: Mono;
  private fiddle: Mono;
  private leadBus: GainNode;
  private pad: OscillatorNode[] = [];
  private padPits = [55, 59, 62, 67];
  private padEnv: GainNode;
  private padLp: BiquadFilterNode;
  private drone: OscillatorNode[] = [];
  private droneEnv: GainNode;
  private tens: OscillatorNode[] = [];
  private tensEnv: GainNode;
  private harpBus: GainNode;
  private melBus: GainNode;
  private bassBus: GainNode;
  private bellBus: GainNode;
  private percBus: GainNode;

  private piece: Piece | null = null;
  private want: PieceId = 'title';
  private sec: Section | null = null;
  private tick = 0;
  private mi = 0; // next melody note
  private ci = 0; // next counter note
  private next = 0; // audio time of the next tick
  private tempo = 1;
  private energy = 0.3;
  private tension = 0;
  private rest = false;
  private muffled = false;
  private secCount = 0;
  private leadRot = 0;
  private themePart = 0;
  private arpV: number[] = [55, 62, 67, 71];
  private bellPrev = 81;
  private stingWave: PeriodicWave;
  private sky = { rain: 0, fog: 0, wind: 0 };

  constructor(private ctx: BaseAudioContext, out: AudioNode, private stingOut: AudioNode, private bank: Bank, private rnd: () => number = Math.random) {
    const c = ctx;
    this.sum = c.createGain();
    this.sum.gain.value = LEVEL;
    this.muffle = c.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 18000;
    this.muffle.Q.value = 0.5;
    this.sum.connect(this.muffle).connect(out);
    // Reverb: one mono convolver, widened by delaying its right side.
    this.revIn = c.createGain();
    this.revIn.channelCount = 1;
    this.revIn.channelCountMode = 'explicit';
    this.conv = c.createConvolver();
    this.conv.normalize = false;
    this.revIn.connect(this.conv);
    const left = c.createStereoPanner(), right = c.createStereoPanner(), haas = c.createDelay(0.05);
    left.pan.value = -0.8;
    right.pan.value = 0.8;
    haas.delayTime.value = 0.013;
    this.conv.connect(left).connect(this.sum);
    this.conv.connect(haas).connect(right).connect(this.sum);

    const bus = (pan: number, send: number, lp = 0) => {
      const g = c.createGain();
      let node: AudioNode = g;
      if (lp) {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = lp;
        node.connect(f);
        node = f;
      }
      const p = c.createStereoPanner();
      p.pan.value = pan;
      node.connect(p).connect(this.sum);
      const s = c.createGain();
      s.gain.value = send;
      p.connect(s).connect(this.revIn);
      return g;
    };

    const ww = waveOf(c, [1, 0.12, 0.05, 0.015]);
    this.stingWave = ww;
    this.whistle = new Mono(c, { wave: ww, level: 0.085, attack: 0.025, release: 0.07, sustain: 0.82, vibRate: 5.2, vibDepth: 11, vibDelay: 0.22, slide: 0.03, breath: 0.07, chiff: 0.4, cutoff: 5200 });
    this.fiddle = new Mono(c, { wave: 'sawtooth', level: 0.05, attack: 0.09, release: 0.16, sustain: 0.9, vibRate: 5.7, vibDepth: 14, vibDelay: 0.16, slide: 0.06, breath: 0.03, chiff: 0.06, cutoff: 2900, body: [[480, 5, 1.3], [2700, 4, 1.6]] });
    this.leadBus = bus(0.12, 0.32);
    this.whistle.out.connect(this.leadBus);
    this.fiddle.out.connect(this.leadBus);

    // String pad: four saws, panned apart, under one slow filter.
    this.padLp = c.createBiquadFilter();
    this.padLp.type = 'lowpass';
    this.padLp.frequency.value = 1200;
    this.padLp.Q.value = 0.4;
    const padSweep = c.createOscillator();
    padSweep.frequency.value = 0.055;
    const sweepAmt = c.createGain();
    sweepAmt.gain.value = 260;
    padSweep.connect(sweepAmt).connect(this.padLp.frequency);
    padSweep.start();
    this.padEnv = c.createGain();
    this.padEnv.gain.value = 0;
    [-0.55, -0.2, 0.2, 0.55].forEach((pan, i) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(this.padPits[i]);
      o.detune.value = [-6, 4, -3, 7][i];
      const p = c.createStereoPanner();
      p.pan.value = pan;
      o.connect(p).connect(this.padLp);
      o.start();
      this.pad.push(o);
    });
    const padBus = bus(0, 0.4);
    this.padLp.connect(this.padEnv).connect(padBus);

    // Reed drone on the tonic and fifth.
    const reed = waveOf(c, [1, 0.08, 0.35, 0.05, 0.2, 0.03, 0.12, 0.02, 0.07]);
    const dLp = c.createBiquadFilter();
    dLp.type = 'lowpass';
    dLp.frequency.value = 520;
    this.droneEnv = c.createGain();
    this.droneEnv.gain.value = 0;
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator();
      o.setPeriodicWave(reed);
      o.frequency.value = mtof(43 + i * 7);
      o.detune.value = i ? 3 : -2;
      o.connect(dLp);
      o.start();
      this.drone.push(o);
    }
    dLp.connect(this.droneEnv).connect(bus(0, 0.3));

    // Tremolo strings for tension.
    const tLp = c.createBiquadFilter();
    tLp.type = 'lowpass';
    tLp.frequency.value = 850;
    const trem = c.createGain();
    trem.gain.value = 0.55;
    const tLfo = c.createOscillator();
    tLfo.frequency.value = 6.5;
    const tDepth = c.createGain();
    tDepth.gain.value = 0.45;
    tLfo.connect(tDepth).connect(trem.gain);
    tLfo.start();
    this.tensEnv = c.createGain();
    this.tensEnv.gain.value = 0;
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(50 + i * 7);
      o.detune.value = i ? 5 : -5;
      o.connect(tLp);
      o.start();
      this.tens.push(o);
    }
    tLp.connect(trem).connect(this.tensEnv).connect(bus(-0.1, 0.25));

    this.harpBus = bus(-0.28, 0.28);
    this.melBus = bus(0.2, 0.3);
    this.bassBus = bus(0, 0.12, 900);
    this.bellBus = bus(0.3, 0.55);
    this.percBus = bus(0.05, 0.15);
  }

  // Called every frame with the game's mood.
  update(s: MusicState, dt: number) {
    const k = (tau: number) => 1 - Math.exp(-dt / tau);
    const e = s.rest ? Math.min(s.energy, 0.25) : s.energy;
    this.energy += (e - this.energy) * k(e > this.energy ? 1.5 : 3);
    this.tension += (s.tension - this.tension) * k(s.tension > this.tension ? 0.5 : 3.5);
    this.rest = s.rest;
    this.want = s.piece;
    this.sky.rain += ((s.rain ?? 0) - this.sky.rain) * k(2);
    this.sky.fog += ((s.fog ?? 0) - this.sky.fog) * k(2);
    this.sky.wind += ((s.wind ?? 0) - this.sky.wind) * k(2);
    const now = this.ctx.currentTime;
    if (s.muffle !== this.muffled) {
      this.muffled = s.muffle;
      this.muffle.frequency.setTargetAtTime(s.muffle ? 650 : 18000, now, 0.12);
      this.sum.gain.setTargetAtTime(LEVEL * (s.muffle ? 0.7 : 1), now, 0.12);
    }
    if (!this.hasIr) {
      const ir = this.bank.get('ir');
      if (ir) {
        this.conv.buffer = ir;
        this.hasIr = true;
      }
    }
    const noise = this.bank.get('noise');
    if (noise) {
      this.whistle.addBreath(noise);
      this.fiddle.addBreath(noise);
    }
    if (!this.piece) this.begin(this.want, now + 0.1);
    if (this.next < now) this.next = now + 0.03; // fell behind: skip, never burst
    while (this.next < now + LOOKAHEAD) this.step();
  }

  // ---- Structure ----

  private begin(id: PieceId, t: number) {
    const fresh = !this.piece;
    this.piece = PIECES[id];
    this.secCount = 0;
    this.themePart = 0;
    this.next = Math.max(this.next, t);
    // Drone moves to the new tonic.
    const root = 36 + ((this.piece.key - 36 + 120) % 12);
    const r = root < 38 ? root + 12 : root;
    this.drone[0].frequency.setTargetAtTime(mtof(r), t, fresh ? 0.01 : 0.5);
    this.drone[1].frequency.setTargetAtTime(mtof(r + 7), t, fresh ? 0.01 : 0.5);
    this.whistle.silence(t);
    this.fiddle.silence(t);
    this.newSection();
  }

  private tpb() {
    return barTicks(this.piece!.meter);
  }

  private tickDur() {
    const p = this.piece!;
    return 60 / (p.bpm * this.tempo) / sub(p.meter);
  }

  // Tense music starts when the flock panics and only ends once it has
  // properly settled, so it does not flicker.
  private wantTense() {
    return this.sec?.tense ? this.tension > 0.35 : this.tension > 0.6;
  }

  private newSection() {
    const p = this.piece!;
    const tense = this.wantTense();
    const n = this.secCount++;
    let chords: Chord[];
    let melody: Note[] = [];
    let lead: Lead | null = null;
    const themeTurn = p.id === 'title' ? n % 3 !== 2 : n > 0 && this.rnd() < (p.theme ?? 0);
    if (p.theme && !tense && themeTurn) {
      const part = THEME[this.themePart++ % 2];
      chords = part.chords.map(chord);
      lead = p.id === 'title' ? (n % 6 < 3 ? 'whistle' : 'fiddle') : p.id === 'lullaby' ? 'bell' : this.rnd() < 0.6 ? 'whistle' : 'fiddle';
      melody = this.themeMelody(part.bars, p, lead);
    } else {
      // Grey skies lean on phrases that start on a minor chord.
      const gloom = Math.max(this.sky.rain, this.sky.fog * 0.7);
      const pick = (list: string[][]) => {
        const w = list.map((ph) => 1 + 6 * gloom * (/^b?[iv]/.test(ph[0]) ? 1 : 0));
        let x = this.rnd() * w.reduce((a, v) => a + v, 0);
        for (let i = 0; i < list.length; i++) if ((x -= w[i]) <= 0) return list[i];
        return list[list.length - 1];
      };
      const a = pick(tense ? p.tense : p.open), b = pick(tense ? p.tense : p.close);
      chords = [...a, ...b].map(chord);
      // Pieces with their own chance (the trial, the lullaby) start with a
      // tune; the others often let the harmony settle first.
      const pLead = (p.leadP ?? (this.rest ? 0.3 : 0.45 + 0.4 * this.energy) * (n === 0 && p.id !== 'title' ? 0.6 : 1)) * (tense ? 0.5 : 1) * (1 - 0.4 * this.sky.fog);
      if (this.rnd() < pLead) {
        lead = p.leads[this.leadRot++ % p.leads.length];
        melody = this.genMelody(p, chords, lead);
      }
    }
    const counter = lead && lead !== 'fiddle' && !tense && this.energy > 0.4 && this.rnd() < 0.45 ? this.genCounter(p, chords, melody) : [];
    const arp = p.arps[Math.floor(this.rnd() * p.arps.length)];
    this.sec = { chords, melody, counter, lead, arp, len: chords.length * p.slot * this.tpb(), tense };
    // A section cut short may have left a tied note sounding.
    this.whistle.silence(this.next);
    this.fiddle.silence(this.next);
    this.log?.push({ t: this.next, inst: 'section', midi: p.key, dur: this.sec.len * this.tickDur(), vel: 0, info: `${p.id} lead=${lead} tense=${tense} counter=${counter.length > 0}` });
    this.tick = 0;
    this.mi = 0;
    this.ci = 0;
  }

  private step() {
    const t = this.next;
    // A change of scene (dusk, night, the title) turns on the next beat;
    // walking into another region waits for the bar line.
    const scene = (id: PieceId) => id === 'dusk' || id === 'night' || id === 'title' || id === 'trial' || id === 'lullaby';
    // Getting up from a rest ends the lullaby on the very next note.
    const onBeat = this.tick % sub(this.piece!.meter) === 0 || this.piece!.id === 'lullaby';
    if (this.want !== this.piece!.id && onBeat && (scene(this.want) || scene(this.piece!.id))) this.begin(this.want, t);
    if (this.tick % this.tpb() === 0) this.onBar(t);
    if (this.tick % sub(this.piece!.meter) === 0) this.onBeat(t);
    const p = this.piece!, sec = this.sec!;
    const tpb = this.tpb(), tps = tpb * p.slot;
    const slot = Math.floor(this.tick / tps);
    const inBar = this.tick % tpb;
    const ch = sec.chords[slot];
    if (this.tick % tps === 0) this.onChord(t, ch);
    const td = this.tickDur();
    this.playLead(t, td);
    this.playArp(t, inBar, ch);
    this.playBass(t, inBar, ch, sec.chords[slot + 1] ?? sec.chords[0], this.tick % tps === tps - 1);
    this.playPerc(t, inBar);
    this.next += td;
    this.tick++;
    if (this.tick >= sec.len) this.newSection();
  }

  private onBar(t: number) {
    if (this.want !== this.piece!.id) {
      this.begin(this.want, t);
    } else if (this.sec && this.wantTense() !== this.sec.tense && (this.sec.tense === false || this.tick % (this.tpb() * this.piece!.slot) === 0)) {
      // The flock just panicked (turn at once), or has settled (at the
      // next chord): the music turns with it.
      this.newSection();
    }
    const p = this.piece!;
    const { rain, fog, wind } = this.sky;
    // Fog and rain slow it a touch.
    this.tempo = (1 + 0.05 * this.energy + (p.id === 'night' ? 0.22 : 0.07) * this.tension) * (1 - 0.06 * fog - 0.04 * rain);
    const e = this.energy, x = this.tension;
    const tau = 0.6;
    this.padEnv.gain.setTargetAtTime(0.034 * p.pad * (0.8 + 0.35 * (1 - e)) * (1 - 0.3 * x) * (1 + 0.2 * fog), t, tau);
    this.padLp.frequency.setTargetAtTime((600 + 1500 * (1 - (p.dark ?? 0))) * (0.75 + 0.35 * e) * (1 - 0.25 * x) * (1 - 0.3 * Math.max(rain, fog)), t, tau);
    this.droneEnv.gain.setTargetAtTime(0.03 * p.drone * (1 + 0.3 * x) * (1 + 0.5 * fog + 0.3 * wind), t, tau);
    this.harpBus.gain.setTargetAtTime(p.harp, t, tau);
    // Fog: everything a little further away, a little more reverb.
    this.revIn.gain.setTargetAtTime(1 + 0.8 * fog, t, tau);
  }

  // The tension layers follow the mood beat by beat.
  private onBeat(t: number) {
    const x = this.tension;
    this.leadBus.gain.setTargetAtTime(1 - smooth((x - 0.45) / 0.25) * 0.92, t, 0.4);
    this.tensEnv.gain.setTargetAtTime(0.05 * smooth((x - 0.3) / 0.5), t, 0.5);
  }

  private onChord(t: number, c: Chord) {
    const p = this.piece!;
    const pc = (p.key + c.root) % 12;
    const tones = c.tones.map((x) => (pc + x) % 12);
    const pcs = tones.length >= 4 ? tones.slice(0, 4) : [tones[0], tones[1], tones[2], tones[0]];
    this.log?.push({ t, inst: 'chord', midi: pc, dur: 0, vel: 0, info: tones.join(',') });
    const lo = p.id === 'night' ? 48 : 52, hi = p.id === 'night' ? 70 : 74;
    this.padPits = voiceLead(this.padPits, pcs, lo, hi);
    this.padPits.forEach((m, i) => this.pad[i].frequency.setTargetAtTime(mtof(m), t, 0.06));
    // Guitar-style open voicing for the harp: root, fifth, octave, tenth.
    const root = 45 + ((pc - 45 + 120) % 12);
    const fifth = c.tones.includes(7) ? 7 : c.tones[2];
    this.arpV = [root, root + fifth, root + 12, root + 12 + c.tones[1]];
    // Tremolo strings: root and fifth, a minor sixth when it gets bad.
    const tr = 43 + ((pc - 43 + 120) % 12);
    this.tens[0].frequency.setTargetAtTime(mtof(tr), t, 0.08);
    this.tens[1].frequency.setTargetAtTime(mtof(tr + (this.tension > 0.75 ? 8 : 7)), t, 0.08);
  }

  // ---- Playing ----

  private playLead(t: number, td: number) {
    const sec = this.sec!;
    const leadOn = this.tension < 0.7;
    const mel = sec.melody;
    while (this.mi < mel.length && mel[this.mi].at <= this.tick) {
      const n = mel[this.mi++];
      if (n.at < this.tick) continue;
      if (!leadOn) {
        // Holding its breath: make sure no tied note is left hanging.
        if (sec.lead === 'whistle' || sec.lead === 'fiddle') (sec.lead === 'whistle' ? this.whistle : this.fiddle).silence(t);
        continue;
      }
      const nx = mel[this.mi];
      const tie = !!nx && nx.slur === true && nx.at === n.at + n.len;
      const dur = n.len * td;
      const hum = (this.rnd() - 0.5) * 0.012;
      if (sec.lead === 'bell') {
        this.ring(t + hum, n.midi, 0.13 * n.vel, this.bellBus, 'bell-mel');
      } else if (sec.lead === 'harp') {
        this.pluck(t + hum, n.midi, 0.2 * n.vel, this.melBus, Math.max(0.6, dur * 1.4), 'harp-mel');
        if (n.len >= 3 && this.rnd() < 0.25) this.pluck(t + hum + 0.01, n.midi - 12, 0.09 * n.vel, this.melBus, dur, 'harp-oct');
      } else {
        const v = sec.lead === 'whistle' ? this.whistle : this.fiddle;
        v.note(t + hum, n.midi, dur, n.vel, n.orn, !!n.slur, tie);
        this.log?.push({ t, inst: sec.lead!, midi: n.midi, dur, vel: n.vel });
      }
    }
    const co = sec.counter;
    while (this.ci < co.length && co[this.ci].at <= this.tick) {
      const n = co[this.ci++];
      if (n.at < this.tick) continue;
      if (!leadOn) {
        this.fiddle.silence(t);
        continue;
      }
      const nx = co[this.ci];
      const tie = !!nx && nx.slur === true && nx.at === n.at + n.len;
      this.fiddle.note(t, n.midi, n.len * td, n.vel, undefined, !!n.slur, tie);
      this.log?.push({ t, inst: 'counter', midi: n.midi, dur: n.len * td, vel: n.vel });
    }
  }

  private playArp(t: number, inBar: number, c: Chord) {
    const p = this.piece!;
    const s = sub(p.meter);
    const e = this.energy;
    if (p.bells) {
      // Music box: a few notes wandering over the chord.
      const chance = inBar === 0 ? 0.55 : inBar % s === 0 ? 0.22 : 0.07;
      if (this.rnd() > chance * (1 - 0.8 * smooth((this.tension - 0.3) / 0.4))) return;
      const pc = (p.key + c.root) % 12;
      const sc = chordScale(p.mode, c).map((x) => (x + p.key) % 12);
      const ok = (m: number) => c.tones.some((x) => (pc + x) % 12 === m % 12) || (inBar % s !== 0 && sc.includes(m % 12));
      const cands: number[] = [];
      for (let m = 72; m <= 91; m++) if (ok(m) && Math.abs(m - this.bellPrev) <= 7 && m !== this.bellPrev) cands.push(m);
      if (!cands.length) return;
      const m = cands[Math.floor(this.rnd() * cands.length)];
      this.bellPrev = m;
      this.ring(t, m, 0.12 * (0.7 + 0.3 * this.rnd()), this.bellBus, 'bell');
      return;
    }
    const idx = this.sec!.arp[inBar % this.sec!.arp.length];
    if (idx < 0) return;
    const strong = inBar % s === 0;
    const chance = inBar === 0 ? 0.92 : strong ? (p.rock ? 0.95 : 0.35 + 0.65 * e) : smooth((e - 0.15) / 0.5) * 0.95;
    if (this.rnd() > chance) return;
    const vel = (inBar === 0 ? 0.24 : strong ? 0.18 : 0.13) * (0.85 + 0.3 * this.rnd());
    this.pluck(t + (this.rnd() - 0.5) * 0.014, this.arpV[idx], vel, this.harpBus, 1.5, 'harp');
  }

  private playBass(t: number, inBar: number, c: Chord, nextC: Chord, lastOfSlot: boolean) {
    const p = this.piece!;
    const e = this.energy;
    const slow = p.slot > 1;
    if (e < 0.18 && !slow && p.id !== 'title') return;
    const pc = (p.key + c.root) % 12;
    const root = 40 + ((pc - 40 + 120) % 12);
    const fifth = root + 7 > 52 ? root - 5 : root + 7;
    const tps = this.tpb() * p.slot;
    const inSlot = this.tick % tps;
    let m = -1, vel = 0.32;
    if (inSlot === 0) m = root;
    else if (slow) {
      if (inBar === 0 && e > 0.3) { m = fifth; vel = 0.22; }
    } else if (p.meter === '6/8' && inBar === 3 && e > 0.35) { m = this.rnd() < 0.6 ? fifth : root; vel = 0.24; }
    else if (p.meter === '4/4' && inBar === 4 && e > 0.3) { m = fifth; vel = 0.25; }
    else if (p.meter === '3/4' && inBar === 4 && e > 0.65) { m = fifth; vel = 0.18; }
    else if (lastOfSlot && e > 0.6 && nextC.root !== c.root && this.rnd() < 0.5) {
      // Walk up (or down) a step into the next chord.
      const npc = (p.key + nextC.root) % 12;
      const nr = 40 + ((npc - 40 + 120) % 12);
      const dir = nr > root ? -1 : 1; // approach from the side we come from
      m = nr + dir * (p.mode.includes((npc + dir - p.key + 24) % 12) ? 1 : 2);
      vel = 0.18;
    }
    if (m > 0) this.pluck(t, m, vel * 0.7, this.bassBus, slow ? 3 : 1.2, 'bass');
  }

  private playPerc(t: number, inBar: number) {
    const p = this.piece!;
    const s = sub(p.meter);
    const x = this.tension, e = this.energy;
    // Heartbeat under tension.
    if (x > 0.42 && inBar % s === 0) {
      const v = 0.13 * smooth((x - 0.42) / 0.4);
      this.drum(t, 'drum', v, 0.85);
      if (x > 0.7) this.drum(t + 0.17, 'drum', v * 0.6, 0.8);
    }
    // The trial march: bass drum on one and three, side drum on the
    // backbeats, a drag into the next bar.
    if (p.march) {
      const pat = [1, 0, 0.45, 0, 0.75, 0, 0.45, 0.3];
      const a = pat[inBar];
      if (a) this.drum(t, inBar % 4 === 0 ? 'drum' : 'tip', 0.13 * a * (this.rest ? 0.5 : 1), 1);
      if (inBar === 7 && this.rnd() < 0.5) this.drum(t + this.tickDur() / 2, 'tip', 0.04, 1.05);
      return;
    }
    // A light bodhran when a calm drive gets going.
    if (p.perc && e > 0.62 && x < 0.4 && !this.rest) {
      const v = 0.12 * smooth((e - 0.62) / 0.3);
      const pat = p.meter === '6/8' ? [1, 0, 0.35, 0.7, 0, 0.4] : p.meter === '3/4' ? [1, 0, 0.4, 0, 0.4, 0] : [1, 0, 0.35, 0, 0.75, 0, 0.35, 0.3];
      const a = pat[inBar];
      if (a) this.drum(t, a >= 0.7 ? 'drum' : 'tip', v * a, 1);
    }
  }

  // ---- Notes ----

  private pluck(t: number, midi: number, vel: number, bus: AudioNode, ring: number, inst: string) {
    const s = this.bank.pluck(midi);
    if (!s) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = s.rate;
    const g = c.createGain();
    g.gain.value = vel;
    const len = s.buf.duration / s.rate;
    if (ring < len) {
      g.gain.setValueAtTime(vel, t + ring);
      g.gain.setTargetAtTime(0, t + ring, 0.1);
    }
    src.connect(g).connect(bus);
    src.start(t);
    src.stop(t + Math.min(len, ring + 0.6));
    this.log?.push({ t, inst, midi, dur: ring, vel });
  }

  private ring(t: number, midi: number, vel: number, bus: AudioNode, inst: string) {
    const s = this.bank.bell(midi);
    if (!s) return;
    const src = this.ctx.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = s.rate;
    const g = this.ctx.createGain();
    g.gain.value = vel;
    src.connect(g).connect(bus);
    src.start(t);
    this.log?.push({ t, inst, midi, dur: s.buf.duration / s.rate, vel });
  }

  private drum(t: number, name: string, vel: number, rate: number, bus: AudioNode = this.percBus) {
    const b = this.bank.get(name);
    if (!b) return;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vel;
    src.connect(g).connect(bus);
    src.start(t);
    this.log?.push({ t, inst: name, midi: 0, dur: b.duration / rate, vel });
  }

  // ---- Composition ----

  private themeMelody(bars: [number, number][][], p: Piece, lead: Lead): Note[] {
    const shift = ((p.key - THEME_KEY + 18) % 12) - 6 + (lead === 'fiddle' ? -12 : 0);
    const out: Note[] = [];
    let at = 0;
    for (const bar of bars) for (const [m, len] of bar) {
      out.push({ at, len, midi: m + shift, vel: 0.85 });
      at += len;
    }
    this.ornament(out, p, lead);
    return out;
  }

  private genMelody(p: Piece, chords: Chord[], lead: Lead): Note[] {
    const r = this.rnd;
    const tpb = barTicks(p.meter), tps = tpb * p.slot;
    const off = lead === 'harp' ? -12 : lead === 'fiddle' ? -7 : 0;
    const lo = p.range[0] + off, hi = p.range[1] + off;
    const cells = p.cells ?? CELLS[p.meter];
    const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
    const slow = this.rest || r() < 0.5 - 0.35 * this.energy;
    const unitCell = (cad: boolean): number[] => {
      const bar = (c: boolean) => (c ? pick(cells.cad) : pick(slow ? cells.slow : cells.mid));
      return p.slot === 1 ? bar(cad) : [...bar(false), ...(cad ? pick(cells.cad) : pick(cells.slow))];
    };
    const cellA = unitCell(false);
    let cellB = unitCell(false);
    if (cellB.join() === cellA.join()) cellB = unitCell(false);
    const form = r() < 0.7;
    const rhythmA = form ? [cellA, cellB, cellA, unitCell(true)] : [cellA, cellA, cellB, unitCell(true)];
    const rhythmB = [cellA, r() < 0.65 ? cellB : unitCell(false), r() < 0.5 ? cellA : unitCell(false), unitCell(true)];

    const scaleOf = (c: Chord) => chordScale(p.mode, c).map((x) => (x + p.key) % 12);
    const tonesOf = (c: Chord) => c.tones.map((x) => (p.key + c.root + x) % 12);
    const mid = (lo + hi) / 2 - 1, span = (hi - lo) * 0.42;
    const notes: Note[] = [];
    let prev: number | null = null, prevIv = 0;

    const choose = (cands: number[], score: (m: number) => number) => {
      let tot = 0;
      const w = cands.map((m) => { const v = Math.exp(score(m) * 2); tot += v; return v; });
      let x = r() * tot;
      for (let i = 0; i < cands.length; i++) if ((x -= w[i]) <= 0) return cands[i];
      return cands[cands.length - 1];
    };

    const unit = (cell: number[], c: Chord, start: number, phrase: number, ui: number, cadence: 'open' | 'close' | null): Note[] => {
      const sc = scaleOf(c), ct = tonesOf(c);
      const cands: number[] = [];
      for (let m = lo; m <= hi; m++) if (sc.includes(m % 12)) cands.push(m);
      const out: Note[] = [];
      let o = 0;
      const sounding = cell.filter((d) => d > 0).length;
      let k = 0;
      for (const d of cell) {
        const len = Math.abs(d);
        if (d < 0) { o += len; continue; }
        const at = start + o;
        const inBar = (at % tps) % tpb;
        const wt = weight(p.meter, inBar);
        const strong = wt >= 2;
        const pos = (ui + o / tps) / 4;
        const target = mid + span * (Math.sin(Math.PI * Math.pow(pos, 0.85)) * (phrase ? 1.1 : 0.85) - 0.45);
        const last = k === sounding - 1;
        let m: number;
        if (cadence && last) {
          const home = cadence === 'close' ? [p.key % 12] : ct;
          const fin = cands.filter((x) => home.includes(x % 12));
          m = fin.reduce((a, b) => (Math.abs(b - (prev ?? target)) < Math.abs(a - (prev ?? target)) ? b : a), fin[0] ?? cands[0]);
          if (cadence === 'open') {
            const pref = fin.filter((x) => [(p.key + 2) % 12, (p.key + 7) % 12].includes(x % 12) && Math.abs(x - (prev ?? x)) <= 4);
            if (pref.length) m = pref[Math.floor(r() * pref.length)];
          }
        } else {
          m = choose(cands, (x) => {
            let v = 0;
            const isCt = ct.includes(x % 12);
            v += isCt ? [0.4, 1.1, 2.2, 3][wt] : [0, -0.5, -1.8, -2.5][wt];
            if (prev !== null) {
              const iv = x - prev, a = Math.abs(iv);
              v += a === 0 ? (prevIv === 0 ? -3 : -1.5) : a <= 2 ? 1.7 : a <= 4 ? 0.6 : a <= 7 ? -0.6 : a === 12 ? -1.8 : -3.5;
              if (Math.abs(prevIv) > 4 && Math.sign(iv) === Math.sign(prevIv)) v -= 1.6;
              if (Math.abs(prevIv) > 4 && Math.sign(iv) === -Math.sign(prevIv) && a <= 2) v += 1;
              if (prevIv !== 0 && iv === -prevIv && a > 2) v -= 1; // no ping-pong
            }
            v -= Math.abs(x - target) * 0.2;
            return v;
          });
        }
        out.push({ at, len, midi: m, vel: 0.72 + (strong ? 0.12 : 0) + ((m - lo) / Math.max(1, hi - lo)) * 0.12 });
        if (prev !== null) prevIv = m - prev;
        prev = m;
        k++;
        o += len;
      }
      // The note before a cadence steps into it.
      if (cadence && out.length >= 2) {
        const fin = out[out.length - 1], pn = out[out.length - 2];
        const above = cands.filter((x) => x > fin.midi && x - fin.midi <= 2);
        const below = cands.filter((x) => x < fin.midi && fin.midi - x <= 2);
        const nb = (r() < 0.65 ? above[0] ?? below[below.length - 1] : below[below.length - 1] ?? above[0]);
        if (nb !== undefined) pn.midi = nb;
        // If that leaves a big leap into the cadence, take the cadence to
        // the octave of the note before it.
        const pp = out[out.length - 3];
        if (pp && Math.abs(pn.midi - pp.midi) > 7) {
          const sh = pn.midi > pp.midi ? -12 : 12;
          if (Math.min(pn.midi, fin.midi) + sh >= lo && Math.max(pn.midi, fin.midi) + sh <= hi) {
            pn.midi += sh;
            fin.midi += sh;
            prev = fin.midi;
          }
        }
      }
      return out;
    };

    // A diatonic copy of a unit, moved to fit a new chord.
    const sequence = (src: Note[], from: Chord, to: Chord, start: number): Note[] | null => {
      const deg = (root: number) => {
        let bi = 0, bd = 12;
        p.mode.forEach((x, i) => { const d = Math.abs(x - root); if (d < bd) { bd = d; bi = i; } });
        return bi;
      };
      const d0 = (((deg(to.root) - deg(from.root)) % 7) + 7) % 7;
      const sc = scaleOf(to), ct = tonesOf(to);
      const step = (m: number, n: number) => {
        const all: number[] = [];
        for (let x = lo - 14; x <= hi + 14; x++) if (sc.includes(x % 12)) all.push(x);
        let i = all.findIndex((x) => x >= m);
        if (i < 0) i = all.length - 1;
        return all[Math.max(0, Math.min(all.length - 1, i + n))];
      };
      // Up or down to the new chord, whichever lands nearer the last note.
      let best: Note[] | null = null, bestLeap = 8;
      for (const d of [d0, d0 - 7]) {
        const out = src.map((n) => {
          let m = step(n.midi, d);
          const inBar = (n.at - src[0].at) % tpb;
          if (weight(p.meter, inBar) >= 2 && !ct.includes(m % 12)) {
            const near = [m - 1, m + 1, m - 2, m + 2].find((x) => ct.includes(x % 12));
            if (near !== undefined) m = near;
          }
          return { ...n, at: n.at - src[0].at + start, midi: m };
        });
        const leap = prev === null ? 0 : Math.abs(out[0].midi - prev);
        if (out.every((n) => n.midi >= lo && n.midi <= hi) && leap < bestLeap) { best = out; bestLeap = leap; }
      }
      return best;
    };

    // Phrase A: motif, answer, motif again (sequenced), half cadence.
    const unitsA: Note[][] = [];
    for (let u = 0; u < 4; u++) {
      const c = chords[u], start = u * tps;
      if (u === 2 && rhythmA[2] === cellA) {
        const sq = sequence(unitsA[0], chords[0], c, start);
        if (sq) { unitsA.push(sq); prev = sq[sq.length - 1].midi; continue; }
      }
      if (u === 0 && p.theme === undefined && r() < 0.2 && c.root === 0) {
        // Borrow the theme's opening gesture (5-1-2) now and then.
        unitsA.push(this.motifUnit(p, cellA, start, lo, hi) ?? unit(cellA, c, start, 0, u, null));
        prev = unitsA[0][unitsA[0].length - 1].midi;
        continue;
      }
      unitsA.push(unit(rhythmA[u], c, start, 0, u, u === 3 ? 'open' : null));
    }
    // Phrase B: the opening returns, then a new close home.
    const unitsB: Note[][] = [];
    for (let u = 0; u < 4; u++) {
      const c = chords[4 + u], start = (4 + u) * tps;
      if (u < 2 && rhythmB[u] === rhythmA[u]) {
        const sq = sequence(unitsA[u], chords[u], c, start);
        if (sq) { unitsB.push(sq); prev = sq[sq.length - 1].midi; continue; }
      }
      unitsB.push(unit(rhythmB[u], c, start, 1, u, u === 3 ? 'close' : null));
    }
    for (const u of [...unitsA, ...unitsB]) notes.push(...u);
    this.ornament(notes, p, lead);
    return notes;
  }

  // The theme's first gesture (the fifth below, the tonic, the second)
  // fitted to the start of a phrase.
  private motifUnit(p: Piece, cell: number[], start: number, lo: number, hi: number): Note[] | null {
    if (cell.filter((d) => d > 0).length !== 3) return null;
    let t = 60 + p.key;
    while (t < lo + 5) t += 12;
    while (t > hi - 2) t -= 12;
    const pitches = [t - 5, t, t + p.mode[1]];
    if (pitches[0] < lo) return null;
    const out: Note[] = [];
    let o = 0, k = 0;
    for (const d of cell) {
      if (d > 0) out.push({ at: start + o, len: d, midi: pitches[k++], vel: 0.82 });
      o += Math.abs(d);
    }
    return out;
  }

  // Long held notes under the tune: the chord's third or seventh, moving
  // by step where it can (a second fiddle's guide tones).
  private genCounter(p: Piece, chords: Chord[], mel: Note[]): Note[] {
    const tps = barTicks(p.meter) * p.slot;
    const out: Note[] = [];
    let prev = 64;
    chords.forEach((c, i) => {
      const tones = c.tones.map((x) => (p.key + c.root + x) % 12);
      const melNow = mel.find((n) => n.at <= i * tps && n.at + n.len > i * tps);
      const cands: number[] = [];
      for (let m = 60; m <= 74; m++) if (tones.includes(m % 12) && (!melNow || melNow.midi % 12 !== m % 12)) cands.push(m);
      if (!cands.length) return;
      cands.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev) + ((b % 12 === tones[1] ? 1 : 0) - (a % 12 === tones[1] ? 1 : 0)) * 1.5);
      const m = cands[0];
      const end = i % 4 === 3;
      out.push({ at: i * tps, len: end ? Math.max(2, tps - 2) : tps, midi: m, vel: 0.6, slur: i % 4 !== 0 });
      prev = m;
    });
    return out;
  }

  // Tin whistle ornaments: cuts to separate repeated notes, the odd roll,
  // slides up into a leap; and legato slurs on stepwise runs.
  private ornament(notes: Note[], p: Piece, lead: Lead) {
    if (lead === 'harp' || lead === 'bell') return;
    const r = this.rnd, d = p.orn;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i], pv = notes[i - 1];
      const joined = pv && pv.at + pv.len === n.at;
      const iv = pv ? n.midi - pv.midi : 0;
      if (lead === 'whistle') {
        if (pv && iv === 0 && joined) n.orn = 'cut';
        else if (n.len >= 3 && r() < 0.14 * d) n.orn = r() < 0.4 ? 'roll' : 'cut';
        else if (iv >= 3 && n.len >= 2 && r() < 0.25 * d) n.orn = 'slide';
      } else if (iv >= 3 && n.len >= 2 && r() < 0.3 * d) n.orn = 'slide';
      if (joined && !n.orn && Math.abs(iv) <= 2 && iv !== 0 && r() < 0.45) n.slur = true;
    }
  }

  // ---- Stingers ----

  // A short phrase over the bed (which the mixer ducks). Played in the
  // current key, always ending on a major chord (a Picardy third in the
  // minor-key regions). Returns its length in seconds.
  // `amt` (0..1) is how well it went, for the trial gate cue.
  stinger(kind: StingerKind, t: number, amt = 1): number {
    const key = PIECES[this.want].key; // the key the bed is heading for
    // Tonic somewhere in G4..F#5, so the whistle stays sweet, not shrill.
    const T = 67 + ((key - 67 + 120) % 12);
    const deg = (d: number, oct = 0) => T + 12 * oct + MAJOR[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const bass = T - 24;
    const out = this.stingOut;
    const roll = (at: number, degs: number[], oct: number, vel: number, gap = 0.045) =>
      degs.forEach((d, i) => this.pluck(t + at + i * gap, deg(d, oct), vel * (1 - i * 0.06), out, 2.2, 'sting-harp'));
    switch (kind) {
      case 'calm':
        this.pluck(t, bass, 0.3, out, 2.4, 'sting-bass');
        roll(0, [0, 4, 7, 9, 11, 14], -1, 0.2);
        this.swell(t, [0, 4, 7], key, 2.6);
        this.blow(t + 0.05, deg(4), 0.16, 0.8);
        this.blow(t + 0.22, deg(5), 0.16, 0.8);
        this.blow(t + 0.39, deg(7), 1.3, 0.95);
        this.ring(t + 0.39, deg(7, 1), 0.1, out, 'sting-bell');
        return 2.6;
      case 'steady':
        roll(0, [0, 2, 4, 7], -1, 0.17, 0.06);
        this.ring(t + 0.25, deg(4), 0.09, out, 'sting-bell');
        this.ring(t + 0.5, deg(7), 0.09, out, 'sting-bell');
        return 1.6;
      case 'rattled':
        this.pluck(t, deg(4, -1), 0.13, out, 1.2, 'sting-harp');
        this.pluck(t + 0.25, deg(0, -1), 0.12, out, 1.4, 'sting-harp');
        return 0.9;
      case 'tierup': {
        [0, 0.1, 0.2].forEach((x) => this.drum(t + x, 'tip', 0.25, 1, out));
        this.drum(t + 0.3, 'drum', 0.5, 1, out);
        for (let i = 0; i < 8; i++) this.blow(t + 0.3 + i * 0.07, deg(i), 0.09, 0.65 + i * 0.03);
        this.blow(t + 0.86, deg(7), 1.6, 1);
        this.blow(t + 0.86, deg(4), 1.6, 0.55);
        this.pluck(t + 0.86, bass, 0.34, out, 2.6, 'sting-bass');
        roll(0.86, [0, 4, 7, 11, 14, 16], -1, 0.22, 0.035);
        this.ring(t + 0.86, deg(7, 1), 0.12, out, 'sting-bell');
        this.ring(t + 1.1, deg(11, 1), 0.09, out, 'sting-bell');
        this.swell(t + 0.3, [0, 4, 7], key, 3);
        return 3.4;
      }
      case 'summary':
        // IV, V, home: the theme's last bar in this key.
        this.swell(t, [5, 9, 12], key, 0.85);
        this.swell(t + 0.8, [7, 11, 14], key, 0.5);
        this.swell(t + 1.25, [0, 4, 7], key, 2.6);
        roll(0, [3, 5, 7], -1, 0.15, 0.06);
        roll(1.25, [0, 4, 7, 9], -1, 0.16, 0.06);
        this.pluck(t + 1.25, bass, 0.3, out, 2.6, 'sting-bass');
        this.blow(t + 0.05, deg(3), 0.38, 0.75);
        this.blow(t + 0.45, deg(2), 0.38, 0.75);
        this.blow(t + 0.85, deg(1), 0.38, 0.8);
        this.blow(t + 1.25, deg(0), 1.6, 0.9);
        return 3.8;
      case 'gate':
        // Through a trial gate: a quick rising figure, fuller for a clean
        // gate (all of them through) than a ragged one.
        if (amt >= 0.99) {
          this.blow(t, deg(4), 0.08, 0.7);
          this.blow(t + 0.08, deg(5), 0.08, 0.75);
          this.blow(t + 0.16, deg(7), 0.45, 0.85);
          this.ring(t + 0.16, deg(7, 1), 0.08, out, 'sting-bell');
          this.pluck(t + 0.16, deg(0, -1), 0.16, out, 1.2, 'sting-harp');
          return 0.7;
        }
        this.blow(t, deg(4), 0.1, 0.55);
        this.blow(t + 0.1, deg(amt >= 0.5 ? 7 : 5), 0.3, 0.6);
        return 0.5;
      case 'sour': {
        // A bolt or a grip: two notes a semitone apart, sagging flat.
        const c = this.ctx;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1600;
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.03, t + 0.03);
        g.gain.setTargetAtTime(0, t + 0.3, 0.08);
        lp.connect(g).connect(out);
        for (const m of [deg(4, -1), deg(4, -1) + 1]) {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(mtof(m), t);
          o.frequency.exponentialRampToValueAtTime(mtof(m - 1), t + 0.4);
          o.connect(lp);
          o.start(t);
          o.stop(t + 0.7);
        }
        this.pluck(t, bass + 1, 0.18, out, 0.6, 'sting-bass');
        return 0.6;
      }
      case 'sold':
        // An order filled: coins tumbling in and a bright "ta-da".
        [0, 2, 4, 7, 9].forEach((d, i) => this.ring(t + i * 0.05, deg(d, 1), 0.07 * (1 - i * 0.1), out, 'sting-bell'));
        roll(0.25, [0, 4, 7, 9], -1, 0.17, 0.04);
        this.blow(t + 0.25, deg(4), 0.12, 0.75);
        this.blow(t + 0.4, deg(7), 0.8, 0.9);
        this.swell(t + 0.25, [0, 4, 7], key, 1.8);
        return 2;
      case 'missed':
        // The buyer gave up: a gentle sigh down to the tonic, in minor.
        this.pluck(t, bass, 0.22, out, 2, 'sting-bass');
        this.pluck(t + 0.08, deg(0, -1), 0.12, out, 2, 'sting-harp');
        this.pluck(t + 0.16, deg(2, -1) - 1, 0.11, out, 2, 'sting-harp');
        this.blow(t + 0.05, deg(4), 0.3, 0.6);
        this.blow(t + 0.38, deg(3), 0.3, 0.55);
        this.blow(t + 0.71, deg(2) - 1, 0.35, 0.55);
        this.blow(t + 1.08, deg(0), 0.8, 0.5);
        return 1.9;
    }
  }

  // A one-off whistle note for stingers (the lead voice may be busy).
  private blow(t: number, midi: number, dur: number, vel: number) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.setPeriodicWave(this.stingWave);
    o.frequency.value = mtof(midi);
    const g = c.createGain();
    const peak = 0.075 * vel;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.setTargetAtTime(peak * 0.8, t + 0.02, 0.2);
    g.gain.setTargetAtTime(0, t + Math.max(0.05, dur - 0.05), 0.03);
    if (dur > 0.5) {
      const lfo = c.createOscillator();
      lfo.frequency.value = 5.3;
      const lg = c.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(12, t + 0.5);
      lfo.connect(lg).connect(o.detune);
      lfo.start(t);
      lfo.stop(t + dur + 0.3);
    }
    o.connect(g).connect(this.stingOut);
    o.start(t);
    o.stop(t + dur + 0.3);
    this.log?.push({ t, inst: 'sting-whistle', midi, dur, vel });
  }

  // A string chord that blooms and fades (stingers).
  private swell(t: number, degs: number[], key: number, dur: number) {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.022, t + Math.min(0.3, dur * 0.3));
    g.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.18);
    lp.connect(g).connect(this.stingOut);
    for (const d of degs) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(55 + ((key + d - 55 + 120) % 12));
      o.connect(lp);
      o.start(t);
      o.stop(t + dur * 1.5);
    }
  }
}
