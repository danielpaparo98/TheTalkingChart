/**
 * Export composable — print / PNG / PDF for the print page (builder v2).
 *
 * Contract (context decision 4 — print contract):
 * - The capture/print root is the single `[data-print-page]` element
 *   rendered by the v2 print page (v1's `data-chart-sheet` is retired).
 *   PNG/PDF capture locate it via that attribute.
 * - `printChart()` stays a plain `window.print()`: physical size comes from
 *   the dynamically injected `@page { size: … }` rule — built by
 *   `pageSizeDeclaration()`/`pageRule()` in `app/utils/page-presets.ts` and
 *   injected by the page-setup composable (subtask 03; stylesheet wiring
 *   lands with the print tasks, subtask 15). Injection intentionally does
 *   NOT happen here — the managed style tag has exactly one owner.
 * - PNG/PDF dimensions derive from `doc.pageSetup` (paper preset +
 *   orientation) via `pageDims()` — all 8 preset/orientation combinations,
 *   no hardcoded page constants. The PDF page is sized EXACTLY to the doc's
 *   mm dimensions; the PNG raster derives its capture scale so the image is
 *   true-page-size at the chosen density.
 * - Attribution rides along (decision 10, v1 behaviour kept): the compact
 *   attribution line assembles from the doc's cells + `usesArasaac` flag
 *   (ARASAAC string byte-exact via the kept `useArasaac.ts`) and renders
 *   inside the sheet, so it prints and is captured with every export.
 *
 * `html2canvas-pro` is imported at RUNTIME from `public/vendor/` (copied
 * untransformed by scripts/vendor-runtime-deps.mjs): the bundler-transformed
 * copy of html2canvas-pro 2.5.2 hangs indefinitely, while the raw dist file
 * captures in ~1.4s. The URL uses Nuxt's runtime `app.baseURL` — do NOT use
 * `import.meta.env.BASE_URL` here: in Nuxt that is Vite's build base
 * (`/…/assets/`), not the app's public path. `jspdf` is a normal dynamic
 * import (its bundled transform is fine).
 *
 * Failures never escape as exceptions: every path reports through the
 * `error` ref (UI-facing string) with typed reasons on `ExportError` for
 * programmatic handling.
 */
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { pageDims } from '../utils/page-presets'
import { ARASAAC_ATTRIBUTION } from './useArasaac'
import type { CellData, ChartDoc, Orientation, PageSetup } from '../types/chart'
import type { IconSetMeta } from '../types/icons'

/** DOM attribute marking the export/print root of the print page (decision 4). */
const PRINT_PAGE_SELECTOR = '[data-print-page]'

/**
 * Pixel scale used when rasterising the sheet for the PDF (PNG honours the
 * caller's scale or derives one for true-page-size density).
 */
const PDF_CAPTURE_SCALE = 2

/**
 * PNG density multiplier for true-page-size rasters: the produced image is
 * this many times the page's CSS-pixel dimensions (2× ≈ 192 DPI on A4).
 */
const PNG_DENSITY_MULTIPLIER = 2

/** JPEG encoder quality for the PDF image — near-print fidelity at a reasonable file size. */
const PDF_JPEG_QUALITY = 0.95

/**
 * Unit-conversion factors: CSS reference pixel (96 px/in) and PDF point
 * (72 pt/in) per millimetre. The single conversion boundary for this module
 * — everything downstream works natively in mm.
 */
const PX_PER_MM = 96 / 25.4
const PT_PER_MM = 72 / 25.4

/**
 * Page setup bridging pre-v2 callers that don't pass a doc yet (the v1
 * sheet was a fixed A4 landscape). Dimensions still come from page-presets
 * — no v1 numbers live in this module.
 */
const LEGACY_PAGE_SETUP: PageSetup = { preset: 'a4', orientation: 'landscape', marginPreset: 'normal' }

/** Why an export step failed. Surfaces typed failures without throwing. */
export type ExportErrorReason = 'missing-sheet' | 'render-failed' | 'encode-failed'

/** Structured export failure. */
export interface ExportError {
  /** Machine-readable failure category. */
  reason: ExportErrorReason
  /** Human-readable message, safe to show in the UI. */
  message: string
  /** Original cause, when one exists (unknown on purpose — library errors are untyped). */
  cause?: unknown
}

