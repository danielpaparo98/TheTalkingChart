<script setup lang="ts">
/**
 * Attributes — the complete licence and attribution record, on its own
 * page so the landing stays one honest screen. Calm, typographic, no
 * marketing: what the tool is built from and under which terms.
 *
 * The icon counts come from the generated registry (same source as the
 * landing). ARASAAC pictograms are fetched online and their attribution
 * travels on every printed chart — noted here too.
 */
import { addCollection } from '@iconify/vue'
import type { IconifyJSON } from '@iconify/vue'

useHead({
  title: 'Licences & attribution — The Talking Chart',
  meta: [
    { name: 'description', content: 'Licences and attribution for The Talking Chart: icon sets, fonts, and the app itself.' },
  ],
})

interface IconSetMeta {
  prefix: string
  label: string
  license: string
  attribution: string
  count: number
}
const config = useRuntimeConfig()
const sets = ref<IconSetMeta[]>([])

onMounted(async () => {
  try {
    const data = await $fetch<{ sets: IconSetMeta[] }>(`${config.app.baseURL}icon-data/sets.json`)
    const order = ['openmoji', 'mdi', 'material-symbols', 'tabler']
    sets.value = order
      .map((prefix) => data.sets.find((s) => s.prefix === prefix))
      .filter((s): s is IconSetMeta => Boolean(s))
  } catch {
    sets.value = []
  }
})
</script>

<template>
  <div class="page">
    <main class="wrap">
      <h1>Licences &amp; attribution</h1>
      <p class="intro rise d1">
        Everything The Talking Chart is built from, and the terms it carries.
        Printed charts include their own attribution line for the icon sets
        actually used.
      </p>

      <section class="block rise d2" aria-labelledby="icons-title">
        <h2 id="icons-title">Icon sets</h2>
        <table class="lic-table">
          <thead>
            <tr><th scope="col">Set</th><th scope="col">Icons</th><th scope="col">Licence</th><th scope="col">Availability</th></tr>
          </thead>
          <tbody>
            <tr v-for="set in sets" :key="set.prefix">
              <td>{{ set.label }}</td>
              <td class="num">{{ set.count.toLocaleString() }}</td>
              <td>{{ set.license }}</td>
              <td>bundled · works offline</td>
            </tr>
            <tr>
              <td>ARASAAC</td>
              <td class="num">~13,000</td>
              <td>CC BY-NC-SA 4.0</td>
              <td>online · attribution on the chart</td>
            </tr>
          </tbody>
        </table>
        <p class="note">
          ARASAAC pictograms are fetched from arasaac.org when online; every
          printed chart carries their attribution line automatically.
        </p>
      </section>

      <section class="block" aria-labelledby="type-title">
        <h2 id="type-title">Type</h2>
        <table class="lic-table">
          <thead>
            <tr><th scope="col">Face</th><th scope="col">Used for</th><th scope="col">Licence</th></tr>
          </thead>
          <tbody>
            <tr><td>Work Sans</td><td>interface and charts</td><td>SIL OFL 1.1</td></tr>
            <tr><td>Anton</td><td>landing display</td><td>SIL OFL 1.1</td></tr>
          </tbody>
        </table>
      </section>

      <section class="block" aria-labelledby="code-title">
        <h2 id="code-title">The app</h2>
        <table class="lic-table">
          <thead>
            <tr><th scope="col">Part</th><th scope="col">Detail</th><th scope="col">Licence</th></tr>
          </thead>
          <tbody>
            <tr><td>The Talking Chart</td><td>built by <a href="https://danielpaparo.com" rel="noopener">Daniel Paparo</a></td><td>MIT</td></tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>
</template>
<style scoped>
.page {
  flex: 1 1 auto;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-text);
}
.wrap { width: 100%; max-width: 820px; margin: 0 auto; padding: 0 28px; }
a { color: inherit; }

h1 {
  margin: 40px 0 0;
  font-size: clamp(40px, 5vw, 64px);
  font-weight: 700; letter-spacing: -0.015em;
}
.intro {
  margin: 16px 0 0;
  max-width: 58ch;
  font-size: 16px; line-height: 1.6; color: #3d3d3a;
}

.rise { animation: rise 640ms ease backwards; }
.rise.d1 { animation-delay: 80ms; }
.rise.d2 { animation-delay: 160ms; }
@keyframes rise {
  from { translate: 0 14px; opacity: 0; }
  to { translate: 0 0; opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .rise { animation: none; }
}

.block { margin-top: 56px; }
.block h2 { margin: 0 0 14px; font-size: 20px; font-weight: 700; }

.lic-table { width: 100%; border-collapse: collapse; font-size: 15px; }
.lic-table th {
  text-align: left; padding: 0 14px 10px 0;
  font-size: 13px; font-weight: 600; color: var(--muted);
  border-bottom: 2px solid var(--ink);
}
.lic-table td { padding: 11px 14px 11px 0; vertical-align: baseline; }
.lic-table tbody tr { border-bottom: 1px solid var(--line); }
.lic-table tbody tr:last-child { border-bottom: 2px solid var(--ink); }
.lic-table td:first-child { font-weight: 600; }
.num { font-variant-numeric: tabular-nums; }
.note { margin: 12px 0 0; font-size: 13px; line-height: 1.55; color: var(--muted); }

@media (max-width: 720px) {
  .wrap { padding: 0 20px; }
  h1 { margin-top: 24px; }
  .block { margin-top: 40px; }
  .lic-table th:nth-child(3), .lic-table td:nth-child(3) { padding-right: 6px; }
}
</style>
