<script setup lang="ts">
/**
 * default layout — the marketing chrome: site header, page, site footer,
 * on one full-height paper sheet (the landing's one-screen composition).
 * Pages render inside the flex column; the footer pins to the bottom via
 * its own margin-top:auto, and tall pages simply grow the sheet.
 *
 * The builder opts out via the `app` layout (app/layouts/app.vue).
 */
</script>

<template>
  <div class="marketing">
    <SiteHeader />
    <slot />
    <SiteFooter />
  </div>
</template>

<style scoped>
.marketing {
  min-height: 100dvh;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-text);
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}
</style>
