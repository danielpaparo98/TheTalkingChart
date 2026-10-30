<script setup lang="ts">
/**
 * IconBrowser — the icon palette panel (builder canvas blueprint, app sheet).
 *
 * A white panel (1px border, 16px radius, no elevation) that owns the whole
 * pick-and-place loop, in the user's language:
 *  - Picture sets live in a quiet select (OpenMoji default; ARASAAC marked
 *    online) — library jargon never heads the panel.
 *  - Category chips are relabelled for people, not for Iconify ("Food &
 *    drink", "Feelings"); extras and flags sort last.
 *  - With no search and no filter on OpenMoji, a curated "Start here" group
 *    of core PECS vocabulary shows first — a new user sees eat/drink/help,
 *    not medals and skulls.
 *  - Every tile places on click (selected slot first, else first empty) and
 *    drags onto any card via pointer events (useIconDrag); a grip on hover
 *    cues the drag. Starter tiles carry tiny labels so the vocabulary is
 *    learnable at a glance.
 *
 * Data comes exclusively from the catalog store (registry, lazy set loads,
 * search, paging, ARASAAC passthrough) and placement goes through the chart
 * store; the component adds no data logic of its own.
 *
 * States (§11): flat grey skeleton tiles while a bundle or an ARASAAC search
 * loads (no shimmer), quiet inline error + Retry text button, and a quiet
 * empty state with search hints. Results scroll inside the panel; the
 * select, search and chips stay visible above the scroller.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useCatalogStore } from '~/stores/catalog'
import { useChartStore } from '~/stores/chart'
import { useIconDrag } from '~/composables/useIconDrag'
import { pictogramImageUrl } from '~/composables/useArasaac'
import type { IconRef, IconSearchEntry, IconSetMeta } from '~/types/icons'

/** Keystroke → store.search delay (the store does no debouncing itself). */
const SEARCH_DEBOUNCE_MS = 200

/** How long the "all cards are full" notice stays up. */
const NOTICE_CLEAR_MS = 4000

/** Results grid geometry — arrow-key navigation steps by this. */
const GRID_COLUMNS = 4

/** Skeleton depth while loading: 32 real grid rows worth of flat grey bars. */
const SKELETON_TILES = 32 * GRID_COLUMNS

/**
 * Curated core vocabulary for a first-run chart (OpenMoji names verified
 * against the preview bundle). Labels double as the visible tile captions.
 */
const STARTER_ICONS: ReadonlyArray<{ name: string; label: string }> = [
  { name: 'rice-cracker', label: 'eat' },
  { name: 'potable-water', label: 'drink' },
  { name: 'red-question-mark', label: 'help' },
  { name: 'house', label: 'home' },
  { name: 'grinning-face', label: 'happy' },
  { name: 'crying-face', label: 'sad' },
  { name: 'dog-face', label: 'dog' },
  { name: 'soccer-ball', label: 'play' },
  { name: 'musical-notes', label: 'music' },
  { name: 'sun', label: 'outside' },
  { name: 't-shirt', label: 'clothes' },
  { name: 'bathtub', label: 'bath' },
]

/** Friendly names for Iconify categories, and the order people expect. */
const CATEGORY_LABELS: Record<string, string> = {
  'Food Drink': 'Food & drink',
  'Animals Nature': 'Animals & nature',
  'People Body': 'People',
  'Smileys Emotion': 'Feelings',
  Activities: 'Activities',
  'Travel Places': 'Places',
  Objects: 'Things',
  Symbols: 'Symbols',
  'Flags': 'Flags',
}

/** Curated category order; everything else keeps store order after these. */
const CATEGORY_ORDER = [
  'Food Drink',
  'Animals Nature',
  'People Body',
  'Smileys Emotion',
  'Activities',
  'Travel Places',
  'Objects',
  'Symbols',
]

/** Compact set labels — registry labels are too long for the select. */
const SET_TAB_LABELS: Record<string, string> = {
  openmoji: 'OpenMoji',
  mdi: 'Material icons',
  'material-symbols': 'Material symbols',
  tabler: 'Tabler',
  arasaac: 'ARASAAC',
}

const emit = defineEmits<{
  (e: 'pick', icon: IconRef): void
}>()

const catalog = useCatalogStore()
const chart = useChartStore()
const { beginIconDrag, wasJustDragged } = useIconDrag()

// --- Local state (input text + transient notice; the rest lives in stores) ---

