// The living background: wind that gusts (stronger up high, leafy in the
// forest), the river near the ford, a flock's murmur that grows with its
// size and rises with its stress, grazing, hooves per species, birds by day,
// crickets, frogs and an owl by night, and rain if the weather ever turns.
// Continuous layers are a handful of looping nodes made once; hooves and
// calls are single buffer sources from the sample bank.

import type { Bank } from './synth';

export interface HerdVoice {
  sp: string; // species id
  rate: number; // footfalls per second (all nearby animals together)
  pan: number;
  vol: number; // proximity 0..1
  water: number; // share of them wading
}

export interface AmbState {
  region: string | null; // null = a forest corridor
  phase: 'day' | 'dusk' | 'night';
  wind: number; // 0..1
  river: number; // 0..1 how close the river is
  riverPan: number;
  ford: number; // 0..1 how close the babbling shallows are
  herd: HerdVoice[];
  murmur: number; // weighted count of animals close by
  murmurStress: number; // 0..1
  murmurPan: number;
  murmurSp: string;
  munch: number; // calm grazers close by
  rain: number; // 0..1, the weather hook
}

export interface SampleOut {
  sample(name: string, vol: number, pan: number, rate?: number, at?: number): void;
}

// [playback rate, murmur band centre (Hz)]
const MURMUR: Record<string, [number, number]> = { duck: [2.1, 1100], sheep: [1.15, 600], goat: [1.45, 800], cow: [0.62, 320], pony: [0.95, 500] };
const STEP_VOL: Record<string, number> = { duck: 0.1, sheep: 0.12, goat: 0.14, cow: 0.22, pony: 0.18 };

class Loop {
  src: AudioBufferSourceNode;
  filt: BiquadFilterNode;
  gain: GainNode;
  pan: StereoPannerNode;

  constructor(ctx: BaseAudioContext, buf: AudioBuffer, out: AudioNode, type: BiquadFilterType, freq: number, q: number, offset: number) {
    this.src = ctx.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;
    this.filt = ctx.createBiquadFilter();
    this.filt.type = type;
    this.filt.frequency.value = freq;
    this.filt.Q.value = q;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.pan = ctx.createStereoPanner();
    this.src.connect(this.filt).connect(this.gain).connect(this.pan).connect(out);
    this.src.start(ctx.currentTime, offset);
  }

  set(t: number, level: number, pan: number, tau = 0.6) {
    this.gain.gain.setTargetAtTime(level, t, tau);
    this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, tau);
  }
}

export class Ambience {
  private windLo: Loop | null = null;
  private windHi: Loop | null = null;
  private river: Loop | null = null;
  private murmur: Loop | null = null;
  private munch: Loop | null = null;
  private rain: Loop | null = null;
  private gustT = 0;
  private gust = 1;
  private birdT = 2;
  private crickT = 0;
  private frogT = 1;
  private owlT = 25;
  private lastSet = 0;

  constructor(private ctx: BaseAudioContext, private out: AudioNode, private bank: Bank, private sfx: SampleOut, private rnd: () => number = Math.random) {}

  private loop(name: string, type: BiquadFilterType, freq: number, q: number): Loop | null {
    const b = this.bank.get(name);
    return b ? new Loop(this.ctx, b, this.out, type, freq, q, this.rnd() * b.duration) : null;
  }

