<script setup lang="ts">
/**
 * IconDragGhost — the floating icon that follows the pointer during a
 * palette→sheet drag. Rendered once at page level (fixed position, above
 * every dock); reads the shared drag state from useIconDrag and renders
 * nothing while no drag is engaged.
 *
 * The ghost is a small white card with the glyph — it previews exactly what
 * will land on the card (bundle glyph or ARASAAC pictogram).
 */
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useIconDrag } from '~/composables/useIconDrag'
import { pictogramImageUrl } from '~/composables/useArasaac'

const { dragging } = useIconDrag()

const bundleIcon = computed(() => {
  const state = dragging.value
  if (!state || state.icon.source !== 'bundle') return ''
  return `${state.icon.set}:${state.icon.name}`
})

const pictogramSrc = computed(() => {
  const state = dragging.value
  if (!state || state.icon.source !== 'arasaac') return ''
  return pictogramImageUrl(state.icon.name)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="dragging !== null"
      class="drag-ghost"
      :style="{ translate: `${dragging.x}px ${dragging.y}px` }"
      aria-hidden="true"
    >
      <img v-if="pictogramSrc !== ''" :src="pictogramSrc" alt="" draggable="false">
      <Icon v-else-if="bundleIcon !== ''" :icon="bundleIcon" />
    </div>
  </Teleport>
</template>

<style scoped>
/*
 * Centered on the pointer via translate + the -50% margin trick; pointer
 * events pass through so elementFromPoint keeps hitting the slots.
 */
.drag-ghost {
  position: fixed;
  left: -36px;
  top: -36px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  padding: 10px;
  background: var(--surface);
  border: 2.5px solid var(--orange);
  border-radius: var(--radius-card);
  rotate: -3deg;
  pointer-events: none;
}

.drag-ghost img,
.drag-ghost svg {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
