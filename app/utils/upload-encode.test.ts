/**
 * Upload import math: type gate, ≤512px downscale (never upscale), integer
 * edges, and filename → label derivation. The DOM-bound encode path is
 * exercised in-browser; these pure parts carry the unit tests.
 */

import { describe, expect, test } from 'vitest'
import { UPLOAD_MAX_EDGE_PX, isUploadableImage, labelFromFileName, scaledSize } from './upload-encode'

describe('isUploadableImage', () => {
  test('accepts the supported picture types', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(isUploadableImage({ type })).toBe(true)
    }
  })

  test('rejects non-image files', () => {
    for (const type of ['application/pdf', 'video/mp4', '']) {
      expect(isUploadableImage({ type })).toBe(false)
    }
  })
})

describe('scaledSize', () => {
  test('large images downscale so the longest edge hits the cap', () => {
    expect(scaledSize(2048, 1536)).toEqual({ width: 512, height: 384 })
    expect(scaledSize(1000, 2000)).toEqual({ width: 256, height: 512 })
  })

  test('small images stay untouched (no upscaling)', () => {
    expect(scaledSize(300, 200)).toEqual({ width: 300, height: 200 })
    expect(scaledSize(512, 512)).toEqual({ width: 512, height: 512 })
  })

  test('edges never drop below one pixel', () => {
    expect(scaledSize(1, 1)).toEqual({ width: 1, height: 1 })
    expect(scaledSize(0.4, 3)).toEqual({ width: 1, height: 3 })
  })

  test('junk dimensions fall back to a 1×1 canvas', () => {
    expect(scaledSize(0, 100)).toEqual({ width: 1, height: 1 })
    expect(scaledSize(Number.NaN, 100)).toEqual({ width: 1, height: 1 })
    expect(scaledSize(Number.POSITIVE_INFINITY, 100)).toEqual({ width: 1, height: 1 })
  })

  test('custom cap applies to the longest edge', () => {
    expect(scaledSize(1000, 500, 100)).toEqual({ width: 100, height: 50 })
  })
})

describe('labelFromFileName', () => {
  test('strips the extension and turns separators into spaces', () => {
    expect(labelFromFileName('my_dog.jpg')).toBe('my dog')
    expect(labelFromFileName('snack-time-photo.webp')).toBe('snack time photo')
  })

  test('trims stray whitespace around the base name', () => {
    expect(labelFromFileName('  bus.png ')).toBe('bus')
  })

  test('extension-less or empty names get a fallback', () => {
    expect(labelFromFileName('photo')).toBe('photo')
    expect(labelFromFileName('.jpg')).toBe('My picture')
    expect(labelFromFileName('')).toBe('My picture')
  })
})

describe('UPLOAD_MAX_EDGE_PX', () => {
  test('the budget cap is 512px (approved decision #9)', () => {
    expect(UPLOAD_MAX_EDGE_PX).toBe(512)
  })
})
