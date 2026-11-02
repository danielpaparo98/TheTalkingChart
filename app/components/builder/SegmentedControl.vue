<script lang="ts">
/**
 * Exported so callers can annotate option arrays with the component's exact
 * element type.
 */
export interface SegmentedOption {
  value: string
  label: string
  /** Accessible name when the visible label is too terse. */
  ariaLabel?: string
}
</script>

<script setup lang="ts">
/**
 * SegmentedControl — single-choice row (S/M/L style). Buttons carry
 * aria-pressed with exactly one true; the group's accessible name comes
 * from the caller via `ariaLabel`. Values are strings; domain narrowing is
 * the caller's business (a runtime guard in the handler keeps store types
 * precise without fighting vue-tsc generic inference at the call site).
 */

const props = defineProps<{
  options: ReadonlyArray<SegmentedOption>
  modelValue: string
  /** Exact key: Vue deliberately does not camel-case aria-* attributes. */
  'aria-label': string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

function isPressed(option: SegmentedOption): boolean {
  return option.value === props.modelValue
}
</script>

<template>
  <div class="seg" role="group" :aria-label="props['aria-label']">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-label="option.ariaLabel ?? option.label"
      :aria-pressed="isPressed(option)"
      @click="emit('update:modelValue', option.value)"
    >{{ option.label }}</button>
  </div>
</template>

<style scoped>
  .seg {
    display: flex;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    flex: 1;
    padding: 7px 0;
    border: none;
    background: var(--paper);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--muted);
    cursor: pointer;
    transition: background-color 100ms ease, color 100ms ease;
  }
  .seg button + button { border-left: 1px solid var(--line); }
  .seg button:hover { background: var(--desk); color: var(--text); }
  .seg button[aria-pressed="true"] {
    background: var(--mint);
    color: var(--ink);
    font-weight: 600;
  }
</style>
