/**
 * Icon catalog store — the data source behind the icon browser panel.
 *
 * Responsibilities (architecture contract, context bundle lines 15-21 + 63):
 * - Registry: fetch `public/icon-data/sets.json` once (lazy init action) into
 *   a typed `IconSetMeta[]`, always including a synthetic online ARASAAC entry.
 * - Offline bundles: `selectSet(prefix)` lazy-fetches `{prefix}.json` and
 *   `{prefix}-index.json` on first use, registering the IconifyJSON bundle with
 *   `addCollection()` exactly once so `<Icon>` renders offline and never hits
 *   the Iconify API. Loaded sets are tracked and never refetched.
 * - Search: case-insensitive substring match on name (n) + keywords (t) over
 *   the active set's index, restricted to the selected category when one is
 *   set. Paged: first 200 results, `loadMore()` raises the cap by 200.
 * - ARASAAC: the pseudo-set never fetches bundle files; searches delegate to
 *   `useArasaac().search()` and the last keyword's results stay cached.
 *
 * All `public/` fetch URLs are built through `publicUrl()`, which prefixes
 * `useRuntimeConfig().app.baseURL` — the app deploys under
 * `/visual-communication-app/` and bare `/icon-data/...` paths would 404.
 *
 * No-throw contract (mirrors useArasaac): every failure lands in typed error
 * state — `setError` for registry/bundle/index loads, `arasaacError` for the
 * online provider. Nothing escapes as an exception.
 */

import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { addCollection } from '@iconify/vue'
import type { IconifyJSON } from '@iconify/vue'
import { useRuntimeConfig } from '#imports'
import { ARASAAC_ATTRIBUTION, useArasaac } from '../composables/useArasaac'
import type { ArasaacPictogram } from '../composables/useArasaac'
import type { IconIndex, IconRef, IconSearchEntry, IconSetMeta } from '../types/icons'

/** Prefix of the synthetic online set — also its `IconRef.set` value. */
export const ARASAAC_SET_PREFIX = 'arasaac'

/** Default active set — friendliest color pictograms first (contract). */
const DEFAULT_SET_PREFIX = 'openmoji'

/** Results shown per page; `loadMore()` raises the cap by this much. */
const SEARCH_PAGE_SIZE = 200

/** The synthetic online ARASAAC entry — always present in `sets`, never fetched from icon-data. */
const ARASAAC_SET_META: IconSetMeta = {
  prefix: ARASAAC_SET_PREFIX,
  label: 'ARASAAC',
  license: 'CC BY-NC-SA 4.0',
  attribution: ARASAAC_ATTRIBUTION,
  // Count is unknown up front (online provider) — the browser renders this
  // entry with an "online" note instead of a count.
  count: 0,
}

/** Failure classes the UI distinguishes for icon-data file loads. */
export type CatalogErrorKind = 'network' | 'http' | 'parse'

/** A typed, renderable failure — carried in state, never thrown. */
export interface CatalogError {
  kind: CatalogErrorKind
  /** Human-readable text, safe for a quiet inline error message. */
  message: string
}

type FetchOutcome = { ok: true; data: unknown } | { ok: false; kind: CatalogErrorKind; message: string }

/** True for plain JSON objects (payloads are untrusted network data). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// --- Defensive parsers (icon-data files are generated, but never trusted) ---

function toIconSetMeta(value: unknown): IconSetMeta | null {
  if (!isRecord(value)) return null
  if (typeof value.prefix !== 'string' || value.prefix === '') return null
  if (typeof value.label !== 'string' || typeof value.license !== 'string') return null
  if (typeof value.attribution !== 'string') return null
  if (typeof value.count !== 'number' || !Number.isFinite(value.count)) return null
  return {
    prefix: value.prefix,
    label: value.label,
    license: value.license,
    attribution: value.attribution,
    count: value.count,
  }
}

function toIconSearchEntry(value: unknown): IconSearchEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.n !== 'string' || value.n === '') return null
  const entry: IconSearchEntry = { n: value.n }
  if (typeof value.p === 'string' && value.p !== '') entry.p = value.p
  if (typeof value.c === 'string') entry.c = value.c
  if (typeof value.t === 'string') entry.t = value.t
  return entry
}

function toIconIndex(value: unknown): IconIndex | null {
  if (!isRecord(value)) return null
  if (typeof value.prefix !== 'string' || value.prefix === '') return null
  if (!Array.isArray(value.entries)) return null
  const entries = value.entries
    .map(toIconSearchEntry)
    .filter((entry): entry is IconSearchEntry => entry !== null)
  return { prefix: value.prefix, entries }
}

/**
 * Minimal structural guard before handing a payload to `addCollection` —
 * the bundle is the generated `icons.json`, so a `prefix` + `icons` map is
 * the whole contract. Deeper per-icon validation is not practical or needed.
 */
