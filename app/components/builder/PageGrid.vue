<script setup lang="ts">
/**
 * PageGrid — the print page's free rows×cols card layout (subtask 09):
 * a pure CSS grid translated from the doc's `grid`, rendering one GridCell
 * per position in row-major order (empty and filled alike — the doc model
 * keeps empty cells so positions never shift under undo/redo).
 *
 * Print contract (shared with PrintPage — this component adds no frame):
 * - Tracks stretch 1fr on both axes and the sheet's inner flex supplies the
 *   height; the page geometry (aspect, margins, title row) stays PrintPage's.
 * - All interior geometry is sheet-relative: the doc gap renders through
 *   `gridGapCss` as `gapMm / pageWidthMm × 100cqw`, reading the page root's
 *   `--page-w-mm` (PrintPage publishes it; fallback 210mm = A4 for isolated
 *   rendering). No px, no re-derivation on orientation switches.
 * - The S/M/L label size rides the sheet too: this root sets
 *   `--slot-label-base` (11cqw, the approved medium) and `--slot-label-scale`
 *   from doc.grid.labelSize, plus a `data-label-size` styling hook. GridCell
 *   types its label as `calc(var(--slot-label-base) * var(--slot-label-scale))`
 *   — the font itself is GridCell's; the scale lands here (v1 pattern), and
 *   the pair reproduces the approved 9/11/13.5 cqw steps exactly.
 *
 * GridCell contract (subtask 10 implements `./GridCell.vue` to this exact
 * surface — this component draws nothing of the card itself):
 *
 * @prop cell     {CellData}  the position's data (icon, label, tint, textOnly, imageDataUrl)
 * @prop index    {number}    row-major position (0 → rows×cols−1), passed straight through
 * @prop selected {boolean}   `true` when the card editor targets this filled card
 * @prop asking   {boolean}   `true` when the add flow asks this empty card (mint pulse, ×1)
 *
 * @emits select(index)            — activation (click / Enter / Space) of a FILLED card;
 *                                   upstream calls store.selectCell
 * @emits ask(index)               — activation of an EMPTY card; upstream calls store.askCell
 *                                   (decide filled/empty with isCellEmpty, utils/doc-reducers)
 * @emits swap(from, to)           — drop of dragged cell `from` onto this card (`to`);
 *                                   forward from===to unchanged — upstream store.swapCells
 *                                   is already a no-op for self-drops
 * @emits label-edit(index)        — double-click (or Enter on the label) starts the inline
 *                                   WYSIWYG label editor inside the cell
 * @emits label-input(index, text) — streamed keystrokes of that editor; upstream calls
 *                                   store.setLabel so the 600ms coalescing makes one undo step
 *
 * Events MUST all be declared in GridCell's `defineEmits` so a parent listener
 * never leaks onto the root element as a native DOM handler (notably `select`).
 * Root element obligations: a SINGLE root element carrying `data-index="index"`
 * (scope stamping, pulse targeting, tests, keyboard nav hooks) and
 * `min-width: 0; min-height: 0` — the tracks are 1fr, so an unwrapped label
 * must never stretch a track (mockup parity). State visuals (dashed empty,
 * tint, sel ring, writeline, ask-hint) are GridCell's own classing. NO slots
 * — GridCell owns its rendering.
 *
 * Reflow (Stage 3: grid reflow 160ms): when rows/cols/gap change, `grid-reflow`
 * plays once on every cell root (transform/opacity only, no entrance animation
 * on mount — the class only switches on CHANGE), and `prefers-reduced-motion`
 * kills it entirely. Host wiring passes store actions to these emits verbatim.
 */
import { computed, onScopeDispose, ref, watch } from 'vue'
import type { CellData, GridSetup } from '~/types/chart'

// Created by subtask 10 — bootstrapped against the contract documented above.
import GridCell from './GridCell.vue'
import {
  SLOT_LABEL_BASE_CQW,
  gridGapCss,
  gridTemplateCss,
  slotLabelScale,
} from '~/utils/grid-geometry'

