/**
 * Doc-reducer invariants: every helper is pure and immutable (returns a NEW
 * doc; the input is never touched) and returns the SAME reference on no-op —
 * the store relies on that identity to skip empty undo steps. Boundary
 * repair (`toChartDoc`) is strict on the CORE structure and repair-on-values
 * elsewhere: trim-first against DoS payloads, duplicate-id minting, label /
 * upload caps, and clamp migrations for every out-of-range field.
 */

import { describe, expect, test } from 'vitest'
import type { CellData, ChartDoc, PageSetup } from '../types/chart'
import {
  GRID_LIMITS,
  MAX_LABEL_CHARS,
  applyTemplate,
  clearCell,
  cloneDoc,
  duplicateCell,
  isCellEmpty,
  nextEmptyCellIndex,
  setCell,
  setGap,
  setGrid,
  setLabel,
  setLabelSize,
  setPageSetup,
  setTint,
  swapCells,
  setTitle,
  toggleTextOnly,
  toChartDoc,
} from './doc-reducers'

const A4: PageSetup = { preset: 'a4', orientation: 'portrait', marginPreset: 'normal' }

function mkCell(id: string, label = '', extra: Partial<CellData> = {}): CellData {
  return { id, icon: null, label, ...extra }
}

/** 2×3 fixture doc — six cells, tight assertions. */
function mkDoc(cells: CellData[], overrides: Partial<ChartDoc> = {}): ChartDoc {
  return {
    title: 'Test chart',
    pageSetup: A4,
    grid: { rows: 2, cols: 3, gap: 8, labelSize: 'm' },
    cells,
    usesArasaac: false,
    updatedAt: 1,
    ...overrides,
  }
}

const DOG = { source: 'bundle', set: 'openmoji', name: 'dog' } as const
const ARASAAC_CAT = { source: 'arasaac', set: 'arasaac', name: '1234' } as const

describe('cloneDoc', () => {
  test('produces a deep, independent copy', () => {
    const doc = mkDoc([mkCell('a', 'one', { icon: { ...DOG } }), mkCell('b', 'two')])
    const copy = cloneDoc(doc)

    expect(copy).not.toBe(doc)
    expect(copy.cells).not.toBe(doc.cells)
    expect(copy.cells[0]).not.toBe(doc.cells[0])
    expect(copy.cells[0]?.icon).not.toBe(doc.cells[0]?.icon)
    expect(copy).toEqual(doc)

    copy.cells[0]!.label = 'mutated'
    expect(doc.cells[0]?.label).toBe('one')
  })
})

describe('isCellEmpty', () => {
  test('a fresh cell is empty', () => {
    expect(isCellEmpty(mkCell('a'))).toBe(true)
  })

  test('any content — icon, label or upload — makes it non-empty', () => {
    expect(isCellEmpty(mkCell('a', '', { icon: { ...DOG } }))).toBe(false)
    expect(isCellEmpty(mkCell('a', 'dog'))).toBe(false)
    expect(isCellEmpty(mkCell('a', '', { imageDataUrl: 'data:image/webp;base64,xx' }))).toBe(false)
  })
})

describe('setTitle', () => {
  test('sets a new title immutably', () => {
    const doc = mkDoc([mkCell('a')])
    const next = setTitle(doc, 'Renamed')

    expect(next.title).toBe('Renamed')
    expect(next).not.toBe(doc)
    expect(doc.title).toBe('Test chart')
  })

  test('same title is a no-op (same reference)', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setTitle(doc, doc.title)).toBe(doc)
  })
})

describe('setCell', () => {
  test('replaces the whole cell at the index, cloning the payload', () => {
    const doc = mkDoc([mkCell('a', 'old'), mkCell('b')])
    const payload = mkCell('a', 'new', { icon: { ...DOG } })
    const next = setCell(doc, 0, payload)

    expect(next.cells[0]?.label).toBe('new')
    expect(next.cells[0]?.icon).toEqual(DOG)
    expect(next.cells[0]).not.toBe(payload)
    expect(doc.cells[0]?.label).toBe('old')

    payload.label = 'caller-mutation'
    expect(next.cells[0]?.label).toBe('new')
  })

  test('out-of-range index is a no-op', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setCell(doc, 5, mkCell('x'))).toBe(doc)
    expect(setCell(doc, -1, mkCell('x'))).toBe(doc)
  })
})

