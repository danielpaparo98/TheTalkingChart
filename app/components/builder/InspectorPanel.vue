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
 * Mode switches crossfade the body over 120ms (opacity only; reduced-motion
 * swaps instantly); the header — mode title + close for the bottom-sheet
 * case — never moves. When a target card disappears (cleared/deselected),
 * the derivation re-runs automatically because it reads the reactive store.
 * All document mutations flow through store actions: undoable, coalesced.
 */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useChartStore } from '~/stores/chart'
import { deriveInspector } from '~/utils/inspector-mode'
import type { InspectorMode, InspectorPlacement } from '~/utils/inspector-mode'
import { pushRecentPlacement } from '~/utils/recent-placements'
import type { RecentPlacement } from '~/utils/recent-placements'
import AddInspector from './AddInspector.vue'
import CellInspector from './CellInspector.vue'
import PageInspector from './PageInspector.vue'

/** Approved motion table: inspector context switch = 120ms crossfade. */
const FADE_MS = 120

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

// --- 120ms crossfade: content swaps at the midpoint, header stays put ---

const rendered = ref<InspectorPlacement>({ ...placement.value })
const fading = ref(false)
let fadeTimer: ReturnType<typeof setTimeout> | null = null

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const addRef = ref<InstanceType<typeof AddInspector> | null>(null)

/** Focus the search field after the (possibly mid-fade) swap has rendered. */
function focusAddSearch(): void {
  if (rendered.value.mode !== 'add') return
  void nextTick(() => addRef.value?.focusSearch())
}

function swapImmediately(): void {
  rendered.value = { ...placement.value }
  fading.value = false
  focusAddSearch()
}

watch(
  () => placement.value.mode,
  (next, prev) => {
    if (next === prev) return
    if (prefersReducedMotion()) {
      swapImmediately()
      return
    }
    if (fadeTimer !== null) clearTimeout(fadeTimer)
    fading.value = true
    fadeTimer = setTimeout(() => {
      fadeTimer = null
      swapImmediately()
    }, FADE_MS)
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
  if (fadeTimer !== null) clearTimeout(fadeTimer)
})

/** Numeric props for the mode children; `-1` never renders (children guard). */
const addTarget = computed(() =>
  rendered.value.mode === 'add' && rendered.value.targetIndex !== null ? rendered.value.targetIndex : -1,
)
const cardTarget = computed(() =>
  rendered.value.mode === 'card' && rendered.value.targetIndex !== null ? rendered.value.targetIndex : -1,
)

// --- recents (session-only; owned here to survive mode switches) ---

const recents = ref<RecentPlacement[]>([])

function onPicked(item: RecentPlacement): void {
  recents.value = pushRecentPlacement(recents.value, item)
}

// --- quiet announcements for placements/notices (WCAG 4.1.3) ---

const announcement = ref('')

function onPlaced(event: { message: string }): void {
  announcement.value = event.message
}

/** Escape unwinds selection first (dialog-level escapes live above us). */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (placement.value.mode === 'page') return
  replaceIndex.value = null
  store.askCell(null)
  store.selectCell(null)
}
</script>

<template>
  <aside class="inspector" aria-label="Inspector" @keydown="onKeydown">
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
        :recents="recents"
        @picked="onPicked"
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

    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </aside>
</template>

<style scoped>
  .inspector {
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
    border-radius: 8px;
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

  :focus-visible {
    outline: 2px solid var(--mint-ink, #1d4d16);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .insp-body { transition: none; }
  }
</style>