function toIconifyBundle(value: unknown): IconifyJSON | null {
  if (!isRecord(value)) return null
  if (typeof value.prefix !== 'string' || value.prefix === '') return null
  if (!isRecord(value.icons)) return null
  return value as unknown as IconifyJSON
}

function parseRegistry(payload: unknown): IconSetMeta[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.sets)) return null
  const sets: IconSetMeta[] = []
  const seen = new Set<string>()
  for (const raw of payload.sets) {
    const meta = toIconSetMeta(raw)
    if (meta === null || seen.has(meta.prefix)) continue
    seen.add(meta.prefix)
    sets.push(meta)
  }
  return sets
}

/** Registry order first, synthetic ARASAAC entry last (set switcher order). */
function withArasaacSet(registry: IconSetMeta[]): IconSetMeta[] {
  return [...registry.filter((meta) => meta.prefix !== ARASAAC_SET_PREFIX), ARASAAC_SET_META]
}

// --- URL building (every public/ fetch must be baseURL-prefixed) ---

function publicUrl(file: string): string {
  const base = useRuntimeConfig().app.baseURL
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}icon-data/${file}`
}

/** Fetch + parse a JSON file into a typed outcome — never throws. */
async function fetchJson(url: string, what: string): Promise<FetchOutcome> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    return {
      ok: false,
      kind: 'network',
      message: `Couldn't load ${what}. Check your connection and try again.`,
    }
  }
  if (!response.ok) {
    return { ok: false, kind: 'http', message: `Couldn't load ${what} (HTTP ${response.status}).` }
  }
  try {
    return { ok: true, data: (await response.json()) as unknown }
  } catch {
    return { ok: false, kind: 'parse', message: `${what} is malformed.` }
  }
}

/**
 * Case-insensitive substring match over index entries, restricted to the
 * selected category when one is set. Alias rows (entries with `p`) collapse
 * onto their parent icon so a parent and its aliases never appear twice;
 * whichever row survives is a name the registered bundle can render, because
 * IconifyJSON bundles ship both `icons` and `aliases`.
 */
function matchEntries(
  entries: readonly IconSearchEntry[],
  query: string,
  categoryFilter: string | null,
): IconSearchEntry[] {
  const needle = query.trim().toLowerCase()
  const out: IconSearchEntry[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    if (categoryFilter !== null && (entry.c ?? '') !== categoryFilter) continue
    if (needle !== '') {
      const inName = entry.n.toLowerCase().includes(needle)
      const inTags = (entry.t ?? '').toLowerCase().includes(needle)
      if (!inName && !inTags) continue
    }
    const renderKey = entry.p ?? entry.n
    if (seen.has(renderKey)) continue
    seen.add(renderKey)
    out.push(entry)
  }
  return out
}

