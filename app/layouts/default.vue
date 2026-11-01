<script setup lang="ts">
/**
 * default layout — the marketing chrome: skip link, site header, page,
 * site footer, on one full-height paper sheet (the landing's one-screen
 * composition). Pages render inside the flex column; the footer pins to
 * the bottom via its own margin-top:auto, and tall pages simply grow
 * the sheet.
 *
 * The <main> landmark and skip link cover WCAG 1.3.1 / 2.4.1 (bypass
 * blocks); app.vue focuses <main> on route changes. Pages therefore
 * render their content as plain containers — not their own <main>.
 *
 * The builder opts out via the `app` layout (app/layouts/app.vue).
 */
</script>

<template>
  <div class="marketing">
    <a href="#main" class="skip-link">Skip to content</a>
    <SiteHeader />
    <main id="main" tabindex="-1">
      <slot />
    </main>
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
main {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
}
main:focus {
  outline: none;
}
.skip-link {
  position: absolute;
  left: -9999px;
  top: 12px;
  z-index: 100;
  padding: 8px 14px;
  background: var(--paper);
  color: var(--ink);
  border: 2px solid var(--ink);
  font-weight: 600;
  text-decoration: none;
}
.skip-link:focus {
  left: 16px;
}
</style>
