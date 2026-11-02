/**
 * useLibraryDrag unit tests — the drag payload contract between
 * LibraryPanel tiles and GridCell drop targets (encode/parse round-trip,
 * rejection of malformed payloads, MIME presence check, drag staging).
 * DataTransfer objects are structural stubs — no DOM environment needed.
 */

import { describe, expect, test, vi } from 'vitest'

import {
  LIBRARY_DRAG_MIME,
  beginLibraryDrag,
  encodeLibraryDragPayload,
  hasLibraryDragData,
  parseLibraryDragPayload,
  readLibraryDragData,
} from './useLibraryDrag'
import type { LibraryDragPayload } from './useLibraryDrag'

const PAYLOAD: LibraryDragPayload = {
  icon: { source: 'bundle', set: 'openmoji', name: 'dog-face' },
  label: 'dog face',
}

describe('encode/parse round-trip', () => {
  test('a payload survives encode → parse unchanged', () => {
    expect(parseLibraryDragPayload(encodeLibraryDragPayload(PAYLOAD))).toEqual(PAYLOAD)
  })

  test('an ARASAAC payload survives unchanged', () => {
    const arasaac: LibraryDragPayload = {
      icon: { source: 'arasaac', set: 'arasaac', name: '12345' },
      label: 'water',
    }
    expect(parseLibraryDragPayload(encodeLibraryDragPayload(arasaac))).toEqual(arasaac)
  })
})

describe('parseLibraryDragPayload rejects junk', () => {
  test('rejects non-JSON text and non-object JSON', () => {
    expect(parseLibraryDragPayload('not json')).toBeNull()
    expect(parseLibraryDragPayload('"just a string"')).toBeNull()
    expect(parseLibraryDragPayload(null)).toBeNull()
    expect(parseLibraryDragPayload(undefined)).toBeNull()
    expect(parseLibraryDragPayload(42)).toBeNull()
  })

  test('rejects missing or invalid icon refs', () => {
    expect(parseLibraryDragPayload({ label: 'dog' })).toBeNull()
    expect(parseLibraryDragPayload({ icon: 'dog-face', label: 'dog' })).toBeNull()
    expect(parseLibraryDragPayload({ icon: { source: 'other', set: 'x', name: 'y' }, label: 'dog' })).toBeNull()
    expect(parseLibraryDragPayload({ icon: { source: 'bundle', set: '', name: 'y' }, label: 'dog' })).toBeNull()
    expect(parseLibraryDragPayload({ icon: { source: 'bundle', set: 'openmoji', name: '' }, label: 'dog' })).toBeNull()
  })

  test('rejects missing or empty labels', () => {
    expect(parseLibraryDragPayload({ icon: PAYLOAD.icon })).toBeNull()
    expect(parseLibraryDragPayload({ icon: PAYLOAD.icon, label: '' })).toBeNull()
  })
})

describe('hasLibraryDragData', () => {
  const transferWith = (types: string[]) =>
    ({ types }) as unknown as DataTransfer

  test('true when the library MIME is present (dragover protected mode)', () => {
    expect(hasLibraryDragData(transferWith(['text/plain', LIBRARY_DRAG_MIME]))).toBe(true)
  })

  test('false for cell-swap drags and plain text', () => {
    expect(hasLibraryDragData(transferWith(['text/plain']))).toBe(false)
  })

  test('false without a DataTransfer', () => {
    expect(hasLibraryDragData(null)).toBe(false)
  })
})

describe('beginLibraryDrag stages the transfer', () => {
  test('sets both MIME payloads and effectAllowed copy', () => {
    const transfer = {
      effectAllowed: '',
      setData: vi.fn(),
    }
    beginLibraryDrag({ dataTransfer: transfer } as unknown as DragEvent, PAYLOAD)

    expect(transfer.effectAllowed).toBe('copy')
    expect(transfer.setData).toHaveBeenCalledWith(LIBRARY_DRAG_MIME, encodeLibraryDragPayload(PAYLOAD))
    expect(transfer.setData).toHaveBeenCalledWith('text/plain', PAYLOAD.label)
  })

  test('no-ops without a DataTransfer', () => {
    expect(() => beginLibraryDrag({ dataTransfer: null } as unknown as DragEvent, PAYLOAD)).not.toThrow()
  })
})

describe('readLibraryDragData', () => {
  test('parses the staged payload on drop', () => {
    const transfer = { getData: (type: string) => (type === LIBRARY_DRAG_MIME ? encodeLibraryDragPayload(PAYLOAD) : '') }
    expect(readLibraryDragData(transfer as unknown as DataTransfer)).toEqual(PAYLOAD)
  })

  test('null for foreign drags and missing transfers', () => {
    const transfer = { getData: () => 'cell-swap-stuff' }
    expect(readLibraryDragData(transfer as unknown as DataTransfer)).toBeNull()
    expect(readLibraryDragData(null)).toBeNull()
  })
})
