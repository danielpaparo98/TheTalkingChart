/**
 * Session-only recent placements for the inspector's add flow (most recent
 * first). The v2 doc model intentionally carries no recents field, so
 * recents live in panel state for the session and never touch persistence.
 */

import type { IconRef } from '../types/icons'

/** One reusable placement: the stored icon reference plus its display label. */
export interface RecentPlacement {
  ref: IconRef
  label: string
}

/** Mockup behaviour: the eight most recent distinct placements. */
export const RECENT_PLACEMENTS_CAP = 8

/** Recents are keyed by set + name (the pictogram identity, not the label). */
function samePictogram(a: IconRef, b: IconRef): boolean {
  return a.set === b.set && a.name === b.name
}

/**
 * Pure list update: drop any earlier entry for the same pictogram, unshift
 * the new one, cap the row.
 */
export function pushRecentPlacement(
  list: readonly RecentPlacement[],
  item: RecentPlacement,
  cap: number = RECENT_PLACEMENTS_CAP,
): RecentPlacement[] {
  const rest = list.filter((entry) => !samePictogram(entry.ref, item.ref))
  return [item, ...rest].slice(0, cap)
}
