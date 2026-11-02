/**
 * useCanvasView unit tests — pure zoom/pan math plus the DOM-free reactive
 * shell (no DOM environment needed; DOM wiring lives in PrintCanvas.vue):
 * - clamping, sheet sizing, fit scale (padding, cap, floor, degenerate input)
 * - anchor-preserving zoom, pan bounds, reframe-on-geometry-change
 * - wheel/pinch factor maths and percentage readouts
 * - composable intent calls: fit, stepped zoom, wheel, touch pinch, pan
 * - mode transitions (fit ↔ value) and reactive aspect-ratio changes
 */

import { nextTick, ref } from 'vue'
import { describe, expect, test } from 'vitest'

import {
  FIT_MAX_SCALE,
  FIT_MIN_SCALE,
  FIT_PAD_X,
  LINE_DELTA_PX,
  SHEET_BASE_WIDTH_PX,
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  centerTranslate,
  clampedTranslate,
  fitScale,
  fitView,
  isPannable,
  pannedView,
  percentLabel,
  reframeView,
  sheetSizePx,
  useCanvasView,
  wheelDeltaPx,
  wheelFactor,
  zoomStepScale,
  zoomedView,
} from './useCanvasView'

/** A4 portrait sheet at the constant base width — the recurring test fixture. */
const SHEET = sheetSizePx(210 / 297) // { 794, ≈1122.94 }
const REGION = { w: 800, h: 600 }
const CENTER = { x: REGION.w / 2, y: REGION.h / 2 }

describe('clampZoom', () => {
  test('keeps in-range scales untouched', () => {
    expect(clampZoom(0.5)).toBe(0.5)
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(2)).toBe(2)
    expect(clampZoom(1.234)).toBe(1.234)
  })

  test('clamps out-of-range scales into 50–200%', () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN)
    expect(clampZoom(4)).toBe(ZOOM_MAX)
  })

  test('unusable values fall to the minimum instead of poisoning the transform', () => {
    expect(clampZoom(Number.NaN)).toBe(ZOOM_MIN)
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_MAX)
    expect(clampZoom(Number.NEGATIVE_INFINITY)).toBe(ZOOM_MIN)
  })
})

describe('sheetSizePx', () => {
  test('derives height from the aspect ratio at the constant base width', () => {
    const portrait = sheetSizePx(210 / 297)
    expect(portrait.w).toBe(794)
    expect(portrait.h).toBeCloseTo(794 * (297 / 210), 6)

    const landscape = sheetSizePx(297 / 210)
    expect(landscape.w).toBe(794)
    expect(landscape.h).toBeCloseTo(794 * (210 / 297), 6)
  })

  test('honours an explicit base width', () => {
    const size = sheetSizePx(2, 400)
    expect(size).toEqual({ w: 400, h: 200 })
  })

  test('invalid ratio or width falls back to a usable square', () => {
    expect(sheetSizePx(Number.NaN)).toEqual({ w: 794, h: 794 })
    expect(sheetSizePx(0)).toEqual({ w: 794, h: 794 })
    expect(sheetSizePx(-2)).toEqual({ w: 794, h: 794 })
    expect(sheetSizePx(2, Number.NaN)).toEqual({ w: 794, h: 397 })
  })
})

describe('fitScale', () => {
  test('height-limited: portrait sheet in a squat region', () => {
    // avail 712 × 496; width would allow 0.897, height only ≈0.4417.
    expect(fitScale(SHEET, REGION)).toBeCloseTo(496 / SHEET.h, 6)
  })

  test('width-limited: landscape sheet in a tall region', () => {
    const landscape = sheetSizePx(297 / 210) // { 794, ≈561.6 }
    // Tall region: after the vertical desk pad, height leaves slack — the
    // width limit (712px) is what clips.
    const region = { w: 800, h: 900 }
    expect(fitScale(landscape, region)).toBeCloseTo((region.w - FIT_PAD_X) / landscape.w, 6)
  })

  test('never magnifies past 100%', () => {
    expect(fitScale(SHEET, { w: 4000, h: 3000 })).toBe(FIT_MAX_SCALE)
  })

  test('floors below 10% so tiny regions still fit the sheet', () => {
    expect(fitScale(SHEET, { w: 200, h: 120 })).toBe(FIT_MIN_SCALE)
  })

  test('degenerate region or sheet returns the floor', () => {
    expect(fitScale(SHEET, { w: 0, h: 0 })).toBe(FIT_MIN_SCALE)
    expect(fitScale(SHEET, { w: 88, h: 104 })).toBe(FIT_MIN_SCALE) // exactly consumed by padding
    expect(fitScale({ w: 0, h: 0 }, REGION)).toBe(FIT_MIN_SCALE)
  })
})

