<script setup lang="ts">
/**
 * PrintCanvas — the builder's desk region (light-desk revision of the
 * "Poster Desk"): a calm light ground hosting the print-true sheet, with
 * fit default, zoom 50–200% (×1.2 steps), ctrl+wheel/pinch 1:1 zoom and
 * bounded drag-pan once zoomed past fit (approved decision #6, surround
 * colour revised by user decision — the near-black band read as a defect).
 *
 * Contracts:
 * - The sheet itself comes from the page via the default slot (PrintPage,
 *   task 08, is never imported here). This component owns the sheet's
 *   LAYOUT box — constant width, true aspect ratio — and applies zoom as a
 *   CSS transform on the stage wrapper, so layout px never change with
 *   zoom (useExport's pngCaptureScale depends on that).
 * - The paper shadow, background and print container styling belong to the
 *   slotted PrintPage; the host box only sizes and fills its child.
 * - Zoom/pan math lives in useCanvasView (pure + unit-tested); this file
 *   owns only DOM wiring: ResizeObserver, pointer events (drag pan +
 *   two-finger pinch), keyboard (+/−/0), wheel.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useCanvasView } from '../../composables/useCanvasView'

const props = defineProps<{
  /** Sheet aspect ratio (width ÷ height) from usePageSetup — drives fit math and the sheet box. */
  aspectRatio: number
  /** Status-line caption, e.g. "A4 · Landscape · 297 × 210 mm" (built by the page; rendered uppercase). */
  pageLabel: string
  /**
   * Attention line for the desk (a11y subtask 16): the page passes the
   * chart store's storage failure so "Not saved" is announced (role=alert)
   * and visible above the status caption at every viewport width. Null/empty
   * renders nothing.
   */
  notice?: string | null
}>()

const {
  percent, pannable, isFit, animated, state, stageStyle, sheetStyle,
  setRegion, fit, zoomStep, zoomWheel, zoomTouch, panBy,
} = useCanvasView({ aspectRatio: () => props.aspectRatio })

const regionEl = ref<HTMLElement | null>(null)

/* — drag pan + touch pinch (pointer events, capture-tracked) — */

const panExcludes = '.zoombar, button, a, input, select, textarea'
const pointers = new Map<number, { x: number; y: number }>()
const panStart = ref<{ x: number; y: number; tx: number; ty: number } | null>(null)
const panning = ref(false)
let pinchDistance = 0
let pinchRect: DOMRect | null = null

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  if (event.target instanceof Element && event.target.closest(panExcludes)) return

  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  // Capture only when the gesture can do something — a one-pointer press at
  // fit (or below) can neither pan nor pinch, so capturing steals native
  // behaviours (text selection, future drags) for a dead gesture (N-4).
  if (pointers.size === 2 || pannable.value) {
    regionEl.value?.setPointerCapture(event.pointerId)
  }

  if (pointers.size === 2) {
    // Second finger: switch to pinch. Gesture midpoint maps 1:1 in zoomTouch.
    const [a, b] = [...pointers.values()]
    if (a === undefined || b === undefined) return // unreachable at size 2; satisfies noUncheckedIndexedAccess
    pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
    pinchRect = regionEl.value?.getBoundingClientRect() ?? null
    panStart.value = null
    panning.value = true
    return
  }
  // Single pointer: pan only when zoomed past fit (empty-band drag; the
  // sheet paper pans too, interactive slot content opts out via the
  // exclusion selector above).
  if (pannable.value) {
    panStart.value = { x: event.clientX, y: event.clientY, tx: state.value.tx, ty: state.value.ty }
    panning.value = true
  }
}

function onPointerMove(event: PointerEvent): void {
  const tracked = pointers.get(event.pointerId)
  if (!tracked) return
  tracked.x = event.clientX
  tracked.y = event.clientY

  if (pointers.size === 2 && pinchDistance > 0) {
    const [a, b] = [...pointers.values()]
    if (a === undefined || b === undefined) return // unreachable at size 2; satisfies noUncheckedIndexedAccess
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    if (pinchRect && distance > 0) {
      zoomTouch(distance / pinchDistance, {
        x: (a.x + b.x) / 2 - pinchRect.left,
        y: (a.y + b.y) / 2 - pinchRect.top,
      })
    }
    pinchDistance = distance
    return
  }
  if (panStart.value) {
    panBy(event.clientX - panStart.value.x, event.clientY - panStart.value.y)
  }
}

function onPointerEnd(event: PointerEvent): void {
  pointers.delete(event.pointerId)
  if (pointers.size === 0) {
    panStart.value = null
    panning.value = false
  }
  // One finger left after a pinch ends the gesture — don't resume panning.
  pinchDistance = 0
  pinchRect = null
}

/* — wheel (trackpad pinch arrives as ctrl+wheel) and keyboard — */

function onWheel(event: WheelEvent): void {
  // Plain scrolling is left untouched; pinch/wheel+ctrl zooms 1:1, immediate.
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  zoomWheel(event.deltaY, event.deltaMode)
}

