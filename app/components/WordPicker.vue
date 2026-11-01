<script setup lang="ts">
/**
 * WordPicker — the grown empty card. The card-first flow's centrepiece:
 * the empty card asks for its word, the parent types ("snack"), matching
 * pictures appear as mini-cards right here, and tapping one fills the card
 * (picture + the typed word as its label) and auto-advances to the next
 * empty card.
 *
 * Sprouts from its card: the page positions this panel over the sheet,
 * anchored to the asking slot (see app/pages/app/index.vue); a stem
 * connects the two. Escape / ✕ / "Keep it empty" close it; the colour
 * dots tint the card as it fills.
 *
 * Search goes through the catalog store (debounced 200ms, same as the
 * drawer's browser). The typed word becomes the card's label — the word
 * comes first, exactly how a parent thinks.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useChartStore } from '~/stores/chart'
import { useCatalogStore } from '~/stores/catalog'
import { pictogramImageUrl } from '~/composables/useArasaac'
import type { IconSearchEntry } from '~/types/icons'

const SEARCH_DEBOUNCE_MS = 200

const emit = defineEmits<{
  (e: 'close'): void
  /** Ask the page to open the picture library (dock or drawer). */
  (e: 'browse'): void
}>()

const chart = useChartStore()
const catalog = useCatalogStore()

const asking = computed(() => chart.askingSlot)

/** The active colour tint for the card being filled (null = white). */
const activeColor = ref<string | null>(null)

const CARD_TINTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#e2f7da', label: 'Mint' },
  { value: '#fff3cf', label: 'Lemon' },
  { value: '#e4f1fd', label: 'Sky' },
  { value: '#ffe8d9', label: 'Peach' },
  { value: '#fde5ec', label: 'Rose' },
  { value: '#f3e8fd', label: 'Lilac' },
]

// --- search (local debounce → catalog store) ---

const inputEl = ref<HTMLInputElement | null>(null)
const inputText = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onInput(event: Event): void {
  inputText.value = (event.target as HTMLInputElement).value
  if (searchTimer !== null) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    void catalog.search(inputText.value)
  }, SEARCH_DEBOUNCE_MS)
}

function flushSearch(): void {
  if (searchTimer === null) return
  clearTimeout(searchTimer)
  searchTimer = null
  void catalog.search(inputText.value)
}

/**
 * The card-first flow never mounts the drawer, so THIS component owns the
 * catalog bootstrap: registry + default set bundle must load before any
 * search can return results.
 */
onMounted(() => {
  void catalog.ensureSets().then(() => {
    if (!catalog.activeSetIsOnline && catalog.activeSet !== null && catalog.activeIndex === null) {
      return catalog.selectSet(catalog.activeSetPrefix)
    }
  })
})

/** Seed the search with the card's own word when the picker opens. */
watch(
  () => chart.askingSlotId,
  () => {
    inputText.value = ''
    activeColor.value = asking.value?.color ?? '#e2f7da'
    void nextTick(() => inputEl.value?.focus())
  },
  { immediate: true },
)

const searching = computed(
  () => catalog.activeSetIsOnline
    ? catalog.arasaacLoading
    : catalog.activeIndex === null && catalog.setError === null,
)

const resultsLabel = computed(() =>
  inputText.value.trim() !== '' ? `Pictures for “${inputText.value.trim()}”` : 'Popular pictures',
)

/** Placement: picture in, typed word as label, tint applied, advance. */
function place(entry: IconSearchEntry): void {
  const slot = asking.value
  if (slot === null) {
    // eslint-disable-next-line no-console
    console.warn('[wordpicker] place skipped: no asking slot')
    return
  }
  const iconRef = catalog.refFor(entry)
  chart.setSlotIcon(slot.id, iconRef)
  const label = inputText.value.trim()
  if (label !== '') chart.setSlotLabel(slot.id, label)
  if (activeColor.value !== null) chart.setSlotColor(slot.id, activeColor.value)
  chart.askNextAfter(slot.id)
}

/**
 * Hand focus back to the card this picker sprouts from before it closes,
 * so keyboard/SR users don't fall to <body> (WCAG 2.4.3).
 */
function returnFocusToCard(): void {
  const cell = document.querySelector<HTMLElement>('.slot-cell.is-asking')
  const target =
    cell?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])') ?? cell
  target?.focus()
}

