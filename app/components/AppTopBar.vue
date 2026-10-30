<script setup lang="ts">
/**
 * AppTopBar — the builder's 52px top bar. Left: exit arrow + the chart's
 * name (inline-editable). Right: placement progress ("8 of 16 placed" with
 * a tiny bar — momentum you can see), Browse pictures (opens the drawer),
 * chart settings, Export, and the one ink-filled primary: Print.
 *
 * The bar's name input and the sheet's inline title edit the same store
 * value — the sheet is the primary edit point (WYSIWYG); the bar keeps
 * the name visible for orientation.
 */
import { computed } from 'vue'
import { useChartStore } from '../stores/chart'

const emit = defineEmits<{
  (e: 'toggle-browse'): void
  (e: 'toggle-settings'): void
  (e: 'open-export'): void
  (e: 'print'): void
}>()

const chart = useChartStore()

/** Hard cap for the inline title (synced with the sheet editor's 60). */
const TITLE_MAX_LENGTH = 60

const placedCount = computed(() => chart.placedCount)
const totalCount = computed(() => chart.gridSize)
const progressPct = computed(() =>
  totalCount.value === 0 ? 0 : Math.round((placedCount.value / totalCount.value) * 100),
)

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

    <div class="ml-auto flex shrink-0 items-center gap-2.5">
      <!-- placement progress: momentum you can see -->
      <span class="progress hidden items-center gap-2 text-[13px] font-medium text-muted sm:inline-flex">
        <b class="font-semibold text-text">{{ placedCount }}</b>
        of {{ totalCount }} placed
        <span class="bar" aria-hidden="true"><i :style="{ width: progressPct + '%' }"></i></span>
      </span>

      <span class="hidden h-5 w-px bg-border sm:block" aria-hidden="true"></span><!-- taste-skill-ignore -->

      <button type="button" class="tbtn browse" @click="emit('toggle-browse')">
        <span class="inline-flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="4.25" stroke="currentColor" stroke-width="1.5"/><path d="m10.4 10.4 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span class="lbl">Browse pictures</span>
        </span>
      </button>

      <span class="hidden h-5 w-px bg-border sm:block" aria-hidden="true"></span><!-- taste-skill-ignore -->

      <!-- Chart settings (grid, labels, new chart) -->
      <button type="button" class="icon-btn" aria-label="Chart settings" @click="emit('toggle-settings')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 4.75h5.5M11.9 4.75H14M2 11.25h2.1M7.9 11.25H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="4.75" r="1.9" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="11.25" r="1.9" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>

      <!-- Export: PNG/PDF live behind the print dialog -->
      <button type="button" class="icon-btn" aria-label="Export" @click="emit('open-export')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2.25v7.5M4.9 6.9 8 10l3.1-3.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 10.75v1A1.75 1.75 0 0 0 4.25 13.5h7.5a1.75 1.75 0 0 0 1.75-1.75v-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- The one ink-filled primary -->
      <button type="button" class="primary" @click="emit('print')">Print</button>
    </div>
  </header>
</template>

<style scoped>
.name-input {
  text-overflow: ellipsis;
}
.name-input:hover { border-color: var(--border); }
.name-input:focus { outline: none; border-color: var(--control); background: var(--surface); }

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

.primary {
  height: 38px; padding: 0 24px;
  border: none; border-radius: var(--radius-control);
  background: var(--primary); color: #fff; font-size: 14px; font-weight: 600;
}
.primary:hover { opacity: 0.88; }

@media (max-width: 720px) {
  .name { max-width: 150px; font-size: 15px; }
}
@media (max-width: 480px) {
  .name { max-width: 120px; font-size: 14px; }
  /* the two secondary actions fold away on the smallest screens —
     Print stays; Export/settings return at ≥481px */
  .topbar .icon-btn { display: none; }
  .browse { width: 38px; padding: 0; justify-content: center; }
  .browse .lbl { display: none; }
}
</style>
