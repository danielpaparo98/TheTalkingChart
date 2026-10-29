<script lang="ts">
/**
 * Label size step for chart card labels. StyleControls owns the control
 * state and emits changes via `label-size`; it applies no styling itself.
 * CSS contract applied downstream by the chart grid (parent bridges the
 * prop): s = 11px, m = 13px, l = 15px.
 */
export type LabelSize = 's' | 'm' | 'l'
</script>

<script setup lang="ts">
/**
 * StyleControls — the chart's style panel. Position-agnostic: the parent
 * decides placement/docking (collapsible dock); this component only renders
 * the panel surface. Framed-sheet presentation (house rules): surface panel,
 * 1px border, 8px card radius, 16px padding, 28-32px controls, 1px borders,
 * sentence case, no shadows, no gradients.
 *
 * Groups:
 *  - Chart title -> store.setTitle (max 60 chars)
 *  - Grid        -> store.setGrid ('2x2' | '3x3' | '4x5' | '5x4'; the store
 *                   preserves placed slot content positionally on switch)
 *  - Label size  -> emit('label-size', 's' | 'm' | 'l') only; local state
 *                   lives here (default 'm'), the grid reads it via a parent
 *                   prop later.
 *
 * Emits:
 *  - close       -> optional dock chrome; the parent may ignore it.
 */
import { computed, ref } from 'vue'
import type { GridPreset } from '../types/chart'
import { useChartStore } from '../stores/chart'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'label-size', size: LabelSize): void
}>()

const store = useChartStore()

// --- DOM ids (singleton panel; stable ids for label/describedby wiring) ---

const headingId = 'style-controls-heading'
const titleInputId = 'style-controls-title-input'
const gridLabelId = 'style-controls-grid-label'
const labelSizeLabelId = 'style-controls-label-size-label'

// --- Chart title (store-backed) ---

const TITLE_MAX = 60

const title = computed<string>({
  get: () => store.doc.title,
  set: (value: string) => {
    store.setTitle(value)
  },
})

// --- Grid preset (store-backed; display labels use the typographic ×) ---

const GRID_OPTIONS = [
  { value: '2x2', label: '2 × 2' },
  { value: '3x3', label: '3 × 3' },
  { value: '4x5', label: '4 × 5' },
  { value: '5x4', label: '5 × 4' },
] as const satisfies ReadonlyArray<{ value: GridPreset; label: string }>

// --- Label size (local state; parent bridges to the grid) ---

const LABEL_SIZE_OPTIONS = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
] as const satisfies ReadonlyArray<{ value: LabelSize; label: string }>

const labelSize = ref<LabelSize>('m')

function selectLabelSize(size: LabelSize): void {
  if (labelSize.value === size) return
  labelSize.value = size
  emit('label-size', size)
}

// --- Shared radiogroup keyboard model (roving tabindex + arrow keys) ---

type RadioKey = 'ArrowRight' | 'ArrowDown' | 'ArrowLeft' | 'ArrowUp' | 'Home' | 'End'

function isRadioKey(key: string): key is RadioKey {
  return (
    key === 'ArrowRight' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowUp' ||
    key === 'Home' ||
    key === 'End'
  )
}

/**
 * ARIA radiogroup arrow-key behavior: the selection moves and focus follows
 * the newly active segment. Segment DOM order must match `values` order
 * (v-for renders both groups in option order).
 */
function createRadioKeynav<T extends string>(
  values: ReadonlyArray<T>,
  current: () => T,
  select: (value: T) => void,
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    if (!isRadioKey(event.key)) return
    const group = event.currentTarget
    const index = values.indexOf(current())
    if (index === -1 || !(group instanceof HTMLElement)) return
    event.preventDefault()
    let next: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % values.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + values.length) % values.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = values.length - 1
        break
    }
    const nextValue: T | undefined = values[next]
    if (nextValue === undefined) return
    select(nextValue)
    const radios = group.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    radios[next]?.focus()
  }
}

const onGridKeydown = createRadioKeynav(
  GRID_OPTIONS.map((option) => option.value),
  () => store.doc.grid,
  (preset) => {
    store.setGrid(preset)
  },
)

const onLabelSizeKeydown = createRadioKeynav(
  LABEL_SIZE_OPTIONS.map((option) => option.value),
  () => labelSize.value,
  selectLabelSize,
)
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex w-[280px] max-w-full flex-col gap-4 rounded-card border border-border bg-surface p-4"
  >
    <!-- Header: 14px/600 + optional close (emit may be ignored by the parent) -->
    <header class="flex items-center justify-between">
      <h2 :id="headingId" class="text-body font-semibold text-text">Chart style</h2>
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-active hover:text-text"
        aria-label="Close chart style"
        @click="emit('close')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <!-- Chart title -->
    <div class="flex flex-col gap-1.5">
      <label :for="titleInputId" class="text-body font-medium text-text">Chart title</label>
      <input
        :id="titleInputId"
        v-model="title"
        type="text"
        :maxlength="TITLE_MAX"
        class="h-8 rounded-control border border-border bg-surface px-2.5 text-body text-text"
      >
    </div>

    <!-- Grid preset -->
    <div class="flex flex-col gap-1.5">
      <span :id="gridLabelId" class="text-body font-medium text-text">Grid</span>
      <div
        role="radiogroup"
        :aria-labelledby="gridLabelId"
        class="flex h-7 gap-[2px] rounded-control bg-raised p-[2px]"
        @keydown="onGridKeydown"
      >
        <button
          v-for="option in GRID_OPTIONS"
          :key="option.value"
          type="button"
          role="radio"
          class="flex h-full flex-1 items-center justify-center rounded-[4px] border px-1 text-[13px] leading-none transition-colors duration-150"
          :class="
            store.doc.grid === option.value
              ? 'border-border bg-surface font-medium text-text'
              : 'border-transparent text-muted hover:text-text'
          "
          :aria-checked="store.doc.grid === option.value"
          :tabindex="store.doc.grid === option.value ? 0 : -1"
          @click="store.setGrid(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- Label size (S/M/L; emits only — grid applies s=11px m=13px l=15px) -->
    <div class="flex flex-col gap-1.5">
      <span :id="labelSizeLabelId" class="text-body font-medium text-text">Label size</span>
      <div
        role="radiogroup"
        :aria-labelledby="labelSizeLabelId"
        class="flex h-7 gap-[2px] rounded-control bg-raised p-[2px]"
        @keydown="onLabelSizeKeydown"
      >
        <button
          v-for="option in LABEL_SIZE_OPTIONS"
          :key="option.value"
          type="button"
          role="radio"
          class="flex h-full flex-1 items-center justify-center rounded-[4px] border px-1 text-[13px] leading-none transition-colors duration-150"
          :class="
            labelSize === option.value
              ? 'border-border bg-surface font-medium text-text'
              : 'border-transparent text-muted hover:text-text'
          "
          :aria-checked="labelSize === option.value"
          :tabindex="labelSize === option.value ? 0 : -1"
          @click="selectLabelSize(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </section>
</template>
