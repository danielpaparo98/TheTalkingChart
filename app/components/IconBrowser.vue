<script setup lang="ts">
/**
 * IconBrowser — the icon palette panel (builder blueprint, context line 38).
 *
 * A floating framed-sheet panel (1px border, 16px radius, surface bg, NO
 * shadow) that owns the whole pick-and-place loop: set switcher (grey pill
 * tabs), search with a hand-rolled 200ms debounce, category chips (bundle
 * sets only) and a 4-column grid of ~40px icon tiles. Clicking a tile places
 * the icon instantly — no dialogs: into the selected slot when one exists,
 * else into the first empty slot, else a quiet auto-clearing notice.
 *
 * Data comes exclusively from the catalog store (registry, lazy set loads,
 * search, paging, ARASAAC passthrough) and placement goes through the chart
 * store; the component adds no data logic of its own. An optional typed
 * `pick` emit mirrors successful placements for the page if it ever needs
 * them (selection/undo affordances).
 *
 * States (§11): flat grey skeleton tiles while a bundle or an ARASAAC search
 * loads (no shimmer), quiet inline error + Retry text button (registry/bundle
 * failures via `retryInit`, ARASAAC via `searchArasaac`), and a quiet empty
 * state with search hints. Results scroll inside the panel; the switcher and
 * search stay visible above the scroller.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useCatalogStore } from '~/stores/catalog'
import { useChartStore } from '~/stores/chart'
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

/** Compact switcher labels — registry labels are too long for a 300px panel. */
const SET_TAB_LABELS: Record<string, string> = {
  openmoji: 'OpenMoji',
  mdi: 'MDI',
  'material-symbols': 'Symbols',
  tabler: 'Tabler',
  arasaac: 'ARASAAC',
}

const emit = defineEmits<{
  (e: 'pick', icon: IconRef): void
}>()

const catalog = useCatalogStore()
const chart = useChartStore()

// --- Local state (input text + transient notice; the rest lives in stores) ---

const inputText = ref('')
const notice = ref<string | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let noticeTimer: ReturnType<typeof setTimeout> | null = null

// --- Derived ---

const isOnline = computed(() => catalog.activeSetIsOnline)

const searchPlaceholder = computed(() =>
  isOnline.value ? 'Search ARASAAC pictograms' : 'Search 50,000 icons',
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
  () => !showSkeleton.value && panelError.value === null && catalog.results.length === 0,
)

// --- Display helpers ---

function setTabLabel(meta: IconSetMeta): string {
  return SET_TAB_LABELS[meta.prefix] ?? meta.label
}

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
 * Switch sets; lazily loads the bundle on first use via the store. ARASAAC
 * has no bundle — if the user carries a keyword over, run its search at once
 * so the grid does not sit empty behind a typed query.
 */
function onSetClick(prefix: string): void {
  if (prefix === catalog.activeSetPrefix) return
  void catalog.selectSet(prefix).then(() => {
    if (catalog.activeSetIsOnline && inputText.value.trim() !== '') {
      catalog.search(inputText.value)
    }
  })
}

/**
 * Place on click — the product's core job, instant, no dialogs: selected slot
 * first (selection kept), else the first empty slot, else a quiet notice.
 */
