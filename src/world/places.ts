import type { RegionId, SpeciesId } from './map';
import type { Coat } from '../art/animals';

// Hidden places: small pockets off each region, through narrow gaps in the
// forest or up a stream. Each one gives a reason to move animals (a calm
// spot, a stray to fetch, a wild flock, a shortcut home) or something to keep.
// All coordinates are tiles unless they say px. Pockets belong to no region
// (region index 0), so they never count towards a region's morning spawns.

export type PlaceId =
  | 'willow' | 'orchard'
  | 'circle' | 'knoll' | 'trail'
  | 'hut' | 'valley'
  | 'falls' | 'watermeadow'
  | 'hanging' | 'cairn'
  | 'wagon';

export type KeepsakeId = 'bell' | 'crook' | 'horn' | 'whistle' | 'rosette';

export interface Keepsake {
  id: KeepsakeId;
  name: string;
  short: string; // for the Ledger line
  blurb: string;
}

export const KEEPSAKES: Keepsake[] = [
  { id: 'bell', name: 'AN OLD BELL', short: 'BELL', blurb: 'A BRASS BELL FROM A LEAD EWE, LONG AGO' },
  { id: 'crook', name: 'AN OLD CROOK', short: 'CROOK', blurb: 'A HAZEL CROOK, WORN SMOOTH BY A SHEPHERD\'S HAND' },
  { id: 'horn', name: 'A DROVER\'S HORN', short: 'HORN', blurb: 'A COW HORN DROVERS BLEW ON THE ROAD TO MARKET' },
  { id: 'whistle', name: 'A CARVED WHISTLE', short: 'WHISTLE', blurb: 'A BONE WHISTLE, CARVED WITH A RUNNING DOG' },
  { id: 'rosette', name: 'AN OLD ROSETTE', short: 'ROSETTE', blurb: 'A FADED TEAL ROSETTE: BEST IN SHOW, YEARS AGO' },
];
export const keepsakeById = (id: KeepsakeId) => KEEPSAKES.find((k) => k.id === id)!;

// What a place gives.
//  calm: animals resting in it settle fast and their pay recovers
//  keepsake: something to keep
//  stray: a rare animal to bring home for a bonus
//  flock: a wild flock that comes back every few days; wild-bred pays double
//  lookout: the Ledger map fills in for a long way round
//  shortcut: a trail home, latched at the far end until opened from this side
export type PlaceKind = 'calm' | 'keepsake' | 'stray' | 'flock' | 'lookout' | 'shortcut';

export interface PlaceDef {
  id: PlaceId;
  name: string;
  region: RegionId; // counted under, and opens with
  kind: PlaceKind;
  cx: number; // pocket ellipse (tiles); a shortcut has rx = 0
  cy: number;
  rx: number;
  ry: number;
  way: [number, number][]; // the narrow way in, from the region side
  wayR: number;
  pathFrom?: number; // the way is a trodden path from this point on
  mark: [number, number]; // a little waymarker cairn by the way in
  tip: string; // shown on discovery; "(E)" is dropped on touch
  calm?: boolean; // sweet grass: resting animals settle and their pay recovers
  keepsake?: KeepsakeId;
  item?: [number, number]; // where the keepsake lies (px)
  // Ground made at carving time.
  ponds?: [number, number, number, number][]; // cx, cy, rx, ry
  rocks?: [number, number, number][]; // cx, cy, r
  trees?: [number, number, number][];
  stream?: [number, number][]; // single shallow tiles
}

