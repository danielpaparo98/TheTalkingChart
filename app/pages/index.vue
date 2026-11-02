<script setup lang="ts">
/**
 * Landing — "Mint poster", the locked one-screen design. Chrome (header,
 * footer, the full-height paper sheet) comes from the default layout;
 * this page is the hero and the dark band only.
 *
 * A small open-source tool gets a small page: what it is, what it looks
 * like, one button, licences. The hero owns the first viewport — it flexes
 * to fill the space under the header and centres its content, so the
 * headline breathes at every screen height. The only poster moment after
 * the hero is the dark band — the three verbs and a sliding carousel of
 * the product's own pictogram cards (OpenMoji + ARASAAC, the two sets
 * therapists ask for by name).
 *
 * Anton appears exactly twice (wordmark + hero line); everything else is
 * Work Sans. Motion: rise entrances + the carousel; all off under
 * reduced motion. The carousel is decorative motion, so it carries a
 * visible pause control (WCAG 2.2.2 Pause, Stop, Hide).
 */
import { addCollection, Icon } from '@iconify/vue'
import type { IconifyJSON } from '@iconify/vue'

const config = useRuntimeConfig()

interface IconSetMeta {
  prefix: string
  label: string
  license: string
  attribution: string
  count: number
}
const sets = ref<IconSetMeta[]>([])

/** Real set counts for the sources line, from the generated registry. */
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

/** The carousel cards: core vocabulary, drawn from the preview bundle. */
const CARDS: ReadonlyArray<{ icon: string; label: string; tint: string }> = [
  { icon: 'openmoji:rice-cracker', label: 'eat', tint: '' },
  { icon: 'openmoji:potable-water', label: 'drink', tint: 'tint-mint' },
  { icon: 'openmoji:red-question-mark', label: 'help', tint: '' },
  { icon: 'openmoji:house', label: 'home', tint: 'tint-sky' },
  { icon: 'openmoji:grinning-face', label: 'happy', tint: '' },
  { icon: 'openmoji:crying-face', label: 'sad', tint: 'tint-peach' },
  { icon: 'openmoji:dog-face', label: 'dog', tint: '' },
  { icon: 'openmoji:soccer-ball', label: 'play', tint: 'tint-lemon' },
  { icon: 'openmoji:musical-notes', label: 'music', tint: '' },
  { icon: 'openmoji:sun', label: 'outside', tint: 'tint-mint' },
  { icon: 'openmoji:t-shirt', label: 'clothes', tint: '' },
  { icon: 'openmoji:bathtub', label: 'bath', tint: 'tint-sky' },
  { icon: 'openmoji:toilet', label: 'toilet', tint: '' },
  { icon: 'openmoji:automobile', label: 'car', tint: 'tint-orange' },
  { icon: 'openmoji:cherries', label: 'fruit', tint: '' },
  { icon: 'openmoji:pill', label: 'medicine', tint: 'tint-orange' },
  { icon: 'openmoji:flexed-biceps', label: 'strong', tint: '' },
  { icon: 'openmoji:person-in-bed', label: 'sleep', tint: 'tint-mint' },
]

/** ARASAAC raster pictograms (the therapist-standard set), bundled offline. */
const ARASAAC_CARDS = [
  { src: `${config.app.baseURL}pictograms/2558.png`, label: 'cook' },
  { src: `${config.app.baseURL}pictograms/3430.png`, label: 'crossing' },
  { src: `${config.app.baseURL}pictograms/2951.png`, label: 'bricks' },
]

/** The full sliding strip: OpenMoji glyphs + ARASAAC rasters, duplicated for the loop. */
const marqueeCards = [
  ...CARDS.map((c) => ({ kind: 'svg' as const, icon: c.icon, label: c.label, tint: c.tint })),
  ...ARASAAC_CARDS.map((a) => ({ kind: 'img' as const, icon: a.src, label: a.label, tint: '' })),
]

/** Carousel pause state — the marquee must be pausable (WCAG 2.2.2). */
const paused = ref(false)

/** Load the preview bundle so hero + carousel glyphs render offline. */
const heroReady = ref(false)
onMounted(async () => {
  try {
    const data = await $fetch<IconifyJSON>(`${config.app.baseURL}icon-data/preview-openmoji.json`)
    addCollection(data)
    heroReady.value = true
  } catch { /* glyphs stay blank; labels still carry the words */ }
})

useHead({
  title: 'The Talking Chart — free printable picture communication charts',
  meta: [
    {
      name: 'description',
      content:
        'For speech therapists, parents and teachers. Pick from 50,000 open-source icons, place them on a chart, label each card, and print. Free, no sign-up, works offline.',
    },
  ],
})
</script>

<template>
  <!-- ================= HERO (centred) ================= -->
  <section class="hero wrap">
    <h1 class="rise">Print them<br>a <span class="hl">voice.</span></h1>
    <p class="sub rise d1">
      For speech therapists, parents and teachers. Pick from 50,000
      open-source icons, place them on the grid, label each card, and
      print — the sheet you see is the sheet that prints.
    </p>
    <div class="cta-row rise d2">
      <NuxtLink class="btn mint" to="/app">Make your chart</NuxtLink>
      <span class="fact">No sign-up · No cost · Works offline</span>
    </div>
  </section>

  <!-- ================= DARK BANNER: VERBS + ICON CAROUSEL ================= -->
  <section class="band fade" aria-label="How it works">
    <p class="verbs rise d3">
      <b>Pick</b> a picture<span class="d">·</span><b>place</b> it on the
      grid<span class="d">·</span><b>print</b> it.
    </p>

    <div class="marquee">
      <div
        class="m-track"
        :style="{ animationPlayState: paused ? 'paused' : 'running' }"
      >
        <template v-for="set in 2" :key="set">
          <div
            v-for="card in marqueeCards"
            :key="`${set}-${card.label}`"
            class="m-card"
            :class="card.tint"
          >
            <img
              v-if="card.kind === 'img'"
              class="om"
              :src="card.icon"
              alt=""
              draggable="false"
            >
            <Icon v-else class="om" :icon="card.icon" aria-hidden="true" />
            <span>{{ card.label }}</span>
          </div>
        </template>
      </div>
    </div>

    <p class="m-controls">
      <button
        type="button"
        class="m-pause"
        :aria-label="paused ? 'Play animation' : 'Pause animation'"
        @click="paused = !paused"
      >
        <Icon :icon="paused ? 'mdi:play' : 'mdi:pause'" aria-hidden="true" />
      </button>
    </p>
  </section>
