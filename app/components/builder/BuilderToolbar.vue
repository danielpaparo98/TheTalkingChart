<script setup lang="ts">
/**
 * BuilderToolbar — the content of the 52px top band, slotted into
 * BuilderShell's `toolbar` slot (the shell owns the band box, hairline
 * and stacking; this component owns everything inside it).
 *
 * Presentational + store-read only: undo/redo talk straight to the chart
 * store's 50-deep history (Ctrl/Cmd+Z keyboard shortcuts stay page-owned,
 * like v1), and the name field commits trimmed through `setTitle` —
 * the store's 600ms `title` coalescing collapses repeats into one undo
 * step. Every navigation, dialog and print side effect is EMITTED; the
 * page (subtask 15) owns routing, the gallery/export dialogs and print.
 *
 * Contract:
 * - Props: `libraryOpen` / `inspectorOpen` feed the below-dock toggle
 *   buttons' aria-expanded (Pictures appears <1080px, Settings <1200px —
 *   mirroring the shell's dock queries; the shell has close buttons but
 *   no way to reopen a panel, so the open affordances live here). Optional:
 *   while a dock is docked its toggle renders `display: none`.
 * - Emits: `back` · `toggleLibrary` · `toggleInspector` · `openTemplates`
 *   · `openPage` (the page focuses the inspector's Page mode) ·
 *   `openExport` · `print`.
 *
 * Visual reference: design_iterations/mockup-builder-v2.html — inline
 * stroke SVGs, 36px controls, 8px radii, Work Sans, and mint used exactly
 * once (the Print CTA) per the Poster Desk interactive-only rule.
 */
import { computed } from 'vue'
import { useChartStore } from '~/stores/chart'

const props = defineProps<{
  /** Drawer state (below 1080px) for the Pictures toggle's aria-expanded. */
  libraryOpen?: boolean
  /** Bottom-sheet state (below 1200px) for the Settings toggle's aria-expanded. */
  inspectorOpen?: boolean
}>()

const emit = defineEmits<{
  back: []
  toggleLibrary: []
  toggleInspector: []
  openTemplates: []
  openPage: []
  openExport: []
  print: []
}>()

const store = useChartStore()

/** Hard cap synced with the mockup's name field (60) and the v1 top bar. */
const TITLE_MAX_LENGTH = 60

const libOpen = computed(() => props.libraryOpen ?? false)
const inspOpen = computed(() => props.inspectorOpen ?? false)

/**
 * `change` (blur) is the single commit path — trim, then the field always
 * shows the committed value (mockup parity). Enter delegates to blur so
 * both aliases land here; an unchanged value no-ops in the reducer, so the
 * duplicate call after the manual blur on Enter is harmless.
 */
function onNameCommit(event: Event): void {
  const input = event.currentTarget as HTMLInputElement
  store.setTitle(input.value.trim())
  input.value = store.doc.title
}

function onNameEnter(event: KeyboardEvent): void {
  if (event.key !== 'Enter') return
  event.preventDefault()
  const input = event.currentTarget as HTMLInputElement
  onNameCommit(event)
  input.blur()
}
</script>

