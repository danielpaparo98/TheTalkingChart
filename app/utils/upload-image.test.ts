/**
 * upload-image unit tests — the pure decision parts only (no DOM):
 * - dimension fit for landscape/portrait/square/tiny/oversized/invalid inputs
 * - mime decision (WebP support on/off)
 * - filename → suggested label (extension strip, separator runs, fallbacks)
 * - data URL byte estimation and the storage budget guard
 */

import { describe, expect, test } from 'vitest'

import {
  MAX_UPLOAD_EDGE_PX,
  UPLOAD_ACCEPTED_TYPES,
  dataUrlBytes,
  exceedsBudget,
  fitWithinBox,
  isUploadableImage,
  pickOutputMime,
  suggestedLabelFromFilename,
} from './upload-image'

describe('fitWithinBox', () => {
  test('downscales landscape photos to the 512px edge', () => {
    expect(fitWithinBox(3000, 2000)).toEqual({ width: 512, height: 341 })
  })

  test('downscales portrait photos to the 512px edge', () => {
    expect(fitWithinBox(2000, 3000)).toEqual({ width: 341, height: 512 })
  })

  test('never upscales small photos', () => {
    expect(fitWithinBox(100, 80)).toEqual({ width: 100, height: 80 })
    expect(fitWithinBox(MAX_UPLOAD_EDGE_PX, MAX_UPLOAD_EDGE_PX)).toEqual({ width: 512, height: 512 })
  })

  test('clamps to at least 1px on each side', () => {
    expect(fitWithinBox(1, 3000)).toEqual({ width: 1, height: 512 })
    expect(fitWithinBox(3000, 1)).toEqual({ width: 512, height: 1 })
  })

  test('rounds both edges to integers', () => {
    expect(fitWithinBox(1000, 333)).toEqual({ width: 512, height: 170 })
  })

  test('collapses invalid dimensions to 0×0', () => {
    expect(fitWithinBox(0, 100)).toEqual({ width: 0, height: 0 })
    expect(fitWithinBox(100, -5)).toEqual({ width: 0, height: 0 })
    expect(fitWithinBox(Number.NaN, Number.NaN)).toEqual({ width: 0, height: 0 })
  })

  test('honours a custom max edge', () => {
    expect(fitWithinBox(1000, 500, 100)).toEqual({ width: 100, height: 50 })
  })

  test('treats a non-positive max edge as unconstrained', () => {
    expect(fitWithinBox(100.4, 80.6, 0)).toEqual({ width: 100, height: 81 })
  })
})

describe('pickOutputMime', () => {
  test('chooses WebP when the browser can encode it', () => {
    expect(pickOutputMime(true)).toBe('image/webp')
  })

  test('falls back to JPEG without WebP support', () => {
    expect(pickOutputMime(false)).toBe('image/jpeg')
  })
})

describe('suggestedLabelFromFilename', () => {
  test('strips the extension and trims whitespace', () => {
    expect(suggestedLabelFromFilename('My Dog.JPG')).toBe('My Dog')
    expect(suggestedLabelFromFilename('  spaced.jpg  ')).toBe('spaced')
    // separator runs become spaces BOTH ways: underscore and hyphen together
    expect(suggestedLabelFromFilename('my_dog.jpg')).toBe('my dog')
    expect(suggestedLabelFromFilename('snack-time-photo.webp')).toBe('snack time photo')
    expect(suggestedLabelFromFilename('  bus.png ')).toBe('bus')
  })

  test('turns separator runs into spaces', () => {
    expect(suggestedLabelFromFilename('birthday_2024-party.png')).toBe('birthday 2024 party')
  })

  test('keeps dotless names untouched', () => {
    expect(suggestedLabelFromFilename('photo')).toBe('photo')
  })

  test('falls back to "photo" for unusable names', () => {
    expect(suggestedLabelFromFilename('.jpg')).toBe('photo')
    expect(suggestedLabelFromFilename('   ')).toBe('photo')
    expect(suggestedLabelFromFilename('')).toBe('photo')
  })

  test('keeps the raw dotfile name when it is all there is', () => {
    expect(suggestedLabelFromFilename('.hidden')).toBe('.hidden')
  })

  test('strips only the last extension', () => {
    expect(suggestedLabelFromFilename('photo.backup.2024.webp')).toBe('photo.backup.2024')
  })
})

describe('dataUrlBytes', () => {
  test('decodes padded base64 payloads exactly', () => {
    // 'A' → 'QQ==' (1 byte), 'ABC' → 'QUJD' (3 bytes), 'AB' → 'QUI=' (2 bytes)
    expect(dataUrlBytes('data:text/plain;base64,QQ==')).toBe(1)
    expect(dataUrlBytes('data:text/plain;base64,QUJD')).toBe(3)
    expect(dataUrlBytes('data:text/plain;base64,QUI=')).toBe(2)
  })

  test('counts un-padded base64 by the 3/4 ratio', () => {
    expect(dataUrlBytes('data:text/plain;base64,QQ')).toBe(1)
  })

  test('approximates non-base64 payloads by character count', () => {
    expect(dataUrlBytes('data:,hello')).toBe(5)
  })

  test('returns 0 without a comma separator', () => {
    expect(dataUrlBytes('not-a-data-url')).toBe(0)
    expect(dataUrlBytes('')).toBe(0)
  })
})

describe('exceedsBudget', () => {
  const TINY = 'data:image/webp;base64,QUJD'

  test('accepts payloads under the default budget', () => {
    expect(exceedsBudget(TINY)).toBe(false)
  })

  test('rejects payloads over a custom limit', () => {
    expect(exceedsBudget(TINY, 2)).toBe(true)
    expect(exceedsBudget(TINY, 3)).toBe(false)
  })
})

describe('isUploadableImage (one shared type gate for both panels)', () => {
  test('accepts the supported picture types', () => {
    for (const type of UPLOAD_ACCEPTED_TYPES) {
      expect(isUploadableImage({ type })).toBe(true)
    }
  })

  test('rejects non-image files', () => {
    for (const type of [
      'application/pdf',
      'video/mp4',
      'text/plain',
      'image/tiff', // decodable by some cameras, but outside the shared allow-list
      '',
    ]) {
      expect(isUploadableImage({ type })).toBe(false)
    }
  })
})

describe('MAX_UPLOAD_EDGE_PX', () => {
  test('the budget cap is 512px (approved decision #9)', () => {
    expect(MAX_UPLOAD_EDGE_PX).toBe(512)
  })
})
