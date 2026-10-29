<script setup lang="ts">
/**
 * SlotEditor — inline editor for the currently selected chart slot.
 *
 * Position-agnostic panel: the page decides placement (floating panel or
 * docked strip). Renders nothing while no slot is selected. All writes go
 * through the chart store; selection is UI-only state owned by the store.
 * Contract: context bundle line 70; subtask chart-app-v2-10.
 */
import { computed, ref, useId, watch } from 'vue'
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
  { value: '#DDD6FE', label: 'Violet' },
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

const labelInputId = useId()
const colorGroupLabelId = useId()

/**
 * Label edits commit on change/blur (not per keystroke) so the persisted
 * document stays clean; the draft is local until then.
 */
const draftLabel = ref('')

/** Selection identity + stored label — re-syncs the draft when either changes. */
const selectedKey = computed(() => {
  const slot = selected.value
  return slot === null ? null : `${slot.id}:${slot.label}`
})

watch(selectedKey, () => {
  draftLabel.value = selected.value?.label ?? ''
}, { immediate: true })

function commitLabel(): void {
  const slot = selected.value
  if (slot === null) return
  const next = draftLabel.value.trim()
  if (next !== slot.label) store.setSlotLabel(slot.id, next)
}

function applyColor(value: string | null): void {
  const slot = selected.value
  if (slot === null) return
  store.setSlotColor(slot.id, value)
}

function close(): void {
  store.selectSlot(null)
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
      <h2 class="panel-title">Edit card</h2>
      <button
        type="button"
        class="close-btn"
        aria-label="Close editor"
        @click="close"
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

    <div class="field">
      <label class="field-label" :for="labelInputId">Label</label>
      <input
        :id="labelInputId"
        v-model="draftLabel"
        type="text"
        class="text-input"
        autocomplete="off"
        @change="commitLabel"
        @blur="commitLabel"
      >
    </div>

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

    <button
      type="button"
      class="text-btn replace-btn"
      @click="emit('replace')"
    >
      {{ selectedIsEmpty ? 'Choose icon' : 'Replace icon' }}
    </button>

    <footer class="panel-actions">
      <button
        type="button"
        class="text-btn text-btn--negative"
        @click="clearSelected"
      >
        Clear card
      </button>
      <button
        type="button"
        class="done-btn"
        @click="close"
      >
        Done
      </button>
    </footer>
  </section>
</template>

<style scoped>
/*
 * Framed-sheet rules: surface bg, 1px border, 8px card radius, NO shadow at
 * rest. Focus is handled once by the global :focus-visible rule (2px accent
 * outline, 2px offset) — no component focus overrides.
 */
.panel {
  width: 300px;
  max-width: 100%;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
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

.text-input {
  width: 100%;
  height: var(--control-height);
  padding: 0 10px;
  font: inherit;
  font-size: 14px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--control);
  border-radius: var(--radius-control);
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

.replace-btn {
  margin-top: 12px;
}

.text-btn {
  padding: 0;
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--accent);
  cursor: pointer;
}

.text-btn:hover {
  text-decoration: underline;
}

.text-btn--negative {
  color: var(--negative);
}

.panel-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 16px;
}

.done-btn {
  height: var(--control-height);
  padding: 0 14px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--control);
  border-radius: var(--radius-control);
  cursor: pointer;
}

.done-btn:hover {
  background: var(--raised);
}

.done-btn:active {
  background: var(--active);
}
</style>
