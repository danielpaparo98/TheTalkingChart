/**
 * Card tint vocabulary for the card editor — the six approved Poster Desk
 * tints (imported from the templates module, never redeclared) plus the
 * canonical "none" swatch that clears a cell's tint.
 */

import { CARD_TINTS } from './templates'

/** One swatch in the card editor's colour group. */
export interface TintSwatch {
  /** Stable swatch id; `'none'` maps to `null` in the store. */
  id: string
  /** Human-readable name for aria-labels. */
  label: string
  /** Fill colour; `null` renders the untinted paper swatch. */
  color: string | null
}

/** The editor's swatch row: six tints + none, in approved palette order. */
export const TINT_SWATCHES: readonly TintSwatch[] = [
  { id: 'mint', label: 'Mint', color: CARD_TINTS.mint },
  { id: 'lemon', label: 'Lemon', color: CARD_TINTS.lemon },
  { id: 'sky', label: 'Sky', color: CARD_TINTS.sky },
  { id: 'peach', label: 'Peach', color: CARD_TINTS.peach },
  { id: 'orange', label: 'Orange', color: CARD_TINTS.orange },
  { id: 'lilac', label: 'Lilac', color: CARD_TINTS.lilac },
  { id: 'none', label: 'No tint', color: null },
]

/**
 * Swatch id matching a cell's colour — `'none'` for null/undefined AND for
 * unrecognised colours (a hand-edited storage payload must not leave the
 * swatch row in a state where nothing and something are both pressed).
 */
export function activeTintId(color: string | null | undefined): string {
  if (color === null || color === undefined) return 'none'
  return TINT_SWATCHES.find((swatch) => swatch.color === color)?.id ?? 'none'
}