export const PLACES: PlaceDef[] = [
  // ---- Home Meadow ----
  {
    id: 'willow', name: 'WILLOW POOL', region: 'meadow', kind: 'calm', calm: true,
    cx: 183, cy: 103.5, rx: 5.2, ry: 4.8, way: [[170, 105], [178, 104]], wayR: 1.7, mark: [170, 102],
    tip: 'STILL WATER SETTLES ANY FLOCK. LET A RATTLED ONE REST HERE AND ITS PAY RECOVERS.',
    ponds: [[185, 104, 2.3, 1.7]],
  },
  {
    id: 'orchard', name: 'THE OLD ORCHARD', region: 'meadow', kind: 'keepsake',
    cx: 176, cy: 132, rx: 6.6, ry: 5.2, way: [[162, 118], [167, 123], [172, 128]], wayR: 1.5, mark: [160, 119],
    tip: 'A FORGOTTEN ORCHARD. LITTLE CAIRNS LIKE THE ONE YOU PASSED MARK OTHER HIDDEN WAYS.',
    keepsake: 'bell', item: [1406, 1060],
  },
  // ---- Rolling Hills ----
  {
    id: 'circle', name: 'THE STONE CIRCLE', region: 'hills', kind: 'stray', calm: true,
    cx: 183, cy: 42, rx: 5.2, ry: 5.6, way: [[171, 46], [175, 47], [178, 44]], wayR: 1.9, mark: [170, 48],
    tip: 'SWEET GRASS IN THE RING SETTLES A FLOCK. A BLACK SHEEP GRAZES HERE: A LONE SHEEP FRETS, SO WALK HER TO A FLOCK AND BRING THEM HOME TOGETHER.',
  },
  {
    id: 'knoll', name: 'LOOKOUT KNOLL', region: 'hills', kind: 'lookout',
    cx: 166, cy: 28, rx: 4.2, ry: 3.6, way: [[160, 37], [164, 31]], wayR: 1.5, mark: [157, 38],
    tip: 'THE WHOLE VALLEY FROM UP HERE. THE LEDGER MAP NOW SHOWS CLEARINGS YOU HAVE NOT WALKED.',
    rocks: [[162.5, 26, 1.2], [169.5, 25.5, 1.1], [170.5, 30, 0.9]],
  },
  {
    id: 'trail', name: 'THE DROVE TRAIL', region: 'hills', kind: 'shortcut',
    cx: 0, cy: 0, rx: 0, ry: 0, way: [[132, 67], [128, 75], [124, 82], [119, 88], [118, 98]], wayR: 1.8, pathFrom: 1, mark: [134, 65],
    tip: 'A DROVE TRAIL FROM THE ROLLING HILLS DOWN TO THE RANCH: A SHORT WAY HOME.',
  },
  // ---- Rocky Rise ----
  {
    id: 'hut', name: 'THE SHEPHERD\'S HUT', region: 'rocky', kind: 'keepsake',
    cx: 36, cy: 82, rx: 6.6, ry: 4.6, way: [[37, 68], [36, 72], [37, 77]], wayR: 1.5, mark: [40, 68],
    tip: 'A RUINED HUT AND ITS OLD FOLD. WHOEVER LIVED HERE LEFT SOMETHING BEHIND.',
    keepsake: 'crook', item: [270, 652],
  },
  {
    id: 'valley', name: 'THE HIDDEN VALLEY', region: 'rocky', kind: 'flock',
    cx: 14, cy: 84, rx: 8, ry: 6, way: [[25, 64], [21, 71], [17, 78]], wayR: 1.9, mark: [28, 63],
    tip: 'A WILD FLOCK GRAZES HERE. WILD-BRED STOCK PAYS DOUBLE WHEN PENNED. THEY COME BACK EVERY FEW DAYS.',
    rocks: [[8, 80, 1.3], [19, 88, 1.1], [7, 87, 1]],
    trees: [[12, 89.5, 1.2], [19, 79, 1]],
  },
  // ---- River Ford ----
  {
    id: 'falls', name: 'THE WATERFALL POOL', region: 'ford', kind: 'stray',
    cx: 54, cy: 84.5, rx: 4.6, ry: 4, way: [[58, 101], [58, 95], [57, 89]], wayR: 1.8, mark: [61, 101],
    tip: 'A LOST HEIFER BY THE FALLS. SHE WILL NOT WADE THE STREAM UNLESS NIPPED (E). BRING HER HOME FOR A BONUS.',
    ponds: [[53.5, 82, 2.4, 1.5]],
    rocks: [[53.5, 79, 2.4]],
    stream: [[55, 84], [55, 85], [55, 86], [55, 87], [55, 88], [55, 89], [55, 90]],
  },
  {
    id: 'watermeadow', name: 'THE WATER MEADOW', region: 'ford', kind: 'keepsake',
    cx: 26, cy: 161, rx: 8, ry: 3.4, way: [[30, 150], [28, 154], [27, 158]], wayR: 1.5, mark: [33, 150],
    tip: 'A WET MEADOW WHERE THE OLD DROVE ROAD RAN. SOMETHING IS CAUGHT ON THE MARKER POST.',
    keepsake: 'horn', item: [252, 1286],
    ponds: [[20, 162, 2.2, 1.3]],
  },
  // ---- High Range ----
  {
    id: 'hanging', name: 'THE HANGING VALLEY', region: 'high', kind: 'flock',
    cx: 182, cy: 22, rx: 5.4, ry: 4.4, way: [[166, 14], [172, 13], [177, 15], [180, 19]], wayR: 1.9, mark: [165, 17],
    tip: 'WILD PONIES. WILD-BRED STOCK PAYS DOUBLE WHEN PENNED. WORK WIDE AND SLOW THROUGH THE GAP.',
    rocks: [[178, 25.5, 1], [186.5, 25, 1.1]],
    trees: [[185.5, 18.5, 1]],
  },
  {
    id: 'cairn', name: 'THE OLD CAIRN', region: 'high', kind: 'keepsake',
    cx: 10, cy: 25, rx: 5, ry: 4.2, way: [[27, 16], [21, 19], [15, 23]], wayR: 1.5, mark: [28, 18],
    tip: 'AN OLD CAIRN ON THE ROOF OF THE VALLEY. SOMETHING IS TUCKED IN AMONG THE STONES.',
    keepsake: 'whistle', item: [86, 210],
  },
  // ---- Show Ground ----
  {
    id: 'wagon', name: 'THE SHOWMAN\'S WAGON', region: 'show', kind: 'keepsake',
    cx: 75, cy: 157, rx: 5.4, ry: 3.8, way: [[84, 154], [79, 156]], wayR: 1.5, mark: [85, 152],
    tip: 'AN OLD SHOWMAN\'S WAGON, LEFT TO THE TREES. A ROSETTE STILL HANGS BY THE STEPS.',
    keepsake: 'rosette', item: [614, 1266],
  },
];

