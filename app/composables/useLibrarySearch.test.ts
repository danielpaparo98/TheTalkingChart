/**
 * useLibrarySearch unit tests — debounce behaviour with fake timers against
 * a mocked search sink (standing in for the catalog store / ARASAAC fetch),
 * plus the shared display helpers. Runs inside an effectScope to verify
 * disposal cancels pending submits.
 */

import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  SEARCH_DEBOUNCE_MS,
  libraryDisplayName,
  libraryTileAriaLabel,
  useLibrarySearch,
} from './useLibrarySearch'
import type { LibrarySearch } from './useLibrarySearch'

/** Build the composable inside an effect scope so onScopeDispose wires up. */
function build(search: (query: string) => void, debounceMs?: number): LibrarySearch {
  let instance!: LibrarySearch
  const scope = effectScope()
  scope.run(() => {
    instance = useLibrarySearch({ search, debounceMs })
  })
  return instance
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('debounced submit', () => {
  test('waits the 200ms window before calling the sink', () => {
    const search = vi.fn()
    const lib = build(search)
    lib.onInput('dog')
    expect(search).not.toHaveBeenCalled()
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
    expect(search).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(search).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledWith('dog')
  })

  test('rapid keystrokes collapse into one call with the latest text', () => {
    const search = vi.fn()
    const lib = build(search)
    lib.onInput('d')
    vi.advanceTimersByTime(100)
    lib.onInput('do')
    vi.advanceTimersByTime(100)
    lib.onInput('dog')
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    expect(search).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledWith('dog')
  })

  test('resets keep the window anchored to the last keystroke', () => {
    const search = vi.fn()
    const lib = build(search)
    lib.onInput('a')
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
    lib.onInput('ab')
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
    expect(search).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(search).toHaveBeenCalledWith('ab')
  })

  test('uses the custom debounce window when given', () => {
    const search = vi.fn()
    const lib = build(search, 500)
    lib.onInput('x')
    vi.advanceTimersByTime(200)
    expect(search).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(search).toHaveBeenCalledWith('x')
  })
})

describe('flush (Enter key)', () => {
  test('submits immediately, skipping the tail', () => {
    const search = vi.fn()
    const lib = build(search)
    lib.onInput('dog')
    lib.flush()
    expect(search).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledWith('dog')
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    expect(search).toHaveBeenCalledTimes(1)
  })

  test('no-ops when nothing is pending (no double-send)', () => {
    const search = vi.fn()
    const lib = build(search)
    lib.onInput('dog')
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    expect(search).toHaveBeenCalledTimes(1)
    lib.flush()
    expect(search).toHaveBeenCalledTimes(1)
  })

  test('sends whatever text is in the box, even before the window elapses', () => {
    const search = vi.fn()
    const lib = build(search)
    lib.onInput('snack')
    vi.advanceTimersByTime(50)
    lib.flush()
    expect(search).toHaveBeenCalledWith('snack')
  })
})

describe('reset', () => {
  test('clears the text and cancels the pending submit', () => {
    const search = vi.fn()
    const lib = build(search)
    lib.onInput('dog')
    lib.reset()
    expect(lib.text.value).toBe('')
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    expect(search).not.toHaveBeenCalled()
  })
})

describe('disposal', () => {
  test('stopping the scope cancels a pending submit', () => {
    const search = vi.fn()
    let lib!: LibrarySearch
    const scope = effectScope()
    scope.run(() => {
      lib = useLibrarySearch({ search })
    })
    lib.onInput('dog')
    scope.stop()
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    expect(search).not.toHaveBeenCalled()
  })
})

describe('libraryDisplayName', () => {
  test('humanizes bundle icon names (dashes → spaces)', () => {
    expect(libraryDisplayName({ n: 'dog-face' }, false)).toBe('dog face')
    expect(libraryDisplayName({ n: 'potable-water' }, false)).toBe('potable water')
  })

  test('prefers the ARASAAC keyword label, falling back to the id', () => {
    expect(libraryDisplayName({ n: '12345', t: 'water' }, true)).toBe('water')
    expect(libraryDisplayName({ n: '12345' }, true)).toBe('12345')
  })

  test('bundle rows ignore the tag field', () => {
    expect(libraryDisplayName({ n: 'sun', t: 'sunshine weather' }, false)).toBe('sun')
  })
})

describe('libraryTileAriaLabel', () => {
  test('announces the action per the a11y spec', () => {
    expect(libraryTileAriaLabel('dog face')).toBe('Add dog face picture')
  })
})