describe('setLabel', () => {
  test('sets the label immutably with structural sharing', () => {
    const doc = mkDoc([mkCell('a', ''), mkCell('b', 'keep')])
    const next = setLabel(doc, 0, 'dog')

    expect(next.cells[0]?.label).toBe('dog')
    expect(next).not.toBe(doc)
    expect(next.cells).not.toBe(doc.cells)
    expect(next.cells[1]).toBe(doc.cells[1])
    expect(doc.cells[0]?.label).toBe('')
  })

  test('same label and out-of-range index are no-ops', () => {
    const doc = mkDoc([mkCell('a', 'dog')])
    expect(setLabel(doc, 0, 'dog')).toBe(doc)
    expect(setLabel(doc, 9, 'x')).toBe(doc)
  })

  test('labels cap at MAX_LABEL_CHARS at the reducer (N-3: covers drags, keys, pastes)', () => {
    const doc = mkDoc([mkCell('a', '')])
    const next = setLabel(doc, 0, 'x'.repeat(MAX_LABEL_CHARS + 50))
    expect(next.cells[0]?.label).toHaveLength(MAX_LABEL_CHARS)
  })
})

describe('setTint', () => {
  test('sets a tint', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setTint(doc, 0, '#a7ff9c').cells[0]?.color).toBe('#a7ff9c')
  })

  test('clearing a tint drops the key entirely', () => {
    const doc = mkDoc([mkCell('a', '', { color: '#a7ff9c' })])
    const next = setTint(doc, 0, null)
    expect('color' in next.cells[0]!).toBe(false)
  })

  test('out-of-range index is a no-op', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setTint(doc, 3, '#a7ff9c')).toBe(doc)
  })
})

describe('toggleTextOnly', () => {
  test('flips text-only on, then off (key dropped when off)', () => {
    const doc = mkDoc([mkCell('a', 'dog')])
    const on = toggleTextOnly(doc, 0)
    expect(on.cells[0]?.textOnly).toBe(true)

    const off = toggleTextOnly(on, 0)
    expect('textOnly' in off.cells[0]!).toBe(false)
  })

  test('explicit mode sets an exact value', () => {
    const doc = mkDoc([mkCell('a', 'dog')])
    expect(toggleTextOnly(doc, 0, true).cells[0]?.textOnly).toBe(true)
    expect('textOnly' in toggleTextOnly(doc, 0, false).cells[0]!).toBe(false)
  })

  test('out-of-range index is a no-op', () => {
    const doc = mkDoc([mkCell('a')])
    expect(toggleTextOnly(doc, 7, true)).toBe(doc)
  })
})

describe('clearCell', () => {
  test('resets all content but keeps the cell id and position', () => {
    const doc = mkDoc([
      mkCell('a', 'dog', { icon: { ...DOG }, color: '#fff3d6', textOnly: false, imageDataUrl: 'data:image/webp;base64,xx' }),
      mkCell('b', 'keep'),
    ])
    const next = clearCell(doc, 0)

    expect(next.cells[0]?.id).toBe('a')
    expect(next.cells[0]?.icon).toBeNull()
    expect(next.cells[0]?.label).toBe('')
    expect('color' in next.cells[0]!).toBe(false)
    expect('textOnly' in next.cells[0]!).toBe(false)
    expect('imageDataUrl' in next.cells[0]!).toBe(false)
    expect(next.cells[1]?.label).toBe('keep')
    expect(doc.cells[0]?.label).toBe('dog')
  })

  test('out-of-range index is a no-op', () => {
    const doc = mkDoc([mkCell('a')])
    expect(clearCell(doc, 6)).toBe(doc)
  })
})

