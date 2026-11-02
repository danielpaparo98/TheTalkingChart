/**
 * Pure grid geometry for the print page — the math PageGrid binds to CSS,
 * split out so every derived style string is unit-testable. All length
 * math speaks sheet-relative cqw (the print contract): any length of X mm
 * renders as `X / pageWidthMm × 100cqw`, where 100cqw ≡ the full sheet
 * width, so screen zoom and printed mm stay proportionally identical for
 * every page preset and orientation.
 *
 * Inputs are trusted to come from validated doc state (`toChartDoc`/`setGrid`
 * clamp rows/cols/gap before anything reaches here); these functions stay
 * total and deterministic, never touching the DOM or the clock.
 */

import type { LabelSize } from '../types/chart'
import { LABEL_SIZE_CQW } from './page-presets'

/**
 * Sheet width (mm) assumed when no ancestor exposes `--page-w-mm` — A4,
 * the approved default. PrintPage always sets the var; the fallback only
 * guards isolated rendering (tests, docs previews).
 */
const FALLBACK_PAGE_WIDTH_MM = 210

/** The mockup's medium card-label size in cqw — the scale's identity step. */
export const SLOT_LABEL_BASE_CQW = LABEL_SIZE_CQW.m

/** mm → cqw sheet-relative ratio: the print contract's single unit conversion. */
export function mmAsCqw(mm: number, pageWidthMm: number): number {
  return (mm / pageWidthMm) * 100
}

/**
 * Gap track sizing from the doc's gap (mm). The sheet width rides the CSS
 * var `--page-w-mm` that PrintPage publishes on the page root, so the same
 * expression stays mm-true at every page size without a re-render on
 * orientation switches.
 */
export function gridGapCss(gapMm: number): string {
  return `calc(${gapMm} / var(--page-w-mm, ${FALLBACK_PAGE_WIDTH_MM}) * 100cqw)`
}

/** Track sizing keys for the grid container — bound through a style object. */
export interface GridTemplate {
  gridTemplateColumns: string
  gridTemplateRows: string
}

/** cols×rows CSS grid template: both axes stretch to the printable area (mockup parity). */
export function gridTemplateCss(rows: number, cols: number): GridTemplate {
  return {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  }
}

/**
 * Card-label scale step for the sheet's `--slot-label-scale` var, relative
 * to the medium size: `scale × SLOT_LABEL_BASE_CQW` reproduces the approved
 * LABEL_SIZE_CQW table (9/11/13.5 cqw) exactly, so the mockup's label
 * hierarchy survives the scale-var pattern untouched.
 */
export function slotLabelScale(labelSize: LabelSize): number {
  return LABEL_SIZE_CQW[labelSize] / SLOT_LABEL_BASE_CQW
}

/** Row-major grid position: index of (row, col) inside a rows×cols grid. */
export function cellIndex(row: number, col: number, cols: number): number {
  return row * cols + col
}

/** Exact inverse of {@link cellIndex} for the same cols count. */
export function cellPosition(index: number, cols: number): { row: number; col: number } {
  return { row: Math.floor(index / cols), col: index % cols }
}