function place(entry: IconSearchEntry): void {
  const iconRef = catalog.refFor(entry)
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
    Framed-sheet floating panel: 1px border, 16px radius, surface bg, no
    shadow. Desktop width 300px (page row sizes it); below md it fills its
    container (page turns it into a bottom sheet).
  -->
  <section
    aria-label="Icon browser"
    class="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-sheet border border-border bg-surface md:w-[300px] md:shrink-0"
  >
    <!-- Header: switcher + license + search + chips + notice (stays put; scroller below) -->
    <div class="shrink-0 px-4 pb-2 pt-4">
      <!-- Set switcher: grey pill marks the active set -->
      <div role="group" aria-label="Icon set" class="flex flex-wrap gap-1">
        <button
          v-for="meta in catalog.sets"
          :key="meta.prefix"
          type="button"
          class="set-tab"
          :class="{ 'is-active': meta.prefix === catalog.activeSetPrefix }"
          :aria-pressed="meta.prefix === catalog.activeSetPrefix"
          @click="onSetClick(meta.prefix)"
        >{{ setTabLabel(meta) }}</button>
      </div>

      <!-- License hint for the active set -->
      <p v-if="catalog.activeSet !== null" class="mt-1.5 text-[11px] leading-4 text-muted">
        {{ catalog.activeSet.license }}{{ catalog.activeSetIsOnline ? ' — online' : '' }}
      </p>

      <!-- Search: 32px, 1px control border, 14px magnifier -->
      <div class="relative mt-2.5">
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
        class="mt-2.5 flex max-h-[76px] flex-wrap gap-1 overflow-y-auto"
      >
        <button
          type="button"
          class="chip"
          :class="{ 'is-active': catalog.categoryFilter === null }"
          :aria-pressed="catalog.categoryFilter === null"
          @click="catalog.categoryFilter = null"
        >All</button>
        <button
          v-for="category in catalog.categories"
          :key="category"
          type="button"
          class="chip"
          :class="{ 'is-active': catalog.categoryFilter === category }"
          :aria-pressed="catalog.categoryFilter === category"
          @click="catalog.categoryFilter = category"
        >{{ category }}</button>
      </div>

      <!-- Quiet transient notice (auto-clears; also a polite live region) -->
      <p v-if="notice !== null" role="status" class="mt-2 text-small text-muted">{{ notice }}</p>
    </div>

    <!-- Results: the only scroller in the panel -->
    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1">
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
        <div v-for="n in SKELETON_TILES" :key="n" class="h-10 rounded-control bg-active" />
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

      <!-- Results grid: 4 columns of ~40px tiles; click places instantly -->
      <template v-else>
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
            @click="place(entry)"
          >
            <img
              v-if="catalog.activeSetIsOnline"
              :src="pictogramImageUrl(entry.n, 300)"
              alt=""
              loading="lazy"
              draggable="false"
              class="size-6 object-contain"
            >
            <Icon
              v-else
              :icon="catalog.activeSetPrefix + ':' + entry.n"
              class="size-[22px]"
              aria-hidden="true"
            />
          </button>
        </div>

        <!-- Paging -->
        <button
          v-if="catalog.hasMore"
          type="button"
          class="num mt-3 inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-control px-2 text-small font-medium text-muted hover:bg-raised hover:text-text"
          @click="catalog.loadMore()"
        >Showing {{ catalog.results.length.toLocaleString('en-US') }} of {{ catalog.matchCount.toLocaleString('en-US') }} — Load more</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
/*
 * Set tabs: 28px grey pills, 13px/500. Active = neutral pill pair; inactive
 * tabs are ghost buttons that raise on hover. No borders, no shadows.
 */
.set-tab {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 9999px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.set-tab:hover {
  background-color: var(--raised);
  color: var(--text);
}

.set-tab.is-active {
  background-color: var(--pill-neutral-bg);
  color: var(--pill-neutral-fg);
}

/* Category chips: 24px neutral pills; the active one gets a 2px accent outline. */
.chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 9999px;
  background-color: var(--pill-neutral-bg);
  color: var(--pill-neutral-fg);
  font-size: 12px;
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
 * Icon tiles: 40px tall, full cell width, radius 6, raise on hover. Ghost
 * buttons — the glyph is the data, the chrome stays out of the way.
 */
.tile {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  min-width: 0;
  border-radius: var(--radius-control);
  color: var(--text);
  cursor: pointer;
  transition: background-color 120ms ease;
}

.tile:hover {
  background-color: var(--raised);
}

.tile:active {
  background-color: var(--active);
}
</style>