export const placeById = (id: PlaceId) => PLACES.find((p) => p.id === id)!;

// Is a pixel inside a place's pocket? (`k` scales the ellipse.)
export function inPlace(p: PlaceDef, x: number, y: number, k = 1): boolean {
  if (!p.rx) return false;
  const dx = (x / 8 - p.cx) / (p.rx * k), dy = (y / 8 - p.cy) / (p.ry * k);
  return dx * dx + dy * dy < 1;
}

// ---- Things standing in the places (px), drawn by src/art/landmarks.ts ----
// (and, for the valley projects, by src/art/projects.ts)
export type PropKind =
  | 'stone' | 'fallen' | 'cairn' | 'fruit' | 'willow' | 'post' | 'hutwall' | 'fold' | 'wagon' | 'falls'
  // Valley projects (src/systems/projects.ts):
  | 'reeds' | 'bramble' | 'scrub' | 'hutfixed' | 'foldgate' | 'slates' | 'fieldstone' | 'sign' | 'hayrick' | 'wheelpit' | 'waterwheel' | 'mud';
export interface Prop {
  kind: PropKind;
  place: PlaceId | null;
  x: number;
  y: number; // base (feet) of the thing, for the y-sort
  w?: number;
  h?: number;
  v?: number; // variant
  solid?: [number, number, number, number]; // px rect that blocks, relative to x, y
  // Valley projects:
  project?: string; // the project this belongs to
  when?: 'before' | 'after'; // shown until it is done / once it is done
  ring?: number; // a ring stone, raised by the (ring+1)th stone brought
  stage?: number; // overgrowth, cleared once the project is this far along (0..1)
  pile?: number; // a load waiting at its pile (shown while it is there)
  shut?: boolean; // blocks only while shut (the fold's gate)
}

// What the props need to know of the valley projects (src/systems/projects.ts).
export interface ProjectView {
  isDone(id: string): boolean;
  delivered(id: string): number; // loads brought so far
  foldShut: boolean;
}

// Is a prop there, given how the projects stand?
export function propShown(p: Prop, v: ProjectView | null): boolean {
  if (!p.project) return true;
  const done = !!v?.isDone(p.project);
  if (p.when === 'before') return !done;
  if (p.when === 'after') return done;
  if (p.ring !== undefined) return done || (v?.delivered(p.project) ?? 0) > p.ring;
  return true;
}

// Does it block (its `solid` rect), given how the projects stand?
export function propBlocks(p: Prop, v: ProjectView | null): boolean {
  return !!p.solid && propShown(p, v) && (!p.shut || !!v?.foldShut);
}

function stoneRing(): Prop[] {
  const out: Prop[] = [];
  const cx = 1468, cy = 340;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const x = Math.round(cx + Math.cos(a) * 27), y = Math.round(cy + Math.sin(a) * 22);
    // Four stones lie out in the hills until ponies bring them back (the
    // circle project), and the fallen one is raised when it is done.
    const missing = [1, 3, 6, 7].indexOf(i);
    if (i === 5) {
      out.push({ kind: 'fallen', place: 'circle', x, y, v: i, solid: [-6, -2, 12, 4], project: 'circle', when: 'before' });
      out.push({ kind: 'stone', place: 'circle', x, y, v: i, solid: [-2, -3, 5, 4], project: 'circle', when: 'after' });
    } else if (missing >= 0) out.push({ kind: 'stone', place: 'circle', x, y, v: i, solid: [-2, -3, 5, 4], project: 'circle', ring: missing });
    else out.push({ kind: 'stone', place: 'circle', x, y, v: i, solid: [-2, -3, 5, 4] });
  }
  return out;
}

