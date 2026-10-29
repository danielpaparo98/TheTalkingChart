<script setup lang="ts">
/**
 * SlotEditor — compact editor for the currently selected chart slot.
 *
 * Position-agnostic panel: the page decides placement (docked beside the
 * canvas on desktop, bottom sheet on phone). Renders nothing while no slot
 * is selected. Label editing lives ON the card (inline, WYSIWYG) — this
 * panel owns what a small card cannot hold: card colour, replace and clear.
 * All writes go through the chart store; selection is UI-only state owned
 * by the store. Contract: context bundle line 70; subtask chart-app-v2-10.
 */
import { computed, useId } from 'vue'
import { useChartStore } from '../stores/chart'

interface ColorSwatch {
  /** CSS color applied to the card, or `null` for "no color". */
  value: string | null
  /** Accessible name; doubles as the v-for key. */
  label: string
}

/** Soft pastels suited to PECs cards; the first entry clears the override. */
const SWATCHES: readonly ColorSwatch[] = [
  { value: null, label: 'No color' },
  { value: '#FDE68A', label: 'Amber' },
  { value: '#BBF7D0', label: 'Green' },
  { value: '#BFDBFE', label: 'Blue' },
  { value: '#FBCFE8', label: 'Pink' },
  { value: '#FED7AA', label: 'Orange' },
  { value: '#E2E8F0', label: 'Slate' },
]

const emit = defineEmits<{ replace: [] }>()

const store = useChartStore()
const selected = computed(() => store.selectedSlot)
/** Normalized so an absent override matches the "No color" swatch. */
const selectedColor = computed(() => selected.value?.color ?? null)
/** True when the edited slot has no icon yet (empty, dashed cell). */
const selectedIsEmpty = computed(() => selected.value?.icon === null)

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
      <h2 class="panel-title">{{ selectedIsEmpty ? 'Empty card' : 'Card' }}</h2>
      <button
        type="button"
        class="close-btn"
        aria-label="Close editor"
        @click="store.selectSlot(null)"
      >
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path
            d="M2.5 2.5l7 7m0-7l-7 7"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </header>

    <p class="panel-hint">Click the label on the card to rename it.</p>

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
          <svg
            v-if="swatch.value === null"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <line
              x1="5"
              y1="19"
              x2="19"
              y2="5"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="panel-actions">
      <button
        type="button"
        class="ghost-btn"
        @click="emit('replace')"
      >
        {{ selectedIsEmpty ? 'Choose icon' : 'Replace' }}
      </button>
      <button
        v-if="!selectedIsEmpty"
        type="button"
        class="ghost-btn ghost-btn--negative"
        @click="clearSelected"
      >
        Clear
      </button>
    </div>
  </section>
</template>

<style scoped>
/*
 * Panel rules (matching the palette dock): white surface, 1px border,
 * 16px radius, no elevation at rest. Focus is handled once by the global
 * :focus-visible rule (2px accent outline, 2px offset).
 */
.panel {
  width: 232px;
  max-width: 100%;
  padding: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sheet);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text);
}

.panel-hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
}

.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--radius-control);
  background: none;
  color: var(--muted);
  cursor: pointer;
}

.close-btn:hover {
  background: var(--raised);
  color: var(--text);
}

.field {
  margin-top: 12px;
}

/* Labels above inputs, 14px/500 (accessibility rule) */
.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--text);
}

.swatch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.swatch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--control);
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}

/* Widen the hit area to the 32px control pitch without moving the squares */
.swatch::after {
  content: '';
  position: absolute;
  inset: -4px;
}

/* Selection state uses the same 2px accent outline language as focus */
.swatch--selected {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.panel-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

/* Ghost buttons: quiet outlined actions at the shared 32px control height */
.ghost-btn {
  height: var(--control-height);
  padding: 0 12px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--control);
  border-radius: var(--radius-control);
  cursor: pointer;
}

.ghost-btn:hover {
  background: var(--raised);
}

.ghost-btn:active {
  background: var(--active);
}

.ghost-btn--negative {
  color: var(--negative);
  border-color: color-mix(in srgb, var(--negative) 35%, transparent);
}
</style>