describe('duplicateCell', () => {
  test('copies full content into the next empty cell with a fresh id', () => {
    const doc = mkDoc([
      mkCell('a', 'dog', { icon: { ...DOG }, color: '#fff3d6', imageDataUrl: undefined }),
      mkCell('b', 'occupied'),
      mkCell('c'),
    ])
    const next = duplicateCell(doc, 0)
    const copy = next.cells[2]

    expect(copy?.label).toBe('dog')
    expect(copy?.icon).toEqual(DOG)
    expect(copy?.color).toBe('#fff3d6')
    expect(copy?.id).not.toBe('a')
    expect(next.cells[0]?.id).toBe('a')
    expect(next.cells[1]?.label).toBe('occupied')
  })

  test('copies uploads and text-only flags too', () => {
    const doc = mkDoc([mkCell('a', 'photo', { textOnly: true, imageDataUrl: 'data:image/jpeg;base64,yy' }), mkCell('b'), mkCell('c'), mkCell('d')])
    const copy = duplicateCell(doc, 0).cells[1]
    expect(copy?.textOnly).toBe(true)
    expect(copy?.imageDataUrl).toBe('data:image/jpeg;base64,yy')
  })

  test('wraps around when all later cells are occupied', () => {
    const doc = mkDoc([mkCell('a'), mkCell('b', 'first'), mkCell('c', 'full')])
    const next = duplicateCell(doc, 2)
    expect(next.cells[0]?.label).toBe('full')
    expect(next.cells[0]?.id).not.toBe('c')
  })

  test('no empty cell and out-of-range index are no-ops', () => {
    const full = mkDoc([mkCell('a', 'x'), mkCell('b', 'y')])
    expect(duplicateCell(full, 0)).toBe(full)
    const doc = mkDoc([mkCell('a'), mkCell('b')])
    expect(duplicateCell(doc, 9)).toBe(doc)
  })
})

describe('swapCells', () => {
  test('swaps whole cells — ids travel with the content', () => {
    const doc = mkDoc([
      mkCell('a', 'dog', { icon: { ...DOG } }),
      mkCell('b'),
      mkCell('c'),
      mkCell('d'),
      mkCell('e', 'cat', { color: '#e4f2fd' }),
    ])
    const next = swapCells(doc, 0, 4)

    expect(next.cells[0]?.id).toBe('e')
    expect(next.cells[0]?.label).toBe('cat')
    expect(next.cells[4]?.id).toBe('a')
    expect(next.cells[4]?.icon).toEqual(DOG)
    expect(next.cells[1]?.label).toBe('')
    expect(doc.cells[0]?.label).toBe('dog')
  })

  test('same index and out-of-range indices are no-ops', () => {
    const doc = mkDoc([mkCell('a'), mkCell('b')])
    expect(swapCells(doc, 1, 1)).toBe(doc)
    expect(swapCells(doc, 0, 5)).toBe(doc)
    expect(swapCells(doc, -1, 1)).toBe(doc)
  })
})

describe('setGrid', () => {
  test('grows: pads with fresh empty cells, keeping content positionally', () => {
    const doc = mkDoc([mkCell('a', 'dog'), mkCell('b', 'cat')])
    const next = setGrid(doc, 3, 3)

    expect(next.grid).toEqual({ rows: 3, cols: 3, gap: 8, labelSize: 'm' })
    expect(next.cells).toHaveLength(9)
    expect(next.cells[0]?.label).toBe('dog')
    expect(next.cells[1]?.label).toBe('cat')
    expect(next.cells[2]?.label).toBe('')
    expect(doc.cells).toHaveLength(2)
  })

  test('shrinks: truncates overflow positionally', () => {
    const doc = mkDoc([mkCell('a', 'one'), mkCell('b', 'two'), mkCell('c', 'three'), mkCell('d', 'four')])
    const next = setGrid(doc, 1, 2)

    expect(next.cells).toHaveLength(2)
    expect(next.cells[0]?.label).toBe('one')
    expect(next.cells[1]?.label).toBe('two')
  })

  test('clamps to the approved stepper ranges (rows 1–8, cols 1–10)', () => {
    const doc = mkDoc([mkCell('a')])
    const grown = setGrid(doc, 99, 0)
    expect(grown.grid.rows).toBe(GRID_LIMITS.maxRows)
    expect(grown.grid.cols).toBe(GRID_LIMITS.minCols)

    const shrunk = setGrid(doc, 0, 99)
    expect(shrunk.grid.rows).toBe(GRID_LIMITS.minRows)
    expect(shrunk.grid.cols).toBe(GRID_LIMITS.maxCols)
  })

  test('non-integer input is clamped to valid integers', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setGrid(doc, 2.5, 3.7).grid).toMatchObject({ rows: 2, cols: 3 })
  })
})

