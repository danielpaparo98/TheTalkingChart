/**
 * Canvas view state — zoom 50–200%, fit-to-region, and bounded pan for the
 * builder's PrintCanvas desk (approved decision #6; Stage 3 motion table).
 *
 * Split by testability:
 * - The pure functions below carry ALL the math (clamping, fit scale,
 *   anchor-preserving zoom, pan bounds). They take explicit inputs and
 *   return new ViewState objects — no DOM, no Vue — so vitest covers them
 *   in its node-only environment (see vitest.config.ts).
 * - `useCanvasView` is the thin reactive shell: it owns the current
 *   ViewState plus the region size, derives readouts (percent, pannable,
 *   stage/sheet styles) and turns intent calls (fit / step / wheel / pinch /
 *   pan) into the next ViewState via the pure functions. All DOM wiring
 *   (ResizeObserver, pointer events, keyboard) lives in PrintCanvas.vue.
 *
 * Zoom contract with the export pipeline: zoom is applied as a CSS transform
 * on the stage wrapper, so the sheet's LAYOUT box stays constant (its width
 * is always `SHEET_BASE_WIDTH_PX`, whatever the zoom). `pngCaptureScale`
 * derives raster density from that layout width, which keeps exports
 * zoom-proof: capture px = layout px, never transformed px.
 *
 * Fit-vs-floor: the fit scale is capped at 100% (fit never magnifies) but
 * floored BELOW the zoom range minimum (0.1) — on a region too small to
 * show the sheet at 50%, fit must shrink further or the sheet would clip
 * with no way to see it (pan stays off at fit). The zoom CONTROLS still
 * clamp to 50–200%.
 */

import { computed, ref, toValue, watch } from 'vue'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'

/** Zoom control range, approved decision #6. */
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 2

/** Button/keyboard zoom step: ×1.2 multiplicative (mockup `zoomBy` feel — 50→200% in 7 steps, vs 15 with additive 10%). */
export const ZOOM_STEP_FACTOR = 1.2

/** Fit scale floor — deliberately below ZOOM_MIN so tiny regions still fit the whole sheet. */
export const FIT_MIN_SCALE = 0.1
/** Fit never magnifies past 100%. */
export const FIT_MAX_SCALE = 1

/** Desk padding kept clear around the sheet at fit: zoom pill (top) + status line (bottom), from the approved mockup. */
export const FIT_PAD_X = 88
export const FIT_PAD_Y = 104

/** Slack (in scale units) tolerated before a zoom counts as "bigger than fit" and enables panning. */
export const PAN_EPSILON = 0.002

/** Trackpad pinch (ctrl+wheel) sensitivity: factor = e^(−deltaPx × k). */
export const WHEEL_SENSITIVITY = 0.005
/** Wheel deltaMode 1 reports lines, not pixels — one notch ≈ 16px. */
export const LINE_DELTA_PX = 16

/**
 * Sheet LAYOUT width in px: A4 portrait at 96dpi, rounded. Interior sheet
 * geometry is cqw-based, so this one base width serves every preset — the
 * aspect ratio prop decides the shape, and export density is derived from
 * the real layout width downstream (pngCaptureScale).
 */
export const SHEET_BASE_WIDTH_PX = 794

/** How the sheet sits on the desk right now. */
export type CanvasViewMode = 'fit' | 'value'

export interface ViewState {
  /** Transform scale applied to the stage. */
  readonly s: number
  /** Stage translate in px — top-left of the scaled sheet, region-relative. */
  readonly tx: number
  readonly ty: number
  /** `fit` while the user hasn't zoomed manually; refits on region changes. */
  readonly mode: CanvasViewMode
}

export interface SheetSize {
  readonly w: number
  readonly h: number
}

export interface RegionSize {
  readonly w: number
  readonly h: number
}

export interface Anchor {
  readonly x: number
  readonly y: number
}

/** Clamp a scale into the 50–200% control range; unusable values fall to the minimum. */
export function clampZoom(scale: number): number {
  // NaN alone would poison min/max ordering — fall to the minimum. ±Infinity
  // are well-defined for Math.min/max and mean "hit the far clamp".
  if (Number.isNaN(scale)) return ZOOM_MIN
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale))
}

/**
 * Sheet layout size from an aspect ratio (width ÷ height). Invalid ratios
 * fall back to a square so a transient bad input can never produce a
 * 0/NaN-sized sheet box.
 */
export function sheetSizePx(aspectRatio: number, baseWidth: number = SHEET_BASE_WIDTH_PX): SheetSize {
  const w = Number.isFinite(baseWidth) && baseWidth > 0 ? baseWidth : SHEET_BASE_WIDTH_PX
  const valid = Number.isFinite(aspectRatio) && aspectRatio > 0
  return { w, h: valid ? w / aspectRatio : w }
}

/**
 * Scale that fits the whole sheet inside the region minus desk padding,
 * capped at 100% and floored at {@link FIT_MIN_SCALE}. Degenerate inputs
 * (zero-size region, e.g. before the ResizeObserver fires) return the floor.
 */
