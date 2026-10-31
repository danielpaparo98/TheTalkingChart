<script setup lang="ts">
/**
 * index.vue — the builder. Card-first: the sheet leads, and the primary
 * flow is "tap a card, type what it should say". Collection browsing is a
 * drawer (Browse pictures); the compact editor anchors to a selected
 * filled card; the word picker sprouts from the asking empty card and
 * auto-advances as the chart fills.
 *
 * Layout: desk ground → 52px top bar → the well (the A4 sheet resting on
 * it). No side panel — the library is one click away, the chart is the
 * screen. Print contract: [data-chart-sheet] + the print stylesheet.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppTopBar from '~/components/AppTopBar.vue'
import IconBrowser from '~/components/IconBrowser.vue'
import ChartSheet from '~/components/ChartSheet.vue'
import SlotEditor from '~/components/SlotEditor.vue'
import WordPicker from '~/components/WordPicker.vue'
import StyleControls from '~/components/StyleControls.vue'
import ExportDialog from '~/components/ExportDialog.vue'
import IconDragGhost from '~/components/IconDragGhost.vue'
import type { LabelSize } from '~/components/StyleControls.vue'
import { useChartStore } from '~/stores/chart'
import { useExport } from '~/composables/useExport'

definePageMeta({ layout: 'app' })

const WIDE_QUERY = '(min-width: 720px)'

const chart = useChartStore()
const { printChart } = useExport()

// --- page-owned UI state ---

const exportOpen = ref(false)
const settingsOpen = ref(false)
const browseOpen = ref(false)
const labelSize = ref<LabelSize>('m')

/** Overlay positions, in px within the well. */
const pickerPos = ref<{ top: number; left: number; sproutX: number } | null>(null)
const editorPos = ref<{ top: number; left: number } | null>(null)

const wellEl = ref<HTMLElement | null>(null)
const drawerEl = ref<HTMLElement | null>(null)

const isWide = ref(typeof window !== 'undefined' ? window.matchMedia(WIDE_QUERY).matches : true)
let mediaQuery: MediaQueryList | null = null

function syncIsWide(): void {
  if (mediaQuery !== null) isWide.value = mediaQuery.matches
}

/** First-run hint strip: visible until the first card is placed. */
const showHints = computed(() => chart.placedCount === 0)

// --- anchored positioning -------------------------------------------------

const PICKER_WIDTH = 400
const EDITOR_WIDTH = 248
const INSET = 12

/**
 * Position the word picker beside its card: below when the sheet has room,
 * above when it doesn't — with the sprout stem aligned to the card centre.
 */
function positionPicker(): void {
  const well = wellEl.value
  if (well === null || !isWide.value || chart.askingSlotId === null) {
    pickerPos.value = null
    return
  }
  const wellRect = well.getBoundingClientRect()
  const card = well.querySelector<HTMLElement>('.slot-cell.is-asking')
  if (card === null) {
    pickerPos.value = null
    return
  }
  const cardRect = card.getBoundingClientRect()
  const left = Math.min(
    Math.max(cardRect.left - wellRect.left, INSET),
    Math.max(wellRect.width - PICKER_WIDTH - INSET, INSET),
  )
  const sproutX = Math.min(
    Math.max(cardRect.left + cardRect.width / 2 - wellRect.left - left, 20),
    PICKER_WIDTH - 20,
  )
  const estimatedHeight = 340
  const below = cardRect.bottom - wellRect.top + 14
  const top =
    below + estimatedHeight > wellRect.height
      ? Math.max(cardRect.top - wellRect.top - estimatedHeight - 14, INSET)
      : below
  pickerPos.value = { top, left, sproutX }
}

/** Anchor the compact editor below the selected filled card. */
function positionEditor(): void {
  const well = wellEl.value
  if (well === null || !isWide.value || chart.selectedSlotId === null) {
    editorPos.value = null
    return
  }
  const wellRect = well.getBoundingClientRect()
  const card = well.querySelector<HTMLElement>('.slot-cell.is-selected')
  if (card === null) {
    editorPos.value = null
    return
  }
  const cardRect = card.getBoundingClientRect()
  const left = Math.min(
    Math.max(cardRect.left - wellRect.left, INSET),
    Math.max(wellRect.width - EDITOR_WIDTH - INSET, INSET),
  )
  const estimatedHeight = 190
  const below = cardRect.bottom - wellRect.top + 12
  const top =
    below + estimatedHeight > wellRect.height
      ? Math.max(cardRect.top - wellRect.top - estimatedHeight - 12, INSET)
      : below
  editorPos.value = { top, left }
}

function repositionAnchors(): void {
  void nextTick(() => {
    positionPicker()
    positionEditor()
  })
}

// --- panel actions ---------------------------------------------------------

function onToggleBrowse(): void {
  browseOpen.value = !browseOpen.value
  if (browseOpen.value) {
    // browsing pauses the card-first flow: the asking card keeps its place
    if (!isWide.value) chart.askSlot(null)
    void nextTick(() => drawerEl.value?.querySelector<HTMLInputElement>('input[type="search"]')?.focus())
  }
}

function onToggleSettings(): void {
  settingsOpen.value = !settingsOpen.value
}

function onToggleStyleLabelSize(size: LabelSize): void {
  labelSize.value = size
}

/** After a drawer pick on phone, close the drawer to reveal the chart. */
function onDrawerPick(): void {
  if (!isWide.value) browseOpen.value = false
}

