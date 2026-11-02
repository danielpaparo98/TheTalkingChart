<script setup lang="ts">
/**
 * GridCell — one card position of the print grid (subtask 10): the ONLY
 * component that draws a card. Implements the GridCell contract
 * PageGrid.vue publishes in its header, verbatim:
 *
 *   @prop cell / index / selected / asking               (contract props)
 *   @emits select(index) / ask(index) / swap(from, to)
 *         / label-edit(index) / label-input(index, text) (contract emits)
 *   Root: ONE element carrying `data-index="index"` and
 *   `min-width: 0; min-height: 0`; the label is sized
 *   calc(var(--slot-label-base, 11cqw) * var(--slot-label-scale, 1)).
 *   All five events are declared in defineEmits so a parent listener never
 *   leaks onto the root as a native DOM handler (`select` above all). The
 *   root is the query container for the card's own cqw units (mockup
 *   parity: picture/text/line sizes resolve cell-relative).
 *
 * Two OPTIONAL additions leave room for the page while keeping PageGrid
 * untouched (it passes only the four contract props today):
 *  - `pulsing?: boolean` — external state hook for the mint ask ring.
 *    When left unset the ring is driven internally: any false→true flip of
 *    `asking` (store.askCell and askNextAfter both flip exactly this) plays
 *    the mockup's pulse — one 400ms ring, ends on animationend with a 450ms
 *    failsafe (reduced-motion: animation none, the ring stays static and
 *    still self-cleans at 450ms).
 *  - `cols?: number` — grid column count for accessible position naming
 *    (cellPosition, grid-geometry). When absent the empty-card label falls
 *    back to an ordinal, because PageGrid does not pass it.
 *
 * LIBRARY DROP → PAGE hand-off (LibraryPanel's placement contract): a
 * dropped library tile is validated here (readLibraryDragData) and handed
 * UP as a bubbling CustomEvent `builder-cell-place` with detail
 * `{ index, payload }` (useCellDrag.emitLibraryPlace) — the page writes the
 * cell and refreshes the recents strip, while PageGrid keeps its frozen
 * 5-event surface. Swap drops ARE the contract's `swap(from, to)` emit;
 * the 100ms drop tint and the both-cards 160ms translate are
 * useCellDrag's (scheduleSwapFlip's FLIP, skipped under reduced motion).
 *
 * Label editing (WYSIWYG): double-click — or Enter on an already-selected
 * card — swaps an identically-styled input in; every keystroke emits
 * `label-input(index, text)` so the store's 600ms coalescing keeps typing
 * one undo step; Enter/blur commit a final trimmed value (same window),
 * Escape closes with no extra emit (undo reverts the streamed edits).
 *
 * Keyboard: each cell is a tab stop (role=button, tabindex=0); Enter/Space
 * activate (select for filled cards via the host, ask for empty ones).
 * Escape EMITS NOTHING from this cell — the page owns the global unwind;
 * while editing, the input stops propagation and closes itself.
 *
 * Motion: 140ms fill flash on empty→filled transitions (keyed off
 * isCellEmpty so every placement path flashes once — add flow, recents,
 * uploads, library drops), 100ms drop tint, drag opacity, and the pulse
 * above. Reduced motion kills all self-driven movement.
 *
 * Screen-only affordances (ask hint, pulse ring) carry data-screen-only so
 * the print stylesheet drops them in one rule; the tint fill and the
 * dashed empty border stay for print (the empty-cell print policy belongs
 * to the print block, not this component).
 */
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { pictogramImageUrl } from '~/composables/useArasaac'
import { useCellDrop } from '~/composables/useCellDrag'
import type { CellData } from '~/types/chart'
import { isCellEmpty } from '~/utils/doc-reducers'
import { cellPosition } from '~/utils/grid-geometry'

const props = defineProps<{
  /** The position's data (icon, label, tint, textOnly, imageDataUrl). */
  cell: CellData
  /** Row-major position (0 → rows×cols−1), passed straight through. */
  index: number
  /** True when the card editor targets this filled card. */
  selected: boolean
  /** True when the add flow asks this empty card (mint pulse, ×1). */
  asking: boolean
  /** Optional external pulse hook (see header); normally left unset. */
  pulsing?: boolean
  /** Optional grid column count for row/column aria naming (see header). */
  cols?: number
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'ask', index: number): void
  (e: 'swap', from: number, to: number): void
  (e: 'label-edit', index: number): void
  (e: 'label-input', index: number, label: string): void
}>()

// --- Cell state (one definition of filled, shared with the store/reducers) ---

const isFilled = computed(() => !isCellEmpty(props.cell))
const isTextOnly = computed(() => props.cell.textOnly === true)

