<script setup lang="ts">
/**
 * index.vue — the builder screen (app sheet "Framed sheet", builder canvas).
 *
 * Desktop (≥640px): the stone ground holds a 44px AppTopBar (no rule) and a
 * workspace row with 8px outer margins and a 12px gutter: the 232px icon
 * palette dock and the canvas — a flat well one step darker than the ground
 * (--well, 16px radius) with the white A4 sheet resting on it. SlotEditor
 * floats top-right INSIDE the well, 12px inset, surface + 1px border, no
 * elevation at rest.
 *
 * Editing is WYSIWYG: the title edits on the sheet, labels edit on their
 * cards, and palette icons place by click (selected slot first, else first
 * empty) or by dragging onto any card (IconDragGhost follows the pointer).
 *
 * Phone (<640px): the frame disappears — the sheet is the screen between the
 * 44px top bar and a 44px bottom bar whose single 'Browse icons' action opens
 * the palette as a bottom sheet (max 55dvh, slides). The editor and style
 * panel use the same bottom-sheet pattern; on phone the three sheets are
 * mutually exclusive and every touch target is ≥44px.
 *
 * Page-owned state: exportOpen / styleOpen / browserOpen (panel visibility),
 * labelSize (bridges StyleControls' label-size emit onto the sheet via
 * data-label-size → --slot-label-scale, consumed by ChartSheet's label CSS).
 * Slot selection lives in the chart store; the store's selectedSlot drives
 * SlotEditor and the selected-card highlight on its own. Escape closes
 * export → style → browser sheet (phone) → clears the selection.
 *
 * Print: the top bar's print emit goes straight to useExport().printChart()
 * — the dedicated print stylesheet (main.css) pins [data-chart-sheet] to the
 * A4 page; no dialog in that path. The Export dialog owns PNG/PDF + the
 * dialog-print flow.
 */
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppTopBar from '~/components/AppTopBar.vue'
import IconBrowser from '~/components/IconBrowser.vue'
import ChartSheet from '~/components/ChartSheet.vue'
import SlotEditor from '~/components/SlotEditor.vue'
import StyleControls from '~/components/StyleControls.vue'
import ExportDialog from '~/components/ExportDialog.vue'
import IconDragGhost from '~/components/IconDragGhost.vue'
import type { LabelSize } from '~/components/StyleControls.vue'
import { useChartStore } from '~/stores/chart'
import { useExport } from '~/composables/useExport'

/** Breakpoint where the browser leaves its phone bottom sheet and docks into the row (Tailwind sm). */
const WIDE_QUERY = '(min-width: 640px)'

/** Editor panel geometry (must match SlotEditor's .panel width + dock inset). */
const EDITOR_WIDTH = 232
const EDITOR_INSET = 8

const chart = useChartStore()
const { printChart } = useExport()

// --- Page-owned UI state ---

const exportOpen = ref(false)
const styleOpen = ref(false)
const browserOpen = ref(false)
const labelSize = ref<LabelSize>('m')
/** Anchored editor position (px within the canvas well); desktop only. */
const editorPos = ref<{ top: number; left: number } | null>(null)

/** The canvas well element — the editor's positioning context. */
const sheetArea = ref<HTMLDivElement | null>(null)

/**
 * Anchor the editor to the selected card (direct manipulation: the tools
 * appear at the thing being edited). Measured from the live DOM after the
 * selection renders; clamped to the well so it never leaves the canvas.
 * Falls back to the well's top-right corner if the card can't be measured.
 */
function positionEditor(): void {
  if (!isWide.value) {
    editorPos.value = null
    return
  }
  const well = sheetArea.value
  if (well === null) return
  const wellRect = well.getBoundingClientRect()
  const card = well.querySelector<HTMLElement>('.slot-cell.is-selected')
  if (card === null) {
    editorPos.value = null
    return
  }
  const cardRect = card.getBoundingClientRect()
  const left = Math.min(
    Math.max(cardRect.left - wellRect.left, EDITOR_INSET),
    wellRect.width - EDITOR_WIDTH - EDITOR_INSET,
  )
  // Prefer below the card; flip above when the panel would leave the well.
  const below = cardRect.bottom - wellRect.top + EDITOR_INSET
  const estimatedPanelHeight = 200
  const top =
    below + estimatedPanelHeight > wellRect.height
      ? Math.max(cardRect.top - wellRect.top - estimatedPanelHeight - EDITOR_INSET, EDITOR_INSET)
      : below
  editorPos.value = { top, left }
}

/**
 * True at ≥640px — desktop docks are always visible, bottom sheets only
 * exist on phone. Read synchronously (SPA, ssr:false) so the first desktop
 * paint already has the browser docked; kept in sync on resize.
 */
