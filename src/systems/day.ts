// One day is about five minutes of daylight (06:00 to 20:00), then dusk
// darkens the screen; after it comes the night phase.
export const DAY_LEN = 300;
export const DUSK_AT = 0.8; // fraction of the day when dusk begins
export const NIGHT_LEN = 55;

export type Phase = 'day' | 'dusk' | 'night';

export class DayCycle {
  day = 1;
  t = 0; // seconds into the daylight part
  nightT = 0; // seconds into the night
  phase: Phase = 'day';

  get frac() {
    return Math.min(1, this.t / DAY_LEN);
  }

  // 06:00 at dawn to 20:00 at nightfall, then on to 23:00.
  clock(): string {
    const hours = this.phase === 'night' ? 20 + (this.nightT / NIGHT_LEN) * 3 : 6 + this.frac * 14;
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60 / 10) * 10;
    return `${h}:${m.toString().padStart(2, '0')}`;
  }

  // 0..1 darkness for the dither overlay.
  darkness(): number {
    if (this.phase === 'night') return 0.62;
    const f = this.frac;
    if (f < 0.03) return 0.13 * (1 - f / 0.03); // dawn fading out
    if (f < DUSK_AT) return 0;
    return Math.min(0.62, ((f - DUSK_AT) / (1 - DUSK_AT)) * 0.62);
  }

  update(dt: number): 'dusk' | 'nightfall' | 'dawn' | null {
    if (this.phase === 'night') {
      this.nightT += dt;
      return this.nightT >= NIGHT_LEN ? 'dawn' : null;
    }
    const before = this.frac;
    this.t += dt;
    if (before < DUSK_AT && this.frac >= DUSK_AT) {
      this.phase = 'dusk';
      return 'dusk';
    }
    if (this.t >= DAY_LEN) return 'nightfall';
    return null;
  }

  startNight() {
    this.phase = 'night';
    this.nightT = 0;
  }

  nextDay() {
    this.day++;
    this.t = 0;
    this.nightT = 0;
    this.phase = 'day';
  }
}
