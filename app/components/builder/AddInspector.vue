<script setup lang="ts">
/**
 * AddInspector — the inspector's ADD mode: a compact add-a-picture flow.
 * It reuses the catalog store DIRECTLY (it is the compact sibling of
 * LibraryPanel, which stays a separate component): debounced search, a
 * results grid of tiles, session recents, a device-photo upload entry and a
 * hand-over link to the full library.
 *
 * Placement contract with GridCell: `setCell(target)` fills the asking card
 * and `askNextAfter(target)` makes the next empty card ask — GridCell owns
 * the mint pulse on the asking card; this panel only drives selection.
 * Replace mode swaps the picture in place (label kept, upload dropped) and
 * hands selection back to the card editor. Uploads never enter recents —
 * data URLs would bloat session state for pictures that can't repeat.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useCatalogStore } from '~/stores/catalog'
import { useChartStore } from '~/stores/chart'
import type { IconRef, IconSearchEntry } from '~/types/icons'
import type { RecentPlacement } from '~/utils/recent-placements'
import { encodeImageFile, labelFromFileName } from '~/utils/upload-encode'
import IconTile from './IconTile.vue'

const props = defineProps<{
  /** The asking card (or, in replace mode, the filled card being re-pictured). */
  targetIndex: number
  /** Replace mode: swap the picture, keep the card's label. */
  replace: boolean
  recents: readonly RecentPlacement[]
}>()

const emit = defineEmits<{
  (e: 'picked', item: RecentPlacement): void
  (e: 'placed', event: { message: string }): void
  (e: 'browse'): void
}>()

const store = useChartStore()
const catalog = useCatalogStore()

const SEARCH_DEBOUNCE_MS = 200

const searchEl = ref<HTMLInputElement | null>(null)
const searchText = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onInput(event: Event): void {
  searchText.value = (event.target as HTMLInputElement).value
  if (searchTimer !== null) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    catalog.search(searchText.value)
  }, SEARCH_DEBOUNCE_MS)
}

/** Called by InspectorPanel on add-mode entry and between asking cards. */
function focusSearch(): void {
  searchEl.value?.focus()
  searchEl.value?.select()
}
defineExpose({ focusSearch })

/**
 * This panel may be the only search surface mounted (bottom-sheet flow), so
 * it owns the catalog bootstrap: registry first, then the active bundle set
 * if nobody has loaded one yet — same contract as the v1 word picker.
 */
onMounted(() => {
  catalog.search('')
  void catalog.ensureSets().then(() => {
    if (!catalog.activeSetIsOnline && catalog.activeSet !== null && catalog.activeIndex === null) {
      return catalog.selectSet(catalog.activeSetPrefix)
    }
  })
  focusSearch()
})

onUnmounted(() => {
  // A pending debounce still represents the user's last typed intent.
  if (searchTimer !== null) {
    clearTimeout(searchTimer)
    catalog.search(searchText.value)
  }
})

const searching = computed(() =>
  catalog.activeSetIsOnline
    ? catalog.arasaacLoading
    : catalog.activeIndex === null && catalog.setError === null,
)

const subline = computed(
  () => (props.replace ? 'Replace the picture · ' : '') + `Card ${props.targetIndex + 1} of ${store.doc.cells.length}`,
)

const searchFailure = computed(() => catalog.setError ?? catalog.arasaacError)

/** Display name for a result (same rules as the library's browser). */
function displayName(entry: IconSearchEntry): string {
  if (catalog.activeSetIsOnline) return entry.t !== undefined && entry.t !== '' ? entry.t : entry.n
  return entry.n.replaceAll('-', ' ')
}

/** Shared placement path for search results and recents. */
function placeWith(iconRef: IconRef, label: string): void {
  const cell = store.doc.cells[props.targetIndex]
  if (cell === undefined) return

  if (props.replace) {
    // Swap the picture; the card keeps its word, tint and text-only flag.
    store.setCell(props.targetIndex, { ...cell, icon: iconRef, imageDataUrl: undefined })
    store.selectCell(props.targetIndex) // back to the card editor — no advance
    emit('picked', { ref: iconRef, label })
    emit('placed', { message: 'Picture replaced.' })
    return
  }

  store.setCell(props.targetIndex, { id: cell.id, icon: iconRef, label })
  emit('picked', { ref: iconRef, label })
  const next = store.askNextAfter(props.targetIndex)
  emit('placed', {
    message:
      next === null
        ? `“${label}” placed — the grid is full, every card has a picture.`
        : `“${label}” placed in card ${props.targetIndex + 1}.`,
  })
}

function place(entry: IconSearchEntry): void {
  placeWith(catalog.refFor(entry), displayName(entry))
}

function placeRecent(item: RecentPlacement): void {
  placeWith(item.ref, item.label)
}

// --- device-photo upload ---

const uploadEl = ref<HTMLInputElement | null>(null)
const uploadError = ref('')

function pickUpload(): void {
  uploadEl.value?.click()
}

async function onUploadChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-picking the same file after a fix-up
  if (file === undefined) return

  const outcome = await encodeImageFile(file)
  if (!outcome.ok) {
    uploadError.value = outcome.message
    return
  }
  uploadError.value = ''

  const cell = store.doc.cells[props.targetIndex]
  if (cell === undefined) return
  const label = cell.label.trim() !== '' ? cell.label : labelFromFileName(file.name)
  store.setCell(props.targetIndex, { id: cell.id, icon: null, label, imageDataUrl: outcome.dataUrl })

  if (props.replace) {
    store.selectCell(props.targetIndex)
    emit('placed', { message: 'Picture replaced.' })
  } else {
    store.askNextAfter(props.targetIndex)
    emit('placed', { message: `Photo added to card ${props.targetIndex + 1}.` })
  }
}
</script>