  update(s: AmbState, dt: number) {
    const now = this.ctx.currentTime;
    const r = this.rnd;
    // Continuous layers are retargeted a few times a second, not per frame.
    if (now - this.lastSet >= 0.1 || this.lastSet > now) {
      this.lastSet = now;
      this.windLo ??= this.loop('noise', 'lowpass', 400, 0.6);
      this.windHi ??= this.loop('noise', 'bandpass', 1800, 0.8);
      if ((this.gustT -= 0.1) <= 0) {
        this.gustT = 1.2 + r() * 2.8;
        this.gust = 0.5 + r() * 0.8;
      }
      const forest = s.region === null;
      const w = s.wind * (s.phase === 'night' ? 0.7 : 1) * this.gust;
      if (this.windLo && this.windHi) {
        this.windLo.set(now, w * (forest ? 0.04 : 0.1), 0, 1.2);
        this.windLo.filt.frequency.setTargetAtTime(280 + 260 * this.gust, now, 1.2);
        this.windHi.set(now, w * this.gust * (forest ? 0.05 : 0.028), 0, 1.2);
        this.windHi.filt.frequency.setTargetAtTime((forest ? 2600 : 1200) + 1300 * this.gust, now, 1.2);
      }
      if (s.river > 0.01) this.river ??= this.loop('river', 'lowpass', 1500, 0.5);
      if (this.river) {
        this.river.set(now, Math.pow(s.river, 1.5) * 0.26, s.riverPan, 0.4);
        this.river.filt.frequency.setTargetAtTime(900 + 3800 * s.ford, now, 0.5);
      }
      if (s.murmur > 0.05) this.murmur ??= this.loop('murmur', 'bandpass', 600, 1.1);
      if (this.murmur) {
        const [rate, band] = MURMUR[s.murmurSp] ?? MURMUR.sheep;
        const lvl = 0.07 * Math.min(1, Math.sqrt(s.murmur) / 3) * (0.45 + 0.9 * s.murmurStress);
        this.murmur.set(now, lvl, s.murmurPan, 0.8);
        this.murmur.src.playbackRate.setTargetAtTime(rate * (1 + 0.2 * s.murmurStress), now, 0.8);
        this.murmur.filt.frequency.setTargetAtTime(band * (1 + 0.3 * s.murmurStress), now, 0.8);
      }
      if (s.munch > 0.05) this.munch ??= this.loop('munch', 'lowpass', 6500, 0.5);
      if (this.munch) this.munch.set(now, 0.06 * Math.min(1, Math.sqrt(s.munch) / 2.2), s.murmurPan, 1);
      if (s.rain > 0.01) this.rain ??= this.loop('noise', 'bandpass', 3200, 0.35);
      if (this.rain) this.rain.set(now, s.rain * 0.09, 0, 1.5);
    }

    // Hooves and feet: each footfall is one buffer source.
    for (const h of s.herd) {
      if (r() < h.rate * dt) {
        const wet = r() < h.water;
        this.sfx.sample(wet ? 'splash' : `step-${h.sp}`, h.vol * (STEP_VOL[h.sp] ?? 0.12) * (0.5 + 0.5 * r()) * (wet ? 0.6 : 1), h.pan + (r() - 0.5) * 0.4, 0.9 + 0.2 * r(), now + r() * 0.03);
      }
    }

    // Wildlife.
    const pan = () => (r() * 2 - 1) * 0.85;
    if (s.phase !== 'night') {
      if ((this.birdT -= dt) <= 0) {
        const busy = s.region === 'meadow' || s.region === 'hills' || s.region === null ? 0.7 : 1;
        this.birdT = (2.5 + r() * 5) * busy * (s.phase === 'dusk' ? 2.2 : 1) * (s.rain > 0.3 ? 4 : 1);
        if (s.rain < 0.6) this.sfx.sample(`bird${1 + Math.floor(r() * 3)}`, 0.05 + 0.06 * r(), pan(), 0.88 + 0.25 * r());
      }
    } else {
      if ((this.crickT -= dt) <= 0) {
        this.crickT = 0.25 + r() * 0.9;
        this.sfx.sample('cricket', 0.035 + 0.05 * r(), pan(), 0.95 + 0.1 * r());
      }
      if (s.river > 0.15 && (this.frogT -= dt) <= 0) {
        this.frogT = (0.7 + r() * 2) / s.river;
        this.sfx.sample('frog', 0.09 * s.river, s.riverPan + (r() - 0.5) * 0.5, 0.85 + 0.3 * r());
      }
      if ((this.owlT -= dt) <= 0) {
        this.owlT = 18 + r() * 25;
        this.sfx.sample('owl', 0.06, pan(), 0.95 + 0.1 * r());
      }
    }
    if (s.rain > 0.01 && r() < s.rain * 16 * dt) this.sfx.sample('drip', 0.03 + 0.05 * r(), pan(), 0.7 + 0.7 * r());
  }
}
