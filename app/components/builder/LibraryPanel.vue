<script setup lang="ts">
/**
 * LibraryPanel — the builder's picture library (300px left dock ≥1080px,
 * drawer below; the shell owns the container, this panel owns its ground).
 *
 * PLACEMENT CONTRACT — for the page (BuilderShell) and GridCell
 * ════════════════════════════════════════════════════════════════════
 * The panel never writes the chart; placement happens two ways:
 *
 * 1. DRAG (mouse/touch, HTML5 DnD): every tile starts a drag carrying a
 *    `LibraryDragPayload` — `{ icon: IconRef, label: string }` — under the
 *    MIME `application/x-talking-chart-icon`, published (encode/parse/
 *    type-guard helpers) from `app/composables/useLibraryDrag.ts`.
 *    GridCell drop targets distinguish library drags with
 *    `hasLibraryDragData(dataTransfer)` in `dragover` and read the payload
 *    with `readLibraryDragData(dataTransfer)` on `drop`. After a drop the
 *    page writes the cell (label defaults to the payload's `label` when the
 *    cell was empty) and calls the panel's exposed
 *    `notePlaced(icon, label)` so the recents strip stays current.
 *
 * 2. CLICK / ENTER / SPACE (tile buttons fire click natively — the a11y
 *    keyboard path): the panel hands the pick to the required prop
 *    `onKeyboardPlace(icon, label)` — the page decides where it lands
 *    (asking cell first, else selected empty cell, else first empty, per
 *    design decision #6), records the recents entry and reports the
 *    outcome back through the `notice` prop, which renders as this
 *    panel's visible status chip (purely visual — the page's own live
 *    region covers screen readers, so the chip is aria-hidden).
 *
 * UPLOADS never place directly: the tile opens a device file picker, the
 * photo is re-encoded to a ≤512px WebP/JPEG data URL
 * (app/utils/upload-image.ts), and the panel emits
 * `upload` ({ imageDataUrl, suggestedLabel }) — the page fills the
 * asking/selected cell's `imageDataUrl` and reports via `notice`.
 *
 * FOCUS: pass `autofocus` (focuses when it flips true — inspector add-flow
 * and drawer opening) or call the exposed `focusSearch()`.
 *
 * Recents are the builder-wide singleton state under
 * `talking-chart-recents-v1` (see useRecents) — never part of the chart
 * document, and shared with the inspector's add flow (same list everywhere).
 */
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { useCatalogStore } from '~/stores/catalog'
import { useRecents, pictogramId } from '~/composables/useRecents'
import { libraryDisplayName, useLibrarySearch } from '~/composables/useLibrarySearch'
import { UPLOAD_ACCEPT_ATTRIBUTE, fileToImageDataUrl } from '~/utils/upload-image'
import { ARASAAC_SET_PREFIX } from '~/stores/catalog'
import LibraryTile from './LibraryTile.vue'
import type { IconRef, IconSetMeta } from '~/types/icons'

/** Outcome chip the page feeds back after handling a pick or upload. */
export interface LibraryNotice {
  /** Short status line, e.g. `Placed "dog" · Card 3 of 12`. */
  message: string
  /** `ok` = placed; `warn` = nothing placed (grid full). */
  tone: 'ok' | 'warn'
}

const props = defineProps<{
  /**
   * Page-provided placement callback — see the header contract. The label
   * travels WITH the icon: the panel knows the tile's display name (and
   * recents carry the placed label), so the page never has to re-derive
   * it from live search results.
   */
  onKeyboardPlace: (icon: IconRef, label: string) => void
  /** Focus the search box on mount and whenever it flips true. */
  autofocus?: boolean
  /** Visible status chip content; `null` hides it. */
  notice?: LibraryNotice | null
}>()

const emit = defineEmits<{
  (e: 'upload', payload: { imageDataUrl: string; suggestedLabel: string }): void
}>()

const catalog = useCatalogStore()
const { items: recentItems, record: recordRecent } = useRecents()
const { text, onInput, flush, reset } = useLibrarySearch({ search: (query) => catalog.search(query) })

const searchInputId = useId()
const searchEl = ref<HTMLInputElement | null>(null)

/** Focus the search box (drawer opening / add-flow autofocus). */
async function focusSearch(): Promise<void> {
  await nextTick()
  searchEl.value?.focus()
}

