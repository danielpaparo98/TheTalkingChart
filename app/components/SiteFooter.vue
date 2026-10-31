<script setup lang="ts">
/**
 * SiteFooter — the single-line footer: brand (→ home), what it is, terms,
 * the builder's author, and the licence record. Shared by the marketing
 * pages.
 */
</script>

<template>
  <footer class="foot">
    <div class="wrap">
      <p class="foot-line">
        <NuxtLink to="/" class="brand">TheTalkingChart</NuxtLink>
        <span class="d">·</span> AAC picture communication charts
        <span class="d">·</span> Open source under <a href="https://github.com/papar/visual-communication-app" rel="noopener">MIT</a>
        <span class="d">·</span> Built by <a href="https://danielpaparo.com" rel="noopener">Daniel Paparo</a>
        <span class="d">·</span> <NuxtLink to="/attributes">Licences</NuxtLink>
      </p>
    </div>
  </footer>
</template>

<style scoped>
.foot { margin-top: auto; padding: 30px 0 36px; }
.wrap { width: 100%; max-width: 900px; margin: 0 auto; padding: 0 28px; }
.foot-line {
  margin: 0; text-align: center;
  font-size: 16px; line-height: 1.7; color: var(--muted);
  animation: footfade 700ms ease backwards 240ms;
}
@keyframes footfade { from { opacity: 0; } to { opacity: 1; } }
.foot-line .d { padding: 0 0.5em; color: var(--mint-deep); font-weight: 700; }
.foot-line .brand { font-weight: 700; color: var(--ink); text-decoration: none; }
.foot-line a { text-decoration: underline; text-underline-offset: 3px; }
.foot-line a:hover { color: var(--ink); }

@media (prefers-reduced-motion: reduce) {
  .foot-line { animation: none; }
}

@media (max-width: 720px) {
  .wrap { padding: 0 20px; }
}
</style>
