<script setup lang="ts">
/**
 * index.vue — the builder screen. The ONLY place that composes the shell
 * (subtask chart-app-v2-15; contract context line 73; builder blueprint,
 * direction.json line 152).
 *
 * Desktop (≥640px): framed-sheet shell — the 44px AppTopBar on the window
 * ground, then a workspace row with 8px outer margins and a 12px gap holding
 * the 300px IconBrowser panel and the white ChartSheet (flex-1; the sheet
 * fits/centers itself via its container queries). StyleControls floats
 * top-right OVER the sheet area and SlotEditor bottom-right — both absolute,
 * 12px inset, surface + 1px border, NO shadow at rest (house rule; the 1px
 * border against the white sheet is the elevation).
 *
 * Phone (<640px, direction phone rule): the frame disappears — the sheet is
 * the screen between the 44px top bar and a 44px bottom bar whose single
 * 'Browse icons' action opens the browser as a bottom sheet (max 55dvh,
 * slides). StyleControls and SlotEditor use the same bottom-sheet pattern;
 * on phone the three sheets are mutually exclusive (one at a time) and every
 * touch target is ≥44px.
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
import type { LabelSize } from '~/components/StyleControls.vue'
import { useChartStore } from '~/stores/chart'
import { useExport } from '~/composables/useExport'

/** Breakpoint where the browser leaves its phone bottom sheet and docks into the row (Tailwind sm). */
const WIDE_QUERY = '(min-width: 640px)'

const chart = useChartStore()
const { printChart } = useExport()

// --- Page-owned UI state ---

const exportOpen = ref(false)
const styleOpen = ref(false)
const browserOpen = ref(false)
const labelSize = ref<LabelSize>('m')

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
 * SlotEditor 'replace': bring the browser forward and put the caret in its
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
})

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', syncIsWide)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="builder">
    <AppTopBar
      @toggle-style="onToggleStyle"
      @open-export="exportOpen = true"
      @print="printChart"
    />

    <!-- Workspace row: 8px outer margins, 12px gap; fills the rest of the window -->
    <div class="workspace">
      <!-- Icon browser: static 300px panel on desktop, bottom sheet on phone -->
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

      <!-- The white sheet: flex-1; ChartSheet fits/centers the A4 area inside -->
      <div class="sheet-area" :data-label-size="labelSize">
        <ChartSheet />

        <!-- Chart style: floating top-right over the sheet (desktop), bottom sheet (phone) -->
        <Transition :name="isWide ? 'panel' : 'sheet'">
          <div v-show="styleOpen" class="style-dock">
            <StyleControls
              @close="styleOpen = false"
              @label-size="onLabelSize"
            />
          </div>
        </Transition>

        <!-- Card editor: floating bottom-right (desktop), bottom sheet (phone) -->
        <Transition :name="isWide ? 'panel' : 'sheet'">
          <div v-if="chart.selectedSlot !== null" class="editor-dock">
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
  </div>
</template>

<style scoped>
/*
 * Shell geometry (builder blueprint, direction.json line 152): the L-frame
 * is the window ground; the workspace row carries the 8px outer margins and
 * the 12px gutter; no shadow anywhere at rest.
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

/* Sheet cell: relative anchor for the two floating docks */
.sheet-area {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
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
  /* Width comes from the browser panel's own md:w-[300px]; the dock is a
     pass-through on desktop (block, stretched to the row height). */
}

@media (min-width: 640px) {
  .browser-dock {
    flex: none;
    /* The dock owns the 300px (the browser's own md:w-[300px] only starts at
       768px; its w-full fills this box below that). */
    width: 300px;
  }

  .style-dock {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 20;
  }

  .editor-dock {
    position: absolute;
    bottom: 12px;
    right: 12px;
    z-index: 20;
  }
}

/* --- Phone (<640px): the sheet is the screen; panels become bottom sheets */

.phone-bar {
  display: none;
}

@media (max-width: 639.98px) {
  .workspace {
    /* The frame disappears: no insets — sheet edge-to-edge between the bars */
    margin: 0;
  }

  .phone-bar {
    display: block;
    flex: none;
    position: relative;
    z-index: 50; /* bottom sheets (z-40) slide beneath the bar, not over it */
    background: var(--ground);
    border-top: 1px solid var(--border);
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
     capped at 55dvh, surface + top hairline, radius top 16. */
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
    padding: 12px;
    overflow-y: auto;
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-radius: 16px 16px 0 0;
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
