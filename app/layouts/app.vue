<script setup lang="ts">
/**
 * App layout — the builder fills the viewport with its own chrome
 * (top bar, desk, drawer). No marketing header or footer.
 */
</script>

<template>
  <div class="app-shell">
    <slot />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--ground);
  color: var(--text);
  font-family: var(--font-text);
}
</style>
