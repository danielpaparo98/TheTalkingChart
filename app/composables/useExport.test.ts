/**
 * Pure export-math invariants (no DOM, no canvas, no jsPDF): unit conversions,
 * fit-contain centring, filename building, PNG capture-scale derivation, the
 * jsPDF page config for all 8 preset/orientation combos, and attribution
 * assembly. The canvas/jsPDF paths of useExport are browser-only thin
 * wrappers around dynamically imported libs — they never load here, so there
 * is nothing to mock.
 */

import { ref } from 'vue'
import { describe, expect, test } from 'vitest'
import { ARASAAC_ATTRIBUTION } from './useArasaac'
import type { IconSetMeta } from '../types/icons'
import type { PageSetup } from '../types/chart'
import type { ExportableDoc } from './useExport'
import {
  attributionLine,
  exportFilename,
  fitContain,
  mmToPt,
  mmToPx,
  pdfPageConfig,
  pngCaptureScale,
  sanitizeTitle,
  usedSetPrefixes,
  useExport,
} from './useExport'

/** A4 portrait doc slice shaped exactly like the v2 ChartDoc fields. */
const DOC: ExportableDoc = {
  title: 'Doc',
  pageSetup: { preset: 'a4', orientation: 'portrait', marginPreset: 'normal' },
  usesArasaac: true,
  cells: [{ id: 'c1', icon: { source: 'bundle', set: 'mdi', name: 'home' }, label: 'Home' }],
}

const MDI: IconSetMeta = {
  prefix: 'mdi',
  label: 'Material Design Icons',
  license: 'Apache-2.0',
  attribution: 'Material Design Icons by Pictogrammers — https://pictogrammers.com/library/mdi/ (Apache-2.0)',
  count: 14001,
}

describe('unit conversions', () => {
  test('mm→px uses the CSS reference pixel (96 px per inch)', () => {
    expect(mmToPx(0)).toBe(0)
    expect(mmToPx(210)).toBeCloseTo(793.7007874, 4) // A4 width
    expect(mmToPx(297)).toBeCloseTo(1122.519685, 4) // A4 height
  })

  test('mm→pt uses the PDF point (72 pt per inch)', () => {
    expect(mmToPt(0)).toBe(0)
    expect(mmToPt(210)).toBeCloseTo(595.2755906, 4) // A4 width in pt
    expect(mmToPt(297)).toBeCloseTo(841.8897638, 4) // A4 height in pt
  })
})

describe('fitContain', () => {
  test('matching aspect fills the box exactly', () => {
    expect(fitContain(210, 297, 420, 594)).toEqual({ x: 0, y: 0, width: 420, height: 594 })
  })

  test('wider content is width-fitted and vertically centred', () => {
    expect(fitContain(200, 100, 100, 100)).toEqual({ x: 0, y: 25, width: 100, height: 50 })
  })

  test('taller content is height-fitted and horizontally centred', () => {
    expect(fitContain(100, 200, 100, 100)).toEqual({ x: 25, y: 0, width: 50, height: 100 })
  })

  test('degenerate dims return a finite scale-1 rect — never Infinity', () => {
    // zero/negative/NaN box or content dims all land on the scale-1 fallback
    expect(fitContain(0, 297, 420, 594)).toEqual({ x: 0, y: 0, width: 0, height: 297 })
    expect(fitContain(210, 0, 0, 0)).toEqual({ x: 0, y: 0, width: 210, height: 0 })
    expect(fitContain(Number.NaN, 297, 420, 594)).toEqual({ x: 0, y: 0, width: 0, height: 297 })
    expect(fitContain(210, 297, -5, 594)).toEqual({ x: 0, y: 0, width: 210, height: 297 })
    expect(fitContain(210, 297, 420, Number.POSITIVE_INFINITY)).toEqual({ x: 0, y: 0, width: 210, height: 297 })
  })
})

describe('exportFilename', () => {
  test('appends the -chart suffix and extension to a sanitized title', () => {
    expect(exportFilename('My Chart', 'png')).toBe('My-Chart-chart.png')
    expect(exportFilename('Multispace   title', 'pdf')).toBe('Multispace-title-chart.pdf')
  })

  test('strips filesystem-invalid characters', () => {
    expect(exportFilename('A/B:C?', 'pdf')).toBe('ABC-chart.pdf')
    expect(exportFilename('<>:"/\\|?*', 'png')).toBe('chart.png')
  })

  test('falls back to the generic chart name for a blank title', () => {
    expect(exportFilename('   ', 'png')).toBe('chart.png')
    expect(exportFilename('', 'pdf')).toBe('chart.pdf')
  })

  test('sanitizeTitle drops control characters too', () => {
    expect(sanitizeTitle('a\u0001b')).toBe('ab')
  })
})

describe('pngCaptureScale', () => {
  test('an element at true CSS page size captures at the density multiplier', () => {
    // ×2/÷2 are power-of-two-exact float ops, so these compare exactly.
    expect(pngCaptureScale(210, mmToPx(210))).toBe(2)
    expect(pngCaptureScale(297, mmToPx(297), 3)).toBeCloseTo(3, 12)
  })

  test('a half-size element doubles the scale so the raster stays true-page', () => {
    expect(pngCaptureScale(210, mmToPx(210) / 2)).toBe(4)
  })

  test('unusable element width or density falls back to the multiplier', () => {
    expect(pngCaptureScale(210, 0)).toBe(2)
    expect(pngCaptureScale(210, -5)).toBe(2)
    expect(pngCaptureScale(210, Number.NaN)).toBe(2)
    expect(pngCaptureScale(Number.NaN, 100)).toBe(2)
    expect(pngCaptureScale(210, mmToPx(210) / 2, Number.NaN)).toBe(4)
  })
})