function close(): void {
  returnFocusToCard()
  emit('close')
}

function keepEmpty(): void {
  const slot = asking.value
  if (slot !== null && activeColor.value !== null) {
    chart.setSlotColor(slot.id, activeColor.value)
  }
  close()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  } else if (event.key === 'Enter') {
    // Enter picks the first result — the fastest path from word to picture.
    const first = catalog.results[0]
    if (first !== undefined && inputText.value.trim() !== '') {
      place(first)
    }
  }
  event.stopPropagation()
}

function onKeydownCapture(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  // Another overlay sits above the picker (export dialog, browse drawer,
  // settings popover) — let the page unwind the topmost layer only;
  // closing both at once is disorienting.
  if (document.querySelector('.overlay, .drawer-scrim, .settings-scrim')) return
  // stopPropagation: the page's own Escape unwinder runs later on the
  // same event — one keypress closes one layer, never two.
  event.preventDefault()
  event.stopPropagation()
  close()
}

onMounted(() => window.addEventListener('keydown', onKeydownCapture))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydownCapture)
  if (searchTimer !== null) clearTimeout(searchTimer)
})

/** Display name for a result (same rules as the drawer's browser). */
function displayName(entry: IconSearchEntry): string {
  if (catalog.activeSetIsOnline) {
    const label = entry.t ?? ''
    return label !== '' ? label : entry.n
  }
  return entry.n.replaceAll('-', ' ')
}

function isOnlinePictogram(entry: IconSearchEntry): boolean {
  return catalog.activeSetIsOnline
}

function setLabel(entry: IconSearchEntry): string {
  return isOnlinePictogram(entry) ? displayName(entry) : entry.n
}
</script>

<template>
  <section class="picker" role="dialog" aria-label="Find a picture for this card">
    <button class="close" aria-label="Close" @click="close()">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>

    <p class="say">This card says <span class="hl">{{ inputText.trim() !== '' ? inputText.trim() : '…' }}</span></p>
    <div class="ask-line">
      <input
        ref="inputEl"
        :value="inputText"
        class="ask-input"
        type="text"
        autocomplete="off"
        placeholder="Type the word"
        aria-label="What word is this card?"
        @input="onInput"
        @keydown="onKeydown"
      >
      <span class="caret" aria-hidden="true"></span>
    </div>

    <div class="results-label">
      <!-- role=status: search results change silently otherwise — this
           announces the query and count as they update (WCAG 4.1.3). -->
      <span role="status">{{ resultsLabel }} · {{ catalog.results.length }} found</span>
      <button type="button" class="linklike" @click="emit('browse')">Browse the library →</button>
    </div>

    <div v-if="searching" class="results" aria-hidden="true">
      <div v-for="n in 6" :key="n" class="result skeleton" />
    </div>
    <div v-else class="results">
      <button
        v-for="entry in catalog.results.slice(0, 6)"
        :key="entry.n"
        type="button"
        class="result"
        :aria-label="`Use ${displayName(entry)}`"
        @click="place(entry)"
      >
        <img
          v-if="isOnlinePictogram(entry)"
          class="om"
          :src="pictogramImageUrl(entry.n, 300)"
          alt=""
          draggable="false"
        >
        <Icon v-else class="om" :icon="catalog.activeSetPrefix + ':' + entry.n" aria-hidden="true" />
        <span>{{ setLabel(entry) }}</span>
      </button>
      <p v-if="catalog.results.length === 0" class="no-results">
        Nothing for “{{ inputText }}” yet — try another word, or
        <button type="button" class="linklike" @click="keepEmpty">keep it empty</button>.
      </p>
    </div>

    <div class="foot">
      <div class="dots">
        <span class="cap">Card</span>
        <button
          v-for="tint in CARD_TINTS"
          :key="tint.value"
          type="button"
          class="dot"
          :class="{ on: activeColor === tint.value }"
          :style="{ background: tint.value }"
          :aria-label="`Card color ${tint.label}`"
          :aria-pressed="activeColor === tint.value"
          @click="activeColor = tint.value"
        />
      </div>
      <button class="skip" @click="keepEmpty">Keep it empty</button>
    </div>
  </section>
</template>

