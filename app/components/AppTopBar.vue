<script setup lang="ts">
/**
 * AppTopBar — the builder's 44px top bar (app sheet, builder canvas shell):
 * an exit arrow back to the landing, the chart's name inline-editable at
 * 16/600, a status pill, then the action cluster split by 1px dividers —
 * secondary buttons and exactly one ink-filled primary (Print). No rule
 * below: the bar shares the window's stone ground with the workspace.
 *
 * The bar's title input and the sheet's inline title edit the same store
 * value — the sheet is the primary edit point (WYSIWYG); the bar keeps the
 * name visible for orientation while panels are open.
 *
 * Self-contained: reads/writes useChartStore internally and emits for the
 * actions it does not own (style panel, export dialog, print).
 */
import { computed } from 'vue'
import { useChartStore } from '../stores/chart'

const emit = defineEmits<{
  (e: 'toggle-style'): void
  (e: 'open-export'): void
  (e: 'print'): void
}>()

const chart = useChartStore()

/** Hard cap for the inline title (synced with the sheet editor's 60). */
const TITLE_MAX_LENGTH = 60

/**
 * Status pill: 'Saved' when persisted and clean, 'Unsaved' while dirty.
 * If storage is blocked (neither flag set) the pill stays quiet rather
 * than lying — the store keeps the doc dirty in that case anyway.
 */
const saveStatus = computed<'saved' | 'unsaved' | null>(() => {
  if (chart.dirty) return 'unsaved'
  return chart.saved ? 'saved' : null
})

const statusPillClass = computed(() =>
  saveStatus.value === 'saved'
    ? 'bg-pill-positive-bg text-pill-positive-fg'
    : 'bg-pill-warning-bg text-pill-warning-fg',
)

function onTitleInput(event: Event): void {
  chart.setTitle((event.target as HTMLInputElement).value)
}

function onNewChart(): void {
  if (window.confirm('Start a new chart? The current chart will be cleared.')) {
    chart.reset()
  }
}
</script>

<template>
  <!-- 44px bar on the window ground, no bottom rule; px-2 aligns with the 8px sheet inset -->
  <header class="flex h-11 shrink-0 items-center gap-1.5 bg-ground px-2">
    <!-- Exit: arrow back to the landing (the app names the object, not itself) -->
    <NuxtLink
      to="/"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-raised hover:text-text"
      aria-label="The Talking Chart — back to home"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M9.5 3.5 5 8l4.5 4.5M5 8h8.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </NuxtLink>

    <!-- Chart name: borderless 16/600 at rest (ellipsis when long), bordered 32px surface field on focus -->
    <input
      :value="chart.doc.title"
      :maxlength="TITLE_MAX_LENGTH"
      type="text"
      autocomplete="off"
      aria-label="Chart name"
      class="title-input h-8 min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-2 text-section font-semibold text-text focus:border-control focus:bg-surface sm:max-w-56 lg:max-w-72"
      @input="onTitleInput"
    >

    <!-- Right cluster: status pill and actions, split by 1px 16px-tall dividers
       (builder-blueprint chrome; taste-skill-ignore: app-screen dividers). -->
    <div class="ml-auto flex shrink-0 items-center gap-2">
      <span
        v-if="saveStatus !== null"
        class="inline-flex h-5 items-center rounded-full px-2 text-small font-medium"
        :class="statusPillClass"
      >{{ saveStatus === 'saved' ? 'Saved' : 'Unsaved' }}</span>

      <!-- taste-skill-ignore -->
      <span class="h-4 w-px bg-border" aria-hidden="true"></span><!-- taste-skill-ignore -->

      <!-- 'New chart' is a desktop-luxury action; hidden with its divider on phone -->
      <div class="hidden shrink-0 items-center gap-2 sm:flex">
        <button
          type="button"
          class="inline-flex h-8 cursor-pointer items-center rounded-control border border-border bg-surface px-2.5 text-body font-medium text-text hover:bg-raised"
          @click="onNewChart"
        >New chart</button>
        <!-- taste-skill-ignore -->
        <span class="h-4 w-px bg-border" aria-hidden="true"></span><!-- taste-skill-ignore -->
      </div>

      <!-- Style: tertiary icon button (collapses nothing — already icon-only on phone) -->
      <button
        type="button"
        aria-label="Style"
        class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-control border border-transparent bg-transparent text-muted hover:bg-raised hover:text-text"
        @click="emit('toggle-style')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2 4.75h5.5M11.9 4.75H14M2 11.25h2.1M7.9 11.25H14"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <circle cx="10" cy="4.75" r="1.9" stroke="currentColor" stroke-width="1.5" />
          <circle cx="6" cy="11.25" r="1.9" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </button>

      <!-- Export: secondary text button at sm+, icon-only below (aria-label always) -->
      <button
        type="button"
        aria-label="Export"
        class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-control border border-border bg-surface text-text hover:bg-raised sm:w-auto sm:gap-1.5 sm:px-2.5"
        @click="emit('open-export')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 2.25v7.5M4.9 6.9 8 10l3.1-3.1"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M2.5 10.75v1A1.75 1.75 0 0 0 4.25 13.5h7.5a1.75 1.75 0 0 0 1.75-1.75v-1"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        <span class="hidden text-body font-medium sm:inline">Export</span>
      </button>

      <!-- The one ink-filled primary -->
      <button
        type="button"
        class="inline-flex h-8 cursor-pointer items-center justify-center rounded-control border border-primary bg-primary px-3 text-body font-medium text-surface hover:opacity-90 active:opacity-80"
        @click="emit('print')"
      >Print</button>
    </div>
  </header>
</template>

<style scoped>
/*
 * Rest-state truncation only — the input keeps its full value while editing,
 * and every color/border state is a Tailwind utility in the template
 * (no token duplication here).
 */
.title-input {
  text-overflow: ellipsis;
}
</style>
