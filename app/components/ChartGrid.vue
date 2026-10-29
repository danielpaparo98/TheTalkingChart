<script setup lang="ts">
/**
 * The chart canvas — a dense, borderless CSS grid of SlotCards laid out
 * from the active preset (contract line 70). The grid fills its container
 * (the sheet's printable area); rows and cards stretch so the sheet keeps
 * the A4 aspect authority (context lines 39-40). No borders or elevations of
 * its own — the frame belongs to the sheet.
 */
import { computed } from 'vue'
import { useChartStore } from '~/stores/chart'
import SlotCard from '~/components/SlotCard.vue'

const props = defineProps<{
  /** Grid columns — trusted; the caller reads the same store values. */
  columns: number
  /** Grid rows. */
  rows: number
}>()

const chartStore = useChartStore()

const slots = computed(() => chartStore.doc.slots)

/** Cols × rows honoured exactly; 1fr tracks stretch to the container. */
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
  gridTemplateRows: `repeat(${props.rows}, 1fr)`,
}))
</script>

<template>
  <div class="chart-grid" :style="gridStyle">
    <SlotCard v-for="s in slots" :key="s.id" :data="s" />
  </div>
</template>

<style scoped>
/* Dense PECs pitch: hairline gaps keep cards dominant on the sheet. */
.chart-grid {
  display: grid;
  gap: 5px;
  width: 100%;
  height: 100%;
}
</style>