describe('centerTranslate / clampedTranslate', () => {
  test('centres the scaled sheet in the region', () => {
    const at = centerTranslate(SHEET, 0.5, REGION)
    expect(at.x).toBeCloseTo((REGION.w - SHEET.w * 0.5) / 2, 6)
    expect(at.y).toBeCloseTo((REGION.h - SHEET.h * 0.5) / 2, 6)
  })

  test('centres axes with slack, edge-locks overflowing axes', () => {
    // scale 1: width fits (794 ≤ 800), height overflows (1123 > 600).
    const at = clampedTranslate(SHEET, 1, REGION, 123, -456)
    expect(at.x).toBeCloseTo((REGION.w - SHEET.w) / 2, 6)
    expect(at.y).toBe(-456) // within the [-523, 0] band → untouched

    expect(clampedTranslate(SHEET, 1, REGION, 0, -9999).y).toBe(REGION.h - SHEET.h) // bottom edge
    expect(clampedTranslate(SHEET, 1, REGION, 0, 9999).y).toBe(0) // top edge
  })
})

describe('fitView', () => {
  test('combines fit scale with centring and marks the mode fit', () => {
    const view = fitView(SHEET, REGION)
    expect(view.s).toBe(fitScale(SHEET, REGION))
    expect(view.tx).toBeCloseTo((REGION.w - SHEET.w * view.s) / 2, 6)
    expect(view.ty).toBeCloseTo((REGION.h - SHEET.h * view.s) / 2, 6)
    expect(view.mode).toBe('fit')
  })
})

describe('zoomedView', () => {
  test('keeps the sheet point under the anchor visually fixed', () => {
    const prev = { s: 1, tx: 10, ty: 20, mode: 'fit' as const }
    const next = zoomedView(prev, SHEET, REGION, 1.5, { x: 400, y: 300 })
    // Content point under the anchor before == after (translate + scale maths).
    expect(400 - next.tx).toBeCloseTo((400 - prev.tx) * 1.5, 6)
    expect(300 - next.ty).toBeCloseTo((300 - prev.ty) * 1.5, 6)
    expect(next.s).toBe(1.5)
    expect(next.mode).toBe('value')
  })

  test('clamps scale and translate (centre-anchored zoom of a centred sheet stays centred)', () => {
    const fit = fitView(SHEET, REGION)
    const maxed = zoomedView(fit, SHEET, REGION, 99, CENTER)
    expect(maxed.s).toBe(ZOOM_MAX)
    expect(maxed.tx).toBeCloseTo((REGION.w - SHEET.w * ZOOM_MAX) / 2, 6)
    expect(maxed.ty).toBeCloseTo((REGION.h - SHEET.h * ZOOM_MAX) / 2, 6)

    const minned = zoomedView({ s: 2, tx: 0, ty: 0, mode: 'value' }, SHEET, REGION, 0.01, CENTER)
    expect(minned.s).toBe(ZOOM_MIN)
  })
})

describe('pannedView', () => {
  test('applies the delta and keeps mode value', () => {
    // Pan from a ZOOMED base — at fit the sheet fits the region, so clamping
    // (correctly) allows no movement and there would be nothing to assert.
    const centre = { x: REGION.w / 2, y: REGION.h / 2 }
    const base = zoomedView(fitView(SHEET, REGION), SHEET, REGION, ZOOM_MAX, centre)

    const moved = pannedView(base, SHEET, REGION, 20, -30)
    expect(moved.s).toBe(base.s)
    expect(moved.tx).toBeCloseTo(base.tx + 20, 6)
    expect(moved.ty).toBeCloseTo(base.ty - 30, 6)
    expect(moved.mode).toBe('value')
  })

  test('clamps to the pan bounds at the edges', () => {
    const zoomed = { s: 2, tx: 0, ty: 0, mode: 'value' as const }
    // scale 2: scaled size 1588 × 2245.9 → x band [-788, 0], y band [-1645.9, 0].
    expect(pannedView(zoomed, SHEET, REGION, 9000, 0).tx).toBe(0)
    expect(pannedView(zoomed, SHEET, REGION, -9000, 0).tx).toBe(REGION.w - SHEET.w * 2)
    expect(pannedView(zoomed, SHEET, REGION, 0, -9000).ty).toBe(REGION.h - SHEET.h * 2)
  })
})

