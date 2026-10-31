<script setup lang="ts">
/**
 * Default layout — the marketing shell. Shared header (brand → home,
 * GitHub, Make your chart) and the single-line footer (brand, terms,
 * licences) so every marketing page stays consistent. The builder uses
 * its own layout.
 */
</script>

<template>
  <div class="shell">
    <header class="top wrap">
      <NuxtLink to="/" class="wordmark">TheTalkingChart</NuxtLink>
      <div class="top-right">
        <a class="gh" href="https://github.com/papar/visual-communication-app" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
          <span>Open source</span>
        </a>
        <NuxtLink class="btn" to="/app">Make your chart</NuxtLink>
      </div>
    </header>

    <slot />

    <footer class="foot">
      <div class="wrap">
        <p class="foot-line fade">
          <NuxtLink to="/" class="brand">TheTalkingChart</NuxtLink>
          <span class="d">·</span> AAC picture communication charts
          <span class="d">·</span> Open source under <a href="https://github.com/papar/visual-communication-app" rel="noopener">MIT</a>
          <span class="d">·</span> Built by <a href="https://danielpaparo.com" rel="noopener">Daniel Paparo</a>
          <span class="d">·</span> <NuxtLink to="/attributes">Licences</NuxtLink>
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-text);
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}
.wrap { width: 100%; max-width: 900px; margin: 0 auto; padding: 0 28px; }
a { color: inherit; }

/* header */
.top { display: flex; align-items: center; justify-content: space-between; padding-block: 24px; }
.wordmark {
  font-family: var(--font-display);
  font-weight: 400; text-transform: uppercase;
  font-size: 21px; letter-spacing: 0.02em;
  text-decoration: none;
}
.top-right { display: flex; align-items: center; gap: 22px; }
.gh {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 16px; font-weight: 500; text-decoration: none; color: var(--muted);
}
.gh:hover { color: var(--ink); }
.btn {
  display: inline-flex; align-items: center;
  background: var(--ink); color: #fff;
  text-decoration: none;
  font-size: 14px; font-weight: 600;
  padding: 10px 18px; border-radius: 8px;
  transition: opacity 140ms ease;
}
.btn:hover { opacity: 0.85; }

/* footer: one scannable line of dot-separated items */
.foot { margin-top: auto; padding: 30px 0 36px; }
.foot-line {
  margin: 0; text-align: center;
  font-size: 16px; line-height: 1.7; color: var(--muted);
  animation: footfade 700ms ease backwards 240ms;
}
@keyframes footfade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .foot-line { animation: none; }
}
.foot-line .d { padding: 0 0.5em; color: var(--mint-deep); font-weight: 700; }
.foot-line .brand { font-weight: 700; color: var(--ink); text-decoration: none; }
.foot-line a { text-decoration: underline; text-underline-offset: 3px; }
.foot-line a:hover { color: var(--ink); }

@media (max-width: 720px) {
  .wrap { padding: 0 20px; }
  .top { padding-block: 20px; }
  .top-right .gh span { display: none; }
  .foot-line { font-size: 15px; }
}
</style>
