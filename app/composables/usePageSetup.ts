/**
 * Page-setup composable — derives printable geometry from the chart doc's
 * `pageSetup` and keeps the browser's `@page` rule in sync with it.
 *
 * Print contract (approved decision #4):
 * - Custom properties don't work inside `@page`, so the rule is rebuilt as a
 *   literal string whenever the page setup changes and written into ONE
 *   managed `<style id="page-size-rule">` tag in `document.head`. This tag
 *   replaces v1's hardcoded `@page { size: A4 landscape; margin: 0 }` block
 *   in main.css.
 * - The managed tag carries ONLY the `@page` rule. `@page` has no effect on
 *   the screen cascade, so no print-only rule can leak into screen styling
 *   through it.
 * - Page margin stays `0` (v1 print behaviour): the sheet box fills the page
 *   exactly, and printed margins come from the doc settings applied as the
 *   sheet's own padding — exposed here as `marginMm` for the sheet component.
 *
 * Singleton safety: the style tag is a document-wide resource shared through
 * a module-level reference count. Each `usePageSetup` consumer acquires on
 * mount and releases on scope dispose; the tag is removed only when the last
 * consumer leaves (e.g. the builder page unmounts), so a second mount never
 * stacks duplicate tags and never rips the rule out from under a live one.
 *
 * SSR safety: every DOM access is guarded — on the server the composable
 * derives values normally and simply skips the tag management.
 */
import { computed, onScopeDispose, toValue, watchEffect } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import type { PageSetup } from '../types/chart'
import * as presets from '../utils/page-presets'

/** id of the single managed style tag holding the @page rule. */
export const PAGE_RULE_STYLE_ID = 'page-size-rule'

/** The subset of a style element the manager touches (real DOM satisfies it). */
export interface PageStyleElement {
  id: string
  textContent: string
  remove(): void
}

/**
 * Minimal document surface for the managed tag — dependency-injected so the
 * inject/update logic is testable against a fake store without a DOM.
 */
export interface PageRuleStore {
  /** The live managed element, or `null` before creation / after removal. */
  get(): PageStyleElement | null
  /** Create and attach an empty managed element. */
  create(): PageStyleElement
}

/**
 * Full `@page` rule for a page setup. Page margin is always `0` per the
 * print contract — the doc's margin preset travels via `marginMm` into the
 * sheet's padding, not into this rule.
 */
export function pageRuleText(setup: PageSetup): string {
  return `@page { ${presets.pageSizeDeclaration(setup.preset, setup.orientation)}; margin: 0 }`
}

/** Write `text` into the managed tag, creating it on first use (dedup by id). */
export function applyPageRule(text: string, store: PageRuleStore): void {
  const el = store.get() ?? store.create()
  el.textContent = text
}

/** Detach the managed tag — the page-size rule stops applying immediately. */
export function clearPageRule(store: PageRuleStore): void {
  store.get()?.remove()
}

/** Mount/unmount accounting for the shared style tag. */
export interface PageRuleLifecycle {
  /** Register a consumer; returns the shared store for rule updates. */
  acquire(): PageRuleStore
  /** Drop a consumer; the tag is cleared when the last one leaves. */
  release(): void
}

/** Reference-counted owner of one style tag — singleton-safe across mounts. */
export function createPageRuleLifecycle(store: PageRuleStore): PageRuleLifecycle {
  let consumers = 0
  return {
    acquire: () => {
      consumers += 1
      return store
    },
    release: () => {
      // Clamp so a stray extra release can never drive the count negative
      // and strand later consumers without a working lifecycle.
      consumers = Math.max(0, consumers - 1)
      if (consumers === 0) clearPageRule(store)
    },
  }
}

/** Document-backed store: dedupes by element id, attaches to `document.head`. */
function documentStore(): PageRuleStore {
  return {
    get: () => document.getElementById(PAGE_RULE_STYLE_ID),
    create: () => {
      const el = document.createElement('style')
      el.id = PAGE_RULE_STYLE_ID
      document.head.appendChild(el)
      return el
    },
  }
}

/**
 * Module-wide lifecycle shared by every consumer in the document. Created
 * lazily so importing this module on the server never touches `document`.
 */
let sharedLifecycle: PageRuleLifecycle | null = null

function acquireSharedStore(): PageRuleStore {
  sharedLifecycle ??= createPageRuleLifecycle(documentStore())
  return sharedLifecycle.acquire()
}

function releaseSharedStore(): void {
  sharedLifecycle?.release()
}

/** Derived page geometry + the managed @page rule, for canvas fit math and the sheet. */
export interface UsePageSetup {
  /** Effective sheet dimensions in mm (orientation-aware). */
  readonly dimsMm: ComputedRef<{ widthMm: number; heightMm: number }>
  /** Sheet aspect ratio (width ÷ height float) — fit-to-canvas zoom math. */
  readonly aspectRatio: ComputedRef<number>
  /** Print margin in mm — the sheet applies it as its own padding, not @page margin. */
  readonly marginMm: ComputedRef<number>
  /** The `@page` rule text currently kept in the managed style tag. */
  readonly pageRule: ComputedRef<string>
}

/** Options for {@link usePageSetup}. */
export interface UsePageSetupOptions {
  /** Reactive source: ref, computed or plain getter of the doc's `pageSetup`. */
  readonly setup: MaybeRefOrGetter<PageSetup>
}

/**
 * Derive printable page geometry from the doc's page setup and keep the
 * managed `@page` style tag in sync. Call inside component setup; the tag
 * management is a client-only effect cleaned up with the calling scope.
 */
export function usePageSetup(options: UsePageSetupOptions): UsePageSetup {
  const dimsMm = computed(() => {
    const { preset, orientation } = toValue(options.setup)
    return presets.pageDims(preset, orientation)
  })

  const aspectRatio = computed(() => {
    const { preset, orientation } = toValue(options.setup)
    return presets.aspectRatio(preset, orientation)
  })

  const marginMm = computed(() => presets.marginMm(toValue(options.setup).marginPreset))

  const pageRule = computed(() => pageRuleText(toValue(options.setup)))

  // Client-only side effect: there is no document (and nothing to manage)
  // on the server. watchEffect runs immediately, so the tag exists and is
  // correct from first mount, and stops with the calling scope.
  if (typeof document !== 'undefined') {
    const store = acquireSharedStore()
    watchEffect(() => applyPageRule(pageRule.value, store))
    onScopeDispose(releaseSharedStore)
  }

  return { dimsMm, aspectRatio, marginMm, pageRule }
}
