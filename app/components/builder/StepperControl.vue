<script setup lang="ts">
/**
 * StepperControl — −/readout/+ control for counts and the card gap. Real
 * buttons keep it keyboard-operable; the readout is aria-live so screen
 * readers hear every change; range clamping stays in the store reducers
 * (GRID_LIMITS), so buttons simply offer the next step and disable at the
 * ends for honest affordances.
 */
import { computed } from 'vue'

const props = defineProps<{
  /** Row label, also the group's accessible name. */
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Unit suffix in the readout, e.g. 'mm'. */
  unit?: string
  decreaseLabel?: string
  increaseLabel?: string
}>()

const emit = defineEmits<{ (e: 'change', value: number): void }>()

const stepSize = computed(() => props.step ?? 1)

const readout = computed(() =>
  props.unit === undefined ? String(props.value) : `${props.value} ${props.unit}`,
)

const atMin = computed(() => props.value - stepSize.value < props.min)
const atMax = computed(() => props.value + stepSize.value > props.max)

function decrement(): void {
  emit('change', props.value - stepSize.value)
}
function increment(): void {
  emit('change', props.value + stepSize.value)
}
</script>

<template>
  <div class="ctl-row">
    <span class="ctl-lab">{{ label }}</span>
    <div class="stepper" role="group" :aria-label="label">
      <button
        type="button"
        class="step-btn"
        :aria-label="decreaseLabel ?? `Less ${label.toLowerCase()}`"
        :disabled="atMin"
        @click="decrement"
      >−</button>
      <span class="step-val" aria-live="polite">{{ readout }}</span>
      <button
        type="button"
        class="step-btn"
        :aria-label="increaseLabel ?? `More ${label.toLowerCase()}`"
        :disabled="atMax"
        @click="increment"
      >+</button>
    </div>
  </div>
</template>

<style scoped>
  .ctl-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .ctl-row + .ctl-row { margin-top: 10px; }
  .ctl-lab { font-size: 13px; font-weight: 500; }
  .stepper { display: flex; align-items: center; gap: 2px; }
  .step-btn {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    color: var(--text);
    font-size: 15px;
    font-weight: 600;
    line-height: 1;
    font-family: inherit;
    transition: background-color 100ms ease;
  }
  .step-btn:hover { background: var(--desk); }
  .step-btn:disabled { opacity: 0.35; cursor: default; }
  .step-btn:disabled:hover { background: var(--paper); }
  .step-val {
    min-width: 44px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