export const useCatalogStore = defineStore('catalog', () => {
  const arasaac = useArasaac()

  // --- State ---
  /** Registry rows, always including the synthetic online ARASAAC entry. */
  const sets = ref<IconSetMeta[]>([ARASAAC_SET_META])
  const activeSetPrefix = ref<string>(DEFAULT_SET_PREFIX)
  /** Prefixes whose bundle has been registered with `addCollection` (never refetched). */
  const setBundleLoaded = shallowRef<ReadonlySet<string>>(new Set<string>())
  /** Loaded search indexes per prefix (shallow — indexes are large, read-only). */
  const indices = shallowRef<ReadonlyMap<string, IconIndex>>(new Map<string, IconIndex>())
  /** Current search text (raw, as typed — matching trims internally). */
  const query = ref('')
  /** Selected category for the active set; `null` = no restriction. */
  const categoryFilter = ref<string | null>(null)
  /** Prefix whose files are currently being fetched; `null` = idle. */
  const loadingSet = ref<string | null>(null)
  /** Typed failure of the last registry/bundle/index load; `null` = healthy. */
  const setError = ref<CatalogError | null>(null)
  /** Last keyword handed to the ARASAAC provider (for the Retry affordance). */
  const arasaacQuery = ref('')

  /** Page cap over the active match list; reset by `search`/`selectSet`. Reactive — slicing depends on it. */
  const visibleCount = ref(SEARCH_PAGE_SIZE)

  // --- Lazy init (registry) ---

  let setsPromise: Promise<void> | null = null

  /**
   * Fetch `sets.json` exactly once; subsequent calls reuse the in-flight or
   * completed load. On failure the cached promise is dropped so a later call
   * (the browser's Retry button) re-attempts. Never throws.
   */
  function ensureSets(): Promise<void> {
    if (setsPromise === null) {
      setsPromise = loadSets()
    }
    return setsPromise
  }

  async function loadSets(): Promise<void> {
    const outcome = await fetchJson(publicUrl('sets.json'), 'the icon set registry')
    if (!outcome.ok) {
      setError.value = { kind: outcome.kind, message: outcome.message }
      setsPromise = null
      return
    }
    const registry = parseRegistry(outcome.data)
    if (registry === null) {
      setError.value = { kind: 'parse', message: 'The icon set registry is malformed.' }
      setsPromise = null
      return
    }
    sets.value = withArasaacSet(registry)
  }

  // --- Set loading (bundle + index, exactly-once registration) ---

  const pendingLoads = new Map<string, Promise<boolean>>()

  /**
   * Ensure the bundle is registered and the index is loaded for a set.
   * Concurrent calls coalesce; completed parts are never refetched.
   * Resolves `true` only when both parts are ready — never throws.
   */
  function ensureSetLoaded(prefix: string): Promise<boolean> {
    const inFlight = pendingLoads.get(prefix)
    if (inFlight !== undefined) return inFlight
    if (setBundleLoaded.value.has(prefix) && indices.value.has(prefix)) return Promise.resolve(true)
    const task = loadSet(prefix).finally(() => {
      pendingLoads.delete(prefix)
    })
    pendingLoads.set(prefix, task)
    return task
  }

  async function loadSet(prefix: string): Promise<boolean> {
    loadingSet.value = prefix
    try {
      const needsBundle = !setBundleLoaded.value.has(prefix)
      const needsIndex = !indices.value.has(prefix)
      if (!needsBundle && !needsIndex) return true

      const [bundleOutcome, indexOutcome] = await Promise.all([
        needsBundle ? fetchJson(publicUrl(`${prefix}.json`), `the "${prefix}" icon bundle`) : null,
        needsIndex ? fetchJson(publicUrl(`${prefix}-index.json`), `the "${prefix}" search index`) : null,
      ])

      if (bundleOutcome !== null && !bundleOutcome.ok) {
        setError.value = { kind: bundleOutcome.kind, message: bundleOutcome.message }
        return false
      }
      if (indexOutcome !== null && !indexOutcome.ok) {
        setError.value = { kind: indexOutcome.kind, message: indexOutcome.message }
        return false
      }

      if (bundleOutcome !== null) {
        const bundle = toIconifyBundle(bundleOutcome.data)
        if (bundle === null || bundle.prefix !== prefix) {
          setError.value = { kind: 'parse', message: `The "${prefix}" icon bundle is malformed.` }
          return false
        }
        // Exactly-once registration — after this, <Icon prefix:name> renders
        // offline and the Iconify API is never consulted.
        try {
          addCollection(bundle)
        } catch {
          setError.value = { kind: 'parse', message: `The "${prefix}" icon bundle could not be registered.` }
          return false
        }
        const nextLoaded = new Set(setBundleLoaded.value)
        nextLoaded.add(prefix)
        setBundleLoaded.value = nextLoaded
      }

      if (indexOutcome !== null) {
        const index = toIconIndex(indexOutcome.data)
        if (index === null || index.prefix !== prefix) {
          setError.value = { kind: 'parse', message: `The "${prefix}" search index is malformed.` }
          return false
        }
        indices.value = new Map(indices.value).set(prefix, index)
      }

      setError.value = null
      return true
    } finally {
      if (loadingSet.value === prefix) loadingSet.value = null
    }
  }

  // --- ARASAAC passthrough (no bundle files; searches go online) ---

  /**
   * Keyword search against the ARASAAC API via `useArasaac`. Results stay
   * cached in the store until the next search. Never throws — the composable
   * mirrors every outcome onto its refs.
   */
  async function searchArasaac(keyword: string, locale = 'en'): Promise<void> {
    const trimmed = keyword.trim()
    arasaacQuery.value = trimmed
    if (trimmed === '') {
      // Clearing the box should empty the grid, not raise an error.
      arasaac.results.value = []
      arasaac.error.value = null
      arasaac.loading.value = false
      return
    }
    await arasaac.search(locale, trimmed)
  }

  // --- Actions ---

  /**
   * Switch the active set. Bundle sets lazy-load their files on first use;
   * ARASAAC only flips the selection (its data arrives via search). The
   * current query stays — results recompute against the new set; the
   * category filter resets (categories are per-set). Never throws.
   */
  async function selectSet(prefix: string): Promise<void> {
    activeSetPrefix.value = prefix
    categoryFilter.value = null
    visibleCount.value = SEARCH_PAGE_SIZE
    if (prefix === ARASAAC_SET_PREFIX) {
      setError.value = null
      return
    }
    await ensureSetLoaded(prefix)
  }

  /**
   * Set the search text. Bundle sets match reactively over the active index;
   * the ARASAAC pseudo-set delegates the keyword to the online provider.
   * Debouncing is the caller's job (the search input owns it).
   */
  function search(nextQuery: string): void {
    query.value = nextQuery
    visibleCount.value = SEARCH_PAGE_SIZE
    if (activeSetPrefix.value === ARASAAC_SET_PREFIX) {
      void searchArasaac(nextQuery)
    }
  }

  /** Show the next page of results. */
  function loadMore(): void {
    visibleCount.value += SEARCH_PAGE_SIZE
  }

  /**
   * Build the persisted icon reference for a result row: bundle icons use
   * their (alias-resolvable) Iconify name; ARASAAC rows carry the numeric
   * pictogram id as `n` (see IconRef contract).
   */
  function refFor(entry: IconSearchEntry): IconRef {
    if (activeSetPrefix.value === ARASAAC_SET_PREFIX) {
      return { source: 'arasaac', set: ARASAAC_SET_PREFIX, name: entry.n }
    }
    return { source: 'bundle', set: activeSetPrefix.value, name: entry.n }
  }

  // --- Derived ---

  const activeSet = computed<IconSetMeta | null>(
    () => sets.value.find((meta) => meta.prefix === activeSetPrefix.value) ?? null,
  )
  const activeSetIsOnline = computed(() => activeSetPrefix.value === ARASAAC_SET_PREFIX)
  const activeIndex = computed<IconIndex | null>(() => indices.value.get(activeSetPrefix.value) ?? null)

  /** Unique sorted categories of the active set; ARASAAC has none (online). */
  const categories = computed<string[]>(() => {
    const index = activeIndex.value
    if (index === null) return []
    const unique = new Set<string>()
    for (const entry of index.entries) {
      const category = entry.c ?? ''
      if (category !== '') unique.add(category)
    }
    return [...unique].sort((a, b) => a.localeCompare(b))
  })

  /** ARASAAC pictograms normalized into search-entry rows: `n` = pictogram id (per IconRef), `t` = display label. */
  const arasaacRows = computed<IconSearchEntry[]>(() =>
    arasaac.results.value.map((pictogram: ArasaacPictogram) => ({
      n: pictogram.id,
      t: pictogram.label,
      c: pictogram.categories[0] ?? '',
    })),
  )

  /** Full match list for the active set (uncapped). */
  const matches = computed<IconSearchEntry[]>(() => {
    if (activeSetPrefix.value === ARASAAC_SET_PREFIX) {
      const filter = categoryFilter.value
      return filter === null
        ? arasaacRows.value
        : arasaacRows.value.filter((entry) => (entry.c ?? '') === filter)
    }
    const index = activeIndex.value
    if (index === null) return []
    return matchEntries(index.entries, query.value, categoryFilter.value)
  })

  /** First `visibleCount` matches — what the browser grid renders. */
  const results = computed<IconSearchEntry[]>(() => matches.value.slice(0, visibleCount.value))
  const matchCount = computed(() => matches.value.length)
  const hasMore = computed(() => matchCount.value > visibleCount.value)

  return {
    // state
    sets,
    activeSetPrefix,
    setBundleLoaded,
    indices,
    query,
    categoryFilter,
    loadingSet,
    setError,
    arasaacQuery,
    arasaacResults: arasaac.results,
    arasaacLoading: arasaac.loading,
    arasaacError: arasaac.error,
    // derived
    activeSet,
    activeSetIsOnline,
    activeIndex,
    categories,
    results,
    matchCount,
    hasMore,
    // actions
    ensureSets,
    selectSet,
    search,
    searchArasaac,
    loadMore,
    refFor,
  }
})
