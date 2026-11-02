/**
 * usePageSetup unit tests — the pure parts only (no DOM environment, no new
 * dependencies):
 * - derived values (dims, aspect ratio, margin mm) for every setup
 * - the @page rule string for all 8 preset × orientation combos
 * - reactive derivation from ref/getter sources
 * - the managed style-tag adapter exercised against a fake store
 * - the reference-counted tag lifecycle (singleton safety across mounts)
 */

import { ref } from 'vue'
import { describe, expect, test } from 'vitest'

import type { MarginPreset, Orientation, PagePresetId, PageSetup } from '../types/chart'
import {
  applyPageRule,
  clearPageRule,
  createPageRuleLifecycle,
  pageRuleText,
  usePageSetup,
} from './usePageSetup'
import type { PageRuleStore, PageStyleElement } from './usePageSetup'

/** The 8 approved paper setups: exact portrait mm from decision #3, landscape swapped. */
const SHEET_CASES: Array<{
  preset: PagePresetId
  orientation: Orientation
  widthMm: number
  heightMm: number
}> = [
  { preset: 'a4', orientation: 'portrait', widthMm: 210, heightMm: 297 },
  { preset: 'a4', orientation: 'landscape', widthMm: 297, heightMm: 210 },
  { preset: 'letter', orientation: 'portrait', widthMm: 215.9, heightMm: 279.4 },
  { preset: 'letter', orientation: 'landscape', widthMm: 279.4, heightMm: 215.9 },
  { preset: 'a5', orientation: 'portrait', widthMm: 148, heightMm: 210 },
  { preset: 'a5', orientation: 'landscape', widthMm: 210, heightMm: 148 },
  { preset: 'a3', orientation: 'portrait', widthMm: 297, heightMm: 420 },
  { preset: 'a3', orientation: 'landscape', widthMm: 420, heightMm: 297 },
]

/** In-memory stand-in for the document-backed store: tracks creation and removal. */
function fakeStore() {
  type FakeElement = PageStyleElement & { removed: boolean }
  let live: FakeElement | null = null
  const created: FakeElement[] = []
  const store: PageRuleStore = {
    // A removed element is detached from the document — no longer findable.
    get: () => (live && !live.removed ? live : null),
    create: () => {
      const el: FakeElement = {
        id: '',
        textContent: '',
        removed: false,
        remove: () => {
          el.removed = true
        },
      }
      live = el
      created.push(el)
      return el
    },
  }
  return { store, created, live: () => live }
}

describe('pageRuleText', () => {
  test('builds the @page rule for all 8 preset × orientation combos', () => {
    for (const c of SHEET_CASES) {
      const setup: PageSetup = { preset: c.preset, orientation: c.orientation, marginPreset: 'normal' }
      expect(pageRuleText(setup)).toBe(`@page { size: ${c.widthMm}mm ${c.heightMm}mm; margin: 0 }`)
    }
  })

  test('page margin stays 0 whatever the doc margin preset (sheet padding owns margins)', () => {
    const base = { preset: 'a4', orientation: 'portrait' } as const
    const narrow = pageRuleText({ ...base, marginPreset: 'narrow' })
    expect(narrow).toBe('@page { size: 210mm 297mm; margin: 0 }')
    expect(pageRuleText({ ...base, marginPreset: 'normal' })).toBe(narrow)
    expect(pageRuleText({ ...base, marginPreset: 'wide' })).toBe(narrow)
  })
})

