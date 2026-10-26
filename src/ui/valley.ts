import { C } from '../palette';
import { wrap } from '../gfx/font';
import type { Game } from '../game';
import { BRIDGE_LOGS, STEPS, nextStep } from '../systems/valley';

// The Ledger's lines for the growing valley: the village (what it waits on
// next), the paddocks and the old bridge. The next goal is always visible.
export function valleyLedger(game: Game, w: number): { s: string; c: string }[] {
  const v = game.valley, vil = game.ranch.village;
  const out: { s: string; c: string }[] = [];
  const built = STEPS.filter((s) => vil.has(s.id)).length;
  out.push({ s: `THE VILLAGE ${built}/${STEPS.length}`, c: built === STEPS.length ? C.butter : C.wool });
  const next = nextStep(game);
  if (next) for (const l of wrap(`NEXT, ${next.name}: ${next.deed}`, w)) out.push({ s: l, c: C.sage });
  for (const p of v.paddocks) {
    const pct = Math.round((1 - v.left(p)) * 100);
    const state = !p.owned ? `FOR SALE ${p.site.price}$${pct ? `, ${pct}% GRAZED` : ''}` : p.cleared ? 'YOURS, CLEAR' : `YOURS, ${pct}% GRAZED`;
    out.push({ s: `${p.site.name.replace('THE ', '')}: ${state}`, c: p.cleared && p.owned ? C.butter : C.sage });
  }
  const b = v.bridge ? 'MENDED' : vil.has('smithy') ? `${v.logs}/${BRIDGE_LOGS} LOGS` : 'WANTS A SMITH';
  out.push({ s: `THE OLD BRIDGE: ${b}`, c: v.bridge ? C.butter : C.sage });
  return out;
}
