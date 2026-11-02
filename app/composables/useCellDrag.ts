/**
 * Card→card swap drag transport + the per-cell drop-target state machine
 * (builder v2) — mirrors the payload-composable shape of
 * `useLibraryDrag.ts` (same file skeleton; the test suite follows that
 * file's stub-DataTransfer style, so no DOM environment is needed).
 *
 * Contract (GridCell consumes exactly this):
 *  - A FILLED card starts a drag with `beginCellDrag(event, payload)`; the
 *    payload `{ index, label }` travels under CELL_DRAG_MIME as JSON with
 *    the readable label on `text/plain`. Because HTML5 makes drag payload
 *    data unreadable during `dragover` (MIME types only), the dragged
 *    card's index is also tracked in module state — the mockup's global
 *    `dragPayload` variable, functionalised — via `markCellDragSource`.
 *  - During `dragover`, `decideDragOver(dataTransfer, targetIndex)`
 *    classifies the gesture: library-tile drags → `copy`, foreign card
 *    drags → `move`, the dragged card's own slot → `self`, anything else →
 *    `none`. Cells use it to set `dropEffect` and the 100ms drop tint.
 *  - On `drop`, `readCellDragData` returns the payload; the swap itself is
 *    the component's single emit — `swap(from, to)` — which the page
 *    forwards to `store.swapCells` (a no-op for self-drops by design).
 *    `scheduleSwapFlip` replays the mockup's FLIP after the mutation: both
 *    moved cards translate from their old slots over 160ms (skipped under
 *    reduced motion).
 *  - Library-tile drops are handed UP to the page as a bubbling
 *    CustomEvent (`LIBRARY_PLACE_EVENT`, detail `{ index, payload }`): the
 *    page writes the cell and notes the recents strip (LibraryPanel's
 *    placement contract). GridCell therefore stays store-free and the
 *    PageGrid emit surface keeps its frozen 5-event shape.
 */

import { onScopeDispose, ref } from 'vue'
import { hasLibraryDragData, readLibraryDragData } from './useLibraryDrag'
import type { LibraryDragPayload } from './useLibraryDrag'

/** MIME type marking a card→card swap drag (parallel of the library-tile MIME). */
export const CELL_DRAG_MIME = 'application/x-talking-chart-cell'

/** Name of the bubbling CustomEvent a GridCell dispatches on a library drop. */
export const LIBRARY_PLACE_EVENT = 'builder-cell-place'

/** What a cell drag carries: the source position and its readable label. */
export interface CellDragPayload {
  /** Row-major grid position the drag started on. */
  index: number
  /** Card label at drag start (`''` for icon-only cards). */
  label: string
}

/** Detail of {@link LIBRARY_PLACE_EVENT} — the page's drop placement input. */
export interface LibraryPlaceDetail {
  /** Drop target's row-major index. */
  index: number
  /** Validated library payload (`{ icon, label }`). */
  payload: LibraryDragPayload
}

/** Minimal rect view — real DOMRects are structurally compatible; tests use stubs. */
export interface RectLike {
  left: number
  top: number
}

/**
 * One-shot element contract for the swap flip: only the properties the
 * animation touches, so real Elements and plain test stubs both satisfy it.
 */
export interface FlipElement {
  readonly style: { transition: string; transform: string }
  getBoundingClientRect(): RectLike
  addEventListener?(type: string, listener: () => void, options?: { once?: boolean }): void
}

/** Serialize a swap payload onto the drag. Pure — trivially testable. */
export function encodeCellDragPayload(payload: CellDragPayload): string {
  return JSON.stringify(payload)
}

/**
 * Parse an untrusted drag payload — accepts the encoded JSON string (as it
 * travels on the DataTransfer) or an already-decoded object; `null` for
 * anything that is not a valid `{ index ≥ 0 integer, label }` pair (never
 * trust the DataTransfer). Labels may be empty — icon-only cards drag too.
 */
