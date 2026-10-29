<script setup lang="ts">
/**
 * Landing page " "The page is the object" (direction seed 692021347).
 *
 * The idea: the printed PECS chart this tool produces becomes the page itself.
 * The hero IS a real, filled talking chart (paper panel on ink ground, A4
 * proportions, real pictograms, compact attribution riding on it " the same
 * line the app prints). Sections are further pieces of the same stationery:
 * a receipt slip (how it works), an index-with-preview of the icon sources,
 * the builder fragment (data-ui), a people/audience spread, and the footer
 * as the back of the object.
 */
import { addCollection, Icon } from '@iconify/vue'
import type { IconifyJSON } from '@iconify/vue'

// Real icon counts, straight from the generated registry (single small fetch).
interface IconSetMeta {
  prefix: string
  label: string
  license: string
  attribution: string
  count: number
}
const config = useRuntimeConfig()
const sets = ref<IconSetMeta[]>([])

/** Preview icon names per set, for the index-with-preview frame. */
const PREVIEW_NAMES: Record<string, string[]> = {
  openmoji: [
    'house', 'rice-cracker', 'potable-water', 'grinning-face', 'crying-face', 'dog-face',
    'soccer-ball', 'musical-notes', 'sun', 't-shirt', 'bathtub', 'pill',
  ],
  mdi: [
    'home', 'food', 'cup-water', 'help-circle-outline', 'emoticon-happy-outline',
    'emoticon-sad-outline', 'bed', 'bath', 'car', 'music', 'pill', 'fruit-cherries',
  ],
  'material-symbols': [
    'home', 'restaurant', 'water-drop', 'favorite', 'help', 'sentiment-satisfied',
    'bed', 'checkroom', 'directions-car', 'music-note', 'medication', 'pets',
  ],
  tabler: [
    'home', 'salad', 'droplet', 'heart', 'help', 'mood-smile', 'mood-sad', 'bed',
    'bath', 'car', 'music', 'pill',
  ],
}
const PREVIEW_LABELS: Record<string, string> = {
  openmoji: 'OpenMoji',
  mdi: 'Material Design Icons',
  'material-symbols': 'Material Symbols',
  tabler: 'Tabler Icons',
}

function previewNames(prefix: string): string[] {
  return PREVIEW_NAMES[prefix] ?? []
}

const activePreviewLabel = computed(() => PREVIEW_LABELS[activePreview.value] ?? activePreview.value)
const activePreviewCount = computed(() => {
  const set = sets.value.find((s) => s.prefix === activePreview.value)
  return set ? `${set.count.toLocaleString()} icons` : ''
})

const arasaacNote = 'online - ~13,000 pictograms'

onMounted(async () => {
  try {
    const data = await $fetch<{ sets: IconSetMeta[] }>(`${config.app.baseURL}icon-data/sets.json`)
    // Presentation order for the index: friendliest pictograms first.
    const order = ['openmoji', 'mdi', 'material-symbols', 'tabler']
    sets.value = order
      .map((prefix) => data.sets.find((s) => s.prefix === prefix))
      .filter((s): s is IconSetMeta => Boolean(s))
  } catch {
    sets.value = []
  }

  // Entrances: transform-only rise — content is never hidden (no-JS safe),
  // so measurement/scrapers always see the full page.
  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-rise]'))
  targets.forEach((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.92) {
      el.classList.add('rise-in')
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('rise-in')
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(el)
  })
})

// --- Index with preview (the signature move) -------------------------------

const PREVIEW_ORDER = ['openmoji', 'mdi', 'material-symbols', 'tabler'] as const
const activePreview = ref<string>('openmoji')
const loadedPreviews = new Set<string>()
const previewLoaded = ref<Record<string, boolean>>({})

async function loadPreview(prefix: string): Promise<void> {
  if (loadedPreviews.has(prefix)) return
  loadedPreviews.add(prefix)
  try {
    const data = await $fetch<IconifyJSON>(`${config.app.baseURL}icon-data/preview-${prefix}.json`)
    addCollection(data)
    previewLoaded.value[prefix] = true
  } catch {
    loadedPreviews.delete(prefix)
  }
}

