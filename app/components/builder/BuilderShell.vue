<script setup lang="ts">
/**
 * BuilderShell — the responsive three-region layout of the v2 builder.
 *
 * The shell owns chrome only: a 52px toolbar band, a 300px library dock,
 * a dark-band canvas and a 280px inspector dock. Everything inside the
 * regions is slot content assembled by the page (subtask 15) — this file
 * deliberately imports no other builder component.
 *
 * Contract:
 * - Slots: `toolbar` · `library` · `canvas` · `inspector`.
 * - Props: `libraryOpen` / `inspectorOpen` control the overlay states below
 *   their dock breakpoints; they are ignored while docked (docks stay open).
 * - Emits: `update:libraryOpen` / `update:inspectorOpen` plus `libraryClosed`
 *   / `inspectorClosed` so the page can restore focus to the trigger (the
 *   v1 focus-return pattern, app/pages/app/index.vue). Escape is NOT handled
 *   here — the page owns the global Escape unwind; the shell handles scrim
 *   taps and its own close buttons.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  /** Library visibility below 1080px (left drawer); ignored while docked. */
  libraryOpen: boolean
  /** Inspector visibility below 1200px (bottom sheet); ignored while docked. */
  inspectorOpen: boolean
}>()

const emit = defineEmits<{
  'update:libraryOpen': [value: boolean]
  'update:inspectorOpen': [value: boolean]
  libraryClosed: []
  inspectorClosed: []
}>()

/* Breakpoints mirror the approved mockup (dock ≥1080 / ≥1200). CSS media
 * queries own the visuals; these mirrors only gate focus and scrim logic. */
const LIBRARY_DOCK_QUERY = '(min-width: 1080px)'
const INSPECTOR_DOCK_QUERY = '(min-width: 1200px)'

const libraryDocked = ref(
  typeof window !== 'undefined' ? window.matchMedia(LIBRARY_DOCK_QUERY).matches : true,
)
const inspectorDocked = ref(
  typeof window !== 'undefined' ? window.matchMedia(INSPECTOR_DOCK_QUERY).matches : true,
)
let libraryQuery: MediaQueryList | null = null
let inspectorQuery: MediaQueryList | null = null

function syncMedia(): void {
  if (libraryQuery !== null) libraryDocked.value = libraryQuery.matches
  if (inspectorQuery !== null) inspectorDocked.value = inspectorQuery.matches
}

onMounted(() => {
  libraryQuery = window.matchMedia(LIBRARY_DOCK_QUERY)
  inspectorQuery = window.matchMedia(INSPECTOR_DOCK_QUERY)
  syncMedia()
  libraryQuery.addEventListener('change', syncMedia)
  inspectorQuery.addEventListener('change', syncMedia)
})

onUnmounted(() => {
  libraryQuery?.removeEventListener('change', syncMedia)
  inspectorQuery?.removeEventListener('change', syncMedia)
})

const libraryEl = ref<HTMLElement | null>(null)
const inspectorEl = ref<HTMLElement | null>(null)

/** The scrim covers the workspace while a drawer or sheet is showing. */
const scrimVisible = computed(
  () =>
    (!libraryDocked.value && props.libraryOpen) ||
    (!inspectorDocked.value && props.inspectorOpen),
)

/* Opening an overlay moves focus into the region so keyboard and screen
 * reader users land inside the dialog; the page restores the trigger on
 * close via the *Closed events. */
watch(
  () => props.libraryOpen,
  (open) => {
    if (!open || libraryDocked.value) return
    void nextTick(() => libraryEl.value?.focus())
  },
)
watch(
  () => props.inspectorOpen,
  (open) => {
    if (!open || inspectorDocked.value) return
    void nextTick(() => inspectorEl.value?.focus())
  },
)

function closeLibrary(): void {
  if (!props.libraryOpen) return
  emit('update:libraryOpen', false)
  emit('libraryClosed')
}

function closeInspector(): void {
  if (!props.inspectorOpen) return
  emit('update:inspectorOpen', false)
  emit('inspectorClosed')
}

/** Mockup behaviour: a scrim tap dismisses whichever overlay is showing. */
function onScrimClick(): void {
  closeLibrary()
  closeInspector()
}
</script>

