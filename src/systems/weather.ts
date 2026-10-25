// Weather: the state the rest of the game reads. The gameplay side decides
// it (which days get which sky, and what it does to the herd); render draws
// it, audio hears it and the HUD shows it. Everything here eases towards its
// target so a change of sky never pops.
//
// Readers use only these fields: `sky`, `rain`, `fog`, `wind`, `windX`,
// `windY`, `forecast`, `sight`. `?debug&weather=rain` (or fog, wind, storm)
// forces a sky for testing.
//
// Which days: tier 1 is always clear. From tier 2 about half the days are
// clear and the rest windy, rainy or foggy; storms come in from tier 4.
// `forecast` is always tomorrow's sky: rolled each morning as today's comes
// in, so it can be shown all day and on the end-of-day card.
//
// What it does to the herd (src/entities/animal.ts):
// - wind: flocks drift downwind as they graze; driving with the wind is
//   easier than against it; a bark carries further downwind.
// - rain: flocks bunch and drift to the nearest tree cover; stock left out
//   frets a little.
// - fog: a smaller but jumpier flight zone (anything rushing in startles
//   them more); you can only see so far (`sight`).
// - storm: wind and rain together, and bolder predators at night.

export type Sky = 'clear' | 'wind' | 'rain' | 'fog' | 'storm';

export const SKIES: Sky[] = ['clear', 'wind', 'rain', 'fog', 'storm'];

// Tomorrow's sky. Tier 1 stays clear for the tutorial days.
export function rollSky(tier: number, stormedToday: boolean, r: () => number = Math.random): Sky {
  if (tier < 2) return 'clear';
  const odds: [Sky, number][] = [['clear', 0.5], ['wind', 0.17], ['rain', 0.17], ['fog', 0.16]];
  if (tier >= 4 && !stormedToday) odds.push(['storm', 0.08]);
  let x = r() * odds.reduce((s, o) => s + o[1], 0);
  for (const [sky, w] of odds) if ((x -= w) < 0) return sky;
  return 'clear';
}

// One line for the morning banner, and a first-time tip, per sky.
export const SKY_LINE: Record<Sky, string> = {
  clear: 'BRING THEM HOME BEFORE DUSK',
  wind: 'WINDY: FLOCKS DRIFT DOWNWIND',
  rain: 'RAIN: FLOCKS BUNCH AND MAKE FOR THE TREES',
  fog: 'FOG: YOU CANNOT SEE FAR. GO SOFTLY',
  storm: 'STORM: WIND AND RAIN, AND A BOLD NIGHT',
};
export const SKY_TIP: Partial<Record<Sky, string>> = {
  wind: 'WIND PUSHES A GRAZING FLOCK DOWNWIND, AND DRIVING INTO IT IS SLOW. A BARK CARRIES FURTHER DOWNWIND.',
  rain: 'IN RAIN THE FLOCKS BUNCH UP AND DRIFT TO THE TREES FOR COVER. STOCK LEFT OUT IN IT SLOWLY FRETS.',
  fog: 'IN FOG YOU ONLY SEE FLOCKS CLOSE BY, AND THEY STARTLE IF YOU RUSH IN. WALK UP SLOWLY.',
  storm: 'A STORM: WIND AND RAIN TOGETHER. TONIGHT THE COYOTES ARE BOLD: GET EVERYONE HOME.',
};

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
  private stormed = false; // a storm yesterday: not two in a row

  get windX() {
    return this.dirX * this.wind;
  }

  get windY() {
    return this.dirY * this.wind;
  }

  // How far off you can make out a flock, in pixels: the fog closes in.
  get sight() {
    return this.fog < 0.05 ? 1e9 : 520 - 400 * Math.min(1, this.fog);
  }

  // The morning: today's sky arrives (yesterday's forecast) and tomorrow's
  // is rolled. The wind picks a new quarter each day.
  newDay(tier: number, r: () => number = Math.random) {
    if (!this.forced) this.set(tier < 2 ? 'clear' : this.forecast);
    const a = r() * Math.PI * 2;
    this.dirX = Math.cos(a);
    this.dirY = Math.sin(a);
    this.stormed = this.sky === 'storm';
    this.forecast = rollSky(tier, this.stormed, r);
  }

  // Bark reach towards a point at (dx, dy) from the dog: further downwind,
  // shorter upwind.
  reach(range: number, dx: number, dy: number) {
    const d = Math.hypot(dx, dy) || 1;
    return range * (1 + 0.4 * ((dx / d) * this.windX + (dy / d) * this.windY));
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
