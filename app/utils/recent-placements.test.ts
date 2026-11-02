/**
 * Recent-placement list behaviour: most recent first, duplicates collapse
 * onto their old slot at the front, and the row caps at eight entries.
 */

import { describe, expect, test } from 'vitest'
import { RECENT_PLACEMENTS_CAP, pushRecentPlacement } from './recent-placements'
import type { RecentPlacement } from './recent-placements'

const recent = (set: string, name: string, label = name): RecentPlacement => ({
  ref: { source: 'bundle', set, name },
  label,
})

describe('pushRecentPlacement', () => {
  test('prepends the newest placement', () => {
    const next = pushRecentPlacement([recent('openmoji', 'dog')], recent('openmoji', 'cat'))
    expect(next.map((entry) => entry.ref.name)).toEqual(['cat', 'dog'])
  })

  test('a repeat placement moves its pictogram back to the front without duplicating', () => {
    const list = [recent('openmoji', 'cat'), recent('openmoji', 'dog')]
    const next = pushRecentPlacement(list, recent('openmoji', 'dog'))
    expect(next.map((entry) => entry.ref.name)).toEqual(['dog', 'cat'])
  })

  test('same name in a different set counts as a different pictogram', () => {
    const list = [recent('openmoji', 'smile')]
    const next = pushRecentPlacement(list, recent('mdi', 'smile'))
    expect(next).toHaveLength(2)
  })

  test('the row never exceeds the cap', () => {
    let list: RecentPlacement[] = []
    for (let i = 0; i < RECENT_PLACEMENTS_CAP + 4; i += 1) {
      list = pushRecentPlacement(list, recent('openmoji', `icon-${i}`))
    }
    expect(list).toHaveLength(RECENT_PLACEMENTS_CAP)
    expect(list[0]?.ref.name).toBe(`icon-${RECENT_PLACEMENTS_CAP + 3}`)
  })

  test('the input list is never mutated', () => {
    const list = [recent('openmoji', 'dog')]
    pushRecentPlacement(list, recent('openmoji', 'cat'))
    expect(list.map((entry) => entry.ref.name)).toEqual(['dog'])
  })
})