<style scoped>
  .picker {
    position: absolute;
    width: 400px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 20px;
    z-index: 10;
  }
  /* the sprout: a small stem connecting the picker to its card (set by
     the page's inline --sprout-x) */
  .picker::before {
    content: "";
    position: absolute;
    top: -8px;
    left: var(--sprout-x, 50%);
    width: 16px; height: 16px;
    background: var(--surface);
    border-radius: 3px;
    rotate: 45deg;
  }
  .close {
    position: absolute; top: 14px; right: 14px;
    width: 30px; height: 30px; border: none; border-radius: var(--radius-control);
    background: none; color: var(--muted);
    display: inline-flex; align-items: center; justify-content: center;
  }
  .close:hover { background: var(--raised); color: var(--text); }
  .say {
    margin: 0 0 2px; font-size: 13px; font-weight: 600; color: var(--muted);
  }
  .say .hl {
    background: var(--mint);
    color: var(--text); font-weight: 600; padding: 0 3px; border-radius: 3px;
  }
  .ask-line {
    display: flex; align-items: center; gap: 10px;
    border-bottom: 2.5px solid var(--text);
    padding: 4px 2px 10px;
  }
  .ask-input {
    flex: 1; min-width: 0; border: none; outline: none;
    font: 600 24px "Work Sans", sans-serif; color: var(--text);
    background: transparent;
  }
  .ask-input::placeholder { color: var(--muted); opacity: 0.5; font-weight: 500; }
  /* the underline visibly shifts on focus — the input's own focus indicator
     (WCAG 2.4.7), since the borderless input suppresses outlines */
  .ask-line:focus-within { border-bottom-color: var(--mint-deep); }
  .caret { width: 2.5px; height: 26px; background: var(--mint-deep); animation: blink 1.1s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .results-label {
    margin: 16px 0 10px; font-size: 12.5px; font-weight: 600; color: var(--muted);
    display: flex; justify-content: space-between; align-items: baseline;
  }
  .results-label a { color: var(--mint-deep); font-weight: 600; text-decoration: none; }
  .results-label a:hover { text-decoration: underline; }
  /* real buttons styled like links — honest controls, not dead anchors */
  .linklike {
    border: none; background: none; padding: 2px 4px; cursor: pointer;
    color: var(--mint-deep); font: inherit; font-weight: 600;
  }
  .linklike:hover { text-decoration: underline; }
  .results { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .result {
    border: none; border-radius: 12px;
    background: var(--paper, #fff);
    outline: 1.5px solid var(--border); outline-offset: -1.5px;
    padding: 12px 6px 9px;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    transition: background 120ms ease, outline 120ms ease, translate 120ms ease;
  }
  .result:hover {
    background: var(--mint-soft);
    outline: 2px solid var(--mint-deep); outline-offset: -2px;
    translate: 0 -2px;
  }
  .result .om { width: 40px; height: 40px; }
  .result span { font-size: 12.5px; font-weight: 600; color: var(--text); }
  .result.skeleton { min-height: 86px; background: var(--raised); }
  .no-results {
    grid-column: 1 / -1; margin: 0; padding: 10px 4px;
    font-size: 13px; color: var(--muted);
  }  .foot {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 16px; padding-top: 14px;
    border-top: 1px solid var(--rule, #f0f4ec); /* taste-skill-ignore */
  }
  .dots { display: flex; gap: 7px; align-items: center; }
  .dots .cap { font-size: 12px; font-weight: 500; color: var(--muted); margin-right: 2px; }
  .dots .dot {
    position: relative;
    width: 20px; height: 20px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.07); padding: 0;
  }
  /* invisible halo lifts the hit area to 28px (WCAG 2.5.8 target size) */
  .dots .dot::after { content: ""; position: absolute; inset: -4px; }
  .dots .dot.on { outline: 2.5px solid var(--mint-deep); outline-offset: 1.5px; }
  .skip {
    border: none; background: none; color: var(--muted);
    font-size: 13px; font-weight: 500; padding: 6px 8px; border-radius: var(--radius-control);
  }
  .skip:hover { background: var(--raised); color: var(--text); }

  @media (max-width: 720px) {
    .picker {
      position: fixed; left: 10px; right: 10px; bottom: 10px; top: auto;
      width: auto;
    }
    .picker::before { display: none; }
  }
</style>