export function parseCellDragPayload(raw: unknown): CellDragPayload | null {
  if (typeof raw === 'string') {
    try {
      return parseCellDragPayload(JSON.parse(raw) as unknown)
    } catch {
      return null
    }
  }
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  if (typeof record.index !== 'number' || !Number.isInteger(record.index) || record.index < 0) {
    return null
  }
  if (typeof record.label !== 'string') return null
  return { index: record.index, label: record.label }
}

/** Stage a card onto a drag event (call from the card's `dragstart`). */
export function beginCellDrag(event: DragEvent, payload: CellDragPayload): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  transfer.effectAllowed = 'move'
  transfer.setData(CELL_DRAG_MIME, encodeCellDragPayload(payload))
  transfer.setData('text/plain', payload.label)
}

/** True while a card→card drag hovers a target (safe to call in `dragover`). */
export function hasCellDragData(dataTransfer: DataTransfer | null): boolean {
  return dataTransfer?.types.includes(CELL_DRAG_MIME) ?? false
}

/** Read the payload on `drop`; `null` when absent or malformed. */
export function readCellDragData(dataTransfer: DataTransfer | null): CellDragPayload | null {
  if (dataTransfer === null) return null
  return parseCellDragPayload(dataTransfer.getData(CELL_DRAG_MIME))
}

// --- Drag-source tracking ------------------------------------------------------------------
// HTML5 DnD hides payload data during dragover; the mockup compensated with a
// module-global `dragPayload`. Functionalised here: set on dragstart, cleared
// on dragend — write/read order stays inside client event handlers, so SSR
// never sees it guesswork-mutated.

let cellDragSourceIndex: number | null = null

/** Record the dragged card's index (call from the card's `dragstart`). */
export function markCellDragSource(index: number): void {
  cellDragSourceIndex = index
}

/** Forget the dragged card's index (call from `dragend`). */
export function clearCellDragSource(): void {
  cellDragSourceIndex = null
}

/** The dragged card's index, or `null` when no card drag is in flight. */
export function cellDragSource(): number | null {
  return cellDragSourceIndex
}

/** What a `dragover` on a cell means for THIS transfer type. */
export type DropKind = 'none' | 'copy' | 'move' | 'self'

/**
 * Pure drop-side classification used in `dragover` (protected mode — payload
 * data is unreadable there, so the source index comes from module state).
 * Library drags land `copy` (place), foreign card drags `move` (swap), the
 * dragged card's own slot `self` (hover suppressed), anything else `none`.
 */
export function decideDragOver(dataTransfer: DataTransfer | null, targetIndex: number): DropKind {
  if (dataTransfer === null) return 'none'
  if (hasLibraryDragData(dataTransfer)) return 'copy'
  if (hasCellDragData(dataTransfer)) {
    const from = cellDragSource()
    return from === null || from !== targetIndex ? 'move' : 'self'
  }
  return 'none'
}

// --- Swap FLIP (Stage 3: swap = both cells translate 160ms) --------------------------------

/**
 * FLIP offset for a card that now sits at `to` but used to sit at `from`:
 * the inline translate that visually pins it to its old slot mid-animation.
 * Pure arithmetic — testable without a DOM.
 */
export function flipOffset(from: RectLike, to: RectLike): { dx: number; dy: number } {
  return { dx: from.left - to.left, dy: from.top - to.top }
}

/** Swap translate length (plan's motion table: both cells translate 160ms). */
export const SWAP_FLIP_MS = 160

export interface SwapFlipOptions {
  /** Index the drag started on (its card arrives at `toIndex`). */
  fromIndex: number
  /** Index of the drop target (its card arrives at `fromIndex`). */
  toIndex: number
  /** Pre-swap rect of the card that sat at `fromIndex` (drag source). */
  preFromRect: RectLike
  /** Pre-swap rect of the card that sat at `toIndex` (drop target). */
  preToRect: RectLike
  /** Element resolver override (tests); default queries `[data-index="n"]`. */
  resolveEl?: (index: number) => FlipElement | null
  /** Schedule override (tests); default `window.requestAnimationFrame`. */
  raf?: (callback: () => void) => void
  /** Reduced motion — the flip is skipped entirely (cards just swap). */
  reduced?: boolean
  /** Translate length override (tests); default {@link SWAP_FLIP_MS}. */
  durationMs?: number
}

