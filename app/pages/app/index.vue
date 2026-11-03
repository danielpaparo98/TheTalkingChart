<script setup lang="ts">
/**
 * The builder v2 — thin composition root (subtask 15). This file owns
 * NOTHING visual: it mounts the landed builder contracts into BuilderShell's
 * four regions, wires every emitted event to the store/routing, and hosts
 * the page-level behaviour that no landed component may own:
 *
 *  - the global keyboard layer — Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z and
 *    Ctrl+Y redo (skipped while typing in fields), and the Escape unwind
 *    export → templates → inspector sheet → library drawer → deselect,
 *    ONE layer per press: this page is the sole owner of the sheet-closing
 *    layer (the inspector panel adds no Escape of its own);
 *  - the `builder-cell-place` hand-off: GridCell validates a library drop
 *    and dispatches the bubbling CustomEvent `LIBRARY_PLACE_EVENT` with
 *    detail `{ index, payload }` (useCellDrag.emitLibraryPlace); the page
 *    writes the cell and records the placement through the shared recents
 *    singleton (both strips show it) — keeping PageGrid's frozen 5-event
 *    leak.
 *  - screen-reader live announcements (placements, removals, undo/redo) and
 *    focus return for the shell's drawers/sheet (v1 indexes/index pattern).
 *
 * The `@page` size rule is kept live by `usePageSetup` (managed style tag);
 * this page activates it here so print/export track the doc state even
 * before the sheet mounts a second (refcounted) consumer.
 */
definePageMeta({ layout: 'app' })

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BuilderShell from '~/components/builder/BuilderShell.vue'
import BuilderToolbar from '~/components/builder/BuilderToolbar.vue'
import LibraryPanel from '~/components/builder/LibraryPanel.vue'
import PrintCanvas from '~/components/builder/PrintCanvas.vue'
import PrintPage from '~/components/builder/PrintPage.vue'
import PageGrid from '~/components/builder/PageGrid.vue'
import InspectorPanel from '~/components/builder/InspectorPanel.vue'
import TemplateGallery from '~/components/builder/TemplateGallery.vue'
import ExportDialog from '~/components/builder/ExportDialog.vue'
import { useChartStore } from '~/stores/chart'
import { useCatalogStore } from '~/stores/catalog'
import { usePageSetup } from '~/composables/usePageSetup'
import { useExport } from '~/composables/useExport'
import { useRecents } from '~/composables/useRecents'
import { LIBRARY_PLACE_EVENT } from '~/composables/useCellDrag'
import type { LibraryPlaceDetail } from '~/composables/useCellDrag'
import type { LibraryNotice } from '~/components/builder/LibraryPanel.vue'
import { isCellEmpty, nextEmptyCellIndex } from '~/utils/doc-reducers'
import { PAGE_PRESETS, formatMm } from '~/utils/page-presets'
import type { IconRef, IconSetMeta } from '~/types/icons'

const chart = useChartStore()
const catalog = useCatalogStore()// The builder-wide recents singleton: placements recorded through the page
// (this module) surface on every recents strip and persist across reloads.
const { record: recordRecent } = useRecents()

/**
 * Document title tracks the chart title (bookmarks/history/tabs announce the
 * sheet's name; WCAG page-context quality). Reactive getter, defined after
 * the store exists.
 */
useHead({
  title: () => {
    const name = chart.doc.title.trim()
    return name !== '' ? `${name} — The Talking Chart` : 'Chart builder — The Talking Chart'
  },
  meta: [
    {
      name: 'description',
      content:
        'Build a printable picture communication chart: pick from 50,000 icons, place them on the grid, label each card, and print. Free and works offline.',
    },
  ],
})

// --- page-owned UI state (the shell/dialog open states live HERE) ----------

const templatesOpen = ref(false)
const exportOpen = ref(false)
const libraryOpen = ref(false)
const inspectorOpen = ref(false)

// --- page geometry + the managed @page rule --------------------------------

const { dimsMm, aspectRatio, marginMm } = usePageSetup({ setup: () => chart.doc.pageSetup })

