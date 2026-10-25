// Seasons: the state the rest of the game reads. The gameplay side decides
// the calendar (how many days a season lasts, lambing, shearing, the fair,
// winter feed); render draws it, audio hears it, the HUD shows it and co-op
// sends it to friends. Levels ease towards their targets so a season turns
// gently rather than popping.
//
// Readers use only these fields: `season`, `progress`, `bloom`, `leaves`,
// `snow`, and `year` / `dayOf` (day 1..SEASON_DAYS of the season).
// `?debug&season=winter` (or spring, summer, autumn) holds a season for
// testing.
//
// The calendar: a new game starts on the first day of spring, year 1, and
// each season lasts SEASON_DAYS days. What each brings (src/systems/
// seasonal.ts): spring, lambs born to ewes in your pens and out on the
// hills; summer, the shearer; autumn, the fair at the Show Ground with rare
// breeds for sale; winter, snow, short days, fewer wild flocks, and penned
// stock eats hay every night.

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASON_LIST: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_DAYS = 4;
export const YEAR_DAYS = SEASON_DAYS * SEASON_LIST.length;

// Target levels for each season, 0..1.
const LOOK: Record<Season, { bloom: number; leaves: number; snow: number }> = {
  spring: { bloom: 1, leaves: 0, snow: 0 },
  summer: { bloom: 0, leaves: 0, snow: 0 },
  autumn: { bloom: 0, leaves: 1, snow: 0 },
  winter: { bloom: 0, leaves: 0, snow: 1 },
};

// Day 1 is the first day of spring in year 1.
export function calendar(day: number): { season: Season; year: number; dayOf: number } {
  const d = Math.max(0, day - 1);
  return {
    season: SEASON_LIST[Math.floor((d % YEAR_DAYS) / SEASON_DAYS)],
    year: Math.floor(d / YEAR_DAYS) + 1,
    dayOf: (d % SEASON_DAYS) + 1,
  };
}

// How the day itself changes: winter days run faster to dusk, which comes
// earlier.
export const DAY_PACE: Record<Season, { pace: number; duskAt: number }> = {
  spring: { pace: 1, duskAt: 0.8 },
  summer: { pace: 1, duskAt: 0.82 },
  autumn: { pace: 1.1, duskAt: 0.76 },
  winter: { pace: 1.25, duskAt: 0.7 },
};

export class Seasons {
  season: Season = 'spring';
  progress = 0; // 0..1 through the current season
  year = 1;
  dayOf = 1; // day of the season, 1..SEASON_DAYS
  bloom = LOOK.spring.bloom; // blossom and spring flowers
  leaves = 0; // turned and falling leaves
  snow = 0; // snow cover on the ground and roofs
  forced = false; // a debug override holds the season

  set(season: Season, progress = 0) {
    this.season = season;
    this.progress = progress;
  }

  force(season: Season) {
    this.set(season);
    this.snap();
    this.forced = true;
  }

  // The calendar for a morning (a new day, a new game, a loaded save).
  morning(day: number) {
    const c = calendar(day);
    this.year = c.year;
    this.dayOf = c.dayOf;
    if (!this.forced) this.season = c.season;
    this.progress = (this.dayOf - 1) / SEASON_DAYS;
  }

  // Through the day: `frac` is how far through the daylight we are.
  tick(frac: number) {
    this.progress = Math.min(1, (this.dayOf - 1 + Math.min(1, frac)) / SEASON_DAYS);
  }

  // The season a given day falls in (or the held one).
  on(day: number): Season {
    return this.forced ? this.season : calendar(day).season;
  }

  get winter() {
    return this.season === 'winter';
  }

  // Jump straight to the season's levels (a new game, a loaded save).
  snap() {
    const l = LOOK[this.season];
    this.bloom = l.bloom;
    this.leaves = l.leaves;
    this.snow = l.snow;
  }

  update(dt: number) {
    const l = LOOK[this.season];
    const k = 1 - Math.exp(-dt / 8);
    this.bloom += (l.bloom - this.bloom) * k;
    this.leaves += (l.leaves - this.leaves) * k;
    this.snow += (l.snow - this.snow) * k;
  }
}
