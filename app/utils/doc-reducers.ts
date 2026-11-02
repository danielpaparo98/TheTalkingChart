/**
 * Pure reducers for the ChartDoc v2 — the only place document shapes change.
 *
 * Contract (the store relies on both):
 * - Immutable: every reducer returns a NEW doc; the input and its untouched
 *   parts are never mutated (structural sharing keeps unchanged cell objects).
 * - No-op identity: when nothing changes, the SAME doc reference comes back,
 *   so the store can skip empty undo steps and persistence churn.
 *
 * Reducers never stamp `updatedAt` or `usesArasaac` and never touch the
 * clock — the store's single mutation path does that. Interaction-boundary
 * inputs (steppers) are clamped; persistence-boundary payloads (`toChartDoc`)
 * are strictly validated, because localStorage content is untrusted.
 */

import type {
  CellData,
  ChartDoc,
  LabelSize,
  MarginPreset,
  Orientation,
  PagePresetId,
  PageSetup,
} from '../types/chart'
import type { IconRef } from '../types/icons'
import { PAGE_PRESETS } from './page-presets'

/** Grid stepper ranges, transcribed from the approved mockup (rows 1–8, cols 1–10, gap 0–24mm). */
export const GRID_LIMITS = {
  minRows: 1,
  maxRows: 8,
  minCols: 1,
  maxCols: 10,
  minGapMm: 0,
  maxGapMm: 24,
} as const

/** Cell ids follow the templates.ts pattern: UUID when available, monotonic fallback otherwise. */
let cellCounter = 0

export function createCellId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  cellCounter += 1
  return `cell-${Date.now().toString(36)}-${cellCounter}`
}

export function createEmptyCell(): CellData {
  return { id: createCellId(), icon: null, label: '' }
}

/**
 * A cell counts as empty when it has nothing to show: no icon, no label and
 * no upload. Drives `placedCount`, the auto-advance scan and rehydration
 * reconciliation, so all three share one definition of "empty".
 */
export function isCellEmpty(cell: CellData): boolean {
  return cell.icon === null && cell.label === '' && cell.imageDataUrl === undefined
}

/** Structural copy — undo snapshots and template application must not alias reactive state. */
export function cloneDoc(source: ChartDoc): ChartDoc {
  return {
    title: source.title,
    pageSetup: { ...source.pageSetup },
    grid: { ...source.grid },
    cells: source.cells.map((cell) => ({
      ...cell,
      icon: cell.icon === null ? null : { ...cell.icon },
    })),
    usesArasaac: source.usesArasaac,
    updatedAt: source.updatedAt,
  }
}

/** Replace one cell through a patch; skips work when the patch returns the same cell. */
function replaceCell(doc: ChartDoc, index: number, patch: (cell: CellData) => CellData): ChartDoc {
  const cell = doc.cells[index]
  if (cell === undefined) return doc
  const next = patch(cell)
  if (next === cell) return doc
  const cells = doc.cells.slice()
  cells[index] = next
  return { ...doc, cells }
}

/** Pad (or trim) a cell list to `count` positions, keeping content positionally. */
function fitCells(cells: CellData[], count: number): CellData[] {
  if (cells.length === count) return cells
  if (cells.length > count) return cells.slice(0, count)
  return [...cells, ...Array.from({ length: count - cells.length }, () => createEmptyCell())]
}

export function setTitle(doc: ChartDoc, title: string): ChartDoc {
  if (doc.title === title) return doc
  return { ...doc, title }
}

export function setCell(doc: ChartDoc, index: number, cell: CellData): ChartDoc {
  // Copy the payload so callers can't mutate persisted state through their object.
  return replaceCell(doc, index, () => ({
    ...cell,
    icon: cell.icon === null ? null : { ...cell.icon },
  }))
}

export function setLabel(doc: ChartDoc, index: number, label: string): ChartDoc {
  return replaceCell(doc, index, (cell) => (cell.label === label ? cell : { ...cell, label }))
}

export function setTint(doc: ChartDoc, index: number, color: string | null): ChartDoc {
  return replaceCell(doc, index, (cell) => {
    if (color === null) {
      // "None" drops the key entirely — the canonical untinted shape.
      if (cell.color === undefined || cell.color === null) return cell
      const { color: _drop, ...rest } = cell
      return rest as CellData
    }
    return cell.color === color ? cell : { ...cell, color }
  })
}

