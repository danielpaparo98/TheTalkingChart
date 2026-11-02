<script setup lang="ts">
/**
 * PageInspector — the inspector's PAGE/DOCUMENT mode (nothing selected).
 * Sheet title (same store action the WYSIWYG title uses), eight paper
 * thumbnails at true relative aspect (4 presets × 2 orientations), print
 * margin presets, grid steppers and the label-size step — all pure math
 * from utils/page-presets, all mutations through store actions so every
 * change is undoable. The ARASAAC credit is surfaced here because it is a
 * doc-level fact (doc.usesArasaac) that travels with print and exports.
 */
import { computed } from 'vue'
import { ARASAAC_ATTRIBUTION } from '~/composables/useArasaac'
import { useChartStore } from '~/stores/chart'
import type { LabelSize, MarginPreset, Orientation, PagePresetId } from '~/types/chart'
import { GRID_LIMITS } from '~/utils/doc-reducers'
import { MARGIN_PRESETS_MM, PAGE_PRESETS, formatMm } from '~/utils/page-presets'
import { paperThumbBox } from '~/utils/page-thumbnail'
import SegmentedControl from './SegmentedControl.vue'
import type { SegmentedOption } from './SegmentedControl.vue'
import StepperControl from './StepperControl.vue'

const store = useChartStore()

const ORIENTATIONS: readonly Orientation[] = ['portrait', 'landscape']

/** The eight paper thumbnails, preset-major order (A4 P/L, Letter P/L, …). */
const paperThumbs = computed(() => {
  const presets = Object.values(PAGE_PRESETS)
  return presets.flatMap((preset) =>
    ORIENTATIONS.map((orientation) => ({
      key: `${preset.id}-${orientation}`,
      presetId: preset.id,
      orientation,
      name: preset.label,
      aria: `${preset.label} ${orientation}`,
      box: paperThumbBox(preset.id, orientation),
      active:
        store.doc.pageSetup.preset === preset.id &&
        store.doc.pageSetup.orientation === orientation,
    })),
  )
})

function pickPaper(presetId: PagePresetId, orientation: Orientation): void {
  store.setPageSetup({ preset: presetId, orientation })
}

/** Margin preset rows in stable narrow→wide order with mm in the name. */
const marginOptions = computed(() => {
  const entries = Object.entries(MARGIN_PRESETS_MM) as [MarginPreset, number][]
  return entries.map(([id, mm]) => ({
    id,
    name: id[0] === undefined ? id : id[0].toUpperCase() + id.slice(1),
    aria: `${id} print margin, ${formatMm(mm)} millimetres`,
  }))
})

const labelSizeOptions: ReadonlyArray<SegmentedOption> = [
  { value: 's', label: 'S', ariaLabel: 'Small labels' },
  { value: 'm', label: 'M', ariaLabel: 'Medium labels' },
  { value: 'l', label: 'L', ariaLabel: 'Large labels' },
]

/** Narrow the control's string value back into the store's exact type. */
function onLabelSize(value: string): void {
  if (value === 's' || value === 'm' || value === 'l') store.setLabelSize(value)
}

