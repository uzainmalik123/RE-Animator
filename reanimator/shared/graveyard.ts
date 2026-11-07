// The graveyard (R6): the prepared dead repos the necromancer can choose from. One headstone per
// fixture on disk; nothing here is a claim about a ritual (D-R11).

export interface Headstone {
  // The fixture's directory name: the only thing a client sends to raise it.
  id: string;
  // The repo's name from its manifest, as the headstone reads it.
  name: string;
  diedIn: number;
  licence: string;
  // Whether Death has a chart for it (D-R8); without one he cannot attack the revived app.
  chart: boolean;
}

// A plain directory name: never a path, so an id from the wire can't climb out of fixtures/.
export const GRAVE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isGraveId(v: unknown): v is string {
  return typeof v === 'string' && GRAVE_ID.test(v);
}

// The graveyard's order: the oldest death first, then by name.
export function byDeath(a: Headstone, b: Headstone): number {
  return a.diedIn - b.diedIn || a.name.localeCompare(b.name);
}

// The only shape worth trusting from the wire.
export function isHeadstone(v: unknown): v is Headstone {
  if (typeof v !== 'object' || v === null) return false;
  const h = v as Record<string, unknown>;
  return isGraveId(h.id) && typeof h.name === 'string' && h.name !== '' && Number.isInteger(h.diedIn) && typeof h.licence === 'string' && typeof h.chart === 'boolean';
}