<template>
  <div class="toolbar-row">
    <!-- Left: exit arrow + the chart's name (the sheet's h1 is the primary
         edit point; this pill keeps the name visible for orientation). -->
    <button
      type="button"
      class="icon-btn"
      aria-label="Back to charts"
      @click="emit('back')"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M9.5 3.5 5 8l4.5 4.5M5.2 8H13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <input
      class="name"
      type="text"
      :value="store.doc.title"
      placeholder="Untitled chart"
      :maxlength="TITLE_MAX_LENGTH"
      aria-label="Chart name"
      autocomplete="off"
      spellcheck="false"
      @change="onNameCommit"
      @keydown="onNameEnter"
    >

    <!-- Right: below-dock toggles, history, then document actions and the
         one mint CTA. DOM order = visual order, so tabbing reads left→right. -->
    <div class="right">
      <button
        type="button"
        class="tb-btn framed toggle-lib"
        aria-label="Pictures"
        :aria-expanded="libOpen"
        @click="emit('toggleLibrary')"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.5" />
          <rect x="9" y="2" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.5" />
          <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.5" />
          <rect x="9" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <span class="tb-txt">Pictures</span>
      </button>

      <button
        type="button"
        class="icon-btn"
        :disabled="!store.canUndo"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        @click="store.undo()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.2 6.4h6.6a3.1 3.1 0 0 1 0 6.2H7.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          <path d="M5.6 3.8 3 6.4l2.6 2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-btn"
        :disabled="!store.canRedo"
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        @click="store.redo()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M12.8 6.4H6.2a3.1 3.1 0 0 0 0 6.2h2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          <path d="M10.4 3.8 13 6.4l-2.6 2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <span class="divider" aria-hidden="true"></span>

      <button type="button" class="tb-btn" aria-label="Templates" @click="emit('openTemplates')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.5" />
          <rect x="9" y="2" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.5" />
          <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.5" />
          <rect x="9" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <span class="tb-txt">Templates</span>
      </button>

      <button type="button" class="tb-btn" aria-label="Page setup" @click="emit('openPage')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 2h5.4L12.6 5.6V14H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          <path d="M9.2 2v3.8h3.4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
        </svg>
        <span class="tb-txt">Page</span>
      </button>

      <button type="button" class="tb-btn" aria-label="Export" @click="emit('openExport')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2.25v7.5M4.9 6.9 8 10l3.1-3.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M2.5 10.75v1A1.75 1.75 0 0 0 4.25 13.5h7.5a1.75 1.75 0 0 0 1.75-1.75v-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span class="tb-txt" aria-hidden="true">Export</span>
      </button>

      <!-- THE mint CTA — the only mint-filled control in the app. -->
      <button type="button" class="tb-btn cta" @click="emit('print')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4.6 5.6V2.4h6.8v3.2" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          <rect x="2.2" y="5.6" width="11.6" height="5.2" rx="1.2" stroke="currentColor" stroke-width="1.5" />
          <path d="M4.6 9.2h6.8v4.4H4.6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
        </svg>
        Print
      </button>

      <button
        type="button"
        class="tb-btn framed toggle-insp"
        aria-label="Settings"
        :aria-expanded="inspOpen"
        @click="emit('toggleInspector')"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 4.5h10M3 8h7M3 11.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span class="tb-txt">Settings</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Poster Desk tokens come from the global main.css — never redefined here.
 * Values mirror the approved mockup (36px controls, 8px radii). The global
 * :focus-visible layer (2px accent outline, 2px offset) rings every control
 * in this row; the name pill's border tint is an extra cue, not a
 * replacement. Reduced motion clears every transition below. */

.toolbar-row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
}

/* --- icon buttons (back / undo / redo) ------------------------------------ */
.icon-btn {
  width: 36px;
  height: 36px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  transition: background-color 120ms ease, color 120ms ease;
}
.icon-btn:hover {
  background: var(--desk);
  color: var(--text);
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.icon-btn:disabled:hover {
  background: transparent;
  color: var(--muted);
}

/* --- chart name pill (borderless until hover/focus, like the mockup) ------- */
.name {
  min-width: 0;
  flex: 0 1 260px;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
}
.name:hover {
  border-color: var(--line);
}
.name:focus {
  border-color: var(--mint-ink, var(--ink));
  background: var(--paper);
}

/* --- right cluster ---------------------------------------------------------- */
.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tb-btn {
  height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  transition: background-color 120ms ease;
}
.tb-btn:hover {
  background: var(--desk);
}
.tb-btn.framed {
  border: 1px solid var(--line);
  background: var(--paper);
}
.tb-btn.framed:hover {
  background: var(--desk);
}

/* Print CTA: mint fill, ink label — hover deepens a step (mockup value,
 * same treatment as ExportDialog's action CTA). */
.tb-btn.cta {
  gap: 8px;
  padding: 0 16px;
  background: var(--mint);
  color: var(--ink);
  font-weight: 600;
}
.tb-btn.cta:hover {
  background: #96f28a;
}

.divider {
  width: 1px;
  height: 22px;
  flex: none;
  margin: 0 4px;
  background: var(--line);
}

/* --- panel toggles: hidden while their panel is docked (mockup rule) -------- */
.toggle-lib,
.toggle-insp {
  display: none;
}

/* --- <1200: inspector is a bottom sheet; Settings reopens it ----------------- */
@media (max-width: 1199px) {
  .toggle-insp {
    display: inline-flex;
  }
}

/* --- <1080: library is a drawer; Pictures reopens it ------------------------- */
@media (max-width: 1079px) {
  .toggle-lib {
    display: inline-flex;
  }
}

/* --- phone compaction per mockup: labeled buttons condense, name breathes.
 * Print keeps its label on purpose — it is the app's primary action. -------- */
@media (max-width: 720px) {
  .toolbar-row {
    gap: 4px;
    padding: 0 8px;
  }
  .tb-txt {
    display: none;
  }
  .tb-btn {
    padding: 0 10px;
  }
  .name {
    flex: 1 1 0;
    font-size: 14px;
  }
}

/* --- reduced motion: hovers snap instead of easing (Stage 3 table) ----------- */
@media (prefers-reduced-motion: reduce) {
  .icon-btn,
  .tb-btn {
    transition: none;
  }
}
</style>