function onTitleInput(event: Event): void {
  store.setTitle((event.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="panel" aria-label="Page and document setup">
    <fieldset class="field-block">
      <legend class="kick">Sheet title</legend>
      <input
        class="inp"
        :value="store.doc.title"
        type="text"
        placeholder="e.g. Morning routine"
        aria-label="Sheet title"
        autocomplete="off"
        @input="onTitleInput"
      >
    </fieldset>

    <fieldset class="field-block">
      <legend class="kick">Paper</legend>
      <div class="paper-grid">
        <button
          v-for="thumb in paperThumbs"
          :key="thumb.key"
          type="button"
          class="paper-thumb"
          :aria-label="thumb.aria"
          :aria-pressed="thumb.active"
          @click="pickPaper(thumb.presetId, thumb.orientation)"
        >
          <span
            class="prect"
            aria-hidden="true"
            :style="{ width: `${thumb.box.width}px`, height: `${thumb.box.height}px` }"
          ></span>
          <span class="plab">{{ thumb.name }}</span>
        </button>
      </div>
    </fieldset>

    <fieldset class="field-block">
      <legend class="kick">Print margin</legend>
      <div class="margin-row">
        <button
          v-for="option in marginOptions"
          :key="option.id"
          type="button"
          class="margin-btn"
          :data-m="option.id"
          :aria-label="option.aria"
          :aria-pressed="store.doc.pageSetup.marginPreset === option.id"
          @click="store.setPageSetup({ marginPreset: option.id })"
        >
          <span class="mdiagram" aria-hidden="true"></span>{{ option.name }}
        </button>
      </div>
    </fieldset>

    <fieldset class="field-block">
      <legend class="kick">Grid</legend>
      <StepperControl
        label="Rows"
        :value="store.rows"
        :min="GRID_LIMITS.minRows"
        :max="GRID_LIMITS.maxRows"
        @change="(rows: number) => store.setGrid(rows, store.columns)"
      />
      <StepperControl
        label="Columns"
        :value="store.columns"
        :min="GRID_LIMITS.minCols"
        :max="GRID_LIMITS.maxCols"
        @change="(cols: number) => store.setGrid(store.rows, cols)"
      />
      <StepperControl
        label="Card gap"
        :value="store.doc.grid.gap"
        :min="GRID_LIMITS.minGapMm"
        :max="GRID_LIMITS.maxGapMm"
        :step="2"
        unit="mm"
        decrease-label="Smaller gap"
        increase-label="Bigger gap"
        @change="store.setGap"
      />
    </fieldset>

    <fieldset class="field-block">
      <legend class="kick">Label size</legend>
      <SegmentedControl
        :aria-label="'Label size'"
        :options="labelSizeOptions"
        :model-value="store.doc.grid.labelSize"
        @update:model-value="onLabelSize"
      />
    </fieldset>

    <fieldset v-if="store.doc.usesArasaac" class="field-block">
      <legend class="kick">Attribution</legend>
      <p class="attr">{{ ARASAAC_ATTRIBUTION }}</p>
      <p class="attr-note">Travels with this chart — on screen, in print and in exports.</p>
    </fieldset>
  </section>
</template>

<style scoped>
  .panel { display: block; }
  .field-block {
    border: none;
    border-bottom: 1px solid var(--line);
    margin: 0;
    padding: 14px 16px 16px;
  }
  .field-block:last-child { border-bottom: none; }
  .kick {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 9px;
    padding: 0;
  }
  .inp {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 500;
    color: var(--text);
    padding: 8px 10px;
  }
  .inp::placeholder { color: var(--muted); opacity: 0.75; }
  .inp:focus {
    outline: none;
    border-color: var(--mint-ink, #1d4d16);
    box-shadow: 0 0 0 3px var(--mint-soft);
  }

  /* paper thumbnails — true relative aspect */
  .paper-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .paper-thumb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    border: none;
    background: none;
    font-family: inherit;
    padding: 8px 2px 6px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 100ms ease;
  }
  .paper-thumb:hover { background: var(--desk); }
  .paper-thumb[aria-pressed="true"] { background: var(--mint-soft); }
  .paper-thumb .prect {
    display: block;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 3px;
    transition: box-shadow 100ms ease;
  }
  .paper-thumb[aria-pressed="true"] .prect {
    border-color: transparent;
    box-shadow: 0 0 0 2px var(--mint-ink, #1d4d16);
  }
  .paper-thumb .plab {
    font-size: 10px;
    font-weight: 500;
    color: var(--muted);
  }
  .paper-thumb[aria-pressed="true"] .plab { color: var(--ink); font-weight: 600; }

  /* margin presets */
  .margin-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .margin-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    border: none;
    background: none;
    font-family: inherit;
    padding: 8px 2px 7px;
    border-radius: 8px;
    font-size: 10.5px;
    font-weight: 500;
    color: var(--muted);
    cursor: pointer;
    transition: background-color 100ms ease;
  }
  .margin-btn:hover { background: var(--desk); }
  .margin-btn[aria-pressed="true"] {
    background: var(--mint-soft);
    color: var(--ink);
    font-weight: 600;
  }
  .margin-btn .mdiagram {
    width: 44px;
    height: 30px;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: var(--paper);
    position: relative;
  }
  .margin-btn .mdiagram::after {
    content: "";
    position: absolute;
    border: 1px dashed var(--mint-ink, #1d4d16);
    border-radius: 1px;
  }
  .margin-btn[data-m="narrow"] .mdiagram::after { inset: 3px; }
  .margin-btn[data-m="normal"] .mdiagram::after { inset: 5px; }
  .margin-btn[data-m="wide"] .mdiagram::after { inset: 8px; }

  .attr {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text);
  }
  .attr-note {
    margin: 4px 0 0;
    font-size: 11px;
    line-height: 1.45;
    color: var(--muted);
  }
</style>