describe('setGap', () => {
  test('sets gap within the approved 0–24mm range and clamps outside it', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setGap(doc, 12).grid.gap).toBe(12)
    expect(setGap(doc, 30).grid.gap).toBe(GRID_LIMITS.maxGapMm)
    expect(setGap(doc, -2).grid.gap).toBe(GRID_LIMITS.minGapMm)
  })

  test('same value and non-finite values are no-ops', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setGap(doc, 8)).toBe(doc)
    expect(setGap(doc, Number.NaN)).toBe(doc)
    expect(setGap(doc, Number.POSITIVE_INFINITY)).toBe(doc)
  })
})

describe('setLabelSize', () => {
  test('sets a valid label size step', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setLabelSize(doc, 'l').grid.labelSize).toBe('l')
  })

  test('invalid values are no-ops', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setLabelSize(doc, 'huge' as never)).toBe(doc)
  })
})

describe('setPageSetup', () => {
  test('merges partial patches onto the current setup', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setPageSetup(doc, { orientation: 'landscape' }).pageSetup).toEqual({
      preset: 'a4',
      orientation: 'landscape',
      marginPreset: 'normal',
    })
    expect(setPageSetup(doc, { preset: 'a3', marginPreset: 'wide' }).pageSetup).toEqual({
      preset: 'a3',
      orientation: 'portrait',
      marginPreset: 'wide',
    })
  })

  test('invalid patch values are ignored, valid ones still apply', () => {
    const doc = mkDoc([mkCell('a')])
    const next = setPageSetup(doc, { preset: 'a9' as never, orientation: 'diagonal' as never, marginPreset: 'wide' })
    expect(next.pageSetup).toEqual({ preset: 'a4', orientation: 'portrait', marginPreset: 'wide' })
  })

  test('fully-invalid patch is a no-op', () => {
    const doc = mkDoc([mkCell('a')])
    expect(setPageSetup(doc, { preset: 'nope' as never })).toBe(doc)
  })
})

describe('applyTemplate', () => {
  test('replaces the doc with an independent clone of the template', () => {
    const doc = mkDoc([mkCell('a', 'old')])
    const template = mkDoc([mkCell('t1', 'work'), mkCell('t2', 'play')], { title: 'First–Then' })
    const next = applyTemplate(doc, template)

    expect(next.title).toBe('First–Then')
    expect(next.cells[0]?.label).toBe('work')
    expect(next).not.toBe(template)
    expect(next.cells[0]).not.toBe(template.cells[0])

    template.cells[0]!.label = 'mutated'
    expect(next.cells[0]?.label).toBe('work')
  })
})

describe('nextEmptyCellIndex', () => {
  const doc = mkDoc([
    mkCell('a', 'full'),
    mkCell('b'),
    mkCell('c', 'full'),
    mkCell('d'),
    mkCell('e', 'full'),
    mkCell('f', 'full'),
  ])

  test('finds the first empty cell from the start', () => {
    expect(nextEmptyCellIndex(doc)).toBe(1)
  })

  test('scans forward from the given index', () => {
    expect(nextEmptyCellIndex(doc, 1)).toBe(3)
    expect(nextEmptyCellIndex(doc, 2)).toBe(3)
  })

  test('wraps around circularly', () => {
    expect(nextEmptyCellIndex(doc, 3)).toBe(1)
  })

  test('returns null when every cell has content', () => {
    const full = mkDoc([mkCell('a', 'x'), mkCell('b', 'y')])
    expect(nextEmptyCellIndex(full)).toBeNull()
    expect(nextEmptyCellIndex(full, 0)).toBeNull()
  })

  test('a label-only or upload-only cell is not empty', () => {
    const labeled = mkDoc([mkCell('a', 'word')])
    expect(nextEmptyCellIndex(labeled)).toBeNull()
    const uploaded = mkDoc([mkCell('a', '', { imageDataUrl: 'data:image/webp;base64,xx' })])
    expect(nextEmptyCellIndex(uploaded)).toBeNull()
  })
})

