// The sample bank: every buffer the music and soundscape play is computed
// here in code when audio starts (plucked strings, bells, drums, hooves,
// the river, a flock's murmur, a reverb). No audio files. Buffers are built
// a few at a time from the game loop so starting audio never stalls a frame.

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Rand = () => number;
type Gen = (ctx: BaseAudioContext) => AudioBuffer;

export interface Sample {
  buf: AudioBuffer;
  rate: number; // playbackRate that lands on the asked-for pitch
}

// Pitched sample sets are rendered every few semitones and repitched by at
// most two semitones, which keeps the timbre honest.
const PLUCK_BASES = [40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88];
const BELL_BASES = [60, 66, 72, 78, 84, 90, 96];

export class Bank {
  private bufs = new Map<string, AudioBuffer>();
  private queue: [string, Gen][] = [];
  private freqs = new Map<string, number>();
  private rnd: Rand;

  constructor(private ctx: BaseAudioContext, rnd: Rand = Math.random) {
    this.rnd = rnd;
    const r = () => this.rnd();
    // Order is priority: what the first seconds of play need comes first.
    this.add('noise', (c) => noiseBuf(c, 3, 2, r));
    this.add('ir', (c) => impulse(c, 1.5, 1.4, r));
    for (const m of [52, 56, 60, 64, 68, 72, 76, 80, 48, 44, 40, 84, 88]) {
      this.add(`pluck${m}`, (c) => {
        const t60 = 3.4 - (m - 40) * 0.042;
        const { buf, freq } = pluck(c, m, t60, Math.min(2.8, t60 * 0.85), r);
        this.freqs.set(`pluck${m}`, freq);
        return buf;
      });
    }
    this.add('step-dog', (c) => hit(c, { dur: 0.09, nAmp: 0.5, nDecay: 0.02, lo: 900, hi: 3200, tAmp: 0.25, f0: 110, f1: 70, tDecay: 0.02 }, r));
    this.add('step-dog-run', (c) => hit(c, { dur: 0.12, nAmp: 0.55, nDecay: 0.03, lo: 600, hi: 2600, tAmp: 0.55, f0: 120, f1: 60, tDecay: 0.035 }, r));
    this.add('step-duck', (c) => hit(c, { dur: 0.07, nAmp: 0.35, nDecay: 0.012, lo: 500, hi: 1600, tAmp: 0.5, f0: 520, f1: 260, tDecay: 0.012 }, r));
    this.add('step-sheep', (c) => hit(c, { dur: 0.08, nAmp: 0.55, nDecay: 0.014, lo: 1400, hi: 4200, tAmp: 0.3, f0: 190, f1: 120, tDecay: 0.015 }, r));
    this.add('step-goat', (c) => hit(c, { dur: 0.08, nAmp: 0.5, nDecay: 0.008, lo: 2500, hi: 6000, tAmp: 0.5, f0: 1500, f1: 900, tDecay: 0.006, t2: 0.3, t2f: 230 }, r));
    this.add('step-cow', (c) => hit(c, { dur: 0.2, nAmp: 0.35, nDecay: 0.05, lo: 200, hi: 900, tAmp: 1, f0: 80, f1: 42, tDecay: 0.07 }, r));
    this.add('step-pony', (c) => hit(c, { dur: 0.1, nAmp: 0.3, nDecay: 0.01, lo: 1500, hi: 5000, tAmp: 0.7, f0: 560, f1: 470, tDecay: 0.03, t2: 0.45, t2f: 1250 }, r));
    this.add('splash', (c) => splash(c, r));
    this.add('drum', (c) => drum(c, 125, 62, 0.32, 0.5, 700, 0.6, r));
    this.add('tip', (c) => drum(c, 240, 170, 0.09, 0.8, 2600, 0.25, r));
    for (const m of BELL_BASES) {
      this.add(`bell${m}`, (c) => bell(c, m));
      this.freqs.set(`bell${m}`, mtof(m));
    }
    // The river is the biggest buffer: one channel per job.
    this.add('river~', (c) => river(c.createBuffer(2, Math.floor(4 * c.sampleRate), c.sampleRate), 0, r));
    this.add('river', () => {
      const b = this.bufs.get('river~')!;
      this.bufs.delete('river~');
      return river(b, 1, r);
    });
    this.add('murmur', (c) => murmur(c, 6, r));
    this.add('munch', (c) => munch(c, 5, r));
    this.add('bird1', (c) => birdChirp(c, r));
    this.add('bird2', (c) => birdTrill(c, r));
    this.add('bird3', (c) => birdCall(c, r));
    this.add('cricket', (c) => cricket(c));
    this.add('frog', (c) => frog(c, r));
    this.add('owl', (c) => owl(c));
    this.add('drip', (c) => hit(c, { dur: 0.05, nAmp: 0.2, nDecay: 0.004, lo: 2500, hi: 7000, tAmp: 0.5, f0: 1900, f1: 2900, tDecay: 0.01 }, r));
  }

