<script setup lang="ts">
/**
 * InspectorPanel — the builder's single stable editing surface (Stage 1
 * interaction model: the inspector REPLACES all popovers). Exactly one mode
 * is live at a time, derived PURELY from store selection state
 * (utils/inspector-mode):
 *
 * - `page` — no selection: sheet title, paper, margins, grid, label size.
 * - `add`  — an empty card is asking (or a filled card's picture is being
 *   replaced — panel-local substate, since the store only lets empty cards
 *   ask). Search autofocuses on every entry and between auto-advances.
 * - `card` — a filled card is selected: label, tint, replace, duplicate, clear.
 *
 * Mode switches crossfade the body over 120ms: opacity fades to 0, the new
 * content swaps in at the ~60ms midpoint, and opacity restores by ~120ms —
 * a real crossfade, not a fade-then-jump (reduced-motion swaps instantly);
 * the header — mode title + close for the bottom-sheet case — never moves.
 * When a target card disappears (cleared/deselected), the derivation
 * re-runs automatically because it reads the reactive store. All document
 * mutations flow through store actions: undoable, coalesced.
 *
 * ESCAPE belongs to the PAGE (app/pages/app/index.vue): it owns closing the
 * bottom-sheet/export/templates/drawers one layer per press and ends its
 * unwind on `askCell(null)+selectCell(null)`. This panel adds NO Escape
 * handling of its own — the sheet's inner editors (label input, search
 * field) stop propagation so their own state closes with just one press.
 */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useChartStore } from '~/stores/chart'
import { deriveInspector } from '~/utils/inspector-mode'
import type { InspectorMode, InspectorPlacement } from '~/utils/inspector-mode'
import AddInspector from './AddInspector.vue'
import CellInspector from './CellInspector.vue'
import PageInspector from './PageInspector.vue'

const MODE_TITLES: Record<InspectorMode, string> = {
  page: 'Page setup',
  add: 'Add a picture',
  card: 'Edit card',
}

defineProps<{
  /** Bottom-sheet case: the shell shows the close affordance. */
  showClose?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'browse'): void
}>()

const store = useChartStore()

// --- replace substate (panel-only; the store cannot ask on a filled card) ---

const replaceIndex = ref<number | null>(null)

// Any move of the underlying selection cancels an in-flight replace.
watch([() => store.selectedCellIndex, () => store.askingCellIndex], () => {
  replaceIndex.value = null
})

const placement = computed(() =>
  deriveInspector({
    selectedCellIndex: store.selectedCellIndex,
    askingCellIndex: store.askingCellIndex,
    replaceIndex: replaceIndex.value,
    cells: store.doc.cells,
  }),
)

// --- 120ms crossfade: content swaps mid-fade, header stays put -------------
//
// Two-phase per the approved motion table: opacity ease DOWN, the new mode's
// content is swapped under the half-faded body at the midpoint, then opacity
// eases back up — so old→new is a true crossfade rather than a fade-out that
// jumps at the end.

const rendered = ref<InspectorPlacement>({ ...placement.value })
const fading = ref(false)
/** Total crossfade length (motion-safety table: 120ms, opacity only). */
const FADE_MS = 120
/** Midpoint where content swaps (half a fade each side ≈ real crossfade). */
const FADE_SWAP_MS = FADE_MS / 2
let swapTimer: ReturnType<typeof setTimeout> | null = null
let restoreTimer: ReturnType<typeof setTimeout> | null = null

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clearFadeTimers(): void {
  if (swapTimer !== null) {
    clearTimeout(swapTimer)
    swapTimer = null
  }
  if (restoreTimer !== null) {
    clearTimeout(restoreTimer)
    restoreTimer = null
  }
}

const addRef = ref<InstanceType<typeof AddInspector> | null>(null)

/** Focus the search field after the (possibly mid-fade) swap has rendered. */
function focusAddSearch(): void {
  if (rendered.value.mode !== 'add') return
  void nextTick(() => addRef.value?.focusSearch())
}

/** Reduced-motion path: swap content and restore opacity immediately. */
function swapImmediately(): void {
  rendered.value = { ...placement.value }
  fading.value = false
  focusAddSearch()
}

