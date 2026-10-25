// Seasons: the state the rest of the game reads. The gameplay side decides
// the calendar (how many days a season lasts, lambing, shearing, the fair,
// winter feed); render draws it, audio hears it, the HUD shows it and co-op
// sends it to friends. Levels ease towards their targets so a season turns
// gently rather than popping.
//
// Readers use only these fields: `season`, `progress`, `bloom`, `leaves`,
// `snow`. Until the calendar is wired every day is summer, which is the
// look the game has always had. `?debug&season=winter` (or spring, autumn)
// holds a season for testing.

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASON_LIST: Season[] = ['spring', 'summer', 'autumn', 'winter'];

// Target levels for each season, 0..1.
const LOOK: Record<Season, { bloom: number; leaves: number; snow: number }> = {
  spring: { bloom: 1, leaves: 0, snow: 0 },
  summer: { bloom: 0, leaves: 0, snow: 0 },
  autumn: { bloom: 0, leaves: 1, snow: 0 },
  winter: { bloom: 0, leaves: 0, snow: 1 },
};

export class Seasons {
  season: Season = 'summer';
  progress = 0; // 0..1 through the current season
  bloom = 0; // blossom and spring flowers
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