const inputText = ref('')
const notice = ref<string | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let noticeTimer: ReturnType<typeof setTimeout> | null = null

// --- Derived ---

const isOnline = computed(() => catalog.activeSetIsOnline)

const searchPlaceholder = computed(() =>
  isOnline.value ? 'Search ARASAAC pictograms' : 'Search the icon library',
)

/** The select's option label; ARASAAC says online so offline users know. */
function setOptionLabel(meta: IconSetMeta): string {
  return SET_TAB_LABELS[meta.prefix] + (meta.prefix === 'arasaac' ? ' (online)' : '')
}

/** True when the curated starter group should lead the panel. */
const showStarter = computed(
  () =>
    catalog.activeSetPrefix === 'openmoji' &&
    catalog.query === '' &&
    catalog.categoryFilter === null &&
    !showSkeleton.value &&
    panelError.value === null,
)

/**
 * Flat-grey-bars loading state: an online set while its search is in flight,
 * or a bundle set whose index has not landed yet (initial load, first use of
 * a set, or a retry in progress — `loadingSet` distinguishes retry from the
 * settled failure that must stay visible).
 */
const showSkeleton = computed(() => {
  if (isOnline.value) return catalog.arasaacLoading
  return catalog.activeIndex === null && (catalog.setError === null || catalog.loadingSet !== null)
})

/**
 * The one quiet inline error the panel shows — registry/bundle failures while
 * offline, ARASAAC transport failures while online. ARASAAC's `empty` kind is
 * a normal empty result (the empty state covers it) and `aborted` belongs to
 * a newer request; neither is an error here.
 */
const panelError = computed<{ message: string; retry: () => void } | null>(() => {
  if (!isOnline.value) {
    const error = catalog.setError
    if (error === null) return null
    return { message: error.message, retry: () => void retryInit() }
  }
  const error = catalog.arasaacError
  if (error === null || error.kind === 'empty' || error.kind === 'aborted') return null
  return {
    message: error.kind === 'network' ? "Couldn't reach ARASAAC — check your connection." : error.message,
    retry: () => {
      const keyword = catalog.arasaacQuery !== '' ? catalog.arasaacQuery : catalog.query
      void catalog.searchArasaac(keyword)
    },
  }
})

const showEmpty = computed(
  () =>
    !showStarter.value &&
    !showSkeleton.value &&
    panelError.value === null &&
    catalog.results.length === 0,
)

/** Categories, relabelled and ordered for people (extras and flags last). */
const displayCategories = computed(() => {
  const all = catalog.categories
  const known = CATEGORY_ORDER.filter((key) => all.includes(key))
  const extrasAndFlags = all.filter(
    (key) => !CATEGORY_ORDER.includes(key) && (key.startsWith('Extras') || key === 'Flags'),
  )
  const rest = all.filter((key) => !known.includes(key) && !extrasAndFlags.includes(key))
  return [...known, ...rest, ...extrasAndFlags]
})

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

// --- Display helpers ---

/** Accessible name: humanized dashes → spaces; ARASAAC rows carry their keyword label. */
function displayName(entry: IconSearchEntry): string {
  if (isOnline.value) {
    const label = entry.t ?? ''
    return label !== '' ? label : entry.n
  }
  return entry.n.replaceAll('-', ' ')
}

/** Tooltip: the raw Iconify name for bundles, the readable label for ARASAAC. */
function titleFor(entry: IconSearchEntry): string {
  return isOnline.value ? displayName(entry) : entry.n
}

// --- Handlers ---

function onSearchInput(event: Event): void {
  inputText.value = (event.target as HTMLInputElement).value
  if (searchTimer !== null) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    catalog.search(inputText.value)
  }, SEARCH_DEBOUNCE_MS)
}

/** Enter skips the debounce tail — search immediately. */
function flushSearch(): void {
  if (searchTimer === null) return
  clearTimeout(searchTimer)
  searchTimer = null
  catalog.search(inputText.value)
}

/**
 * Switch sets via the select; lazily loads the bundle on first use via the
 * store. ARASAAC has no bundle — if the user carries a keyword over, run its
 * search at once so the grid does not sit empty behind a typed query.
 */
function onSetChange(event: Event): void {
  const prefix = (event.target as HTMLSelectElement).value
  if (prefix === catalog.activeSetPrefix) return
  void catalog.selectSet(prefix).then(() => {
    if (catalog.activeSetIsOnline && inputText.value.trim() !== '') {
      catalog.search(inputText.value)
    }
  })
}