const isWide = ref(typeof window !== 'undefined' ? window.matchMedia(WIDE_QUERY).matches : true)

let mediaQuery: MediaQueryList | null = null

function syncIsWide(): void {
  if (mediaQuery !== null) isWide.value = mediaQuery.matches
}

// --- Panel actions ---

function onToggleStyle(): void {
  // Phone: the sheets are mutually exclusive — opening style closes the others.
  if (!isWide.value && !styleOpen.value) {
    chart.selectSlot(null)
    browserOpen.value = false
  }
  styleOpen.value = !styleOpen.value
}

function onToggleBrowser(): void {
  // Phone only (the bar is display:none on desktop). Opening the palette is
  // the pure add-to-first-empty flow: drop any selection so the editor sheet
  // can't sit underneath.
  if (!browserOpen.value && !isWide.value) {
    chart.selectSlot(null)
    styleOpen.value = false
  }
  browserOpen.value = !browserOpen.value
}

function onLabelSize(size: LabelSize): void {
  labelSize.value = size
}

// --- Replace flow ---

/**
 * IconBrowser exposes no API, so the search input is reached through the
 * dock element (it wraps the browser root). No-op if unreachable.
 */
const browserDock = ref<HTMLDivElement | null>(null)

async function focusBrowserSearch(): Promise<void> {
  await nextTick()
  browserDock.value?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
}

/**
 * SlotEditor 'replace': bring the palette forward and put the caret in its
 * search input. The selection is deliberately KEPT — IconBrowser places into
 * the selected slot when one exists (clearing it would send the replacement
 * to the first empty slot instead). On phone the browser sheet opens over
 * the editor; the pick closes it again (onPick) and the editor reappears.
 */
function onReplace(): void {
  if (!isWide.value) browserOpen.value = true
  void focusBrowserSearch()
}

/** After a placement on phone, close the browser sheet to reveal the chart. */
function onPick(): void {
  if (!isWide.value) browserOpen.value = false
}

// --- Phone one-sheet-at-a-time: a fresh card selection closes the other sheets ---

watch(
  () => chart.selectedSlotId,
  (id) => {
    if (id !== null && !isWide.value) {
      styleOpen.value = false
      browserOpen.value = false
    }
    // Anchor the editor to the newly selected card (desktop), after it renders.
    void nextTick(positionEditor)
  },
)

// Keep the anchor honest across resizes (card positions shift with the well).
function onResize(): void {
  if (chart.selectedSlotId !== null) positionEditor()
}

watch(
  () => chart.doc.grid,
  () => {
    if (chart.selectedSlotId !== null) void nextTick(positionEditor)
  },
)

// --- Keyboard: Escape unwinds export → style → browser sheet (phone) → selection.
// Deliberately acts regardless of the focused element (inputs included) —
// closing panels over an input is the expected Esc behavior. ---

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (exportOpen.value) {
    exportOpen.value = false
    return
  }
  if (styleOpen.value) {
    styleOpen.value = false
    return
  }
  if (!isWide.value && browserOpen.value) {
    browserOpen.value = false
    return
  }
  chart.selectSlot(null)
}