/** Mockup canvas-status caption, e.g. "A4 · portrait · 210 × 297 mm". */
const pageLabel = computed(() => {
  const setup = chart.doc.pageSetup
  const dims = dimsMm.value
  return `${PAGE_PRESETS[setup.preset].label} · ${setup.orientation} · ${formatMm(dims.widthMm)} × ${formatMm(dims.heightMm)} mm`
})

/**
 * PrintPage computes its print margins from `--margin-mm` (declared above
 * --page-w-mm in its sheet geometry); the page publishes it so the sheet's
 * padding tracks the doc's margin preset.
 */
const sheetStyleVars = computed<Record<string, string>>(() => ({ '--margin-mm': String(marginMm.value) }))

// --- export/attribution (decision 10: the credit rides the sheet) ----------

function resolveSetMeta(prefix: string): IconSetMeta | null {
  return catalog.sets.find((meta) => meta.prefix === prefix) ?? null
}

const { printChart, attribution } = useExport({ doc: () => chart.doc, resolveSetMeta })

/**
 * Storage failure → the desk's attention line (PrintCanvas `notice`):
 * role=alert so screen readers announce the failure assertively, and it
 * stays visible while the user keeps working (store re-clears it on the
 * first successful write).
 */
const storageNote = computed(() =>
  chart.storageError ? 'Not saved — storage unavailable' : null,
)

// --- first-run empty state (Anton headline; sanctioned surface #1) ----------

const gridEmpty = computed(() => chart.doc.cells.every((cell) => isCellEmpty(cell)))

// --- screen-reader announcements (WCAG 4.1.3, v1 semantics) ----------------

const announcement = ref('')

function announce(message: string): void {
  // Clear first so repeated identical messages re-announce.
  announcement.value = ''
  void nextTick(() => {
    announcement.value = message
  })
}

/**
 * Visible placement feedback for the library panel (the chip): same news
 * the live region carries, shown to every user. Auto-clears after 4s so
 * stale news never lingers into unrelated work; opening the drawer
 * resets it for a clean slate.
 */
const libraryNotice = ref<LibraryNotice | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | null = null

function showLibraryNotice(message: string, tone: LibraryNotice['tone'] = 'ok'): void {
  libraryNotice.value = { message, tone }
  if (noticeTimer !== null) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    noticeTimer = null
    libraryNotice.value = null
  }, 4000)
}

/** Template applies replace the doc wholesale — the own announcement wins. */
let omitPlacementAnnounce = false

watch(
  () => chart.placedCount,
  (now, before) => {
    if (omitPlacementAnnounce) {
      omitPlacementAnnounce = false
      return
    }
    if (now > before) announce(`Picture placed — ${now} of ${chart.gridSize} on the chart`)
    else if (now < before) announce(`Card removed — ${now} of ${chart.gridSize} filled`)
  },
)

// --- toolbar / drawer actions ----------------------------------------------

function onBack(): void {
  void navigateTo('/')
}

function toggleLibrary(): void {
  const next = !libraryOpen.value
  libraryOpen.value = next
  // Open = land inside the search (the shell focuses the drawer region).
  if (next) void nextTick(() => libraryPanel.value?.focusSearch())
}

function toggleInspector(): void {
  inspectorOpen.value = !inspectorOpen.value
}

function openTemplates(): void {
  templatesOpen.value = true
}

function openExport(): void {
  exportOpen.value = true
}

/** Toolbar's Page button: PAGE mode + keep the sheet reachable below dock. */
function openPage(): void {
  chart.askCell(null) // ask/selection are UI-only — no undo entry either way
  chart.selectCell(null)
  inspectorOpen.value = true
}

/** Toolbar history buttons mirror Ctrl/Cmd+Z — same store call, same announce. */
function onUndo(): void {
  chart.undo()
  announce('Undo — last change reversed')
}

function onRedo(): void {
  chart.redo()
  announce('Redo — change reapplied')
}

function onPrint(): void {
  printChart()
}

/** Add flow → full library hand-off: the sheet yields to the drawer. */
function onInspectorBrowse(): void {
  inspectorOpen.value = false
  libraryOpen.value = true
  void nextTick(() => libraryPanel.value?.focusSearch())
}

// --- grid events (PageGrid's frozen contract) --------------------------------