// --- Boundary repair: localStorage payloads are untrusted -------------------
// Strict on the CORE (title, updatedAt, container shapes); repair-on-values
// everywhere else, so stored damage never destroys a chart.

describe('toChartDoc', () => {
  const valid = (): ChartDoc => ({
    version: 2,
    title: 'Saved chart',
    pageSetup: { preset: 'letter', orientation: 'landscape', marginPreset: 'narrow' },
    grid: { rows: 2, cols: 2, gap: 10, labelSize: 'l' },
    cells: [mkCell('a', 'dog', { icon: { ...ARASAAC_CAT } }), mkCell('b'), mkCell('c'), mkCell('d')],
    usesArasaac: true,
    updatedAt: 1234,
  })

  test('accepts a valid payload and restores every field', () => {
    const doc = toChartDoc(structuredClone(valid()))
    expect(doc).toEqual(valid())
  })

  /** Deep patch into an `unknown` shape for malformed-payload tests. */
  const broken = (patch: (doc: Record<string, unknown>) => void): unknown => {
    const doc = valid() as unknown as Record<string, unknown>
    patch(doc)
    return doc
  }

  test('rejects non-object payloads', () => {
    expect(toChartDoc(null)).toBeNull()
    expect(toChartDoc(undefined)).toBeNull()
    expect(toChartDoc(42)).toBeNull()
    expect(toChartDoc('chart')).toBeNull()
    expect(toChartDoc([])).toBeNull()
  })

  test('rejects a structurally broken CORE: title, updatedAt, container shapes, cells', () => {
    expect(toChartDoc(broken((d) => { d.title = 7 }))).toBeNull()
    expect(toChartDoc(broken((d) => { delete d.updatedAt }))).toBeNull()
    expect(toChartDoc(broken((d) => { d.updatedAt = Number.NaN }))).toBeNull()
    expect(toChartDoc(broken((d) => { d.updatedAt = Number.POSITIVE_INFINITY }))).toBeNull()
    expect(toChartDoc(broken((d) => { d.pageSetup = 'flat' }))).toBeNull()
    expect(toChartDoc(broken((d) => { d.grid = 42 }))).toBeNull()
    expect(toChartDoc(broken((d) => { d.cells = 'nope' }))).toBeNull()
  })

  test('clamp migrations: out-of-range setup values fall back, never reject (C-4)', () => {
    expect(toChartDoc(broken((d) => { (d.pageSetup as Record<string, unknown>).preset = 'a9' }))?.pageSetup)
      .toEqual({ preset: 'a4', orientation: 'landscape', marginPreset: 'narrow' })
    expect(toChartDoc(broken((d) => { (d.pageSetup as Record<string, unknown>).orientation = 'sideways' }))?.pageSetup.orientation)
      .toBe('portrait')
    expect(toChartDoc(broken((d) => { (d.pageSetup as Record<string, unknown>).marginPreset = 'huge' }))?.pageSetup.marginPreset)
      .toBe('normal')
    expect(toChartDoc(broken((d) => { (d.grid as Record<string, unknown>).labelSize = 'xl' }))?.grid.labelSize)
      .toBe('m')
  })

  test('clamp migrations: rows/cols/gap clamp into GRID_LIMITS (junk → min)', () => {
    expect(toChartDoc(broken((d) => { (d.grid as Record<string, unknown>).rows = 9 }))?.grid.rows)
      .toBe(GRID_LIMITS.maxRows)
    expect(toChartDoc(broken((d) => { (d.grid as Record<string, unknown>).rows = 0 }))?.grid.rows)
      .toBe(GRID_LIMITS.minRows)
    expect(toChartDoc(broken((d) => { (d.grid as Record<string, unknown>).cols = 11 }))?.grid.cols)
      .toBe(GRID_LIMITS.maxCols)
    expect(toChartDoc(broken((d) => { (d.grid as Record<string, unknown>).cols = 1.5 }))?.grid.cols)
      .toBe(1) // truncates
    expect(toChartDoc(broken((d) => { (d.grid as Record<string, unknown>).gap = 25 }))?.grid.gap)
      .toBe(GRID_LIMITS.maxGapMm)
    expect(toChartDoc(broken((d) => { (d.grid as Record<string, unknown>).gap = -1 }))?.grid.gap)
      .toBe(GRID_LIMITS.minGapMm)
    const junky = broken((d) => { (d.grid as Record<string, unknown>).rows = 'lots' })
    const repaired = toChartDoc(junky)
    expect(repaired?.grid.rows).toBe(GRID_LIMITS.minRows)
    expect(repaired?.cells).toHaveLength(GRID_LIMITS.minRows * 2) // count follows the clamped grid
  })

  test('trim-first: a huge stored cells array costs O(rows×cols), no DoS (C-1)', () => {
    // One million junk entries — the reader must slice BEFORE any per-entry
    // work: only the first rows×cols entries are ever converted.
    const huge = broken((d) => {
      const entries: unknown[] = []
      for (let i = 0; i < 1_000_000; i += 1) entries.push({ id: `c${i}`, label: 'x' })
      d.cells = entries
    })
    const doc = toChartDoc(huge)
    expect(doc?.cells).toHaveLength(4)
    expect(doc?.cells.map((cell) => cell.id)).toEqual(['c0', 'c1', 'c2', 'c3'])
    expect(doc?.cells[3]?.label).toBe('x')
  })

  test('duplicate-id repair: collisions keep the position and mint a fresh id (C-2)', () => {
    const payload = broken((d) => {
      d.cells = [mkCell('dup', 'first'), mkCell('dup', 'second'), mkCell('c'), mkCell('d')]
    })
    const doc = toChartDoc(payload)
    expect(doc?.cells[0]?.id).toBe('dup')
    expect(doc?.cells[1]?.id).not.toBe('dup')
    expect(doc?.cells[1]?.label).toBe('second')
    expect(new Set(doc?.cells.map((cell) => cell.id)).size).toBe(4)
  })

  test('label cap: oversized stored labels slice to MAX_LABEL_CHARS (C-3)', () => {
    const long = 'a'.repeat(MAX_LABEL_CHARS + 40)
    const doc = toChartDoc(broken((d) => { d.cells = [mkCell('a', long), mkCell('b'), mkCell('c'), mkCell('d')] }))
    expect(doc?.cells[0]?.label).toHaveLength(MAX_LABEL_CHARS)
  })

  test('upload cap: a data URL over the storage budget is dropped, not rejected (C-3)', () => {
    // 300_000 base64 chars ≈ 225 KB — over the 200 KB ceiling.
    const oversized = `data:image/webp;base64,${'A'.repeat(300_000)}`
    const doc = toChartDoc(
      broken((d) => {
        d.cells = [mkCell('a', '', { imageDataUrl: oversized }), mkCell('b'), mkCell('c'), mkCell('d')]
      }),
    )
    expect(doc?.cells[0]?.imageDataUrl).toBeUndefined()
    // A small upload passes untouched.
    const keeper = toChartDoc(broken((d) => { d.cells = [mkCell('a', '', { imageDataUrl: 'data:image/webp;base64,xx' }), mkCell('b'), mkCell('c'), mkCell('d')] }))
    expect(keeper?.cells[0]?.imageDataUrl).toBe('data:image/webp;base64,xx')
  })

  test('version tolerance: missing/unknown/lying versions read fine (C-5)', () => {
    // Missing version = same-version lenient read.
    const missing = broken((d) => { delete d.version })
    const readMissing = toChartDoc(missing)
    expect(readMissing).not.toBeNull()
    expect(readMissing?.version).toBe(2) // the reader upgrades its output
    // A lying/foreign value never rejects on version alone.
    const lying = broken((d) => { d.version = 99 })
    expect(toChartDoc(lying)?.version).toBe(2)
    const nonsense = broken((d) => { d.version = 'x' })
    expect(toChartDoc(nonsense)?.version).toBe(2)
  })

  test('every returned doc carries version: 2 — the persisted shape always stamps it (C-5)', () => {
    expect(toChartDoc(structuredClone(valid()))?.version).toBe(2)
    expect(toChartDoc(broken((d) => { delete d.version }))?.version).toBe(2)
  })

  test('accepts the blank-template shape (empty title)', () => {
    const payload = valid()
    payload.title = ''
    expect(toChartDoc(payload)?.title).toBe('')
  })

  test('recomputes usesArasaac from the cells, never trusting the stored flag', () => {
    const bundleOnly = valid()
    bundleOnly.cells[0]!.icon = { ...DOG }
    expect(toChartDoc(bundleOnly)?.usesArasaac).toBe(false)

    const lyingFalse = valid()
    lyingFalse.usesArasaac = false
    expect(toChartDoc(lyingFalse)?.usesArasaac).toBe(true)
  })

  test('repairs a cells/grid count mismatch positionally (truncate + pad)', () => {
    const payload = valid()
    payload.cells = [mkCell('a', 'dog'), mkCell('b', 'cat')]
    const doc = toChartDoc(payload)
    expect(doc?.cells).toHaveLength(4)
    expect(doc?.cells[0]?.label).toBe('dog')
    expect(doc?.cells[1]?.label).toBe('cat')
    expect(doc?.cells[2]?.label).toBe('')
    expect(doc?.cells[3]?.label).toBe('')

    const overflowing = valid()
    overflowing.cells = [mkCell('a', 'one'), mkCell('b', 'two'), mkCell('c', 'three'), mkCell('d', 'four'), mkCell('e', 'five')]
    expect(toChartDoc(overflowing)?.cells).toHaveLength(4)
    expect(toChartDoc(overflowing)?.cells[3]?.label).toBe('four')
  })

  test('replaces malformed cell entries with empties, keeping their positions', () => {
    const payload = valid()
    payload.cells = [mkCell('a', 'dog'), 42 as unknown as CellData, null as unknown as CellData, mkCell('d', 'keep')]
    const doc = toChartDoc(payload)
    expect(doc?.cells[0]?.label).toBe('dog')
    expect(doc?.cells[1]?.label).toBe('')
    expect(doc?.cells[2]?.label).toBe('')
    expect(doc?.cells[3]?.label).toBe('keep')
  })

  test('drops malformed optional cell fields, keeps well-formed ones', () => {
    const payload = valid()
    payload.cells = [
      {
        id: 'a',
        icon: { source: 'hacker', set: '', name: 5 } as unknown as CellData['icon'],
        label: 9 as unknown as string,
        color: 12 as unknown as string,
        textOnly: 'yes' as unknown as boolean,
        imageDataUrl: 'javascript:alert(1)' as unknown as string,
      },
      mkCell('b'),
      mkCell('c'),
      mkCell('d'),
    ]
    const cell = toChartDoc(payload)?.cells[0]
    expect(cell?.icon).toBeNull()
    expect(cell?.label).toBe('')
    expect('color' in cell!).toBe(false)
    expect('textOnly' in cell!).toBe(false)
    expect('imageDataUrl' in cell!).toBe(false)
  })

  test('keeps a well-formed upload data URL through the round trip', () => {
    const payload = valid()
    payload.cells[0]!.imageDataUrl = 'data:image/webp;base64,xx'
    expect(toChartDoc(payload)?.cells[0]?.imageDataUrl).toBe('data:image/webp;base64,xx')
  })

  test('is idempotent on its own output (JSON round trip)', () => {
    const first = toChartDoc(valid())
    expect(first).not.toBeNull()
    const second = toChartDoc(JSON.parse(JSON.stringify(first)) as unknown)
    expect(second).toEqual(first)
  })
})
