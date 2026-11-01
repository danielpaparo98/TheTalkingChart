<script setup lang="ts">
/**
 * SegmentedControl — an ARIA radiogroup rendered as joined segments.
 * Owns the keyboard model (roving tabindex, arrow/Home/End move selection
 * and focus); the value lives with the parent via v-model. Visual contract:
 * raised track, white active segment, 13px labels — matches StyleControls.
 */
import { useId } from 'vue'

interface SegmentOption {
  value: string
  label: string
}

const props = defineProps<{
  options: ReadonlyArray<SegmentOption>
  modelValue: string
  /** Accessible name for the group (no visible label is rendered). */
  label: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const groupId = useId()

function select(value: string): void {
  if (value !== props.modelValue) emit('update:modelValue', value)
}

// --- Roving-tabindex arrow-key model ---

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

/** DOM order must match `options` order (v-for renders in order). */
function onKeydown(event: KeyboardEvent): void {
  if (!isRadioKey(event.key)) return
  const group = event.currentTarget
  if (!(group instanceof HTMLElement)) return
  const index = props.options.findIndex((option) => option.value === props.modelValue)
  if (index === -1) return
  event.preventDefault()
  let next: number
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      next = (index + 1) % props.options.length
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      next = (index - 1 + props.options.length) % props.options.length
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = props.options.length - 1
      break
  }
  const option = props.options[next]
  if (option === undefined) return
  select(option.value)
  const radios = group.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  radios[next]?.focus()
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="seg"
    @keydown="onKeydown"
  >
    <button
      v-for="option in options"
      :id="`${groupId}-${option.value}`"
      :key="option.value"
      type="button"
      role="radio"
      class="seg-btn"
      :class="{ 'is-active': modelValue === option.value }"
      :aria-checked="modelValue === option.value"
      :tabindex="modelValue === option.value ? 0 : -1"
      @click="select(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.seg {
  display: flex;
  height: 38px;
  flex: none;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-control);
  background: var(--raised);
}

.seg-btn {
  display: flex;
  height: 100%;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1;
  color: var(--muted);
  transition: color 120ms ease, background-color 120ms ease;
}

.seg-btn:hover { color: var(--text); }
.seg-btn.is-active {
  border-color: var(--border);
  background: var(--surface);
  color: var(--text);
  font-weight: 500;
}
</style>