  private add(name: string, gen: Gen) {
    this.queue.push([name, gen]);
  }

  // Build queued buffers until the time budget is spent.
  pump(budgetMs = 4) {
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budgetMs) {
      const [name, gen] = this.queue.shift()!;
      this.bufs.set(name, gen(this.ctx));
    }
  }

  generateAll() {
    while (this.queue.length) this.pump(1e9);
  }

  get pending() {
    return this.queue.length;
  }

  get(name: string): AudioBuffer | undefined {
    return this.bufs.get(name);
  }

  private pitched(prefix: string, bases: number[], midi: number): Sample | null {
    let best: string | null = null, bd = 1e9;
    for (const m of bases) {
      const name = prefix + m;
      if (!this.bufs.has(name)) continue;
      const d = Math.abs(m - midi) + (m > midi ? 0.1 : 0);
      if (d < bd) { bd = d; best = name; }
    }
    if (!best) return null;
    return { buf: this.bufs.get(best)!, rate: mtof(midi) / this.freqs.get(best)! };
  }

  pluck(midi: number) {
    return this.pitched('pluck', PLUCK_BASES, midi);
  }

  bell(midi: number) {
    return this.pitched('bell', BELL_BASES, midi);
  }
}

// ---- DSP helpers (plain JS, run once per buffer) ----

interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

function bq(type: 'lp' | 'hp' | 'bp', f: number, q: number, sr: number): Biquad {
  const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
  const cw = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cw) / a0, a2: (1 - al) / a0 };
}

// Filter in place.
function filt(x: Float32Array, c: Biquad) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const y = c.b0 * v + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    x[i] = y;
  }
}

// For looping buffers: warm the filter on the tail first, so the state at
// the start matches the end and the loop is seamless.
function filtLoop(x: Float32Array, c: Biquad) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const n = x.length, warm = Math.min(n, 4096);
  for (let i = n - warm; i < n; i++) {
    const v = x[i];
    const y = c.b0 * v + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
  }
  for (let i = 0; i < n; i++) {
    const v = x[i];
    const y = c.b0 * v + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    x[i] = y;
  }
}

function normalize(x: Float32Array, peak: number) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) {
    const k = peak / m;
    for (let i = 0; i < x.length; i++) x[i] *= k;
  }
}

function fadeEdges(x: Float32Array, sr: number, inS: number, outS: number) {
  const a = Math.floor(inS * sr), b = Math.floor(outS * sr), n = x.length;
  for (let i = 0; i < a && i < n; i++) x[i] *= i / a;
  for (let i = 0; i < b && i < n; i++) x[n - 1 - i] *= i / b;
}

function mono(ctx: BaseAudioContext, secs: number): [AudioBuffer, Float32Array] {
  const b = ctx.createBuffer(1, Math.max(1, Math.floor(secs * ctx.sampleRate)), ctx.sampleRate);
  return [b, b.getChannelData(0)];
}

