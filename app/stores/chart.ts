/**
 * Chart document store v2 — the single source of truth for the builder.
 *
 * Holds the persisted `ChartDoc` (page setup, grid geometry, position-indexed
 * cells), UI-only selection state, a session-only 50-deep undo/redo history
 * with 600ms key-based coalescing, and debounced localStorage persistence
 * under `talking-chart-doc-v2`. Clean break from v1: the old key is never
 * read and never migrated — v1 charts intentionally start fresh.
 *
 * Architecture:
 * - Every document mutation flows through `mutate()`: a pure reducer from
 *   `utils/doc-reducers` produces the next doc; its no-op identity contract
 *   (same reference back) short-circuits empty history entries and stamps.
 * - `touch()` stamps `updatedAt`, recomputes `usesArasaac` and flips the
 *   dirty/saved flags — attribution never outlives the pictograms it credits.
 * - Persistence writes are debounced (300ms) with a `pagehide` flush, and
 *   rehydration validates the untrusted payload shape (`toChartDoc`) before
 *   it is allowed anywhere near state.
 */

import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { DOC_STORAGE_KEY_V2 } from '../types/chart'
import type { CellData, ChartDoc, LabelSize, PageSetup } from '../types/chart'
import { createBlankChart } from '../utils/templates'
import * as reducers from '../utils/doc-reducers'

/** Debounce window so per-keystroke edits don't hammer storage. */
const PERSIST_DELAY_MS = 300

/** Coalescing window: same-key edits within it collapse into one undo step. */
const COALESCE_MS = 600

/** Maximum undo steps kept (session-only; never persisted). */
const HISTORY_LIMIT = 50