/**
 * Place on click — the product's core job, instant, no dialogs. Priority:
 * the asking card (card-first flow), then the selected slot, then the
 * first empty slot, else a quiet notice.
 */
function place(iconRef: IconRef): void {
  const asking = chart.askingSlot
  if (asking !== null) {
    chart.setSlotIcon(asking.id, iconRef)
    emit('pick', iconRef)
    return
  }
  const selected = chart.selectedSlot
  if (selected !== null) {
    chart.setSlotIcon(selected.id, iconRef)
    emit('pick', iconRef)
    return
  }
  const empty = chart.doc.slots.find((slot) => slot.icon === null)
  if (empty !== undefined) {
    chart.setSlotIcon(empty.id, iconRef)
    emit('pick', iconRef)
    return
  }
  showNotice('All cards are full — select a card first')
}

function onEntryClick(entry: IconSearchEntry): void {
  if (wasJustDragged()) return
  place(catalog.refFor(entry))
}

function onStarterClick(name: string): void {
  if (wasJustDragged()) return
  place({ source: 'bundle', set: 'openmoji', name })
}

/** Pointerdown hands the tile to the drag controller (clicks still work). */
function onEntryPointerDown(event: PointerEvent, entry: IconSearchEntry): void {
  beginIconDrag(event, { icon: catalog.refFor(entry), name: displayName(entry) })
}

function onStarterPointerDown(event: PointerEvent, name: string): void {
  beginIconDrag(event, { icon: { source: 'bundle', set: 'openmoji', name }, name })
}

function showNotice(text: string): void {
  notice.value = text
  if (noticeTimer !== null) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    noticeTimer = null
    notice.value = null
  }, NOTICE_CLEAR_MS)
}

/** Retry registry + initial set load (both failures surface as `setError`). */
async function retryInit(): Promise<void> {
  await catalog.ensureSets()
  if (!catalog.activeSetIsOnline && catalog.activeSet !== null && catalog.activeIndex === null) {
    await catalog.selectSet(catalog.activeSetPrefix)
  }
}

/** Roving focus over the tile grid: arrows step in 4-column geometry. */
function onGridKeydown(event: KeyboardEvent): void {
  if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home'].includes(event.key)) return
  const grid = event.currentTarget
  if (!(grid instanceof HTMLElement)) return
  const current = event.target
  if (!(current instanceof Element)) return
  const tiles = Array.from(grid.querySelectorAll<HTMLButtonElement>('button'))
  const button = current.closest('button')
  const index = button === null ? -1 : tiles.indexOf(button)
  if (index === -1) return
  let next = index
  if (event.key === 'ArrowRight') next = index + 1
  else if (event.key === 'ArrowLeft') next = index - 1
  else if (event.key === 'ArrowUp') next = index - GRID_COLUMNS
  else if (event.key === 'ArrowDown') next = index + GRID_COLUMNS
  else if (event.key === 'Home') next = 0
  else next = tiles.length - 1
  if (next < 0 || next >= tiles.length) return
  event.preventDefault()
  tiles[next]?.focus()
}

// --- Lifecycle ---

// First use: registry, then the default set's bundle+index — never eager,
// the store keeps the exactly-once guarantees.
onMounted(() => {
  void catalog.ensureSets().then(() => {
    if (!catalog.activeSetIsOnline && catalog.activeSet !== null && catalog.activeIndex === null) {
      void catalog.selectSet(catalog.activeSetPrefix)
    }
  })
})

onUnmounted(() => {
  if (searchTimer !== null) clearTimeout(searchTimer)
  if (noticeTimer !== null) clearTimeout(noticeTimer)
})
</script>

