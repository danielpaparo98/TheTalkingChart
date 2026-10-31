/**
 * ARASAAC online pictogram provider composable.
 *
 * ARASAAC content is licensed CC BY-NC-SA 4.0 and is fetched at RUNTIME
 * only — nothing from this provider is bundled into the repo, and this
 * module has no load-time side effects (constants and functions only).
 *
 * All failure modes (offline/network, HTTP status, empty results) are
 * surfaced as typed state — no error ever escapes this composable — so
 * the icon browser can render a quiet inline Retry message.
 */

import { ref } from 'vue'

/** Exact attribution string required wherever ARASAAC content appears (browser, chart, exports). */
export const ARASAAC_ATTRIBUTION =
  'Pictograms by ARASAAC (https://arasaac.org), licensed CC BY-NC-SA 4.0'

/** Pixel sizes offered by the ARASAAC static image CDN. */
export type ArasaacImageSize = 300 | 500

/** A normalized ARASAAC pictogram, as consumed by the icon browser and chart slots. */
export interface ArasaacPictogram {
  /** Numeric pictogram id, stringified (persisted as `IconRef.name` when `source: 'arasaac'`). */
  id: string
  /** Best available keyword label — first usable keyword, falling back to the id itself. */
  label: string
  /** Category references normalized to strings (ARASAAC returns numeric category ids). */
  categories: string[]
}

/** Failure classes the UI distinguishes. `aborted` is internal: a newer search superseded the request. */
export type ArasaacErrorKind = 'network' | 'http' | 'empty' | 'aborted'

/** A typed, renderable failure — carried in state, never thrown. */
export interface ArasaacError {
  kind: ArasaacErrorKind
  /** Human-readable text, safe for a quiet inline error message. */
  message: string
}

/** Discriminated outcome of a single `search` call (mirrors the reactive state). */
export type ArasaacSearchOutcome =
  | { ok: true; pictograms: ArasaacPictogram[] }
  | { ok: false; kind: ArasaacErrorKind; message: string }

const ARASAAC_API_BASE = 'https://api.arasaac.org/api'
const ARASAAC_STATIC_BASE = 'https://static.arasaac.org/pictograms'

/** Digits-only sanitizer for pictogram ids (ids are numeric; guards the URL path). Returns `''` when nothing usable remains. */
function sanitizeId(id: string | number): string {
  return String(id).replace(/\D/g, '')
}

/** BCP-47-ish locale guard (`en`, `en-GB`, `zh`…); falls back to `'en'` for anything unexpected. */
function safeLocale(locale: string): string {
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(locale) ? locale : 'en'
}

/** True when the error is a request abortion (native fetch + AbortController). */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/** First non-empty keyword string in the API's `keywords` array (objects with a `keyword` field, or plain strings). */
function firstKeywordLabel(record: Record<string, unknown>): string | null {
  const keywords: unknown[] = Array.isArray(record.keywords) ? record.keywords : []
  for (const entry of keywords) {
    if (typeof entry === 'string' && entry.trim() !== '') return entry.trim()
    if (typeof entry === 'object' && entry !== null) {
      const value = (entry as Record<string, unknown>).keyword
      if (typeof value === 'string' && value.trim() !== '') return value.trim()
    }
  }
  return null
}

/** Category references normalized to strings, tolerating numbers, strings and junk. */
function categoryStrings(record: Record<string, unknown>): string[] {
  const categories: unknown[] = Array.isArray(record.categories) ? record.categories : []
  return categories
    .filter((c): c is string | number => typeof c === 'string' || typeof c === 'number')
    .map(String)
}

/** Defensive parser for the ARASAAC search payload — the API response is treated as unknown JSON. */
function parsePictograms(payload: unknown): ArasaacPictogram[] {
  const items: unknown[] = Array.isArray(payload) ? payload : []
  const out: ArasaacPictogram[] = []
  for (const raw of items) {
    if (typeof raw !== 'object' || raw === null) continue
    const record = raw as Record<string, unknown>
    const rawId = record._id
    if (typeof rawId !== 'number' && typeof rawId !== 'string') continue
    const id = sanitizeId(rawId)
    if (id === '') continue
    out.push({ id, label: firstKeywordLabel(record) ?? id, categories: categoryStrings(record) })
  }
  return out
}

