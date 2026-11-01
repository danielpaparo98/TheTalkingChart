<script setup lang="ts">
/**
 * index.vue — the builder. Card-first: the sheet leads, and the primary
 * flow is "tap a card, type what it should say". The library docks beside
 * the sheet on desktop (≥1080px — browse while you place) and is a drawer
 * below that; the compact editor anchors to a selected filled card; the
 * word picker sprouts from the asking empty card and auto-advances as the
 * chart fills.
 *
 * Layout: desk ground → 52px top bar → workspace row (library dock | the
 * well with the A4 sheet resting on it). Print contract: [data-chart-sheet]
 * + the print stylesheet.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

/** The builder names the object, not the brand — bare layout, own chrome. */
definePageMeta({ layout: 'app' })

/** The builder never set a document title — orientation for tabs, history
 *  and screen readers (WCAG 2.4.2). */
useHead({ title: 'Chart builder — The Talking Chart' })

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

const WIDE_QUERY = '(min-width: 720px)'
const DESKTOP_QUERY = '(min-width: 1080px)'

const chart = useChartStore()
const { printChart } = useExport()

// --- page-owned UI state ---

const exportOpen = ref(false)
const settingsOpen = ref(false)
const browseOpen = ref(false)
const helpOpen = ref(false)
/** First-run hints dismissed by the user; Help brings them back. */
const hintsDismissed = ref(false)
const labelSize = ref<LabelSize>('m')

/**
 * Chart-event announcements for screen readers (WCAG 4.1.3): a single
 * polite live region fed by placements, removals, undo and redo.
 */
const announcement = ref('')

function announce(message: string): void {
  // Clear first so repeated identical messages re-announce.
  announcement.value = ''
  void nextTick(() => {
    announcement.value = message
  })
}

watch(
  () => chart.placedCount,
  (now, before) => {
    if (now > before) announce(`Picture placed — ${now} of ${chart.gridSize} on the chart`)
    else if (now < before) announce(`Card removed — ${now} of ${chart.gridSize} filled`)
  },
)

/** Overlay positions, in px within the well. */
const pickerPos = ref<{ top: number; left: number; sproutX: number } | null>(null)
const editorPos = ref<{ top: number; left: number } | null>(null)

const builderEl = ref<HTMLElement | null>(null)
const wellEl = ref<HTMLElement | null>(null)

const isWide = ref(typeof window !== 'undefined' ? window.matchMedia(WIDE_QUERY).matches : true)
const isDesktop = ref(typeof window !== 'undefined' ? window.matchMedia(DESKTOP_QUERY).matches : false)
let wideQuery: MediaQueryList | null = null
let desktopQuery: MediaQueryList | null = null

function syncMedia(): void {
  if (wideQuery !== null) isWide.value = wideQuery.matches
  if (desktopQuery !== null) isDesktop.value = desktopQuery.matches
}

/** First-run hint strip: visible until the first card is placed. */
const showHints = computed(() => chart.placedCount === 0)
/** The strip renders when first-run hints apply, or Help opened them. */
const hintsVisible = computed(() => (showHints.value && !hintsDismissed.value) || helpOpen.value)

/**
 * On desktop the library docks beside the sheet (both stay visible —
 * browse while you place); below 1080px it is the overlay drawer.
 */
const dockOpen = computed(() => browseOpen.value && isDesktop.value)

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
    void nextTick(() => {
      builderEl.value?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    })
  }
}

/**
 * Focus return for the browse drawer (WCAG 2.4.3): remember the trigger
 * when the drawer opens; on close, put focus back where it started
 * instead of dropping it on <body>.
 */
let browseTrigger: HTMLElement | null = null

watch(browseOpen, (open) => {
  if (open) {
    browseTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  } else if (browseTrigger !== null) {
    // The trigger may be gone (e.g. the word picker closed with us) —
    // fall back to the top bar's Browse button so keyboard users are
    // never stranded on <body>.
    if (browseTrigger.isConnected) browseTrigger.focus()
    else builderEl.value?.querySelector<HTMLElement>('.tbtn.browse')?.focus()
    browseTrigger = null
  }
})

function onToggleSettings(): void {
  settingsOpen.value = !settingsOpen.value
}

function onToggleHelp(): void {
  helpOpen.value = !helpOpen.value
}

/** Close button on the hint strip: dismiss first-run hints for the session. */
function onDismissHints(): void {
  helpOpen.value = false
  hintsDismissed.value = true
}

function onToggleStyleLabelSize(size: LabelSize): void {
  labelSize.value = size
}

/** After a drawer pick on phone, close the drawer to reveal the chart. */
function onDrawerPick(): void {
  if (!isWide.value) browseOpen.value = false
}

/**
 * "Browse the library" from the word picker: retire the asking card's
 * picker and open the full library (dock on desktop, drawer below).
 */
function onPickerBrowse(): void {
  chart.askSlot(null)
  if (!browseOpen.value) onToggleBrowse()
}

// --- keyboard: Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z / Ctrl+Y redo · Escape
// unwinds export → settings → help → drawer → picker → selection

