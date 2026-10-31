/**
 * Contract types for the chart document — the persisted state of a
 * talking chart (grid + slots). Source of truth — do not rename or
 * extend without updating the architecture contract.
 */

import type { IconRef } from './icons'

/** One cell of the chart grid. Empty slots keep their `SlotData` with `icon: null`. */
export interface SlotData {
  /** Stable slot identifier (position-independent), used for updates and selection. */
  id: string
  /** Placed icon, or `null` while the slot is empty (rendered dashed). */
  icon: IconRef | null
  /** Editable label text shown under the icon on the card. */
  label: string
  /** Optional per-card color override; `null`/`undefined` = theme default. */
  color?: string | null
}

/**
 * Grid layout preset for the sheet. `'4x5'`/`'5x4'` = 20 slots,
 * `'3x3'` = 9, `'2x2'` = 4.
 */
export type GridPreset = '2x2' | '3x3' | '4x5' | '5x4'

/** The full chart document persisted to localStorage (`talking-chart-doc-v1`). Must stay serializable. */
export interface ChartDoc {
  /** Chart title, rendered inside the sheet header and used for print/export. */
  title: string
  /** Active grid preset. */
  grid: GridPreset
  /** Slot list; length must match the slot count implied by `grid`. */
  slots: SlotData[]
  /** Auto-set to `true` when any slot references an ARASAAC icon — drives the attribution notice. */
  usesArasaac: boolean
  /** Epoch milliseconds of the last modification (persistence bookkeeping). */
  updatedAt: number
}