describe('usePageSetup derivations', () => {
  test('derives dims, aspect ratio and rule for every combo from a plain setup', () => {
    for (const c of SHEET_CASES) {
      const setup: PageSetup = { preset: c.preset, orientation: c.orientation, marginPreset: 'normal' }
      const page = usePageSetup({ setup })
      expect(page.dimsMm.value).toEqual({ widthMm: c.widthMm, heightMm: c.heightMm })
      expect(page.aspectRatio.value).toBeCloseTo(c.widthMm / c.heightMm, 10)
      expect(page.pageRule.value).toBe(`@page { size: ${c.widthMm}mm ${c.heightMm}mm; margin: 0 }`)
    }
  })

  test('margin mm follows the doc margin preset', () => {
    const setupFor = (marginPreset: MarginPreset): PageSetup => ({
      preset: 'a3',
      orientation: 'portrait',
      marginPreset,
    })
    expect(usePageSetup({ setup: setupFor('narrow') }).marginMm.value).toBe(8)
    expect(usePageSetup({ setup: setupFor('normal') }).marginMm.value).toBe(12)
    expect(usePageSetup({ setup: setupFor('wide') }).marginMm.value).toBe(20)
  })

  test('derived values react to setup changes through a ref source', () => {
    const setup = ref<PageSetup>({ preset: 'a4', orientation: 'portrait', marginPreset: 'normal' })
    const page = usePageSetup({ setup })

    expect(page.dimsMm.value).toEqual({ widthMm: 210, heightMm: 297 })
    expect(page.aspectRatio.value).toBeLessThan(1)
    expect(page.marginMm.value).toBe(12)

    setup.value = { preset: 'a5', orientation: 'landscape', marginPreset: 'wide' }

    expect(page.dimsMm.value).toEqual({ widthMm: 210, heightMm: 148 })
    expect(page.aspectRatio.value).toBeCloseTo(210 / 148, 10)
    expect(page.aspectRatio.value).toBeGreaterThan(1)
    expect(page.marginMm.value).toBe(20)
    expect(page.pageRule.value).toBe('@page { size: 210mm 148mm; margin: 0 }')
  })

  test('accepts a plain getter as the reactive source', () => {
    const setup = ref<PageSetup>({ preset: 'a3', orientation: 'portrait', marginPreset: 'normal' })
    const page = usePageSetup({ setup: () => setup.value })

    expect(page.dimsMm.value).toEqual({ widthMm: 297, heightMm: 420 })

    setup.value = { ...setup.value, orientation: 'landscape' }
    expect(page.dimsMm.value).toEqual({ widthMm: 420, heightMm: 297 })
    expect(page.pageRule.value).toBe('@page { size: 420mm 297mm; margin: 0 }')
  })
})

describe('managed style tag adapter', () => {
  test('creates the tag with the contract id on first apply', () => {
    const fake = fakeStore()
    expect(fake.live()).toBeNull()

    applyPageRule('@page { size: 210mm 297mm; margin: 0 }', fake.store)

    expect(fake.created).toHaveLength(1)
    // NB: the id is the document adapter's responsibility (documentStore sets it);
    // the injected fake stands in for a bare DOM element, so only textContent is the
    // manager's contract here.
    expect(fake.created[0]?.textContent).toBe('@page { size: 210mm 297mm; margin: 0 }')
  })

  test('updates the existing tag in place instead of stacking duplicates', () => {
    const fake = fakeStore()
    applyPageRule('@page { size: 210mm 297mm; margin: 0 }', fake.store)
    applyPageRule('@page { size: 297mm 210mm; margin: 0 }', fake.store)

    expect(fake.created).toHaveLength(1)
    expect(fake.created[0]?.textContent).toBe('@page { size: 297mm 210mm; margin: 0 }')
  })

  test('clear detaches the tag; a later apply creates a fresh one', () => {
    const fake = fakeStore()
    applyPageRule('@page { size: 210mm 297mm; margin: 0 }', fake.store)
    const first = fake.created[0]

    clearPageRule(fake.store)
    expect(first?.removed).toBe(true)

    applyPageRule('@page { size: 148mm 210mm; margin: 0 }', fake.store)
    expect(fake.created).toHaveLength(2)
    expect(fake.created[1]?.textContent).toBe('@page { size: 148mm 210mm; margin: 0 }')
  })

  test('clear without an existing tag is a safe no-op', () => {
    const fake = fakeStore()
    expect(() => clearPageRule(fake.store)).not.toThrow()
    expect(fake.created).toHaveLength(0)
  })
})

describe('style tag lifecycle (reference counting)', () => {
  test('keeps the tag while at least one consumer is registered', () => {
    const fake = fakeStore()
    const lifecycle = createPageRuleLifecycle(fake.store)

    lifecycle.acquire()
    applyPageRule('@page { size: 210mm 297mm; margin: 0 }', fake.store)
    lifecycle.acquire()
    lifecycle.release()

    expect(fake.created[0]?.removed).toBe(false)

    lifecycle.release()
    expect(fake.created[0]?.removed).toBe(true)
  })

  test('extra releases are clamped and the lifecycle stays usable', () => {
    const fake = fakeStore()
    const lifecycle = createPageRuleLifecycle(fake.store)

    lifecycle.acquire()
    lifecycle.release()
    lifecycle.release()
    lifecycle.release()

    applyPageRule('@page { size: 297mm 420mm; margin: 0 }', fake.store)
    expect(fake.created).toHaveLength(1)
    expect(fake.created[0]?.textContent).toBe('@page { size: 297mm 420mm; margin: 0 }')
  })
})