onMounted(() => {
  mediaQuery = window.matchMedia(WIDE_QUERY)
  syncIsWide()
  mediaQuery.addEventListener('change', syncIsWide)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', syncIsWide)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="builder">
    <AppTopBar
      @toggle-style="onToggleStyle"
      @open-export="exportOpen = true"
      @print="printChart"
    />

    <!-- Workspace row: 8px outer margins, 12px gutter; fills the rest of the window -->
    <div class="workspace">
      <!-- Icon palette: static 232px dock on desktop, bottom sheet on phone -->
      <Transition :name="isWide ? 'panel' : 'sheet'">
        <div
          v-show="isWide || browserOpen"
          id="icon-browser-sheet"
          ref="browserDock"
          class="browser-dock"
        >
          <IconBrowser @pick="onPick" />
        </div>
      </Transition>

      <!-- The canvas well: the sheet rests on it, centered; the editor anchors to the selected card -->
      <div ref="sheetArea" class="sheet-area" :data-label-size="labelSize">
        <ChartSheet />

        <!-- Chart style: floating top-right over the well (desktop), bottom sheet (phone) -->
        <Transition :name="isWide ? 'panel' : 'sheet'">
          <div v-show="styleOpen" class="style-dock">
            <StyleControls
              @close="styleOpen = false"
              @label-size="onLabelSize"
            />
          </div>
        </Transition>

        <!-- Card editor: anchored to the selected card (desktop), bottom sheet (phone) -->
        <Transition :name="isWide ? 'panel' : 'sheet'">
          <div
            v-if="chart.selectedSlot !== null"
            class="editor-dock"
            :style="editorPos !== null ? { top: editorPos.top + 'px', left: editorPos.left + 'px' } : undefined"
          >
            <SlotEditor @replace="onReplace" />
          </div>
        </Transition>
      </div>
    </div>

    <!-- Phone-only bottom bar: the screen's one primary action (≥44px target) -->
    <div class="phone-bar">
      <button
        type="button"
        class="browse-btn"
        :aria-expanded="browserOpen"
        aria-controls="icon-browser-sheet"
        @click="onToggleBrowser"
      >
        {{ browserOpen ? 'Close icons' : 'Browse icons' }}
      </button>
    </div>

    <ExportDialog :open="exportOpen" @close="exportOpen = false" />
    <IconDragGhost />
  </div>
</template>

<style scoped>
/*
 * Shell geometry (app sheet, builder canvas): the stone ground is the L
 * frame; the workspace row carries the 8px outer margins and the 12px
 * gutter; the canvas is a flat well one tone step darker; no elevation
 * anywhere at rest.
 */
.builder {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

.workspace {
  display: flex;
  flex: 1 1 0;
  gap: 12px;
  min-height: 0;
  margin: 0 8px 8px; /* 8px right/bottom inset; top bar owns the top edge */
}

/*
 * Canvas well: one tone step darker than the ground, 16px radius, 16px
 * padding so the sheet floats on it like paper on a desk mat.
 */
.sheet-area {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  background: var(--well);
  border-radius: var(--radius-sheet);
  padding: 16px;
}

/* Label size bridge: StyleControls' S/M/L → the sheet's slot label scale.
   The custom properties inherit into ChartSheet's cqw-based label rule. */
[data-label-size='s'] {
  --slot-label-scale: 0.85;
}

[data-label-size='l'] {
  --slot-label-scale: 1.25;
}

/* --- Desktop docks (≥640px) ------------------------------------------- */

.browser-dock {
  min-height: 0;
}

@media (min-width: 640px) {
  .browser-dock {
    flex: none;
    /* The palette dock owns the 232px (the blueprint's palette width). */
    width: 232px;
  }

  .style-dock {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 20;
  }

  /* The card editor anchors to its card (inline style from the page);
     absolute inside the well, above the sheet's stacking context. */
  .editor-dock {
    position: absolute;
    z-index: 20;
    width: 232px;
  }
}

/* --- Phone (<640px): the sheet is the screen; panels become bottom sheets */

.phone-bar {
  display: none;
}

@media (max-width: 639.98px) {
  .workspace {
    /* The frame disappears: no insets, no well — sheet edge-to-edge */
    margin: 0;
  }

  .sheet-area {
    background: transparent;
    border-radius: 0;
    padding: 0;
  }

  .phone-bar {
    display: block;
    flex: none;
    position: relative;
    z-index: 50; /* bottom sheets (z-40) slide beneath the bar, not over it */
    background: var(--ground);
    border-top: 1px solid var(--border); /* taste-skill-ignore */
  }

  .browse-btn {
    display: block;
    width: 100%;
    height: 44px; /* ≥44px touch target */
    padding: 0 16px;
    border: none;
    background: var(--primary);
    color: var(--surface);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    cursor: pointer;
  }

  .browse-btn:active {
    opacity: 0.85;
  }

  /* The three bottom sheets share one geometry: full-width, over the bar,
     capped at 55dvh. The panels carry their own white surface + radius;
     the dock clips them to the sheet shape. */
  .browser-dock,
  .style-dock,
  .editor-dock {
    position: fixed;
    top: auto;
    right: 0;
    bottom: 44px; /* rides on the 44px bottom bar */
    left: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    max-height: 55dvh;
    padding: 8px 8px 0;
    overflow-y: auto;
    border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  }

  /* Panels keep their own surface+border cards; center them in the sheet */
  .style-dock > *,
  .editor-dock > * {
    margin: 0 auto;
  }
}

/* --- Transitions (<400ms, transform/opacity only) ---------------------- */

/* Desktop docks: quiet fade */
.panel-enter-active,
.panel-leave-active {
  transition: opacity 160ms ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}

/* Phone bottom sheets: slide */
.sheet-enter-active,
.sheet-leave-active {
  transition: transform 240ms ease, opacity 240ms ease;
}

.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
  opacity: 0.6;
}

@media (prefers-reduced-motion: reduce) {
  .panel-enter-active,
  .panel-leave-active,
  .sheet-enter-active,
  .sheet-leave-active {
    transition: none;
  }
}
</style>
