/**
 * Grid geometry math invariants: rows×cols → CSS template strings, doc gap
 * mm → sheet-relative cqw (the print contract), the S/M/L label scale
 * preparing the mockup's exact 9/11/13.5 cqw steps, and the row-major
 * position↔index mapping behind cells[] bookkeeping (keyboard nav, pulse).
 */

import { describe, expect, test } from 'vitest'

import {
  SLOT_LABEL_BASE_CQW,
  cellIndex,
  cellPosition,
  gridGapCss,
  gridTemplateCss,
  mmAsCqw,
  slotLabelScale,
} from './grid-geometry'

describe('grid template', () => {
  test('renders repeat(count, 1fr) tracks for rows and columns', () => {
    expect(gridTemplateCss(3, 4)).toEqual({
      gridTemplateColumns: 'repeat(4, 1fr)',
      gridTemplateRows: 'repeat(3, 1fr)',
    })
  })

  test('matches every approved template shape from app/utils/templates.ts', () => {
    expect(gridTemplateCss(1, 2).gridTemplateRows).toBe('repeat(1, 1fr)') // first-then
    expect(gridTemplateCss(2, 3).gridTemplateColumns).toBe('repeat(3, 1fr)') // choice board
    expect(gridTemplateCss(1, 4).gridTemplateColumns).toBe('repeat(4, 1fr)') // schedule
    expect(gridTemplateCss(3, 3)).toEqual({
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'repeat(3, 1fr)',
    }) // vocab
  })

  test('covers the full approved stepper range (rows 1–8, cols 1–10)', () => {
    expect(gridTemplateCss(8, 10)).toEqual({
      gridTemplateColumns: 'repeat(10, 1fr)',
      gridTemplateRows: 'repeat(8, 1fr)',
    })
    expect(gridTemplateCss(1, 1)).toEqual({
      gridTemplateColumns: 'repeat(1, 1fr)',
      gridTemplateRows: 'repeat(1, 1fr)',
    })
  })
})

describe('gap → cqw (print contract)', () => {
  test('an mm length of X renders as X / pageWidthMm × 100cqw', () => {
    expect(mmAsCqw(8, 210)).toBeCloseTo(8 / 210 * 100, 10)
    expect(mmAsCqw(0, 210)).toBe(0)
  })

  test('the same physical gap yields more cqw on smaller sheets', () => {
    // 1cqw is 2.1mm on A4 and 1.48mm on A5 — the mm must stay 8 either way.
    expect(mmAsCqw(8, 210)).toBeCloseTo(3.8095, 4)
    expect(mmAsCqw(8, 148)).toBeCloseTo(5.4054, 4)
    expect(mmAsCqw(8, 210)).toBeLessThan(mmAsCqw(8, 148))
  })

  test('round-trips against every preset and orientation', () => {
    const widths = [210, 215.9, 148, 297, 279.4, 420]
    for (const widthMm of widths) {
      for (const gapMm of [0, 8, 12, 24]) {
        const cqw = mmAsCqw(gapMm, widthMm)
        expect(cqw * widthMm / 100).toBeCloseTo(gapMm, 10)
      }
    }
  })

  test('gap track sizing reads the sheet width from PrintPage\'s --page-w-mm', () => {
    // Same unit math as PrintPage's own padding (the established contract
    // pattern); the fallback 210mm covers a missing ancestor.
    expect(gridGapCss(8)).toBe('calc(8 / var(--page-w-mm, 210) * 100cqw)')
  })

  test('zero gap collapses to an empty calc (hairline joins, mockup parity)', () => {
    expect(gridGapCss(0)).toBe('calc(0 / var(--page-w-mm, 210) * 100cqw)')
  })
})

describe('slot label scale', () => {
  test('base is the mockup\'s medium label size (11cqw)', () => {
    expect(SLOT_LABEL_BASE_CQW).toBe(11)
  })

  test('medium is the identity step', () => {
    expect(slotLabelScale('m')).toBe(1)
  })

  test('small and large reproduce the approved 9 / 13.5 cqw steps exactly', () => {
    // The scale var lands on the grid root (v1 pattern); multiplied by the
    // base it must equal the approved LABEL_SIZE_CQW table without drift.
    expect(slotLabelScale('s') * SLOT_LABEL_BASE_CQW).toBeCloseTo(9, 10)
    expect(slotLabelScale('l') * SLOT_LABEL_BASE_CQW).toBeCloseTo(13.5, 10)
    expect(slotLabelScale('s')).toBeCloseTo(9 / 11, 10)
    expect(slotLabelScale('l')).toBeCloseTo(13.5 / 11, 10)
  })
})

describe('row-major cell mapping', () => {
  test('(row, col) resolves to r·cols + c', () => {
    expect(cellIndex(0, 0, 4)).toBe(0)
    expect(cellIndex(0, 3, 4)).toBe(3)
    expect(cellIndex(1, 0, 4)).toBe(4)
    expect(cellIndex(2, 3, 4)).toBe(11)
    expect(cellIndex(4, 0, 1)).toBe(4) // single column counts rows
  })

  test('position is the exact inverse of index', () => {
    expect(cellPosition(0, 4)).toEqual({ row: 0, col: 0 })
    expect(cellPosition(5, 4)).toEqual({ row: 1, col: 1 })
    expect(cellPosition(11, 4)).toEqual({ row: 2, col: 3 })
  })

  test('every grid position round-trips across the approved ranges', () => {
    for (let cols = 1; cols <= 10; cols += 1) {
      for (let row = 0; row <= 7; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          expect(cellPosition(cellIndex(row, col, cols), cols)).toEqual({ row, col })
        }
      }
    }
  })
})