function defaultRaf(): ((callback: () => void) => void) | null {
  return typeof window === 'undefined' ? null : (callback) => {
    window.requestAnimationFrame(() => callback())
  }
}

/** The cell root PageGrid stamped with data-index (the FLIP's element hook). */
function defaultResolveEl(index: number): FlipElement | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(`[data-index="${index}"]`)
  return el === null ? null : (el as unknown as FlipElement)
}

/**
 * Play the mockup's swap FLIP: after the mutation reaches the layout, pin both
 * moved cards to where they came from, then release them over one eased
 * translate (transform only — no layout properties, no opacity). Skipped under
 * reduced motion and when either card cannot be resolved (deltas would lie).
 */
export function scheduleSwapFlip(options: SwapFlipOptions): void {
  if (options.reduced === true) return
  const run = options.raf ?? defaultRaf()
  if (run === null) return
  const resolveEl = options.resolveEl ?? defaultResolveEl
  const durationMs = options.durationMs ?? SWAP_FLIP_MS
  const { fromIndex, toIndex, preFromRect, preToRect } = options

  // rAF #1: the store mutation has flushed through Vue's patch by now —
  // each moved card is queried AT ITS NEW HOME and pinned to its old slot.
  run(() => {
    const arriveAtFrom = resolveEl(fromIndex) // this card came FROM slot toIndex
    const arriveAtTo = resolveEl(toIndex) // this card came FROM slot fromIndex
    const moves: Array<{ el: FlipElement; dx: number; dy: number }> = []
    const pin = (el: FlipElement | null, fromRect: RectLike): void => {
      if (el === null) return
      const offset = flipOffset(fromRect, el.getBoundingClientRect())
      if (offset.dx !== 0 || offset.dy !== 0) moves.push({ el, dx: offset.dx, dy: offset.dy })
    }
    pin(arriveAtFrom, preToRect)
    pin(arriveAtTo, preFromRect)
    if (moves.length === 0) return
    for (const move of moves) {
      move.el.style.transition = 'none'
      move.el.style.transform = `translate(${move.dx}px, ${move.dy}px)`
    }
    // rAF #2: release to the natural position over the transition length.
    run(() => {
      for (const move of moves) {
        move.el.style.transition = `transform ${durationMs}ms ease`
        move.el.style.transform = ''
        if (typeof move.el.addEventListener === 'function') {
          move.el.addEventListener(
            'transitionend',
            () => {
              move.el.style.transition = ''
            },
            { once: true },
          )
        }
      }
    })
  })
}

// --- Library-drop hand-off (GridCell → page) ------------------------------------------------

/**
 * Deliver a validated library drop to the page WITHOUT going through
 * PageGrid's frozen emit surface: a bubbling CustomEvent on the cell root.
 * The page attaches one listener around the grid and writes the cell
 * (`store.setCell`) + refreshes the library's recents strip.
 * Duck-typed dispatch so plain stubs satisfy the element contract in tests.
 */
export function emitLibraryPlace(source: unknown, detail: LibraryPlaceDetail): void {
  if (typeof source !== 'object' || source === null) return
  const target = source as { dispatchEvent?: (event: CustomEvent<LibraryPlaceDetail>) => unknown }
  const dispatch = target.dispatchEvent
  if (typeof dispatch !== 'function') return
  dispatch.call(
    target,
    new CustomEvent<LibraryPlaceDetail>(LIBRARY_PLACE_EVENT, {
      detail,
      bubbles: true,
      composed: false,
    }),
  )
}

// --- Per-cell drop-target state machine ----------------------------------------------------