/**
 * Flip (or explicitly set) the text-only flag. Turning it off drops the key —
 * persisted docs carry `textOnly` only when it means something.
 */
export function toggleTextOnly(doc: ChartDoc, index: number, on?: boolean): ChartDoc {
  return replaceCell(doc, index, (cell) => {
    const target = on === undefined ? cell.textOnly !== true : on
    if ((cell.textOnly === true) === target) return cell
    if (target) return { ...cell, textOnly: true }
    const { textOnly: _drop, ...rest } = cell
    return rest as CellData
  })
}

export function clearCell(doc: ChartDoc, index: number): ChartDoc {
  return replaceCell(doc, index, (cell) => {
    const alreadyBare =
      cell.icon === null &&
      cell.label === '' &&
      cell.color === undefined &&
      cell.textOnly === undefined &&
      cell.imageDataUrl === undefined
    if (alreadyBare) return cell
    // Keep the id (stable v-for key); every trace of content goes.
    return { id: cell.id, icon: null, label: '' }
  })
}

/**
 * Copy the cell's full content (icon, label, tint, text-only, upload) into
 * the next empty position after it, wrapping circularly. The copy gets a
 * fresh id; the original keeps its identity.
 */
export function duplicateCell(doc: ChartDoc, index: number): ChartDoc {
  const source = doc.cells[index]
  if (source === undefined || isCellEmpty(source)) return doc
  const target = nextEmptyCellIndex(doc, index)
  if (target === null) return doc
  return setCell(doc, target, { ...source, id: createCellId() })
}

/** Swap whole cells — ids travel with their content, so edits keep identity. */
export function swapCells(doc: ChartDoc, a: number, b: number): ChartDoc {
  const first = doc.cells[a]
  const second = doc.cells[b]
  if (first === undefined || second === undefined || a === b) return doc
  const cells = doc.cells.slice()
  cells[a] = second
  cells[b] = first
  return { ...doc, cells }
}

/**
 * Resize the grid: content stays at its array position — shrink truncates
 * the tail, growth pads fresh empties. Stepper inputs are clamped to the
 * approved ranges (non-integers truncate; junk falls back to current).
 */
export function setGrid(doc: ChartDoc, rows: number, cols: number): ChartDoc {
  const nextRows = clampCount(rows, doc.grid.rows, GRID_LIMITS.minRows, GRID_LIMITS.maxRows)
  const nextCols = clampCount(cols, doc.grid.cols, GRID_LIMITS.minCols, GRID_LIMITS.maxCols)
  if (nextRows === doc.grid.rows && nextCols === doc.grid.cols) return doc
  return {
    ...doc,
    grid: { ...doc.grid, rows: nextRows, cols: nextCols },
    cells: fitCells(doc.cells, nextRows * nextCols),
  }
}

export function setGap(doc: ChartDoc, gap: number): ChartDoc {
  if (!Number.isFinite(gap)) return doc
  const next = Math.min(GRID_LIMITS.maxGapMm, Math.max(GRID_LIMITS.minGapMm, gap))
  if (next === doc.grid.gap) return doc
  return { ...doc, grid: { ...doc.grid, gap: next } }
}

export function setLabelSize(doc: ChartDoc, labelSize: LabelSize): ChartDoc {
  if (!isLabelSize(labelSize) || labelSize === doc.grid.labelSize) return doc
  return { ...doc, grid: { ...doc.grid, labelSize } }
}

/** Merge a partial page-setup patch; unknown values are ignored, not trusted. */
export function setPageSetup(doc: ChartDoc, patch: Partial<PageSetup>): ChartDoc {
  const preset = isPagePreset(patch.preset) ? patch.preset : doc.pageSetup.preset
  const orientation = isOrientation(patch.orientation) ? patch.orientation : doc.pageSetup.orientation
  const marginPreset = isMarginPreset(patch.marginPreset) ? patch.marginPreset : doc.pageSetup.marginPreset
  if (
    preset === doc.pageSetup.preset &&
    orientation === doc.pageSetup.orientation &&
    marginPreset === doc.pageSetup.marginPreset
  ) {
    return doc
  }
  return { ...doc, pageSetup: { preset, orientation, marginPreset } }
}

/** Replace the whole document with a template's — cloned so gallery docs never alias live state. */
export function applyTemplate(doc: ChartDoc, next: ChartDoc): ChartDoc {
  void doc
  return cloneDoc(next)
}

