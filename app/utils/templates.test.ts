/**
 * Template factory invariants: every starter chart must produce a complete,
 * valid v2 doc — grid-matched cells, unique ids, and the exact geometry and
 * sample content approved in design_iterations/mockup-builder-v2.html.
 */

import { describe, expect, test } from 'vitest'
import { CHART_TEMPLATES, createBlankChart } from './templates'

/** Approved template data, transcribed from the mockup's TEMPLATES table. */
const APPROVED = {
  blank: { title: '', rows: 3, cols: 4, preset: 'a4', orientation: 'portrait', gap: 8, labels: [] },
  'first-then': { title: 'First–Then', rows: 1, cols: 2, preset: 'a5', orientation: 'landscape', gap: 10, labels: ['work', 'play'] },
  choice: { title: 'Snack time', rows: 2, cols: 3, preset: 'a4', orientation: 'landscape', gap: 8, labels: ['apple', 'banana', 'grapes', 'cookie', 'milk', 'water'] },
  schedule: { title: 'Morning routine', rows: 1, cols: 4, preset: 'a4', orientation: 'portrait', gap: 8, labels: ['wake up', 'brush teeth', 'get dressed', 'bus'] },
  vocab: { title: 'Animal words', rows: 3, cols: 3, preset: 'a4', orientation: 'portrait', gap: 8, labels: ['dog', 'cat', 'fish', 'horse', 'lion', 'bird', 'turtle', 'duck', 'rabbit'] },
} as const

describe('chart templates', () => {
  test('gallery lists the five approved templates in order', () => {
    expect(CHART_TEMPLATES.map((template) => template.id)).toEqual([
      'blank',
      'first-then',
      'choice',
      'schedule',
      'vocab',
    ])
  })

  test('each factory produces a doc matching the approved geometry and content', () => {
    for (const template of CHART_TEMPLATES) {
      const doc = template.create()
      const approved = APPROVED[template.id]

      expect(doc.title).toBe(approved.title)
      expect(doc.grid.rows).toBe(approved.rows)
      expect(doc.grid.cols).toBe(approved.cols)
      expect(doc.grid.gap).toBe(approved.gap)
      expect(doc.pageSetup.preset).toBe(approved.preset)
      expect(doc.pageSetup.orientation).toBe(approved.orientation)
      expect(doc.pageSetup.marginPreset).toBe('normal')
    }
  })

  test('sample cards fill leading positions; the rest are fresh empties', () => {
    for (const template of CHART_TEMPLATES) {
      const doc = template.create()
      const labels = doc.cells.map((cell) => cell.label).filter((label) => label !== '')
      expect(labels).toEqual([...APPROVED[template.id].labels])

      const firstEmptyAt = APPROVED[template.id].labels.length
      if (firstEmptyAt < doc.cells.length) {
        expect(doc.cells[firstEmptyAt]?.label).toBe('')
      }
    }
  })

  test('cells match the grid (row-major) and ids are unique', () => {
    for (const template of CHART_TEMPLATES) {
      const doc = template.create()
      expect(doc.cells).toHaveLength(doc.grid.rows * doc.grid.cols)
      const ids = doc.cells.map((cell) => cell.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  test('template cells ship labels + tints only — no icons, uploads or text-only', () => {
    for (const template of CHART_TEMPLATES) {
      const doc = template.create()
      for (const cell of doc.cells) {
        expect(cell.icon).toBeNull()
        expect(cell.textOnly).not.toBe(true)
        expect(cell.imageDataUrl).toBeUndefined()
        if (cell.color !== undefined && cell.color !== null) {
          expect(cell.color).toMatch(/^#[0-9a-f]{6}$/i)
        }
      }
      expect(doc.usesArasaac).toBe(false)
      expect(Number.isFinite(doc.updatedAt)).toBe(true)
    }
  })

  test('factories return independent docs (no aliasing between calls)', () => {
    const first = createBlankChart()
    const second = createBlankChart()
    expect(first).not.toBe(second)
    expect(first.cells[0]).not.toBe(second.cells[0])
    if (first.cells[0]) first.cells[0].label = 'mutated'
    expect(second.cells[0]?.label).toBe('')
  })
})