export const PROPS: Prop[] = [
  ...stoneRing(),
  // Willow Pool
  { kind: 'willow', place: 'willow', x: 1450, y: 834, solid: [-2, -3, 5, 4] },
  // The Old Orchard: old fruit trees in rough rows, a post with a bell.
  ...([[1388, 1048], [1416, 1042], [1442, 1050], [1396, 1078], [1430, 1082], [1452, 1072]] as const).map(
    ([x, y], i): Prop => ({ kind: 'fruit', place: 'orchard', x, y, v: i, solid: [-2, -3, 5, 4] }),
  ),
  { kind: 'post', place: 'orchard', x: 1406, y: 1060, v: 0, solid: [-1, -2, 3, 3] },
  // Lookout Knoll: a big cairn on the top.
  { kind: 'cairn', place: 'knoll', x: 1332, y: 228, v: 1, solid: [-5, -4, 10, 5] },
  // The Shepherd's Hut: four broken walls and a fold beside it.
  { kind: 'hutwall', place: 'hut', x: 248, y: 632, w: 48, h: 4, v: 0, solid: [0, -4, 32, 4], project: 'hut', when: 'before' }, // back (north), the east end fallen
  { kind: 'hutwall', place: 'hut', x: 248, y: 664, w: 18, h: 4, v: 2, solid: [0, -4, 18, 4], project: 'hut', when: 'before' }, // front, west of the door
  { kind: 'hutwall', place: 'hut', x: 278, y: 664, w: 18, h: 4, v: 2, solid: [0, -4, 18, 4], project: 'hut', when: 'before' }, // front, east of the door
  { kind: 'hutwall', place: 'hut', x: 248, y: 662, w: 4, h: 30, v: 1, solid: [0, -30, 4, 30], project: 'hut', when: 'before' }, // west
  { kind: 'hutwall', place: 'hut', x: 292, y: 662, w: 4, h: 22, v: 1, solid: [0, -22, 4, 22], project: 'hut', when: 'before' }, // east, top fallen
  // The fold: a low drystone square on the hut's east side, open to the south.
  { kind: 'fold', place: 'hut', x: 300, y: 652, w: 26, h: 4, v: 0, solid: [0, -4, 26, 4] },
  { kind: 'fold', place: 'hut', x: 300, y: 676, w: 4, h: 24, v: 1, solid: [0, -24, 4, 24] },
  { kind: 'fold', place: 'hut', x: 322, y: 676, w: 4, h: 24, v: 1, solid: [0, -24, 4, 24] },
  { kind: 'fold', place: 'hut', x: 300, y: 678, w: 8, h: 4, v: 0, solid: [0, -4, 8, 4] },
  { kind: 'fold', place: 'hut', x: 318, y: 678, w: 8, h: 4, v: 0, solid: [0, -4, 8, 4] },
  // River falls: water coming off the rocks into the pool.
  { kind: 'falls', place: 'falls', x: 428, y: 654, w: 9, h: 20 },
  // The Water Meadow: an old drove-road marker post.
  { kind: 'post', place: 'watermeadow', x: 252, y: 1286, v: 1, solid: [-1, -2, 3, 3] },
  // The Old Cairn.
  { kind: 'cairn', place: 'cairn', x: 80, y: 202, v: 2, solid: [-6, -5, 12, 6] },
  // The Showman's Wagon.
  { kind: 'wagon', place: 'wagon', x: 596, y: 1260, solid: [-13, -8, 26, 8] },
];

// ---- The valley projects' things (px), drawn by src/art/projects.ts ----

// Overgrowth scattered over a pocket: n clumps in an ellipse (px), kept off
// the given spots, each cleared at its own stage of the project.
function overgrowth(kind: PropKind, project: string, place: PlaceId, cx: number, cy: number, rx: number, ry: number, n: number, keep: [number, number][]): Prop[] {
  const out: Prop[] = [];
  for (let i = 0, k = 0; out.length < n && k < 400; k++) {
    const a = k * 2.399963, r = Math.sqrt((k + 0.5) / (n * 1.6));
    if (r > 1) break;
    const x = Math.round(cx + Math.cos(a) * rx * r), y = Math.round(cy + Math.sin(a) * ry * r);
    if (keep.some(([kx, ky]) => Math.hypot(kx - x, ky - y) < 11)) continue;
    out.push({ kind, place, project, x, y, v: k, stage: (i + 1) / (n + 1) });
    i++;
  }
  return out;
}

