/**
 * Paper-thumbnail geometry: the longer edge is pinned, the shorter edge
 * follows the sheet's true mm aspect, landscape swaps which edge is long.
 */

import { describe, expect, test } from 'vitest'
import { PAPER_THUMB_LONG_EDGE_PX, paperThumbBox } from './page-thumbnail'

describe('paperThumbBox', () => {
  test('portrait sheets are taller than wide (A4 at the default edge)', () => {
    expect(paperThumbBox('a4', 'portrait')).toEqual({ width: 24, height: 34 })
  })

  test('landscape sheets are wider than tall', () => {
    expect(paperThumbBox('a4', 'landscape')).toEqual({ width: 34, height: 24 })
  })

  test('aspect matches the real mm ratio per preset', () => {
    const letterL = paperThumbBox('letter', 'landscape')
    expect(letterL.width / letterL.height).toBeCloseTo(279.4 / 215.9, 1)

    const a5P = paperThumbBox('a5', 'portrait')
    expect(a5P.height / a5P.width).toBeCloseTo(210 / 148, 1)
  })

  test('the longer edge is exactly the configured edge', () => {
    for (const preset of ['a4', 'letter', 'a5', 'a3'] as const) {
      for (const orientation of ['portrait', 'landscape'] as const) {
        const box = paperThumbBox(preset, orientation)
        expect(Math.max(box.width, box.height)).toBe(PAPER_THUMB_LONG_EDGE_PX)
        expect(Math.min(box.width, box.height)).toBeLessThan(PAPER_THUMB_LONG_EDGE_PX)
        expect(Math.min(box.width, box.height)).toBeGreaterThan(0)
      }
    }
  })

  test('custom edge scales proportionally', () => {
    expect(paperThumbBox('a4', 'portrait', 68)).toEqual({ width: 48.1, height: 68 })
  })
})
