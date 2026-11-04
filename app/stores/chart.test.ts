/**
 * Store behaviour for the v2 chart document: the single mutation path
 * (reducers + touch + selection reconcile), the 50-deep undo/redo stack with
 * 600ms key-based coalescing, debounced localStorage persistence (300ms,
 * pagehide flush, v2 key only) and defensive rehydration. Runs in plain node
 * (no DOM): `window` is stubbed with a minimal storage + event recorder, and
 * fake timers drive both the debounce and the coalescing window (Date is
 * faked too, so updatedAt assertions stay deterministic).
 */

import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DOC_STORAGE_KEY_V2 } from '../types/chart'
import type { ChartDoc } from '../types/chart'
import { createChoiceBoardChart } from '../utils/templates'
import { useChartStore } from './chart'

const V1_KEY = 'talking-chart-doc-v1'

interface StorageHarness {
  storage: Storage
  setItem: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  /** Mutable so tests can flip write failures mid-test. */
  state: { failWrites: boolean }
}

/** Stub a minimal `window` (storage + event recorder) — the store needs nothing else from DOM. */
function freshStorage(opts: { failWrites?: boolean } = {}): StorageHarness {
  const map = new Map<string, string>()
  const state = { failWrites: opts.failWrites === true }
  const setItem = vi.fn((key: string, value: string) => {
    if (state.failWrites) throw new Error('QuotaExceededError')
    map.set(key, value)
  })
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem,
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    },
  } as unknown as Storage
  const addEventListener = vi.fn()
  vi.stubGlobal('window', { localStorage: storage, addEventListener, removeEventListener: vi.fn() })
  return { storage, setItem, addEventListener, state }
}

/** Fresh pinia + store over a fresh stubbed window (restore() runs during creation). */
function makeStore(opts: { failWrites?: boolean } = {}): { store: ReturnType<typeof useChartStore> } & StorageHarness {
  const harness = freshStorage(opts)
  setActivePinia(createPinia())
  return { store: useChartStore(), ...harness }
}

/** Count undo steps black-box: unwind the stack until it is empty. */
function undoSteps(store: ReturnType<typeof useChartStore>): number {
  let steps = 0
  while (store.canUndo) {
    store.undo()
    steps += 1
  }
  return steps
}

