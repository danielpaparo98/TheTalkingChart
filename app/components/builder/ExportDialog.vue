<script setup lang="ts">
/**
 * ExportDialog (builder v2) — print / PNG / PDF for the current page setup.
 *
 * Rebuild of v1's ExportDialog (same accessible-dialog + busy/retry pattern
 * quality) on the generalized `useExport({ doc })` API from subtask 04:
 * `printChart()` / `exportPng()` / `exportPdf()` / `exporting` / `error` /
 * `attribution`. No-throw contract: failures arrive as a string on `error`
 * and surface as the inline error line + Retry; `exportPng()` is called
 * WITHOUT an explicit scale so the composable derives the true-page-size
 * raster density for whatever preset/orientation the doc holds.
 *
 * The doc arrives as a prop (the page passes the store's `doc` through)
 * rather than the dialog importing the store: the dialog stays decoupled
 * from the store module and usable by any caller holding a ChartDoc. Only
 * `resolveSetMeta` touches a store — read-only, so licence metadata resolves
 * exactly like the rest of the app (catalog store, unknown prefixes skipped).
 *
 * Rows show the CURRENT doc's expected output dims ("297 × 210 mm ·
 * landscape") derived via `app/utils/page-presets` — never hardcoded page
 * constants. A summary line under the title adds the preset label and the
 * margin preset, so preset + orientation + margin are all visible.
 *
 * Print is the only mint-filled surface in the dialog (approved rule: mint
 * appears exactly once — the Print CTA). Print itself cannot fail (plain
 * `window.print()`; the browser reports its own errors), so it is not
 * retryable — v1 behaviour. After `window.print()` returns (it blocks while
 * the browser dialog is open) the dialog closes: the print stylesheet hides
 * all screen chrome anyway, and closing hands focus back to the toolbar
 * export trigger. PNG/PDF close on success, stay open with the error line +
 * Retry on failure (v1 behaviour — Retry re-invokes the last attempt).
 *
 * Focus contract: `open` is parent-owned; Esc and scrim clicks emit `close`
 * (a request). When the dialog has actually closed it emits `closed`, and
 * the PARENT returns focus to its toolbar export trigger (WCAG 2.4.3). As a
 * safety net for parents that don't listen, focus is restored to wherever
 * the dialog was opened from — but only if it was left on `<body>`, so the
 * two mechanisms never fight over the caret.
 *
 * Motion: 200ms opacity/transform fade on open only. There is deliberately
 * NO close transition (v-if removal is instant) — v1's rationale stands:
 * CSS-transition-driven close freezes when rAF is throttled or reduced-motion
 * is on, and reliability beats a fade on the way out. Reduced-motion removes
 * the open animation and all hover transitions.
 */
import { computed, nextTick, onScopeDispose, ref, useId, watch } from 'vue'
import { useExport } from '../../composables/useExport'
import type { ExportableDoc } from '../../composables/useExport'
import { PAGE_PRESETS, formatMm, marginMm, pageDims } from '../../utils/page-presets'
import { useCatalogStore } from '../../stores/catalog'
import type { IconSetMeta } from '../../types/icons'

const props = defineProps<{
  /** Open state — the parent owns it; the dialog renders nothing while false. */
  open: boolean
  /** Live v2 doc (the page passes the store's `doc` through) — drives dims + attribution. */
  doc: ExportableDoc
}>()

const emit = defineEmits<{
  /** Ask the parent to close (Esc, scrim click, completed action). */
  close: []
  /** Fully closed — the parent returns focus to its toolbar export trigger. */
  closed: []
}>()

/** Exports that can fail and therefore support Retry. Print cannot fail. */
type RetryableAction = 'png' | 'pdf'

const catalogStore = useCatalogStore()

/** Licence metadata resolver for useExport — unknown prefixes are skipped there. */
function resolveSetMeta(prefix: string): IconSetMeta | null {
  return catalogStore.sets.find((meta) => meta.prefix === prefix) ?? null
}

const { printChart, exportPng, exportPdf, exporting, error: exportError, attribution } = useExport({
  doc: () => props.doc,
  resolveSetMeta,
})

// ---------------------------------------------------------------------------
// Page dims — every row states the expected output size for THIS doc setup
// ---------------------------------------------------------------------------

const dims = computed(() => pageDims(props.doc.pageSetup.preset, props.doc.pageSetup.orientation))

/** "297 × 210 mm · landscape" — the mockup's canvas-status format, mm first. */
const dimsLine = computed(
  () =>
    `${formatMm(dims.value.widthMm)} × ${formatMm(dims.value.heightMm)} mm · ${props.doc.pageSetup.orientation}`,
)

/** Qualifiers tail the dims line so each row states what it produces. */
const pngDims = computed(() => `${dimsLine.value} · 2× density image`)
const pdfDims = computed(() => `${dimsLine.value} · one page`)