export interface CellDropHooks {
  /** Current row-major index of the owning cell (read per event). */
  index: () => number
  /** Current readable label (drag `text/plain` + swap payload). */
  label: () => string
  /** The cell's root element (hover containment + FLIP rect capture). */
  root: () => HTMLElement | null
  /** Swap hand-off: the page forwards it to `store.swapCells`. */
  onSwap: (from: number, to: number) => void
}

/**
 * The drop/target side of a GridCell's drag interactions, extracted so the
 * component stays declarative. Owns the drop-tint flag, the dragging opacity
 * flag and the five HTML5 drag event handlers; DOM is reached only through
 * the injected `root` hook, and every store write stays upstream (swaps via
 * `onSwap`, library placements via {@link emitLibraryPlace}).
 */
export function useCellDrop(hooks: CellDropHooks) {
  /** True while a drag hovers this cell (the 100ms mint drop tint). */
  const dropHover = ref(false)
  /** True while THIS card is the drag source (0.35 opacity). */
  const dragging = ref(false)
  /** Index this instance staged onto the drag, so dragend clears only its own marker. */
  let draggedAtIndex: number | null = null

  function onDragStart(event: DragEvent): void {
    const index = hooks.index()
    draggedAtIndex = index
    markCellDragSource(index)
    beginCellDrag(event, { index, label: hooks.label() })
    dragging.value = true
  }

  function onDragEnd(): void {
    dragging.value = false
    dropHover.value = false
    // A swap already changed this cell's index prop — compare against the
    // staged value, never the current one.
    if (cellDragSource() === draggedAtIndex) clearCellDragSource()
    draggedAtIndex = null
  }

  function onDragOver(event: DragEvent): void {
    const kind = decideDragOver(event.dataTransfer, hooks.index())
    if (kind === 'none') {
      dropHover.value = false
      return
    }
    event.preventDefault()
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = kind === 'copy' ? 'copy' : 'move'
    dropHover.value = kind !== 'self'
  }

  function onDragLeave(event: DragEvent): void {
    // dragleave fires crossing into children too; only clear when the
    // pointer genuinely left this cell (mockup parity).
    const root = hooks.root()
    const stillInside =
      root !== null && event.relatedTarget instanceof Node && root.contains(event.relatedTarget)
    if (!stillInside) dropHover.value = false
  }

  function onDrop(event: DragEvent): void {
    // Prevent default FIRST: unhandled text/plain drops navigate or insert.
    event.preventDefault()
    dropHover.value = false
    const transfer = event.dataTransfer
    if (transfer === null) return
    if (hasLibraryDragData(transfer)) {
      const payload = readLibraryDragData(transfer)
      if (payload !== null) {
        emitLibraryPlace(event.currentTarget, { index: hooks.index(), payload })
      }
      return
    }
    if (!hasCellDragData(transfer)) return
    const dragged = readCellDragData(transfer)
    if (dragged === null) return
    const from = dragged.index
    const to = hooks.index()
    if (from === to) return
    // FLIP "first" capture BEFORE the swap reaches the DOM.
    const root = hooks.root()
    const preToRect = root?.getBoundingClientRect() ?? null
    const preFromRect = root === null ? null : resolveCellRect(from)
    hooks.onSwap(from, to)
    if (preToRect === null || preFromRect === null) return
    scheduleSwapFlip({
      fromIndex: from,
      toIndex: to,
      preFromRect,
      preToRect,
      reduced: prefersReducedMotion(),
    })
  }

  onScopeDispose(() => {
    // A card unmounting mid-drag (grid shrink) must not leak its marker
    // into a later drag — clear only when this instance still owns it.
    if (cellDragSource() === draggedAtIndex) clearCellDragSource()
    draggedAtIndex = null
  })

  return { dropHover, dragging, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }
}

/** BCR of the cell root stamped `data-index="n"` (FLIP capture); `null` if absent. */
function resolveCellRect(index: number): RectLike | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(`[data-index="${index}"]`)
  return el === null ? null : el.getBoundingClientRect()
}

/**
 * Motion-safety mirror for JS-driven animation: the CSS side runs its own
 * `prefers-reduced-motion` rules, this check guards the transform writes.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
