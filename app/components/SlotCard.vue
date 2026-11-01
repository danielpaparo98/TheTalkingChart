<script setup lang="ts">
/**
 * One chart card — the sheet's atom. Four states:
 *  - filled: pastel card (icon + label), the printed thing itself;
 *  - filled + selected: deep-green ring, label dotted for rename,
 *    the compact editor anchors to it;
 *  - empty: it ASKS — a mint ⊕ above "add a picture"; clicking opens
 *    the word picker (store.askSlot);
 *  - empty + asking ("growing"): the card has opened into the picker.
 *
 * Every card is a drop target (data-slot-drop) for the palette drag.
 * Label editing stays inline on the card: click the label of a selected
 * card and an identically-sized input swaps in — WYSIWYG, the sheet is
 * the editor. Selection and asking are store UI state.
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
  /** Card tint (hex) applied as the pastel fill; null = white. */
}>()

const chartStore = useChartStore()
const { dragHoverSlotId, wasJustDragged } = useIconDrag()

const hasIcon = computed(() => props.data.icon !== null)
const isSelected = computed(() => chartStore.selectedSlotId === props.data.id)
const isAsking = computed(() => chartStore.askingSlotId === props.data.id)
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
  if (!hasIcon.value) return 'Empty card — add a picture'
  return props.data.label !== '' ? props.data.label : 'Card without label'
})

// --- interactions ---

function onCardClick(): void {
  if (wasJustDragged()) return
  if (!hasIcon.value) {
    // the empty card asks for its word
    chartStore.askSlot(props.data.id)
    return
  }
  chartStore.selectSlot(isSelected.value ? null : props.data.id)
}

// --- inline label editing (WYSIWYG: edit where it prints) ---

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
</script>

<template>
  <div
    class="slot-cell"
    :data-slot-drop="data.id"
    :class="{ 'is-drop': isDropHover, 'is-selected': isSelected, 'is-asking': isAsking }"
  >
    <button
      type="button"
      class="slot-card"
      :class="{
        'is-empty': !hasIcon,
        'is-selected': isSelected,
        'is-asking': isAsking,
      }"
      :style="cardStyle"
      :aria-label="ariaLabel"
      :aria-pressed="hasIcon ? isSelected : undefined"
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
        >{{ data.label !== '' ? data.label : 'add a label' }}</span>
      </template>
      <template v-else>
        <span class="slot-plus" aria-hidden="true">+</span>
        <span class="slot-invite">add a picture</span>
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
 * Cell: the drop target wrapper. Drop hover = mint fill + deep inset ring
 * so the landing spot is unmistakable mid-drag; selection mirrors onto the
 * wrapper so the page can anchor the editor to the card.
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
  border: 2.5px solid var(--mint-deep);
  border-radius: var(--radius-card);
  background: var(--mint-soft);
  pointer-events: none;
}

.slot-cell.is-selected { z-index: 5; }
.slot-cell.is-asking { z-index: 6; }

/*
 * Card anatomy: icon area over a single-line label, hairline edge, radius
 * from the shared token. Flat — separation is the fill, not a shadow.
 */
.slot-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 7%;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background-color: var(--surface);
  color: var(--text);
  font: inherit;
  cursor: pointer;
  transition: border-color 120ms ease;
}

.slot-card.filled:hover { border-color: var(--control); }

/* Selected — deep-green ring, zero layout shift, no shadow. */
.slot-card.is-selected { outline: 3px solid var(--mint-deep); outline-offset: 2px; }

/* Empty — the card asks: a mint ⊕ above the invitation. */
.slot-card.is-empty {
  background-color: transparent;
  border: 1.5px dashed var(--control);
  gap: 6px;
}
.slot-card.is-empty:hover { border-color: var(--text); }
.slot-card.is-empty:hover .slot-plus { background: var(--mint); }

.slot-plus {
  display: flex; align-items: center; justify-content: center;
  width: clamp(16px, 2.6cqw, 24px); height: clamp(16px, 2.6cqw, 24px);
  border-radius: 50%;
  background: var(--mint-soft); color: var(--mint-deep);
  font-size: clamp(11px, 1.8cqw, 15px); font-weight: 600; line-height: 1;
  transition: background 120ms ease;
}

.slot-invite {
  font-size: clamp(12px, 1.9cqw, 13.5px);
  color: var(--muted);
  text-align: center;
  line-height: 1.3;
}

/* Asking — the card has grown into the picker. */
.slot-card.is-asking {
  border: 2.5px solid var(--mint-deep);
  background: var(--mint-soft);
}

/* Icon area stretches to everything the label doesn't need. */
.slot-icon {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
}

.slot-glyph { width: 62%; height: 62%; }
.slot-pictogram { width: 62%; height: 62%; object-fit: contain; }

.slot-label {
  flex: 0 0 auto;
  width: 100%;
  overflow: hidden;
  font-size: clamp(12px, 2.2cqw, 16px);
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Editability hint on the selected card's label (dotted text underline). */
.slot-label.is-editable {
  cursor: text;
  text-decoration: underline dotted var(--control);
  text-underline-offset: 3px;
}

/*
 * The inline editor: pinned exactly over the label line, sized by the
 * same cqw rule (ChartSheet's :deep override) so the swap never shifts
 * the sheet.
 */
.slot-label-input {
  position: absolute;
  left: 3%;
  right: 3%;
  bottom: 4%;
  min-width: 0;
  padding: 0;
  border: none;
  border-bottom: 1.5px solid var(--accent); /* taste-skill-ignore */
  background: var(--surface);
  font: inherit;
  font-size: clamp(12px, 2.2cqw, 16px);
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  color: var(--text);
  outline: none;
}
</style>