export function fitScale(sheet: SheetSize, region: RegionSize, padX: number = FIT_PAD_X, padY: number = FIT_PAD_Y): number {
  const availW = region.w - padX
  const availH = region.h - padY
  const usable = sheet.w > 0 && sheet.h > 0 && availW > 0 && availH > 0
  if (!usable) return FIT_MIN_SCALE
  const raw = Math.min(availW / sheet.w, availH / sheet.h)
  return Math.min(FIT_MAX_SCALE, Math.max(FIT_MIN_SCALE, raw))
}

/** Translate that centres the scaled sheet in the region (top-left origin maths). */
export function centerTranslate(sheet: SheetSize, scale: number, region: RegionSize): Anchor {
  return { x: (region.w - sheet.w * scale) / 2, y: (region.h - sheet.h * scale) / 2 }
}

/** Clamp a translate per axis: centred where the scaled sheet fits, edge-locked where it overflows. */
export function clampedTranslate(sheet: SheetSize, scale: number, region: RegionSize, tx: number, ty: number): Anchor {
  const bound = (scaled: number, size: number, t: number): number => {
    if (scaled <= size) return (size - scaled) / 2
    const lo = size - scaled
    return Math.min(0, Math.max(lo, t))
  }
  return {
    x: bound(sheet.w * scale, region.w, tx),
    y: bound(sheet.h * scale, region.h, ty),
  }
}

/** Whole-sheet fit view: fit scale + centred translate. */
export function fitView(sheet: SheetSize, region: RegionSize): ViewState {
  const s = fitScale(sheet, region)
  const { x, y } = centerTranslate(sheet, s, region)
  return { s, tx: x, ty: y, mode: 'fit' }
}

/**
 * Zoom to `nextScale` keeping the sheet point under `anchor` (region
 * coords) visually fixed — the mockup's zoomBy anchor maths. Scale is
 * clamped into the control range; translate is then clamped to pan bounds.
 */
export function zoomedView(prev: ViewState, sheet: SheetSize, region: RegionSize, nextScale: number, anchor: Anchor): ViewState {
  const s = clampZoom(nextScale)
  const tx = anchor.x - (anchor.x - prev.tx) * (s / prev.s)
  const ty = anchor.y - (anchor.y - prev.ty) * (s / prev.s)
  const clamped = clampedTranslate(sheet, s, region, tx, ty)
  return { s, tx: clamped.x, ty: clamped.y, mode: 'value' }
}

/** Pan by a pointer delta, clamped to pan bounds. */
export function pannedView(prev: ViewState, sheet: SheetSize, region: RegionSize, dx: number, dy: number): ViewState {
  const clamped = clampedTranslate(sheet, prev.s, region, prev.tx + dx, prev.ty + dy)
  return { s: prev.s, tx: clamped.x, ty: clamped.y, mode: 'value' }
}

/**
 * Re-clamp a kept-scale view after geometry changed (region resized, page
 * setup changed): the user's zoom survives, the sheet recentres on axes
 * that gained slack and stays in bounds on axes that lost slack.
 */
export function reframeView(prev: ViewState, sheet: SheetSize, region: RegionSize): ViewState {
  const clamped = clampedTranslate(sheet, prev.s, region, prev.tx, prev.ty)
  return { s: prev.s, tx: clamped.x, ty: clamped.y, mode: 'value' }
}

/** Next scale for a stepped zoom button/keyboard press, clamped to 50–200%. */
export function zoomStepScale(scale: number, direction: 1 | -1): number {
  return clampZoom(scale * ZOOM_STEP_FACTOR ** direction)
}

/**
 * True when the current zoom is meaningfully bigger than fit and dragging
 * should pan (mockup parity: fit and smaller never pans).
 */
export function isPannable(scale: number, fit: number): boolean {
  return scale > fit + PAN_EPSILON
}

/** Normalise a wheel deltaY to pixels (deltaMode 1 reports lines). */
export function wheelDeltaPx(deltaY: number, deltaMode: number = 0): number {
  return deltaMode === 1 ? deltaY * LINE_DELTA_PX : deltaY
}

/** Continuous 1:1 zoom factor for trackpad pinch (ctrl+wheel) — no stepping, applied without transition. */
export function wheelFactor(deltaY: number, deltaMode: number = 0): number {
  return Math.exp(-wheelDeltaPx(deltaY, deltaMode) * WHEEL_SENSITIVITY)
}

/** Percentage readout, e.g. `'85%'`; unusable scales read as the zoom minimum. */
export function percentLabel(scale: number): string {
  const safe = Number.isFinite(scale) ? scale : ZOOM_MIN
  return `${Math.round(safe * 100)}%`
}

