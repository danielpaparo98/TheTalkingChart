/**
 * useRecents unit tests — pure list behaviour and the persistence adapter
 * contract (no DOM, no localStorage): record/dedupe/cap, clear, hydrate
 * from stored JSON (including junk), and graceful degradation without
 * storage.
 */

import { describe, expect, test, vi } from 'vitest'

import {
  MAX_RECENTS,
  RECENTS_STORAGE_KEY,
  createRecentsStore,
  parseRecents,
  pictogramId,
  pushRecent,
  samePick,
} from './useRecents'
import type { RecentPick, RecentsStorage } from './useRecents'

const pick = (name: string, label = name): RecentPick => ({
  icon: { source: 'bundle', set: 'openmoji', name },
  label,
})

/** In-memory storage stub recording writes for assertions. */
function memoryStorage(initial: string | null = null): RecentsStorage & { writes: string[] } {
  let value = initial
  const writes: string[] = []
  return {
    read: () => value,
    write: (next: string) => {
      value = next
      writes.push(next)
    },
    writes,
  }
}

describe('pushRecent (pure list)', () => {
  test('prepends a new pick', () => {
    expect(pushRecent([pick('a')], pick('b')).map((item) => item.icon.name)).toEqual(['b', 'a'])
  })

  test('moves an existing duplicate to the front instead of duplicating', () => {
    const list = [pick('a'), pick('b'), pick('c')]
    expect(pushRecent(list, pick('b')).map((item) => item.icon.name)).toEqual(['b', 'a', 'c'])
  })

  test('caps the list at 12, newest first', () => {
    let list: RecentPick[] = []
    for (let n = 0; n < MAX_RECENTS + 3; n += 1) list = pushRecent(list, pick(`icon-${n}`))
    expect(list).toHaveLength(MAX_RECENTS)
    expect(list[0]?.icon.name).toBe(`icon-${MAX_RECENTS + 2}`)
    expect(list[MAX_RECENTS - 1]?.icon.name).toBe('icon-3')
  })

  test('identity ignores the label (renames do not fork entries)', () => {
    expect(samePick(pick('dog', 'dog'), pick('dog', 'puppy'))).toBe(true)
    expect(samePick(pick('dog'), pick('cat'))).toBe(false)
  })

  test('pictogramId is the shared strip key (source included — no :key collisions)', () => {
    expect(pictogramId({ source: 'bundle', set: 'openmoji', name: 'dog' })).toBe('bundle:openmoji:dog')
    expect(pictogramId(pick('dog').icon)).toBe('bundle:openmoji:dog')
    // Cross-source same set:name stay distinct picks and unique keys.
    expect(
      samePick(
        { icon: { source: 'bundle', set: 's', name: 'n' }, label: 'x' },
        { icon: { source: 'arasaac', set: 's', name: 'n' }, label: 'y' },
      ),
    ).toBe(false)
  })

  test('never mutates the input list', () => {
    const list = [pick('a')]
    pushRecent(list, pick('b'))
    expect(list.map((item) => item.icon.name)).toEqual(['a'])
  })
})

describe('parseRecents (stored data is untrusted)', () => {
  test('parses a valid stored array', () => {
    const raw = [{ icon: { source: 'bundle', set: 'openmoji', name: 'dog-face' }, label: 'dog face' }]
    expect(parseRecents(raw)).toEqual([pick('dog-face', 'dog face')])
  })

  test('skips junk rows and keeps valid neighbours', () => {
    const raw = [
      null,
      'nope',
      { icon: 'junk', label: 'x' },
      { icon: { source: 'bundle', set: '', name: 'y' }, label: 'x' },
      { icon: { source: 'bundle', set: 'openmoji', name: 'ok' }, label: '' },
      { icon: { source: 'bundle', set: 'openmoji', name: 'good' }, label: 'good' },
    ]
    expect(parseRecents(raw)).toEqual([pick('good')])
  })

  test('rejects non-arrays and dedupes repeats', () => {
    expect(parseRecents({})).toEqual([])
    expect(parseRecents([pick('a'), pick('a', 'again')])).toEqual([pick('a')])
  })

  test('caps restored rows at 12', () => {
    const raw = Array.from({ length: 30 }, (_, n) => ({ icon: { source: 'bundle', set: 'openmoji', name: `i${n}` }, label: `i${n}` }))
    expect(parseRecents(raw)).toHaveLength(MAX_RECENTS)
  })
})

describe('createRecentsStore', () => {
  test('record prepends, persists JSON, and clear empties + persists', () => {
    const storage = memoryStorage()
    const store = createRecentsStore(storage)

    store.record(pick('a'))
    store.record(pick('b'))
    expect(store.items.value.map((item) => item.icon.name)).toEqual(['b', 'a'])
    expect(storage.writes).toEqual([
      JSON.stringify([pick('a')]),
      JSON.stringify([pick('b'), pick('a')]),
    ])

    store.clear()
    expect(store.items.value).toEqual([])
    expect(storage.writes.at(-1)).toBe('[]')
  })

  test('record is idempotent per icon — duplicates move to front', () => {
    const store = createRecentsStore(memoryStorage())
    store.record(pick('a'))
    store.record(pick('b'))
    store.record(pick('a'))
    expect(store.items.value.map((item) => item.icon.name)).toEqual(['a', 'b'])
  })

  test('hydrates from stored JSON on construction', () => {
    const stored = JSON.stringify([pick('kept')])
    const store = createRecentsStore(memoryStorage(stored))
    expect(store.items.value).toEqual([pick('kept')])
  })

  test('corrupt stored JSON starts empty', () => {
    const store = createRecentsStore(memoryStorage('{not json'))
    expect(store.items.value).toEqual([])
  })

  test('non-array stored JSON starts empty', () => {
    const store = createRecentsStore(memoryStorage('{"icon":"junk"}'))
    expect(store.items.value).toEqual([])
  })

  test('null storage degrades to session-only without throwing', () => {
    const store = createRecentsStore(null)
    store.record(pick('a'))
    expect(store.items.value).toEqual([pick('a')])
    expect(() => store.clear()).not.toThrow()
  })

  test('a throwing write never breaks record', () => {
    const store = createRecentsStore({
      read: () => null,
      write: () => {
        throw new Error('QuotaExceededError')
      },
    })
    expect(() => store.record(pick('a'))).not.toThrow()
    expect(store.items.value).toEqual([pick('a')])
  })
})

describe('storage key contract', () => {
  test('uses the dedicated tiny key, separate from the v2 doc key', () => {
    expect(RECENTS_STORAGE_KEY).toBe('talking-chart-recents-v1')
  })
})

describe('vi spy integration', () => {
  test('writes are observable (house test style)', () => {
    const write = vi.fn()
    const store = createRecentsStore({ read: () => null, write })
    store.record(pick('a'))
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(JSON.stringify([pick('a')]))
  })
})