<template>
  <div class="shell">
    <header class="toolbar">
      <slot name="toolbar" />
    </header>

    <div class="workspace">
      <aside
        ref="libraryEl"
        class="library"
        :class="{ 'is-open': libraryOpen }"
        :role="libraryDocked ? undefined : 'dialog'"
        :aria-modal="libraryDocked ? undefined : 'true'"
        aria-label="Picture library"
        :inert="!libraryDocked && !libraryOpen"
        tabindex="-1"
      >
        <div class="drawer-bar">
          <span class="drawer-grip" aria-hidden="true"></span>
          <button
            type="button"
            class="panel-close"
            aria-label="Close picture library"
            @click="closeLibrary"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <slot name="library" />
      </aside>

      <main class="canvas" aria-label="Chart canvas">
        <slot name="canvas" />
      </main>

      <aside
        ref="inspectorEl"
        class="inspector"
        :class="{ 'is-open': inspectorOpen }"
        aria-label="Inspector"
        :inert="!inspectorDocked && !inspectorOpen"
        tabindex="-1"
      >
        <div class="drawer-bar">
          <span class="drawer-grip" aria-hidden="true"></span>
          <button
            type="button"
            class="panel-close"
            aria-label="Close inspector"
            @click="closeInspector"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <slot name="inspector" />
      </aside>
    </div>

    <div v-show="scrimVisible" class="scrim" aria-hidden="true" @click="onScrimClick" />
  </div>
</template>

<style scoped>
/* Design tokens (band/paper/ink/text/muted/desk/mint/line) come from the
 * global main.css — never defined locally. Radii: controls 8 · sheet 14. */

.shell {
  height: 100dvh;
  display: flex;
  flex-direction: column;
}

/* --- toolbar band (52px, paper, bottom hairline) ------------------------- */
.toolbar {
  flex: none;
  height: 52px;
  display: flex;
  align-items: center;
  background: var(--paper);
  border-bottom: 1px solid var(--line);
  /* Above the scrim (z 30) and the overlays (z 40): panel toggles stay reachable. */
  position: relative;
  z-index: 50;
}

/* --- workspace row -------------------------------------------------------- */
.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 280px;
}

.library {
  background: var(--desk);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.canvas {
  position: relative;
  overflow: hidden;
  min-width: 0;
  background: var(--band); /* the dark band is the canvas surround ONLY */
}

.inspector {
  background: var(--paper);
  border-left: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* Regions take programmatic focus only (SR context, WCAG 2.4.3); the ring
 * stays on real controls such as the close buttons below. */
.library:focus,
.inspector:focus {
  outline: none;
}

/* --- overlay chrome: slim bar with drag grip + close button --------------- */
/* Docked panels have no bar — slot content owns the full region. */
.drawer-bar {
  display: none;
}

.drawer-grip {
  position: absolute;
  top: 8px;
  left: 50%;
  translate: -50% 0;
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--line);
}

.panel-close {
  width: 32px;
  height: 32px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--muted);
  transition: background-color 120ms ease, color 120ms ease;
}

.panel-close:hover {
  background: var(--desk);
  color: var(--text);
}

.panel-close:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}

/* --- scrim (band colour at 35% — the mockup's overlay ground) -------------- */
.scrim {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(14, 18, 13, 0.35);
}

/* --- <1200: inspector becomes a bottom sheet ------------------------------ */
@media (max-width: 1199px) {
  .workspace {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .inspector {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    max-height: 62dvh;
    border-left: none;
    border-top: 1px solid var(--line);
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -18px 48px rgba(14, 18, 13, 0.28);
    translate: 0 105%;
    transition: translate 220ms ease;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .inspector.is-open {
    translate: 0 0;
  }

  .inspector .drawer-bar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: none;
    height: 40px;
    padding: 0 6px;
    background: var(--paper);
    border-bottom: 1px solid var(--line);
  }
}

/* --- <1080: library becomes a left drawer --------------------------------- */
@media (max-width: 1079px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .library {
    position: fixed;
    top: 52px;
    bottom: 0;
    left: 0;
    z-index: 40;
    width: min(320px, 86vw);
    border-right: 1px solid var(--line);
    box-shadow: 18px 0 48px rgba(14, 18, 13, 0.28);
    translate: -103% 0;
    transition: translate 200ms ease;
  }

  .library.is-open {
    translate: 0 0;
  }

  .library .drawer-bar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: none;
    height: 40px;
    padding: 0 6px;
    background: var(--paper);
    border-bottom: 1px solid var(--line);
  }
}

/* --- motion safety: overlays and close buttons go static ------------------- */
@media (prefers-reduced-motion: reduce) {
  .library,
  .inspector,
  .panel-close {
    transition: none;
  }
}
</style>
