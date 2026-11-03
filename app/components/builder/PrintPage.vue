<script setup lang="ts">
/**
 * PrintPage — THE paper sheet (subtask builder-v2-rebuild-08): what you see
 * is what prints, at any page size and zoom level.
 *
 * Print contract (approved decision 4 — this component is its owner):
 * - The root is the ONE `[data-print-page]` capture/print root. useExport
 *   locates it by that exact attribute and subtask 15's print stylesheet
 *   pins it to the injected `@page` box.
 * - Interior geometry is sheet-relative in cqw: any length of X mm renders
 *   as `X / widthMm * 100cqw` (100cqw ≡ the full sheet width), so on-screen
 *   px, zoom scaling and printed mm stay proportionally identical for every
 *   preset and orientation. Radii, hairlines and the guide stay px on
 *   purpose — device hairlines on paper too.
 * - `print-color-adjust: exact` is set on the root so the mint keyword
 *   block (and any slotted tint) survives into print.
 * - Screen-only affordances (the dashed margin guide) carry
 *   `data-screen-only` so the print CSS can drop them in one rule; a
 *   defensive scoped copy of that rule lives in this component's print
 *   block (identical declaration — zero conflict with subtask 15).
 *
 * Geometry: `usePageSetup` derives dims/aspect from the doc's pageSetup —
 * nothing is hardcoded. The parent (PrintCanvas) sizes the sheet by width;
 * this component keeps the aspect exact via `--page-ratio` and animates
 * aspect changes 200ms ease (Stage 3: page size/orientation switch).
 *
 * WYSIWYG title: the h1 on the sheet is the primary edit point — click it
 * and an identically-styled input takes its place (same 4.4cqw type, so the
 * sheet never shifts). Emits `update:title` on every input; the store's
 * 600ms `title` coalescing collapses the stream into one undo step. Escape
 * only closes the editor (keystrokes already reached the store — undo
 * reverts them). A print triggered mid-edit commits first via `beforeprint`,
 * so print and export always capture the settled h1.
 *
 * Mint highlight-block: the v2 doc model dropped the mockup's dedicated
 * `hl` field, so the FIRST title word carries the block — matching every
 * approved template (First, Snack, Morning, Animal). This computed is the
 * single point of change if a keyword field ever returns.
 *
 * Brand footer: the sheet's foot row carries the inline logo mark +
 * wordmark (left) beside the slotted attribution (right). Branding rides
 * every print and export because the capture/print root is this element.
 */
import { computed, nextTick, onScopeDispose, ref } from 'vue'
import type { PageSetup } from '~/types/chart'
import { usePageSetup } from '~/composables/usePageSetup'
import { formatMm } from '~/utils/page-presets'

const props = defineProps<{
  /** Reactive doc page setup — the geometry source for usePageSetup (mm-derived). */
  pageSetup: PageSetup
  /** Print margin in mm — rendered as the sheet's own inner padding boundary. */
  marginMm: number
  /** Sheet title — WYSIWYG-edited in place; prints with the sheet. */
  title: string
}>()

const emit = defineEmits<{
  (e: 'update:title', value: string): void
}>()

/**
 * Page geometry + the managed `@page` rule. Singleton-safe (refcounted
 * shared tag): calling it here keeps the print contract live even if the
 * canvas parent also consumes it — the rule content is identical.
 */
const { dimsMm, aspectRatio } = usePageSetup({ setup: () => props.pageSetup })

/** Custom properties driving the sheet's mm-true interior math (style block). */
const pageVars = computed<Record<string, string>>(() => ({
  '--page-ratio': String(aspectRatio.value),
  '--page-w-mm': String(dimsMm.value.widthMm),
}))

/** Guide label in the mockup's mm formatting, e.g. "12 mm margin". */
const guideLabel = computed(() => `${formatMm(props.marginMm)} mm margin`)

/** Title hidden when whitespace-only — mockup parity (`sheetTitle.hidden = !t`). */
const hasTitle = computed(() => props.title.trim() !== '')

/** First title word (mint highlight-block) + everything after it. */
const titleParts = computed(() => {
  const body = props.title.replace(/^\s+/, '')
  const spaceAt = body.search(/\s/)
  if (spaceAt === -1) return { keyword: body, tail: '' }
  return { keyword: body.slice(0, spaceAt), tail: body.slice(spaceAt) }
})

// --- Inline title editing (WYSIWYG: edit where it prints) ---

const titleEditing = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)
/** Local draft while editing; streamed to the store via update:title. */
const titleDraft = ref('')

function startTitleEdit(): void {
  titleDraft.value = props.title
  titleEditing.value = true
  void nextTick(() => {
    titleInput.value?.focus()
    titleInput.value?.select()
  })
}

function onTitleInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  titleDraft.value = value
  emit('update:title', value)
}

function commitTitleEdit(): void {
  if (!titleEditing.value) return
  titleEditing.value = false
  const next = titleDraft.value.trim()
  if (next !== props.title) emit('update:title', next)
}

function onTitleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitTitleEdit()
  } else if (event.key === 'Escape') {
    // Live emission means keystrokes already reached the store (coalesced);
    // closing is all Escape can do — undo reverts the streamed edits.
    event.preventDefault()
    titleEditing.value = false
  }
}

// Print safety: printing always captures the settled h1 — a print fired
// mid-edit commits the draft first (window.print and Ctrl/Cmd+P both fire).
if (typeof window !== 'undefined') {
  window.addEventListener('beforeprint', commitTitleEdit)
  onScopeDispose(() => window.removeEventListener('beforeprint', commitTitleEdit))
}
</script>

<template>
  <section
    data-print-page
    class="page"
    role="region"
    aria-label="Print page preview"
    :style="pageVars"
  >
    <!--
      Screen-only dashed margin guide — sits exactly on the inner padding
      boundary and NEVER prints (data-screen-only; subtask 15 hides it).
    -->
    <span
      class="margin-guide"
      data-screen-only
      aria-hidden="true"
      :data-m="guideLabel"
    ></span>

    <div class="page-inner">
      <!-- WYSIWYG title: the input swaps in identically styled, so the sheet
           never shifts and print always captures the settled h1. -->
      <input
        v-if="titleEditing"
        ref="titleInput"
        :value="titleDraft"
        class="page-title page-title-input"
        type="text"
        maxlength="60"
        autocomplete="off"
        spellcheck="false"
        aria-label="Chart title"
        @input="onTitleInput"
        @blur="commitTitleEdit"
        @keydown="onTitleKeydown"
      >
      <h1 v-else-if="hasTitle" class="page-title page-title-view">
        <!-- The title is a real button inside the heading: tabbable and
             named for keyboard and screen-reader users (WCAG 2.1.1),
             visually invisible inside the print-true h1 styles. -->
        <button
          type="button"
          class="title-edit-btn"
          title="Click to edit the title"
          @click="startTitleEdit"
        ><span class="title-keyword">{{ titleParts.keyword }}</span>{{ titleParts.tail }}</button>
      </h1>

      <!-- PageGrid (subtask 09) renders here; the sheet provides the cqw frame. -->
      <div class="page-grid">
        <slot name="grid" />
      </div>

      <!-- Sheet footer: the brand mark + the slotted attribution ride the
           sheet into print and every export (the capture/print root IS this
           component). Brand is quiet: muted ink, px-sized to pair with the
           attribution line at every paper size. -->
      <div class="page-foot">
        <span class="brand">
          <!-- public/logo.svg inlined (print-safe: no external fetch in the
               capture, and it prints without a network round trip). -->
          <svg class="brand-mark" viewBox="0 0 341 341" aria-hidden="true">
            <path
              d="M85.039,340.157c-46.935,0 -85.039,-38.105 -85.039,-85.039l0,-170.079c0,-46.935 38.105,-85.039 85.039,-85.039l170.079,0c46.935,0 85.039,38.105 85.039,85.039l0,255.118l-255.118,0Z"
              fill="#9eff9e"
            />
            <path
              d="M215.603,276.455c-11.776,0 -21.337,-9.561 -21.337,-21.337l0,-42.674c0,-11.776 9.561,-21.337 21.337,-21.337l42.674,0c11.776,0 21.337,9.561 21.337,21.337l0,64.011l-64.011,0Z"
              fill="currentColor"
            />
            <path
              d="M81.881,276.455c-11.776,0 -21.337,-9.561 -21.337,-21.337l0,-42.674c0,-11.776 9.561,-21.337 21.337,-21.337l42.674,0c11.776,0 21.337,9.561 21.337,21.337l0,64.011l-64.011,0Z"
              fill="currentColor"
            />
            <path
              d="M215.603,149.05c-11.776,0 -21.337,-9.561 -21.337,-21.337l0,-42.674c0,-11.776 9.561,-21.337 21.337,-21.337l42.674,0c11.776,0 21.337,9.561 21.337,21.337l0,64.011l-64.011,0Z"
              fill="currentColor"
            />
            <path
              d="M81.881,149.05c-11.776,0 -21.337,-9.561 -21.337,-21.337l0,-42.674c0,-11.776 9.561,-21.337 21.337,-21.337l42.674,0c11.776,0 21.337,9.561 21.337,21.337l0,64.011l-64.011,0Z"
              fill="currentColor"
            />
          </svg>
          <span class="brand-name">The Talking Chart</span>
        </span>
        <slot name="foot" />
      </div>
    </div>
  </section>
</template>

<style scoped>
/*
 * GEOMETRY — the print contract lives here. The root is the ONE
 * [data-print-page] capture/print root: parent-sized (PrintCanvas sets the
 * width), exact aspect via --page-ratio, and the inline-size query
 * container every interior cqw unit resolves against. MM → CQ: any length
 * X mm renders as X / widthMm * 100cqw, so screen px, zoom and printed mm
 * stay proportionally identical at every page size.
 */
