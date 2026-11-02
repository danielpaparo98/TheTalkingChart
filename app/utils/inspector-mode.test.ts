/**
 * Inspector-mode derivation invariants: precedence (replace > asking >
 * selected > page), emptiness decides add-vs-card, and dead indices fall
 * through so the panel re-derives when a target cell disappears.
 */

import { describe, expect, test } from 'vitest'
import type { CellData } from '../types/chart'
import { deriveInspector } from './inspector-mode'

const DOG = { source: 'bundle', set: 'openmoji', name: 'dog' } as const

function filled(id: string, extra: Partial<CellData> = {}): CellData {
  return { id, icon: { ...DOG }, label: 'dog', ...extra }
}

const CELLS: CellData[] = [
  filled('a'),
  { id: 'b', icon: null, label: '' }, // empty
  { id: 'c', icon: null, label: 'labelled only' }, // filled without an icon
]

const BASE = { cells: CELLS, replaceIndex: null, askingCellIndex: null, selectedCellIndex: null }

describe('deriveInspector', () => {
  test('no selection -> page mode with no target', () => {
    expect(deriveInspector(BASE)).toEqual({ mode: 'page', targetIndex: null, replace: false })
  })

  test('asking cell -> add mode targeting it', () => {
    expect(deriveInspector({ ...BASE, askingCellIndex: 1 })).toEqual({
      mode: 'add',
      targetIndex: 1,
      replace: false,
    })
  })

  test('selected empty cell -> add mode (click-to-add without asking)', () => {
    expect(deriveInspector({ ...BASE, selectedCellIndex: 1 })).toEqual({
      mode: 'add',
      targetIndex: 1,
      replace: false,
    })
  })

  test('selected filled cell -> card mode, even without an icon', () => {
    expect(deriveInspector({ ...BASE, selectedCellIndex: 0 }).mode).toBe('card')
    expect(deriveInspector({ ...BASE, selectedCellIndex: 2 })).toEqual({
      mode: 'card',
      targetIndex: 2,
      replace: false,
    })
  })

  test('replace substate wins over asking and selected, flagged replace', () => {
    expect(deriveInspector({ ...BASE, selectedCellIndex: 1, replaceIndex: 0 })).toEqual({
      mode: 'add',
      targetIndex: 0,
      replace: true,
    })
    expect(deriveInspector({ ...BASE, askingCellIndex: 1, replaceIndex: 2 }).replace).toBe(true)
  })

  test('dead indices fall through to the next rule (target cell vanished)', () => {
    // Out-of-range replace falls back to the selected empty cell.
    expect(deriveInspector({ ...BASE, selectedCellIndex: 1, replaceIndex: 99 })).toEqual({
      mode: 'add',
      targetIndex: 1,
      replace: false,
    })
    // Out-of-range selection lands on page mode.
    expect(deriveInspector({ ...BASE, selectedCellIndex: 42 }).mode).toBe('page')
  })

  test('asking index pointing at a filled cell is ignored (store guards this)', () => {
    expect(deriveInspector({ ...BASE, askingCellIndex: 0 }).mode).toBe('page')
  })

  test('a card cleared to empty re-derives to add mode for the same index', () => {
    const cleared: CellData[] = [{ id: 'a', icon: null, label: '' }, CELLS[1] as CellData, CELLS[2] as CellData]
    expect(deriveInspector({ ...BASE, selectedCellIndex: 0, cells: cleared })).toEqual({
      mode: 'add',
      targetIndex: 0,
      replace: false,
    })
  })
})
