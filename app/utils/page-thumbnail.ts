/**
 * Paper-thumbnail geometry for the page inspector — pure math so the eight
 * thumbnails (4 presets × 2 orientations) render tiny sheets at their TRUE
 * relative aspect, exactly like the approved mockup's `.prect` rectangles,
 * without magic numbers inside the component.
 */

import type { Orientation, PagePresetId } from '../types/chart'
import { pageDims } from './page-presets'

/** Pixel edge of the thumbnail's LONGER side; the shorter side follows the sheet's real aspect. */
export const PAPER_THUMB_LONG_EDGE_PX = 34

/** Width/height of a thumbnail rectangle, in px. */
export interface PaperThumbBox {
  width: number
  height: number
}

/** Round to one decimal so inline styles and tests stay platform-stable. */
function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Thumbnail box for a preset + orientation: the longer edge is fixed at
 * `longEdge` px and the shorter edge is derived from the real mm aspect
 * (landscape sheets are wide, portrait sheets are tall).
 */
export function paperThumbBox(
  preset: PagePresetId,
  orientation: Orientation,
  longEdge: number = PAPER_THUMB_LONG_EDGE_PX,
): PaperThumbBox {
  const { widthMm, heightMm } = pageDims(preset, orientation)
  const aspect = widthMm / heightMm
  return aspect >= 1
    ? { width: round1(longEdge), height: round1(longEdge / aspect) }
    : { width: round1(longEdge * aspect), height: round1(longEdge) }
}
