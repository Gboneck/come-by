// The living background: wind that gusts (stronger up high, leafy in the
// forest), the river near the ford, a flock's murmur that grows with its
// size and rises with its stress, grazing, hooves per species, birds by day,
// crickets, frogs and an owl by night, and rain if the weather ever turns.
// It follows the seasons: a dawn chorus and a cuckoo in spring, insects all
// summer, dry leaves and rooks in autumn; winter is a hush, with a robin, a
// howling wind, snow underfoot, ice on the river and wolves far off.
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
  storm: number; // 0..1, thunder about
  speed: number; // 1 normally; faster while the dog rests and the day flies
  // The season, eased (0..1 each; none of them = high summer).
  bloom: number;
  leaves: number;
  snow: number;
  dawn: number; // 1 at first light, fading by mid-morning
  fair: number; // 0..1 how close the fair's crowd is
  fairPan: number;
}

export interface SampleOut {
  sample(name: string, vol: number, pan: number, rate?: number, at?: number, lp?: number): void;
  // A lightning strike, `near` 0..1 (the thunder follows by itself).
  strike(near: number): void;
}

// [playback rate, murmur band centre (Hz)]
const MURMUR: Record<string, [number, number]> = { duck: [2.1, 1100], sheep: [1.15, 600], goat: [1.45, 800], cow: [0.62, 320], pony: [0.95, 500] };
const STEP_VOL: Record<string, number> = { duck: 0.1, sheep: 0.12, goat: 0.14, cow: 0.22, pony: 0.18 };
// Snow crunch per species: playback rate (small feet squeak higher).
const SNOW_RATE: Record<string, number> = { duck: 1.6, sheep: 1.2, goat: 1.25, cow: 0.75, pony: 0.95 };
const SONG = ['bird1', 'bird2', 'bird3', 'bird4', 'bird5', 'bird6'];

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
  private insects: Loop | null = null;
  private dry: Loop | null = null;
  private crowd: Loop | null = null;
  private rookT = 6;
  private wolfT = 12;
  private iceT = 4;
  private gustT = 0;
  private gust = 1;
  private birdT = 2;
  private crickT = 0;
  private frogT = 1;
  private owlT = 25;
  private thunderT = 4;
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
      if ((this.gustT -= 0.1 * s.speed) <= 0) {
        this.gustT = (1.2 + r() * 2.8) / (0.6 + 0.8 * s.wind);
        this.gust = 0.5 + r() * 0.8;
      }
      const forest = s.region === null;
      const w = s.wind * (s.phase === 'night' ? 0.7 : 1) * this.gust;
      if (this.windLo && this.windHi) {
        this.windLo.set(now, w * (forest ? 0.04 : 0.1), 0, 1.2);
        this.windLo.filt.frequency.setTargetAtTime(280 + 260 * this.gust, now, 1.2);
        // Winter wind howls: the upper band narrows into a moaning whistle.
        const sn = s.snow;
        this.windHi.set(now, w * this.gust * (forest ? 0.05 : 0.028) * (1 + 0.7 * sn), 0, 1.2);
        this.windHi.filt.frequency.setTargetAtTime(((forest ? 2600 : 1200) + 1300 * this.gust) * (1 - sn) + (420 + 520 * this.gust) * sn, now, 1.2);
        this.windHi.filt.Q.setTargetAtTime(0.8 + 7 * sn, now, 1.2);
      }
      // Summer insects by day; dry leaves rattling whenever the wind blows
      // in autumn; the fair's crowd when it is near.
      const summer = Math.max(0, 1 - s.bloom - s.leaves - s.snow);
      const day = s.phase === 'night' ? 0 : s.phase === 'dusk' ? 0.4 : 1;
      const open = s.region === 'meadow' || s.region === 'hills' || s.region === 'ranch' ? 1 : 0.6;
      const bugs = 0.05 * summer * day * open * (1 - s.rain);
      if (bugs > 0.003) this.insects ??= this.loop('buzz', 'lowpass', 7000, 0.5);
      this.insects?.set(now, bugs, 0, 1.5);
      const rustle = 0.09 * s.leaves * Math.min(1, w * 1.5);
      if (rustle > 0.003) this.dry ??= this.loop('leaves', 'highpass', 1800, 0.6);
      this.dry?.set(now, rustle, (r() - 0.5) * 0.4, 0.8);
      if (s.fair > 0.01) this.crowd ??= this.loop('crowd', 'lowpass', 3000, 0.5);
      this.crowd?.set(now, 0.16 * s.fair * s.fair, s.fairPan, 0.8);
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
      if (this.rain) {
        // Spring showers are lighter and brighter than autumn rain.
        this.rain.set(now, s.rain * 0.09 * (1 - 0.3 * s.bloom), 0, 1.5);
        this.rain.filt.frequency.setTargetAtTime(3200 + 2000 * s.bloom - 900 * s.leaves, now, 1.5);
      }
    }

    // Hooves and feet: each footfall is one buffer source; in snow, a crunch.
    const snowy = s.snow > 0.5;
    for (const h of s.herd) {
      if (r() < h.rate * dt) {
        const wet = r() < h.water;
        const vol = h.vol * (STEP_VOL[h.sp] ?? 0.12) * (0.5 + 0.5 * r()) * (wet ? 0.6 : 1);
        if (wet) this.sfx.sample('splash', vol, h.pan + (r() - 0.5) * 0.4, 0.9 + 0.2 * r(), now + r() * 0.03);
        else if (snowy) this.sfx.sample('step-snow', vol * 1.2, h.pan + (r() - 0.5) * 0.4, (SNOW_RATE[h.sp] ?? 1) * (0.9 + 0.2 * r()), now + r() * 0.03);
        else this.sfx.sample(`step-${h.sp}`, vol, h.pan + (r() - 0.5) * 0.4, 0.9 + 0.2 * r(), now + r() * 0.03);
      }
    }

    // Wildlife. While the dog rests the day runs fast, and so do they:
    // birds sing sooner and quicker, a little higher.
    const pan = () => (r() * 2 - 1) * 0.85;
    const fast = s.speed;
    const summer = Math.max(0, 1 - s.bloom - s.leaves - s.snow);
    if (s.phase !== 'night') {
      // Birdsong: a dawn chorus at first light (fullest in spring), thinner
      // in autumn, and in winter mostly a lone robin.
      const chorus = 1 + (3 * s.bloom + 1.5 * summer + 0.5 * s.leaves) * s.dawn;
      const season = 1 - 0.4 * s.leaves - 0.7 * s.snow;
      if ((this.birdT -= dt * fast * chorus * season) <= 0) {
        const busy = s.region === 'meadow' || s.region === 'hills' || s.region === null ? 0.7 : 1;
        this.birdT = (2.5 + r() * 5) * busy * (s.phase === 'dusk' ? 2.2 : 1) * (s.rain > 0.3 ? 4 : 1);
        let name = SONG[Math.floor(r() * SONG.length)];
        if (r() < s.snow * 0.8) name = 'robin';
        else if (r() < s.bloom * 0.12) name = 'cuckoo';
        else if (s.leaves > 0.5 && r() < 0.5) name = r() < 0.5 ? 'bird1' : 'bird3';
        if (s.rain < 0.6) this.sfx.sample(name, (0.05 + 0.06 * r()) * (name === 'cuckoo' ? 0.8 : 1), pan(), (0.88 + 0.25 * r()) * (1 + 0.1 * (fast - 1)));
      }
      // Rooks in autumn, more of them towards dusk.
      if (s.leaves > 0.2 && (this.rookT -= dt * fast) <= 0) {
        this.rookT = (6 + r() * 10) / s.leaves / (s.phase === 'dusk' ? 1.6 : 1);
        const p = pan();
        for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) this.sfx.sample('rook', (0.1 + 0.06 * r()) * s.leaves, p + (r() - 0.5) * 0.3, 0.9 + 0.2 * r(), now + k * (0.5 + r() * 0.4));
      }
    }
    // Crickets: summer evenings and nights, a few in spring and autumn,
    // none in the snow.
    const crickets = 0.6 * s.bloom + 1.4 * summer + 0.6 * s.leaves;
    if ((s.phase === 'night' || (s.phase === 'dusk' && summer > 0.5)) && crickets > 0.05 && (this.crickT -= dt * fast * crickets) <= 0) {
      this.crickT = 0.25 + r() * 0.9;
      this.sfx.sample('cricket', 0.035 + 0.05 * r(), pan(), 0.95 + 0.1 * r());
    }
    if (s.phase === 'night') {
      if (s.river > 0.15 && s.snow < 0.5 && (this.frogT -= dt * (1 + s.bloom)) <= 0) {
        this.frogT = (0.7 + r() * 2) / s.river;
        this.sfx.sample('frog', 0.09 * s.river, s.riverPan + (r() - 0.5) * 0.5, 0.85 + 0.3 * r());
      }
      if ((this.owlT -= dt) <= 0) {
        this.owlT = 18 + r() * 25;
        this.sfx.sample('owl', 0.06, pan(), 0.95 + 0.1 * r());
      }
      // Winter nights: wolves somewhere far off.
      if (s.snow > 0.4 && (this.wolfT -= dt) <= 0) {
        this.wolfT = 25 + r() * 30;
        this.sfx.sample('wolves', 0.07 * s.snow, pan(), 0.9 + 0.15 * r(), undefined, 1100);
      }
    }
    // Ice on the river in winter: settling pings and the odd groan.
    if (s.snow > 0.5 && s.river > 0.15 && (this.iceT -= dt) <= 0) {
      this.iceT = 5 + r() * 9;
      this.sfx.sample(r() < 0.6 ? 'ice' : 'icecreak', 0.09 * s.river * s.snow, s.riverPan + (r() - 0.5) * 0.4, 0.8 + 0.4 * r());
    }
    if (s.rain > 0.01 && r() < s.rain * 16 * dt) this.sfx.sample('drip', 0.03 + 0.05 * r(), pan(), 0.7 + 0.7 * r());

    // Thunder. Most strikes are far off: a low roll, late and dull. A near
    // one cracks first, comes almost at once and shakes the speakers.
    if (s.storm > 0.3 && (this.thunderT -= dt) <= 0) {
      this.thunderT = (7 + r() * 14) / s.storm;
      const near = r() * r();
      const delay = 0.25 + (1 - near) * 4.5; // about 3 s per kilometre
      const p = pan();
      this.sfx.strike(near);
      if (near > 0.55) this.sfx.sample('crack', 0.12 + 0.2 * near, p, 0.9 + 0.2 * r(), now + delay);
      this.sfx.sample('thunder', (0.1 + 0.22 * near) * s.storm, p * 0.6, 0.8 + 0.3 * r(), now + delay + (near > 0.55 ? 0.08 : 0), 250 + 3200 * near * near);
    }
  }
}
