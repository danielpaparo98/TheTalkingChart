/**
 * Upload pipeline for device photos → `cell.imageDataUrl` (design decision #9).
 *
 * A photo is read as a data URL, decoded, re-encoded on a canvas fitted to
 * ≤512px, and stored as a WebP/JPEG data URL. TWO guards run at import
 * time: the 512px edge re-encode and the {@link MAX_UPLOAD_DATA_URL_BYTES}
 * ceiling checked on the re-encoded result itself (a decorative 512px PNG
 * can still outgrow the budget) — failures return the friendly, user-safe
 * message for the caller to surface. The decision logic (accepted types,
 * dimension fit, mime choice, byte math, label derivation) lives in pure
 * exported functions covered by vitest; the FileReader/canvas steps are
 * thin no-throw wrappers that mirror the house "typed outcome, never
 * throws" contract.
 */

/** Image MIME types accepted — the ONE decision both upload panels share. */
export const UPLOAD_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

/** The same list as a DOM `accept` attribute value (joined once here). */
export const UPLOAD_ACCEPT_ATTRIBUTE = UPLOAD_ACCEPTED_TYPES.join(',')

/** True when the file is a picture this pipeline can process. */
export function isUploadableImage(file: { type: string }): boolean {
  return (UPLOAD_ACCEPTED_TYPES as readonly string[]).includes(file.type)
}

/** Longest allowed edge (px) after re-encode — the localStorage budget guard. */
export const MAX_UPLOAD_EDGE_PX = 512

/** Hard ceiling for a stored data URL (~150KB binary); bigger photos are rejected. */
export const MAX_UPLOAD_DATA_URL_BYTES = 200_000

/** Canvas encode quality — WebP and JPEG share it; visually clean at 512px. */
const ENCODE_QUALITY = 0.85

/** Output mime types the re-encode step can produce. */
export type UploadMime = 'image/webp' | 'image/jpeg'

/**
 * Scale a photo down so its longest edge fits `maxEdge`, preserving aspect
 * ratio. Never upscales; every result is ≥1px on each side. Invalid
 * dimensions (0, negative, NaN) collapse to 0×0 — callers treat that as
 * "cannot render".
 */
export function fitWithinBox(
  width: number,
  height: number,
  maxEdge: number = MAX_UPLOAD_EDGE_PX,
): { width: number; height: number } {
  const valid = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
  if (!valid) return { width: 0, height: 0 }
  if (maxEdge <= 0) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** WebP when the browser can encode it (keeps transparency); JPEG otherwise. */
export function pickOutputMime(webpSupported: boolean): UploadMime {
  return webpSupported ? 'image/webp' : 'image/jpeg'
}

/**
 * Derive the suggested card label from a filename: extension stripped,
 * `_`/`-` runs become spaces, surrounding whitespace trimmed. Falls back to
 * "photo" when nothing usable remains (dotfiles, `.jpg` alone, empty name).
 */
/**
 * Image extensions a real camera/scan would produce — used to tell
 * "extension-only name" (".jpg" → fall back to "photo") apart from a
 * dotfile whose single segment is the intended label (".hidden" stays).
 */
const KNOWN_IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif', 'bmp', 'tif', 'tiff',
])

/**
 * Human label from an upload's filename: separators become spaces,
 * whitespace trims, "photo" when nothing usable remains (dotfiles,
 * `.jpg` alone, empty name).
 */
export function suggestedLabelFromFilename(filename: string): string {
  const label = (stem: string): string => stem.replace(/[_-]+/g, ' ').trim()
  const trimmed = filename.trim()
  const stem = trimmed.replace(/\.[^.]+$/, '')
  if (stem !== '') return label(stem) === '' ? 'photo' : label(stem)
  // One dot-segment total: image extensions mean "there was no name";
  // anything else reads as an intentional dotfile label — keep it raw.
  const ext = trimmed.slice(1).toLowerCase()
  if (trimmed.startsWith('.') && !KNOWN_IMAGE_EXTENSIONS.has(ext)) return trimmed
  return 'photo'
}

/**
 * Approximate decoded byte size of a data URL. `;base64` payloads are
 * measured exactly (3 bytes per 4 chars minus padding); other payloads are
 * approximated by their character count. No comma separator → 0.
 */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return 0
  const payload = dataUrl.slice(comma + 1)
  if (!dataUrl.slice(0, comma).endsWith(';base64')) return payload.length
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
}

/** True when a re-encoded data URL would blow the per-image storage budget. */
export function exceedsBudget(dataUrl: string, limitBytes: number = MAX_UPLOAD_DATA_URL_BYTES): boolean {
  return dataUrlBytes(dataUrl) > limitBytes
}

// --- Thin browser wrappers (FileReader / Image / canvas) — no-throw ---

/** Typed outcome of the full pipeline; failures carry a human-readable message. */
export type UploadOutcome =
  | { ok: true; dataUrl: string; label: string }
  | { ok: false; message: string }

type StepOutcome<T> = { ok: true; value: T } | { ok: false; message: string }

function readFileAsDataUrl(file: File): Promise<StepOutcome<string>> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ ok: true, value: String(reader.result) })
    reader.onerror = () => resolve({ ok: false, message: "That file couldn't be read — try another photo." })
    reader.readAsDataURL(file)
  })
}

function decodeImage(dataUrl: string): Promise<StepOutcome<HTMLImageElement>> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ ok: true, value: image })
    image.onerror = () => resolve({ ok: false, message: "That photo couldn't be decoded — try a JPG or PNG." })
    image.src = dataUrl
  })
}

/** Draw the decoded photo onto a canvas fitted to ≤512px, white underneath (JPEG flattening must not be black). */
function renderScaled(image: HTMLImageElement): HTMLCanvasElement | null {
  const fitted = fitWithinBox(image.naturalWidth, image.naturalHeight)
  if (fitted.width === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = fitted.width
  canvas.height = fitted.height
  const context = canvas.getContext('2d')
  if (context === null) return null
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Encode with WebP first; browsers that cannot encode WebP silently fall
 * back to PNG in `toDataURL`, so the PNG result is swapped for a JPEG.
 */
function encodeCanvas(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', ENCODE_QUALITY)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', ENCODE_QUALITY)
}

/**
 * Full pipeline: file → re-encoded ≤512px WebP/JPEG data URL + suggested
 * label from the filename. Never throws; every failure is a typed message.
 */
export async function fileToImageDataUrl(file: File): Promise<UploadOutcome> {
  if (!isUploadableImage(file)) {
    return { ok: false, message: 'Choose a PNG, JPEG, WebP or GIF image.' }
  }
  const label = suggestedLabelFromFilename(file.name)
  const read = await readFileAsDataUrl(file)
  if (!read.ok) return read
  const decoded = await decodeImage(read.value)
  if (!decoded.ok) return decoded
  const canvas = renderScaled(decoded.value)
  if (canvas === null) {
    return { ok: false, message: "That photo couldn't be scaled — try another image." }
  }
  const dataUrl = encodeCanvas(canvas)
  if (exceedsBudget(dataUrl)) {
    return { ok: false, message: 'That photo is too large to store — try a smaller one.' }
  }
  return { ok: true, dataUrl, label }
}