<template>
  <section class="panel" aria-label="Add a picture">
    <div class="field-block">
      <span class="kick">Add a picture</span>
      <p class="sub">{{ subline }}</p>
      <div class="search-wrap">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.25" stroke="currentColor" stroke-width="1.5" />
          <path d="m10.4 10.4 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <input
          ref="searchEl"
          class="inp has-icon"
          :value="searchText"
          type="search"
          placeholder="Type a word…"
          aria-label="Search pictures"
          autocomplete="off"
          @input="onInput"
        >
      </div>
      <button type="button" class="upload-link" @click="pickUpload">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        Upload a photo…
      </button>
      <p v-if="uploadError !== ''" class="res-empty" role="alert">{{ uploadError }}</p>
      <input
        ref="uploadEl"
        class="sr-file"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        tabindex="-1"
        aria-hidden="true"
        @change="onUploadChange"
      >
    </div>

    <div class="field-block">
      <!-- role=status: silent result changes are invisible to SR users (WCAG 4.1.3) -->
      <span class="kick" role="status">
        Results<template v-if="catalog.matchCount > 0"> · {{ catalog.matchCount }}</template>
      </span>
      <div v-if="searching" class="add-grid" aria-hidden="true">
        <div v-for="n in 6" :key="n" class="skeleton"></div>
      </div>
      <template v-else>
        <p v-if="searchFailure !== null" class="res-empty" role="alert">{{ searchFailure.message }}</p>
        <div v-else-if="catalog.results.length > 0" class="add-grid">
          <button
            v-for="entry in catalog.results"
            :key="catalog.activeSetPrefix + ':' + entry.n"
            type="button"
            class="tile"
            :aria-label="`Use ${displayName(entry)} picture`"
            @click="place(entry)"
          >
            <IconTile :icon="catalog.refFor(entry)" />
            <span class="t-lab">{{ displayName(entry) }}</span>
          </button>
        </div>
        <p v-else class="res-empty">
          No pictures match — try another word, or use “Upload a photo” above.
        </p>
        <button v-if="catalog.hasMore" type="button" class="more" @click="catalog.loadMore()">
          Show more pictures
        </button>
      </template>
    </div>

    <div v-if="recents.length > 0" class="field-block">
      <span class="kick">Recent</span>
      <div class="rec-row">
        <button
          v-for="item in recents"
          :key="item.ref.set + ':' + item.ref.name"
          type="button"
          class="rec-tile"
          :aria-label="`Use ${item.label} picture`"
          :title="item.label"
          @click="placeRecent(item)"
        >
          <IconTile :icon="item.ref" />
        </button>
      </div>
    </div>

    <div class="field-block">
      <button type="button" class="link" @click="emit('browse')">Browse the full library →</button>
    </div>
  </section>
</template>

<style scoped>
  .panel { display: block; }
  .field-block {
    border-bottom: 1px solid var(--line);
    padding: 14px 16px 16px;
  }
  .field-block:last-child { border-bottom: none; }
  .kick {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 9px;
    font-variant-numeric: tabular-nums;
  }
  .sub {
    margin: -4px 0 10px;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .search-wrap { position: relative; }
  .search-wrap svg {
    position: absolute;
    left: 10px;
    top: 50%;
    translate: 0 -50%;
    color: var(--muted);
    pointer-events: none;
  }
  .inp {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 500;
    color: var(--text);
    padding: 8px 10px;
  }
  .inp.has-icon { padding-left: 30px; }
  .inp::placeholder { color: var(--muted); opacity: 0.75; }
  .inp:focus {
    outline: none;
    border-color: var(--mint-ink, #1d4d16);
    box-shadow: 0 0 0 3px var(--mint-soft);
  }
  .upload-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    border: none;
    background: none;
    padding: 2px 0;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--mint-ink, #1d4d16);
    cursor: pointer;
  }
  .upload-link:hover { text-decoration: underline; }
  /* Visually-hidden file input, driven by the upload-link button. */
  .sr-file {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .add-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    max-height: 300px;
    overflow-y: auto;
    align-content: start;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    border: none;
    background: var(--paper);
    box-shadow: inset 0 0 0 1px var(--line);
    border-radius: 8px;
    font-family: inherit;
    padding: 8px 3px 6px;
    cursor: pointer;
    user-select: none;
    transition: background-color 100ms ease, box-shadow 100ms ease;
  }
  .tile:hover { background: var(--mint); box-shadow: none; }
  .tile .t-lab {
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1.15;
    color: var(--text);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tile :deep(.glyph) { width: 26px; height: 26px; }
  .skeleton {
    height: 62px;
    border-radius: 8px;
    background: var(--desk);
  }
  .res-empty {
    margin: 0;
    padding: 6px 2px;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--muted);
  }
  .more {
    margin-top: 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
    padding: 7px 12px;
    cursor: pointer;
    transition: background-color 100ms ease;
  }
  .more:hover { background: var(--desk); }

  .rec-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .rec-tile {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: none;
    background: var(--paper);
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px var(--line);
    cursor: pointer;
    transition: background-color 100ms ease;
  }
  .rec-tile:hover { background: var(--mint); }
  .rec-tile :deep(.glyph) { width: 22px; height: 22px; }

  .link {
    border: none;
    background: none;
    padding: 2px 0;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--mint-ink, #1d4d16);
    cursor: pointer;
  }
  .link:hover { text-decoration: underline; }
</style>
