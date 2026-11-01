<script setup lang="ts">
/**
 * AppTopBar — the builder's 52px top bar. Left: exit arrow + the chart's
 * name (inline-editable) + undo/redo. Right: placement progress ("8 of 16
 * placed" with a tiny bar — momentum you can see), Browse pictures (docks
 * the library on wide screens, drawer below), grid size, chart settings,
 * Export, help, and the one ink-filled primary: Print.
 *
 * The bar's name input and the sheet's inline title edit the same store
 * value — the sheet is the primary edit point (WYSIWYG); the bar keeps
 * the name visible for orientation. Undo/redo talk straight to the chart
 * store's history; the page owns the Ctrl/Cmd+Z keyboard shortcuts.
 */
import { computed } from 'vue'
import SegmentedControl from './SegmentedControl.vue'
import { useChartStore } from '../stores/chart'
import type { GridPreset } from '../types/chart'

/**
 * Panel open states come from the page (it owns the panels) so the toggle
 * buttons can expose aria-expanded (WCAG 4.1.2 state communication).
 */
defineProps<{
  browseOpen: boolean
  settingsOpen: boolean
  helpOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-browse'): void
  (e: 'toggle-settings'): void
  (e: 'open-export'): void
  (e: 'toggle-help'): void
  (e: 'print'): void
}>()

const chart = useChartStore()
const config = useRuntimeConfig()
const logoSrc = `${config.app.baseURL}logo.svg`

/** Hard cap for the inline title (synced with the sheet editor's 60). */
const TITLE_MAX_LENGTH = 60

const placedCount = computed(() => chart.placedCount)
const totalCount = computed(() => chart.gridSize)
const progressPct = computed(() =>
  totalCount.value === 0 ? 0 : Math.round((placedCount.value / totalCount.value) * 100),
)

/** Grid presets, surfaced in the bar (the settings panel repeats them). */
const GRID_OPTIONS = [
  { value: '2x2', label: '2 × 2' },
  { value: '3x3', label: '3 × 3' },
  { value: '4x5', label: '4 × 5' },
  { value: '5x4', label: '5 × 4' },
] as const satisfies ReadonlyArray<{ value: GridPreset; label: string }>

const gridPreset = computed({
  get: () => chart.doc.grid,
  set: (preset: string) => {
    chart.setGrid(preset as GridPreset)
  },
})

function onTitleInput(event: Event): void {
  chart.setTitle((event.target as HTMLInputElement).value)
}
</script>

<template>
  <!-- bar on the desk ground, no bottom rule; padding aligns with the workspace inset -->
  <header class="flex h-[52px] shrink-0 items-center gap-2 px-3.5">
    <!-- Exit: arrow back to the landing (the app names the object, not itself) -->
    <NuxtLink
      to="/"
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-raised hover:text-text"
      aria-label="The Talking Chart — back to home"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M9.5 3.5 5 8l4.5 4.5M5 8h8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </NuxtLink>

    <!-- the brand tile: quiet identity between exit and object -->
    <img :src="logoSrc" alt="" width="24" height="24" class="brand-tile">

    <!-- Chart name: borderless until hover/focus; the sheet's inline edit is primary -->
    <input
      :value="chart.doc.title"
      :maxlength="TITLE_MAX_LENGTH"
      type="text"
      autocomplete="off"
      aria-label="Chart name"
      class="name-input h-9 min-w-0 max-w-[280px] flex-1 rounded-[6px] border border-transparent px-2.5 text-[16px] font-semibold text-text"
      @input="onTitleInput"
    >

    <!-- Undo / redo: the safety net, always in reach -->
    <div class="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        class="icon-btn"
        :disabled="!chart.canUndo"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        @click="chart.undo()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 3 3 6l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 6h6.25a3.5 3.5 0 0 1 0 7H6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
      <button
        type="button"
        class="icon-btn"
        :disabled="!chart.canRedo"
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        @click="chart.redo()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m10 3 3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M13 6H6.75a3.5 3.5 0 0 0 0 7h2.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="ml-auto flex shrink-0 items-center gap-2.5">
      <!-- placement progress: momentum you can see. role=status announces
           each change politely as icons land (WCAG 4.1.3). -->
      <span role="status" class="progress hidden items-center gap-2 text-[13px] font-medium text-muted sm:inline-flex">
        <b class="font-semibold text-text">{{ placedCount }}</b>
        of {{ totalCount }} placed
        <span class="bar" aria-hidden="true"><i :style="{ width: progressPct + '%' }"></i></span>
      </span>

      <!-- storage refused a write — the user must know work won't persist -->
      <span v-if="chart.storageError" role="status" class="storage-note">Not saved — storage unavailable</span>

      <span class="hidden h-5 w-px bg-border sm:block" aria-hidden="true"></span><!-- taste-skill-ignore -->

      <button
        type="button"
        class="tbtn browse"
        aria-label="Browse pictures"
        :aria-expanded="browseOpen"
        @click="emit('toggle-browse')"
      >
        <span class="inline-flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="4.25" stroke="currentColor" stroke-width="1.5"/><path d="m10.4 10.4 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span class="lbl">Browse pictures</span>
        </span>
      </button>

      <span class="hidden h-5 w-px bg-border lg:block" aria-hidden="true"></span><!-- taste-skill-ignore -->

      <!-- Grid size: surfaced in the bar on wide screens (settings repeats it).
           The wrapper owns visibility: the control's own scoped display wins
           over utilities. -->
      <div class="hidden lg:flex">
        <SegmentedControl
          v-model="gridPreset"
          :options="GRID_OPTIONS"
          label="Grid size"
        />
      </div>

      <span class="hidden h-5 w-px bg-border lg:block" aria-hidden="true"></span><!-- taste-skill-ignore -->

      <!-- Chart settings (title, grid, labels, new chart) -->
      <button
        type="button"
        class="icon-btn lbl-btn"
        aria-label="Chart settings"
        aria-controls="chart-settings"
        :aria-expanded="settingsOpen"
        @click="emit('toggle-settings')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 4.75h5.5M11.9 4.75H14M2 11.25h2.1M7.9 11.25H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="4.75" r="1.9" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="11.25" r="1.9" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <span class="lbl hidden xl:inline">Settings</span>
      </button>

      <!-- Export: PNG/PDF live behind the print dialog -->
      <button type="button" class="icon-btn lbl-btn" aria-label="Export" @click="emit('open-export')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2.25v7.5M4.9 6.9 8 10l3.1-3.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 10.75v1A1.75 1.75 0 0 0 4.25 13.5h7.5a1.75 1.75 0 0 0 1.75-1.75v-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="lbl hidden xl:inline">Export</span>
      </button>

      <!-- Help: brings the first-run hints back -->
      <button
        type="button"
        class="icon-btn"
        aria-label="Help"
        title="Help"
        :aria-expanded="helpOpen"
        @click="emit('toggle-help')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5"/>
          <path d="M6.45 6.3a1.6 1.6 0 1 1 2.2 1.49c-.44.17-.65.47-.65.91v.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="8" cy="11.2" r="0.95" fill="currentColor"/>
        </svg>
      </button>

      <!-- The one ink-filled primary -->
      <button type="button" class="primary" @click="emit('print')">Print</button>
    </div>
  </header>
