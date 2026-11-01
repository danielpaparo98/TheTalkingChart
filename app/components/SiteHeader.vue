<script setup lang="ts">
/**
 * SiteHeader — the shared marketing header: the logo tile (→ home) and
 * the one primary action. Used by the landing and the attributes page
 * (the builder names the object, not the brand, and keeps its own chrome).
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
      <NuxtLink class="btn" to="/app">Make your chart</NuxtLink>
    </div>
  </header>
</template>

<style scoped>
/* header.top: element+class specificity so the landing's `.wrap` padding
   shorthand (same element, later in the cascade) can't zero the vertical
   rhythm — this was the cramped top-of-page bug. */
header.top { display: flex; align-items: center; justify-content: space-between; padding-block: 40px; }
.wrap { width: 100%; max-width: 900px; margin: 0 auto; padding: 0 28px; }
@media (max-width: 720px) {
  .wrap { padding: 0 20px; }
  header.top { padding-block: 24px; }
}
.logo-link {
  display: inline-flex; align-items: center;
  border-radius: 10px;
  transition: translate 140ms ease;
}
.logo-link:hover { translate: 0 -2px; }
.logo-link img { width: 34px; height: 34px; display: block; }
.top-right { display: flex; align-items: center; gap: 22px; }
.btn {
  display: inline-flex; align-items: center;
  background: var(--ink); color: #fff;
  text-decoration: none;
  font-size: 14px; font-weight: 600;
  padding: 10px 18px; border-radius: 8px;
  transition: opacity 140ms ease;
}
.btn:hover { opacity: 0.85; }
</style>