</template>

<style scoped>
.wrap { width: 100%; max-width: 900px; margin: 0 auto; padding: 0 28px; }
a { color: inherit; }

/* entrances */
.rise { animation: rise 640ms ease backwards; }
.rise.d1 { animation-delay: 80ms; }
.rise.d2 { animation-delay: 160ms; }
.rise.d3 { animation-delay: 240ms; }
.fade { animation: fadein 700ms ease backwards; }
@keyframes rise {
  from { translate: 0 14px; opacity: 0; }
  to { translate: 0 0; opacity: 1; }
}
@keyframes fadein { from { opacity: 0; } to { opacity: 1; } }

.btn {
  display: inline-flex; align-items: center;
  background: var(--ink); color: #fff;
  text-decoration: none; border: none; cursor: pointer;
  font-size: 14px; font-weight: 600;
  padding: 10px 18px; border-radius: 8px;
  transition: opacity 140ms ease;
}
.btn:hover { opacity: 0.85; }
.btn.mint { background: var(--mint); color: var(--ink); font-size: 15px; padding: 14px 26px; }
.btn.mint:hover { opacity: 1; background: #96f28a; }

/* ---------------- hero (centred, owns the first viewport) ---------------- */
.hero {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  padding-block: 48px 96px;
}
.hero h1 {
  margin: 0 auto;
  max-width: 14ch;
  font-family: var(--font-display);
  font-weight: 400; text-transform: uppercase;
  font-size: clamp(52px, 8.4vw, 120px);
  line-height: 0.94;
}
.hero h1 .hl {
  display: inline-block;
  line-height: 1;
  background: var(--mint);
  border-radius: 0.06em;
  /* hug the glyphs: padding inside, matching negative margin outside —
     the block never bleeds into the neighbouring line */
  padding: 0.08em 0.14em 0.1em;
  margin: -0.04em -0.12em;
}
.sub {
  margin: 32px auto 0;
  max-width: 52ch;
  font-size: 19px;
  line-height: 1.6;
  color: #1a1a1a;
}
.cta-row { display: flex; align-items: center; justify-content: center; gap: 24px; margin-top: 40px; }
.fact { font-size: 16px; color: var(--muted); }

/* ---------------- dark banner: verbs + carousel ---------------- */
.band { background: var(--ink); color: #fff; padding: 64px 0 68px; overflow: hidden; }
.verbs {
  margin: 0 auto; text-align: center;
  font-size: clamp(19px, 2.4vw, 24px);
  font-weight: 500; line-height: 1.5;
  padding: 0 28px;
}
.verbs .d { color: var(--mint); font-weight: 700; padding: 0 0.45em; }
.verbs b { font-weight: 700; }

.marquee {
  margin-top: 44px;
  overflow: hidden;
  animation: rise 640ms ease backwards 240ms;
  /* soft edges: painted via mask (not a gradient fill — taste-skill-ignore) */
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); /* taste-skill-ignore */
          mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); /* taste-skill-ignore */
}
.m-track {
  display: flex; gap: 18px; width: max-content; padding: 6px 0 10px;
  animation: slide 44s linear infinite;
  will-change: transform;
}
@keyframes slide { to { transform: translateX(-50%); } }
.m-controls { margin: 18px 0 0; text-align: center; }
.m-pause {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  background: none; border: none; cursor: pointer;
  color: #fff;
  padding: 0; opacity: 0.8;
  border-radius: 999px;
  transition: opacity 120ms ease;
}
.m-pause svg { width: 20px; height: 20px; }
.m-pause:hover, .m-pause:focus-visible { opacity: 1; }
.m-pause:focus-visible { outline: 2px solid var(--mint); outline-offset: 2px; }
.m-card {
  flex: none; width: 124px;
  background: var(--paper); color: var(--ink);
  border-radius: 14px;
  padding: 16px 8px 12px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  transition: translate 160ms ease;
}
.m-card:hover { translate: 0 -6px; }
.m-card .om { width: 48px; height: 48px; }
.m-card span { font-size: 13px; font-weight: 600; }
.m-card.tint-mint { background: var(--mint); }
.m-card.tint-lemon { background: #fff3d6; }
.m-card.tint-sky { background: #e4f2fd; }
.m-card.tint-peach { background: #ffe3d6; }
.m-card.tint-orange { background: #ffd8c2; }

@media (prefers-reduced-motion: reduce) {
  .m-track { animation: none; }
  .marquee { animation: none; }
  .rise, .fade { animation: none; }
}

@media (max-width: 720px) {
  .wrap { padding: 0 20px; }
  .hero { padding-block: 32px 64px; }
  .hero h1 { font-size: clamp(44px, 12vw, 84px); }
  .sub { font-size: 16px; }
  .cta-row { flex-direction: column; gap: 16px; }
  .band { padding: 56px 0 60px; }
  .m-card { width: 104px; }
  .m-card .om { width: 40px; height: 40px; }
}
</style>
