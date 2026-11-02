<script setup lang="ts">
/**
 * CellInspector — the inspector's CARD mode (a filled cell is selected):
 * live label editing, the six approved tints + none, replace-picture,
 * text-only toggle, duplicate and clear. Every action routes through a
 * chart-store action, so each edit is undoable (typing/tinting coalesce).
 *
 * Clear is intentionally confirmation-free but calm: neutral styling that
 * only inverts on hover, and the aria-label says the act is undoable —
 * undo (50-deep, store-side) is the safety net.
 */
import { computed } from 'vue'
import { useChartStore } from '~/stores/chart'
import { nextEmptyCellIndex } from '~/utils/doc-reducers'
import { TINT_SWATCHES, activeTintId } from '~/utils/tints'
import IconTile from './IconTile.vue'

const props = defineProps<{
  /** The selected filled cell. */
  targetIndex: number
}>()

const emit = defineEmits<{
  /** Replace-picture was requested; the panel switches to ADD mode keeping this target. */
  (e: 'replace'): void
  /** Quiet announcement for the panel's live region. */
  (e: 'notice', event: { message: string }): void
}>()

const store = useChartStore()

const cell = computed(() => store.doc.cells[props.targetIndex])

const position = computed(() =>
  cell.value === undefined ? '' : `Card ${props.targetIndex + 1} of ${store.doc.cells.length}`,
)

/** What the preview glyph shows: the picture, or "Aa" for text-only cards. */
const showPicture = computed(() => {
  const current = cell.value
  if (current === undefined || current.textOnly === true) return false
  return current.icon !== null || current.imageDataUrl !== undefined
})

const activeTint = computed(() => activeTintId(cell.value?.color))

function onLabelInput(event: Event): void {
  store.setLabel(props.targetIndex, (event.target as HTMLInputElement).value)
}

function onTint(color: string | null): void {
  store.setCellColor(props.targetIndex, color)
}

function onTextOnly(): void {
  store.setTextOnly(props.targetIndex)
}

/**
 * Duplicate: the mockup contract makes the COPY the newly edited card, so
 * find the target slot first (pure helper), then duplicate and select it.
 */
function onDuplicate(): void {
  const next = nextEmptyCellIndex(store.doc, props.targetIndex)
  if (next === null) {
    emit('notice', { message: 'No empty card to duplicate into — add a row or column first.' })
    return
  }
  store.duplicateCell(props.targetIndex)
  store.selectCell(next)
  emit('notice', { message: `Card duplicated into card ${next + 1}.` })
}

function onClear(): void {
  // Undoable via the store; the panel re-derives to ADD for this card.
  store.clearCell(props.targetIndex)
}
</script>

<template>
  <section v-if="cell !== undefined" class="panel" aria-label="Edit card">
    <div class="field-block head">
      <span class="card-preview" aria-hidden="true">
        <IconTile v-if="showPicture" class="preview-glyph" :icon="cell.icon" :image-url="cell.imageDataUrl" />
        <span v-else class="preview-aa">Aa</span>
      </span>
      <div>
        <span class="kick">Card</span>
        <p class="pos">{{ position }}</p>
      </div>
    </div>

    <div class="field-block">
      <label class="kick" for="cell-label-input">Label</label>
      <input
        id="cell-label-input"
        class="inp"
        :value="cell.label"
        type="text"
        aria-label="Card label"
        autocomplete="off"
        @input="onLabelInput"
      >
    </div>

    <fieldset class="field-block">
      <legend class="kick">Colour</legend>
      <div class="swatches" role="group" aria-label="Card colour">
        <button
          v-for="swatch in TINT_SWATCHES"
          :key="swatch.id"
          type="button"
          class="swatch"
          :class="{ none: swatch.color === null }"
          :style="swatch.color === null ? undefined : { background: swatch.color }"
          :aria-label="swatch.label"
          :aria-pressed="activeTint === swatch.id"
          @click="onTint(swatch.color)"
        >
          <svg v-if="swatch.color === null" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="m3 3 6 6m0-6-6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </fieldset>

    <div class="field-block actions">
      <button type="button" class="act-btn" @click="emit('replace')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M13.2 8A5.2 5.2 0 1 1 11.6 4.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <path d="M13.4 1.8v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Replace picture
      </button>
      <button
        type="button"
        class="act-btn"
        :aria-pressed="cell.textOnly === true"
        @click="onTextOnly"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 4.5h10M3 8h7M3 11.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        Text-only card
      </button>
      <div class="act-row">
        <button type="button" class="act-btn" @click="onDuplicate">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="6" y="6" width="7.5" height="7.5" rx="1.5" stroke="currentColor" stroke-width="1.5" />
            <path d="M3.5 10.5v-7a1 1 0 0 1 1-1h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          Duplicate
        </button>
        <button
          type="button"
          class="act-btn danger"
          aria-label="Clear card — undoable with the undo control"
          @click="onClear"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5" />
            <path d="m6.2 6.2 3.6 3.6m0-3.6-3.6 3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          Clear
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
  .panel { display: block; }
  .field-block {
    border: none;
    border-bottom: 1px solid var(--line);
    margin: 0;
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
    padding: 0;
  }
  label.kick { margin-bottom: 2px; }

  .head { display: flex; align-items: center; gap: 12px; }
  .card-preview {
    width: 44px;
    height: 44px;
    flex: none;
    display: grid;
    place-items: center;
    background: var(--desk);
    border-radius: 8px;
    overflow: hidden;
  }
  .preview-glyph { width: 28px; height: 28px; }
  .preview-aa { font-size: 15px; font-weight: 700; color: var(--muted); }
  .head .kick { margin-bottom: 2px; }
  .pos {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
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
  .inp:focus {
    outline: none;
    border-color: var(--mint-ink, #1d4d16);
    box-shadow: 0 0 0 3px var(--mint-soft);
  }

  .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
  .swatch {
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: var(--paper);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
    cursor: pointer;
    transition: box-shadow 100ms ease;
  }
  .swatch[aria-pressed="true"] {
    box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--mint-ink, #1d4d16);
  }
  .swatch.none { color: var(--muted); }

  .actions { display: flex; flex-direction: column; gap: 8px; }
  .act-btn {
    width: 100%;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    cursor: pointer;
    transition: background-color 100ms ease, color 100ms ease, border-color 100ms ease;
  }
  .act-btn:hover { background: var(--desk); }
  .act-btn[aria-pressed="true"] {
    background: var(--mint);
    border-color: transparent;
    color: var(--ink);
    font-weight: 600;
  }
  .act-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  /* Danger stays calm: the negative treatment lives on hover only, and the
     action itself is a single undoable click (aria-label says so). */
  .act-btn.danger:hover {
    background: var(--ink);
    border-color: var(--ink);
    color: #ffffff;
  }
</style>