/** Record a placement made outside this panel (drag-drop path). */
function notePlaced(icon: IconRef, label: string): void {
  recordRecent({ icon, label })
}

defineExpose({ focusSearch, notePlaced })

watch(
  () => props.autofocus,
  (on) => {
    if (on === true) void focusSearch()
  },
  { immediate: true },
)

// --- Bootstrap: registry, then the default set's bundle + index ---

onMounted(() => {
  void catalog.ensureSets().then(() => {
    if (!catalog.activeSetIsOnline && catalog.activeSet !== null && catalog.activeIndex === null) {
      void catalog.selectSet(catalog.activeSetPrefix)
    }
  })
})

// --- Set + category selects ---

const SET_LABELS: Record<string, string> = {
  openmoji: 'OpenMoji',
  mdi: 'Material icons',
  'material-symbols': 'Material symbols',
  tabler: 'Tabler',
  [ARASAAC_SET_PREFIX]: 'ARASAAC',
}

function setOptionLabel(meta: IconSetMeta): string {
  const label = SET_LABELS[meta.prefix] ?? meta.label
  return meta.prefix === ARASAAC_SET_PREFIX ? `${label} (online)` : label
}

function onSetChange(event: Event): void {
  const prefix = (event.target as HTMLSelectElement).value
  if (prefix === catalog.activeSetPrefix) return
  void catalog.selectSet(prefix).then(() => {
    // Carrying a typed keyword into ARASAAC: run its search at once so the
    // grid does not sit empty behind a query.
    if (catalog.activeSetIsOnline && text.value.trim() !== '') {
      catalog.search(text.value)
    }
  })
}

function onCategoryChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  catalog.categoryFilter = value === '' ? null : value
}

const showCategories = computed(() => !catalog.activeSetIsOnline && catalog.categories.length > 0)

// --- Search box (debounced via the composable) ---

function onSearchInput(event: Event): void {
  onInput((event.target as HTMLInputElement).value)
}

// --- Result tiles ---

const tiles = computed(() =>
  catalog.results.map((entry) => ({
    key: entry.n,
    icon: catalog.refFor(entry),
    label: libraryDisplayName(entry, catalog.activeSetIsOnline),
  })),
)

/**
 * Click / Enter / Space path: hand the pick to the page with its label.
 * The page performs the placement, records the recents entry (one record
 * per placement — drops come back through notePlaced) and reports the
 * outcome via the `notice` prop.
 */
function activate(icon: IconRef, label: string): void {
  props.onKeyboardPlace(icon, label)
}

// --- States (mirrors v1 IconBrowser: skeleton, quiet retry-able error, empty) ---

const showSkeleton = computed(() => {
  if (catalog.activeSetIsOnline) return catalog.arasaacLoading
  return catalog.activeIndex === null && (catalog.setError === null || catalog.loadingSet !== null)
})

const panelError = computed<{ message: string; retry: () => void } | null>(() => {
  if (!catalog.activeSetIsOnline) {
    const error = catalog.setError
    if (error === null) return null
    return { message: error.message, retry: () => void retryInit() }
  }
  const error = catalog.arasaacError
  if (error === null || error.kind === 'empty' || error.kind === 'aborted') return null
  return {
    message: error.kind === 'network' ? "Couldn't reach ARASAAC — check your connection." : error.message,
    retry: () => {
      const keyword = catalog.arasaacQuery !== '' ? catalog.arasaacQuery : text.value
      void catalog.searchArasaac(keyword)
    },
  }
})

const showEmpty = computed(
  () => !showSkeleton.value && panelError.value === null && catalog.results.length === 0,
)

const countText = computed(
  () =>
    `${catalog.results.length.toLocaleString('en-US')} of ${catalog.matchCount.toLocaleString('en-US')} pictures`,
)

async function retryInit(): Promise<void> {
  await catalog.ensureSets()
  if (!catalog.activeSetIsOnline && catalog.activeSet !== null && catalog.activeIndex === null) {
    await catalog.selectSet(catalog.activeSetPrefix)
  }
}

// --- Upload (decision #9: ≤512px WebP/JPEG data URL, budget-guarded) ---

const fileEl = ref<HTMLInputElement | null>(null)
const uploadError = ref<string | null>(null)

function openFilePicker(): void {
  fileEl.value?.click()
}

