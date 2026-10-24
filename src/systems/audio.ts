// Every sound is synthesised with Web Audio: no audio files.

type Wave = OscillatorType;

export class Sound {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  volume = 0.55;
  // Listener position (camera centre) for distance falloff and panning.
  lx = 0;
  ly = 0;
  private lastPlay = new Map<string, number>();
  private ambT = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem('comeby-muted') === '1';
    } catch { /* storage may be blocked */ }
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, n, n);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.02);
    try {
      localStorage.setItem('comeby-muted', m ? '1' : '0');
    } catch { /* ignore */ }
  }

  // ---- Building blocks ----

  private out(vol: number, pan: number): AudioNode | null {
    if (!this.ctx || !this.master) return null;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      p.connect(this.master);
    } else g.connect(this.master);
    return g;
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
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
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
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  // ---- Sounds ----

  play(name: string, opts: { x?: number; y?: number; vol?: number } = {}) {
    if (!this.ctx || this.muted) return;
    // Rate-limit identical sounds a little.
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < 0.06) return;
    this.lastPlay.set(name, now);
    let vol = opts.vol ?? 1;
    let pan = 0;
    if (opts.x !== undefined && opts.y !== undefined) {
      const dx = opts.x - this.lx, dy = opts.y - this.ly;
      const d = Math.hypot(dx, dy);
      vol *= Math.max(0, 1 - d / 320);
      if (vol <= 0.01) return;
      pan = dx / 220;
    }
    const o = this.out(vol, pan);
    if (!o) return;
    const t = now + 0.005;
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    switch (name) {
      case 'bark': {
        const p = r(0.92, 1.08);
        this.tone(o, 'sawtooth', 420 * p, 170 * p, t, 0.09, 0.35, { filter: 'lowpass', ff: 1400, q: 2 });
        this.noise(o, t, 0.05, 0.25, 'bandpass', 900, 1.5);
        this.tone(o, 'sawtooth', 380 * p, 160 * p, t + 0.11, 0.07, 0.22, { filter: 'lowpass', ff: 1200, q: 2 });
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
      case 'thatlldo':
        // A shepherd's two-note whistle, then a little arpeggio.
        this.tone(o, 'sine', 1500, 2300, t, 0.22, 0.16, { vib: 6, vibDepth: 30 });
        this.tone(o, 'sine', 2300, 1700, t + 0.26, 0.3, 0.14, { vib: 6, vibDepth: 25 });
        [523, 659, 784].forEach((f, i) => this.tone(o, 'triangle', f, f, t + 0.62 + i * 0.09, 0.22, 0.12));
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
        this.tone(o, 'square', 1200, 1200, t, 0.02, 0.04, { filter: 'lowpass', ff: 3000 });
        break;
      case 'tierup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(o, 'triangle', f, f, t + i * 0.11, 0.3, 0.14));
        this.tone(o, 'square', 1047, 1047, t + 0.44, 0.5, 0.05, { filter: 'lowpass', ff: 2500 });
        this.tone(o, 'triangle', 784, 784, t + 0.44, 0.5, 0.1);
        break;
      case 'dusk':
        this.tone(o, 'sine', 880, 870, t, 1.6, 0.12, { attack: 0.01 });
        this.tone(o, 'sine', 1320, 1310, t, 1.2, 0.06, { attack: 0.01 });
        break;
      case 'howl':
        this.tone(o, 'sine', r(280, 330), 620, t, 1.6, 0.12, { f2: 430, vib: 5, vibDepth: 8, attack: 0.3, filter: 'lowpass', ff: 1500 });
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
      case 'cricket':
        for (let i = 0; i < 3; i++) this.tone(o, 'sine', 4300, 4300, t + i * 0.05, 0.025, 0.025);
        break;
      case 'bird':
        this.tone(o, 'sine', r(2200, 2800), r(3000, 3600), t, 0.08, 0.03);
        this.tone(o, 'sine', r(2600, 3200), r(2000, 2400), t + 0.1, 0.09, 0.025);
        break;
    }
  }

  // Ambient: birds by day, crickets at night.
  ambient(dt: number, night: boolean) {
    if (!this.ctx || this.muted) return;
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = night ? 0.6 + Math.random() * 1.6 : 3 + Math.random() * 6;
      this.play(night ? 'cricket' : 'bird', { vol: 0.8 });
    }
  }
}

export const CALLS: Record<string, string> = { duck: 'quack', sheep: 'baa', goat: 'bleat', cow: 'moo', pony: 'whinny' };
