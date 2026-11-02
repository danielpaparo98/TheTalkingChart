/**
 * Contract types for the chart document v2 — the persisted state of a
 * printable talking chart (page setup, grid geometry, position-indexed
 * cells). Clean break from v1: no migration, no fallback reads, new
 * storage key. Source of truth — do not rename or extend without
 * updating the architecture contract.
 */

import type { IconRef } from './icons'

/** Paper size presets. Dimensions live in the page-presets module; landscape swaps them. */
export type PagePresetId = 'a4' | 'letter' | 'a5' | 'a3'

/** Sheet orientation; landscape swaps the preset's portrait dimensions. */
export type Orientation = 'portrait' | 'landscape'

/** Print margin preset — mapped to mm by `MARGIN_PRESETS_MM` (app/utils/page-presets). */
export type MarginPreset = 'narrow' | 'normal' | 'wide'

/** Card label size step — mapped to a sheet-relative size by `LABEL_SIZE_CQW`. */
export type LabelSize = 's' | 'm' | 'l'

/** Print-target page settings chosen in the inspector's page tab. */
export interface PageSetup {
  /** Paper size preset (A4/Letter/A5/A3). */
  preset: PagePresetId
  /** Sheet orientation; landscape swaps the preset's dimensions. */
  orientation: Orientation
  /** Print margin preset (narrow/normal/wide). */
  marginPreset: MarginPreset
}

/** Grid geometry laid out inside the printable area. */
export interface GridSetup {
  /** Row count. */
  rows: number
  /** Column count. */
  cols: number
  /** Gap between cells, in mm. */
  gap: number
  /** Label size step applied to every card. */
  labelSize: LabelSize
}

/**
 * One cell of the chart grid. Cells are position-indexed: `cells[i]` is
 * grid position i (row-major). Empty cells keep their `CellData` with
 * `icon: null` so positions never shift underneath undo/redo.
 */
export interface CellData {
  /** Stable cell identifier, used for updates and selection. */
  id: string
  /** Placed icon, or `null` while the cell is empty (rendered dashed). */
  icon: IconRef | null
  /** Editable label text shown under the icon on the card. */
  label: string
  /** Optional per-card tint; `null`/`undefined` = theme default. */
  color?: string | null
  /** Text-only card: renders the label without any image. */
  textOnly?: boolean
  /**
   * User-uploaded image, re-encoded at import time to a small data URL
   * (≤512px WebP/JPEG) so it survives localStorage within budget.
   */
  imageDataUrl?: string
}

/** The full chart document persisted to localStorage (`DOC_STORAGE_KEY_V2`). Must stay serializable. */
export interface ChartDoc {
  /** Sheet title rendered above the grid and carried into print/export. */
  title: string
  /** Print-target page settings (paper, orientation, margins). */
  pageSetup: PageSetup
  /** Grid geometry; `cells.length` must equal `rows * cols`. */
  grid: GridSetup
  /** Cell list, position-indexed row-major; length must match the grid. */
  cells: CellData[]
  /** Auto-set to `true` when any cell references an ARASAAC icon — drives the attribution notice. */
  usesArasaac: boolean
  /** Epoch milliseconds of the last modification (persistence bookkeeping). */
  updatedAt: number
}

/**
 * localStorage key for the v2 document. Deliberately distinct from the v1
 * key (`talking-chart-doc-v1`) so a v1 payload can never leak into a v2
 * doc and vice versa — the break is total by design, not an oversight.
 */
export const DOC_STORAGE_KEY_V2 = 'talking-chart-doc-v2'
