// Weather: the state the rest of the game reads. The gameplay side decides
// it (which days get which sky, and what it does to the herd); render draws
// it, audio hears it and the HUD shows it. Everything here eases towards its
// target so a change of sky never pops.
//
// Readers use only these fields: `sky`, `rain`, `fog`, `wind`, `windX`,
// `windY`, `forecast`. `?debug&weather=rain` (or fog, wind, storm) forces a
// sky for testing.

export type Sky = 'clear' | 'wind' | 'rain' | 'fog' | 'storm';

export const SKIES: Sky[] = ['clear', 'wind', 'rain', 'fog', 'storm'];

// Target levels for each sky.
const LOOK: Record<Sky, { rain: number; fog: number; wind: number }> = {
  clear: { rain: 0, fog: 0, wind: 0.25 },
  wind: { rain: 0, fog: 0, wind: 0.9 },
  rain: { rain: 0.6, fog: 0.1, wind: 0.4 },
  fog: { rain: 0, fog: 0.8, wind: 0.05 },
  storm: { rain: 1, fog: 0.2, wind: 1 },
};

export class Weather {
  sky: Sky = 'clear';
  rain = 0; // 0..1, how hard it is raining now
  fog = 0; // 0..1, how thick the fog is now
  wind = LOOK.clear.wind; // 0..1 steady wind strength (gusts ride on top)
  dirX = 1; // unit vector the wind blows towards
  dirY = 0.3 / Math.hypot(1, 0.3);
  forecast: Sky = 'clear'; // tomorrow's sky, for the summary and HUD
  forced = false; // a debug override holds the sky

  get windX() {
    return this.dirX * this.wind;
  }

  get windY() {
    return this.dirY * this.wind;
  }

  set(sky: Sky) {
    this.sky = sky;
  }

  force(sky: Sky) {
    this.set(sky);
    const l = LOOK[sky];
    this.rain = l.rain;
    this.fog = l.fog;
    this.wind = l.wind;
    this.forced = true;
  }

  update(dt: number) {
    const l = LOOK[this.sky];
    const k = 1 - Math.exp(-dt / 6); // about 6s to settle into a new sky
    this.rain += (l.rain - this.rain) * k;
    this.fog += (l.fog - this.fog) * k;
    this.wind += (l.wind - this.wind) * k;
  }
}