/** Header summary: preset + orientation + dims + margin (all in mm, one line). */
const summaryLine = computed(() => {
  const setup = props.doc.pageSetup
  return `${PAGE_PRESETS[setup.preset].label} · ${setup.orientation} · ${formatMm(dims.value.widthMm)} × ${formatMm(dims.value.heightMm)} mm · ${formatMm(marginMm(setup.marginPreset))} mm margins`
})

// ---------------------------------------------------------------------------
// Busy + retry — the composable's shared `exporting` flag guards re-entry
// ---------------------------------------------------------------------------

const busyAction = ref<RetryableAction | null>(null)
const lastAction = ref<RetryableAction | null>(null)

const ACTION_LABELS: Record<RetryableAction, string> = { png: 'PNG', pdf: 'PDF' }

/**
 * Polite live line ("Preparing PNG…"). The element stays mounted with an
 * empty string between runs — live regions only announce text CHANGES on an
 * already-rendered node, so v-if would silently break announcement.
 */
const statusLine = computed(() =>
  busyAction.value === null ? '' : `Preparing ${ACTION_LABELS[busyAction.value]}…`,
)

function requestClose(): void {
  emit('close')
}

/** Print via the browser; physical size comes from the injected @page rule. */
function runPrint(): void {
  printChart()
  requestClose()
}

async function runPng(): Promise<void> {
  busyAction.value = 'png'
  lastAction.value = 'png'
  const ok = await exportPng()
  busyAction.value = null
  if (ok) requestClose()
}

async function runPdf(): Promise<void> {
  busyAction.value = 'pdf'
  lastAction.value = 'pdf'
  const ok = await exportPdf()
  busyAction.value = null
  if (ok) requestClose()
}

/** Re-run the export whose failure is shown in the error line. */
function retry(): void {
  if (lastAction.value === 'png') void runPng()
  else if (lastAction.value === 'pdf') void runPdf()
}

// ---------------------------------------------------------------------------
// Focus trap + lifecycle — v1's pattern, with focus return delegated via `closed`
// ---------------------------------------------------------------------------

const titleId = useId()
/** First option button — receives focus when the dialog opens. */
const printButtonRef = ref<HTMLButtonElement | null>(null)
/** The modal surface — Tab is trapped inside it while open. */
const dialogRef = ref<HTMLDivElement | null>(null)
/** Where focus came from; the fallback restore target on close. */
let previouslyFocused: HTMLElement | null = null
/** Guards the `closed` emit so mounting with open=false never emits a close. */
let wasOpen = false

/** Focusable candidates for the Tab trap, in DOM order. */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    requestClose()
    return
  }
  if (event.key !== 'Tab') return
  const root = dialogRef.value
  if (root === null) return
  const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null,
  )
  if (focusable.length === 0) return
  const first = focusable[0] as HTMLElement
  const last = focusable[focusable.length - 1] as HTMLElement
  const current = document.activeElement
  const inside = current !== null && root.contains(current)
  if (event.shiftKey) {
    if (!inside || current === first) {
      event.preventDefault()
      last.focus()
    }
  } else if (!inside || current === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (typeof window === 'undefined') return
    if (isOpen) {
      wasOpen = true
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      window.addEventListener('keydown', onKeydown)
      void nextTick(() => printButtonRef.value?.focus())
      return
    }
    if (!wasOpen) return
    wasOpen = false
    window.removeEventListener('keydown', onKeydown)
    // Parent owns focus return to its toolbar trigger (the `closed` contract).
    emit('closed')
    // Fallback for parents that don't listen: once the dialog is gone from
    // the DOM, restore the opener — but only if focus was left on <body>,
    // so this never fights the parent's own restore.
    void nextTick(() => {
      const el = document.activeElement
      if (
        (el === null || el === document.body) &&
        previouslyFocused !== null &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus()
      }
      previouslyFocused = null
    })
  },
  { immediate: true },
)