describe('reframeView', () => {
  test('keeps the user zoom, recentres axes that gained slack, keeps overflowing axes valid', () => {
    const zoomed = { s: 2, tx: -400, ty: -1000, mode: 'value' as const }
    const reframed = reframeView(zoomed, SHEET, { w: 4000, h: 3000 })
    expect(reframed.s).toBe(2)
    expect(reframed.mode).toBe('value')
    expect(reframed.tx).toBeCloseTo((4000 - SHEET.w * 2) / 2, 6)
    expect(reframed.ty).toBeCloseTo((3000 - SHEET.h * 2) / 2, 6)
  })
})

describe('zoomStepScale', () => {
  test('steps ×1.2 multiplicatively', () => {
    expect(zoomStepScale(1, 1)).toBeCloseTo(1.2, 6)
    expect(zoomStepScale(1, -1)).toBeCloseTo(1 / 1.2, 6)
  })

  test('clamps at the 50–200% bounds', () => {
    expect(zoomStepScale(1.9, 1)).toBe(ZOOM_MAX)
    expect(zoomStepScale(0.55, -1)).toBe(ZOOM_MIN)
  })
})

describe('isPannable', () => {
  test('only zooms meaningfully above fit pan', () => {
    expect(isPannable(0.4417, 0.4417)).toBe(false)
    expect(isPannable(0.4425, 0.4417)).toBe(false) // within the 0.002 epsilon
    expect(isPannable(0.4517, 0.4417)).toBe(true)
    expect(isPannable(0.3, 0.4417)).toBe(false)
  })
})

describe('wheel / pinch maths', () => {
  test('wheelDeltaPx passes pixels through and expands line mode', () => {
    expect(wheelDeltaPx(-24)).toBe(-24)
    expect(wheelDeltaPx(3, 1)).toBe(3 * LINE_DELTA_PX)
  })

  test('wheelFactor is 1:1 continuous — no delta, no zoom; pinch-in enlarges, pinch-out shrinks', () => {
    expect(wheelFactor(0)).toBe(1)
    expect(wheelFactor(-20)).toBeGreaterThan(1)
    expect(wheelFactor(20)).toBeLessThan(1)
  })

  test('line-mode deltas equal their pixel equivalents', () => {
    expect(wheelFactor(2, 1)).toBe(wheelFactor(2 * LINE_DELTA_PX, 0))
  })
})

describe('percentLabel', () => {
  test('rounds the scale to a whole percentage', () => {
    expect(percentLabel(0.5)).toBe('50%')
    expect(percentLabel(1)).toBe('100%')
    expect(percentLabel(2)).toBe('200%')
    expect(percentLabel(0.847)).toBe('85%')
  })

  test('unusable scale reads as the zoom minimum', () => {
    expect(percentLabel(Number.NaN)).toBe('50%')
  })
})

