// Every sound is synthesised with Web Audio: no audio files.
//
// Mixer:  sfx ─────────────┐
//         ambience → sfx   ├→ master (mute) → limiter → speakers
//         music → duck ────┤
//         stingers ────────┘
// Music and sound volumes are separate and remembered; stingers duck the
// music bed; a limiter at the end means nothing ever clips.

import type { Game } from '../game';
import { FORD_Y0, FORD_Y1, RIVER_SPRING_Y, TS, riverX } from '../world/map';
import { Bank } from './synth';
import { Music, type MusicState, type PieceId, type StingerKind } from './music';
import { Ambience, type AmbState, type HerdVoice } from './soundscape';
import { PARTS, type Run, type TrialResult } from './trials';

type Wave = OscillatorType;
export type VolumeAction = `${'music' | 'sound'}${'-' | '+' | '~'}`;

// The Show Ground (sheepdog trials) borrows the hills' calm waltz.
const REGION_PIECE: Record<string, PieceId> = { ranch: 'ranch', meadow: 'meadow', hills: 'hills', rocky: 'rocky', ford: 'ford', high: 'high', show: 'hills' };
const WIND: Record<string, number> = { high: 1, rocky: 0.75, hills: 0.6, meadow: 0.45, ford: 0.4, ranch: 0.35 };
const STRIDE: Record<string, number> = { duck: 3, sheep: 6, goat: 6, cow: 9, pony: 10 };
// Perceptual volume curve for the 0..10 sliders.
const curve = (level: number) => (level / 10) ** 2;

export class Sound {
  ctx: BaseAudioContext | null = null;
  private live: AudioContext | null = null;
  bank!: Bank;
  music!: Music;
  ambience!: Ambience;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private duck!: GainNode;
  private sting!: GainNode;
  private pans: StereoPannerNode[] = [];
  muted = false;
  musicLevel = 7;
  soundLevel = 8;
  // Listener position (camera centre) for distance falloff and panning.
  lx = 0;
  ly = 0;
  private rain = 0;
  private lastPlay = new Map<string, number>();
  // Game-state readers.
  private game: Game | null = null;
  private region = 'ranch';
  private scanT = 0;
  private amb: AmbState = { region: 'ranch', phase: 'day', wind: 0.35, river: 0, riverPan: 0, ford: 0, herd: [], murmur: 0, murmurStress: 0, murmurPan: 0, murmurSp: 'sheep', munch: 0, rain: 0, storm: 0, speed: 1 };
  private pumpAt = 0;
  private stepPh = 0;
  private stepI = 0;
  private lastMode = '';
  private lastSel = -1;
  private gates = new WeakMap<object, number>();
  // Trials and orders, watched for what changed since the last frame.
  private run: Run | null = null;
  private runStep = 0;
  private runFaults = 0;
  private runPenned = false;
  private result: TrialResult | null = null;
  private sourAt = -1;
  private orderState = new WeakMap<object, string>();
  // Weather, as last read.
  private fog = 0;
  private ambLp!: BiquadFilterNode;
  private fogIn: GainNode | null = null;
  private ambIn!: GainNode;
  private ambSend: GainNode | null = null;
  // The latest lightning strike, for anyone drawing the flash: `at` is
  // performance.now() of the flash, `near` 0..1; its thunder follows.
  lightning: { at: number; near: number } | null = null;
  private moving = new WeakSet<object>();

  constructor(opts: { listen?: boolean } = {}) {
    try {
      this.muted = localStorage.getItem('comeby-muted') === '1';
      const m = localStorage.getItem('comeby-music'), s = localStorage.getItem('comeby-sound');
      if (m !== null) this.musicLevel = Math.max(0, Math.min(10, Number(m) || 0));
      if (s !== null) this.soundLevel = Math.max(0, Math.min(10, Number(s) || 0));
    } catch { /* storage may be blocked */ }
    if (opts.listen === false) return;
    // Browsers (iOS above all) only start audio inside a user gesture, and
    // iOS may suspend it again after a call or a trip to the home screen,
    // so every tap or key makes sure it is running.
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'touchend', 'mousedown', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
    // No music in a background tab; resume when it comes back.
    document.addEventListener('visibilitychange', () => {
      if (!this.live) return;
      if (document.visibilityState === 'hidden') void this.live.suspend().catch(() => {});
      else void this.live.resume().catch(() => {});
    });
  }