watch(
  () => placement.value.mode,
  (next, prev) => {
    if (next === prev) return
    clearFadeTimers()
    if (prefersReducedMotion()) {
      swapImmediately()
      return
    }
    fading.value = true
    // Phase 1 (~60ms): swap the content while the body is half-faded.
    swapTimer = setTimeout(() => {
      swapTimer = null
      rendered.value = { ...placement.value }
      focusAddSearch()
      // Phase 2 (~120ms): restore opacity for the second half of the fade.
      restoreTimer = setTimeout(() => {
        restoreTimer = null
        fading.value = false
      }, FADE_SWAP_MS)
    }, FADE_SWAP_MS)
  },
)

// Same-mode retarget (auto-advance to the next asking card) refocuses the
// search without a crossfade — mode changes are handled by the watcher above.
watch(placement, (next, prev) => {
  if (next.mode === 'add' && prev.mode === 'add' && next.targetIndex !== prev.targetIndex) {
    focusAddSearch()
  }
})

onUnmounted(() => {
  clearFadeTimers()
})

/** Numeric props for the mode children; `-1` never renders (children guard). */
const addTarget = computed(() =>
  rendered.value.mode === 'add' && rendered.value.targetIndex !== null ? rendered.value.targetIndex : -1,
)
const cardTarget = computed(() =>
  rendered.value.mode === 'card' && rendered.value.targetIndex !== null ? rendered.value.targetIndex : -1,
)

// --- quiet announcements for placements/notices (WCAG 4.1.3) ---
// (Recents live in the useRecents singleton owned by AddInspector/LibraryPanel.)

const announcement = ref('')

function onPlaced(event: { message: string }): void {
  announcement.value = event.message
}
</script>

<template>
  <aside class="inspector" aria-label="Inspector">
    <header class="insp-head">
      <span class="insp-title" aria-live="polite">{{ MODE_TITLES[rendered.mode] }}</span>
      <button
        v-if="showClose"
        type="button"
        class="close-btn"
        aria-label="Close inspector"
        @click="emit('close')"
      >
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m2.5 2.5 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="insp-body" :class="{ fading }">
      <PageInspector v-if="rendered.mode === 'page'" />
      <AddInspector
        v-else-if="rendered.mode === 'add'"
        ref="addRef"
        :target-index="addTarget"
        :replace="rendered.replace"
        @placed="onPlaced"
        @browse="emit('browse')"
      />
      <CellInspector
        v-else-if="rendered.mode === 'card'"
        :target-index="cardTarget"
        @replace="replaceIndex = cardTarget"
        @notice="onPlaced"
      />
    </div>

    <!-- The add/card flows' outcome as a visible chip: the sr-only live
         region below keeps the announcement for screen readers, this one
         shows it to everyone (same house pattern as the library panel). -->
    <p v-if="announcement !== ''" class="place-note" aria-hidden="true">{{ announcement }}</p>

    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </aside>
</template>

<style scoped>
  .inspector {
    position: relative; /* anchors the outcome chip */
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    background: var(--paper);
    font-family: 'Work Sans', sans-serif;
    color: var(--text);
  }
  .insp-head {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 1px solid var(--line);
  }
  .insp-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .close-btn {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border: none;
    background: none;
    border-radius: var(--r-ctl, 8px);
    color: var(--muted);
    cursor: pointer;
    transition: background-color 100ms ease, color 100ms ease;
  }
  .close-btn:hover { background: var(--desk); color: var(--text); }

  .insp-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    /* Crossfade: opacity only, per the approved motion table. */
    transition: opacity 120ms ease;
  }
  .insp-body.fading { opacity: 0; }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /* Outcome chip — floating pill at the panel's foot, cleared by the next
     announcement. Purely visual (aria-hidden in the template). */
  .place-note {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 3;
    margin: 0;
    padding: 7px 12px;
    border-radius: 999px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
    background: var(--pill-positive-bg);
    color: var(--pill-positive-fg);
    box-shadow: 0 2px 10px rgba(19, 23, 17, 0.14);
    pointer-events: none;
  }

  :focus-visible {
    outline: 2px solid var(--mint-ink, #1d4d16);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .insp-body { transition: none; }
  }
</style>
