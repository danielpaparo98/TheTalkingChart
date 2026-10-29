<script setup lang="ts">
/**
 * ChartSheet — the white A4-landscape sheet: what you see is what prints
 * (context lines 39/43; subtask chart-app-v2-09).
 *
 * Three layers, one job each:
 *  - `.sheet-mount` fills the workspace cell (the page owns placement and the
 *    8px window inset) and is the container-query container the sheet fits
 *    itself into — pure CSS aspect-fit, no ResizeObserver.
 *  - `.sheet-hold` is the aspect-true 297:210 box. It hosts the dashed
 *    printable-area guide as a sibling placed OUTSIDE the sheet root, so the
 *    html2canvas-pro capture of `[data-chart-sheet]` never includes it.
 *  - `section[data-chart-sheet]` is the white sheet and the export/print
 *    root — useExport locates it by that exact attribute; the print
 *    stylesheet pins it to the 297×210mm page box.
 *
 * Print fidelity: every sheet-relative size is in cqw units (% of the sheet's
 * content-area width), so the 900px on-screen sheet and the printed 277mm
 * printable area render proportionally identically — including slot card
 * type, which this sheet overrides onto SlotCard (the sheet is the canvas
 * sizing authority). Hairlines, radii and the grid gap stay px on purpose:
 * 1px is a device hairline on paper too. The print counterpart lives in
 * app/assets/css/main.css (@media print): chrome hidden, only the sheet at
 * A4 landscape, page margin 0, print-color-adjust exact, padding 10mm.
 *
 * Empty charts need no special state: the grid renders every slot and empty
 * slots are dashed boxes — that IS the empty state.
 */
import { computed } from 'vue'
import { useChartStore } from '~/stores/chart'
import ChartGrid from '~/components/ChartGrid.vue'
import AttributionNotice from '~/components/AttributionNotice.vue'

const chartStore = useChartStore()

/** Sheet heading — the document title, edited in the top bar. */
const title = computed(() => chartStore.doc.title)
/** Grid geometry passed through to ChartGrid (slots come from the store). */
const columns = computed(() => chartStore.columns)
const rows = computed(() => chartStore.rows)
</script>

<template>
  <div class="sheet-mount">
    <div class="sheet-hold">
      <!-- Printable-area guide: screen-only overlay, outside [data-chart-sheet]. -->
      <span class="print-guide" aria-hidden="true"></span>
      <section
        data-chart-sheet
        class="sheet"
        role="region"
        aria-label="Chart sheet preview"
      >
        <div class="sheet-content">
          <h2 class="sheet-title">{{ title }}</h2>
          <div class="sheet-grid">
            <ChartGrid :columns="columns" :rows="rows" />
          </div>
          <!-- Compact attribution rides inside the sheet: exports and print carry it. -->
          <div class="sheet-foot">
            <AttributionNotice variant="compact" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/*
 * Geometry. The mount is the query container; the hold derives its width
 * from whichever axis is scarcer (container query units — no JS), and the
 * sheet fills it at exactly 297:210. White surface, 16px radius, 1px edge,
 * no shadow at rest (direction.json sheet rules).
 */
.sheet-mount {
  container-type: size;
  display: flex;
  width: 100%;
  height: 100%;
  /*
   * Printable margin: 3.4% of the sheet width ≈ the 10mm A4 margin at true
   * aspect. Print CSS swaps this var to exactly 10mm on [data-chart-sheet];
   * the guide's inset follows automatically.
   */
  --sheet-pad: 3.4%;
}

.sheet-hold {
  /* min() of "full width" and "full height × A4 ratio" = perfect fit both ways. */
  width: min(100cqw, calc(100cqh * 297 / 210));
  aspect-ratio: 297 / 210;
  /* Auto margins center without the unreachable-overflow trap when a narrow
     container (phone) lets the ratio-driven height exceed the box. */
  margin: auto;
  position: relative;
}

/* Dashed 1px printable-area guide at the padding edge. A sibling of the
   sheet root, never a descendant: the export capture stays pure content,
   and @media print (main.css) hides it for the paper path. */
.print-guide {
  position: absolute;
  inset: var(--sheet-pad);
  border: 1px dashed var(--control);
  pointer-events: none;
}

.sheet {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sheet);
}

/*
 * Sheet interior: title / grid / attribution in a column, all sheet-relative.
 * container-type: inline-size makes the content area the cqw reference —
 * 1cqw = 1% of the printable width (≈277mm printed, proportional on screen).
 */
.sheet-content {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--sheet-pad);
}

.sheet-title {
  flex: 0 0 auto;
  margin: 0 0 1.2cqw;
  overflow: hidden;
  font-size: 4.5cqw; /* ≈12.5mm on A4 — a title read across a desk */
  font-weight: 600;
  line-height: 1.2;
  color: var(--text);
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sheet-grid {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
}

/*
 * Attribution foot: constant slot whether or not the notice renders (an
 * empty chart has no licences to show), so the grid never shifts when the
 * first icon lands. Centering inherits into the compact strip.
 */
.sheet-foot {
  flex: 0 0 auto;
  margin-top: 0.9cqw;
  text-align: center;
}

/*
 * Print-proportional card type. SlotCard freezes its label at 13px and its
 * plus mark at 16px — proportionally smaller printed than on screen. The
 * sheet owns the canvas type scale, so it retargets both to cqw. Borders,
 * radii and ChartGrid's 5px hairline gap stay px: device hairlines.
 */
.sheet-content :deep(.slot-label) {
  /* --slot-label-scale (default 1) is the S/M/L label-size hook: the page
     sets it from data-label-size (StyleControls' label-size emit). */
  font-size: calc(2.2cqw * var(--slot-label-scale, 1));
}

.sheet-content :deep(.slot-plus) {
  width: 2cqw;
  height: 2cqw;
}
</style>
