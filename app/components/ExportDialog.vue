<script setup lang="ts">
/**
 * ExportDialog — modal dialog for printing and exporting the chart sheet.
 *
 * Contract: context bundle line 70; subtask chart-app-v2-14. Teleported to
 * <body> so it always floats above the builder chrome; opened/closed purely
 * through the `open` prop (focus return stays the parent's concern — fine
 * for v1). Esc and scrim clicks both close; focus lands on the first option
 * when it opens.
 *
 * Three actions, all wired to `useExport`:
 *  - Print → `printChart()` (browser print dialog over the page), then close.
 *  - Download PNG → `exportPng(2)` (2× raster), close on success.
 *  - Download PDF → `exportPdf()` (one A4 landscape page), close on success.
 *
 * Busy/error surface: the composable's shared `exporting` flag disables
 * every option while an export runs, and the running row shows an inline
 * 12px 'Preparing…' state (no double submits — the composable guards
 * re-entry too). Failures are reported through the composable's `error`
 * ref and surface here as a quiet inline line in the negative ink with a
 * Retry action that re-invokes the last attempted export.
 *
 * Licensing: the full attribution text (AttributionNotice 'full') travels
 * with every export conversation under an 'Icon licenses' heading. An empty
 * chart (no placed icons) swaps it for a plain 'Add icons to your chart
 * first.' line.
 *
 * Framed-sheet rules: white surface, 1px border, sheet radius, flat rgba
 * scrim (the scrim is a flat tint, not elevation). The dialog is the one
 * thing here that floats, so it carries the one legal overlay elevation;
 * nothing else casts any.
 */
import { computed, nextTick, onScopeDispose, ref, useId, watch } from 'vue'
import { useChartStore } from '../stores/chart'
import { useExport } from '../composables/useExport'
import AttributionNotice from './AttributionNotice.vue'

const props = defineProps<{
  /** Open state — the parent owns it; the dialog renders nothing while false. */
  open: boolean
}>()

const emit = defineEmits<{
  /** Ask the parent to close (Esc, scrim click, completed action). */
  close: []
}>()

/** Exports that can fail and therefore support Retry. Print cannot fail. */
type RetryableAction = 'png' | 'pdf'

/** Fixed PNG raster scale — 2× keeps labels crisp at A4 without huge files. */
const PNG_SCALE = 2

const chartStore = useChartStore()
const { printChart, exportPng, exportPdf, exporting, error: exportError } = useExport({
  title: () => chartStore.doc.title,
})

const titleId = useId()

/** First option button — receives focus when the dialog opens. */
const printButtonRef = ref<HTMLButtonElement | null>(null)

/** Export currently running (drives the inline 'Preparing…' state), or null. */
const busyAction = ref<RetryableAction | null>(null)
/** Last attempted retryable export — the target of the Retry button. */
const lastAction = ref<RetryableAction | null>(null)

/** True when at least one slot has an icon — gates the attribution block. */
const hasIcons = computed(() => chartStore.doc.slots.some((slot) => slot.icon !== null))

function requestClose(): void {
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') requestClose()
}

// Esc closes while open; focus lands on the first option. The listener's
// lifecycle tracks the `open` prop so nothing lingers after close/unmount.
watch(
  () => props.open,
  (isOpen) => {
    if (typeof window === 'undefined') return
    if (isOpen) {
      window.addEventListener('keydown', onKeydown)
      void nextTick(() => printButtonRef.value?.focus())
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
  { immediate: true },
)

onScopeDispose(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown)
})

/** Print via the print stylesheet; the browser dialog opens over the page. */
function runPrint(): void {
  printChart()
  requestClose()
}

