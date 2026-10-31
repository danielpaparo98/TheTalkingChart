/**
 * Export composable — print / PNG / PDF for the chart sheet.
 *
 * Contract:
 * - The chart sheet root element carries `data-chart-sheet` (rendered by
 *   ChartSheet.vue). All capture targets are located via
 *   `document.querySelector('[data-chart-sheet]')`.
 * - `printChart()` relies entirely on the dedicated `@media print`
 *   stylesheet (print tasks), which hides all chrome and shows only the
 *   sheet at A4 landscape — no DOM cloning happens here.
 * - `html2canvas-pro` and `jspdf` are imported dynamically so they stay out
 *   of the initial bundle. html2canvas-pro (not classic html2canvas) is
 *   required because Tailwind v4 emits modern CSS color functions (oklch …)
 *   that it parses natively; captures stay plain — no `onclone` style
 *   stripping, so the snapshot matches the on-screen sheet exactly.
 *
 * Failures never escape as exceptions: every path reports through the
 * `error` ref (UI-facing string) with typed reasons on `ExportError` for
 * programmatic handling.
 */
import { ref } from 'vue'

/** DOM attribute marking the export/print root of the chart sheet. */
const SHEET_SELECTOR = '[data-chart-sheet]'

/** A4 landscape page size in millimetres (jsPDF `mm` unit). */
const PAGE_WIDTH_MM = 297
const PAGE_HEIGHT_MM = 210

/** Pixel scale used when rasterising the sheet for the PDF (PNG honours the caller's scale). */
const PDF_CAPTURE_SCALE = 2

/** JPEG encoder quality for the PDF image — near-print fidelity at a reasonable file size. */
const PDF_JPEG_QUALITY = 0.95

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

/** Options for {@link useExport}. */
export interface UseExportOptions {
  /**
   * Live chart title getter used to build export filenames
   * (`<title>-chart.png` / `<title>-chart.pdf`). Defaults to a generic name.
   */
  title?: () => string
}

/** Rectangle in millimetres for placing the image on the PDF page. */
interface FittedRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Largest rectangle that fits `contentW × contentH` inside `boxW × boxH`,
 * centred, aspect ratio preserved (CSS `object-fit: contain` maths).
 */
function fitContain(contentW: number, contentH: number, boxW: number, boxH: number): FittedRect {
  const scale = Math.min(boxW / contentW, boxH / contentH)
  const width = contentW * scale
  const height = contentH * scale
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height }
}

/**
 * Remove filesystem-invalid characters and collapse whitespace so a chart
 * title is safe as a download filename. Returns `''` for a blank title.
 */
function sanitizeTitle(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * Rasterise the chart sheet to a canvas via html2canvas-pro.
 * The capture is plain (no `onclone` mutation) and composited on white, so
 * JPEG encoding for the PDF has no transparent pixels to turn black.
 *
 * The library is imported at RUNTIME from `public/vendor/` (copied
 * untransformed by scripts/vendor-runtime-deps.mjs): the bundler-transformed
 * copy of html2canvas-pro 2.5.2 hangs indefinitely, while the raw dist file
 * captures in ~1.4s. The URL uses Nuxt's runtime `app.baseURL` — do NOT use
 * `import.meta.env.BASE_URL` here: in Nuxt that is Vite's build base
 * (`/…/assets/`), not the app's public path.
 */
async function captureSheet(scale: number): Promise<CaptureResult> {
  const sheet = document.querySelector<HTMLElement>(SHEET_SELECTOR)
  if (!sheet) {
    return {
      canvas: null,
      error: {
        reason: 'missing-sheet',
        message: `No chart sheet element (${SHEET_SELECTOR}) found in the document.`,
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
        message: `Rendering the chart sheet to an image failed (${detail}).`,
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

/**
 * Export actions for the chart sheet. See the module doc block for the
 * `data-chart-sheet` contract and print-stylesheet expectations.
 */
export function useExport(options: UseExportOptions = {}) {
  /** Shared busy flag — true while any PNG/PDF export is running; prevents double submits. */
  const exporting = ref(false)
  /** Message of the most recent failure, or `null` after a successful/clean run. */
  const error = ref<string | null>(null)

  /** Filename base for exports: sanitized chart title, or a generic fallback. */
  const fileBase = (): string => {
    const base = sanitizeTitle(options.title?.() ?? '')
    return base.length > 0 ? `${base}-chart` : 'chart'
  }

  /**
   * Print via the browser. The dedicated `@media print` stylesheet (built by
   * the print tasks) hides all chrome and shows only the sheet at A4
   * landscape — intentionally no DOM cloning here.
   */
  function printChart(): void {
    window.print()
  }

  /** Rasterise the sheet and download it as a PNG at `scale` device-pixel scale. */
  async function exportPng(scale = 2): Promise<boolean> {
    if (exporting.value) return false
    // Guard against 0/NaN/negative scales slipping in from callers.
    const pixelScale = Number.isFinite(scale) && scale > 0 ? scale : 2
    exporting.value = true
    error.value = null
    try {
      const capture = await captureSheet(pixelScale)
      if (capture.error) {
        error.value = capture.error.message
        return false
      }
      const blob = await canvasToPngBlob(capture.canvas)
      downloadBlob(blob, `${fileBase()}.png`)
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

  /** Build a single-page, landscape A4 PDF with the sheet image fitted full-page. */
  async function exportPdf(): Promise<boolean> {
    if (exporting.value) return false
    exporting.value = true
    error.value = null
    try {
      const capture = await captureSheet(PDF_CAPTURE_SCALE)
      if (capture.error) {
        error.value = capture.error.message
        return false
      }
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF('landscape', 'mm', [PAGE_WIDTH_MM, PAGE_HEIGHT_MM])
      // White-composited capture means JPEG encoding has no transparency artifacts.
      const image = capture.canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY)
      const fit = fitContain(
        capture.canvas.width,
        capture.canvas.height,
        PAGE_WIDTH_MM,
        PAGE_HEIGHT_MM,
      )
      doc.addImage(image, 'JPEG', fit.x, fit.y, fit.width, fit.height)
      doc.save(`${fileBase()}.pdf`)
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

  return { printChart, exportPng, exportPdf, exporting, error }
}
