<script setup lang="ts">
/**
 * One chart card — filled (icon + label), empty (dashed placeholder) and
 * selected (2px accent outline) states of a slot (contract line 70).
 *
 * Selection goes straight through the chart store; the component
 * deliberately emits nothing. A native <button> provides the button role,
 * tab order and Enter/Space activation by default, so the card is
 * keyboard-selectable without extra handlers.
 *
 * Icon color: bundle icons draw in the inherited ink (currentColor);
 * openmoji color icons carry their own palette and render plain — the
 * component never forces a color onto the glyph itself.
 */
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useChartStore } from '~/stores/chart'
import { pictogramImageUrl } from '~/composables/useArasaac'
import type { SlotData } from '~/types/chart'

const props = defineProps<{
  /** The slot to render. Named `data` — `slot` is a reserved-ish word in Vue templates. */
  data: SlotData
}>()

const chartStore = useChartStore()

const hasIcon = computed(() => props.data.icon !== null)
const isSelected = computed(() => chartStore.selectedSlotId === props.data.id)

/** Full Iconify name for bundle icons ('' when the slot is empty or arasaac-sourced). */
const bundleIcon = computed(() => {
  const icon = props.data.icon
  if (icon === null || icon.source !== 'bundle') return ''
  return `${icon.set}:${icon.name}`
})

/** Static ARASAAC PNG URL ('' when empty, bundle-sourced, or the id is unusable). */
const pictogramSrc = computed(() => {
  const icon = props.data.icon
  if (icon === null || icon.source !== 'arasaac') return ''
  return pictogramImageUrl(icon.name)
})

/** Optional per-card pastel (hex, stored by the chart store); undefined = white surface. */
const cardStyle = computed(() => {
  const color = props.data.color
  return color ? { backgroundColor: color } : undefined
})

/** Accessible name: the label, or a quiet placeholder for empty slots. */
const ariaLabel = computed(() => (props.data.label !== '' ? props.data.label : 'Empty card'))
</script>

<template>
  <button
    type="button"
    class="slot-card"
    :class="{ 'is-empty': !hasIcon, 'is-selected': isSelected }"
    :style="cardStyle"
    :aria-label="ariaLabel"
    :aria-pressed="isSelected"
    @click="chartStore.selectSlot(props.data.id)"
  >
    <template v-if="hasIcon">
      <span class="slot-icon" aria-hidden="true">
        <img
          v-if="pictogramSrc !== ''"
          class="slot-pictogram"
          :src="pictogramSrc"
          alt=""
          draggable="false"
        />
        <Icon v-else-if="bundleIcon !== ''" class="slot-glyph" :icon="bundleIcon" />
      </span>
      <span v-if="data.label !== ''" class="slot-label">{{ data.label }}</span>
    </template>
    <template v-else>
      <span class="slot-plus" aria-hidden="true">
        <!--
          Inline SVG plus (16px, stroke var(--control) via the span's
          currentColor, 1.5 width): renders instantly, no Iconify bundle
          round-trip — empty charts must never show a blank slot.
        -->
        <svg viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3.25v9.5M3.25 8h9.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </span>
    </template>
  </button>
</template>

<style scoped>
/*
 * Card anatomy: icon area (~70% of the card) over a single-line label,
 * 1px hairline, radius from the shared token. No shadows, no gradients.
 */
.slot-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 6%;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background-color: var(--surface);
  color: var(--text);
  font: inherit;
  cursor: pointer;
  transition: border-color 120ms ease;
}

.slot-card:hover {
  border-color: var(--control);
}

/* Selected — 2px accent outline, 2px offset; zero layout shift, no shadow. */
.slot-card.is-selected {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Empty - dashed 1px box on the sheet itself (house rule for builders):
   no fill, so an empty chart reads as paper, not as pre-filled cards. */
.slot-card.is-empty {
  border-style: dashed;
  border-color: var(--control);
  background-color: transparent;
}

/* Icon area stretches to everything the label doesn't need (~70%). */
.slot-icon {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
}

.slot-glyph {
  width: 100%;
  height: 100%;
}

.slot-pictogram {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.slot-label {
  flex: 0 0 auto;
  width: 100%;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.slot-plus {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--control);
}

.slot-plus svg {
  width: 100%;
  height: 100%;
}
</style>