<template>
  <!--
    The white palette panel: 1px border, 16px radius, no elevation. Width is
    owned by the page dock (232px desktop); below md the panel fills the
    phone's bottom sheet.
  -->
  <section
    aria-label="Icon palette"
    class="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-sheet border border-border bg-surface"
  >
    <!-- Header: set select + license + search + chips + notice (stays put; scroller below) -->
    <div class="shrink-0 px-3 pb-2 pt-3">
      <!-- Picture set: a quiet select, friendliest first — no library jargon tabs -->
      <div class="set-row">
        <label class="set-label" for="icon-set-select">Pictures</label>
        <select
          id="icon-set-select"
          class="set-select"
          :value="catalog.activeSetPrefix"
          @change="onSetChange"
        >
          <option v-for="meta in catalog.sets" :key="meta.prefix" :value="meta.prefix">
            {{ setOptionLabel(meta) }}
          </option>
        </select>
      </div>

      <!-- License hint for the active set -->
      <p v-if="catalog.activeSet !== null" class="mt-1 text-small leading-4 text-muted">
        {{ catalog.activeSet.license }}{{ catalog.activeSetIsOnline ? ' — online' : '' }}
      </p>

      <!-- Search: 32px, 1px control border, 14px magnifier -->
      <div class="relative mt-2">
        <svg
          class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.25" stroke="currentColor" stroke-width="1.5" />
          <path d="m10.4 10.4 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <input
          :value="inputText"
          type="search"
          autocomplete="off"
          spellcheck="false"
          aria-label="Search icons"
          :placeholder="searchPlaceholder"
          class="h-8 w-full min-w-0 rounded-control border border-control bg-surface pl-8 pr-2 text-body text-text placeholder:text-muted/60"
          @input="onSearchInput"
          @keydown.enter.prevent="flushSearch"
        >
      </div>

      <!-- Category chips: bundle sets only, 'All' first, active = accent outline -->
      <div
        v-if="!catalog.activeSetIsOnline && catalog.categories.length > 0"
        class="mt-2 flex max-h-[72px] flex-wrap gap-1 overflow-y-auto"
      >
        <button
          type="button"
          class="chip"
          :class="{ 'is-active': catalog.categoryFilter === null }"
          :aria-pressed="catalog.categoryFilter === null"
          @click="catalog.categoryFilter = null"
        >All</button>
        <button
          v-for="category in displayCategories"
          :key="category"
          type="button"
          class="chip"
          :class="{ 'is-active': catalog.categoryFilter === category }"
          :aria-pressed="catalog.categoryFilter === category"
          @click="catalog.categoryFilter = category"
        >{{ categoryLabel(category) }}</button>
      </div>

      <!-- Quiet transient notice (auto-clears; also a polite live region) -->
      <p v-if="notice !== null" role="status" class="mt-2 text-small text-muted">{{ notice }}</p>
    </div>

    <!-- Results: the only scroller in the panel -->
    <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-1">
      <!-- Quiet inline error + Retry text button (never a takeover) -->
      <div v-if="panelError !== null && !showSkeleton" class="rounded-control bg-raised px-3 py-2.5">
        <p class="text-small text-muted">{{ panelError.message }}</p>
        <button
          type="button"
          class="mt-1 inline-flex h-7 cursor-pointer items-center rounded-control px-1 text-small font-medium text-accent hover:underline"
          @click="panelError.retry()"
        >Retry</button>
      </div>

      <!-- Loading: flat grey bars at real tile size, no shimmer -->
      <div
        v-else-if="showSkeleton"
        class="grid grid-cols-4 gap-1.5"
        aria-hidden="true"
      >
        <div v-for="n in SKELETON_TILES" :key="n" class="h-11 rounded-control bg-active" />
      </div>

      <!-- Empty: one-liner + hint, quiet -->
      <div v-else-if="showEmpty" class="px-1 py-6 text-center">
        <template v-if="catalog.activeSetIsOnline && catalog.query === ''">
          <p class="text-small text-muted">Type a keyword to search ARASAAC pictograms.</p>
        </template>
        <template v-else-if="catalog.query !== ''">
          <p class="text-body text-muted">No icons found for "{{ catalog.query }}"</p>
          <p class="mt-1 text-small text-muted">Try "dog", "drink", "feel"</p>
        </template>
        <template v-else>
          <p class="text-body text-muted">No icons in this category.</p>
        </template>
      </div>

      <!-- Results -->
      <template v-else>
        <!-- Curated starter vocabulary: what a first-run chart needs first -->
        <div v-if="showStarter" class="mb-2">
          <p class="group-label">Start here</p>
          <p class="group-hint">Tap a picture, or drag it onto a card.</p>
          <div
            role="group"
            aria-label="Starter icons"
            class="grid grid-cols-4 gap-1.5"
            @keydown="onGridKeydown"
          >
            <button
              v-for="starter in STARTER_ICONS"
              :key="starter.name"
              type="button"
              class="tile tile-starter"
              :aria-label="starter.label"
              :title="starter.label"
              @pointerdown="onStarterPointerDown($event, starter.name)"
              @click="onStarterClick(starter.name)"
            >
              <Icon
                :icon="'openmoji:' + starter.name"
                class="starter-glyph"
                aria-hidden="true"
              />
              <span class="starter-label">{{ starter.label }}</span>
            </button>
          </div>
        </div>

        <!-- Full results (search / category / non-default set) -->
        <div
          v-if="catalog.results.length > 0"
          role="group"
          aria-label="Icon results"
          :class="showStarter ? 'mt-1' : ''"
        >
          <p v-if="showStarter" class="group-label">All pictures</p>
          <div
            role="group"
            aria-label="Icon results"
            class="grid grid-cols-4 gap-1.5"
            @keydown="onGridKeydown"
          >
            <button
              v-for="entry in catalog.results"
              :key="entry.n"
              type="button"
              class="tile"
              :aria-label="displayName(entry)"
              :title="titleFor(entry)"
              @pointerdown="onEntryPointerDown($event, entry)"
              @click="onEntryClick(entry)"
            >
              <img
                v-if="catalog.activeSetIsOnline"
                :src="pictogramImageUrl(entry.n, 300)"
                alt=""
                loading="lazy"
                draggable="false"
                class="size-7 object-contain"
              >
              <Icon
                v-else
                :icon="catalog.activeSetPrefix + ':' + entry.n"
                class="size-7"
                aria-hidden="true"
              />
              <span class="tile-grip" aria-hidden="true"></span>
            </button>
          </div>

          <!-- Paging -->
          <button
            v-if="catalog.hasMore"
            type="button"
            class="num mt-3 inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-control px-2 text-small font-medium text-muted hover:bg-raised hover:text-text"
            @click="catalog.loadMore()"
          >Showing {{ catalog.results.length.toLocaleString('en-US') }} of {{ catalog.matchCount.toLocaleString('en-US') }} — Load more</button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
