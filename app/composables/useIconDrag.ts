/**
 * useIconDrag — pointer-based drag & drop from the icon palette onto chart
 * slots (the builder's WYSIWYG placement path; click-to-place stays as the
 * keyboard/touch fallback).
 *
 * Why pointer events, not HTML5 DnD: a single implementation covers mouse
 * and touch, the drag ghost is a plain styled element (no OS drag image),
 and hit-testing via elementFromPoint works with the cqw-scaled sheet.
 *
 * Contract:
 *  - A tile calls `beginIconDrag(event, payload)` on pointerdown. Movement
 *    under 4px never becomes a drag — the tile's own click handler fires.
 *  - Slots mark themselves with `data-slot-drop="<slotId>"`; the hovered
 *    slot id is exposed as `dragHoverSlotId` for highlight styling.
 *  - Releasing over a slot places the icon through the chart store
 *    (replacing whatever the card held); releasing elsewhere cancels.
 *  - `justDragged` lets a tile's click handler ignore the click that follows
 *    an actual drag.
 *
 * The ghost itself is rendered by <IconDragGhost> (page level, fixed
 * position) so the palette markup stays untouched.
 */
import { ref } from 'vue'
import { useChartStore } from '~/stores/chart'
import type { IconRef } from '~/types/icons'

export interface IconDragPayload {
  /** The icon to place. */
  icon: IconRef
  /** Readable name for the ghost's accessible text. */
  name: string
}

interface DragState extends IconDragPayload {
  /** Ghost position (viewport coordinates). */
  x: number
  y: number
}

/** Movement (px) before a press becomes a drag — clicks stay clicks. */
const DRAG_THRESHOLD = 4

/** Singleton state: one drag at a time, shared by palette and ghost. */
const dragging = ref<DragState | null>(null)
const dragHoverSlotId = ref<string | null>(null)
/** Set when a real drag just ended; tiles check it to swallow the click. */
const justDragged = ref(false)

let startX = 0
let startY = 0
let pending: IconDragPayload | null = null
let engaged = false

function onPointerMove(event: PointerEvent): void {
  if (pending === null && !engaged) return
  if (!engaged) {
    const dist = Math.hypot(event.clientX - startX, event.clientY - startY)
    if (dist < DRAG_THRESHOLD || pending === null) return
    engaged = true
    justDragged.value = false
    dragging.value = { ...pending, x: event.clientX, y: event.clientY }
  }
  // Keep the page from scrolling/ selecting under the pointer (touch especially).
  event.preventDefault()
  const state = dragging.value
  if (state !== null) {
    state.x = event.clientX
    state.y = event.clientY
  }
  const under = document.elementFromPoint(event.clientX, event.clientY)
  const slotEl = under?.closest('[data-slot-drop]')
  dragHoverSlotId.value = slotEl?.getAttribute('data-slot-drop') ?? null
}

function onPointerUp(): void {
  const slotId = dragHoverSlotId.value
  const state = dragging.value
  if (engaged && state !== null && slotId !== null) {
    const chart = useChartStore()
    chart.setSlotIcon(slotId, state.icon)
    chart.selectSlot(slotId)
    justDragged.value = true
  } else if (engaged) {
    justDragged.value = true
  }
  endDrag()
}

function onPointerCancel(): void {
  endDrag()
}

function endDrag(): void {
  dragging.value = null
  dragHoverSlotId.value = null
  pending = null
  engaged = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

export function useIconDrag() {
  /**
   * Call from a tile's `@pointerdown`. Wires the window listeners; every
   * path through endDrag() removes them, including pointercancel.
   */
  function beginIconDrag(event: PointerEvent, payload: IconDragPayload): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    startX = event.clientX
    startY = event.clientY
    pending = payload
    justDragged.value = false
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
  }

  /** True in a tile's click handler when the press was really a drag. */
  function wasJustDragged(): boolean {
    return justDragged.value
  }

  return {
    dragging,
    dragHoverSlotId,
    beginIconDrag,
    wasJustDragged,
  }
}
