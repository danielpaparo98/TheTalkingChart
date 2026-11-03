/**
 * Inspector mode derivation — the pure heart of the InspectorPanel (Stage 1:
 * the inspector REPLACES all popovers, so exactly one editing surface exists
 * at any time and its mode must follow the store's selection state).
 *
 * Modes:
 * - `page` — nothing selected: sheet + grid + document settings.
 * - `add`  — an empty cell is asking (store `askingCellIndex` or a selected
 *   empty cell), or a filled card's picture is being replaced (panel-local
 *   `replaceIndex`, because the store only lets truly empty cells ask).
 * - `card` — a filled cell is selected.
 *
 * Every lookup is defensive: indices pointing outside `cells` (or at cells
 * that just vanished) fall through to the next rule, so the panel can never
 * get stuck on a dead target.
 */

import type { CellData } from '../types/chart'
import { isCellEmpty } from './doc-reducers'

/** The three inspector contexts, in shell layout order. */
export type InspectorMode = 'page' | 'add' | 'card'

/** Fully-resolved editing context for the panel body. */
export interface InspectorPlacement {
  mode: InspectorMode
  /** Cell the add/card mode edits; `null` in page mode. */
  targetIndex: number | null
  /** True when add mode is replacing a filled card's picture in place. */
  replace: boolean
}

/** Selection state snapshot the derivation reads (store refs + panel substate). */
export interface InspectorInput {
  selectedCellIndex: number | null
  askingCellIndex: number | null
  replaceIndex: number | null
  cells: readonly CellData[]
}

function cellAt(cells: readonly CellData[], index: number | null): CellData | null {
  if (index === null) return null
  return cells[index] ?? null
}

/**
 * Derive the inspector placement. Precedence: replace substate (explicit
 * user intent, set by the card editor) > asking cell > selected cell > page.
 */
export function deriveInspector(input: InspectorInput): InspectorPlacement {
  const { selectedCellIndex, askingCellIndex, replaceIndex, cells } = input

  const replacing = cellAt(cells, replaceIndex)
  // Replace mode targets a FILLED card (it re-pictures it). If the target
  // vanished or was cleared to empty, replace mode is meaningless — fall
  // through so the normal asking/selected/page rules decide the mode.
  if (replaceIndex !== null && replacing !== null && !isCellEmpty(replacing)) {
    return { mode: 'add', targetIndex: replaceIndex, replace: true }
  }

  const asking = cellAt(cells, askingCellIndex)
  if (askingCellIndex !== null && asking !== null && isCellEmpty(asking)) {
    return { mode: 'add', targetIndex: askingCellIndex, replace: false }
  }

  const selected = cellAt(cells, selectedCellIndex)
  if (selectedCellIndex !== null && selected !== null) {
    return isCellEmpty(selected)
      ? { mode: 'add', targetIndex: selectedCellIndex, replace: false }
      : { mode: 'card', targetIndex: selectedCellIndex, replace: false }
  }

  return { mode: 'page', targetIndex: null, replace: false }
}