.page {
  position: relative;
  width: 100%;
  aspect-ratio: var(--page-ratio);
  background: var(--paper);
  border-radius: var(--r-sheet, 14px); /* theme: sheet 14px */
  /* Calm paper-on-desk shadow — tuned for the light desk ground. */
  box-shadow:
    0 1px 2px rgba(19, 23, 17, 0.10),
    0 24px 48px -16px rgba(19, 23, 17, 0.22);
  color: var(--ink);
  container-type: inline-size;
  transition: aspect-ratio 200ms ease;
  /* Decision 4: the mint keyword and every tint must survive into print. */
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

.page-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: calc(var(--margin-mm) / var(--page-w-mm) * 100cqw);
}

/* Dashed guide rides exactly on the padding boundary; screen-only. */
.margin-guide {
  position: absolute;
  inset: calc(var(--margin-mm) / var(--page-w-mm) * 100cqw);
  border: 1px dashed rgba(92, 102, 87, 0.5); /* --muted at 50% */
  border-radius: 6px;
  pointer-events: none;
}

.margin-guide::after {
  content: attr(data-m);
  position: absolute;
  right: 0;
  bottom: -1px;
  translate: 0 50%;
  background: var(--paper);
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 0 5px;
}

/*
 * The title: one rule, two states. The view is a heading; the editor is an
 * input with the exact same box, so swapping never shifts the grid.
 * Centered per the approved v1 builder mockup (mockup-builder.html
 * .sheet-title { text-align: center }) — inputs and the inner edit button
 * inherit text-align, so all three states share the alignment.
 */
.page-title {
  flex: none;
  margin: 0 0 2cqw;
  overflow: hidden;
  font-family: var(--font-text, inherit); /* Work Sans per design system */
  font-size: 4.4cqw;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: var(--ink);
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.page-title-view {
  cursor: text;
}

/* Quiet editability hint — instant, per the house motion rule. */
.page-title-view:hover .title-edit-btn {
  text-decoration: underline dotted rgba(92, 102, 87, 0.6);
  text-underline-offset: 0.18em;
}

/* The edit affordance as a real control — fully reset so the print-true
   typography shows through untouched. */
.title-edit-btn {
  display: block;
  width: 100%;
  overflow: hidden;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  letter-spacing: inherit;
  color: inherit;
  text-align: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}

.title-edit-btn:focus-visible {
  /* Dark mint, not --mint: the ring sits on WHITE paper (this sheet), where
     #a7ff9c reads ~0.8:1 and fails the visible-indicator requirement. The
     --mint-ink token clears 9.9:1 here. */
  outline: 2px solid var(--mint-ink, var(--ink));
  outline-offset: 2px;
  border-radius: 2px;
}

/* The v1 signature: mint highlight-block on the keyword — prints. */
.title-keyword {
  background: var(--mint);
  color: var(--ink);
  border-radius: 0.08em;
  padding: 0 0.14em;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.page-title-input {
  width: 100%;
  padding: 0;
  border: none;
  /* Editing-state boundary (1.4.11): dark mint like GridCell's identical
     inline label editor — light --mint is ~0.8:1 on this white paper. */
  border-bottom: 0.35cqw solid var(--mint-ink, var(--ink));
  background: transparent;
  outline: none;
}

.page-grid {
  flex: 1 1 0;
  min-height: 0;
}

/*
 * Sheet footer: one flex row — brand mark (left) + slotted attribution
 * (right). px sizing pairs with the attribution's own px so the row reads
 * as one unit at every paper size and zoom. print-color-adjust: exact on
 * the sheet root keeps the mint mark and muted ink on paper.
 */
.page-foot {
  flex: none;
  margin-top: 1cqw;
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
}

.brand-mark {
  width: 13px;
  height: 13px;
  color: var(--ink);
  flex: none;
}

.brand-name {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--muted);
  white-space: nowrap;
}

/* The slotted attribution fills the rest of the row, right-aligned and
   wrap-safe (its own overflow-wrap:anywhere stays page-owned). */
.page-foot :slotted(*) {
  flex: 1 1 auto;
  min-width: 0;
  text-align: right;
}

/* Reduced motion: the aspect transition dies; reflow becomes instant. */
@media (prefers-reduced-motion: reduce) {
  .page {
    transition: none;
  }
}

/*
 * Defensive duplicates of the global print contract (subtask 15 owns the
 * canonical block) — identical declarations, zero conflict, so this sheet
 * is print-correct even in isolation.
 */
@media print {
  .page {
    border-radius: 0;
    box-shadow: none;
  }
  .page :focus-visible {
    outline: none;
  }
  .page [data-screen-only] {
    display: none !important;
  }
  /* Title policy: the screen keeps the tidy nowrap+ellipsis ticker, but
     paper must never print "…" — 60 stored chars can exceed one printed
     line, so the printed title wraps. The inner edit BUTTON re-asserts
     nowrap + overflow:hidden on the screen (it is the ticker's clip
     element), so it must be relaxed with the heading or the paper title
     would still be cut off inside it (overflow is not inherited). */
  .page-title,
  .page-title .title-edit-btn {
    overflow: visible;
    white-space: normal;
    text-overflow: unset;
  }
}
</style>
