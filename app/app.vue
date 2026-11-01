<script setup lang="ts">
/**
 * App root. In SPA mode Nuxt does not move focus between routes, which
 * leaves screen-reader and keyboard users stranded in the old context
 * after navigating (WCAG 2.4.3 Focus Order). On every route change we
 * move focus to the page's <main> landmark — layouts mark it with
 * tabindex="-1" so it can receive programmatic focus without joining
 * the tab order.
 */
const route = useRoute()

watch(
  () => route.path,
  async () => {
    await nextTick()
    const main = document.querySelector('main')
    if (!main) return
    main.setAttribute('tabindex', '-1')
    main.focus({ preventScroll: true })
  },
)
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
