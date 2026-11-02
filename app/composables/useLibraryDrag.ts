/**
 * Library→cell drag transport (builder v2) — the HTML5 drag-and-drop
 * payload contract shared by LibraryPanel tiles and GridCell drop targets.
 *
 * Contract (GridCell consumes exactly this):
 *  - A tile starts a drag with `beginLibraryDrag(event, payload)`; the
 *    payload travels on the DataTransfer under LIBRARY_DRAG_MIME as JSON,
 *    with the readable label on `text/plain` as a fallback.
 *  - During `dragover` (protected mode — data is unreadable), a drop target
 *    distinguishes library drags from cell-swap drags with
 *    `hasLibraryDragData(dataTransfer)` (MIME-type presence check).
 *  - On `drop`, the target reads the payload with
 *    `readLibraryDragData(dataTransfer)` and hands it to the page, which
 *    writes the cell (`chart.setCell(index, { ...cell, icon, label })`) and
 *    refreshes the recents strip via LibraryPanel's exposed `notePlaced`.
 *
 * The payload shape is deliberately identical to the click/keyboard
 * placement callback (`onKeyboardPlace(icon)` + tile label) so the page has
 * one placement shape for both paths.
 */

import type { IconRef } from '../types/icons'

/**
 * MIME type marking a library-tile drag. Drop targets check `types.includes`
 * during dragover (data itself is protected until drop) and can use it to
 * set `dropEffect = 'copy'` versus 'move' for cell→cell swaps.
 */
export const LIBRARY_DRAG_MIME = 'application/x-talking-chart-icon'

/** What a library tile carries onto a cell: the icon to place and its label. */
export interface LibraryDragPayload {
  /** Fully-qualified icon reference (bundle set:name or ARASAAC pictogram id). */
  icon: IconRef
  /** Readable label ("dog face") — becomes the card label when the cell was empty. */
  label: string
}

/** Structural guard for an untrusted IconRef (payloads are re-parsed on drop). */
function isIconRef(value: unknown): value is IconRef {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record.source !== 'bundle' && record.source !== 'arasaac') return false
  if (typeof record.set !== 'string' || record.set === '') return false
  return typeof record.name === 'string' && record.name !== ''
}

/** Serialize a payload onto the drag. Pure — trivially testable. */
export function encodeLibraryDragPayload(payload: LibraryDragPayload): string {
  return JSON.stringify(payload)
}

/**
 * Parse an untrusted drag payload — accepts the encoded JSON string (as it
 * travels on the DataTransfer) or an already-decoded object; `null` for
 * anything that is not a valid `{ icon, label }` pair (never trust the
 * DataTransfer).
 */
export function parseLibraryDragPayload(raw: unknown): LibraryDragPayload | null {
  if (typeof raw === 'string') {
    try {
      return parseLibraryDragPayload(JSON.parse(raw) as unknown)
    } catch {
      return null
    }
  }
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  if (!isIconRef(record.icon)) return null
  if (typeof record.label !== 'string' || record.label === '') return null
  return { icon: record.icon, label: record.label }
}

/** Stage a library tile onto a drag event (call from the tile's `dragstart`). */
export function beginLibraryDrag(event: DragEvent, payload: LibraryDragPayload): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  transfer.effectAllowed = 'copy'
  transfer.setData(LIBRARY_DRAG_MIME, encodeLibraryDragPayload(payload))
  transfer.setData('text/plain', payload.label)
}

/** True while a library-tile drag hovers a target (safe to call in `dragover`). */
export function hasLibraryDragData(dataTransfer: DataTransfer | null): boolean {
  return dataTransfer?.types.includes(LIBRARY_DRAG_MIME) ?? false
}

/** Read the payload on `drop`; `null` when absent or malformed. */
export function readLibraryDragData(dataTransfer: DataTransfer | null): LibraryDragPayload | null {
  if (dataTransfer === null) return null
  return parseLibraryDragPayload(dataTransfer.getData(LIBRARY_DRAG_MIME))
}
