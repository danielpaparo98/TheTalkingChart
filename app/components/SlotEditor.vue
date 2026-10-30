<script setup lang="ts">
/**
 * SlotEditor — the compact card editor that anchors to a selected FILLED
 * card. The label edits on the card itself (WYSIWYG); this panel owns what
 * a small card cannot: card colour, replace, clear. The empty-card flow is
 * the WordPicker — this renders only for filled cards.
 */
import { computed, useId } from 'vue'
import { useChartStore } from '../stores/chart'

interface ColorSwatch {
  /** CSS color applied to the card, or `null` for "no color". */
  value: string | null
  /** Accessible name; doubles as the v-for key. */
  label: string
}

/** Warm pastels suited to PECS cards; the first entry clears the override. */
const SWATCHES: readonly ColorSwatch[] = [
  { value: null, label: 'No color' },
  { value: '#e2f7da', label: 'Mint' },
  { value: '#fff3cf', label: 'Lemon' },
  { value: '#e4f1fd', label: 'Sky' },
  { value: '#ffe8d9', label: 'Peach' },
  { value: '#fde5ec', label: 'Rose' },
  { value: '#f3e8fd', label: 'Lilac' },
]

const emit = defineEmits<{ replace: [] }>()

const store = useChartStore()
const selected = computed(() => store.selectedSlot)
const selectedColor = computed(() => selected.value?.color ?? null)
const colorGroupLabelId = useId()

function applyColor(value: string | null): void {
  const slot = selected.value
  if (slot === null) return
  store.setSlotColor(slot.id, value)
}

function clearSelected(): void {
  const slot = selected.value
  if (slot === null) return
  store.clearSlot(slot.id)
  store.selectSlot(null)
}
</script>

<template>
  <section v-if="selected !== null" class="panel" aria-label="Edit card">
    <header class="panel-head">
      <h2 class="panel-title">{{ selected.label !== '' ? selected.label : 'Card' }}</h2>
      <button type="button" class="close" aria-label="Close editor" @click="store.selectSlot(null)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </header>

    <p class="hint">Click the label on the card to rename it.</p>

    <div class="field">
      <span :id="colorGroupLabelId" class="field-label">Card color</span>
      <div class="swatch-row" role="group" :aria-labelledby="colorGroupLabelId">
        <button
          v-for="swatch in SWATCHES"
          :key="swatch.label"
          type="button"
          class="swatch"
          :class="{ 'swatch--selected': swatch.value === selectedColor }"
          :style="swatch.value === null ? undefined : { backgroundColor: swatch.value }"
          :aria-label="swatch.label"
          :aria-pressed="swatch.value === selectedColor"
          @click="applyColor(swatch.value)"
        >
          <svg v-if="swatch.value === null" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <line x1="5" y1="19" x2="19" y2="5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="panel-actions">
      <button type="button" class="ghost" @click="emit('replace')">Replace</button>
      <button type="button" class="ghost neg" @click="clearSelected">Clear</button>
    </div>
  </section>
</template>

<style scoped>
.panel {
  width: 248px;
  max-width: 100%;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sheet);
}
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.panel-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--text); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.hint { margin: 4px 0 0; font-size: 12px; line-height: 1.4; color: var(--muted); }
.close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; flex: none;
  border: none; border-radius: var(--radius-control); background: none; color: var(--muted);
}
.close:hover { background: var(--raised); color: var(--text); }
.field { margin-top: 12px; }
.field-label { display: block; margin-bottom: 7px; font-size: 14px; font-weight: 500; color: var(--text); }
.swatch-row { display: flex; flex-wrap: wrap; gap: 9px; }
.swatch {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.07); border-radius: 6px; color: var(--muted); cursor: pointer;
}
.swatch::after { content: ''; position: absolute; inset: -4px; }
.swatch--selected { outline: 2.5px solid var(--mint-deep); outline-offset: 1.5px; }
.swatch--selected[aria-label='No color'] { outline-color: var(--text); }
.panel-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.ghost {
  height: 34px; padding: 0 14px;
  border: none; border-radius: var(--radius-control);
  background: var(--raised); color: var(--text); font-size: 14px; font-weight: 500;
}
.ghost:hover { background: var(--active); }
.ghost.neg { color: var(--negative); background: #fdeeee; }
</style>