/**
 * Static CDN PNG URL for a pictogram: `https://static.arasaac.org/pictograms/{id}/{id}_{size}.png`.
 * Returns `''` for an unusable id (callers should render nothing).
 */
export function pictogramImageUrl(id: string | number, size: ArasaacImageSize = 300): string {
  const safeId = sanitizeId(id)
  return safeId === '' ? '' : `${ARASAAC_STATIC_BASE}/${safeId}/${safeId}_${size}.png`
}

/**
 * Plain PNG variant served by the ARASAAC API: `https://api.arasaac.org/api/pictograms/{id}`.
 * Returns `''` for an unusable id.
 */
export function pictogramApiImageUrl(id: string | number): string {
  const safeId = sanitizeId(id)
  return safeId === '' ? '' : `${ARASAAC_API_BASE}/pictograms/${safeId}`
}

/**
 * Stateful-per-call handle on the ARASAAC online provider. Each invocation
 * returns fresh state; only the newest request may write to it (older
 * requests are aborted and their results discarded).
 */
export function useArasaac() {
  const results = ref<ArasaacPictogram[]>([])
  const loading = ref(false)
  const error = ref<ArasaacError | null>(null)
  // Only the newest request owns the shared state; superseded ones abort quietly.
  let inFlight: AbortController | null = null

  /**
   * Search ARASAAC pictograms by keyword. Never throws — the outcome is
   * returned as a discriminated union and mirrored onto `results`/`error`.
   */
  async function search(locale = 'en', keyword: string): Promise<ArasaacSearchOutcome> {
    const query = keyword.trim()

    // Supersede any in-flight request before touching shared state.
    if (inFlight !== null) {
      inFlight.abort()
      inFlight = null
    }

    // Guard: nothing to look up — clear state without a network round-trip.
    if (query === '') {
      results.value = []
      error.value = null
      loading.value = false
      return { ok: false, kind: 'empty', message: 'Enter a keyword to search ARASAAC pictograms.' }
    }

    const controller = new AbortController()
    inFlight = controller
    loading.value = true
    error.value = null

    const url = `${ARASAAC_API_BASE}/pictograms/${safeLocale(locale)}/search/${encodeURIComponent(query)}`

    try {
      const response = await fetch(url, { signal: controller.signal })

      // Non-200 (bad locale, rate limit, server error): typed HTTP failure, not thrown.
      if (!response.ok) {
        const failure: ArasaacError = {
          kind: 'http',
          message: `ARASAAC search failed (HTTP ${response.status}).`,
        }
        error.value = failure
        results.value = []
        return { ok: false, kind: failure.kind, message: failure.message }
      }

      const payload: unknown = await response.json()

      // A newer search took over while this response arrived — leave state to it.
      if (controller.signal.aborted) {
        return { ok: false, kind: 'aborted', message: 'Superseded by a newer search.' }
      }

      const pictograms = parsePictograms(payload)

      if (pictograms.length === 0) {
        const failure: ArasaacError = {
          kind: 'empty',
          message: `No pictograms found for "${query}".`,
        }
        error.value = failure
        results.value = []
        return { ok: false, kind: failure.kind, message: failure.message }
      }

      results.value = pictograms
      return { ok: true, pictograms }
    } catch (err) {
      // Aborted (or superseded mid-flight): never clobber the newer call's state.
      if (controller.signal.aborted || isAbortError(err)) {
        return { ok: false, kind: 'aborted', message: 'Superseded by a newer search.' }
      }
      // Any other throw from fetch()/json() is a transport-class failure (offline, DNS, bad JSON).
      const failure: ArasaacError = {
        kind: 'network',
        message: "Couldn't reach ARASAAC. Check your connection and try again.",
      }
      error.value = failure
      results.value = []
      return { ok: false, kind: failure.kind, message: failure.message }
    } finally {
      // Only the still-current request may clear the shared loading flag.
      if (inFlight === controller) {
        inFlight = null
        loading.value = false
      }
    }
  }

  return { results, loading, error, search, imageUrl: pictogramImageUrl }
}