/** Mockup precedence: the upload wins, then ARASAAC, then the bundle glyph. */
type GlyphKind = 'upload' | 'arasaac' | 'bundle'
const glyphKind = computed<GlyphKind | null>(() => {
  if (!isFilled.value || isTextOnly.value) return null
  if (props.cell.imageDataUrl !== undefined && props.cell.imageDataUrl !== '') return 'upload'
  if (props.cell.icon === null) return null
  return props.cell.icon.source === 'arasaac' ? 'arasaac' : 'bundle'
})

const arasaacSrc = computed(() => {
  const icon = props.cell.icon
  return glyphKind.value === 'arasaac' && icon !== null ? pictogramImageUrl(icon.name, 300) : ''
})

const bundleIcon = computed(() => {
  const icon = props.cell.icon
  return glyphKind.value === 'bundle' && icon !== null ? `${icon.set}:${icon.name}` : ''
})

/** Tint rides a CSS var, never an inline background — the drop tint must win. */
const tintVars = computed<Record<string, string>>(() => {
  const color = props.cell.color
  const vars: Record<string, string> = {}
  if (typeof color === 'string' && color !== '') vars['--cell-tint'] = color
  return vars
})

/** Uploaded pictures read like content for screen readers (alt = label). */
const uploadAlt = computed(() => props.cell.label)

const ariaLabel = computed<string>(() => {
  if (!isFilled.value) {
    if (props.cols !== undefined) {
      const { row, col } = cellPosition(props.index, props.cols)
      return `Empty card row ${row + 1}, column ${col + 1}. Activate to add a picture.`
    }
    return `Empty card ${props.index + 1}. Activate to add a picture.`
  }
  const name = props.cell.label.trim()
  return name === '' ? 'Card, no label. Activate to edit.' : `Card ${name}. Activate to edit.`
})

// --- Drag: this card is a drop target; filled cards also drag as sources ---

const rootEl = ref<HTMLElement | null>(null)

const {
  dropHover: isDropHover,
  dragging: isDragSource,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
} = useCellDrop({
  index: () => props.index,
  label: () => props.cell.label,
  root: () => rootEl.value,
  onSwap: (from, to) => {
    emit('swap', from, to)
  },
})

// --- Activation: click / Enter / Space → select or ask ----------------------

function activate(): void {
  if (!isFilled.value) {
    emit('ask', props.index)
    return
  }
  emit('select', props.index)
}

function onClick(): void {
  if (isEditing.value) return
  activate()
}

function onKeydown(event: KeyboardEvent): void {
  if (isEditing.value) return // the input handles (and stops) its own keys
  if (event.key === 'Enter') {
    event.preventDefault()
    // Enter on an already-selected card goes to the label editor (WYSIWYG);
    // plain Enter activates (select for filled, ask for empty).
    if (props.selected && isFilled.value) {
      startLabelEdit()
      return
    }
    activate()
    return
  }
  if (event.key === ' ') {
    event.preventDefault()
    activate()
  }
  // Escape: never emitted here — the page owns the global unwind.
}

function onDblClick(): void {
  if (!isFilled.value || isEditing.value) return
  // The two clicks composing this gesture already toggled selection:
  // re-assert it before opening the editor (a toggle host lands back on,
  // a set host is unchanged).
  emit('select', props.index)
  startLabelEdit()
  emit('label-edit', props.index)
}

// --- Inline label editing (WYSIWYG: edit where it prints) -------------------

const isEditing = ref(false)
const labelDraft = ref('')
const labelInputEl = ref<HTMLInputElement | null>(null)

function startLabelEdit(): void {
  if (isEditing.value || !isFilled.value) return
  labelDraft.value = props.cell.label
  isEditing.value = true
  void nextTick(() => {
    labelInputEl.value?.focus()
    labelInputEl.value?.select()
  })
}

function onDraftInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  labelDraft.value = value
  // Streamed keystrokes — upstream pushes them into store.setLabel so the
  // 600ms coalescing turns typing into a single undo step.
  emit('label-input', props.index, value)
}

function onDraftKeydown(event: KeyboardEvent): void {
  // Typing must not leak to root/page handlers (undo shortcuts, Escape unwind).
  event.stopPropagation()
  if (event.key === 'Enter') {
    event.preventDefault()
    closeLabelEdit(true)
  } else if (event.key === 'Escape') {
    closeLabelEdit(false)
  }
}

function onDraftBlur(): void {
  // Focus loss reaches here even when no key closed the editor.
  closeLabelEdit(true)
}

function closeLabelEdit(commit: boolean): void {
  if (!isEditing.value) return
  isEditing.value = false
  if (!commit) return // Escape: undo reverts the streamed edits, nothing more to do
  const next = labelDraft.value.trim()
  if (next !== props.cell.label) emit('label-input', props.index, next)
}