function activatePreview(prefix: string): void {
  activePreview.value = prefix
  void loadPreview(prefix)
}

onMounted(() => {
  void loadPreview('openmoji')
})

/** Hero chart cards " real pictograms, PECS core vocabulary. */
const heroCards = [
  { icon: 'openmoji:potable-water', label: 'drink' },
  { icon: 'openmoji:rice-cracker', label: 'eat' },
  { icon: 'openmoji:red-question-mark', label: 'help' },
  { icon: 'openmoji:house', label: 'home' },
  { icon: 'openmoji:soccer-ball', label: 'play' },
  { icon: 'openmoji:grinning-face', label: 'happy' },
  { icon: 'openmoji:dog-face', label: 'dog' },
  { icon: 'openmoji:musical-notes', label: 'music' },
]

/** Hero pictograms ride on the preview bundle (all requested names exist). */
let heroReady = false
onMounted(async () => {
  if (heroReady) return
  heroReady = true
  try {
    const data = await $fetch<IconifyJSON>(`${config.app.baseURL}icon-data/preview-openmoji.json`)
    addCollection(data)
  } catch { /* hero pictograms simply stay blank if the fetch fails */ }
})

useHead({
  title: 'The Talking Chart " Free printable PECS communication charts',
  meta: [
    {
      name: 'description',
      content:
        'Pick from 50,000 open-source icons, place them on a chart, label each card, and print. Free, no sign-up, works offline. Built for speech therapists, parents and teachers.',
    },
  ],
})
</script>