</template>

<style scoped>
.brand-tile {
  flex: none;
  border-radius: 6px;
  margin-right: 2px;
}
.name-input {
  text-overflow: ellipsis;
}
.name-input:hover { border-color: var(--border); }
/* Keep the global :focus-visible outline — the border change is an extra
   cue, never a replacement (WCAG 2.4.7 / 1.4.11). */
.name-input:focus { border-color: var(--control); background: var(--surface); }

.storage-note {
  font-size: 12px;
  font-weight: 600;
  color: var(--pill-negative-fg);
  background: var(--pill-negative-bg);
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.progress .bar {
  display: inline-block;
  width: 72px; height: 6px;
  border-radius: 999px;
  background: rgba(19, 23, 17, 0.08);
  overflow: hidden;
}
.progress .bar i {
  display: block; height: 100%;
  border-radius: 999px;
  background: var(--mint-deep);
  transition: width 240ms ease;
}

.tbtn {
  height: 38px; padding: 0 16px;
  border: 1px solid var(--border); border-radius: var(--radius-control);
  background: var(--surface); color: var(--text); font-size: 14px; font-weight: 500;
}
.tbtn:hover { background: var(--raised); }

.icon-btn {
  width: 38px; height: 38px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: var(--radius-control);
  background: transparent; color: var(--muted);
}
.icon-btn:hover { background: rgba(0, 0, 0, 0.05); color: var(--text); }
.icon-btn:disabled { opacity: 0.35; cursor: default; }
.icon-btn:disabled:hover { background: transparent; color: var(--muted); }

/* icon + optional text label (Settings / Export at xl) */
.lbl-btn { width: auto; gap: 6px; padding: 0 10px; }
.lbl-btn .lbl { font-size: 14px; font-weight: 500; }

.primary {
  height: 38px; padding: 0 24px;
  border: none; border-radius: var(--radius-control);
  background: var(--primary); color: #fff; font-size: 14px; font-weight: 600;
}
.primary:hover { opacity: 0.88; }

@media (max-width: 720px) {
  /* 44px touch floor for the bar's icon buttons */
  .icon-btn { width: 44px; height: 44px; }
}

@media (max-width: 480px) {
  /* Everything stays reachable on the smallest screens — the labeled
     buttons condense to icons and the name flexes down */
  .lbl-btn { width: 44px; padding: 0; justify-content: center; }
  .lbl-btn .lbl { display: none; }
  .browse { width: 44px; padding: 0; justify-content: center; }
  .browse .lbl { display: none; }
}
</style>