function onCellSelect(index: number): void {
  chart.selectCell(index)
  inspectorOpen.value = true // below dock: the card editor is the bottom sheet
}

function onCellAsk(index: number): void {
  chart.askCell(index)
  inspectorOpen.value = true
}

function onCellSwap(from: number, to: number): void {
  chart.swapCells(from, to)
}

/** The cell starts its own WYSIWYG editor; the edited card stays selected. */
function onLabelEdit(index: number): void {
  chart.selectCell(index)
}

/** Streamed keystrokes — the store's 600ms coalescing makes one undo step. */
function onLabelInput(index: number, label: string): void {
  chart.setLabel(index, label)
}

// --- library placements (click/keyboard path + the drag hand-off) ----------

/** LibraryPanel's exposed surface (defineExpose) — recents + drawer focus. */
interface LibraryPanelExpose {
  focusSearch(): Promise<void>
  notePlaced(icon: IconRef, label: string): void
}

const libraryPanel = ref<LibraryPanelExpose | null>(null)

/**
 * Where a fresh pick lands: asking → selected empty → first empty (mockup).
 */
function firstPlaceableIndex(): number | null {
  const asking = chart.askingCellIndex
  if (asking !== null) return asking
  const selected = chart.selectedCellIndex
  if (selected !== null) {
    const cell = chart.doc.cells[selected]
    if (cell !== undefined && isCellEmpty(cell)) return selected
  }
  return nextEmptyCellIndex(chart.doc, -1)
}

/** Below the library dock breakpoint (1080px) the drawer covers the sheet. */
function isLibraryDrawerViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1079.98px)').matches
}

function placeLibraryPick(icon: IconRef, label: string): void {
  const index = firstPlaceableIndex()
  if (index === null) {
    announce('The grid is full — add rows or columns first.')
    showLibraryNotice('The grid is full — add rows or columns first.', 'warn')
    return
  }
  const cell = chart.doc.cells[index]
  if (cell === undefined || !isCellEmpty(cell)) return
  chart.setCell(index, { ...cell, icon, label })
  chart.askNextAfter(index) // mockup: pick advances to the next empty card
  recordRecent({ icon, label }) // ALL placement paths keep the strip current
  showLibraryNotice(`Placed “${label}” · Card ${index + 1} of ${chart.doc.cells.length}`)
  // Bulk flow: the drawer stays open so more tiles can be placed. But once
  // the grid is full there is nothing left to pick for — below the dock
  // breakpoint, close it so the finished sheet is visible.
  if (nextEmptyCellIndex(chart.doc, -1) === null && isLibraryDrawerViewport()) {
    libraryOpen.value = false
  }
}

function onKeyboardPlace(icon: IconRef, label: string): void {
  placeLibraryPick(icon, label)
}

function onLibraryUpload(payload: { imageDataUrl: string; suggestedLabel: string }): void {
  const index = firstPlaceableIndex()
  if (index === null) {
    announce('The grid is full — add rows or columns first.')
    showLibraryNotice('The grid is full — add rows or columns first.', 'warn')
    return
  }
  const cell = chart.doc.cells[index]
  if (cell === undefined || !isCellEmpty(cell)) return
  const label = cell.label.trim() !== '' ? cell.label : payload.suggestedLabel
  chart.setCell(index, { ...cell, icon: null, label, imageDataUrl: payload.imageDataUrl })
  chart.askNextAfter(index)
  showLibraryNotice(`Photo added · Card ${index + 1} of ${chart.doc.cells.length}`)
  // Uploads are one-shot (no bulk picking to preserve): below the dock
  // breakpoint close the drawer so the user sees the photo land.
  if (isLibraryDrawerViewport()) libraryOpen.value = false
}

/**
 * Library drop onto a card (bubbling CustomEvent from GridCell): empty cards
 * fill + advance (mockup); filled cards swap the picture keeping the card's
 * label, tint and text-only state. Recents refresh via the exposed panel.
 */