describe('useCanvasView (reactive shell)', () => {
  test('starts at fit and recomputes when the region size arrives', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    await nextTick()

    view.setRegion(REGION.w, REGION.h)
    await nextTick()

    expect(view.isFit.value).toBe(true)
    expect(view.state.value.s).toBeCloseTo(fitScale(SHEET, REGION), 6)
    expect(view.percent.value).toBe(percentLabel(fitScale(SHEET, REGION)))
    expect(view.pannable.value).toBe(false)
  })

  test('ignores non-finite region sizes', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    await nextTick()

    view.setRegion(Number.NaN, 600)
    await nextTick()

    expect(view.state.value.s).toBe(fitScale(SHEET, { w: 0, h: 0 })) // region still the initial 0×0
  })

  test('stepped zoom leaves fit mode, eases, and enables panning', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    view.setRegion(REGION.w, REGION.h)
    await nextTick()
    const fitS = view.state.value.s

    view.zoomStep(1)
    expect(view.state.value.mode).toBe('value')
    expect(view.isFit.value).toBe(false)
    expect(view.animated.value).toBe(true)
    expect(view.state.value.s).toBeCloseTo(zoomStepScale(fitS, 1), 6)
    expect(view.pannable.value).toBe(true)
  })

  test('stepped zoom clamps at the bounds after repeated presses', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    view.setRegion(REGION.w, REGION.h)
    await nextTick()

    for (let i = 0; i < 12; i += 1) view.zoomStep(1)
    expect(view.state.value.s).toBe(ZOOM_MAX)

    for (let i = 0; i < 12; i += 1) view.zoomStep(-1)
    expect(view.state.value.s).toBe(ZOOM_MIN)
  })

  test('wheel zoom is immediate (no easing) and clamps', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    view.setRegion(REGION.w, REGION.h)
    await nextTick()

    // Positive wheel delta zooms OUT, negative zooms IN; garbage deltas are ignored.
    view.zoomWheel(100000)
    expect(view.animated.value).toBe(false)
    expect(view.state.value.s).toBe(ZOOM_MIN)

    view.zoomWheel(-100000)
    expect(view.state.value.s).toBe(ZOOM_MAX)

    view.zoomWheel(Number.NaN)
    expect(view.state.value.s).toBe(ZOOM_MAX) // untouched
  })

  test('touch pinch zoom applies a distance ratio at the gesture midpoint', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    view.setRegion(REGION.w, REGION.h)
    await nextTick()
    const fit = fitView(SHEET, REGION)

    view.zoomTouch(2, CENTER)
    expect(view.animated.value).toBe(false)
    expect(view.state.value.s).toBeCloseTo(fit.s * 2, 6)
    expect(400 - view.state.value.tx).toBeCloseTo((400 - fit.tx) * 2, 6)
    expect(view.state.value.mode).toBe('value')

    const before = view.state.value
    view.zoomTouch(Number.NaN, CENTER)
    view.zoomTouch(0, CENTER)
    expect(view.state.value).toEqual(before) // unusable factors are no-ops
  })

  test('pan moves and clamps within bounds', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    view.setRegion(REGION.w, REGION.h)
    await nextTick()
    view.zoomStep(1)
    view.zoomStep(1)
    view.zoomStep(1)
    view.zoomStep(1)
    view.zoomStep(1)
    view.zoomStep(1)
    view.zoomStep(1)
    view.zoomStep(1)
    view.zoomStep(1)
    view.zoomStep(1)
    view.zoomStep(1)
    view.zoomStep(1)
    expect(view.state.value.s).toBe(ZOOM_MAX) // fit ≈44% reaches the 200% cap in ≤12 ×1.2 steps

    view.panBy(9000, -9000)
    expect(view.state.value.tx).toBe(0)
    expect(view.state.value.ty).toBe(REGION.h - SHEET.h * ZOOM_MAX)
    expect(view.animated.value).toBe(false)
  })

  test('fit() restores the automatic fit and re-arms easing', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    view.setRegion(REGION.w, REGION.h)
    await nextTick()

    view.zoomWheel(500)
    view.fit()
    expect(view.isFit.value).toBe(true)
    expect(view.animated.value).toBe(true)
    expect(view.state.value.s).toBeCloseTo(fitScale(SHEET, REGION), 6)
    expect(view.state.value.tx).toBeCloseTo((REGION.w - SHEET.w * view.state.value.s) / 2, 6)
  })

  test('region resize keeps a manual zoom but reframes it into bounds', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    view.setRegion(REGION.w, REGION.h)
    await nextTick()
    view.zoomWheel(-100000) // zoom IN → hits the 200% cap
    expect(view.state.value.s).toBe(ZOOM_MAX)

    view.setRegion(4000, 3000)
    await nextTick()

    expect(view.state.value.s).toBe(ZOOM_MAX) // user zoom survives
    expect(view.state.value.mode).toBe('value')
    expect(view.state.value.tx).toBeCloseTo((4000 - SHEET.w * ZOOM_MAX) / 2, 6)
    expect(view.state.value.ty).toBeCloseTo((3000 - SHEET.h * ZOOM_MAX) / 2, 6)
  })

  test('region resize in fit mode refits', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    view.setRegion(REGION.w, REGION.h)
    await nextTick()

    view.setRegion(2000, 800)
    await nextTick()

    expect(view.state.value.s).toBeCloseTo(fitScale(SHEET, { w: 2000, h: 800 }), 6)
  })

  test('aspect ratio changes flow through the sheet size and the fit', async () => {
    const aspect = ref(210 / 297)
    const view = useCanvasView({ aspectRatio: aspect })
    view.setRegion(REGION.w, REGION.h)
    await nextTick()
    expect(view.sheet.value.h).toBeCloseTo(794 * (297 / 210), 6)

    aspect.value = 297 / 210
    await nextTick()

    expect(view.sheet.value.h).toBeCloseTo(794 * (210 / 297), 6)
    expect(view.state.value.s).toBeCloseTo(fitScale(sheetSizePx(297 / 210), REGION), 6)
  })

  test('styles: stage carries the translate+scale transform, sheet host the constant layout box', async () => {
    const view = useCanvasView({ aspectRatio: 210 / 297 })
    view.setRegion(REGION.w, REGION.h)
    await nextTick()
    view.zoomStep(1)

    expect(view.stageStyle.value.transform).toBe(
      `translate(${view.state.value.tx}px, ${view.state.value.ty}px) scale(${view.state.value.s})`,
    )
    expect(view.sheetStyle.value.width).toBe(`${SHEET_BASE_WIDTH_PX}px`)
    expect(view.sheetStyle.value['aspect-ratio']).toBe(`${view.sheet.value.w} / ${view.sheet.value.h}`)
  })
})