// ---- Generators ----

function noiseBuf(ctx: BaseAudioContext, secs: number, ch: number, r: Rand) {
  const b = ctx.createBuffer(ch, Math.floor(secs * ctx.sampleRate), ctx.sampleRate);
  for (let c = 0; c < ch; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  }
  return b;
}

// An open-air reverb tail: decaying noise that darkens as it fades, with a
// few early reflections. Mono, which halves the convolver's cost; the music
// spreads it into stereo with a short offset on one side.
function impulse(ctx: BaseAudioContext, secs: number, t60: number, r: Rand) {
  const sr = ctx.sampleRate;
  const [b, d] = mono(ctx, secs);
  const pre = Math.floor(0.012 * sr);
  let lp = 0;
  for (let i = pre; i < d.length; i++) {
    const t = (i - pre) / sr;
    const env = Math.exp((-6.9 * t) / t60);
    const a = 0.75 - 0.6 * Math.min(1, t / secs); // darker as it decays
    lp += a * ((r() * 2 - 1) - lp);
    d[i] = lp * env;
  }
  for (const [ms, g] of [[9, 0.5], [17, -0.35], [23, 0.3], [31, -0.22], [43, 0.16]]) {
    const i = pre + Math.floor((ms / 1000) * sr);
    if (i < d.length) d[i] += g;
  }
  fadeEdges(d, sr, 0.001, 0.2);
  // Unit energy so the wet level is predictable.
  let e = 0;
  for (const v of d) e += v * v;
  const k = 0.6 / Math.sqrt(e);
  for (let i = 0; i < d.length; i++) d[i] *= k;
  return b;
}

// Karplus-Strong plucked string: a harp / guitar / pizzicato fiddle.
// Returns the true pitch of the loop so callers can repitch exactly.
function pluck(ctx: BaseAudioContext, midi: number, t60: number, dur: number, r: Rand) {
  const sr = ctx.sampleRate;
  const f = mtof(midi);
  const N = Math.max(2, Math.round(sr / f - 0.5));
  const freq = sr / (N + 0.5); // the two-tap average adds half a sample
  const [buf, out] = mono(ctx, dur);
  // Excitation: soft noise burst, plucked a fifth of the way along.
  const ex = new Float32Array(N);
  let lp = 0, mean = 0;
  const bright = midi < 52 ? 0.35 : midi < 70 ? 0.5 : 0.65;
  for (let i = 0; i < N; i++) {
    lp += bright * ((r() * 2 - 1) - lp);
    ex[i] = lp;
    mean += lp;
  }
  mean /= N;
  const P = Math.max(1, Math.round(N / 5));
  const ex2 = new Float32Array(N);
  for (let i = 0; i < N; i++) ex2[i] = ex[i] - mean - (i >= P ? ex[i - P] - mean : 0) * 0.8;
  const rho = Math.pow(10, -3 / (freq * t60));
  for (let n = 0; n < out.length; n++) {
    let v = n < N ? ex2[n] : 0;
    if (n >= N) v += rho * 0.5 * (out[n - N] + (n - N - 1 >= 0 ? out[n - N - 1] : 0));
    out[n] = v;
  }
  // Mellow the upper partials of low strings; a little body warmth.
  filt(out, bq('lp', Math.min(7000, f * (midi < 55 ? 7 : 10)), 0.6, sr));
  filt(out, bq('hp', 50, 0.7, sr));
  fadeEdges(out, sr, 0.0015, Math.min(0.4, dur * 0.25));
  normalize(out, 0.8);
  return { buf, freq };
}