/** Outcome of rasterising the sheet: a canvas, or a typed error — never a thrown exception. */
type CaptureResult =
  | { canvas: HTMLCanvasElement; error: null }
  | { canvas: null; error: ExportError }

/** The doc slice the exporter needs — the full v2 `ChartDoc` satisfies it structurally. */
export type ExportableDoc = Pick<ChartDoc, 'title' | 'pageSetup' | 'usesArasaac' | 'cells'>

/** Options for {@link useExport}. */
export interface UseExportOptions {
  /**
   * Live v2 doc (value, ref or getter) — drives page dimensions, export
   * filenames and the attribution line. Preferred input.
   */
  doc?: MaybeRefOrGetter<ExportableDoc>
  /**
   * Legacy v1 title getter, used only when `doc` is absent (pre-v2 callers
   * during the rebuild window). Ignored when `doc` is provided.
   */
  title?: () => string
  /**
   * Resolves a bundle set prefix to its licence metadata (catalog store or
   * fallback registry, caller-owned). Unknown prefixes yield `null` and are
   * skipped — inventing licence text is never acceptable.
   */
  resolveSetMeta?: (prefix: string) => IconSetMeta | null
}

/** Rectangle for placing the image on the PDF page (in the PDF's unit, mm here). */
export interface FittedRect {
  x: number
  y: number
  width: number
  height: number
}

/** Constructor input for a jsPDF page, sized exactly to the doc's dims in mm. */
export interface PdfPageConfig {
  /** Sheet orientation, derived FROM the dims so format and orientation always agree. */
  orientation: Orientation
  /** `[widthMm, heightMm]` — already oriented, so jsPDF's normalization never swaps it. */
  format: [number, number]
}

// ---------------------------------------------------------------------------
// Pure helpers — no DOM, unit-tested in useExport.test.ts
// ---------------------------------------------------------------------------

/** Millimetres → CSS pixels (96 px/in) — the one px boundary for print math. */
export function mmToPx(mm: number): number {
  return mm * PX_PER_MM
}

/** Millimetres → PDF points (72 pt/in) — for point-unit PDF/print consumers. */
export function mmToPt(mm: number): number {
  return mm * PT_PER_MM
}

/**
 * Largest rectangle that fits `contentW × contentH` inside `boxW × boxH`,
 * centred, aspect ratio preserved (CSS `object-fit: contain` maths).
 */
export function fitContain(contentW: number, contentH: number, boxW: number, boxH: number): FittedRect {
  const scale = Math.min(boxW / contentW, boxH / contentH)
  const width = contentW * scale
  const height = contentH * scale
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height }
}

/**
 * Remove filesystem-invalid characters and collapse whitespace so a chart
 * title is safe as a download filename. Returns `''` for a blank title.
 */
export function sanitizeTitle(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/** Download filename for an export: sanitized `<title>-chart.<ext>`, or `chart.<ext>`. */
export function exportFilename(title: string, ext: 'png' | 'pdf'): string {
  const base = sanitizeTitle(title)
  return `${base.length > 0 ? `${base}-chart` : 'chart'}.${ext}`
}

/**
 * html2canvas-pro capture scale that renders the PNG at true page size: the
 * raster becomes `densityMultiplier ×` the page's CSS-pixel width regardless
 * of the px width the sheet currently lays out at (layout px ignore CSS zoom
 * transforms, so this stays zoom-proof). Falls back to the multiplier itself
 * when the element width (or page width) is unusable.
 */
export function pngCaptureScale(
  pageWidthMm: number,
  elementWidthPx: number,
  densityMultiplier: number = PNG_DENSITY_MULTIPLIER,
): number {
  const density = Number.isFinite(densityMultiplier) && densityMultiplier > 0 ? densityMultiplier : PNG_DENSITY_MULTIPLIER
  const usable = (v: number): boolean => Number.isFinite(v) && v > 0
  return usable(pageWidthMm) && usable(elementWidthPx)
    ? (mmToPx(pageWidthMm) * density) / elementWidthPx
    : density
}

/**
 * jsPDF page config for a doc's page setup. Orientation is derived from the
 * dims so format and orientation always agree — jsPDF normalizes (forces
 * width ≥ height in landscape, height ≥ width in portrait) and leaves
 * already-consistent input untouched, so the page is EXACTLY the doc's mm.
 */
export function pdfPageConfig(pageSetup: PageSetup): PdfPageConfig {
  const { widthMm, heightMm } = pageDims(pageSetup.preset, pageSetup.orientation)
  return {
    orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
    format: [widthMm, heightMm],
  }
}

/**
 * Bundle set prefixes actually used on the chart: unique `icon.set` values
 * of placed non-ARASAAC icons, in first-seen order. ARASAAC rows are
 * governed by `doc.usesArasaac` instead (v1 behaviour).
 */
export function usedSetPrefixes(cells: ReadonlyArray<Pick<CellData, 'icon'>>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const cell of cells) {
    const icon = cell.icon
    if (icon === null || icon.source === 'arasaac') continue
    if (seen.has(icon.set)) continue
    seen.add(icon.set)
    out.push(icon.set)
  }
  return out
}

