/**
 * Device-photo import for the inspector's add flow — the thin browser
 * wrapper around pure size math. Files re-encode to ≤512px WebP (JPEG
 * fallback) data URLs so uploads fit the localStorage budget (approved
 * decision #9); the canvas steps are DOM-bound and stay out of the pure
 * helpers, which carry the tests.
 */

export const UPLOAD_MAX_EDGE_PX = 512

/** Image MIME types the encoder accepts. */
const UPLOAD_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

/** True when the file is a picture the encoder can process. */
export function isUploadableImage(file: { type: string }): boolean {
  return (UPLOAD_ACCEPTED_TYPES as readonly string[]).includes(file.type)
}

/**
 * Largest w×h with both edges within `maxEdge`; never upscales, keeps ≥1px
 * edges, and rounds to whole pixels (canvas dimensions must be integers).
 */
export function scaledSize(
  width: number,
  height: number,
  maxEdge: number = UPLOAD_MAX_EDGE_PX,
): { width: number; height: number } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { width: 1, height: 1 }
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** "my_dog.jpg" → "my dog". Trim first so a stray space never defeats the extension strip. */
export function labelFromFileName(name: string): string {
  const base = name.trim().replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim()
  return base === '' ? 'My picture' : base
}

/** Discriminated encode outcome — failures land in state, never thrown. */
export type EncodeOutcome = { ok: true; dataUrl: string } | { ok: false; message: string }

/** Decode a File into an <img>; rejects quietly on undecodable bytes. */
function decodeFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('undecodable image'))
    }
    image.src = url
  })
}

/**
 * Re-encode an image file to a ≤512px data URL. Output prefers WebP at
 * quality 0.85; browsers without WebP export fall back to JPEG over a white
 * base (uploads are photos — transparency loss is the predictable trade).
 * Never throws; every failure returns a quiet, user-safe message.
 */
export async function encodeImageFile(file: File): Promise<EncodeOutcome> {
  if (!isUploadableImage(file)) {
    return { ok: false, message: 'Choose a PNG, JPEG, WebP or GIF image.' }
  }
  let image: HTMLImageElement
  try {
    image = await decodeFile(file)
  } catch {
    return { ok: false, message: "That file couldn't be read as an image." }
  }

  const { width, height } = scaledSize(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    return { ok: false, message: "This browser can't process images." }
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)

  const webp = canvas.toDataURL('image/webp', 0.85)
  const dataUrl = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85)
  return { ok: true, dataUrl }
}