// Soft celesta / music-box bell: a few partials, the upper ones die fast.
function bell(ctx: BaseAudioContext, midi: number) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, 2.2);
  const f = mtof(midi);
  const parts: [number, number, number][] = [[1, 1, 1.9], [2.0, 0.32, 0.7], [3.0, 0.12, 0.35], [4.16, 0.07, 0.18], [5.43, 0.03, 0.1]];
  for (const [ratio, amp, dec] of parts) {
    const w = (2 * Math.PI * f * ratio) / sr;
    if (f * ratio > sr * 0.45) continue;
    const k = 2 * Math.cos(w);
    let s1 = Math.sin(-w), s2 = Math.sin(-2 * w);
    const dk = Math.exp(-1 / (dec * sr));
    let e = amp;
    for (let i = 0; i < out.length; i++) {
      const s = k * s1 - s2;
      s2 = s1; s1 = s;
      out[i] += s * e;
      e *= dk;
    }
  }
  fadeEdges(out, sr, 0.003, 0.3);
  normalize(out, 0.8);
  return buf;
}

// Frame drum (bodhran): a pitched thump that drops, plus a skin slap.
function drum(ctx: BaseAudioContext, f0: number, f1: number, decay: number, nAmt: number, nLp: number, dur: number, r: Rand) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, dur);
  let ph = 0, lp = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.04);
    ph += (2 * Math.PI * f) / sr;
    const n = r() * 2 - 1;
    lp += Math.min(1, (2 * Math.PI * nLp) / sr) * (n - lp);
    out[i] = Math.sin(ph) * Math.exp(-t / decay) + lp * nAmt * Math.exp(-t / 0.018);
  }
  fadeEdges(out, sr, 0.001, 0.05);
  normalize(out, 0.85);
  return buf;
}

interface HitOpts {
  dur: number;
  nAmp: number; nDecay: number; lo: number; hi: number; // band of noise
  tAmp: number; f0: number; f1: number; tDecay: number; // falling knock
  t2?: number; t2f?: number; // a second fixed resonance (hollow clop)
}

// A footfall or knock: band-limited noise plus a short falling tone.
function hit(ctx: BaseAudioContext, o: HitOpts, r: Rand) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, o.dur);
  const nz = new Float32Array(out.length);
  for (let i = 0; i < nz.length; i++) nz[i] = (r() * 2 - 1) * Math.exp(-i / sr / o.nDecay);
  filt(nz, bq('hp', o.lo, 0.7, sr));
  filt(nz, bq('lp', o.hi, 0.7, sr));
  let ph = 0, ph2 = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const f = o.f1 + (o.f0 - o.f1) * Math.exp(-t / (o.tDecay * 0.7));
    ph += (2 * Math.PI * f) / sr;
    let v = nz[i] * o.nAmp + Math.sin(ph) * o.tAmp * Math.exp(-t / o.tDecay);
    if (o.t2 && o.t2f) {
      ph2 += (2 * Math.PI * o.t2f) / sr;
      v += Math.sin(ph2) * o.t2 * Math.exp(-t / (o.tDecay * 0.8));
    }
    out[i] = v;
  }
  fadeEdges(out, sr, 0.0008, o.dur * 0.3);
  normalize(out, 0.8);
  return buf;
}

function splash(ctx: BaseAudioContext, r: Rand) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, 0.3);
  for (let i = 0; i < out.length; i++) out[i] = (r() * 2 - 1) * Math.exp(-i / sr / 0.07);
  filt(out, bq('lp', 2200, 0.8, sr));
  filt(out, bq('hp', 300, 0.7, sr));
  addBubbles(out, sr, 6, 600, 1500, 0.25, r, false);
  fadeEdges(out, sr, 0.002, 0.08);
  normalize(out, 0.8);
  return buf;
}

// Water bubbles: tiny sines that rise in pitch as they die away.
function addBubbles(out: Float32Array, sr: number, count: number, fLo: number, fHi: number, amp: number, r: Rand, wrap: boolean) {
  const n = out.length;
  for (let b = 0; b < count; b++) {
    const start = Math.floor(r() * n);
    const f0 = fLo * Math.pow(fHi / fLo, r());
    const dec = 0.004 + 0.014 * r() * (600 / f0);
    const len = Math.floor(dec * 4 * sr);
    const a = amp * (0.3 + 0.7 * r());
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * f0 * (1 + (t / dec) * 0.25)) / sr;
      let j = start + i;
      if (j >= n) { if (!wrap) break; j -= n; }
      out[j] += Math.sin(ph) * a * Math.exp(-t / dec) * Math.min(1, i / 20);
    }
  }
}