<template>
  <div class="landing">
    <!-- ============================== HERO ============================== -->
    <!-- The printed chart IS the first screen: ink ground, paper artefact. -->
    <section class="hero" aria-labelledby="hero-title">
      

      <h1 id="hero-title" class="hero-title">TALKING<br >CHART</h1>
      <p class="hero-sub">
        Free, printable communication charts.
        Pick from 50,000 open-source icons, label each card, and print -
        no sign-up, no cost.
      </p>

      <!-- The artefact: a real, filled chart at true A4 landscape proportions. -->
      <div class="hero-sheet-stage">
        <div class="hero-sheet" data-rise>
          <div class="hero-chart-head">
            <p class="hero-chart-title">Mia's chart</p>
            <NuxtLink to="/app" class="btn-primary hero-cta">Make your chart</NuxtLink>
          </div>
          <div class="hero-grid">
            <div v-for="card in heroCards" :key="card.label" class="hero-card">
              <Icon :icon="card.icon" class="hero-card-icon" aria-hidden="true" />
              <span class="hero-card-label">{{ card.label }}</span>
            </div>
          </div>
          <p class="hero-chart-attribution">Icons: OpenMoji (CC BY-SA 4.0)</p>
        </div>
      </div>
    </section>

    <!-- ========================= HOW IT WORKS =========================== -->
    <!-- The process printed as a receipt slip: dot leaders, zigzag cut. -->
    <section class="how" aria-labelledby="how-title">
      <div class="how-copy">
        <h2 data-rise id="how-title" class="section-title">How it works</h2>
        <p data-rise class="section-body">
          Three steps, on one screen. Everything runs in your browser "
          the icon library works offline, and nothing leaves your device.
        </p>
      </div>
      <div class="receipt" data-rise>
        <div class="receipt-row">
          <span class="receipt-step">Browse the library</span>
          <span class="receipt-dots" aria-hidden="true"></span>
          <span class="receipt-value num">1 min</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-step">Place icons on the grid</span>
          <span class="receipt-dots" aria-hidden="true"></span>
          <span class="receipt-value num">2 min</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-step">Label every card</span>
          <span class="receipt-dots" aria-hidden="true"></span>
          <span class="receipt-value num">2 min</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-step">Print or save as PDF</span>
          <span class="receipt-dots" aria-hidden="true"></span>
          <span class="receipt-value num">instant</span>
        </div>
        <div class="receipt-total">
          A finished chart in under five minutes.
        </div>
      </div>
    </section>

    <!-- ====================== ICON SOURCES (index) ====================== -->
    <!-- Signature move: rows are the index; pointing previews the set. -->
    <section class="sources" aria-labelledby="sources-title">
      <div class="sources-copy" data-rise>
        <h2 data-rise id="sources-title" class="section-title">Fifty thousand icons</h2>
        <p data-rise class="section-body">
          Five open-source libraries, one search box. Every icon is free to
          use, and the four bundled sets work offline.
        </p>
      </div>
      <div class="sources-index">
        <ul class="sources-rows" data-rise>
          <li v-for="set in sets" :key="set.prefix">
            <button
              type="button"
              class="source-row"
              :class="{ 'is-active': activePreview === set.prefix }"
              @mouseenter="activatePreview(set.prefix)"
              @focus="activatePreview(set.prefix)"
              @click="activatePreview(set.prefix)"
            >
              <span class="source-name">{{ set.label }}</span>
              <span class="source-count num">{{ set.count.toLocaleString() }}</span>
            </button>
          </li>
          <li>
            <div class="source-row source-row-static">
              <span class="source-name">ARASAAC <span class="source-online">online</span></span>
              <span class="source-count num">~13,000</span>
            </div>
          </li>
        </ul>
        <div class="sources-preview" data-rise>
          <div class="preview-frame">
            <template v-if="previewLoaded[activePreview]">
              <Icon
                v-for="name in previewNames(activePreview)"
                :key="activePreview + name"
                :icon="`${activePreview}:${name}`"
                class="preview-icon"
                aria-hidden="true"
              />
            </template>
            <p v-else class="preview-loading">Loading…</p>
          </div>
          <p class="preview-caption">{{ activePreviewLabel }} " {{ activePreviewCount }}</p>
        </div>
      </div>
    </section>

    <!-- ========================= THE BUILDER ============================ -->
    <section class="builder-section" aria-labelledby="builder-title">
      <div class="builder-copy" data-rise>
        <h2 data-rise id="builder-title" class="section-title">Meet the builder</h2>
        <p data-rise class="section-body">
          One screen: browse icons on the left, arrange the chart on the right.
          Labels, card colours and grid sizes are one click away " and what
          you see on the sheet is exactly what prints.
        </p>
        <NuxtLink to="/app" class="btn-primary builder-cta">Open the builder</NuxtLink>
      </div>
      <!-- Working-product fragment (data-ui): the builder's own borders. -->
      <div class="builder-fragment" data-rise data-ui aria-label="Preview of the chart builder">
        <div class="fragment-bar">
          <span class="fragment-dot"></span>
          <span class="fragment-title">Mia's chart</span>
          <span class="fragment-pill">Saved</span>
        </div>
        <div class="fragment-body">
          <div class="fragment-browser">
            <div class="fragment-search">Search 50,000 icons</div>
            <div class="fragment-tiles">
              <span v-for="n in 12" :key="n" class="fragment-tile">
                <Icon :icon="heroCards[(n - 1) % heroCards.length]!.icon" aria-hidden="true" />
              </span>
            </div>
          </div>
          <div class="fragment-sheet">
            <p class="fragment-sheet-title">Mia's chart</p>
            <div class="fragment-grid">
              <div class="fragment-cell is-filled">
                <Icon icon="openmoji:potable-water" aria-hidden="true" />
                <span>drink</span>
              </div>
              <div class="fragment-cell is-filled">
                <Icon icon="openmoji:house" aria-hidden="true" />
                <span>home</span>
              </div>
              <div class="fragment-cell"></div>
              <div class="fragment-cell"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===================== WHO IT IS FOR (people) ===================== -->
    <section class="people" aria-labelledby="people-title">
      <h2 data-rise id="people-title" class="section-title">Made for every kind of voice</h2>
      <p data-rise class="section-body people-body">
        Picture Exchange Communication systems give words to people who
        communicate without speech " in speech therapy, classrooms, and at
        home. A printed chart fits a kitchen table, a classroom wall or a
        therapy bag.
      </p>
      <div class="people-plates">
        <figure class="people-plate" data-rise>
          <img
            src="https://picsum.photos/id/1009/900/675"
            width="900" height="675" loading="lazy"
            alt="A person in calm daylight, seen from behind"
          >
          <figcaption>At home</figcaption>
        </figure>
        <figure class="people-plate" data-rise>
          <img
            src="https://picsum.photos/id/177/900/675"
            width="900" height="675" loading="lazy"
            alt="A hiker looking over a hazy valley"
          >
          <figcaption>Out and about</figcaption>
        </figure>
        <figure class="people-plate" data-rise>
          <img
            src="https://picsum.photos/id/669/900/675"
            width="900" height="675" loading="lazy"
            alt="A person in a mustard jacket standing in fog"
          >
          <figcaption>In the classroom</figcaption>
        </figure>
        <figure class="people-plate" data-rise>
          <img
            src="https://picsum.photos/id/338/900/675"
            width="900" height="675" loading="lazy"
            alt="A person in a hooded coat facing a misty sea"
          >
          <figcaption>In therapy</figcaption>
        </figure>
      </div>
    </section>

    <!-- ======================== CTA + FOOTER ============================ -->
    <!-- The back of the object: final action, then the colophon. -->
    <section class="cta" aria-labelledby="cta-title">
      <h2 data-rise id="cta-title" class="cta-title">Print someone a voice today.</h2>
      <NuxtLink to="/app" class="btn-primary cta-btn">Open the builder</NuxtLink>
      <p class="cta-note">free - no sign-up - works offline</p>
    </section>

    <footer class="colophon">
      <div class="colophon-inner">
        <p class="colophon-mark">
          The Talking Chart —
          <a href="/app" class="colophon-app-link">Open the app</a>
        </p>
        <p class="colophon-line">
          Free, printable PECS communication charts. Open source under
          <a href="https://github.com/papar/visual-communication-app" rel="noopener">MIT</a>.
          Built by Daniel Paparo to help individuals with communication difficulties.
        </p>
        <p class="colophon-line">
          Icons: Material Design Icons by Pictogrammers (Apache-2.0) - Material
          Symbols by Google (Apache-2.0) - Tabler Icons (MIT) - OpenMoji
          (CC BY-SA 4.0) - ARASAAC pictograms (CC BY-NC-SA 4.0, fetched online
          with attribution). Photo credits: Joshua Earle, Danka &amp; Peter, Luke
          Pamer, Patryk Sobczak (Unsplash).
        </p>
        <p class="colophon-line colophon-fine">
          IBM Plex Sans by IBM (SIL OFL 1.1), served by Google Fonts.
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ============================ tokens =============================
   Kept from the app: paper #fff, ink #131416, stone #f7f6f2, teal accent
   #1b6c80. One radius (8px), one button shape, 24px page margins. */