/** Readouts and intent handlers for the PrintCanvas desk. */
export interface UseCanvasView {
  /** Sheet layout box feeding the wrapper style and all math. */
  readonly sheet: ComputedRef<SheetSize>
  /** Full current view state (scale, translate, mode). */
  readonly state: ComputedRef<ViewState>
  /** Current zoom as a percentage label (`'53%'`). */
  readonly percent: ComputedRef<string>
  /** True when zoomed past fit and drag-to-pan should engage. */
  readonly pannable: ComputedRef<boolean>
  /** True while the view is the automatic fit (drives the Fit button's aria-pressed). */
  readonly isFit: ComputedRef<boolean>
  /** Whether transform changes may ease (buttons/keyboard); wheel and pan set it off. CSS also honours reduced-motion. */
  readonly animated: Ref<boolean>
  /** Style for the stage wrapper — the translate+scale transform. */
  readonly stageStyle: ComputedRef<{ transform: string }>
  /** Style for the sheet host box — constant layout width + true aspect ratio. */
  readonly sheetStyle: ComputedRef<{ width: string; 'aspect-ratio': string }>
  /** Feed the observed region size (ResizeObserver in PrintCanvas). */
  setRegion(width: number, height: number): void
  /** Return to fit-to-region and re-arm easing. */
  fit(): void
  /** Stepped zoom (×1.2 per press), eased, anchored on the region centre. */
  zoomStep(direction: 1 | -1): void
  /** Continuous wheel/pinch-trackpad zoom (ctrl+wheel deltas), immediate, region-centre anchored. */
  zoomWheel(deltaY: number, deltaMode?: number): void
  /** Touch pinch zoom by a distance ratio, anchored at the gesture midpoint (region coords). */
  zoomTouch(factor: number, anchor: Anchor): void
  /** Pan by a pointer delta, clamped to bounds. */
  panBy(dx: number, dy: number): void
}

/** Options for {@link useCanvasView}. */
export interface UseCanvasViewOptions {
  /** Reactive sheet aspect ratio (width ÷ height), e.g. from usePageSetup. */
  readonly aspectRatio: MaybeRefOrGetter<number>
}

/**
 * Reactive canvas view for PrintCanvas. Deliberately DOM-free so it runs
 * under the node-only vitest environment; PrintCanvas owns the
 * ResizeObserver, pointer and keyboard wiring and feeds this API.
 */
export function useCanvasView(options: UseCanvasViewOptions): UseCanvasView {
  const region = ref<RegionSize>({ w: 0, h: 0 })
  const state = ref<ViewState>({ s: ZOOM_MIN, tx: 0, ty: 0, mode: 'fit' })
  /** Public view state is read-only — every change goes through the intent methods. */
  const readonlyState = computed<ViewState>(() => state.value)
  const animated = ref(true)

  const sheet = computed(() => sheetSizePx(toValue(options.aspectRatio)))
  /** Live fit scale — renamed off `fit` so the `fit()` intent method keeps the public name. */
  const autoFit = computed(() => fitScale(sheet.value, region.value))
  const percent = computed(() => percentLabel(state.value.s))
  const isFit = computed(() => state.value.mode === 'fit')
  const pannable = computed(() => isPannable(state.value.s, autoFit.value))
  const stageStyle = computed(() => ({
    transform: `translate(${state.value.tx}px, ${state.value.ty}px) scale(${state.value.s})`,
  }))
  const sheetStyle = computed(() => ({
    width: `${sheet.value.w}px`,
    'aspect-ratio': `${sheet.value.w} / ${sheet.value.h}`,
  }))

  // Geometry changes refit a fit-view; a manually zoomed view keeps its
  // scale and is merely re-clamped/recentred (reframe), matching the mockup.
  watch([sheet, region], () => {
    state.value = state.value.mode === 'fit'
      ? fitView(sheet.value, region.value)
      : reframeView(state.value, sheet.value, region.value)
  }, { immediate: true })

  const center = (): Anchor => ({ x: region.value.w / 2, y: region.value.h / 2 })

  function setRegion(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return
    region.value = { w: width, h: height }
  }

  function fit(): void {
    animated.value = true
    state.value = fitView(sheet.value, region.value)
  }

  function zoomStep(direction: 1 | -1): void {
    animated.value = true
    state.value = zoomedView(state.value, sheet.value, region.value, zoomStepScale(state.value.s, direction), center())
  }

  function zoomWheel(deltaY: number, deltaMode: number = 0): void {
    if (!Number.isFinite(deltaY)) return
    animated.value = false
    state.value = zoomedView(state.value, sheet.value, region.value, state.value.s * wheelFactor(deltaY, deltaMode), center())
  }

  function zoomTouch(factor: number, anchor: Anchor): void {
    if (!(Number.isFinite(factor) && factor > 0)) return
    animated.value = false
    state.value = zoomedView(state.value, sheet.value, region.value, state.value.s * factor, anchor)
  }

  function panBy(dx: number, dy: number): void {
    animated.value = false
    state.value = pannedView(state.value, sheet.value, region.value, dx, dy)
  }

  return { sheet, state: readonlyState, percent, pannable, isFit, animated, stageStyle, sheetStyle, setRegion, fit, zoomStep, zoomWheel, zoomTouch, panBy }
}