// A seamless loop of a stream running over stones: low rush, mid hiss,
// slow swells, and a constant scatter of bubbles. Fills one channel.
function river(b: AudioBuffer, c: number, r: Rand) {
  const sr = b.sampleRate, n = b.length, secs = n / sr;
  const d = b.getChannelData(c);
  const lo = new Float32Array(n), hi = new Float32Array(n);
  for (let i = 0; i < n; i++) { lo[i] = r() * 2 - 1; hi[i] = r() * 2 - 1; }
  filtLoop(lo, bq('lp', 380, 0.7, sr));
  filtLoop(hi, bq('bp', 1700 + c * 200, 0.6, sr));
  let sw = 1;
  for (let i = 0; i < n; i++) {
    if ((i & 63) === 0) {
      const p = i / n; // whole cycles per loop keep the swell seamless
      sw = 0.75 + 0.15 * Math.sin(2 * Math.PI * (3 * p + c * 0.3)) + 0.1 * Math.sin(2 * Math.PI * (7 * p + 0.6));
    }
    d[i] = lo[i] * 0.9 + hi[i] * 0.55 * sw;
  }
  addBubbles(d, sr, Math.floor(secs * 26), 350, 1800, 0.06, r, true);
  normalize(d, 0.7);
  return b;
}

// A flock's murmur: several soft voices humming on and off, each a short
// vowel with a slight pitch fall. Repitched and filtered per species.
function murmur(ctx: BaseAudioContext, secs: number, r: Rand) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, secs);
  const n = out.length;
  // One cycle of a soft "mmm-aah" vowel as a wavetable.
  const T = 1024, tab = new Float32Array(T);
  const amps = [1, 0.7, 0.45, 0.32, 0.2, 0.12, 0.07];
  for (let i = 0; i < T; i++) {
    let v = 0;
    amps.forEach((a, h) => (v += a * Math.sin((2 * Math.PI * (h + 1) * i) / T)));
    tab[i] = v / 2.4;
  }
  const hums = Math.floor(secs * 3.2);
  for (let k = 0; k < hums; k++) {
    const start = Math.floor(r() * n);
    const dur = 0.25 + r() * 0.6;
    const len = Math.floor(dur * sr);
    const f = 200 * Math.pow(2, (r() - 0.5) * 0.6);
    const a = 0.25 + 0.75 * r();
    let ph = r() * T;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.sin(Math.PI * t) * Math.sin(Math.PI * t) * a;
      ph += (T * f * (1 - 0.08 * t)) / sr;
      out[(start + i) % n] += tab[Math.floor(ph) & (T - 1)] * env;
    }
  }
  filtLoop(out, bq('lp', 1800, 0.7, sr));
  normalize(out, 0.7);
  return buf;
}

// Grazing: grass being torn and chewed, in little crackly bursts.
function munch(ctx: BaseAudioContext, secs: number, r: Rand) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, secs);
  const n = out.length;
  const bursts = Math.floor(secs * 3);
  for (let k = 0; k < bursts; k++) {
    const start = Math.floor(r() * n);
    const clicks = 3 + Math.floor(r() * 6);
    const a = 0.3 + 0.7 * r();
    for (let c = 0; c < clicks; c++) {
      const at = start + Math.floor((c / clicks) * (0.06 + r() * 0.1) * sr);
      const len = Math.floor((0.002 + r() * 0.004) * sr);
      for (let i = 0; i < len; i++) out[(at + i) % n] += (r() * 2 - 1) * a * (1 - i / len);
    }
  }
  filtLoop(out, bq('hp', 1200, 0.7, sr));
  filtLoop(out, bq('lp', 6000, 0.7, sr));
  normalize(out, 0.7);
  return buf;
}