onScopeDispose(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="requestClose">
      <div ref="dialogRef" class="dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <header class="head">
          <div class="head-text">
            <h2 :id="titleId" class="title">Print or export</h2>
            <p class="summary">{{ summaryLine }}</p>
          </div>
          <button
            type="button"
            class="close-btn"
            aria-label="Close"
            @click="requestClose"
          >
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path
                d="M2.5 2.5l7 7m0-7l-7 7"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </header>

        <div class="actions">
          <!-- Print — the dialog's single mint-filled surface. -->
          <button
            ref="printButtonRef"
            type="button"
            class="action action-cta"
            :disabled="exporting"
            @click="runPrint"
          >
            <svg class="action-icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path
                d="M4.6 5.6V2.4h6.8v3.2"
                fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"
              />
              <rect
                x="2.2" y="5.6" width="11.6" height="5.2" rx="1.2"
                fill="none" stroke="currentColor" stroke-width="1.5"
              />
              <path
                d="M4.6 9.2h6.8v4.4H4.6z"
                fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"
              />
            </svg>
            <span class="action-text">
              <span class="action-name">Print</span>
              <span class="action-dims">{{ dimsLine }}</span>
            </span>
          </button>

          <button
            type="button"
            class="action"
            :disabled="exporting"
            :aria-busy="busyAction === 'png'"
            @click="runPng"
          >
            <svg class="action-icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path
                d="M8 2.5v7m0 0 2.8-2.8M8 9.5 5.2 6.7M3 13.5h10"
                fill="none" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"
              />
            </svg>
            <span class="action-text">
              <span class="action-name">Download PNG</span>
              <span class="action-dims">{{ pngDims }}</span>
            </span>
          </button>

          <button
            type="button"
            class="action"
            :disabled="exporting"
            :aria-busy="busyAction === 'pdf'"
            @click="runPdf"
          >
            <svg class="action-icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path
                d="M8 2.5v7m0 0 2.8-2.8M8 9.5 5.2 6.7M3 13.5h10"
                fill="none" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"
              />
            </svg>
            <span class="action-text">
              <span class="action-name">Download PDF</span>
              <span class="action-dims">{{ pdfDims }}</span>
            </span>
          </button>
        </div>

        <!-- Mounted for the dialog's whole life: live regions announce text
             changes only on an already-rendered node (see statusLine). -->
        <p class="status" role="status" aria-live="polite">{{ statusLine }}</p>

        <p v-if="exportError !== null" class="error" role="alert">
          <span>{{ exportError }}</span>
          <button
            v-if="lastAction !== null"
            type="button"
            class="retry-btn"
            :disabled="exporting"
            @click="retry"
          >Retry</button>
        </p>

        <footer class="licenses">
          <p v-if="attribution !== ''" class="attrib">{{ attribution }}</p>
          <p v-else class="attrib">Add icons to your chart first.</p>
          <NuxtLink to="/attributes" class="licenses-link">Icon licenses</NuxtLink>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Scrim — flat tint per the mockup's .dlg-backdrop. A real element, so it
   blocks clicks; click.self closes. */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(14, 18, 13, 0.62);
  animation: overlay-in 200ms ease;
}

/* Calm paper card: sheet radius (14px), 1px hairline, no elevation beyond
   the open fade — the mockup's dialog is paper, not a shadow stack. */
.dialog {
  width: min(460px, 100%);
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 24px 26px 26px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--r-panel, 14px);
  font-family: var(--font-text);
  animation: dialog-in 200ms ease;
}

/* Open fade only — 200ms, opacity/transform. No close transition by design
   (see script block note); removal is instant. */
@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .overlay,
  .dialog {
    animation: none;
  }
  .action,
  .close-btn,
  .retry-btn,
  .licenses-link {
    transition: none;
  }
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--ink);
}

.summary {
  margin: 6px 0 0;
  font-size: var(--text-small);
  line-height: 1.45;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

/* 32px quiet icon button — the top bar's icon-button language. */
.close-btn {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--r-ctl, 8px);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.close-btn:hover {
  background: var(--desk);
  color: var(--text);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Full-width option rows: icon + name + dims. Ordinary rows are ink on
   paper; hover fills desk. Focus comes from the global :focus-visible rule. */
.action {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl, 8px);
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.action:hover:not(:disabled) {
  background: var(--desk);
}

.action:disabled {
  cursor: default;
  opacity: 0.55;
}

/* The one mint-filled surface in the dialog (mockup's .tb-cta treatment). */
.action-cta {
  background: var(--mint);
  border-color: var(--mint);
  font-weight: 600;
}

.action-cta:hover:not(:disabled) {
  background: #96f28a;
}

.action-icon {
  flex: none;
}

.action-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-name {
  font-size: var(--text-body);
  font-weight: 500;
  line-height: 1.3;
}

.action-cta .action-name {
  font-weight: 600;
}

.action-dims {
  font-size: var(--text-small);
  line-height: 1.4;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

/* Busy line — polite live region, reserved height so nothing jumps when
   the text appears or clears. */
.status {
  min-height: calc(var(--text-small) * 1.45);
  margin: 12px 0 0;
  font-size: var(--text-small);
  line-height: 1.45;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

/* Typed export failure — quiet inline line in negative ink, with Retry. */
.error {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 0;
  font-size: var(--text-small);
  line-height: 1.45;
  color: var(--negative);
}

.retry-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--negative);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.retry-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

/* Attribution travels with every export conversation (decision 10); the
   full per-source list lives on /attributes. */
.licenses {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.attrib {
  margin: 0;
  font-size: var(--text-small);
  line-height: 1.45;
  color: var(--muted);
  /* The attribution line is legally required text — wrap, never clip. */
  overflow-wrap: anywhere;
}

.licenses-link {
  font-size: var(--text-small);
  font-weight: 500;
  color: var(--text);
  text-decoration: underline;
  text-decoration-color: var(--mint-deep);
  text-underline-offset: 2px;
  transition: color 120ms ease;
}

.licenses-link:hover {
  color: var(--mint-deep);
}
</style>