const props = defineProps<{
  /** Grid geometry from doc.grid — rows/cols/gap/labelSize drive every style below. */
  grid: GridSetup
  /** Position-indexed cells (length = rows × cols per the doc invariant). */
  cells: CellData[]
  /** Selected card's index, or `null` when nothing is selected. */
  selectedCellIndex: number | null
  /** Asking card's index (add flow target), or `null`. */
  askingCellIndex: number | null
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'ask', index: number): void
  (e: 'swap', from: number, to: number): void
  (e: 'label-edit', index: number): void
  (e: 'label-input', index: number, label: string): void
}>()

/** Track sizing + sheet-relative gap + the label scale vars, all from doc.grid. */
const gridStyle = computed<Record<string, string>>(() => ({
  ...gridTemplateCss(props.grid.rows, props.grid.cols),
  gap: gridGapCss(props.grid.gap),
  '--slot-label-base': `${SLOT_LABEL_BASE_CQW}cqw`,
  '--slot-label-scale': String(slotLabelScale(props.grid.labelSize)),
}))

// --- Reflow (Stage 3: grid reflow 160ms, transform/opacity only, no entrance animation) ---

/** True only while a geometry change animation is in flight. */
const reflowing = ref(false)
/** Settle window: animation length (160ms) plus a small tail so it completes. */
const REFLOW_SETTLE_MS = 200
/** Runs the settle window; null when idle. Cleared with the scope. */
let settleTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Raising `reflowing` swaps the animation on. It is left running (timer only
 * pushed forward) while the gap slider streams rapid changes, so the cell
 * pulse never strobes per frame — one calm reflow per gesture burst.
 */
watch(
  () => `${props.grid.rows}|${props.grid.cols}|${props.grid.gap}`,
  () => {
    if (settleTimer === null) reflowing.value = true
    if (settleTimer !== null) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      reflowing.value = false
      settleTimer = null
    }, REFLOW_SETTLE_MS)
  },
)

onScopeDispose(() => {
  if (settleTimer !== null) clearTimeout(settleTimer)
})

// --- Event forwarding (payloads pass through untouched, contract above) ---

function onSelect(index: number): void {
  emit('select', index)
}

function onAsk(index: number): void {
  emit('ask', index)
}

function onSwap(from: number, to: number): void {
  emit('swap', from, to)
}

function onLabelEdit(index: number): void {
  emit('label-edit', index)
}

function onLabelInput(index: number, label: string): void {
  emit('label-input', index, label)
}
</script>

<template>
  <div
    class="grid"
    :class="{ reflow: reflowing }"
    :data-label-size="grid.labelSize"
    :style="gridStyle"
    role="group"
    aria-label="Chart cards"
  >
    <GridCell
      v-for="(cell, index) in cells"
      :key="cell.id"
      :cell="cell"
      :index="index"
      :selected="index === selectedCellIndex"
      :asking="index === askingCellIndex"
      @select="onSelect"
      @ask="onAsk"
      @swap="onSwap"
      @label-edit="onLabelEdit"
      @label-input="onLabelInput"
    />
  </div>
</template>

<style scoped>
/*
 * The sheet's inner area (PrintPage's .page-grid slot) supplies the box;
 * this root only maps it to the doc's tracks. Explicit template rows come
 * from the style binding; grid-auto-rows is the 1fr safety net if a payload
 * ever exceeded its grid.
 */
.grid {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-auto-rows: 1fr;
}

/*
 * Grid reflow (Stage 3): one 160ms ease on every cell root — transform and
 * opacity only. Vue stamps the parent scope id on child component roots, so
 * `> *` reaches each GridCell root (the only children this template has).
 * On mount the class is absent: no entrance animation, per the house rule.
 */
.grid.reflow > * {
  animation: grid-reflow 160ms ease;
}

@keyframes grid-reflow {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .grid.reflow > * {
    animation: none;
  }
}
</style>