.landing {
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans, "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif);
  min-height: 100dvh;
}

/* Entrances: transform-only rise — content stays visible, no hiding. */
[data-rise] {
  translate: 0 24px;
  transition: translate 0.6s ease;
}
[data-rise].rise-in { translate: 0 0; }
@media (prefers-reduced-motion: reduce) {
  [data-rise] { translate: none; transition: none; }
}

/* ============================== hero ============================= */

.hero {
  background: var(--text);
  color: var(--surface);
  padding: 24px 24px 0;
}

.hero-title {
  width: fit-content;
  margin: 72px auto 0;
  font-size: clamp(72px, 10vw, 150px);
  font-weight: 700;
  line-height: 0.92;
  letter-spacing: -0.02em;
  text-align: center;
  text-transform: uppercase;
}
.hero-sub {
  width: fit-content;
  max-width: 52ch;
  margin: 28px auto 0;
  text-align: center;
  font-size: 18px;
  line-height: 1.55;
  color: #c9cdd2;
}

.hero-sheet-stage { display: flex; justify-content: center; padding: 56px 0 0; }
.hero-sheet {
  width: min(100%, 880px);
  aspect-ratio: 297 / 210;
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  padding: 3.4%;
  display: flex;
  flex-direction: column;
  translate: 0 40px; /* runs off the hero's bottom edge onto the next section */
}
.hero-chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.hero-chart-title {
  margin: 0;
  font-size: clamp(20px, 3.4cqw, 34px);
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hero-cta { flex: none; }
.hero-grid {
  flex: 1 1 0;
  min-height: 0;
  margin-top: 3%;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 2.4%;
}
.hero-card {
  background: var(--ground);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6%;
  min-height: 0;
  padding: 4%;
}
.hero-card-icon { width: 46%; height: auto; }
.hero-card-label { font-size: clamp(12px, 1.6cqw, 14px); font-weight: 500; }
.hero-chart-attribution {
  margin: 2.4% 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

/* ======================= shared section bits ====================== */

.section-title {
  margin: 0;
  font-size: clamp(28px, 4vw, 44px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.05;
}
.section-body {
  margin: 16px 0 0;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text);
  max-width: 52ch;
}
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: #fff;
  text-decoration: none;
  border: none;
  border-radius: 8px;
  padding: 12px 22px;
  font-size: 16px;
  font-weight: 500;
  transition: background 140ms ease, translate 140ms ease;
}
.btn-primary:hover { background: #000; }
.btn-primary:active { translate: 0 1px; }
.num { font-variant-numeric: tabular-nums; }

/* ========================= how it works =========================== */

.how {
  background: var(--ground);
  padding: 96px 24px 96px;
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  gap: 48px;
  max-width: 1200px;
  margin: 0 auto;
  align-items: center;
}
.receipt {
  background: var(--surface);
  border-radius: 8px;
  padding: 28px 28px 0;
  max-width: 480px;
  justify-self: end;
  width: 100%;
  /* zigzag receipt bottom edge */
  clip-path: polygon(
    0 0, 100% 0, 100% calc(100% - 12px),
    95% 100%, 90% calc(100% - 12px), 85% 100%, 80% calc(100% - 12px),
    75% 100%, 70% calc(100% - 12px), 65% 100%, 60% calc(100% - 12px),
    55% 100%, 50% calc(100% - 12px), 45% 100%, 40% calc(100% - 12px),
    35% 100%, 30% calc(100% - 12px), 25% 100%, 20% calc(100% - 12px),
    15% 100%, 10% calc(100% - 12px), 5% 100%, 0 calc(100% - 12px)
  );
}
.receipt-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 13px 0;
  font-size: 16px;
}
.receipt-step { flex: none; }
.receipt-dots {
  flex: 1 1 0;
  border-bottom: 3px dotted var(--control);
  translate: 0 -4px;
}
.receipt-value { flex: none; color: var(--muted); }
.receipt-total {
  margin-top: 16px;
  background: var(--primary);
  color: #fff;
  padding: 13px 16px;
  border-radius: 8px 8px 0 0;
  font-size: 16px;
  font-weight: 500;
}

/* ========================= icon sources =========================== */

.sources {
  padding: 120px 24px;
  max-width: 1200px;
  margin: 0 auto;
}
.sources-copy .section-body { max-width: 52ch; }
.sources-index {
  margin-top: 48px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 48px;
  align-items: start;
}
.sources-rows { list-style: none; margin: 0; padding: 0; }
.source-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  background: none;
  border: none;
  border-radius: 8px;
  padding: 16px 14px;
  font: inherit;
  font-size: 20px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: opacity 0.24s ease, color 0.24s ease, background 0.24s ease;
}
.source-row:hover { background: var(--raised); }
.source-row.is-active { background: var(--active); }
.source-row-static { cursor: default; }
.source-count { font-size: 14px; color: var(--muted); }
.source-online {
  font-size: 14px;
  font-weight: 400;
  color: var(--muted);
  border: 1px solid var(--control);
  border-radius: 999px;
  padding: 2px 8px;
  margin-left: 8px;
  vertical-align: 2px;
}
/* dim the rows that are not being pointed at (index-with-preview) */
.sources-rows:has(.source-row.is-active) .source-row:not(.is-active) { opacity: 0.45; }
.source-row.is-active { color: var(--accent); }

