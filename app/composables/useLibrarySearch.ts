/**
 * Library search input logic (builder v2) — the debounced bridge between
 * the LibraryPanel's search box and the catalog store (which owns matching
 * and, for ARASAAC, the online fetch; the "ARASAAC fetch" is exercised
 * through the injected sink and mocked in tests).
 *
 * The composable takes its search sink as an explicit dependency (no direct
 * store import) so it stays pure-logic and unit-testable with fake timers:
 *  - `onInput` resets the 200ms debounce on every keystroke;
 *  - `flush` skips the debounce tail (Enter key) and can never double-fire;
 *  - `reset` clears the box and cancels any pending submit;
 *  - disposal (component unmount) cancels a pending submit.
 *
 * Also home to the shared display helpers for library tiles: humanizing a
 * bundle icon name and building the tiles' aria labels.
 */

import { getCurrentScope, onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'
import type { IconSearchEntry } from '../types/icons'

/** Keystroke → catalog.search delay (the store does no debouncing itself). */
export const SEARCH_DEBOUNCE_MS = 200

export interface LibrarySearchOptions {
  /** Where a settled query goes — normally `(q) => catalog.search(q)`. */
  search: (query: string) => void
  /** Debounce window; the 200ms interaction default per the design spec. */
  debounceMs?: number
}

export interface LibrarySearch {
  /** The box's text (as typed — the store trims when matching). */
  text: Ref<string>
  /** Call from the input's `@input`. */
  onInput: (value: string) => void
  /** Submit immediately (Enter key); no-op when nothing is pending. */
  flush: () => void
  /** Clear the box and cancel any pending submit. */
  reset: () => void
}

export function useLibrarySearch(options: LibrarySearchOptions): LibrarySearch {
  const debounceMs = options.debounceMs ?? SEARCH_DEBOUNCE_MS
  const text = ref('')
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancelPending(): void {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  function submit(): void {
    cancelPending()
    options.search(text.value)
  }

  function onInput(value: string): void {
    text.value = value
    cancelPending()
    timer = setTimeout(submit, debounceMs)
  }

  function flush(): void {
    // Enter with no pending tail would re-send the last query — skip it.
    if (timer === null) return
    submit()
  }

  function reset(): void {
    cancelPending()
    text.value = ''
  }

  if (getCurrentScope() !== null) {
    onScopeDispose(cancelPending)
  }

  return { text, onInput, flush, reset }
}

/**
 * Readable tile caption/label for a result row: bundle names lose their
 * dashes ("dog face"); ARASAAC rows carry their keyword label in `t`.
 */
export function libraryDisplayName(entry: IconSearchEntry, online: boolean): string {
  if (online) {
    const label = entry.t ?? ''
    return label !== '' ? label : entry.n
  }
  return entry.n.replaceAll('-', ' ')
}

/** Tiles announce their action, not their contents: "Add {label} picture". */
export function libraryTileAriaLabel(label: string): string {
  return `Add ${label} picture`
}
