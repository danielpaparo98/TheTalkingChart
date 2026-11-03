<script setup lang="ts">
/**
 * LibraryTile — one picture tile of the builder library; the results grid
 * and the recents strip (compact variant) share it.
 *
 * Behaviour:
 *  - Draggable: starts an HTML5 drag carrying a LibraryDragPayload under
 *    LIBRARY_DRAG_MIME (see app/composables/useLibraryDrag.ts — GridCell
 *    drop targets read it with hasLibraryDragData/readLibraryDragData).
 *  - Clickable / keyboard-activatable (button: Enter and Space fire click
 *    natively); the panel decides where the pick lands.
 *  - Glyph source follows the IconRef: bundle refs render via <Icon>
 *    (offline Iconify bundles registered by the catalog store), ARASAAC
 *    refs render their static CDN PNG.
 *
 * Poster Desk tokens: paper tile, 8px radius, mint hover — mint is
 * interactive-only. Motion 100ms background-color, killed under
 * prefers-reduced-motion.
 */
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { beginLibraryDrag } from '~/composables/useLibraryDrag'
import { pictogramImageUrl } from '~/composables/useArasaac'
import { libraryTileAriaLabel } from '~/composables/useLibrarySearch'
import type { IconRef } from '~/types/icons'

const props = defineProps<{
  /** Fully-qualified icon reference — also the drag payload's `icon`. */
  icon: IconRef
  /** Readable caption ("dog face") — drag label, tooltip, and caption text. */
  label: string
  /** Recents-strip variant: 36px square, no caption. */
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'activate', icon: IconRef): void
}>()

const isArasaac = computed(() => props.icon.source === 'arasaac')
const iconifyName = computed(() =>
  props.icon.source === 'bundle' ? `${props.icon.set}:${props.icon.name}` : '',
)
const imageUrl = computed(() => (isArasaac.value ? pictogramImageUrl(props.icon.name, 300) : ''))
const ariaLabel = computed(() => libraryTileAriaLabel(props.label))

function onDragStart(event: DragEvent): void {
  beginLibraryDrag(event, { icon: props.icon, label: props.label })
}
</script>

<template>
  <button
    type="button"
    class="tile"
    :class="{ 'tile-compact': compact }"
    draggable="true"
    :aria-label="ariaLabel"
    :title="label"
    @dragstart="onDragStart"
    @click="emit('activate', icon)"
  >
    <img
      v-if="isArasaac"
      :src="imageUrl"
      alt=""
      loading="lazy"
      draggable="false"
      class="glyph"
    >
    <Icon
      v-else
      :icon="iconifyName"
      class="glyph"
      aria-hidden="true"
    />
    <span v-if="!compact" class="t-lab">{{ label }}</span>
  </button>
</template>

<style scoped>
/*
 * Tile: paper ground, hairline ring, 8px radius; hover paints mint and
 * drops the ring (mint = interactivity, never decoration). cursor: grab
 * cues the drag; buttons stay keyboard-activatable regardless.
 */
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 9px 4px 7px;
  font: inherit;
  color: var(--text);
  background: var(--paper);
  border: none;
  border-radius: var(--r-ctl, 8px);
  box-shadow: inset 0 0 0 1px var(--line);
  cursor: grab;
  user-select: none;
  transition: background-color 100ms ease, box-shadow 100ms ease;
}

.tile:hover {
  background: var(--mint);
  box-shadow: none;
}

.tile:active {
  cursor: grabbing;
}

.tile:focus-visible {
  outline: 2px solid var(--mint-ink, var(--ink));
  outline-offset: 2px;
}

.glyph {
  width: 21px;
  height: 21px;
  flex: none;
  object-fit: contain;
}

.t-lab {
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.15;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Recents variant: small square, glyph only (the tooltip keeps the label). */
.tile-compact {
  flex-direction: row;
  justify-content: center;
  gap: 0;
  width: 36px;
  min-width: 36px;
  height: 36px;
  padding: 0;
}

@media (prefers-reduced-motion: reduce) {
  .tile {
    transition: none;
  }
}
</style>