/**
 * The compact attribution line that travels with the chart (v1 contract):
 * `Icons: <label> (<license>)` per used bundle set, joined with middots,
 * with the byte-exact ARASAAC attribution appended last when
 * `usesArasaac`. Empty string for a chart with no attributed content —
 * the notice renders nothing.
 */
export function attributionLine(usedSets: ReadonlyArray<IconSetMeta>, usesArasaac: boolean): string {
  const segments = usedSets.map((meta) => `${meta.label} (${meta.license})`)
  if (usesArasaac) segments.push(ARASAAC_ATTRIBUTION)
  return segments.length === 0 ? '' : `Icons: ${segments.join(' · ')}`
}

// ---------------------------------------------------------------------------
// Browser-only plumbing — thin wrappers around DOM/Canvas/jsPDF, untested
// ---------------------------------------------------------------------------

/**
 * Rasterise the print page root to a canvas via html2canvas-pro.
 * The capture is plain (no `onclone` mutation) and composited on white, so
 * JPEG encoding for the PDF has no transparent pixels to turn black.
 * See the module doc block for why the library loads from `public/vendor/`.
 */
async function captureSheet(scale: number): Promise<CaptureResult> {
  const sheet = document.querySelector<HTMLElement>(PRINT_PAGE_SELECTOR)
  if (!sheet) {
    return {
      canvas: null,
      error: {
        reason: 'missing-sheet',
        // User-facing: no CSS selector jargon in the dialog (WCAG 3.3.1).
        message: 'The chart could not be found on the page. Close this dialog and try again.',
      },
    }
  }
  try {
    const baseUrl = useRuntimeConfig().app.baseURL ?? '/'
    const mod = (await import(/* @vite-ignore */ `${baseUrl}vendor/html2canvas-pro.esm.js`)) as {
      default: typeof import('html2canvas-pro')['default']
    }
    const canvas = await mod.default(sheet, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
    return { canvas: rebindToLiveDocument(canvas), error: null }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    return {
      canvas: null,
      error: {
        reason: 'render-failed',
        message: `Rendering the chart to an image failed (${detail}).`,
        cause,
      },
    }
  }
}

/**
 * Copy a canvas's bitmap onto a canvas owned by the LIVE main document.
 * html2canvas-pro renders inside a temporary clone iframe and returns a
 * canvas whose context belongs to that (then-removed) document; Chromium's
 * `toBlob` never fires for such a canvas. Re-drawing the bitmap onto a
 * freshly created canvas re-binds it to a live context.
 */
function rebindToLiveDocument(source: HTMLCanvasElement): HTMLCanvasElement {
  const live = document.createElement('canvas')
  live.width = source.width
  live.height = source.height
  const ctx = live.getContext('2d')
  if (ctx) ctx.drawImage(source, 0, 0)
  return live
}

/** Encode a canvas to a PNG blob; rejects if the canvas is tainted or encoding fails. */
function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas could not be encoded to PNG.'))
    }, 'image/png')
  })
}

/** Trigger a browser download for `blob` and clean up the object URL afterwards. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * Export actions for the print page. See the module doc block for the
 * `[data-print-page]` contract, the @page ownership split and the
 * attribution behaviour.
 */