/**
 * First empty position scanning forward from `afterIndex` (wrapping
 * circularly); `null` when every cell has content. Omit `afterIndex` to scan
 * from the start. Feeds the add-flow auto-advance.
 */
export function nextEmptyCellIndex(doc: ChartDoc, afterIndex = -1): number | null {
  const count = doc.cells.length
  if (count === 0) return null
  const start = (((afterIndex + 1) % count) + count) % count
  for (let step = 0; step < count; step += 1) {
    const index = (start + step) % count
    const cell = doc.cells[index]
    if (cell !== undefined && isCellEmpty(cell)) return index
  }
  return null
}

// --- Guards (field values are checked, never trusted) ---

function isPagePreset(value: unknown): value is PagePresetId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PAGE_PRESETS, value)
}

function isOrientation(value: unknown): value is Orientation {
  return value === 'portrait' || value === 'landscape'
}

function isMarginPreset(value: unknown): value is MarginPreset {
  return value === 'narrow' || value === 'normal' || value === 'wide'
}

function isLabelSize(value: unknown): value is LabelSize {
  return value === 's' || value === 'm' || value === 'l'
}

function clampCount(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Grid dimension for a STORED payload: strict integers within the approved ranges. */
function isStoredDim(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function toIconRef(value: unknown): IconRef | null {
  if (!isRecord(value)) return null
  if (value.source !== 'bundle' && value.source !== 'arasaac') return null
  if (typeof value.set !== 'string' || value.set === '') return null
  if (typeof value.name !== 'string' || value.name === '') return null
  return { source: value.source, set: value.set, name: value.name }
}

/** Canonical cell from an untrusted entry; `null` for entries without an id. */
function toCellData(value: unknown): CellData | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.id === '') return null
  const cell: CellData = {
    id: value.id,
    icon: toIconRef(value.icon),
    label: typeof value.label === 'string' ? value.label : '',
  }
  if (typeof value.color === 'string') cell.color = value.color
  if (value.textOnly === true) cell.textOnly = true
  if (typeof value.imageDataUrl === 'string' && value.imageDataUrl.startsWith('data:image/')) {
    cell.imageDataUrl = value.imageDataUrl
  }
  return cell
}

/**
 * Validate an untrusted localStorage payload into a v2 doc; `null` means the
 * payload is not a v2 chart at all (caller starts fresh and overwrites).
 * Core structure must be intact or the payload is rejected; cell-level
 * damage is repaired IN PLACE (bad entries become empty cells, the list is
 * trimmed/padded to the grid) so neighbouring content never shifts.
 * `usesArasaac` is always recomputed — the stored flag is never trusted.
 */
export function toChartDoc(value: unknown): ChartDoc | null {
  if (!isRecord(value)) return null
  if (typeof value.title !== 'string') return null
  if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return null

  const setup = value.pageSetup
  if (!isRecord(setup)) return null
  if (!isPagePreset(setup.preset)) return null
  if (!isOrientation(setup.orientation)) return null
  if (!isMarginPreset(setup.marginPreset)) return null

  const grid = value.grid
  if (!isRecord(grid)) return null
  const rows: unknown = grid.rows
  if (!isStoredDim(rows, GRID_LIMITS.minRows, GRID_LIMITS.maxRows)) return null
  const cols: unknown = grid.cols
  if (!isStoredDim(cols, GRID_LIMITS.minCols, GRID_LIMITS.maxCols)) return null
  if (
    typeof grid.gap !== 'number' ||
    !Number.isFinite(grid.gap) ||
    grid.gap < GRID_LIMITS.minGapMm ||
    grid.gap > GRID_LIMITS.maxGapMm
  ) {
    return null
  }
  if (!isLabelSize(grid.labelSize)) return null
  if (!Array.isArray(value.cells)) return null

  const cells = fitCells(
    value.cells.map((entry) => toCellData(entry) ?? createEmptyCell()),
    rows * cols,
  )
  return {
    title: value.title,
    pageSetup: { preset: setup.preset, orientation: setup.orientation, marginPreset: setup.marginPreset },
    grid: { rows, cols, gap: grid.gap, labelSize: grid.labelSize },
    cells,
    // Recompute from the restored cells — attribution must not outlive the pictograms it credits.
    usesArasaac: cells.some((cell) => cell.icon?.source === 'arasaac'),
    updatedAt: value.updatedAt,
  }
}
