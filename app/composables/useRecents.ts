/**
 * Recents strip state (builder v2) — "recently used pictures" shown above
 * the library grid and the inspector's add-flow results.
 *
 * Deliberately NOT part of the chart document (no doc-model changes): the
 * strip is a module-level singleton composable persisted under its own tiny
 * localStorage key, so placements recorded anywhere in the builder (panel
 * click/keyboard path, page's drag-drop path) update every mounted strip
 * reactively.
 *
 * The stored payload is untrusted and re-validated on every read; blocked
 * or full storage silently degrades the strip to session-only (recents are
 * expendable — the chart itself is not).
 */

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { IconRef } from '../types/icons'

/** localStorage key — deliberately separate from the v2 doc key. */
export const RECENTS_STORAGE_KEY = 'talking-chart-recents-v1'

/** Strip length cap (design brief). */
export const MAX_RECENTS = 12

/** One recently placed picture: what the strip renders and re-drags. */
export interface RecentPick {
  icon: IconRef
  label: string
}

/** Persistence adapter — injectable so tests run without a DOM/storage. */
export interface RecentsStorage {
  read: () => string | null
  write: (value: string) => void
}

/** Identity of a pictogram — source, set and name (label is display-only). */
export function pictogramId(icon: IconRef): string {
  return `${icon.source}:${icon.set}:${icon.name}`
}

/** Identity of a pick (the pictogram key, not the label — renames don't fork entries). */
export function samePick(a: RecentPick, b: RecentPick): boolean {
  return pictogramId(a.icon) === pictogramId(b.icon)
}

/**
 * Move a pick to the front of the list, dropping any older duplicate, and
 * cap the list. Pure — returns a new array, never mutates.
 */
export function pushRecent(list: readonly RecentPick[], item: RecentPick): RecentPick[] {
  const rest = list.filter((existing) => !samePick(existing, item))
  return [item, ...rest].slice(0, MAX_RECENTS)
}

function parseIconRef(value: unknown): IconRef | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (record.source !== 'bundle' && record.source !== 'arasaac') return null
  if (typeof record.set !== 'string' || record.set === '') return null
  if (typeof record.name !== 'string' || record.name === '') return null
  return { source: record.source, set: record.set, name: record.name }
}

/**
 * Defensive parse of the stored JSON array — junk rows are skipped, valid
 * rows deduped and capped. Storage data is untrusted.
 */
export function parseRecents(raw: unknown): RecentPick[] {
  if (!Array.isArray(raw)) return []
  const out: RecentPick[] = []
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue
    const record = candidate as Record<string, unknown>
    const icon = parseIconRef(record.icon)
    if (icon === null) continue
    if (typeof record.label !== 'string' || record.label === '') continue
    const pick: RecentPick = { icon, label: record.label }
    if (!out.some((existing) => samePick(existing, pick))) out.push(pick)
    if (out.length >= MAX_RECENTS) break
  }
  return out
}

export interface RecentsStore {
  /** Newest first — what strips render. */
  items: Ref<RecentPick[]>
  /** Record a placement (idempotent per icon — duplicates move to front). */
  record: (item: RecentPick) => void
  /** Empty the strip (also clears storage). */
  clear: () => void
}

/**
 * Build a recents store over an injected persistence adapter. `null`
 * storage (server render, blocked localStorage) yields a session-only
 * store — never a crash.
 */
export function createRecentsStore(storage: RecentsStorage | null): RecentsStore {
  const items = ref<RecentPick[]>([])

  function hydrate(): void {
    if (storage === null) return
    const raw = storage.read()
    if (raw === null) return
    try {
      items.value = parseRecents(JSON.parse(raw) as unknown)
    } catch {
      items.value = []
    }
  }

  function persist(): void {
    if (storage === null) return
    try {
      storage.write(JSON.stringify(items.value))
    } catch {
      // Storage blocked or full — the strip degrades to session-only.
    }
  }

  hydrate()

  return {
    items,
    record: (item) => {
      items.value = pushRecent(items.value, item)
      persist()
    },
    clear: () => {
      items.value = []
      persist()
    },
  }
}

/** window.localStorage adapter; `null` whenever storage is unavailable. */
function localStorageAdapter(): RecentsStorage | null {
  if (typeof window === 'undefined') return null
  return {
    read: () => {
      try {
        return window.localStorage.getItem(RECENTS_STORAGE_KEY)
      } catch {
        return null
      }
    },
    write: (value) => {
      try {
        window.localStorage.setItem(RECENTS_STORAGE_KEY, value)
      } catch {
        // Storage blocked or full — recents are expendable.
      }
    },
  }
}

let shared: RecentsStore | null = null

/**
 * The app-wide recents singleton (module-level so every consumer — panel,
 * page drag-drop handler — records into the same list).
 */
export function useRecents(): RecentsStore {
  if (shared === null) {
    shared = createRecentsStore(localStorageAdapter())
  }
  return shared
}