export function useExport(options: UseExportOptions = {}) {
  /** Shared busy flag — true while any PNG/PDF export is running; prevents double submits. */
  const exporting = ref(false)
  /** Message of the most recent failure, or `null` after a successful/clean run. */
  const error = ref<string | null>(null)

  /** The live doc slice: `doc` when provided, else the legacy v1 title bridge. */
  function resolveDoc(): ExportableDoc {
    const doc = options.doc === undefined ? null : toValue(options.doc)
    if (doc) return doc
    return { title: options.title?.() ?? '', pageSetup: LEGACY_PAGE_SETUP, usesArasaac: false, cells: [] }
  }

  /**
   * The attribution line travelling with the chart (decision 10): bundle
   * sets resolved through `resolveSetMeta` (unknown prefixes skipped),
   * ARASAAC appended last when the doc uses it. Reactive to the doc.
   */
  const attribution = computed(() => {
    const doc = resolveDoc()
    const metas: IconSetMeta[] = []
    for (const prefix of usedSetPrefixes(doc.cells)) {
      const meta = options.resolveSetMeta?.(prefix)
      if (meta) metas.push(meta)
    }
    return attributionLine(metas, doc.usesArasaac)
  })

  /**
   * Print via the browser. Physical size comes from the dynamically
   * injected `@page { size: … }` rule (page-presets declaration, injected
   * by the page-setup composable — see module doc block); the print
   * stylesheet shows only the `[data-print-page]` root. Intentionally no
   * DOM cloning and no injection here.
   */
  function printChart(): void {
    window.print()
  }

  /**
   * Rasterise the print page and download it as a PNG. An explicit `scale`
   * is honoured (v1 contract); without one the scale is derived so the
   * raster is true-page-size at {@link PNG_DENSITY_MULTIPLIER} density —
   * correct for every page preset regardless of on-screen zoom.
   */
  async function exportPng(scale?: number): Promise<boolean> {
    if (exporting.value) return false
    const doc = resolveDoc()
    const { widthMm } = pageDims(doc.pageSetup.preset, doc.pageSetup.orientation)
    const sheet = document.querySelector<HTMLElement>(PRINT_PAGE_SELECTOR)
    const pixelScale =
      scale !== undefined && Number.isFinite(scale) && scale > 0
        ? scale
        : pngCaptureScale(widthMm, sheet?.offsetWidth ?? 0)
    exporting.value = true
    error.value = null
    try {
      const capture = await captureSheet(pixelScale)
      if (capture.error) {
        error.value = capture.error.message
        return false
      }
      const blob = await canvasToPngBlob(capture.canvas)
      downloadBlob(blob, exportFilename(doc.title, 'png'))
      return true
    } catch (cause) {
      const failure: ExportError = {
        reason: 'encode-failed',
        message: 'Encoding the chart image to PNG failed.',
        cause,
      }
      error.value = failure.message
      return false
    } finally {
      exporting.value = false
    }
  }

  /**
   * Build a single-page PDF sized EXACTLY to the doc's page dims (mm), with
   * the white-composited capture fitted full-page and centred.
   */
  async function exportPdf(): Promise<boolean> {
    if (exporting.value) return false
    const doc = resolveDoc()
    const page = pdfPageConfig(doc.pageSetup)
    exporting.value = true
    error.value = null
    try {
      const capture = await captureSheet(PDF_CAPTURE_SCALE)
      if (capture.error) {
        error.value = capture.error.message
        return false
      }
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: page.orientation, unit: 'mm', format: page.format })
      // White-composited capture means JPEG encoding has no transparency artifacts.
      const image = capture.canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY)
      const fit = fitContain(capture.canvas.width, capture.canvas.height, page.format[0], page.format[1])
      pdf.addImage(image, 'JPEG', fit.x, fit.y, fit.width, fit.height)
      pdf.save(exportFilename(doc.title, 'pdf'))
      return true
    } catch (cause) {
      const failure: ExportError = {
        reason: 'encode-failed',
        message: 'Building the PDF failed.',
        cause,
      }
      error.value = failure.message
      return false
    } finally {
      exporting.value = false
    }
  }

  return { printChart, exportPng, exportPdf, exporting, error, attribution }
}
