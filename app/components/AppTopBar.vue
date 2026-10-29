<script setup lang="ts">
/**
 * AppTopBar — the 44px framed-sheet top bar (builder blueprint, direction.json
 * line 152): wordmark on the window ground with NO rule below, inline-editable
 * chart title wired to the chart store, and a right cluster (status pill,
 * secondary buttons, icon button, exactly one near-black primary) split by
 * 1px dividers. Self-contained: reads/writes useChartStore internally and
 * emits for the actions it does not own (style panel, export dialog, print).
 */
import { computed } from 'vue'
import { useChartStore } from '../stores/chart'

const emit = defineEmits<{
  (e: 'toggle-style'): void
  (e: 'open-export'): void
  (e: 'print'): void
}>()

const chart = useChartStore()

/** Hard cap for the inline title (top-bar spec: max ~40 chars). */
const TITLE_MAX_LENGTH = 40

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
  <header class="flex h-11 shrink-0 items-center gap-2 bg-ground px-2">
    <!-- Wordmark: accent speech-bubble grid glyph + logotype (text hidden on phone) -->
    <div class="flex shrink-0 items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" class="shrink-0 text-accent">
        <path
          d="M3.25 2.75h11.5c.97 0 1.75.78 1.75 1.75v6c0 .97-.78 1.75-1.75 1.75H8.4l-3.65 3.15v-3.15H3.25c-.97 0-1.75-.78-1.75-1.75v-6c0-.97.78-1.75 1.75-1.75Z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <circle cx="6" cy="6.4" r="1" fill="currentColor" />
        <circle cx="12" cy="6.4" r="1" fill="currentColor" />
        <circle cx="6" cy="9.6" r="1" fill="currentColor" />
        <circle cx="12" cy="9.6" r="1" fill="currentColor" />
      </svg>
      <span class="hidden text-section font-semibold text-text sm:inline">The Talking Chart</span>
    </div>

    <!-- Chart title: borderless 16/600 at rest (ellipsis when long), bordered 32px surface field on focus -->
    <input
      :value="chart.doc.title"
      :maxlength="TITLE_MAX_LENGTH"
      type="text"
      autocomplete="off"
      aria-label="Chart title"
      class="title-input h-8 min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-2.5 text-section font-semibold text-text focus:border-control focus:bg-surface sm:max-w-56 lg:max-w-72"
      @input="onTitleInput"
    >

    <!-- Right cluster: status pill and actions, split by 1px 16px-tall dividers -->
    <div class="ml-auto flex shrink-0 items-center gap-2">
      <span
        v-if="saveStatus !== null"
        class="inline-flex h-5 items-center rounded-full px-2 text-small font-medium"
        :class="statusPillClass"
      >{{ saveStatus === 'saved' ? 'Saved' : 'Unsaved' }}</span>

      <span class="h-4 w-px bg-border" aria-hidden="true"></span>

      <!-- 'New chart' is a desktop-luxury action; hidden with its divider on phone -->
      <div class="hidden shrink-0 items-center gap-2 sm:flex">
        <button
          type="button"
          class="inline-flex h-8 cursor-pointer items-center rounded-control border border-border bg-surface px-2.5 text-body font-medium text-text hover:bg-raised"
          @click="onNewChart"
        >New chart</button>
        <span class="h-4 w-px bg-border" aria-hidden="true"></span>
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

      <!-- The one near-black primary -->
      <button
        type="button"
        class="inline-flex h-8 cursor-pointer items-center justify-center rounded-control border border-primary bg-primary px-2.5 text-body font-medium text-surface hover:opacity-90 active:opacity-80"
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