async function runPng(): Promise<void> {
  busyAction.value = 'png'
  lastAction.value = 'png'
  const ok = await exportPng(PNG_SCALE)
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
</script>

<template>
  <Teleport to="body">
    <!-- No <Transition>: CSS-transition-driven close can freeze when rAF is
         throttled (background tab) or transitions are disabled
         (prefers-reduced-motion) — reliability beats a 160ms fade. -->
    <div v-if="open" class="overlay" @click.self="requestClose">
        <div class="dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId">
          <header class="dialog-head">
            <h2 :id="titleId" class="dialog-title">Print or export</h2>
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

          <div class="options">
            <button
              ref="printButtonRef"
              type="button"
              class="option"
              :disabled="exporting"
              @click="runPrint"
            >
              <span class="option-text">
                <span class="option-title">Print</span>
                <span class="option-sub">A4 landscape, exactly as shown</span>
              </span>
            </button>

            <button
              type="button"
              class="option"
              :disabled="exporting"
              :aria-busy="busyAction === 'png'"
              @click="runPng"
            >
              <span class="option-text">
                <span class="option-title">Download PNG</span>
                <span class="option-sub">High-resolution image (2×)</span>
              </span>
              <span v-if="busyAction === 'png'" class="option-busy">Preparing…</span>
            </button>

            <button
              type="button"
              class="option"
              :disabled="exporting"
              :aria-busy="busyAction === 'pdf'"
              @click="runPdf"
            >
              <span class="option-text">
                <span class="option-title">Download PDF</span>
                <span class="option-sub">One A4 landscape page</span>
              </span>
              <span v-if="busyAction === 'pdf'" class="option-busy">Preparing…</span>
            </button>
          </div>

          <p v-if="exportError !== null" class="export-error" role="alert">
            <span>{{ exportError }}</span>
            <button
              type="button"
              class="retry-btn"
              :disabled="exporting"
              @click="retry"
            >Retry</button>
          </p>

          <section class="licenses" aria-label="Icon licenses">
            <h3 class="licenses-heading">Icon licenses</h3>
            <p v-if="!hasIcons" class="licenses-empty">Add icons to your chart first.</p>
            <AttributionNotice v-else variant="full" />
          </section>
        </div>
      </div>
  </Teleport>
</template>

<style scoped>
/* Scrim — flat rgba, never a gradient. A real element, so it blocks clicks. */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(19, 20, 22, 0.4);
}

/* The dialog floats — the house's one legal overlay elevation.
   taste-skill-ignore: overlay dialog elevation, house-allowed. */
.dialog {
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: var(--pad); /* 24px */
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sheet); /* 16px */
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.14); /* taste-skill-ignore */
}

/* Open/close — fade the scrim, settle the sheet; both under 400ms. */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 160ms ease;
}

.dialog-enter-active .dialog,
.dialog-leave-active .dialog {
  transition: transform 160ms ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog,
.dialog-leave-to .dialog {
  transform: translateY(6px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .dialog-enter-active,
  .dialog-leave-active,
  .dialog-enter-active .dialog,
  .dialog-leave-active .dialog {
    transition: none;
  }
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.dialog-title {
  margin: 0;
  font-size: var(--text-section); /* 16px */
  font-weight: 600;
  line-height: 1.4;
}

/* 32px quiet icon button — matches the top bar's icon-button language. */
.close-btn {
  display: grid;
  place-items: center;
  flex: none;
  width: var(--control-height);
  height: var(--control-height);
  padding: 0;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.close-btn:hover {
  background: var(--raised);
  color: var(--text);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Full-width bordered option cards; hover raises, never elevates. */
.option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: var(--control-height);
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.option:hover:not(:disabled) {
  background: var(--raised);
}

.option:disabled {
  cursor: default;
  opacity: 0.6;
}

.option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-title {
  font-size: var(--text-body); /* 14px */
  font-weight: 500;
  line-height: 1.3;
}

.option-sub {
  font-size: 13px;
  line-height: 1.35;
  color: var(--muted);
}

.option-busy {
  flex: none;
  font-size: var(--text-small); /* 12px */
  line-height: 1.4;
  color: var(--muted);
}

/* Typed export failure — quiet inline line, negative ink, with Retry. */
.export-error {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 0;
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
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.retry-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

/* Full attribution rides along with every export conversation. */
.licenses {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--rule); /* taste-skill-ignore */
}

.licenses-heading {
  margin: 0;
  font-size: var(--text-small);
  font-weight: 500;
  line-height: 1.4;
  color: var(--muted);
}

.licenses-empty {
  margin: 0;
  font-size: var(--text-small);
  line-height: 1.45;
  color: var(--muted);
}
</style>