function onCellPlace(event: Event): void {
  if (!(event instanceof CustomEvent)) return
  const detail = event.detail as LibraryPlaceDetail
  const { index, payload } = detail
  const cell = chart.doc.cells[index]
  if (cell === undefined) return
  if (isCellEmpty(cell)) {
    chart.setCell(index, { ...cell, icon: payload.icon, label: payload.label })
    chart.askNextAfter(index)
    showLibraryNotice(`Placed “${payload.label}” · Card ${index + 1} of ${chart.doc.cells.length}`)
  } else {
    chart.setCell(index, { ...cell, icon: payload.icon, imageDataUrl: undefined })
    showLibraryNotice('Picture replaced')
  }
  libraryPanel.value?.notePlaced(payload.icon, payload.label)
}

/** Listener lifecycle tracks the v-if'd grid wrapper (empty state swaps it). */
const gridRegionEl = ref<HTMLElement | null>(null)

watch(gridRegionEl, (element, previous) => {
  if (previous !== null) previous.removeEventListener(LIBRARY_PLACE_EVENT, onCellPlace)
  if (element !== null) element.addEventListener(LIBRARY_PLACE_EVENT, onCellPlace)
})

onBeforeUnmount(() => {
  gridRegionEl.value?.removeEventListener(LIBRARY_PLACE_EVENT, onCellPlace)
  if (noticeTimer !== null) clearTimeout(noticeTimer)
})

// --- template apply (one discrete undo step, owned by the store) ------------

function onTemplateApplied(): void {
  omitPlacementAnnounce = true // the template's own announcement wins
  announce('Starter template applied')
  // Expire the suppression even when the apply leaves placedCount unchanged
  // (e.g. Blank) — pre-flush watchers run before this nextTick clears it.
  void nextTick(() => {
    omitPlacementAnnounce = false
  })
}

// --- global keyboard: undo/redo + Escape unwind (v1 shape, v2 layers) ------

function isFieldTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  )
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && !isFieldTarget(event.target)) {
    const key = event.key.toLowerCase()
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) {
        chart.redo()
        announce('Redo — change reapplied')
      } else {
        chart.undo()
        announce('Undo — last change reversed')
      }
      return
    }
    if (key === 'y') {
      event.preventDefault()
      chart.redo()
      announce('Redo — change reapplied')
    }
    return
  }

  if (event.key !== 'Escape') return
  // Unwind ONE layer per press; focus return is handled by the watches below
  // (drawers/sheet) and by the dialogs themselves (their contracts own it).
  // This page is the SOLE owner of the sheet-closing layer: InspectorPanel
  // adds no Escape handling of its own (its inner editors stop propagation),
  // so a card-selected user closes the sheet on one press and deselects on
  // the next — never both layers in a single press.
  if (exportOpen.value) {
    exportOpen.value = false
    return
  }
  if (templatesOpen.value) {
    templatesOpen.value = false
    return
  }
  if (inspectorOpen.value) {
    inspectorOpen.value = false
    return
  }
  if (libraryOpen.value) {
    libraryOpen.value = false
    return
  }
  chart.askCell(null)
  chart.selectCell(null)
}

// --- drawer/sheet focus return (v1 pattern: restore the opener) -------------

let libraryTrigger: HTMLElement | null = null
let inspectorTrigger: HTMLElement | null = null

/**
 * `flush: 'post'` — the shell clears its background-inert (toolbar inert
 * while the drawer is open) in the same DOM patch, and a trigger INSIDE that
 * inert tree cannot take focus until the attribute is gone. Pre-flush would
 * call .focus() on an inert button (silently fails).
 */
watch(libraryOpen, (open) => {
  if (open) {
    libraryNotice.value = null // fresh drawer, clean slate for the chip
    libraryTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return
  }
  const trigger = libraryTrigger
  libraryTrigger = null
  if (trigger !== null && trigger.isConnected) trigger.focus()
}, { flush: 'post' })

watch(inspectorOpen, (open) => {
  if (open) {
    inspectorTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return
  }
  const trigger = inspectorTrigger
  inspectorTrigger = null
  if (trigger !== null && trigger.isConnected) trigger.focus()
}, { flush: 'post' })

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('keydown', onKeydown)
})

</script>