/*
 * Set select: 28px control, 1px border — the quietest possible set switcher.
 */
.set-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.set-label {
  flex: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
}

.set-select {
  flex: 1 1 0;
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--control);
  border-radius: var(--radius-control);
  cursor: pointer;
}

/* Group headings inside the scroller — small, sentence case, grey. */
.group-label {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.group-hint {
  margin: 2px 0 6px;
  font-size: 12px;
  line-height: 1.35;
  color: var(--muted);
}

/* Category chips: 26px neutral pills; the active one gets a 2px accent outline. */
.chip {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 9px;
  border-radius: 9999px;
  background-color: var(--pill-neutral-bg);
  color: var(--pill-neutral-fg);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: color 120ms ease;
}

.chip:hover {
  color: var(--text);
}

.chip.is-active {
  outline: 2px solid var(--accent);
}

/*
 * Icon tiles: 44px tall (touch floor), full cell width, radius 8, raise on
 * hover. Ghost buttons — the glyph is the data, the chrome stays out of the
 * way. touch-action none so pointer drags work on touch screens.
 */
.tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
  min-width: 0;
  border-radius: var(--radius-control);
  color: var(--text);
  cursor: grab;
  touch-action: none;
  transition: background-color 120ms ease;
}

.tile:hover {
  background-color: var(--raised);
}

.tile:active {
  background-color: var(--active);
  cursor: grabbing;
}

/* The drag grip: a six-dot pattern, top left, visible on hover only
   (inline SVG dots — no gradient fills in the house). */
.tile-grip {
  position: absolute;
  top: 3px;
  left: 4px;
  width: 5px;
  height: 9px;
  color: var(--control);
  opacity: 0;
  transition: opacity 120ms ease;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5' height='9'%3E%3Ccircle cx='2.5' cy='2' r='1' fill='%23b3b1aa'/%3E%3Ccircle cx='2.5' cy='7' r='1' fill='%23b3b1aa'/%3E%3C/svg%3E");
  background-size: 5px 9px;
  background-position: 0 0;
}

.tile:hover .tile-grip {
  opacity: 1;
}

/* Starter tiles: two lines — glyph over a tiny readable label. */
.tile-starter {
  flex-direction: column;
  gap: 2px;
  padding: 4px 2px 3px;
}

.starter-glyph {
  width: 22px;
  height: 22px;
  flex: none;
}

.starter-label {
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.1;
  color: var(--muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
