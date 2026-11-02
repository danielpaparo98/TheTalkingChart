/**
 * Tint vocabulary: the swatch row carries the six approved CARD_TINTS hexes
 * verbatim plus "none", and `activeTintId` normalises cell colours onto the
 * row (unknown colours count as none so exactly one swatch is ever pressed).
 */

import { describe, expect, test } from 'vitest'
import { CARD_TINTS } from './templates'
import { TINT_SWATCHES, activeTintId } from './tints'

describe('TINT_SWATCHES', () => {
  test('carries the six approved tints + none, with the exact palette hexes', () => {
    expect(TINT_SWATCHES.map((swatch) => swatch.color)).toEqual([
      CARD_TINTS.mint,
      CARD_TINTS.lemon,
      CARD_TINTS.sky,
      CARD_TINTS.peach,
      CARD_TINTS.orange,
      CARD_TINTS.lilac,
      null,
    ])
  })

  test('every swatch is labelled and uniquely identified', () => {
    const ids = TINT_SWATCHES.map((swatch) => swatch.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const swatch of TINT_SWATCHES) expect(swatch.label).not.toBe('')
  })
})

describe('activeTintId', () => {
  test('maps each palette colour to its swatch', () => {
    expect(activeTintId(CARD_TINTS.mint)).toBe('mint')
    expect(activeTintId(CARD_TINTS.lilac)).toBe('lilac')
  })

  test('maps missing and unknown colours to none', () => {
    expect(activeTintId(undefined)).toBe('none')
    expect(activeTintId(null)).toBe('none')
    expect(activeTintId('#123456')).toBe('none')
  })
})