export const useChartStore = defineStore('chart', () => {
  // --- State ---
  const doc = ref<ChartDoc>(createBlankChart())
  /** UI-only selection (index into `cells`); intentionally never persisted. */
  const selectedCellIndex = ref<number | null>(null)
  /** The empty card currently "asking" for its word (add flow). UI-only. */
  const askingCellIndex = ref<number | null>(null)
  const dirty = ref(false)
  const saved = ref(false)
  /** True when localStorage refused a read/write — surfaced in the top bar. */
  const storageError = ref(false)

  let persistTimer: ReturnType<typeof setTimeout> | null = null

  // --- History (session-only; never persisted) ---
  const undoStack = ref<ChartDoc[]>([])
  const redoStack = ref<ChartDoc[]>([])
  /** Coalescing key of the last committed edit (typing streams collapse). */
  let lastEditKey: string | null = null
  let lastEditAt = 0

  // --- Derived ---
  const gridSize = computed(() => doc.value.grid.rows * doc.value.grid.cols)
  const rows = computed(() => doc.value.grid.rows)
  const columns = computed(() => doc.value.grid.cols)
  /** How many cards hold content (icon, label or upload) — drives progress. */
  const placedCount = computed(() => doc.value.cells.filter((cell) => !reducers.isCellEmpty(cell)).length)
  const selectedCell = computed<CellData | null>(() => cellAt(selectedCellIndex.value))
  const askingCell = computed<CellData | null>(() => cellAt(askingCellIndex.value))
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  function cellAt(index: number | null): CellData | null {
    if (index === null) return null
    return doc.value.cells[index] ?? null
  }

  // --- Persistence ---

  function persistNow(): void {
    persistTimer = null
    try {
      window.localStorage.setItem(DOC_STORAGE_KEY_V2, JSON.stringify(doc.value))
      dirty.value = false
      saved.value = true
      storageError.value = false
    } catch {
      // Storage blocked/full — stay dirty and say so (WCAG 4.1.3: the failure
      // must be announced, not silent work loss).
      storageError.value = true
    }
  }

  /** Write immediately if a debounced persist is still pending (tab closing). */
  function flushPendingPersist(): void {
    if (persistTimer === null) return
    clearTimeout(persistTimer)
    persistNow()
  }

  function schedulePersist(): void {
    if (typeof window === 'undefined') return
    if (persistTimer !== null) clearTimeout(persistTimer)
    persistTimer = setTimeout(persistNow, PERSIST_DELAY_MS)
  }

  /** `null` on any parse/validation failure — corrupt payloads are not storage errors. */
  function parseStoredDoc(raw: string): ChartDoc | null {
    try {
      return reducers.toChartDoc(JSON.parse(raw) as unknown)
    } catch {
      return null
    }
  }

  /** Restore from storage on first store access; corrupt payloads start fresh. */
  function restore(): void {
    let raw: string | null
    try {
      raw = window.localStorage.getItem(DOC_STORAGE_KEY_V2)
    } catch {
      // Storage access denied — keep the fresh default doc and flag it so
      // the top bar can tell the user their work will not persist.
      storageError.value = true
      return
    }
    if (raw === null) {
      // First run — seed storage so it is the single source from the start.
      persistNow()
      return
    }
    const restored = parseStoredDoc(raw)
    if (restored === null) {
      // Corrupt or non-v2 payload — overwrite it with a fresh doc.
      persistNow()
      return
    }
    doc.value = restored
    dirty.value = false
    saved.value = true
  }

  // --- Mutation pipeline ---

  /**
   * Stamp every document mutation. `usesArasaac` is recomputed so it always
   * reflects reality (true iff any placed icon is arasaac-sourced).
   */
  function touch(): void {
    doc.value.updatedAt = Date.now()
    doc.value.usesArasaac = doc.value.cells.some((cell) => cell.icon?.source === 'arasaac')
    dirty.value = true
    saved.value = false
  }

  /**
   * Snapshot the doc just before a mutation lands. Consecutive edits that
   * share a key within the coalesce window (typing a title, typing one
   * card's label, tinting one card, dragging the gap slider) collapse into a
   * single undo step; discrete acts — placements, clears, swaps, grid
   * resizes, template loads — each get their own.
   */
  function commit(editKey: string | null = null): void {
    const now = Date.now()
    const coalesce = editKey !== null && editKey === lastEditKey && now - lastEditAt < COALESCE_MS
    lastEditKey = editKey
    lastEditAt = now
    if (coalesce) return
    undoStack.value.push(reducers.cloneDoc(doc.value))
    if (undoStack.value.length > HISTORY_LIMIT) undoStack.value.shift()
    redoStack.value = []
  }

  /** Drop selection/asking state that a mutation or restore invalidates. */
  function reconcileSelection(): void {
    const count = doc.value.cells.length
    if (selectedCellIndex.value !== null && (selectedCellIndex.value < 0 || selectedCellIndex.value >= count)) {
      selectedCellIndex.value = null
    }
    if (askingCellIndex.value !== null) {
      const cell = doc.value.cells[askingCellIndex.value]
      if (cell === undefined || !reducers.isCellEmpty(cell)) askingCellIndex.value = null
    }
  }

  /**
   * THE single mutation path: apply a pure reducer, snapshot history, stamp,
   * reconcile selection. The reducer's no-op identity contract means invalid
   * indices / unchanged values never enter history or trigger persistence.
   */
  function mutate(editKey: string | null, reduce: (current: ChartDoc) => ChartDoc): void {
    const next = reduce(doc.value)
    if (next === doc.value) return
    commit(editKey)
    doc.value = next
    touch()
    reconcileSelection()
  }

  function undo(): void {
    const previous = undoStack.value.pop()
    if (previous === undefined) return
    redoStack.value.push(reducers.cloneDoc(doc.value))
    doc.value = previous
    lastEditKey = null
    reconcileSelection()
    touch()
  }

  function redo(): void {
    const next = redoStack.value.pop()
    if (next === undefined) return
    undoStack.value.push(reducers.cloneDoc(doc.value))
    doc.value = next
    lastEditKey = null
    reconcileSelection()
    touch()
  }

  // --- Actions (all doc mutations funnel through `mutate`) ---

  /** Stable per-cell coalescing key (like v1's per-slot keys) — null when the cell doesn't exist. */
  function cellEditKey(kind: string, index: number): string | null {
    const id = doc.value.cells[index]?.id
    return id === undefined ? null : `${kind}:${id}`
  }

  function setTitle(title: string): void {
    mutate('title', (current) => reducers.setTitle(current, title))
  }

  /** Replace a cell wholesale — placement and upload results land here. */
  function setCell(index: number, cell: CellData): void {
    mutate(null, (current) => reducers.setCell(current, index, cell))
  }

  function setLabel(index: number, label: string): void {
    mutate(cellEditKey('label', index), (current) => reducers.setLabel(current, index, label))
  }

  function setCellColor(index: number, color: string | null): void {
    mutate(cellEditKey('color', index), (current) => reducers.setTint(current, index, color))
  }

  function setTextOnly(index: number, on?: boolean): void {
    mutate(cellEditKey('textonly', index), (current) => reducers.toggleTextOnly(current, index, on))
  }

  function clearCell(index: number): void {
    mutate(null, (current) => reducers.clearCell(current, index))
  }

  function duplicateCell(index: number): void {
    mutate(null, (current) => reducers.duplicateCell(current, index))
  }

  function swapCells(a: number, b: number): void {
    mutate(null, (current) => reducers.swapCells(current, a, b))
  }

  function applyTemplate(template: ChartDoc): void {
    mutate(null, (current) => reducers.applyTemplate(current, template))
    // A template's geometry is unrelated to prior selection — start clean.
    selectedCellIndex.value = null
    askingCellIndex.value = null
  }

  function setPageSetup(patch: Partial<PageSetup>): void {
    mutate('pageSetup', (current) => reducers.setPageSetup(current, patch))
  }

  function setGrid(nextRows: number, nextCols: number): void {
    mutate(null, (current) => reducers.setGrid(current, nextRows, nextCols))
  }

  function setGap(gap: number): void {
    // Slider drags fire continuously — one logical act, one undo step.
    mutate('gap', (current) => reducers.setGap(current, gap))
  }

  function setLabelSize(labelSize: LabelSize): void {
    mutate('labelSize', (current) => reducers.setLabelSize(current, labelSize))
  }

  // --- Selection (UI-only; never stamps updatedAt/dirty) ---

  /**
   * Select a cell for the card editor. Selecting ENDS the add flow's ask —
   * the mirror of askCell clearing the selection: the two edit surfaces
   * never open at once, so the inspector always follows the click. Deselect
   * (null) leaves the ask untouched (the page's Escape unwind clears both).
   */
  function selectCell(index: number | null): void {
    if (index !== null && (index < 0 || index >= doc.value.cells.length)) return
    selectedCellIndex.value = index
    if (index !== null) askingCellIndex.value = null
  }

  /**
   * Open (or close) the add flow on an empty card. Only truly empty,
   * existing cells may ask; asking also clears the filled-card selection —
   * the two edit surfaces never open at once.
   */
  function askCell(index: number | null): void {
    if (index === null) {
      askingCellIndex.value = null
      return
    }
    const cell = doc.value.cells[index]
    if (cell === undefined || !reducers.isCellEmpty(cell)) return
    selectedCellIndex.value = null
    askingCellIndex.value = index
  }

  /**
   * Auto-advance: after placing into a card, the next empty card asks.
   * Returns the index it advanced to (null when the chart is complete).
   */
  function askNextAfter(index: number): number | null {
    const next = reducers.nextEmptyCellIndex(doc.value, index)
    if (next === null) {
      askingCellIndex.value = null
      return null
    }
    askingCellIndex.value = next
    return next
  }

  // --- Wiring (registered after restore so restoring never triggers a re-save) ---

  if (typeof window !== 'undefined') {
    restore()

    // A tab closed inside the debounce window must not lose the last change.
    window.addEventListener('pagehide', flushPendingPersist)
    onScopeDispose(() => {
      window.removeEventListener('pagehide', flushPendingPersist)
      if (persistTimer !== null) {
        clearTimeout(persistTimer)
        persistTimer = null
      }
    })

    // Single persistence path: every doc mutation (incl. updatedAt stamps) lands here.
    watch(doc, schedulePersist, { deep: true })
  }

  return {
    // state
    doc,
    selectedCellIndex,
    askingCellIndex,
    dirty,
    saved,
    storageError,
    // derived
    gridSize,
    rows,
    columns,
    placedCount,
    selectedCell,
    askingCell,
    canUndo,
    canRedo,
    // actions
    setTitle,
    setCell,
    setLabel,
    setCellColor,
    setTextOnly,
    clearCell,
    duplicateCell,
    swapCells,
    applyTemplate,
    setPageSetup,
    setGrid,
    setGap,
    setLabelSize,
    selectCell,
    askCell,
    askNextAfter,
    undo,
    redo,
  }
})
