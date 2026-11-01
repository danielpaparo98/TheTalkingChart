<script setup lang="ts">
/**
 * SiteFooter — the single-line footer: brand (→ home), what it is, terms,
 * the builder's author, the licence record, the accessibility statement,
 * and the GitHub icon (→ repo). Shared by the marketing pages.
 */
const ghIcon
  = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z'
</script>

<template>
  <footer class="foot">
    <div class="wrap">
      <p class="foot-line">
        <NuxtLink to="/" class="brand">TheTalkingChart</NuxtLink>
        <span class="d">·</span> AAC picture communication charts
        <span class="d">·</span> <a href="https://github.com/danielpaparo98/TheTalkingChart" rel="noopener" aria-label="View source on GitHub (MIT licence)">MIT</a>
        <span class="d">·</span> Built by <a href="https://danielpaparo.com" rel="noopener">Daniel Paparo</a>
        <span class="d">·</span> <NuxtLink to="/attributes">Licences</NuxtLink>
        <span class="d">·</span> <NuxtLink to="/accessibility">Accessibility</NuxtLink>
        <span class="d">·</span>
        <a
          class="gh"
          href="https://github.com/danielpaparo98/TheTalkingChart"
          rel="noopener"
          aria-label="TheTalkingChart on GitHub"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path :d="ghIcon" /></svg>
        </a>
      </p>
    </div>
  </footer>
</template>

<style scoped>
.foot { margin-top: auto; padding: 30px 0 36px; }
.wrap { width: 100%; max-width: 900px; margin: 0 auto; padding: 0 28px; }
@media (max-width: 720px) {
  .wrap { padding: 0 20px; }
}
.foot-line {
  margin: 0; text-align: center;
  font-size: 16px; line-height: 1.7; color: var(--muted);
}
.foot-line .d { padding: 0 0.5em; color: var(--mint-deep); font-weight: 700; }
.foot-line .brand { font-weight: 700; color: var(--ink); text-decoration: none; }
.foot-line a { text-decoration: underline; text-underline-offset: 3px; }
.foot-line a:hover { color: var(--ink); }
.gh {
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--muted); vertical-align: -3px; margin-left: 0.25em;
  /* 4px padding lifts the hit area to ~26px (WCAG 2.5.8 target size) */
  padding: 4px;
  transition: color 120ms ease;
}
.gh:hover { color: var(--ink); }
</style>
