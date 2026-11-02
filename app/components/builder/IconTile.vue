<script setup lang="ts">
/**
 * IconTile — presentational glyph for a picture: ARASAAC pictograms as CDN
 * images, bundle icons through Iconify (offline bundles registered by the
 * catalog store), device uploads as data URLs. No button semantics: parents
 * wrap it in the control that carries the label.
 */
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { pictogramImageUrl } from '~/composables/useArasaac'
import type { IconRef } from '~/types/icons'

const props = defineProps<{
  /** Stored icon reference; `null` when the tile shows an upload or nothing. */
  icon: IconRef | null
  /** Upload data URL (wins over `icon` — the card's current picture). */
  imageUrl?: string
}>()

type GlyphKind = 'upload' | 'arasaac' | 'bundle' | 'none'

const kind = computed<GlyphKind>(() => {
  if (props.imageUrl !== undefined && props.imageUrl !== '') return 'upload'
  if (props.icon === null) return 'none'
  return props.icon.source === 'arasaac' ? 'arasaac' : 'bundle'
})

const arasaacSrc = computed(() =>
  kind.value === 'arasaac' && props.icon !== null ? pictogramImageUrl(props.icon.name, 300) : '',
)

const bundleIcon = computed(() =>
  kind.value === 'bundle' && props.icon !== null ? `${props.icon.set}:${props.icon.name}` : '',
)
</script>

<template>
  <img v-if="kind === 'upload'" class="glyph" :src="imageUrl" alt="" draggable="false">
  <img v-else-if="kind === 'arasaac' && arasaacSrc !== ''" class="glyph" :src="arasaacSrc" alt="" draggable="false" loading="lazy">
  <Icon v-else-if="kind === 'bundle'" class="glyph" :icon="bundleIcon" aria-hidden="true" />
  <span v-else class="glyph none" aria-hidden="true"></span>
</template>

<style scoped>
  .glyph {
    width: 32px;
    height: 32px;
    object-fit: contain;
    color: var(--text);
  }
  .glyph.none { display: block; }
</style>
