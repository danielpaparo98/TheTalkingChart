/**
 * Starter chart templates — pure factories that each produce a complete,
 * valid `ChartDoc` v2. Geometry and sample content are transcribed from the
 * approved mockup's TEMPLATES table (design_iterations/mockup-builder-v2.html).
 * Cards ship labels + tints only; icons stay `null` until the icon pipeline
 * is wired into placement.
 */

import type { CellData, ChartDoc, GridSetup, PageSetup } from '../types/chart'
// ONE id scheme/counter and ONE cell-list fitter — the shared versions from
// the doc reducers, never local copies (they must mint ids identically).
import { createCellId, fitCells } from './doc-reducers'

/**
 * The six approved card tints (Poster Desk palette). Kept next to the
 * template card data that first uses them; the card editor will import
 * from here too rather than redeclaring the hexes.
 */
export const CARD_TINTS = {
  mint: '#a7ff9c',
  lemon: '#fff3d6',
  sky: '#e4f2fd',
  peach: '#ffe3d6',
  orange: '#ffd8c2',
  lilac: '#f3e8fd',
} as const

/** A content card: label + tint; icon stays null until placement is wired. */
function createCard(label: string, color: string): CellData {
  return { id: createCellId(), icon: null, label, color }
}

function createDoc(title: string, pageSetup: PageSetup, grid: GridSetup, cards: CellData[]): ChartDoc {
  return {
    version: 2,
    title,
    pageSetup,
    grid,
    cells: fitCells(cards, grid.rows * grid.cols),
    usesArasaac: false,
    updatedAt: Date.now(),
  }
}

const A4_PORTRAIT: PageSetup = { preset: 'a4', orientation: 'portrait', marginPreset: 'normal' }
const A4_LANDSCAPE: PageSetup = { preset: 'a4', orientation: 'landscape', marginPreset: 'normal' }
const A5_LANDSCAPE: PageSetup = { preset: 'a5', orientation: 'landscape', marginPreset: 'normal' }

export function createBlankChart(): ChartDoc {
  return createDoc('', A4_PORTRAIT, { rows: 3, cols: 4, gap: 8, labelSize: 'm' }, [])
}

export function createFirstThenChart(): ChartDoc {
  return createDoc('First–Then', A5_LANDSCAPE, { rows: 1, cols: 2, gap: 10, labelSize: 'm' }, [
    createCard('work', CARD_TINTS.peach),
    createCard('play', CARD_TINTS.mint),
  ])
}

export function createChoiceBoardChart(): ChartDoc {
  return createDoc('Snack time', A4_LANDSCAPE, { rows: 2, cols: 3, gap: 8, labelSize: 'm' }, [
    createCard('apple', CARD_TINTS.lemon),
    createCard('banana', CARD_TINTS.lemon),
    createCard('grapes', CARD_TINTS.lemon),
    createCard('cookie', CARD_TINTS.lemon),
    createCard('milk', CARD_TINTS.lemon),
    createCard('water', CARD_TINTS.lemon),
  ])
}

export function createScheduleChart(): ChartDoc {
  return createDoc('Morning routine', A4_PORTRAIT, { rows: 1, cols: 4, gap: 8, labelSize: 'm' }, [
    createCard('wake up', CARD_TINTS.sky),
    createCard('brush teeth', CARD_TINTS.sky),
    createCard('get dressed', CARD_TINTS.sky),
    createCard('bus', CARD_TINTS.sky),
  ])
}

export function createVocabularyChart(): ChartDoc {
  return createDoc('Animal words', A4_PORTRAIT, { rows: 3, cols: 3, gap: 8, labelSize: 'm' }, [
    createCard('dog', CARD_TINTS.mint),
    createCard('cat', CARD_TINTS.sky),
    createCard('fish', CARD_TINTS.lemon),
    createCard('horse', CARD_TINTS.sky),
    createCard('lion', CARD_TINTS.peach),
    createCard('bird', CARD_TINTS.sky),
    createCard('turtle', CARD_TINTS.mint),
    createCard('duck', CARD_TINTS.lemon),
    createCard('rabbit', CARD_TINTS.peach),
  ])
}

/** One row of the template gallery. */
export interface TemplateDescriptor {
  /** Stable template id, used by the gallery and undo bookkeeping. */
  id: 'blank' | 'first-then' | 'choice' | 'schedule' | 'vocab'
  /** Gallery card name. */
  name: string
  /** Gallery card description. */
  description: string
  /** Builds a fresh, fully independent doc for this template. */
  create: () => ChartDoc
}

/** The starter gallery, in approved display order. */
export const CHART_TEMPLATES: TemplateDescriptor[] = [
  { id: 'blank', name: 'Blank', description: 'A clean sheet — set your own rows, columns and cards.', create: createBlankChart },
  { id: 'first-then', name: 'First–Then', description: 'Two steps: what happens first, then what comes next.', create: createFirstThenChart },
  { id: 'choice', name: 'Choice Board', description: 'Six snack options to choose from.', create: createChoiceBoardChart },
  { id: 'schedule', name: 'Schedule', description: 'A four-step morning routine strip.', create: createScheduleChart },
  { id: 'vocab', name: 'Vocabulary', description: 'A 3 × 3 word wall for new animal words.', create: createVocabularyChart },
]
