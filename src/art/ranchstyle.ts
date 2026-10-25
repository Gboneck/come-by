import { C } from '../palette';

// The farmhouse, painted to taste: a roof and a trim (shutters and the
// door frame), all from the palette. drawFarmhouse reads `farmLook`.

export type Roof = 'slate' | 'teal' | 'moss' | 'thatch';
export type Trim = 'sage' | 'teal' | 'butter' | 'plum';

export const ROOFS: Record<Roof, { name: string; base: string; course: string }> = {
  slate: { name: 'SLATE', base: C.plum, course: C.teal },
  teal: { name: 'TEAL', base: C.teal, course: C.sage },
  moss: { name: 'MOSS', base: C.sage, course: C.moss },
  thatch: { name: 'THATCH', base: C.butter, course: C.moss },
};

export const TRIMS: Record<Trim, { name: string; color: string }> = {
  sage: { name: 'SAGE', color: C.sage },
  teal: { name: 'TEAL', color: C.teal },
  butter: { name: 'BUTTERCUP', color: C.butter },
  plum: { name: 'PLUM', color: C.plum },
};

export const farmLook: { roof: Roof; trim: Trim } = { roof: 'slate', trim: 'sage' };
