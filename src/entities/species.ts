import type { SpeciesId } from '../world/map';

export interface Species {
  id: SpeciesId;
  name: string;
  plural: string;
  r: number; // body radius (px)
  graze: number; // ambling speed
  walk: number; // calm driven speed
  run: number; // flat-out flight speed
  accel: number; // px/s^2
  turn: number; // rad/s
  flight: number; // flight zone radius (px)
  nbr: number; // neighbour radius for flocking
  sep: number; // personal space
  wCoh: number;
  wSep: number;
  wAli: number;
  stressGain: number; // how much pressure upsets them
  stressDecay: number; // per second when calm
  barkMul: number; // how hard a bark shoves them
  barkStress: number;
  nipMul: number;
  nipStress: number;
  stubborn: number; // 0..1: share of the flight zone that is ignored
  social: number; // stress per second when alone
  wander: number; // chance an individual is a wanderer
  climbs: boolean; // goats walk on rocks
  balksWater: boolean; // cattle refuse water unless pushed hard
  space: number; // pen space used
  value: number; // coin on delivery (before calm bonus)
  good: string | null;
  goodEvery: number; // seconds per good per animal
  goodValue: number;
  spawnGroup: [number, number];
  coats: number;
  splitter?: boolean; // stress breaks the group up instead of bunching it
  momentum?: number; // seconds a push keeps them plodding on
}

export const SPECIES: Record<SpeciesId, Species> = {
  // Tight, slow and forgiving: the tutorial flock.
  duck: {
    id: 'duck', name: 'Duck', plural: 'Ducks',
    r: 2.5, graze: 6, walk: 18, run: 34, accel: 120, turn: 6,
    flight: 30, nbr: 26, sep: 6, wCoh: 1.6, wSep: 1.2, wAli: 0.9,
    stressGain: 0.22, stressDecay: 0.12, barkMul: 0.9, barkStress: 0.5, nipMul: 0.6, nipStress: 0.35,
    stubborn: 0, social: 0.03, wander: 0.08, climbs: false, balksWater: false,
    space: 1, value: 2, good: 'Eggs', goodEvery: 80, goodValue: 1, spawnGroup: [5, 7], coats: 1,
  },
  // The classic flock.
  sheep: {
    id: 'sheep', name: 'Sheep', plural: 'Sheep',
    r: 3.5, graze: 7, walk: 24, run: 58, accel: 110, turn: 4.2,
    flight: 44, nbr: 32, sep: 9, wCoh: 1.2, wSep: 1.4, wAli: 0.8,
    stressGain: 0.38, stressDecay: 0.09, barkMul: 1, barkStress: 0.7, nipMul: 0.8, nipStress: 0.3,
    stubborn: 0, social: 0.04, wander: 0.12, climbs: false, balksWater: false,
    space: 2, value: 5, good: 'Wool', goodEvery: 230, goodValue: 4, spawnGroup: [6, 9], coats: 1,
  },
  // Independent; they split up and climb rocks the dog cannot.
  goat: {
    id: 'goat', name: 'Goat', plural: 'Goats',
    r: 3.5, graze: 9, walk: 26, run: 60, accel: 130, turn: 5,
    flight: 38, nbr: 34, sep: 10, wCoh: 0.85, wSep: 1.3, wAli: 0.5,
    stressGain: 0.36, stressDecay: 0.1, barkMul: 1, barkStress: 0.7, nipMul: 0.9, nipStress: 0.25,
    stubborn: 0.1, social: 0, wander: 0.15, climbs: true, balksWater: false,
    space: 2, value: 8, good: 'Cheese', goodEvery: 220, goodValue: 6, spawnGroup: [5, 7], coats: 2, splitter: true,
  },
  // Heavy and stubborn: only close pressure or a nip really moves them.
  cow: {
    id: 'cow', name: 'Cow', plural: 'Cattle',
    r: 5.5, graze: 5, walk: 20, run: 40, accel: 40, turn: 1.9,
    flight: 34, nbr: 40, sep: 14, wCoh: 0.9, wSep: 1.5, wAli: 0.9,
    stressGain: 0.2, stressDecay: 0.08, barkMul: 0.35, barkStress: 0.35, nipMul: 1.6, nipStress: 0.06,
    stubborn: 0.45, social: 0.02, wander: 0.1, climbs: false, balksWater: true,
    space: 4, value: 14, good: 'Milk', goodEvery: 190, goodValue: 9, spawnGroup: [4, 6], coats: 2, momentum: 1.6,
  },
  // Fast and skittish with huge flight zones: the endgame.
  pony: {
    id: 'pony', name: 'Pony', plural: 'Ponies',
    r: 4.5, graze: 8, walk: 34, run: 92, accel: 140, turn: 3.6,
    flight: 78, nbr: 46, sep: 13, wCoh: 1.0, wSep: 1.3, wAli: 1.1,
    stressGain: 0.42, stressDecay: 0.07, barkMul: 1.3, barkStress: 0.9, nipMul: 0.8, nipStress: 0.4,
    stubborn: 0, social: 0.05, wander: 0.15, climbs: false, balksWater: false,
    space: 4, value: 30, good: null, goodEvery: 0, goodValue: 0, spawnGroup: [4, 6], coats: 3,
  },
};

export const SPECIES_ORDER: SpeciesId[] = ['duck', 'sheep', 'goat', 'cow', 'pony'];