function onKeydown(event: KeyboardEvent): void {
  const target = event.target
  const inField =
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)

  if ((event.ctrlKey || event.metaKey) && !inField) {
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
      return
    }
  }

  if (event.key !== 'Escape') return
  if (exportOpen.value) {
    exportOpen.value = false
    return
  }
  if (settingsOpen.value) {
    settingsOpen.value = false
    return
  }
  if (helpOpen.value) {
    helpOpen.value = false
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

// Opening/closing the dock shifts the well — anchors must follow.
watch(dockOpen, () => repositionAnchors())

function onResize(): void {
  repositionAnchors()
}

onMounted(() => {
  wideQuery = window.matchMedia(WIDE_QUERY)
  desktopQuery = window.matchMedia(DESKTOP_QUERY)
  syncMedia()
  wideQuery.addEventListener('change', syncMedia)
  desktopQuery.addEventListener('change', syncMedia)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  wideQuery?.removeEventListener('change', syncMedia)
  desktopQuery?.removeEventListener('change', syncMedia)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div ref="builderEl" class="builder">
    <AppTopBar
      :browse-open="browseOpen"
      :settings-open="settingsOpen"
      :help-open="helpOpen"
      @toggle-browse="onToggleBrowse"
      @toggle-settings="onToggleSettings"
      @open-export="exportOpen = true"
      @toggle-help="onToggleHelp"
      @print="printChart"
    />

    <!-- screen-reader announcements: placements, removals, undo/redo -->
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

    <!-- the workspace: the docked library (desktop) beside the sheet's desk -->
    <div class="workspace">
      <Transition name="dock">
        <aside
          v-if="dockOpen"
          class="library-dock"
          aria-label="Picture library"
        >
          <IconBrowser @pick="onDrawerPick" />
        </aside>
      </Transition>

      <!-- the desk: the sheet rests here, nothing else competes -->
      <main ref="wellEl" class="well" :data-label-size="labelSize" aria-label="Chart sheet">
        <!-- click-away surface that closes the settings popover -->
        <div
          v-if="settingsOpen"
          class="settings-scrim"
          aria-hidden="true"
          @click="settingsOpen = false"
        ></div>

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
            @browse="onPickerBrowse"
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
          <div v-if="settingsOpen" id="chart-settings" class="settings-anchor">
            <StyleControls @close="settingsOpen = false" @label-size="onToggleStyleLabelSize" />
          </div>
        </Transition>

        <!-- hints: first-run, or summoned any time via Help -->
        <div v-if="hintsVisible" class="hint-strip" :class="{ 'is-help': helpOpen }">
          <span><b>Tap a card</b> and type what it should say</span>
          <span><b>Pick a picture</b> — the next card asks</span>
          <span><b>Click a label</b> to rename it</span>
          <button
            type="button"
            class="hint-close"
            aria-label="Dismiss hints"
            @click="onDismissHints"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </main>
    </div>

    <!-- Browse pictures: the collection drawer (below desktop widths) -->
    <Transition name="drawer">
      <div v-if="browseOpen && !isDesktop" class="drawer-scrim" @click="browseOpen = false">
        <div
          id="icon-browser-drawer"
          class="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Browse pictures"
          @click.stop
        >
          <!-- visible close: touch has no Escape key -->
          <button
            type="button"
            class="drawer-close"
            aria-label="Close pictures"
            @click="browseOpen = false"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
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

/* the workspace row: docked library (desktop) beside the sheet's desk */
.workspace {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
}

/* the docked library: 300px of always-visible browsing, sheet beside it */
.library-dock {
  flex: none;
  width: 300px;
  margin: 0 0 14px 14px;
  overflow: hidden;
}

/* the desk: the sheet rests here, centred, nothing else competes */
.well {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  margin: 0 14px 14px;
  border-radius: 12px;
  padding: 32px;
  position: relative;
  display: flex;
}

/* transparent click-away under the settings popover (above the sheet) */
.settings-scrim {
  position: absolute;
  inset: 0;
  z-index: 10;
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

/* first-run hints: one quiet pill, three facts, dismissible */
.hint-strip {
  position: absolute;
  bottom: 14px;
  left: 50%;
  translate: -50% 0;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 6px 10px 6px 16px;
  border-radius: 999px;
  background: var(--paper);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--muted);
  /* wrap instead of clipping at mid widths (WCAG 1.4.10 reflow) */
  flex-wrap: wrap;
  white-space: normal;
  max-width: calc(100% - 28px);
  text-align: left;
}
.hint-strip b { font-weight: 600; color: var(--text); }
.hint-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: none;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.hint-close:hover { background: var(--raised); color: var(--text); }

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
.drawer-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}
.drawer-close:hover { background: var(--raised); color: var(--text); }
/* keep the set-select clear of the drawer's close button */
.drawer :deep(.set-row) { padding-right: 44px; }

/* transitions: transform/opacity only, <400ms, reduced-motion safe */
.pop-enter-active, .pop-leave-active { transition: opacity 150ms ease, translate 150ms ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; translate: 0 6px; }

.dock-enter-active, .dock-leave-active { transition: opacity 160ms ease, translate 160ms ease; }
.dock-enter-from, .dock-leave-to { opacity: 0; translate: -12px 0; }

.drawer-enter-active, .drawer-leave-active { transition: opacity 200ms ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: translate 220ms ease; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { translate: -100% 0; }

@media (prefers-reduced-motion: reduce) {
  .pop-enter-active, .pop-leave-active,
  .dock-enter-active, .dock-leave-active,
  .drawer-enter-active, .drawer-leave-active,
  .drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: none; }
}

/* ---------------- phone: its own composition ---------------- */
@media (max-width: 720px) {
  .well { padding: 14px; margin: 0 10px 10px; overflow-y: auto; display: block; }
  .picker-anchor, .editor-anchor, .settings-anchor { position: fixed; left: 10px; right: 10px; top: auto; bottom: calc(10px + env(safe-area-inset-bottom)); z-index: 30; }
  .settings-anchor { top: auto; }
  /* the auto hint strip stays off on phone; Help opens it as a stacked card */
  .hint-strip { display: none; }
  .hint-strip.is-help {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    white-space: normal;
    top: 62px;
    bottom: auto;
  }
  .drawer { width: min(320px, 86vw); }
}
</style>
