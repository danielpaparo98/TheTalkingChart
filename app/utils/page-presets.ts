/**
 * Page-preset data and pure print math for the builder v2. Everything here
 * speaks millimetres — the unit shared by the doc model, the print CSS and
 * the @page rule — so there is exactly one conversion boundary (px) and it
 * lives at the render layer, not here.
 */

import type { LabelSize, MarginPreset, Orientation, PagePresetId } from '../types/chart'

/** One paper size preset. `widthMm`/`heightMm` are the PORTRAIT dimensions; landscape swaps them. */
export interface PagePreset {
  /** Identifier persisted in `ChartDoc.pageSetup.preset`. */
  id: PagePresetId
  /** Human-readable size name shown in the page picker. */
  label: string
  /** Portrait sheet width in mm. */
  widthMm: number
  /** Portrait sheet height in mm. */
  heightMm: number
}

/** The four paper presets with exact dimensions (approved decision #3; no custom mm). */
export const PAGE_PRESETS: Record<PagePresetId, PagePreset> = {
  a4: { id: 'a4', label: 'A4', widthMm: 210, heightMm: 297 },
  letter: { id: 'letter', label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  a5: { id: 'a5', label: 'A5', widthMm: 148, heightMm: 210 },
  a3: { id: 'a3', label: 'A3', widthMm: 297, heightMm: 420 },
}

/** Print margins in mm (approved decision #4 — margins come from doc settings, not the printer). */
export const MARGIN_PRESETS_MM: Record<MarginPreset, number> = {
  narrow: 8,
  normal: 12,
  wide: 20,
}

/**
 * Card label size steps as sheet-relative widths (cqw), mirroring the
 * approved mockup's `.lab-s/.lab-m/.lab-l` values.
 */
export const LABEL_SIZE_CQW: Record<LabelSize, number> = {
  s: 9,
  m: 11,
  l: 13.5,
}

/** Sheet dimensions for a preset + orientation pair; landscape swaps the portrait dims. */
export function pageDims(
  preset: PagePresetId,
  orientation: Orientation,
): { widthMm: number; heightMm: number } {
  const { widthMm, heightMm } = PAGE_PRESETS[preset]
  return orientation === 'landscape'
    ? { widthMm: heightMm, heightMm: widthMm }
    : { widthMm, heightMm }
}

/** Sheet aspect ratio (width ÷ height) — drives the fit-to-canvas zoom math. */
export function aspectRatio(preset: PagePresetId, orientation: Orientation): number {
  const { widthMm, heightMm } = pageDims(preset, orientation)
  return widthMm / heightMm
}

/** Print margin for a margin preset, in mm. */
export function marginMm(preset: MarginPreset): number {
  return MARGIN_PRESETS_MM[preset]
}

/**
 * Millimetres for print CSS: integers stay plain ('210'), decimals get one
 * place ('215.9') — same formatting the approved mockup uses for its
 * canvas status line, so screen and print strings always agree.
 */
export function formatMm(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

/**
 * `size` declaration for the managed @page rule. A function, not a
 * constant, because custom properties don't work inside @page — the rule
 * must be rebuilt as a literal string whenever page settings change.
 * The FULL rule (wrapping + `margin: 0`) is `usePageSetup`'s
 * `pageRuleText()` — this module owns only the size string, so there is
 * exactly one builder per layer.
 */
export function pageSizeDeclaration(preset: PagePresetId, orientation: Orientation): string {
  const { widthMm, heightMm } = pageDims(preset, orientation)
  return `size: ${formatMm(widthMm)}mm ${formatMm(heightMm)}mm`
}
