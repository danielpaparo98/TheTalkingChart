<script setup lang="ts">
/**
 * TemplateGallery — the starter-template dialog for the builder v2.
 *
 * Rendering contract: fully controlled by the `open` prop (the page owns the
 * toolbar trigger). Teleported to <body> and `v-if`-guarded, so it renders
 * NOTHING while closed — no scrim, no focusables, no listeners. Closing is
 * instant unmount; the 200ms fade/scale-in is a mount-only CSS animation, so
 * it can never freeze mid-exit when rAF is throttled (the failure mode that
 * made v1's ExportDialog skip <Transition> entirely).
 *
 * A11y (WCAG 2.1 AA): role=dialog + aria-modal, labelled by the visible
 * Anton headline (aria-labelledby — the accessible name is the visible text,
 * per 2.5.3, matching the approved mockup). Escape and scrim clicks close.
 * Focus moves to the first template card on open, Tab is trapped inside the
 * modal surface, and focus returns to the trigger element on close — the
 * previously-focused-element pattern from v1's ExportDialog, so keyboard
 * users land back on the toolbar's Templates button (2.4.3).
 *
 * Data source: CHART_TEMPLATES (utils/templates, read-only). A descriptor
 * exposes only its `create()` factory, so each card instantiates its doc
 * ONCE at setup to derive preview geometry — true page-setup aspect,
 * rows × cols grid lines and starter tints. Applying calls `create()` again
 * for a fresh, fully independent doc (ids never shared with a preview) and
 * hands it to the store: `applyTemplate` is one discrete undo step that
 * replaces the doc and clears selection, satisfying the undoable/no-selection
 * contract.
 *
 * Tokens: Poster Desk palette referenced via var(--paper/--ink/--text/
 * --muted/--desk/--mint/--mint-soft/--line) with no local definitions.
 * Radii are the approved Poster Desk scale (controls 8 / cards 10 / sheet 14);
 * main.css still carries v1 values, so they are literal px here. The card
 * hover ring uses var(--mint-deep) — the dark-mint token that exists globally
 * (the mockup's private --mint-ink is not part of the shared token set).
 *
 * Anton 400 uppercase appears HERE only on the gallery headline — one of the
 * two sanctioned surfaces (the other is the canvas empty state). Everything
 * else is Work Sans.
 */
import { nextTick, onScopeDispose, ref, useId, watch } from 'vue'
import { useChartStore } from '../../stores/chart'
import { CHART_TEMPLATES } from '../../utils/templates'
import type { TemplateDescriptor } from '../../utils/templates'
import { PAGE_PRESETS, pageDims } from '../../utils/page-presets'
import type { ChartDoc } from '../../types/chart'

const props = defineProps<{
  /** Open state — the parent owns it; the dialog renders nothing while false. */
  open: boolean
}>()

const emit = defineEmits<{
  /** Ask the parent to close (Esc, scrim click, ✕, after applying). */
  closed: []
  /** A template replaced the doc — payload is the fresh ChartDoc applied. */
  applied: [doc: ChartDoc]
}>()

const titleId = useId()
const chartStore = useChartStore()

/** One gallery card: descriptor + preview geometry derived from its doc. */
interface TemplateCard {
  descriptor: TemplateDescriptor
  name: string
  description: string
  rows: number
  cols: number
  /** CSS aspect-ratio value from the template's page setup — true sheet aspect. */
  aspectCss: string
  pageLabel: string
  orientationLabel: string
  /** Per-cell starter tint for the schematic preview; null = dashed empty. */
  cells: Array<string | null>
}

// The instantiated doc IS the preview's data source (a descriptor exposes
// only the factory), so each template is created exactly once at setup.
const templateCards: TemplateCard[] = CHART_TEMPLATES.map((descriptor) => {
  const doc = descriptor.create()
  const { widthMm, heightMm } = pageDims(doc.pageSetup.preset, doc.pageSetup.orientation)
  return {
    descriptor,
    name: descriptor.name,
    description: descriptor.description,
    rows: doc.grid.rows,
    cols: doc.grid.cols,
    aspectCss: `${widthMm} / ${heightMm}`,
    pageLabel: PAGE_PRESETS[doc.pageSetup.preset].label,
    orientationLabel: doc.pageSetup.orientation === 'landscape' ? 'Landscape' : 'Portrait',
    cells: doc.cells.map((cell) => cell.color ?? null),
  }
})

/** The modal surface — Tab is trapped inside it while open. */
const dialogRef = ref<HTMLDivElement | null>(null)
/** Where focus came from; restored on close so keyboard users land back
 *  on the toolbar trigger (WCAG 2.4.3). */
let previouslyFocused: HTMLElement | null = null

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

// Esc closes + Tab is trapped while open; focus lands on the first template
// card and returns to the trigger on close. Listener lifecycle tracks the
// `open` prop so nothing lingers after close/unmount.
watch(
  () => props.open,
  (isOpen) => {
    if (typeof window === 'undefined') return
    if (isOpen) {
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      window.addEventListener('keydown', onKeydown)
      void nextTick(() => {
        dialogRef.value?.querySelector<HTMLButtonElement>('.tpl-card')?.focus()
      })
    } else {
      window.removeEventListener('keydown', onKeydown)
      if (previouslyFocused !== null && previouslyFocused.isConnected) {
        previouslyFocused.focus()
      }
      previouslyFocused = null
    }
  },
  { immediate: true },
)