// --- keyboard: Escape unwinds export → settings → drawer → picker → selection

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (exportOpen.value) {
    exportOpen.value = false
    return
  }
  if (settingsOpen.value) {
    settingsOpen.value = false
    return
  }
  if (browseOpen.value) {
    browseOpen.value = false
    return
  }
  if (chart.askingSlotId !== null) {
    chart.askSlot(null)
    return
  }
  chart.selectSlot(null)
}

// --- watchers --------------------------------------------------------------

watch(
  () => chart.askingSlotId,
  () => repositionAnchors(),
)

watch(
  () => chart.selectedSlotId,
  () => repositionAnchors(),
)

watch(
  () => chart.doc.grid,
  () => repositionAnchors(),
)

function onResize(): void {
  repositionAnchors()
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
      @toggle-browse="onToggleBrowse"
      @toggle-settings="onToggleSettings"
      @open-export="exportOpen = true"
      @print="printChart"
    />

    <!-- the desk: the sheet rests here, nothing else competes -->
    <main ref="wellEl" class="well" :data-label-size="labelSize" aria-label="Chart sheet">
      <ChartSheet />

      <!-- the word picker, sprouting from the asking card -->
      <Transition name="pop">
        <WordPicker
          v-if="chart.askingSlot !== null"
          class="picker-anchor"
          :style="
            pickerPos !== null
              ? { top: pickerPos.top + 'px', left: pickerPos.left + 'px', '--sprout-x': pickerPos.sproutX + 'px' }
              : undefined
          "
          @close="chart.askSlot(null)"
        />
      </Transition>

      <!-- the compact editor, anchored to the selected filled card -->
      <Transition name="pop">
        <div
          v-if="chart.selectedSlot !== null"
          class="editor-anchor"
          :style="editorPos !== null ? { top: editorPos.top + 'px', left: editorPos.left + 'px' } : undefined"
        >
          <SlotEditor @replace="onToggleBrowse" />
        </div>
      </Transition>

      <!-- chart settings popover -->
      <Transition name="pop">
        <div v-if="settingsOpen" class="settings-anchor">
          <StyleControls @close="settingsOpen = false" @label-size="onToggleStyleLabelSize" />
        </div>
      </Transition>

      <!-- first-run hints: they leave once the chart has its first card -->
      <div v-if="showHints" class="hint-strip">
        <span><b>Tap a card</b> and type what it should say</span>
        <span><b>Pick a picture</b> — the next card asks</span>
        <span><b>Click a label</b> to rename it</span>
      </div>
    </main>

    <!-- Browse pictures: the collection drawer -->
    <Transition name="drawer">
      <div v-if="browseOpen" class="drawer-scrim" @click="browseOpen = false">
        <div
          id="icon-browser-drawer"
          ref="drawerEl"
          class="drawer"
          role="dialog"
          aria-label="Browse pictures"
          @click.stop
        >
          <IconBrowser @pick="onDrawerPick" />
        </div>
      </div>
    </Transition>

    <ExportDialog :open="exportOpen" @close="exportOpen = false" />
    <IconDragGhost />
  </div>
</template>

<style scoped>
.builder {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

/* the desk: the sheet rests here, centred, nothing else competes */
.well {
  flex: 1 1 0;
  min-height: 0;
  margin: 0 14px 14px;
  border-radius: 12px;
  padding: 32px;
  position: relative;
  display: flex;
}

[data-label-size='s'] { --slot-label-scale: 0.85; }
[data-label-size='l'] { --slot-label-scale: 1.25; }

/* picker / editor / settings anchors */
.picker-anchor,
.editor-anchor,
.settings-anchor {
  position: absolute;
  z-index: 20;
}
.settings-anchor {
  top: 12px;
  right: 12px;
}

/* first-run hints: one quiet pill, three facts */
.hint-strip {
  position: absolute;
  bottom: 14px;
  left: 50%;
  translate: -50% 0;
  display: flex;
  gap: 22px;
  padding: 6px 16px;
  border-radius: 999px;
  background: var(--paper);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
.hint-strip b { font-weight: 600; color: var(--text); }

/* browse drawer: the library, one click away */
.drawer-scrim {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(19, 23, 17, 0.32);
}
.drawer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 300px;
  background: var(--paper);
  border-radius: 0 18px 18px 0;
  padding: 12px;
  overflow: hidden;
  display: flex;
}

/* transitions: transform/opacity only, <400ms, reduced-motion safe */
.pop-enter-active, .pop-leave-active { transition: opacity 150ms ease, translate 150ms ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; translate: 0 6px; }

.drawer-enter-active, .drawer-leave-active { transition: opacity 200ms ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: translate 220ms ease; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { translate: -100% 0; }

@media (prefers-reduced-motion: reduce) {
  .pop-enter-active, .pop-leave-active,
  .drawer-enter-active, .drawer-leave-active,
  .drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: none; }
}

/* ---------------- phone: its own composition ---------------- */
@media (max-width: 720px) {
  .well { padding: 14px; margin: 0 10px 10px; overflow-y: auto; display: block; }
  .picker-anchor, .editor-anchor, .settings-anchor { position: fixed; left: 10px; right: 10px; top: auto; bottom: 10px; z-index: 30; }
  .settings-anchor { top: auto; }
  .hint-strip { display: none; }
  .drawer { width: min(320px, 86vw); }
}
</style>