export const WORKS: Prop[] = [
  // Willow Pool: reeds choke the pool until ducks keep them down; then a
  // hay meadow on the drained edge.
  ...overgrowth('reeds', 'reeds', 'willow', 1468, 834, 36, 30, 16, [[1450, 834], [1436, 852], [1458, 864]]),
  { kind: 'hayrick', place: 'willow', project: 'reeds', when: 'after', x: 1458, y: 864, solid: [-7, -3, 14, 4] },
  { kind: 'sign', place: 'willow', project: 'reeds', x: 1436, y: 852 },
  // The Old Orchard: brambles and long grass between the trees.
  ...overgrowth('bramble', 'orchard', 'orchard', 1414, 1060, 46, 36, 16, [[1388, 1048], [1416, 1042], [1442, 1050], [1396, 1078], [1430, 1082], [1452, 1072], [1406, 1060], [1384, 1034]]),
  { kind: 'sign', place: 'orchard', project: 'orchard', x: 1384, y: 1034 },
  // The Hidden Valley: scrub over its west end.
  ...overgrowth('scrub', 'scrub', 'valley', 76, 672, 34, 36, 14, [[64, 640], [56, 696], [96, 716]]),
  { kind: 'sign', place: 'valley', project: 'scrub', x: 128, y: 640 },
  // The Shepherd's Hut: mended, with a gate on the fold; slate from the
  // quarry under the outcrop in Rocky Rise.
  { kind: 'hutfixed', place: 'hut', project: 'hut', when: 'after', x: 248, y: 664, w: 48, h: 36, solid: [0, -36, 48, 36] },
  { kind: 'foldgate', place: 'hut', project: 'hut', when: 'after', x: 308, y: 678, w: 10, h: 4, solid: [0, -4, 10, 4], shut: true },
  { kind: 'slates', place: null, project: 'hut', x: 452, y: 532, solid: [-9, -4, 18, 6] },
  { kind: 'sign', place: 'hut', project: 'hut', x: 236, y: 690 },
  // The Waterfall Pool: a leaking pool and a broken wheel pit; once cattle
  // have puddled the clay, a waterwheel turns beside the falls.
  ...([[420, 674], [436, 668], [412, 662], [446, 682]] as const).map(([x, y], i): Prop => ({ kind: 'mud', place: 'falls', project: 'mill', when: 'before', x, y, v: i })),
  { kind: 'wheelpit', place: 'falls', project: 'mill', when: 'before', x: 444, y: 692, solid: [-7, -3, 14, 4] },
  { kind: 'waterwheel', place: 'falls', project: 'mill', when: 'after', x: 444, y: 692, solid: [-9, -3, 18, 4] },
  { kind: 'sign', place: 'falls', project: 'mill', x: 460, y: 700 },
  // The Stone Circle: four stones lie fallen about the Rolling Hills.
  ...([[1044, 404], [1204, 308], [1284, 484], [1364, 404]] as const).map(([x, y], i): Prop => ({ kind: 'fieldstone', place: null, project: 'circle', x, y, pile: i, v: i })),
  { kind: 'sign', place: 'circle', project: 'circle', x: 1436, y: 368 },
];

// Rare strays and wild flocks, and where they turn up (px).
export interface Finder {
  place: PlaceId;
  species: SpeciesId;
  coat: Coat;
  n: number;
  x: number;
  y: number;
  bonus?: number; // a stray: coin for bringing it home (before the calm bonus)
  label: string; // banner when home
}
export const FINDS: Finder[] = [
  { place: 'circle', species: 'sheep', coat: 1, n: 1, x: 1468, y: 340, bonus: 20, label: 'THE BLACK SHEEP' },
  { place: 'falls', species: 'cow', coat: 1, n: 1, x: 410, y: 690, bonus: 30, label: 'THE LOST HEIFER' },
  { place: 'valley', species: 'goat', coat: 1, n: 5, x: 112, y: 672, label: 'WILD GOATS' },
  { place: 'hanging', species: 'pony', coat: 2, n: 4, x: 1456, y: 178, label: 'WILD PONIES' },
];
export const FLOCK_EVERY = 3; // days before a wild flock comes back