// --- Pulse (the mint ask ring — fires with every asking flip) ---------------

const PULSE_CLEANUP_MS = 450 // animation length + tail (mockup parity)

const pulseOn = ref(false)
const pulseKey = ref(0)
let pulseTimer: ReturnType<typeof setTimeout> | null = null

function openPulse(): void {
  closePulse()
  pulseKey.value += 1 // re-keying restarts the one-shot animation
  pulseOn.value = true
  pulseTimer = setTimeout(() => {
    pulseTimer = null
    pulseOn.value = false
  }, PULSE_CLEANUP_MS)
}

function closePulse(): void {
  if (pulseTimer !== null) {
    clearTimeout(pulseTimer)
    pulseTimer = null
  }
  pulseOn.value = false
}

/** animationend path (400ms); the timer covers the reduced-motion case. */
function onPulseAnimationEnd(): void {
  pulseOn.value = false
}

watch(
  () => props.asking,
  (asking) => {
    if (asking) openPulse()
    else closePulse()
  },
)

watch(
  () => props.pulsing,
  (pulsing) => {
    // External hook (PageGrid never passes it today — see header).
    if (pulsing === true) openPulse()
    else if (pulsing === false) closePulse()
  },
)

// --- Placement flash (140ms scale-in on empty→filled transitions) -----------

const FILL_CLEANUP_MS = 200

const justFilled = ref(false)
let fillTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => isCellEmpty(props.cell),
  (empty, wasEmpty) => {
    // Mount never animates (house rule): only real fill transitions flash.
    if (wasEmpty === true && empty === false) {
      justFilled.value = true
      // Timer cleanup, not animationend: under reduced motion the animation
      // never runs or finishes, so the class must not linger either way.
      if (fillTimer !== null) clearTimeout(fillTimer)
      fillTimer = setTimeout(() => {
        fillTimer = null
        justFilled.value = false
      }, FILL_CLEANUP_MS)
    }
  },
)

onScopeDispose(() => {
  closePulse()
  if (fillTimer !== null) {
    clearTimeout(fillTimer)
    fillTimer = null
  }
})
</script>

<template>
  <div
    ref="rootEl"
    class="cell"
    :class="{
      'is-empty': !isFilled,
      'is-filled': isFilled,
      'tinted': cell.color !== undefined && cell.color !== null && cell.color !== '',
      'text-only': isTextOnly,
      'is-selected': selected && isFilled,
      'is-asking': asking,
      'is-drop': isDropHover,
      'is-dragging': isDragSource,
      'just-filled': justFilled,
    }"
    :style="tintVars"
    :data-index="index"
    role="button"
    tabindex="0"
    :draggable="isFilled"
    :aria-label="ariaLabel"
    :aria-pressed="isFilled ? selected : undefined"
    @click="onClick"
    @dblclick="onDblClick"
    @keydown="onKeydown"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <span
      v-if="pulseOn"
      :key="pulseKey"
      class="pulse-ring"
      data-screen-only
      aria-hidden="true"
      @animationend="onPulseAnimationEnd"
    ></span>

    <span v-if="isFilled && !isTextOnly" class="pic" aria-hidden="true">
      <img
        v-if="glyphKind === 'upload' && cell.imageDataUrl !== undefined"
        class="art"
        :src="cell.imageDataUrl"
        :alt="uploadAlt"
        draggable="false"
      >
      <img
        v-else-if="glyphKind === 'arasaac' && arasaacSrc !== ''"
        class="art"
        :src="arasaacSrc"
        alt=""
        draggable="false"
      >
      <Icon
        v-else-if="glyphKind === 'bundle'"
        class="art"
        :icon="bundleIcon"
        aria-hidden="true"
      />
    </span>

    <input
      v-if="isEditing"
      ref="labelInputEl"
      :value="labelDraft"
      class="lab-input"
      type="text"
      aria-label="Edit card label"
      autocomplete="off"
      @input="onDraftInput"
      @keydown="onDraftKeydown"
      @blur="onDraftBlur"
      @dblclick.stop
      @click.stop
    >
    <span v-else-if="cell.label !== ''" class="lab">{{ cell.label }}</span>

    <span v-if="isTextOnly" class="writeline" aria-hidden="true"></span>

    <span v-if="!isFilled" class="ask-hint" data-screen-only aria-hidden="true">＋ add a picture</span>
  </div>
</template>

<style scoped>
/*
 * Poster Desk card anatomy (mockup-transcribed): poster-flat, radius 10px,
 * an inset hairline on untinted fills, dashed mint for the empty ask. All
 * cq units on CHILDREN resolve against this root (container-type), so
 * picture, hint and writing-line sizing is cell-relative at every page
 * size and zoom. The label takes its size from PageGrid's
 * --slot-label-base / --slot-label-scale (the approved 9/11/13.5 cqw steps).
 */
