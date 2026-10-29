<script setup lang="ts">
/**
 * One chart card — filled (icon + label), empty (dashed placeholder) and
 * selected (2px accent outline) states of a slot (contract line 70).
 *
 * WYSIWYG editing, on the sheet:
 *  - The card is a drop target: `data-slot-drop` marks the hit area for the
 *    palette's pointer drag (useIconDrag); a hovered drag highlights the
 *    cell in the accent.
 *  - The label edits in place: selecting the card, then clicking its label,
 *    swaps in an identically-sized input (sized by ChartSheet's cqw rule);
 *    blur/Enter commits, Escape cancels. The input is a sibling overlay of
 *    the button (never nested interactive elements).
 *
 * Selection goes straight through the chart store; clicking a selected card
 * deselects it (the editor closes with it). A native <button> provides the
 * button role, tab order and Enter/Space activation by default, so the card
 * is keyboard-selectable without extra handlers.
 *
 * Icon color: bundle icons draw in the inherited ink (currentColor);
 * openmoji color icons carry their own palette and render plain — the
 * component never forces a color onto the glyph itself.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useChartStore } from '~/stores/chart'
import { useIconDrag } from '~/composables/useIconDrag'
import { pictogramImageUrl } from '~/composables/useArasaac'
import type { SlotData } from '~/types/chart'

const props = defineProps<{
  /** The slot to render. Named `data` — `slot` is a reserved-ish word in Vue templates. */
  data: SlotData
}>()

const chartStore = useChartStore()
const { dragHoverSlotId, wasJustDragged } = useIconDrag()

const hasIcon = computed(() => props.data.icon !== null)
const isSelected = computed(() => chartStore.selectedSlotId === props.data.id)
const isDropHover = computed(() => dragHoverSlotId.value === props.data.id)

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

/** Accessible name: the label, a filled-but-unlabelled card, or an empty slot. */
const ariaLabel = computed(() => {
  if (!hasIcon.value) return 'Empty card'
  return props.data.label !== '' ? props.data.label : 'Card without label'
})

// --- Inline label editing (WYSIWYG: edit where it prints) ---

const labelEditing = ref(false)
const labelDraft = ref('')
const labelInput = ref<HTMLInputElement | null>(null)

/** Clicking the label of a selected card starts the edit. */
function onLabelClick(event: MouseEvent): void {
  if (!isSelected.value || !hasIcon.value) return
  event.stopPropagation()
  labelDraft.value = props.data.label
  labelEditing.value = true
  void nextTick(() => {
    labelInput.value?.focus()
    labelInput.value?.select()
  })
}

function commitLabelEdit(): void {
  if (!labelEditing.value) return
  labelEditing.value = false
  const next = labelDraft.value.trim()
  if (next !== props.data.label) chartStore.setSlotLabel(props.data.id, next)
}

function onLabelKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitLabelEdit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    labelEditing.value = false
  }
  event.stopPropagation()
}

/** Deselecting the card closes any open editor. */
watch(isSelected, (selected) => {
  if (!selected) labelEditing.value = false
})

/** Click toggles selection — the editor opens and closes with the card. */
function onCardClick(): void {
  if (wasJustDragged()) return
  chartStore.selectSlot(isSelected.value ? null : props.data.id)
}
</script>

<template>
  <div
    class="slot-cell"
    :data-slot-drop="data.id"
    :class="{ 'is-drop': isDropHover, 'is-selected': isSelected }"
  >
    <button
      type="button"
      class="slot-card"
      :class="{ 'is-empty': !hasIcon, 'is-selected': isSelected }"
      :style="cardStyle"
      :aria-label="ariaLabel"
      :aria-pressed="isSelected"
      @click="onCardClick"
    >
      <template v-if="hasIcon">
        <span class="slot-icon" aria-hidden="true">
          <img
            v-if="pictogramSrc !== ''"
            class="slot-pictogram"
            :src="pictogramSrc"
            alt=""
            draggable="false"
          >
          <Icon v-else-if="bundleIcon !== ''" class="slot-glyph" :icon="bundleIcon" />
        </span>
        <span
          v-if="data.label !== '' || isSelected"
          class="slot-label"
          :class="{ 'is-editable': isSelected }"
          @click="onLabelClick"
        >{{ data.label !== '' ? data.label : 'Add label' }}</span>
      </template>
      <template v-else>
        <span class="slot-plus" aria-hidden="true">
          <!--
            Inline SVG plus (renders instantly, no Iconify bundle round-trip —
            empty charts must never show a blank slot).
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

    <!-- Inline label editor: an overlay sibling (never nested in the button),
         sized by the same cqw rule so the swap never shifts the sheet. -->
    <input
      v-if="labelEditing"
      ref="labelInput"
      v-model="labelDraft"
      class="slot-label-input"
      type="text"
      maxlength="40"
      autocomplete="off"
      aria-label="Card label"
      @blur="commitLabelEdit"
      @keydown="onLabelKeydown"
      @click.stop
    >
  </div>
</template>

<style scoped>
/*
 * Cell: the drop target wrapper. Drop hover = 2px accent inset so the
 * landing spot is unmistakable mid-drag; selection mirrors onto the wrapper
 * so the page can anchor the editor to the card.
 */
.slot-cell {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.slot-cell.is-drop::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--accent);
  border-radius: var(--radius-card);
  pointer-events: none;
}

.slot-cell.is-selected {
  z-index: 5;
}

/*
 * Card anatomy: icon area (~70% of the card) over a single-line label,
 * 1px hairline, radius from the shared token. No elevations, no gradients.
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

/* Selected — 2px accent outline, 2px offset; zero layout shift, no elevation. */
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

/* Empty cards invite the placement: the plus warms up on hover. */
.slot-card.is-empty:hover {
  border-color: var(--accent);
  color: var(--accent);
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

/* Editability hint on the selected card's label (dotted text underline — not a rule). */
.slot-label.is-editable {
  cursor: text;
  text-decoration: underline dotted var(--control);
  text-underline-offset: 3px;
}

/*
 * The inline editor: pinned exactly over the label line (6% card padding +
 * the sheet's cqw label sizing comes from ChartSheet's :deep override).
 */
.slot-label-input {
  position: absolute;
  left: 2%;
  right: 2%;
  bottom: 2%;
  min-width: 0;
  padding: 0;
  border: none;
  border-bottom: 1px solid var(--accent); /* taste-skill-ignore */
  background: var(--surface);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
  color: var(--text);
  outline: none;
}

.slot-plus {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--muted);
  transition: color 120ms ease;
}

.slot-plus svg {
  width: 100%;
  height: 100%;
}
</style>