function onKeydown(event: KeyboardEvent): void {
  // Never hijack browser/OS shortcuts.
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomStep(1); return }
  if (event.key === '-' || event.key === '_') { event.preventDefault(); zoomStep(-1); return }
  if (event.key === '0') { event.preventDefault(); fit() }
}

/* — region observation — */

let observer: ResizeObserver | null = null

onMounted(() => {
  const el = regionEl.value
  if (!el) return
  const sync = () => setRegion(el.clientWidth, el.clientHeight)
  sync()
  observer = new ResizeObserver(sync)
  observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <section
    ref="regionEl"
    class="canvas"
    :class="{ pan: pannable && !panning, panning }"
    role="region"
    aria-label="Chart canvas"
    tabindex="0"
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @wheel="onWheel"
  >
    <div class="stage" :class="{ smooth: animated && !panning }" :style="stageStyle">
      <div class="sheet-host" :style="sheetStyle">
        <slot />
      </div>
    </div>

    <div class="zoombar" role="group" aria-label="Zoom controls">
      <button type="button" aria-label="Zoom out" @click="zoomStep(-1)">
        <span aria-hidden="true">&minus;</span>
      </button>
      <span class="zoom-pct" aria-live="polite">{{ percent }}</span>
      <button type="button" aria-label="Zoom in" @click="zoomStep(1)">
        <span aria-hidden="true">+</span>
      </button>
      <button type="button" class="fit" :aria-pressed="isFit" @click="fit()">Fit</button>
    </div>

    <!-- Storage-failure alert (the page feeds the store's storageError):
         assertive (role=alert) because unsaved work must interrupt; no
         transition, so it is present the tick it mounts. -->
    <p
      v-if="props.notice !== null && props.notice !== undefined && props.notice !== ''"
      class="canvas-alert"
      role="alert"
    >{{ props.notice }}</p>

    <p class="canvas-status">
      <span class="dot" aria-hidden="true">&#9679;</span>
      <span>{{ pageLabel }}</span>
    </p>
  </section>
</template>

<style scoped>
/*
 * Poster Desk tokens (--desk/--mint-ink/…) are defined globally (task 15)
 * and referenced, never redefined. The canvas chrome below is re-skinned
 * for the LIGHT desk (user-approved revision of the v2 dark band): paper
 * chip, hairline borders, --muted meta text and --mint-ink accents — the
 * light mint #a7ff9c reads ~1.2:1 on the desk and fails WCAG 1.4.11 there,
 * while --mint-ink clears it (9.2:1).
 */
.canvas {
  /* Claim the shell region's definite flex height — everything inside is
     absolutely positioned, so without this the component collapses to 0px,
     ResizeObserver measures 0 and the sheet park at the 10% fit floor. */
  height: 100%;
  position: relative;
  overflow: hidden; /* the desk never scrolls the page or lets the sheet escape */
  background: var(--desk);
  user-select: none;
  touch-action: none; /* pan/pinch are ours; touch gestures never scroll the page */
}

.canvas.pan { cursor: grab; }
.canvas.panning { cursor: grabbing; }

.canvas:focus-visible {
  outline: 2px solid var(--mint-ink, var(--ink));
  outline-offset: -2px;
}

/* stage = zoomed sheet wrapper; transform-only zoom keeps layout px constant */
.stage {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.stage.smooth { transition: transform 120ms ease; }

/* sheet host owns the layout box (constant width + true aspect ratio);
   the slotted PrintPage fills it and brings paper, radius and shadow */
.sheet-host { display: grid; }

.sheet-host > :deep(*) {
  width: 100%;
  height: 100%;
}

/* — zoom pill (floating chip, top centre; paper on the light desk) — */
.zoombar {
  position: absolute;
  top: 14px;
  left: 50%;
  translate: -50% 0;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: var(--paper);
  border: 1px solid var(--line);
  box-shadow: 0 1px 2px rgba(19, 23, 17, 0.08);
  z-index: 5;
}

.zoombar button {
  height: 30px;
  min-width: 30px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--text);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.zoombar button:hover {
  background: var(--active);
  color: var(--ink);
}

.zoombar button.fit { padding: 0 12px; }

.zoombar button.fit[aria-pressed="true"] { color: var(--mint-ink, var(--ink)); }

.zoombar button:focus-visible {
  outline: 2px solid var(--mint-ink, var(--ink));
  outline-offset: 1px;
}

.zoom-pct {
  min-width: 48px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* — status line (page caption, bottom centre) — */
.canvas-status {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.canvas-status .dot {
  color: var(--mint-ink, var(--ink));
  font-size: 8px;
}

/* — desk alert (storage failure): pill-warning pair, 6.9:1, above the
     status caption and clear of the zoom pill at every width — */
.canvas-alert {
  position: absolute;
  left: 50%;
  bottom: 34px;
  translate: -50% 0;
  z-index: 6;
  max-width: calc(100% - 24px);
  margin: 0;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--pill-warning-bg);
  color: var(--pill-warning-fg);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
}

/* reduced motion kills every canvas transition, including zoom easing */
@media (prefers-reduced-motion: reduce) {
  .stage.smooth,
  .zoombar button {
    transition: none;
  }
}
</style>