async function onFileChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (file === null) return
  uploadError.value = null
  const outcome = await fileToImageDataUrl(file)
  if (!outcome.ok) {
    uploadError.value = outcome.message
    return
  }
  emit('upload', { imageDataUrl: outcome.dataUrl, suggestedLabel: outcome.label })
}
</script>

<template>
  <section class="library" aria-label="Picture library">
    <div class="lib-top">
      <!-- Search: visually-hidden label carries the accessible name (WCAG 3.3.2) -->
      <div class="search-wrap">
        <label class="sr-only" :for="searchInputId">Search pictures</label>
        <svg class="search-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.25" stroke="currentColor" stroke-width="1.5" />
          <path d="m10.4 10.4 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <input
          :id="searchInputId"
          ref="searchEl"
          class="inp has-icon"
          type="search"
          autocomplete="off"
          spellcheck="false"
          :placeholder="catalog.activeSetIsOnline ? 'Search ARASAAC pictograms' : 'Search pictures'"
          :value="text"
          @input="onSearchInput"
          @keydown.enter.prevent="flush"
        >
      </div>

      <!-- Set + category: two quiet selects, mockup layout -->
      <div class="lib-selects">
        <select
          class="inp"
          aria-label="Picture set"
          :value="catalog.activeSetPrefix"
          @change="onSetChange"
        >
          <option v-for="meta in catalog.sets" :key="meta.prefix" :value="meta.prefix">
            {{ setOptionLabel(meta) }}
          </option>
        </select>
        <select
          v-if="showCategories"
          class="inp"
          aria-label="Category"
          :value="catalog.categoryFilter ?? ''"
          @change="onCategoryChange"
        >
          <option value="">All categories</option>
          <option v-for="category in catalog.categories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
        <select v-else class="inp" aria-label="Category" disabled>
          <option>All categories</option>
        </select>
      </div>

      <p class="lib-count">{{ countText }}</p>

      <p v-if="uploadError !== null" role="alert" class="upload-error">{{ uploadError }}</p>
    </div>

    <!-- Recents strip: placements recorded anywhere in the builder land here -->
    <div v-if="recentItems.length > 0" class="lib-recents">
      <p class="strip-label">Recently used</p>
      <ul class="rec-row" aria-label="Recently used pictures">
        <li v-for="item in recentItems" :key="pictogramId(item.icon)">
          <LibraryTile
            compact
            :icon="item.icon"
            :label="item.label"
            @activate="activate($event, item.label)"
          />
        </li>
      </ul>
    </div>

    <!-- Results: the only scroller in the panel; list semantics per tile -->
    <ul class="lib-grid" aria-label="Picture results">
      <li>
        <button
          type="button"
          class="upload"
          aria-label="Upload a photo from your device"
          @click="openFilePicker"
        >
          <svg class="upload-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          Upload photo
        </button>
      </li>

      <template v-if="showSkeleton">
        <li v-for="n in 24" :key="'skeleton-' + n" class="skel" aria-hidden="true"></li>
      </template>

      <li v-else-if="panelError !== null" class="lib-empty" role="alert">
        {{ panelError.message }}
        <button type="button" class="retry" @click="panelError.retry()">Retry</button>
      </li>

      <li v-else-if="showEmpty" class="lib-empty">
        <template v-if="catalog.activeSetIsOnline && catalog.query === ''">
          Type a keyword to search ARASAAC pictograms.
        </template>
        <template v-else>No pictures match — try another word.</template>
      </li>

      <template v-else>
        <li v-for="tile in tiles" :key="tile.key">
          <LibraryTile
            :icon="tile.icon"
            :label="tile.label"
            @activate="activate($event, tile.label)"
          />
        </li>
        <li v-if="catalog.hasMore" class="pager">
          <button type="button" class="more" @click="catalog.loadMore()">
            Show more — {{ catalog.results.length.toLocaleString('en-US') }} of
            {{ catalog.matchCount.toLocaleString('en-US') }}
          </button>
        </li>
      </template>
    </ul>

    <input
      ref="fileEl"
      class="file-input"
      type="file"
      :accept="UPLOAD_ACCEPT_ATTRIBUTE"
      aria-hidden="true"
      tabindex="-1"
      @change="onFileChosen"
    >

    <!-- Visible placement feedback (chip; aria-hidden because the page's
         live region already announces these outcomes to screen readers). -->
    <p
      v-if="notice !== null && notice !== undefined"
      class="place-note"
      :class="notice.tone"
      aria-hidden="true"
    >{{ notice.message }}</p>
  </section>
