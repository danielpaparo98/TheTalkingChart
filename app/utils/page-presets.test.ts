/**
 * Page-preset math invariants: exact mm dims per approved decision #3,
 * orientation swap, aspect ratio, margin math and the @page declaration
 * (custom properties don't work in @page — this string is the print contract).
 */

import { describe, expect, test } from 'vitest'
import {
  LABEL_SIZE_CQW,
  MARGIN_PRESETS_MM,
  PAGE_PRESETS,
  aspectRatio,
  formatMm,
  marginMm,
  pageDims,
  pageSizeDeclaration,
} from './page-presets'

describe('page presets', () => {
  test('paper presets carry exact mm dimensions (portrait)', () => {
    expect(PAGE_PRESETS.a4).toMatchObject({ label: 'A4', widthMm: 210, heightMm: 297 })
    expect(PAGE_PRESETS.letter).toMatchObject({ label: 'Letter', widthMm: 215.9, heightMm: 279.4 })
    expect(PAGE_PRESETS.a5).toMatchObject({ label: 'A5', widthMm: 148, heightMm: 210 })
    expect(PAGE_PRESETS.a3).toMatchObject({ label: 'A3', widthMm: 297, heightMm: 420 })
  })

  test('portrait keeps the preset dimensions', () => {
    expect(pageDims('a4', 'portrait')).toEqual({ widthMm: 210, heightMm: 297 })
    expect(pageDims('letter', 'portrait')).toEqual({ widthMm: 215.9, heightMm: 279.4 })
    expect(pageDims('a3', 'portrait')).toEqual({ widthMm: 297, heightMm: 420 })
  })

  test('landscape swaps the preset dimensions', () => {
    expect(pageDims('a4', 'landscape')).toEqual({ widthMm: 297, heightMm: 210 })
    expect(pageDims('a5', 'landscape')).toEqual({ widthMm: 210, heightMm: 148 })
    expect(pageDims('letter', 'landscape')).toEqual({ widthMm: 279.4, heightMm: 215.9 })
    expect(pageDims('a3', 'landscape')).toEqual({ widthMm: 420, heightMm: 297 })
  })

  test('aspect ratio reflects orientation', () => {
    expect(aspectRatio('a4', 'portrait')).toBeCloseTo(210 / 297)
    expect(aspectRatio('a4', 'landscape')).toBeCloseTo(297 / 210)
    expect(aspectRatio('a4', 'portrait')).toBeLessThan(1)
    expect(aspectRatio('a4', 'landscape')).toBeGreaterThan(1)
  })

  test('margin presets map to print mm values', () => {
    expect(MARGIN_PRESETS_MM).toEqual({ narrow: 8, normal: 12, wide: 20 })
    expect(marginMm('narrow')).toBe(8)
    expect(marginMm('normal')).toBe(12)
    expect(marginMm('wide')).toBe(20)
  })

  test('mm formatting keeps integers plain and decimals to one place', () => {
    expect(formatMm(210)).toBe('210')
    expect(formatMm(297)).toBe('297')
    expect(formatMm(215.9)).toBe('215.9')
    expect(formatMm(279.4)).toBe('279.4')
    expect(formatMm(12.5)).toBe('12.5')
  })

  test('@page size declaration follows preset and orientation', () => {
    expect(pageSizeDeclaration('a4', 'portrait')).toBe('size: 210mm 297mm')
    expect(pageSizeDeclaration('a4', 'landscape')).toBe('size: 297mm 210mm')
    expect(pageSizeDeclaration('letter', 'portrait')).toBe('size: 215.9mm 279.4mm')
    expect(pageSizeDeclaration('a5', 'landscape')).toBe('size: 210mm 148mm')
    expect(pageSizeDeclaration('a3', 'portrait')).toBe('size: 297mm 420mm')
  })

  test('label size steps mirror the approved mockup (sheet-relative cqw)', () => {
    expect(LABEL_SIZE_CQW).toEqual({ s: 9, m: 11, l: 13.5 })
  })
})
