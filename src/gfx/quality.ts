// How much atmosphere to draw. HIGH is everything; MEDIUM and LOW thin what
// is only there for mood (rain streaks, cloud shadows, butterflies and
// fireflies, grass bending in the wind) so a slow phone keeps its frame
// rate. The night, the herd, the ranch and everything you play with look the
// same at every level.
//
// The setting (pause menu, GRAPHICS) is AUTO unless the player picks one:
// AUTO watches how long each frame's work takes and steps down a level when
// frames run long, and back up when there is plenty of time to spare.

export type Level = 'high' | 'medium' | 'low';
export type QualitySetting = 'auto' | Level;
export const LEVELS: Level[] = ['high', 'medium', 'low'];

export const quality = {
  level: 'high' as Level,
  fx: 1, // share of the mood particles drawn (rain, splashes, critters)
  shade: true, // cloud shadows and the wet-ground dither
  sway: true, // grass and reeds bend in gusts
};

export function setLevel(l: Level) {
  quality.level = l;
  quality.fx = l === 'high' ? 1 : l === 'medium' ? 0.6 : 0.35;
  quality.shade = l !== 'low';
  quality.sway = l !== 'low';
}

// The automatic level. Fed once per drawn frame with the milliseconds our
// own work took (update + render).
const BUDGET = 12; // ms: leaves the browser time to put the frame on screen
const SPARE = 6;

export class AutoQuality {
  private avg = 0;
  private slowT = 0;
  private fastT = 0;
  private settle = 0; // seconds before it may step up again
  private dropped = 0; // times it has had to step down

  frame(workMs: number, dt: number, setting: QualitySetting) {
    if (setting !== 'auto') {
      if (quality.level !== setting) setLevel(setting);
      return;
    }
    // A long frame now and then (a save, a bake, the tab coming back) is not
    // a slow phone: one frame counts for at most three budgets.
    const w = Math.min(workMs, BUDGET * 3);
    this.avg = this.avg ? this.avg + (w - this.avg) * 0.05 : w;
    this.settle = Math.max(0, this.settle - dt);
    const i = LEVELS.indexOf(quality.level);
    this.slowT = this.avg > BUDGET ? this.slowT + dt : 0;
    this.fastT = this.avg < SPARE ? this.fastT + dt : 0;
    if (this.slowT > 1.5 && i < LEVELS.length - 1) {
      setLevel(LEVELS[i + 1]);
      this.slowT = 0;
      this.avg = BUDGET; // judge the new level afresh
      this.dropped++;
      // Each time it has to drop, it waits longer before trying higher.
      this.settle = 20 * this.dropped;
    } else if (this.fastT > 8 && this.settle <= 0 && i > 0) {
      setLevel(LEVELS[i - 1]);
      this.fastT = 0;
      this.avg = SPARE;
    }
  }
}