<template>
  <div>
    <!-- screen-reader announcements: placements, removals, undo/redo -->
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

    <BuilderShell v-model:library-open="libraryOpen" v-model:inspector-open="inspectorOpen">
      <template #toolbar>
        <BuilderToolbar
          :library-open="libraryOpen"
          :inspector-open="inspectorOpen"
          @back="onBack"
          @toggle-library="toggleLibrary"
          @toggle-inspector="toggleInspector"
          @open-templates="openTemplates"
          @open-page="openPage"
          @open-export="openExport"
          @print="onPrint"
          @undo="onUndo"
          @redo="onRedo"
        />
      </template>

      <template #library>
        <LibraryPanel
          ref="libraryPanel"
          :notice="libraryNotice"
          :on-keyboard-place="onKeyboardPlace"
          @upload="onLibraryUpload"
        />
      </template>

      <template #canvas>
        <PrintCanvas :aspect-ratio="aspectRatio" :page-label="pageLabel" :notice="storageNote">
          <PrintPage
            :page-setup="chart.doc.pageSetup"
            :margin-mm="marginMm"
            :title="chart.doc.title"
            :style="sheetStyleVars"
            @update:title="chart.setTitle"
          >
            <template #grid>
              <!-- The grid ALWAYS renders — an all-empty chart still shows its
                   tappable dashed cells (user story: "tap a card and type").
                   The Anton empty-state sits above it as a screen-only hint
                   and disappears on print (data-screen-only). -->
              <div v-if="gridEmpty" class="sheet-empty" data-screen-only>
                <p class="se-head">Tap a <span class="hl">card.</span><br>Type a word.</p>
                <p class="se-sub">
                  Pick a picture from the library — every card prints hand-sized on this
                  sheet, at any page size.
                </p>
                <button type="button" class="se-btn" @click="openTemplates">
                  Start from a template
                </button>
              </div>
              <div ref="gridRegionEl" class="grid-region">
                <PageGrid
                  :grid="chart.doc.grid"
                  :cells="chart.doc.cells"
                  :selected-cell-index="chart.selectedCellIndex"
                  :asking-cell-index="chart.askingCellIndex"
                  @select="onCellSelect"
                  @ask="onCellAsk"
                  @swap="onCellSwap"
                  @label-edit="onLabelEdit"
                  @label-input="onLabelInput"
                />
              </div>
            </template>
            <template #foot>
              <p v-if="attribution !== ''" class="foot-attrib">{{ attribution }}</p>
            </template>
          </PrintPage>
        </PrintCanvas>
      </template>

      <template #inspector>
        <InspectorPanel @close="inspectorOpen = false" @browse="onInspectorBrowse" />
      </template>
    </BuilderShell>

    <TemplateGallery
      :open="templatesOpen"
      @applied="onTemplateApplied"
      @closed="templatesOpen = false"
    />
    <ExportDialog :open="exportOpen" :doc="chart.doc" @close="exportOpen = false" />
  </div>
</template>

<style scoped>
/* The grid wrapper keeps PageGrid's 100%-fill inside the sheet's flex box. */
.grid-region {
  width: 100%;
  height: 100%;
  min-height: 0;
}

/* — first-run empty state (mockup .sheet-empty; Anton's sanctioned
 *   micro-presence — attributed to the sheet, so every length is cqw) — */
.sheet-empty {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 2.8cqw;
  padding: 4cqw;
}

.se-head {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 6.4cqw;
  line-height: 1.04;
  color: var(--ink);
}

.se-head .hl {
  background: var(--mint);
  color: var(--ink);
  border-radius: 0.08em;
  padding: 0 0.14em;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.se-sub {
  margin: 0;
  max-width: 54cqw;
  font-size: 1.9cqw;
  line-height: 1.5;
  color: var(--muted);
}

.se-btn {
  margin-top: 1cqw;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: var(--ink);
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 120ms ease;
}
.se-btn:hover {
  opacity: 0.85;
}
.se-btn:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}

/* Attribution rides the sheet (decision 10) — quiet, wrapping, prints. */
.foot-attrib {
  margin: 0;
  font-size: 11px;
  line-height: 1.35;
  color: var(--muted);
  overflow-wrap: anywhere;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .se-btn {
    transition: none;
  }
}
</style>