</template>

<style scoped>
/*
 * Panel ground per mockup: desk background, right hairline; the shell owns
 * the 300px column / drawer wrapper. reset is a no-op alias — the search
 * composable's reset stays available for the add-flow via the script.
 */
.library {
  position: relative; /* anchors the placement-feedback chip */
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--desk);
  border-right: 1px solid var(--line);
}

.lib-top {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 14px 10px;
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

.search-wrap {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  translate: 0 -50%;
  width: 14px;
  height: 14px;
  color: var(--muted);
  pointer-events: none;
}

.inp {
  width: 100%;
  padding: 8px 10px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl, 8px);
}

/* Placeholder text is real text — plain --muted (6.0:1 on paper), no
 * opacity multiplier (0.75×muted measured ~3.5:1, below AA 1.4.3). */
.inp::placeholder {
  color: var(--muted);
  opacity: 1;
}

.inp:focus {
  outline: none;
  border-color: var(--mint-ink, var(--ink));
  box-shadow: 0 0 0 3px var(--mint-soft);
}

select.inp {
  appearance: auto;
  padding: 7px 8px;
  font-weight: 500;
}

select.inp:disabled {
  color: var(--muted);
  opacity: 0.6;
  cursor: default;
}

.lib-selects {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.lib-count {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.upload-error {
  margin: 0;
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.35;
  color: var(--text);
  background: var(--mint-soft);
  border-radius: var(--r-ctl, 8px);
}

.lib-recents {
  padding: 2px 14px 10px;
  border-bottom: 1px solid var(--line);
}

.strip-label {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.rec-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Results scroller: auto-fill 72px tiles per mockup; tiles come from LibraryTile */
.lib-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;
  align-content: start;
  margin: 0;
  padding: 12px 14px 16px;
  list-style: none;
}

.upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  min-height: 58px;
  padding: 9px 4px 7px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  background: transparent;
  border: none;
  border-radius: var(--r-ctl, 8px);
  box-shadow: inset 0 0 0 1.5px var(--line);
  cursor: pointer;
  transition: background-color 100ms ease, color 100ms ease, box-shadow 100ms ease;
}

.upload:hover {
  background: var(--mint-soft);
  box-shadow: inset 0 0 0 1.5px var(--mint-ink, var(--ink));
  color: var(--text);
}

.upload:focus-visible {
  outline: 2px solid var(--mint-ink, var(--ink));
  outline-offset: 2px;
}

.upload-icon {
  width: 14px;
  height: 14px;
}

.skel {
  height: 58px;
  border-radius: var(--r-ctl, 8px);
  background: var(--mint-soft);
}

.lib-empty {
  grid-column: 1 / -1;
  padding: 8px 2px;
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--muted);
}

.retry {
  margin-left: 6px;
  padding: 0;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
}

.pager {
  grid-column: 1 / -1;
}

.more {
  width: 100%;
  padding: 8px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  background: var(--paper);
  border: none;
  border-radius: var(--r-ctl, 8px);
  box-shadow: inset 0 0 0 1px var(--line);
  cursor: pointer;
  transition: background-color 100ms ease, color 100ms ease;
}

.more:hover {
  background: var(--mint);
  color: var(--ink);
}

.more:focus-visible {
  outline: 2px solid var(--mint-ink, var(--ink));
  outline-offset: 2px;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/*
 * Placement feedback chip — floating pill at the panel's foot (matches the
 * canvas-alert language). Two tones: a placed pick/photo (positive) and a
 * refused action — grid full (warning). Hidden from AT (aria-hidden): the
 * page's role=status live region announces the same outcomes.
 */
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
  box-shadow: 0 2px 10px rgba(19, 23, 17, 0.14);
  pointer-events: none;
}

.place-note.ok {
  background: var(--pill-positive-bg);
  color: var(--pill-positive-fg);
}

.place-note.warn {
  background: var(--pill-warning-bg);
  color: var(--pill-warning-fg);
}

@media (prefers-reduced-motion: reduce) {
  .upload,
  .more {
    transition: none;
  }
}
</style>