  unlock() {
    // Not every key counts as a gesture (Escape does not): wait for one that does.
    if ((navigator as { userActivation?: { isActive: boolean } }).userActivation?.isActive === false) return;
    if (!this.live) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC({ latencyHint: 'interactive' });
      this.live = ctx;
      this.attach(ctx);
      // Old iOS needs a sound started inside the gesture itself.
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination);
      s.start(0);
    }
    if (this.live.state !== 'running' && document.visibilityState !== 'hidden') void this.live.resume().catch(() => {});
  }

  // Build the mixer on a context (a live one, or an offline one in tests).
  attach(ctx: BaseAudioContext, rnd: () => number = Math.random) {
    this.ctx = ctx;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -6;
    lim.knee.value = 3;
    lim.ratio.value = 16;
    lim.attack.value = 0.003;
    lim.release.value = 0.2;
    lim.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(lim);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.duck = ctx.createGain();
    this.duck.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.duck);
    this.sting = ctx.createGain();
    this.sting.connect(this.master);
    this.applyLevels();
    for (const p of [-0.8, -0.4, 0, 0.4, 0.8]) {
      const n = ctx.createStereoPanner();
      n.pan.value = p;
      n.connect(this.sfx);
      this.pans.push(n);
    }
    // The ambience goes through a filter that fog closes down.
    const amb = ctx.createGain();
    this.ambLp = ctx.createBiquadFilter();
    this.ambLp.type = 'lowpass';
    this.ambLp.frequency.value = 18000;
    this.ambLp.Q.value = 0.5;
    amb.connect(this.ambLp).connect(this.sfx);
    this.ambIn = amb;
    this.bank = new Bank(ctx, rnd);
    this.music = new Music(ctx, this.musicBus, this.sting, this.bank, rnd);
    this.ambience = new Ambience(ctx, amb, this.bank, this, rnd);
  }

  // ---- Volumes ----

  private applyLevels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(curve(this.soundLevel), t, 0.03);
    this.musicBus.gain.setTargetAtTime(curve(this.musicLevel), t, 0.03);
    // Stingers follow the music volume; with music off they still mark the
    // moment, at the sound volume.
    this.sting.gain.setTargetAtTime(this.musicLevel > 0 ? curve(this.musicLevel) : curve(this.soundLevel) * 0.7, t, 0.03);
  }

  private store() {
    try {
      localStorage.setItem('comeby-muted', this.muted ? '1' : '0');
      localStorage.setItem('comeby-music', String(this.musicLevel));
      localStorage.setItem('comeby-sound', String(this.soundLevel));
    } catch { /* ignore */ }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
    this.store();
  }

  setMusicLevel(n: number) {
    this.musicLevel = Math.max(0, Math.min(10, Math.round(n)));
    this.applyLevels();
    this.store();
  }

  setSoundLevel(n: number) {
    this.soundLevel = Math.max(0, Math.min(10, Math.round(n)));
    this.applyLevels();
    this.store();
  }

  // Sliders for menus: levels as 0..1, and a step of -1 / +1, where 0
  // (a tap or confirm) steps round from full back to silent.
  get musicVol() {
    return this.musicLevel / 10;
  }

  get soundVol() {
    return this.soundLevel / 10;
  }

  stepMusic(d: -1 | 0 | 1) {
    this.setMusicLevel(d ? this.musicLevel + d : (this.musicLevel + 1) % 11);
    this.stepped();
  }

  stepSound(d: -1 | 0 | 1) {
    this.setSoundLevel(d ? this.soundLevel + d : (this.soundLevel + 1) % 11);
    this.stepped();
  }

  private stepped() {
    if (this.muted) this.setMuted(false);
    this.play('ui-move', { force: true });
  }

  // Pause menu: '-' and '+' step a slider, '~' steps it round.
  adjust(a: VolumeAction) {
    const d = a.endsWith('-') ? -1 : a.endsWith('+') ? 1 : 0;
    if (a.startsWith('music')) this.stepMusic(d);
    else this.stepSound(d);
  }

  // The weather hook: 0 = dry, 1 = a downpour. Cheap to call every frame.
  setRain(amount: number) {
    this.rain = Math.max(0, Math.min(1, amount));
  }

  private duckFor(depth: number, secs: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, g = this.duck.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(depth, t, 0.04);
    g.setTargetAtTime(1, t + secs, 0.7);
  }

  // ---- Music ----

  // A musical flourish over the bed, which ducks out of its way.
  stinger(kind: StingerKind, opts: { delay?: number; amt?: number } = {}) {
    if (!this.ctx || this.muted) return;
    const delay = opts.delay ?? 0;
    const len = this.music.stinger(kind, this.ctx.currentTime + 0.02 + delay, opts.amt);
    // Little cues (a trial gate, a sour note) only dip the music.
    const small = kind === 'gate' || kind === 'sour';
    this.duckFor(small ? 0.6 : 0.3, len * 0.8 + delay);
  }

  // A pen just shut: the shepherd's whistle, then a stinger as good as the
  // batch was calm.
  thatllDo(label: string) {
    this.play('thatlldo', { delay: 0.18 });
    if (!this.ctx || this.muted) return;
    const kind: StingerKind = label === 'CALM' ? 'calm' : label === 'STEADY' ? 'steady' : 'rattled';
    const len = this.music.stinger(kind, this.ctx.currentTime + 0.75);
    this.duckFor(0.3, len * 0.8 + 0.75);
  }

  // ---- Building blocks ----

  // `far` is 0 at the listener to 1 at the edge of hearing; in fog, far
  // sounds lose their top and gain a damp tail.
  private out(vol: number, pan: number, far = 0): AudioNode | null {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    let dest: AudioNode = this.sfx;
    const muffle = this.fog * far;
    if (muffle > 0.05) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 16000 * Math.pow(0.08, muffle);
      lp.connect(this.sfx);
      dest = lp;
      g.connect(this.fogVerb()).connect(this.sfx);
    }
    if (pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      p.connect(dest);
    } else g.connect(dest);
    return g;
  }

  // A small, cheap reverb for the sounds of the world, only built once fog
  // first rolls in: three damped delay lines feeding each other. The loop
  // gain stays well under one (3 x 0.24, filters without resonance).
  private fogVerb(): AudioNode {
    if (this.fogIn) return this.fogIn;
    const c = this.ctx!;
    const inp = c.createGain();
    inp.gain.value = 0.35;
    const mix = c.createGain();
    const out = c.createGain();
    out.gain.value = 0.5;
    [0.037, 0.053, 0.071].forEach((t, i) => {
      const d = c.createDelay(0.1);
      d.delayTime.value = t;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1500;
      lp.Q.value = -6; // dB: no peak at the cutoff, so no runaway
      const fb = c.createGain();
      fb.gain.value = 0.24;
      const p = c.createStereoPanner();
      p.pan.value = [-0.7, 0, 0.7][i];
      inp.connect(d);
      mix.connect(d);
      d.connect(lp).connect(fb).connect(mix);
      lp.connect(p).connect(out);
    });
    out.connect(this.sfx);
    this.fogIn = inp;
    return inp;
  }

  private panBus(pan: number) {
    const i = Math.round((Math.max(-0.8, Math.min(0.8, pan)) + 0.8) / 0.4);
    return this.pans[i];
  }

  // A buffer from the sample bank through one of five shared pan buses.
  sample(name: string, vol: number, pan: number, rate = 1, at?: number, lp?: number) {
    if (!this.ctx || this.muted || vol < 0.002) return;
    const b = this.bank.get(name);
    if (!b) return;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    let node: AudioNode = src;
    if (lp) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      node = node.connect(f);
    }
    node.connect(g).connect(this.panBus(pan));
    src.start(at ?? this.ctx.currentTime);
  }

  // The soundscape calls this when lightning strikes (its thunder is
  // already on the way, later the further off it struck).
  strike(near: number) {
    this.lightning = { at: performance.now(), near };
  }

  private tone(dest: AudioNode, wave: Wave, f0: number, f1: number, t0: number, dur: number, vol: number, opts: { vib?: number; vibDepth?: number; filter?: BiquadFilterType; ff?: number; q?: number; attack?: number; f2?: number } = {}) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(f0, t0);
    if (opts.f2 !== undefined) {
      o.frequency.linearRampToValueAtTime(f1, t0 + dur * 0.4);
      o.frequency.linearRampToValueAtTime(opts.f2, t0 + dur);
    } else o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = o;
    if (opts.vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = opts.vib;
      lg.gain.value = opts.vibDepth ?? f0 * 0.04;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.value = opts.ff ?? 1000;
      f.Q.value = opts.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dest: AudioNode, t0: number, dur: number, vol: number, filter: BiquadFilterType, ff: number, q = 1, ff1?: number) {
    const ctx = this.ctx!;
    const buf = this.bank.get('noise');
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(ff, t0);
    if (ff1) f.frequency.exponentialRampToValueAtTime(ff1, t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t0, Math.random() * 2);
    src.stop(t0 + dur + 0.02);
  }

  // ---- Sounds ----

  play(name: string, opts: { x?: number; y?: number; vol?: number; delay?: number; force?: boolean } = {}) {
    if (!this.ctx || this.muted) return;
    // Rate-limit identical sounds a little.
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < 0.06 && !opts.force) return;
    this.lastPlay.set(name, now);
    let vol = opts.vol ?? 1;
    let pan = 0, far = 0;
    if (opts.x !== undefined && opts.y !== undefined) {
      const dx = opts.x - this.lx, dy = opts.y - this.ly;
      const d = Math.hypot(dx, dy);
      vol *= Math.max(0, 1 - d / 320);
      if (vol <= 0.01) return;
      pan = dx / 220;
      far = Math.min(1, d / 250);
    }
    if (name === 'tierup') {
      this.stinger('tierup');
      return;
    }
    // A trial run has just begun (startRun whistles): the judge's whistle
    // first, then the handler sends the dog.
    const run = this.game?.trials?.run;
    if (name === 'thatlldo' && run && run.t === 0 && run.step === 0 && !opts.delay) {
      this.play('judge', { force: true });
      this.play('thatlldo', { delay: 0.75, force: true });
      return;
    }
    const o = this.out(vol, pan, far);
    if (!o) return;
    const t = now + 0.005 + (opts.delay ?? 0);
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    switch (name) {
      case 'bark': {
        const p = r(0.92, 1.08);
        this.tone(o, 'sawtooth', 420 * p, 170 * p, t, 0.09, 0.35, { filter: 'lowpass', ff: 1400, q: 2 });
        this.noise(o, t, 0.05, 0.25, 'bandpass', 900, 1.5);
        this.tone(o, 'sawtooth', 380 * p, 160 * p, t + 0.11, 0.07, 0.22, { filter: 'lowpass', ff: 1200, q: 2 });
        this.duckFor(0.8, 0.25);
        break;
      }
      case 'nip':
        this.noise(o, t, 0.035, 0.35, 'highpass', 2500);
        this.tone(o, 'square', 900, 500, t, 0.04, 0.08, { filter: 'lowpass', ff: 2000 });
        break;
      case 'gate':
        this.tone(o, 'sine', 140, 60, t, 0.16, 0.5);
        this.noise(o, t, 0.03, 0.3, 'highpass', 1800);
        this.tone(o, 'triangle', 230, 120, t + 0.05, 0.1, 0.18);
        break;
      case 'creak': {
        // An old hinge: a scraping tone that wobbles in pitch.
        const f = r(520, 760);
        this.tone(o, 'sawtooth', f, f * r(0.82, 0.92), t, 0.34, 0.035, { vib: r(18, 26), vibDepth: f * 0.05, filter: 'bandpass', ff: 1500, q: 3, attack: 0.04 });
        this.noise(o, t, 0.3, 0.03, 'bandpass', 2400, 4);
        break;
      }
      case 'creak-long': {
        const f = r(380, 460);
        this.tone(o, 'sawtooth', f, f * 1.25, t, 1.4, 0.04, { f2: f * 0.9, vib: 14, vibDepth: f * 0.06, filter: 'bandpass', ff: 1200, q: 3, attack: 0.15 });
        break;
      }
      case 'judge':
      case 'judge2': {
        // The judge's pea whistle: one long blast to start, two to finish.
        const blasts = name === 'judge' ? [[0, 0.7]] : [[0, 0.22], [0.32, 0.6]];
        for (const [at, len] of blasts) {
          const c = this.ctx;
          const osc = c.createOscillator();
          osc.frequency.value = 2900;
          const pea = c.createOscillator(); // the pea rattling in the barrel
          pea.type = 'square';
          pea.frequency.value = 27;
          const depth = c.createGain();
          depth.gain.value = 140;
          pea.connect(depth).connect(osc.frequency);
          const g = c.createGain();
          g.gain.setValueAtTime(0, t + at);
          g.gain.linearRampToValueAtTime(0.11, t + at + 0.02);
          g.gain.setTargetAtTime(0.085, t + at + 0.02, 0.1);
          g.gain.setTargetAtTime(0, t + at + len - 0.04, 0.015);
          osc.connect(g).connect(o);
          for (const n of [osc, pea]) {
            n.start(t + at);
            n.stop(t + at + len + 0.1);
          }
          this.noise(o, t + at, len, 0.035, 'bandpass', 3200, 2);
        }
        break;
      }
      case 'cart': {
        // A buyer's cart rolling off with the stock.
        const b = this.bank.get('cart');
        if (!b) break;
        const src = this.ctx.createBufferSource();
        src.buffer = b;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(4000, t);
        lp.frequency.exponentialRampToValueAtTime(700, t + b.duration);
        const g = this.ctx.createGain();
        g.gain.value = 0.5;
        src.connect(lp).connect(g).connect(o);
        src.start(t);
        break;
      }
      case 'thatlldo':
        // A shepherd's two-note whistle (the music answers it).
        this.tone(o, 'sine', 1500, 2300, t, 0.22, 0.16, { vib: 6, vibDepth: 30 });
        this.tone(o, 'sine', 2300, 1700, t + 0.26, 0.3, 0.14, { vib: 6, vibDepth: 25 });
        break;
      case 'coin':
        this.tone(o, 'square', 988, 988, t, 0.05, 0.06, { filter: 'lowpass', ff: 3000 });
        this.tone(o, 'square', 1319, 1319, t + 0.05, 0.08, 0.06, { filter: 'lowpass', ff: 3000 });
        break;
      case 'build':
        this.tone(o, 'sine', 200, 80, t, 0.1, 0.4);
        this.noise(o, t, 0.04, 0.2, 'bandpass', 1200);
        this.tone(o, 'sine', 210, 80, t + 0.14, 0.1, 0.35);
        this.noise(o, t + 0.14, 0.04, 0.18, 'bandpass', 1300);
        break;
      case 'deny':
        this.tone(o, 'square', 150, 120, t, 0.14, 0.1, { filter: 'lowpass', ff: 800 });
        break;
      case 'click':
        // A soft wooden click.
        this.tone(o, 'triangle', 1800, 900, t, 0.03, 0.08);
        this.noise(o, t, 0.012, 0.06, 'bandpass', 3500, 2);
        break;
      case 'ui-move':
        this.tone(o, 'triangle', 1400, 1300, t, 0.035, 0.05);
        break;
      case 'ui-select':
        this.tone(o, 'triangle', 1050, 1050, t, 0.05, 0.06);
        this.tone(o, 'triangle', 1575, 1575, t + 0.045, 0.08, 0.05);
        break;
      case 'ui-open':
        // A page turning, then a soft tock.
        this.noise(o, t, 0.12, 0.05, 'bandpass', 2600, 0.8, 1400);
        this.tone(o, 'triangle', 660, 600, t + 0.06, 0.06, 0.05);
        break;
      case 'ui-close':
        this.noise(o, t, 0.09, 0.04, 'bandpass', 1600, 0.8, 2800);
        this.tone(o, 'triangle', 600, 520, t + 0.03, 0.06, 0.045);
        break;
      case 'dusk':
        this.tone(o, 'sine', 880, 870, t, 1.6, 0.12, { attack: 0.01 });
        this.tone(o, 'sine', 1320, 1310, t, 1.2, 0.06, { attack: 0.01 });
        break;
      case 'howl':
        this.tone(o, 'sine', r(280, 330), 620, t, 1.6, 0.12, { f2: 430, vib: 5, vibDepth: 8, attack: 0.3, filter: 'lowpass', ff: 1500 });
        this.duckFor(0.55, 1.4);
        break;
      case 'yelp':
        this.tone(o, 'sine', 900, 1500, t, 0.16, 0.12, { f2: 700 });
        break;
      case 'splash':
        this.noise(o, t, 0.18, 0.18, 'lowpass', 1800, 1, 400);
        break;
      case 'baa':
        this.tone(o, 'sawtooth', r(250, 300), r(230, 260), t, 0.42, 0.12, { vib: 7, vibDepth: 14, filter: 'bandpass', ff: 1000, q: 2, attack: 0.04 });
        break;
      case 'bleat':
        this.tone(o, 'sawtooth', r(380, 440), r(360, 400), t, 0.3, 0.1, { vib: 11, vibDepth: 25, filter: 'bandpass', ff: 1300, q: 2, attack: 0.02 });
        break;
      case 'quack':
        this.tone(o, 'square', r(480, 540), 380, t, 0.09, 0.08, { filter: 'bandpass', ff: 1100, q: 3 });
        this.tone(o, 'square', r(470, 520), 370, t + 0.12, 0.08, 0.07, { filter: 'bandpass', ff: 1100, q: 3 });
        break;
      case 'moo':
        this.tone(o, 'sawtooth', r(120, 135), 92, t, 0.75, 0.14, { filter: 'lowpass', ff: 520, q: 3, attack: 0.08 });
        break;
      case 'whinny':
        this.tone(o, 'sawtooth', 700, 1050, t, 0.55, 0.07, { f2: 480, vib: 13, vibDepth: 60, filter: 'bandpass', ff: 1400, q: 2 });
        break;
    }
  }

  // ---- Reading the game ----

  // Called from Game.update in every mode: drives the music, the
  // soundscape, footsteps, gate creaks and menu sounds from game state.
  tick(g: Game, dt: number) {
    if (!this.ctx) return;
    // Build a few more samples, once per frame (tick runs per substep).
    const ms = performance.now();
    if (this.bank.pending && ms - this.pumpAt > 12) {
      this.pumpAt = ms;
      this.bank.pump(3);
    }
    this.lx = g.cam.x;
    this.ly = g.cam.y;
    if (g !== this.game) {
      // A new game: the title menu started one, or Save and Quit went back
      // to the title. Forget the old one's state.
      if (this.game) this.play('ui-select');
      this.game = g;
      this.lastMode = g.mode;
      this.lastSel = -1;
      this.gates = new WeakMap();
      this.scanT = 0;
    }
    if (this.muted) return;
    if (this.musicLevel > 0) this.music.update(this.musicState(g), dt);
    this.menuSounds(g);
    this.watchTrial(g);
    this.watchOrders(g);
    if (this.soundLevel === 0) return;
    if (g.mode === 'play') this.dogSteps(g, dt);
    if ((this.scanT -= dt) <= 0) {
      this.scanT = 0.1;
      this.scan(g);
      this.gateCreaks(g);
    }
    this.ambience.update(this.amb, dt);
  }

  private musicState(g: Game): MusicState {
    const mode = g.mode;
    const phase = g.day.phase;
    const reg = g.map.regionAt(g.dog.x, g.dog.y);
    if (reg) this.region = reg.id; // corridors keep the last region's tune
    let piece: PieceId = REGION_PIECE[this.region] ?? 'ranch';
    const tr = g.trials;
    if (mode === 'title') piece = 'title';
    else if (mode === 'summary' || mode === 'build') piece = 'ranch';
    else if (tr.run || tr.result) piece = 'trial';
    else if (phase === 'night') piece = 'night';
    else if (g.rest > 1.3) piece = 'lullaby'; // lying down on the ranch, the day flying by
    else if (phase === 'dusk') piece = 'dusk';

    const d = g.dog;
    const gr = g.nearestGroup(130);
    let energy = 0.15, tension = 0;
    if (mode === 'title') energy = 0.5;
    else if (mode === 'play') {
      const moving = Math.min(1, d.speed / 46);
      energy = d.lying ? 0.05 : 0.15 + 0.2 * moving;
      if (gr && !d.lying) energy += 0.15 + 0.5 * moving;
    }
    if (gr && mode === 'play') {
      tension = Math.max(0, Math.min(1, (gr.stress - 0.22) / 0.5));
      let panics = 0;
      for (const a of gr.members) if (a.panicT > 0) panics++;
      tension = Math.min(1, tension + (panics / gr.members.length) * 0.6);
    }
    if (phase === 'night' && mode === 'play') {
      let danger = 0, out = false;
      for (const p of g.predators) {
        if (!p.active) continue;
        out = true;
        const w = p.state === 'dig' || p.state === 'carry' ? 1 : p.state === 'hunt' ? 0.75 : 0.15;
        const near = 1 - Math.max(0, Math.min(1, (Math.hypot(p.x - this.lx, p.y - this.ly) - 40) / 260));
        danger = Math.max(danger, w * near);
      }
      tension = Math.max(tension, danger, out ? 0.15 : 0);
    }
    if (tr.run && !tr.result && mode === 'play') energy = Math.max(energy, 0.65); // a trial is never idle
    const w = g.weather;
    if (w.sky === 'storm') tension = Math.max(tension, 0.4 * w.rain); // a storm unsettles everything
    return {
      piece, energy: Math.min(1, energy), tension,
      rest: mode === 'summary' || mode === 'build' || mode === 'ledger' || !!tr.result,
      muffle: mode === 'pause',
      rain: w.rain, fog: w.fog, wind: w.wind,
    };
  }

  // The dog's paws, in step with its run cycle: every other frame of the
  // trot, every landing of the gallop.
  private dogSteps(g: Game, dt: number) {
    const d = g.dog, v = d.speed;
    if (d.lying || v < 6) return;
    this.stepPh += (v * dt) / (d.sprinting ? 7 : 4.5);
    const i = Math.floor(this.stepPh);
    if (i === this.stepI) return;
    this.stepI = i;
    if ((i & 1) !== (d.sprinting ? 1 : 0)) return;
    const r = Math.random();
    const pan = (d.x - this.lx) / 220;
    if (d.inWater) this.sample('splash', 0.12 + 0.06 * r, pan, 1.1 + 0.3 * r);
    else if (d.sprinting) this.sample('step-dog-run', 0.2 + 0.08 * r, pan, 0.9 + 0.2 * r);
    else this.sample('step-dog', 0.1 + 0.05 * r, pan, 0.9 + 0.25 * r);
  }

  // What is near the listener: river, flocks, grazing, hooves.
  private scan(g: Game) {
    const a = this.amb, lx = this.lx, ly = this.ly;
    const reg = g.map.regionAt(lx, ly);
    a.region = reg ? reg.id : null;
    a.phase = g.mode === 'title' ? 'day' : g.day.phase;
    // The sky: wind strength scales the region's own windiness; rain from
    // the weather (or the setRain hook); fog closes the ambience down.
    const w = g.weather;
    a.wind = (reg ? WIND[reg.id] ?? 0.35 : 0.3) * (0.45 + 1.1 * w.wind);
    a.rain = Math.max(this.rain, w.rain);
    a.storm = w.sky === 'storm' ? w.rain : 0;
    a.speed = 1 + Math.min(2, Math.max(0, g.rest - 1) / 5.5);
    this.fog = w.fog;
    const now = this.ctx!.currentTime;
    this.ambLp.frequency.setTargetAtTime(18000 * Math.pow(0.1, this.fog), now, 0.5);
    if (this.fog > 0.05 && !this.ambSend) {
      this.ambSend = this.ctx!.createGain();
      this.ambIn.connect(this.ambSend).connect(this.fogVerb());
    }
    this.ambSend?.gain.setTargetAtTime(this.fog * 0.4, now, 0.5);
    // The river runs south from its spring; the ford is where it is shallow.
    const ty = ly / TS;
    const ry = Math.max(ty, RIVER_SPRING_Y);
    const rx = (riverX(ry) + 0.5) * TS;
    const rd = Math.hypot(rx - lx, (ry - ty) * TS);
    a.river = Math.max(0, 1 - rd / 240);
    a.riverPan = Math.max(-1, Math.min(1, (rx - lx) / 200));
    const fy = ((FORD_Y0 + FORD_Y1) / 2) * TS;
    a.ford = Math.max(0, 1 - Math.hypot(riverX(fy / TS) * TS - lx, fy - ly) / 180);
    // Animals.
    const herd = new Map<string, HerdVoice>();
    let n = 0, stress = 0, px = 0, munch = 0;
    const kinds = new Map<string, number>();
    for (const an of g.animals) {
      if (an.gone || an.carried) continue;
      const dx = an.x - lx, dy = an.y - ly;
      const dist = Math.hypot(dx, dy);
      if (dist > 200) continue;
      const near = 1 - dist / 200;
      const w = near * (an.pen ? 0.5 : 1);
      n += w;
      stress += an.stress * w;
      px += (dx / 200) * w;
      kinds.set(an.sp.id, (kinds.get(an.sp.id) ?? 0) + w);
      if (an.speed < 4 && an.stress < 0.3) munch += near;
      if (!an.pen && an.speed > 4) {
        let h = herd.get(an.sp.id);
        if (!h) herd.set(an.sp.id, (h = { sp: an.sp.id, rate: 0, pan: 0, vol: 0, water: 0 }));
        const rate = (an.speed / (STRIDE[an.sp.id] ?? 6)) * near;
        h.rate += rate;
        h.pan += (dx / 220) * rate;
        h.vol = Math.max(h.vol, near);
        if (an.inWater) h.water += rate;
      }
    }
    a.herd = [...herd.values()].map((h) => ({ ...h, pan: h.pan / (h.rate || 1), water: h.water / (h.rate || 1), rate: Math.min(16, h.rate) }));
    a.murmur = n;
    a.murmurStress = n ? stress / n : 0;
    a.murmurPan = n ? Math.max(-1, Math.min(1, px / n)) : 0;
    let best = 0;
    for (const [k, v] of kinds) if (v > best) { best = v; a.murmurSp = k; }
    a.munch = munch;
  }

  // Hinges creak when a gate starts to swing.
  private gateCreaks(g: Game) {
    const check = (o: object, swing: number, x: number, y: number, long = false) => {
      const prev = this.gates.get(o);
      this.gates.set(o, swing);
      if (prev === undefined) return;
      const mov = Math.abs(swing - prev) > 0.001;
      if (mov && !this.moving.has(o)) this.play(long ? 'creak-long' : 'creak', { x, y, vol: 0.9, force: true });
      if (mov) this.moving.add(o);
      else this.moving.delete(o);
    };
    for (const p of g.ranch.pens) {
      const gp = p.gatePoint(0);
      check(p, p.swing, gp.x, gp.y);
    }
    for (const f of g.ranch.fieldGates) check(f, f.swing, f.cx, f.cy);
    for (const r of g.ranch.regionGates) check(r, r.swing, r.cx, r.cy, true);
  }

  // The Show Ground: a cue for each gate cleared, a sour note for a bolt
  // or a grip, the judge's whistle at the end, and the crowd.
  private watchTrial(g: Game) {
    const tr = g.trials;
    const r = tr.run;
    if (r !== this.run) {
      this.run = r;
      this.runStep = r ? r.step : 0;
      this.runFaults = r ? r.bolts + r.grips : 0;
      this.runPenned = false;
    }
    if (r) {
      while (this.runStep < r.step) {
        const k = this.runStep++;
        const part = PARTS[k];
        if (part.id === 'lift' || part.id === 'pen') continue;
        const amt = r.scores[k] / part.max;
        if (amt > 0) this.stinger('gate', { amt }); // a miss gets the trial's own 'deny'
      }
      const faults = r.bolts + r.grips;
      if (faults > this.runFaults) {
        this.runFaults = faults;
        const now = this.ctx!.currentTime;
        if (now - this.sourAt > 1) {
          this.sourAt = now;
          this.stinger('sour');
        }
      }
      if (r.penned && !this.runPenned) {
        this.runPenned = true;
        this.play('judge2', { delay: 0.9, force: true }); // after the handler's "that'll do"
      }
    }
    const res = tr.result;
    if (res && res !== this.result) {
      if (!this.runPenned) this.play('judge2', { force: true }); // time up, or retired
      const placed = res.place >= 1 && res.place <= 3;
      let level = res.retired ? 0.1 : (res.total / 100) * (res.place === 0 ? 0.75 : 1) + (placed ? 0.15 : 0);
      if (res.place === 1) level = Math.max(level, 0.85);
      this.applause(Math.min(1, level), res.place === 1 || res.total >= 85);
    }
    this.result = res;
  }

  // The crowd: a few polite claps, warm applause, or applause and whistles.
  private applause(level: number, cheer: boolean) {
    const t = this.ctx!.currentTime + 0.3, r = Math.random;
    this.sample('applause-sparse', level < 0.7 ? 0.3 + 0.3 * level : 0.3, 0, 0.95 + 0.1 * r(), t);
    if (level >= 0.35) this.sample('applause-full', 0.12 + 0.3 * Math.min(1, (level - 0.35) / 0.5), 0, 0.95 + 0.1 * r(), t + 0.15);
    if (cheer) this.sample('cheer', 0.08, (r() - 0.5) * 0.8, 0.95 + 0.1 * r(), t + 0.7);
  }

  // Buyers' orders: a stinger when one is filled (and the cart rolls off
  // with the stock), a sigh when the buyer gives up.
  private watchOrders(g: Game) {
    for (const o of g.orders.list) {
      const prev = this.orderState.get(o);
      this.orderState.set(o, o.state);
      if (prev !== 'open' || o.state === 'open') continue;
      const yard = g.ranch.yards.find((y) => y.site.id === o.yard);
      const at = yard ? { x: (yard.site.cart.tx + 1) * TS, y: (yard.site.cart.ty + 1) * TS } : null;
      if (o.state === 'done') {
        this.stinger('sold', { delay: 0.75 }); // after the gate and the whistle
        if (at) this.play('cart', { ...at, delay: 2.2, force: true });
      } else {
        this.stinger(o.got ? 'steady' : 'missed');
        if (at && o.got) this.play('cart', { ...at, delay: 1.5, force: true });
      }
    }
  }

  // Menus: a tick when the selection moves, a page sound when a panel
  // opens or closes, and the end-of-day stinger when the summary comes up.
  // (Starting or quitting a game is heard in tick, when the game changes.)
  private menuSounds(g: Game) {
    const mode = g.mode;
    if (mode !== this.lastMode) {
      const from = this.lastMode;
      this.lastMode = mode;
      if (mode === 'summary') this.stinger('summary');
      else if (mode === 'pause' || mode === 'ledger' || (mode === 'build' && from === 'play')) this.play('ui-open');
      else if (mode === 'play' && (from === 'pause' || from === 'ledger' || from === 'build')) this.play('ui-close');
      else if (mode === 'play' && from === 'summary') this.play('ui-select');
      this.lastSel = -1;
    }
    const sel = mode === 'pause' ? g.pauseSel : mode === 'title' ? g.menu.sel + (g.menu.confirmNew ? 10 : 0) : -1;
    if (sel !== this.lastSel) {
      if (this.lastSel >= 0 && sel >= 0) this.play(Math.abs(sel - this.lastSel) >= 10 ? 'ui-select' : 'ui-move');
      this.lastSel = sel;
    }
  }
}

export const CALLS: Record<string, string> = { duck: 'quack', sheep: 'baa', goat: 'bleat', cow: 'moo', pony: 'whinny' };
