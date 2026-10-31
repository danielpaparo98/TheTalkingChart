<script setup lang="ts">
/**
 * SiteHeader — the shared marketing header: the logo tile (→ home),
 * GitHub, and the one primary action. Used by the landing and the
 * attributes page (the builder names the object, not the brand, and
 * keeps its own chrome).
 */
const config = useRuntimeConfig()
const logoSrc = `${config.app.baseURL}logo.svg`
</script>

<template>
  <header class="top wrap">
    <NuxtLink to="/" class="logo-link" aria-label="TheTalkingChart — home">
      <img :src="logoSrc" alt="TheTalkingChart logo" width="34" height="34">
    </NuxtLink>
    <div class="top-right">
      <a class="gh" href="https://github.com/papar/visual-communication-app" rel="noopener">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
        <span>Open source</span>
      </a>
      <NuxtLink class="btn" to="/app">Make your chart</NuxtLink>
    </div>
  </header>
</template>

<style scoped>
<style scoped>
.top { display: flex; align-items: center; justify-content: space-between; padding-block: 24px; }
.wrap { width: 100%; max-width: 900px; margin: 0 auto; padding: 0 28px; }
@media (max-width: 720px) {
  .wrap { padding: 0 20px; }
  .top { padding-block: 20px; }
  .top-right .gh span { display: none; }
}
.logo-link {
  display: inline-flex; align-items: center;
  border-radius: 10px;
  transition: translate 140ms ease;
}
.logo-link:hover { translate: 0 -2px; }
.logo-link img { width: 34px; height: 34px; display: block; }
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

@media (max-width: 720px) {
  .top { padding-block: 20px; }
  .top-right .gh span { display: none; }
}
</style>