onScopeDispose(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown)
})

function requestClose(): void {
  emit('closed')
}

/** Apply a starter template: fresh doc → store (undoable, selection cleared),
 *  announce it, then close. */
function applyTemplate(descriptor: TemplateDescriptor): void {
  const doc = descriptor.create()
  chartStore.applyTemplate(doc)
  emit('applied', doc)
  requestClose()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="requestClose">
      <div ref="dialogRef" class="dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <header class="dialog-head">
          <div class="dialog-heading">
            <h2 :id="titleId" class="gallery-title">Start from a <span class="hl">template.</span></h2>
            <p class="gallery-sub">
              Each template sets the page size, the grid and starter cards. Change anything
              afterwards — every card stays editable.
            </p>
          </div>
          <button
            type="button"
            class="close-btn"
            aria-label="Close templates"
            @click="requestClose"
          >
            <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true">
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

        <div class="tpl-grid">
          <button
            v-for="card in templateCards"
            :key="card.name"
            type="button"
            class="tpl-card"
            @click="applyTemplate(card.descriptor)"
          >
            <!-- Decorative schematic; the button's name is name+meta+desc. -->
            <span class="tpl-preview" aria-hidden="true">
              <span class="tp-sheet" :style="{ aspectRatio: card.aspectCss }">
                <span
                  class="tp-grid"
                  :style="{
                    gridTemplateColumns: `repeat(${card.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${card.rows}, 1fr)`,
                  }"
                >
                  <span
                    v-for="(fill, index) in card.cells"
                    :key="index"
                    class="tp-c"
                    :class="{ 'tp-filled': fill !== null }"
                    :style="fill !== null ? { background: fill } : undefined"
                  />
                </span>
              </span>
            </span>
            <span class="tpl-text">
              <span class="tpl-name">{{ card.name }}</span>
              <span class="tpl-meta">
                {{ card.pageLabel }} · {{ card.orientationLabel }} · {{ card.rows }} × {{ card.cols }}
              </span>
            </span>
            <span class="tpl-desc">{{ card.description }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Scrim — flat band-ink tint at the mockup's 62%; a real element that
   blocks clicks. Mount-only fade (no exit transition to freeze). */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(14, 18, 13, 0.62);
  animation: overlay-in 200ms ease both;
}

/* The dialog floats — the one legal overlay elevation; Poster Desk paper
   sheet at the approved 14px radius. */
.dialog {
  width: min(920px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 26px 28px 28px;
  background: var(--paper);
  border-radius: var(--r-panel, 14px);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4),
    0 36px 72px -24px rgba(0, 0, 0, 0.6);
  animation: dialog-in 200ms ease both;
}

@keyframes overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Fade + scale-in per the approved motion spec (transform/opacity only). */
@keyframes dialog-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

.dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

/* Anton 400 uppercase — sanctioned surface #2 (with the empty-state headline). */
.gallery-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  font-size: 30px;
  line-height: 1.05;
  color: var(--ink);
}

/* Mint highlight-block treatment from the landing DNA; breaks cleanly
   across lines via box-decoration-break clone. */
.gallery-title .hl {
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  background: var(--mint);
  border-radius: 0.08em;
  padding: 0 0.14em;
}

.gallery-sub {
  margin: 8px 0 0;
  max-width: 58ch;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--muted);
}

/* 32px quiet icon button — top-bar icon language; 120ms hover. */
.close-btn {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.close-btn:hover {
  background: var(--desk);
  color: var(--text);
}

.tpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(152px, 1fr));
  gap: 12px;
}

/* Card = one action (no aria-pressed state); 120ms hover lift toward mint. */
.tpl-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  text-align: left;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--r-card, 10px);
  cursor: pointer;
  transition:
    translate 120ms ease,
    border-color 120ms ease,
    background-color 120ms ease;
}

.tpl-card:hover {
  translate: 0 -2px;
  border-color: var(--mint-deep);
  background: var(--mint-soft);
}

.tpl-preview {
  display: grid;
  place-items: center;
  padding: 10px;
  background: var(--desk);
  border-radius: 6px;
}

/* True-aspect sheet: height fixed, width derives from the inline
   aspect-ratio (mm-exact per page setup), so A4 portrait and A5
   landscape read as different sheets. */
.tp-sheet {
  position: relative;
  height: 84px;
  background: var(--paper);
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

.tp-grid {
  position: absolute;
  inset: 5px;
  display: grid;
  gap: 2px;
}

/* Grid lines: dashed empty cells; starter-tint cells fill solid. */
.tp-c {
  display: grid;
  place-items: center;
  border: 1px dashed var(--line);
  border-radius: 2px;
  overflow: hidden;
}

.tp-c.tp-filled {
  border-style: solid;
  border-color: transparent;
}

.tpl-text {
  display: flex;
  flex-direction: column;
}

.tpl-name {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ink);
}

.tpl-meta {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.tpl-desc {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--muted);
}

/* Reduced motion kills the dialog animation and every hover transition. */
@media (prefers-reduced-motion: reduce) {
  .overlay,
  .dialog {
    animation: none;
  }

  .tpl-card,
  .close-btn {
    transition: none;
  }
}
</style>