.sources-preview { position: sticky; top: 32px; }
.preview-frame {
  aspect-ratio: 4 / 3;
  background: var(--ground);
  border-radius: 8px;
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 1fr;
  gap: 12px;
  place-items: center;
}
.preview-icon { width: 64px; height: 64px; }
.preview-loading { font-size: 14px; color: var(--muted); }
.preview-caption { margin: 10px 2px 0; font-size: 14px; color: var(--muted); }

/* ========================== builder =============================== */

.builder-section {
  background: var(--ground);
  padding: 120px 24px;
}
.builder-section > * { max-width: 1200px; margin-left: auto; margin-right: auto; }
.builder-copy .section-body { max-width: 52ch; }
.builder-cta { margin-top: 24px; }
.builder-fragment {
  margin-top: 56px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;
}
.fragment-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--ground);
}
.fragment-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
.fragment-title { font-weight: 600; font-size: 14px; }
.fragment-pill {
  margin-left: auto;
  background: var(--pill-positive-bg);
  color: var(--pill-positive-ink);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
}
.fragment-body {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 12px;
  padding: 12px;
}
.fragment-browser { border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
.fragment-search {
  border: 1px solid var(--control);
  border-radius: 6px;
  padding: 6px 10px;
  color: var(--muted);
  font-size: 12px;
}
.fragment-tiles { margin-top: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.fragment-tile {
  aspect-ratio: 1;
  border: 1px solid var(--border);
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--text);
}
.fragment-tile svg { width: 60%; height: 60%; }
.fragment-sheet {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
}
.fragment-sheet-title { margin: 0 0 10px; text-align: center; font-weight: 600; font-size: 15px; }
.fragment-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 5px;
  min-height: 150px;
}
.fragment-cell {
  border: 1px dashed var(--control);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
}
.fragment-cell.is-filled { border-style: solid; border-color: var(--border); }
.fragment-cell svg { width: 42%; height: 42%; }