// Sine sweep helper for birdsong.
function sweep(out: Float32Array, sr: number, at: number, dur: number, f0: number, f1: number, amp: number, vib = 0, vibF = 0) {
  const s = Math.floor(at * sr), len = Math.floor(dur * sr);
  let ph = 0;
  for (let i = 0; i < len && s + i < out.length; i++) {
    const t = i / len;
    const f = f0 + (f1 - f0) * t + (vib ? Math.sin(2 * Math.PI * vibF * (i / sr)) * vib : 0);
    ph += (2 * Math.PI * f) / sr;
    out[s + i] += Math.sin(ph) * amp * Math.sin(Math.PI * t);
  }
}

function birdChirp(ctx: BaseAudioContext, r: Rand) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, 0.35);
  sweep(out, sr, 0, 0.08, 2400 + r() * 300, 3300 + r() * 300, 0.8);
  sweep(out, sr, 0.11, 0.09, 3000 + r() * 200, 2200, 0.7);
  normalize(out, 0.7);
  return buf;
}

function birdTrill(ctx: BaseAudioContext, r: Rand) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, 0.7);
  const base = 3200 + r() * 400;
  for (let i = 0; i < 7; i++) sweep(out, sr, i * 0.075, 0.06, base + 300, base - 200 - i * 40, 0.6 + 0.05 * i);
  normalize(out, 0.7);
  return buf;
}

// "Tee-oo": a meadowlark-ish falling whistle.
function birdCall(ctx: BaseAudioContext, r: Rand) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, 0.8);
  const f = 2600 + r() * 300;
  sweep(out, sr, 0, 0.22, f, f * 1.06, 0.7, 30, 30);
  sweep(out, sr, 0.28, 0.35, f * 0.84, f * 0.7, 0.6, 20, 25);
  normalize(out, 0.7);
  return buf;
}

function cricket(ctx: BaseAudioContext) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, 0.2);
  for (let p = 0; p < 4; p++) {
    const s = Math.floor(p * 0.042 * sr), len = Math.floor(0.022 * sr);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      out[s + i] += Math.sin((2 * Math.PI * 4400 * i) / sr) * Math.sin(Math.PI * t) * (1 - p * 0.12);
    }
  }
  normalize(out, 0.7);
  return buf;
}

// A frog's croak: a fast train of resonant clicks.
function frog(ctx: BaseAudioContext, r: Rand) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, 0.4);
  const rate = 22 + r() * 8;
  const pulses = Math.floor(0.28 * rate);
  for (let p = 0; p < pulses; p++) {
    const s = Math.floor((p / rate) * sr);
    const len = Math.floor(0.03 * sr);
    const a = Math.sin((Math.PI * (p + 0.5)) / pulses);
    for (let i = 0; i < len && s + i < out.length; i++) out[s + i] += Math.sin((2 * Math.PI * 520 * i) / sr) * Math.exp(-i / sr / 0.006) * a;
  }
  filt(out, bq('bp', 650, 2, sr));
  normalize(out, 0.7);
  return buf;
}

function owl(ctx: BaseAudioContext) {
  const sr = ctx.sampleRate;
  const [buf, out] = mono(ctx, 1.5);
  const hoot = (at: number, dur: number, f: number, a: number) => {
    const s = Math.floor(at * sr), len = Math.floor(dur * sr);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.min(1, t * 6) * Math.pow(1 - t, 1.5);
      out[s + i] += Math.sin((2 * Math.PI * f * (1 - 0.04 * t) * i) / sr) * env * a;
    }
  };
  hoot(0, 0.32, 390, 1);
  hoot(0.55, 0.16, 370, 0.7);
  hoot(0.8, 0.45, 375, 0.85);
  filt(out, bq('lp', 900, 0.7, sr));
  normalize(out, 0.7);
  return buf;
}