.cell {
  position: relative;
  container-type: inline-size;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6%; /* % = own inline size; cq units ON the container would resolve against the sheet */
  border: 1.5px solid transparent; /* reservation: empty↔filled morphs never shift the box */
  border-radius: 10px; /* cards 10px (mockup --r-card) */
  text-align: center;
  user-select: none;
  cursor: pointer;
  transition: background-color 100ms ease, border-color 100ms ease;
}

.cell:focus-visible {
  outline: 2px solid var(--mint-ink, #1d4d16);
  outline-offset: 1px;
}

/* --- empty: the card asks --- */
.cell.is-empty {
  background: transparent;
  border-style: dashed;
  border-color: var(--mint);
}

.cell.is-empty:hover,
.cell.is-empty:focus-visible {
  background: var(--mint-soft);
}

.ask-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(9px, 8.5cqw, 15px);
  font-weight: 500;
  color: var(--muted);
  opacity: 0;
  transition: opacity 120ms ease;
  pointer-events: none;
  z-index: 1;
}

.cell.is-empty:hover .ask-hint,
.cell.is-empty:focus-visible .ask-hint,
.cell.is-asking .ask-hint {
  opacity: 1;
}

/* --- filled: tint fill or untinted hairline --- */
.cell.is-filled {
  background-color: var(--cell-tint, transparent);
  border-style: solid;
}

/* Untinted fills carry the mockup's hairline on the (reserved) border — box
   shadow stays free for the selection ring. :where() keeps this rule at ZERO
   specificity so downstream state rules (drop tint border) always win. */
:where(.cell.is-filled:not(.tinted)) {
  border-color: var(--line, #e2e8dc);
}

/* selection — an instant mint ring (mint = meaning) */
.cell.is-selected {
  box-shadow: 0 0 0 2.5px var(--mint-ink, #1d4d16);
  z-index: 2;
}

/* --- picture variants (one art box, three glyph sources) --- */
.pic {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 3cqw;
}

.art {
  /* 62% of the leftover card space (v1 parity) — leaves breathing tint */
  width: 62%;
  height: 62%;
  object-fit: contain;
  color: var(--text);
}

/* --- label + inline editor: one size rule, two states --- */
.lab {
  flex: 0 0 auto;
  max-width: 100%;
  overflow: hidden;
  font-size: calc(var(--slot-label-base, 11cqw) * var(--slot-label-scale, 1));
  font-weight: 600;
  line-height: 1.14;
  color: var(--ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.lab-input {
  flex: 0 0 auto;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: none;
  border-bottom: 2px solid var(--mint-ink, #1d4d16);
  background: transparent;
  font: inherit;
  font-size: calc(var(--slot-label-base, 11cqw) * var(--slot-label-scale, 1));
  font-weight: 600;
  line-height: 1.14;
  color: var(--ink);
  text-align: center;
  outline: none;
  user-select: text;
}

/* --- text-only cards: the writing line --- */
.writeline {
  display: block;
  flex: 0 0 auto;
  width: 56cqw;
  margin-top: 3cqw;
  border-top: 1cqw solid rgba(19, 23, 17, 0.32);
}

/* --- drag states --- */
.cell.is-dragging {
  opacity: 0.35;
}

/* Drop tint: class order beats the base background/tint var (no shims) —
   placed after .is-empty/.is-filled so a hovered card always tints. */
.cell.is-drop {
  background-color: var(--mint-soft);
  border-color: var(--mint-ink, #1d4d16);
}

/* --- motion --- */
.pulse-ring {
  position: absolute;
  inset: -4px;
  display: block;
  border: 3px solid var(--mint-ink, #1d4d16);
  border-radius: 14px; /* card radius + 4px (mockup calc) */
  animation: cell-pulse 400ms ease-out 1 both;
  pointer-events: none;
}

@keyframes cell-pulse {
  from {
    opacity: 1;
    transform: scale(0.97);
  }
  to {
    opacity: 0;
    transform: scale(1.1);
  }
}

.cell.just-filled {
  animation: cell-fill 140ms ease-out;
}

@keyframes cell-fill {
  from {
    transform: scale(0.92);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* Reduced motion: every self-driven movement dies; the pulse ring becomes
   the static ring it shows until its failsafe removal (450ms). */
@media (prefers-reduced-motion: reduce) {
  .cell {
    transition: none;
  }
  .ask-hint {
    transition: none;
  }
  .cell.just-filled {
    animation: none;
  }
  .pulse-ring {
    animation: none;
  }
}
</style>