function bundleIcon(name: string): { source: 'bundle'; set: string; name: string } {
  return { source: 'bundle', set: 'openmoji', name }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('initial state', () => {
  test('starts from the blank template, saved, with empty history and no selection', () => {
    const { store, setItem } = makeStore()

    expect(store.doc.title).toBe('')
    expect(store.doc.grid).toEqual({ rows: 3, cols: 4, gap: 8, labelSize: 'm' })
    expect(store.gridSize).toBe(12)
    expect(store.rows).toBe(3)
    expect(store.columns).toBe(4)
    expect(store.placedCount).toBe(0)
    expect(store.selectedCellIndex).toBeNull()
    expect(store.askingCellIndex).toBeNull()
    expect(store.selectedCell).toBeNull()
    expect(store.askingCell).toBeNull()
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
    expect(store.dirty).toBe(false)
    expect(store.storageError).toBe(false)
    // First run seeds storage so it is the single source from the start.
    expect(setItem).toHaveBeenCalledWith(DOC_STORAGE_KEY_V2, expect.any(String))
    expect(store.saved).toBe(true)
  })

  test('selection is UI-only: it never stamps updatedAt or dirties the doc', () => {
    const { store } = makeStore()
    const before = store.doc.updatedAt

    store.selectCell(3)
    expect(store.selectedCellIndex).toBe(3)
    expect(store.selectedCell).toBe(store.doc.cells[3])

    expect(store.doc.updatedAt).toBe(before)
    expect(store.dirty).toBe(false)
    expect(store.canUndo).toBe(false)

    store.selectCell(99) // out of range — ignored
    expect(store.selectedCellIndex).toBe(3)
    store.selectCell(null)
    expect(store.selectedCellIndex).toBeNull()
  })
})

describe('mutations through the single path', () => {
  test('setTitle updates the doc, stamps updatedAt and marks dirty', () => {
    const { store } = makeStore()
    const before = store.doc.updatedAt

    vi.advanceTimersByTime(1) // Date is fake-frozen; move it so the stamp strictly increases
    store.setTitle('Family day')
    expect(store.doc.title).toBe('Family day')
    expect(store.doc.updatedAt).toBeGreaterThan(before)
    expect(store.dirty).toBe(true)
    expect(store.saved).toBe(false)
    expect(store.canUndo).toBe(true)
  })

  test('setCell places content; placedCount and usesArasaac recompute on every touch', () => {
    const { store } = makeStore()

    store.setCell(0, { id: 'c0', icon: bundleIcon('dog'), label: 'dog' })
    expect(store.placedCount).toBe(1)
    expect(store.doc.usesArasaac).toBe(false)

    store.setCell(1, { id: 'c1', icon: { source: 'arasaac', set: 'arasaac', name: '1234' }, label: 'cat' })
    expect(store.placedCount).toBe(2)
    expect(store.doc.usesArasaac).toBe(true)

    store.clearCell(1)
    expect(store.placedCount).toBe(1)
    expect(store.doc.usesArasaac).toBe(false)
    expect(store.doc.cells[1]).toEqual({ id: 'c1', icon: null, label: '' })
  })

  test('label, tint and text-only edits land through the same path', () => {
    const { store } = makeStore()

    store.setCell(0, { id: 'c0', icon: bundleIcon('dog'), label: 'dog' })
    store.setLabel(0, 'Doggo')
    store.setCellColor(0, '#a7ff9c')
    store.setTextOnly(0, true)

    expect(store.doc.cells[0]?.label).toBe('Doggo')
    expect(store.doc.cells[0]?.color).toBe('#a7ff9c')
    expect(store.doc.cells[0]?.textOnly).toBe(true)
    expect(store.canUndo).toBe(true)
  })

  test('duplicate copies content to the next empty cell with a fresh id', () => {
    const { store } = makeStore()

    store.setCell(0, { id: 'c0', icon: bundleIcon('dog'), label: 'dog', color: '#fff3d6' })
    store.duplicateCell(0)
    expect(store.doc.cells[1]?.label).toBe('dog')
    expect(store.doc.cells[1]?.id).not.toBe('c0')
    expect(store.doc.cells[1]?.color).toBe('#fff3d6')
    expect(store.doc.cells[0]?.label).toBe('dog')
  })

  test('swap exchanges cells including ids', () => {
    const { store } = makeStore()

    store.setCell(0, { id: 'c0', icon: bundleIcon('dog'), label: 'dog' })
    store.setCell(4, { id: 'c4', icon: bundleIcon('cat'), label: 'cat' })
    const idBefore = store.doc.cells[0]?.id

    store.swapCells(0, 4)
    expect(store.doc.cells[0]?.label).toBe('cat')
    expect(store.doc.cells[4]?.label).toBe('dog')
    expect(store.doc.cells[4]?.id).toBe(idBefore)
  })

  test('setGrid resizes positionally and reconciles out-of-range selection', () => {
    const { store } = makeStore()

    store.setCell(0, { id: 'c0', icon: bundleIcon('dog'), label: 'dog' })
    store.selectCell(11)
    store.setGrid(2, 2)

    expect(store.gridSize).toBe(4)
    expect(store.doc.cells[0]?.label).toBe('dog')
    expect(store.selectedCellIndex).toBeNull() // index 11 no longer exists
  })

  test('setGap, setLabelSize and setPageSetup update doc settings', () => {
    const { store } = makeStore()

    store.setGap(14)
    store.setLabelSize('l')
    store.setPageSetup({ preset: 'a3', orientation: 'landscape' })

    expect(store.doc.grid.gap).toBe(14)
    expect(store.doc.grid.labelSize).toBe('l')
    expect(store.doc.pageSetup).toEqual({ preset: 'a3', orientation: 'landscape', marginPreset: 'normal' })
  })

  test('applyTemplate replaces the doc, clears selection, and is undoable', () => {
    const { store } = makeStore()
    store.selectCell(5)
    store.askCell(6)
    const previousUpdatedAt = store.doc.updatedAt

    store.applyTemplate(createChoiceBoardChart())

    expect(store.doc.title).toBe('Snack time')
    expect(store.gridSize).toBe(6)
    expect(store.selectedCellIndex).toBeNull()
    expect(store.askingCellIndex).toBeNull()
    expect(store.canUndo).toBe(true)

    store.undo()
    expect(store.doc.title).toBe('')
    expect(store.gridSize).toBe(12)
    expect(store.doc.updatedAt).toBeGreaterThanOrEqual(previousUpdatedAt)
  })
})

describe('selection and asking', () => {
  test('askCell only opens on empty cells and clears the filled-card selection', () => {
    const { store } = makeStore()

    store.setCell(0, { id: 'c0', icon: bundleIcon('dog'), label: 'dog' })
    store.selectCell(0)
    store.askCell(0) // filled — ignored
    expect(store.askingCellIndex).toBeNull()
    expect(store.selectedCellIndex).toBe(0)

    store.askCell(2)
    expect(store.askingCellIndex).toBe(2)
    expect(store.selectedCellIndex).toBeNull()
    expect(store.askingCell).toBe(store.doc.cells[2])

    store.askCell(null)
    expect(store.askingCellIndex).toBeNull()
  })

  test('placing into the asking cell clears the asking state', () => {
    const { store } = makeStore()

    store.askCell(1)
    expect(store.askingCellIndex).toBe(1)
    store.setCell(1, { id: 'c1', icon: bundleIcon('cat'), label: 'cat' })
    expect(store.askingCellIndex).toBeNull()
  })

  test('selectCell while a cell is asking ends the ask (one editing surface)', () => {
    const { store } = makeStore()

    store.setCell(0, { id: 'c0', icon: bundleIcon('dog'), label: 'dog' })
    store.askCell(1) // the add flow is live on an empty card
    expect(store.askingCellIndex).toBe(1)

    // Clicking a filled card must yield the card editor: selection ends the
    // ask — the mirror of askCell clearing the selection.
    store.selectCell(0)
    expect(store.selectedCellIndex).toBe(0)
    expect(store.askingCellIndex).toBeNull()
  })

  test('askNextAfter advances circularly to the next empty cell and returns null when full', () => {
    const { store } = makeStore()

    for (let i = 0; i < 4; i += 1) {
      store.setCell(i, { id: `c${i}`, icon: bundleIcon(`i${i}`), label: `w${i}` })
    }
    expect(store.askNextAfter(2)).toBe(4)
    expect(store.askingCellIndex).toBe(4)

    for (let i = 4; i < 12; i += 1) {
      store.setCell(i, { id: `c${i}`, icon: bundleIcon(`i${i}`), label: `w${i}` })
    }
    expect(store.askNextAfter(11)).toBeNull()
    expect(store.askingCellIndex).toBeNull()
  })
})

describe('undo/redo', () => {
  test('discrete edits each get one step; undo/redo restore exact states', () => {
    const { store } = makeStore()

    store.setTitle('one')
    store.setCell(0, { id: 'c0', icon: bundleIcon('dog'), label: 'dog' })
    store.setCellColor(0, '#e4f2fd')

    expect(store.canUndo).toBe(true)
    store.undo()
    expect(store.doc.cells[0]?.color).toBeUndefined()
    expect(store.doc.cells[0]?.label).toBe('dog')
    expect(store.canRedo).toBe(true)

    store.undo()
    expect(store.doc.title).toBe('one')
    expect(store.doc.cells[0]?.label).toBe('')

    store.redo()
    expect(store.doc.title).toBe('one')
    store.redo()
    expect(store.doc.cells[0]?.color).toBe('#e4f2fd')
    expect(store.canRedo).toBe(false)
  })

  test('undo touches updatedAt (restored content is exact, stamp is fresh)', () => {
    const { store } = makeStore()
    store.setTitle('stamped')
    const before = store.doc.updatedAt

    vi.advanceTimersByTime(10)
    store.setLabel(3, 'word')
    store.undo()

    expect(store.doc.title).toBe('stamped') // exact prior content...
    expect(store.doc.cells[3]?.label).toBe('')
    expect(store.doc.updatedAt).toBeGreaterThan(before) // ...with a fresh stamp
    expect(store.dirty).toBe(true)
  })

  test('rapid same-target edits coalesce into one step (sliding 600ms window)', () => {
    const { store } = makeStore()

    store.setTitle('a')
    vi.advanceTimersByTime(200)
    store.setTitle('ab')
    vi.advanceTimersByTime(200)
    store.setTitle('abc')
    vi.advanceTimersByTime(200)
    expect(undoSteps(store)).toBe(1)
    expect(store.doc.title).toBe('')
  })

  test('different targets do not coalesce, and the window expires', () => {
    const { store } = makeStore()

    store.setLabel(0, 'x')
    store.setLabel(1, 'y') // different cell — own step
    expect(undoSteps(store)).toBe(2)
    store.redo()
    store.redo() // back to the tip: undoSteps() rewinds the doc as a side effect
    expect(store.doc.cells[0]?.label).toBe('x')

    store.setLabel(2, 'x')
    vi.advanceTimersByTime(700) // beyond the 600ms window
    store.setLabel(2, 'xy')
    // x, y (restored by the redos above) + x@2 + the expired xy@2 — the window
    // expiry must keep 'xy' a distinct step, so nothing coalesces anywhere.
    expect(undoSteps(store)).toBe(4)
    store.redo()
    store.redo()
    store.redo()
    store.redo()
    expect(store.doc.cells[2]?.label).toBe('xy')
  })

  test('same-cell rapid typing coalesces; title and label keys are independent', () => {
    const { store } = makeStore()

    store.setTitle('t')
    store.setLabel(0, 'd')
    vi.advanceTimersByTime(100)
    store.setLabel(0, 'do')
    vi.advanceTimersByTime(100)
    store.setLabel(0, 'dog')
    expect(undoSteps(store)).toBe(2) // one for the title, one for the whole label stream
    expect(store.doc.cells[0]?.label).toBe('')
  })

  test('a fresh edit after undo discards the redo stack', () => {
    const { store } = makeStore()

    store.setTitle('one')
    vi.advanceTimersByTime(700) // let the coalescing window expire — 'two' is its own step
    store.setTitle('two')
    store.undo()
    expect(store.doc.title).toBe('one')
    expect(store.canRedo).toBe(true)

    store.setTitle('three')
    expect(store.canRedo).toBe(false)
    store.redo()
    expect(store.doc.title).toBe('three')
  })

  test('the stack is capped at 50 entries — the oldest steps fall off', () => {
    const { store } = makeStore()

    store.setGrid(8, 10) // 1 discrete step
    for (let i = 0; i < 60; i += 1) {
      store.setCell(i, { id: `p${i}`, icon: bundleIcon(`n${i}`), label: `w${i}` })
    }

    let steps = 0
    while (store.canUndo) {
      store.undo()
      steps += 1
    }
    expect(steps).toBe(50)
    // The oldest surviving snapshot predates placement #11: cells 0–9 are filled, cell 10 is empty.
    expect(store.doc.cells[9]?.label).toBe('w9')
    expect(store.doc.cells[10]?.label).toBe('')
    expect(store.canRedo).toBe(true)
  })

  test('undo/redo reconcile out-of-range selection', () => {
    const { store } = makeStore()

    store.selectCell(5)
    store.setGrid(2, 2) // selection cleared by the shrink
    expect(store.selectedCellIndex).toBeNull()

    store.undo() // grid back to 3×4 — selection stays null (invalidated), doc restored
    expect(store.gridSize).toBe(12)
    expect(store.selectedCellIndex).toBeNull()
  })
})

describe('persistence', () => {
  test('writes are debounced: one write 300ms after the last edit', async () => {
    const { store, setItem } = makeStore()
    setItem.mockClear()

    store.setTitle('a')
    await nextTick()
    vi.advanceTimersByTime(299)
    expect(setItem).not.toHaveBeenCalled()

    store.setTitle('ab') // resets the debounce window
    await nextTick()
    vi.advanceTimersByTime(200)
    expect(setItem).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(setItem).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(setItem.mock.calls[0]?.[1] as string) as ChartDoc
    expect(payload.title).toBe('ab')
    expect(store.dirty).toBe(false)
    expect(store.saved).toBe(true)
  })

  test('pagehide flushes a pending write immediately', async () => {
    const { store, setItem, addEventListener } = makeStore()
    setItem.mockClear()

    store.setTitle('flush me')
    await nextTick()
    const pagehide = addEventListener.mock.calls
      .filter((call) => call[0] === 'pagehide')
      .map((call) => call[1] as () => void)
      .at(-1)
    expect(pagehide).toBeTypeOf('function')

    pagehide?.()
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(store.dirty).toBe(false)
  })

  test('a failed write raises storageError and keeps the doc dirty; recovery clears it', async () => {
    const { store, state } = makeStore({ failWrites: true })
    expect(store.storageError).toBe(true) // the initial seed write already failed

    store.setTitle('at risk')
    await nextTick()
    vi.advanceTimersByTime(300)
    expect(store.storageError).toBe(true)
    expect(store.dirty).toBe(true)
    expect(store.saved).toBe(false)

    state.failWrites = false
    store.setTitle('saved now')
    await nextTick()
    vi.advanceTimersByTime(300)
    expect(store.storageError).toBe(false)
    expect(store.dirty).toBe(false)
    expect(store.saved).toBe(true)
  })

  test('a storage access failure at load keeps the fresh doc and flags the error', () => {
    const harness = freshStorage()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: harness.setItem,
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    setActivePinia(createPinia())
    const store = useChartStore()

    expect(store.storageError).toBe(true)
    expect(store.doc.title).toBe('')
  })

  test('rehydrates a valid v2 payload exactly; no rewrite until the next edit', () => {
    const harness = freshStorage()
    const saved = createChoiceBoardChart()
    harness.storage.setItem(DOC_STORAGE_KEY_V2, JSON.stringify(saved))
    harness.setItem.mockClear() // seeding used the same mock — count only store-side writes
    setActivePinia(createPinia())
    const store = useChartStore()

    expect(store.doc.title).toBe('Snack time')
    expect(store.gridSize).toBe(6)
    expect(store.doc.cells.map((cell) => cell.label)).toEqual(
      ['apple', 'banana', 'grapes', 'cookie', 'milk', 'water'],
    )
    expect(store.dirty).toBe(false)
    expect(store.saved).toBe(true)
    expect(harness.setItem).not.toHaveBeenCalled() // restore never triggers a re-save
  })

  test('a corrupt payload starts fresh and overwrites the bad data', () => {
    const harness = freshStorage()
    harness.storage.setItem(DOC_STORAGE_KEY_V2, 'not json {')
    setActivePinia(createPinia())
    const store = useChartStore()

    expect(store.doc.title).toBe('')
    expect(store.gridSize).toBe(12)
    expect(store.storageError).toBe(false) // corrupt data ≠ storage failure
    expect(harness.setItem).toHaveBeenCalledWith(DOC_STORAGE_KEY_V2, expect.any(String))
    expect(store.saved).toBe(true)
  })

  test('a structurally-invalid (non-v2) payload is rejected like corrupt data', () => {
    const harness = freshStorage()
    harness.storage.setItem(DOC_STORAGE_KEY_V2, JSON.stringify({ title: 42, slots: [] }))
    setActivePinia(createPinia())
    const store = useChartStore()

    expect(store.doc.title).toBe('')
    expect(store.doc.pageSetup.preset).toBe('a4')
    expect(harness.setItem).toHaveBeenCalled()
  })

  test('the v1 key is ignored — clean break, never read, never written', () => {
    const harness = freshStorage()
    harness.storage.setItem(
      V1_KEY,
      JSON.stringify({ title: 'old v1 chart', grid: '4x5', slots: [], usesArasaac: false, updatedAt: 1 }),
    )
    setActivePinia(createPinia())
    const store = useChartStore()

    expect(store.doc.title).toBe('') // blank template, not the v1 chart
    expect(harness.storage.getItem(V1_KEY)).not.toBeNull() // v1 data left untouched
    expect(store.doc.grid.rows).toBe(3)
  })
})