/* ============================ people ============================== */

.people { padding: 96px 24px 88px; max-width: 1200px; margin: 0 auto; }
.people-body { max-width: 56ch; }
.people-plates {
  margin-top: 48px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.people-plate { margin: 0; }
.people-plate img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 8px;
  display: block;
  /* one moving picture: slow drift on the plates */
  transition: transform 1.2s ease;
}
.people-plate:hover img { transform: scale(1.03); }
.people-plate figcaption {
  margin-top: 8px;
  font-size: 14px;
  color: var(--muted);
}

/* ============================ cta ================================= */

.cta {
  background: var(--ground);
  padding: 96px 24px;
  text-align: center;
}
.cta-title {
  margin: 0;
  font-size: clamp(32px, 5vw, 44px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.05;
}
.cta-btn { margin-top: 32px; }
.cta-note { margin: 14px 0 0; font-size: 14px; color: var(--muted); }

/* ========================== colophon ============================== */

.colophon {
  background: var(--text);
  color: #c9cdd2;
  padding: 56px 24px;
}
.colophon-inner { max-width: 1200px; margin: 0 auto; }
.colophon-mark { margin: 0; font-weight: 600; color: #fff; font-size: 16px; }
.colophon-app-link { color: #fff; }
.colophon-line { margin: 12px 0 0; font-size: 14px; line-height: 1.6; max-width: 65ch; }
.colophon-line a { color: #fff; }
.colophon-fine { font-size: 14px; color: #9aa0a6; }

/* ============================ phone =============================== */

@media (max-width: 900px) {
  .hero { padding: 16px 16px 0; }
  .hero-title { margin-top: 48px; font-size: clamp(56px, 15vw, 110px); }
  /* License line reads as a stray label against the next heading on phone —
     the colophon carries the full attribution instead. */
  .hero-chart-attribution { display: none; }
  .hero-sheet-stage { padding-top: 40px; }
  .how {
    grid-template-columns: 1fr;
    gap: 32px;
    padding: 96px 16px 88px;
  }
  .receipt { justify-self: stretch; max-width: none; }
  .sources, .builder-section, .people { padding: 88px 16px; }
  .sources-index { grid-template-columns: 1fr; gap: 32px; }
  .sources-preview { position: static; }
  .builder-fragment .fragment-body { grid-template-columns: 1fr; }
  .fragment-browser { display: none; }
  .people-plates { grid-template-columns: repeat(2, 1fr); }
  .cta { padding: 96px 16px; }
}
</style>