describe('pdfPageConfig — all 8 preset/orientation combos', () => {
  test('portrait combos keep the preset order and report portrait', () => {
    expect(pdfPageConfig({ preset: 'a4', orientation: 'portrait', marginPreset: 'normal' })).toEqual({
      orientation: 'portrait',
      format: [210, 297],
    })
    expect(pdfPageConfig({ preset: 'letter', orientation: 'portrait', marginPreset: 'narrow' })).toEqual({
      orientation: 'portrait',
      format: [215.9, 279.4],
    })
    expect(pdfPageConfig({ preset: 'a5', orientation: 'portrait', marginPreset: 'wide' })).toEqual({
      orientation: 'portrait',
      format: [148, 210],
    })
    expect(pdfPageConfig({ preset: 'a3', orientation: 'portrait', marginPreset: 'normal' })).toEqual({
      orientation: 'portrait',
      format: [297, 420],
    })
  })

  test('landscape combos swap the dims and report landscape', () => {
    expect(pdfPageConfig({ preset: 'a4', orientation: 'landscape', marginPreset: 'normal' })).toEqual({
      orientation: 'landscape',
      format: [297, 210],
    })
    expect(pdfPageConfig({ preset: 'letter', orientation: 'landscape', marginPreset: 'narrow' })).toEqual({
      orientation: 'landscape',
      format: [279.4, 215.9],
    })
    expect(pdfPageConfig({ preset: 'a5', orientation: 'landscape', marginPreset: 'wide' })).toEqual({
      orientation: 'landscape',
      format: [210, 148],
    })
    expect(pdfPageConfig({ preset: 'a3', orientation: 'landscape', marginPreset: 'normal' })).toEqual({
      orientation: 'landscape',
      format: [420, 297],
    })
  })

  test('orientation always agrees with the format ordering (jsPDF never swaps)', () => {
    const PRESETS = ['a4', 'letter', 'a5', 'a3'] as const
    const setups: PageSetup[] = PRESETS.flatMap((preset) => [
      { preset, orientation: 'portrait', marginPreset: 'normal' },
      { preset, orientation: 'landscape', marginPreset: 'normal' },
    ])
    for (const { orientation, format } of setups.map(pdfPageConfig)) {
      const [widthMm, heightMm] = format
      expect(orientation === 'landscape').toBe(widthMm >= heightMm)
    }
  })
})

describe('attribution assembly', () => {
  test('usedSetPrefixes collects unique bundle prefixes in first-seen order', () => {
    const cells = [
      { icon: { source: 'bundle', set: 'mdi', name: 'a' } },
      { icon: null },
      { icon: { source: 'bundle', set: 'tabler', name: 'b' } },
      { icon: { source: 'bundle', set: 'mdi', name: 'c' } },
    ] as const
    expect(usedSetPrefixes([...cells])).toEqual(['mdi', 'tabler'])
  })

  test('usedSetPrefixes skips empty cells and ARASAAC icons (governed by the flag)', () => {
    const cells = [
      { icon: null },
      { icon: { source: 'arasaac', set: 'arasaac', name: '123' } },
    ] as const
    expect(usedSetPrefixes([...cells])).toEqual([])
  })

  test('attributionLine lists bundle sets as label (license)', () => {
    expect(attributionLine([MDI], false)).toBe('Icons: Material Design Icons (Apache-2.0)')
  })

  test('the ARASAAC segment is the byte-exact required string, always last', () => {
    expect(attributionLine([], true)).toBe(`Icons: ${ARASAAC_ATTRIBUTION}`)
    expect(attributionLine([MDI], true)).toBe(
      `Icons: Material Design Icons (Apache-2.0) · ${ARASAAC_ATTRIBUTION}`,
    )
  })

  test('an empty chart produces an empty line (notice renders nothing)', () => {
    expect(attributionLine([], false)).toBe('')
  })
})

describe('useExport composable wiring (pure reactive surface)', () => {
  test('attribution assembles bundle rows plus the ARASAAC notice via the resolver', () => {
    const { attribution } = useExport({ doc: DOC, resolveSetMeta: (prefix) => (prefix === 'mdi' ? MDI : null) })
    expect(attribution.value).toBe(`Icons: Material Design Icons (Apache-2.0) · ${ARASAAC_ATTRIBUTION}`)
  })

  test('unresolvable prefixes are skipped — licence text is never invented', () => {
    const { attribution } = useExport({ doc: DOC, resolveSetMeta: () => null })
    expect(attribution.value).toBe(`Icons: ${ARASAAC_ATTRIBUTION}`)
  })

  test('unresolvable prefixes are skipped — licence text is never invented', () => {
    const { attribution } = useExport({ doc: DOC, resolveSetMeta: () => null })
    expect(attribution.value).toBe(`Icons: ${ARASAAC_ATTRIBUTION}`)
  })

  test('a reactive doc getter drives the attribution reactively', () => {
    const doc = ref<ExportableDoc>({ ...DOC, usesArasaac: false })
    const { attribution } = useExport({ doc, resolveSetMeta: (prefix) => (prefix === 'mdi' ? MDI : null) })
    expect(attribution.value).toBe('Icons: Material Design Icons (Apache-2.0)')
    doc.value = { ...doc.value, usesArasaac: true }
    expect(attribution.value).toBe(`Icons: Material Design Icons (Apache-2.0) · ${ARASAAC_ATTRIBUTION}`)
  })
})
