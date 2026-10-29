<script setup lang="ts">
/**
 * Landing page — "The page is the object" (direction seed 756865226).
 *
 * The idea: the printed PECS chart this tool produces becomes the page
 * itself. The hero deals the blueprint "Striped card beside the room": a
 * printed card (paper on stone, ink/paper stripe band as the only ornament)
 * beside a full-height photograph of the subject's world — an adult pointing
 * at a page while a child leans in, which is this product's own gesture.
 * Sections are further pieces of the same stationery: a receipt slip with a
 * zigzag cut (how it works), an index-with-preview of the icon sources, the
 * builder fragment (data-ui), people plates, and the footer as the back of
 * the object.
 *
 * Type: Barlow Condensed 700 for display, Barlow for text. Colour: stone
 * ground, paper panels, near-black ink; the blueprint blue is the single
 * accent — the one filled button and almost nothing else.
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

/** Hero pictogram plates — real OpenMoji glyphs, PECS core vocabulary. */
const heroCards = [
  { icon: 'openmoji:potable-water', label: 'drink' },
  { icon: 'openmoji:rice-cracker', label: 'eat' },
  { icon: 'openmoji:red-question-mark', label: 'help' },
  { icon: 'openmoji:house', label: 'home' },
  { icon: 'openmoji:grinning-face', label: 'happy' },
  { icon: 'openmoji:crying-face', label: 'sad' },
  { icon: 'openmoji:dog-face', label: 'dog' },
  { icon: 'openmoji:soccer-ball', label: 'play' },
]

/** Stripe band: alternating ink/paper bars, 28px each, as filled blocks. */
const STRIPE_BARS = 26

// --- Hero photograph: the slow crossfade (the signature move) --------------

const heroPhotos = [
  {
    src: `${config.app.baseURL}photos/reading-together.jpg`,
    alt: 'A child leans in as an adult points at the page of an open book',
  },
  {
    src: `${config.app.baseURL}photos/reading-soft.jpg`,
    alt: 'The same quiet table, the focus softening onto the child\'s face',
  },
]
const livePhoto = ref(0)

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  let flip = true
  window.setInterval(() => {
    if (document.hidden) return
    livePhoto.value = flip ? 1 : 0
    flip = !flip
  }, 6000)
})

useHead({
  title: 'The Talking Chart — Free printable PECS communication charts',
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
    <!-- "Striped card beside the room": printed card left, photograph right. -->
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-card">
        <!-- The subject's stripe: ink and paper bars, the only ornament. -->
        <div class="stripe" aria-hidden="true">
          <span
            v-for="n in STRIPE_BARS"
            :key="n"
            class="stripe-bar"
            :class="n % 2 === 1 ? 'is-ink' : 'is-paper'"
          ></span>
        </div>

        <div class="hero-card-body">
          <h1 id="hero-title" class="hero-title">Print them<br >a voice.</h1>
          <p class="hero-sub">
            Free, printable communication charts. Pick from 50,000
            open-source icons, label each card, and print. No sign-up,
            no cost.
          </p>

          <NuxtLink to="/app" class="btn-primary hero-cta">Make your chart</NuxtLink>

          <!-- Tipped-in plates: the product's own pictograms on the card. -->
          <div class="hero-plates" data-rise>
            <div v-for="card in heroCards" :key="card.label" class="hero-plate">
              <Icon :icon="card.icon" class="hero-plate-icon" aria-hidden="true" />
              <span class="hero-plate-label">{{ card.label }}</span>
            </div>
          </div>

          <nav class="hero-links" aria-label="Page sections">
            <a href="#how">How it works</a>
            <a href="#icons">The icons</a>
            <a href="#builder">The builder</a>
          </nav>
        </div>
      </div>

      <div class="hero-photo" data-rise>
        <img
          v-for="(photo, i) in heroPhotos"
          :key="photo.src"
          :src="photo.src"
          :alt="photo.alt"
          width="1920"
          height="1277"
          :class="{ 'is-live': livePhoto === i }"
          :loading="i === 0 ? 'eager' : 'lazy'"
        >
      </div>
    </section>

    <!-- ========================= HOW IT WORKS =========================== -->
    <!-- The process printed as a receipt slip: dot leaders, zigzag cut. -->
    <section id="how" class="section" aria-labelledby="how-title">
      <div class="inner how">
        <div class="how-copy">
          <h2 data-rise id="how-title" class="section-title">How it works</h2>
          <p data-rise class="section-body">
            Three steps, on one screen. Everything runs in your browser:
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
      </div>
    </section>

    <!-- ====================== ICON SOURCES (index) ====================== -->
    <!-- Signature move: rows are the index; pointing previews the set. -->
    <section id="icons" class="section" aria-labelledby="sources-title">
      <div class="inner">
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
            <p class="preview-caption">{{ activePreviewLabel }} — {{ activePreviewCount }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================= THE BUILDER ============================ -->
    <section id="builder" class="section" aria-labelledby="builder-title">
      <div class="inner">
        <div class="builder-copy" data-rise>
          <h2 data-rise id="builder-title" class="section-title">Meet the builder</h2>
          <p data-rise class="section-body">
            One screen: browse pictures on the left, arrange the chart on the
            right. Click a picture or drag it onto a card, click a label to
            rename it, click the title to retitle the chart, and what you
            see on the sheet is exactly what prints.
          </p>
          <NuxtLink to="/app" class="btn-primary builder-cta">Open the builder</NuxtLink>
        </div>
        <!-- Working-product fragment (data-ui): the builder's own borders. -->
        <div class="builder-fragment" data-rise data-ui aria-label="Preview of the chart builder">
          <div class="fragment-bar">
            <span class="fragment-back" aria-hidden="true"></span>
            <span class="fragment-title">Mia's chart</span>
            <span class="fragment-pill">Saved</span>
          </div>
          <div class="fragment-body">
            <div class="fragment-browser">
              <div class="fragment-search">Search the icon library</div>
              <div class="fragment-tiles">
                <span v-for="n in 12" :key="n" class="fragment-tile">
                  <Icon :icon="heroCards[(n - 1) % heroCards.length]!.icon" aria-hidden="true" />
                </span>
              </div>
            </div>
            <div class="fragment-well">
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
        </div>
      </div>
    </section>

    <!-- ===================== WHO IT IS FOR (people) ===================== -->
    <section class="section" aria-labelledby="people-title">
      <div class="inner">
        <h2 data-rise id="people-title" class="section-title">Made for every kind of voice</h2>
        <p data-rise class="section-body people-body">
          Picture Exchange Communication systems give words to people who
          communicate without speech: in speech therapy, classrooms, and at
          home. A printed chart fits a kitchen table, a classroom wall or a
          therapy bag.
        </p>
        <div class="people-plates">
          <figure class="people-plate" data-rise>
            <img
              :src="`${config.app.baseURL}photos/reading-together.jpg`"
              width="900" height="600" loading="lazy"
              alt="A child leans in as an adult points at the page of an open book"
            >
            <figcaption>At the kitchen table</figcaption>
          </figure>
          <figure class="people-plate" data-rise>
            <img
              src="https://picsum.photos/id/669/900/600"
              width="900" height="600" loading="lazy"
              alt="A person in a mustard jacket standing in mild fog, out of doors"
            >
            <figcaption>Out and about</figcaption>
          </figure>
          <figure class="people-plate" data-rise>
            <img
              src="https://picsum.photos/id/1011/900/600"
              width="900" height="600" loading="lazy"
              alt="A person paddling a canoe on a turquoise lake edged by forest"
            >
            <figcaption>On the water</figcaption>
          </figure>
          <figure class="people-plate" data-rise>
            <img
              src="https://picsum.photos/id/338/900/600"
              width="900" height="600" loading="lazy"
              alt="A person in a hooded coat facing a misty sea"
            >
            <figcaption>Wherever words are needed</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- ======================== CTA + FOOTER ============================ -->
    <!-- The back of the object: final action, then the colophon. -->
    <section class="cta" aria-labelledby="cta-title">
      <div class="inner">
        <h2 data-rise id="cta-title" class="cta-title">Print someone a voice today.</h2>
        <NuxtLink to="/app" class="btn-primary cta-btn" data-rise>Open the builder</NuxtLink>
        <p class="cta-note">free · no sign-up · works offline</p>
      </div>
    </section>

    <footer class="colophon">
      <div class="inner">
        <p class="colophon-mark">
          The Talking Chart ·
          <NuxtLink to="/app" class="colophon-app-link">Open the app</NuxtLink>
        </p>
        <p class="colophon-line">
          Free, printable PECS communication charts. Open source under
          <a href="https://github.com/papar/visual-communication-app" rel="noopener">MIT</a>.
          Built by Daniel Paparo to help individuals with communication difficulties.
        </p>
        <p class="colophon-line">
          Icons: Material Design Icons by Pictogrammers (Apache-2.0) · Material
          Symbols by Google (Apache-2.0) · Tabler Icons (MIT) · OpenMoji
          (CC BY-SA 4.0) · ARASAAC pictograms (CC BY-NC-SA 4.0, fetched online
          with attribution). Photos: "Child attentively listens as an adult
          shares a story from a book" by Shixart1985 (CC BY 2.0, via Wikimedia
          Commons); Luke Pamer, Patryk Sobczak, Roberto Nickson (Unsplash).
        </p>
        <p class="colophon-line colophon-fine">
          Barlow &amp; Barlow Condensed by Jeremy Tribby (SIL OFL 1.1), served
          by Google Fonts.
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ============================ tokens =============================
   Stone ground, paper panels, ink text; blueprint blue as the single
   accent (the filled button). Square controls, 16px object radii. */

.landing {
  background: var(--ground);
  color: var(--text);
  font-family: var(--font-text);
  min-height: 100dvh;
}

.inner {
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: 16px;
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
/* Blueprint: 50/50 split, one 16px gutter, 16px outer margins. The photo
   sticks; the card is the printed object. */

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
  min-height: calc(100dvh - 32px);
}

.hero-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--radius-sheet);
  overflow: hidden;
  min-height: 0;
}

/* The stripe: alternating ink and paper bars, 28px each, filled blocks. */
.stripe {
  display: flex;
  flex: none;
  height: 56px;
  overflow: hidden;
}
.stripe-bar { width: 28px; height: 100%; }
.stripe-bar.is-ink { background: var(--text); }
.stripe-bar.is-paper { background: var(--surface); }

.hero-card-body {
  flex: 1 1 auto; /* auto basis: the body must never collapse at auto heights */
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 28px 32px 24px;
}

.hero-title {
  margin: 22px 0 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(64px, 8.6vw, 124px);
  line-height: 0.9;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  color: var(--text);
}

.hero-sub {
  width: fit-content;
  max-width: 40ch;
  margin: 18px 0 0;
  font-size: 17px;
  line-height: 1.5;
  color: var(--text);
}

/* The one filled button on the page — blueprint blue, square, print-shop. */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  text-decoration: none;
  border: none;
  border-radius: 0;
  padding: 14px 26px;
  font-size: 16px;
  font-weight: 500;
  transition: background 140ms ease, translate 140ms ease;
}
.btn-primary:hover { background: #1d47b8; }
.btn-primary:active { translate: 0 1px; }
.hero-cta { margin-top: 22px; }
.num { font-variant-numeric: tabular-nums; }

/* Tipped-in plates: the pictograms as small printed cards. */
.hero-plates {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  max-width: 520px;
  margin-top: 26px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 8px;
}
.hero-plate {
  min-height: 0;
  background: var(--raised);
  border-radius: var(--radius-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4%;
  transition: background-color 140ms ease;
}
.hero-plate:hover { background: var(--active); }
.hero-plate-icon { width: 52%; height: auto; }
.hero-plate-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
}

.hero-links {
  flex: none;
  display: flex;
  gap: 24px;
  margin-top: 22px;
}
.hero-links a {
  font-size: 15px;
  color: var(--text);
  text-decoration: none;
  transition: text-decoration-color 120ms ease;
}
.hero-links a:hover { text-decoration: underline; text-underline-offset: 3px; }

/* The room: full-height photograph, sticky, slow crossfade. */
.hero-photo {
  position: sticky;
  top: 16px;
  height: calc(100dvh - 32px);
  border-radius: var(--radius-sheet);
  overflow: hidden;
  background: var(--well);
}
.hero-photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 1.6s ease;
}
.hero-photo img.is-live { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  /* Only the first frame shows, instantly. */
  .hero-photo img { transition: none; }
  .hero-photo img + img { display: none; }
}

/* ======================= shared section bits ====================== */

.section {
  padding: 96px 0;
}
.section-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(34px, 4.4vw, 56px);
  line-height: 0.95;
  letter-spacing: -0.01em;
}
.section-body {
  margin: 16px 0 0;
  font-size: 17px;
  line-height: 1.55;
  color: var(--text);
  max-width: 52ch;
}

/* ========================= how it works =========================== */

.how {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  gap: 48px;
  align-items: center;
}
.receipt {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 24px 16px 0;
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
  padding: 13px 8px;
  font-size: 16px;
}
.receipt-step { flex: none; }
.receipt-dots {
  flex: 1 1 0;
  border-bottom: 4px dotted var(--control);
  translate: 0 -4px;
}
.receipt-value { flex: none; color: var(--muted); }
.receipt-total {
  margin-top: 16px;
  background: var(--text);
  color: var(--surface);
  padding: 13px 12px;
  font-size: 16px;
  font-weight: 500;
}

/* ========================= icon sources =========================== */

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
  border-radius: 0;
  padding: 16px 14px;
  font: inherit;
  font-size: 20px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: opacity 0.24s ease, background 0.24s ease;
}
.source-row:hover { background: var(--raised); }
.source-row.is-active { background: var(--surface); }
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

.sources-preview { position: sticky; top: 32px; }
.preview-frame {
  aspect-ratio: 4 / 3;
  background: var(--surface);
  border-radius: var(--radius-card);
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

.builder-copy .section-body { max-width: 52ch; }
.builder-cta { margin-top: 24px; }
.builder-fragment {
  margin-top: 56px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sheet);
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
.fragment-back {
  width: 14px;
  height: 2px;
  background: var(--muted);
  /* a quiet exit-arrow stand-in */
  clip-path: polygon(100% 0, 100% 100%, 0 50%);
  transform: scaleX(-1);
}
.fragment-title { font-weight: 600; font-size: 14px; }
.fragment-pill {
  margin-left: auto;
  background: var(--pill-positive-bg);
  color: var(--pill-positive-fg);
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
.fragment-browser { border: 1px solid var(--border); border-radius: var(--radius-card); padding: 10px; }
.fragment-search {
  border: 1px solid var(--control);
  padding: 6px 10px;
  color: var(--muted);
  font-size: 12px;
}
.fragment-tiles { margin-top: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.fragment-tile {
  aspect-ratio: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  display: grid;
  place-items: center;
  color: var(--text);
}
.fragment-tile svg { width: 60%; height: 60%; }
/* the canvas well behind the sheet, exactly like the real builder */
.fragment-well {
  background: var(--well);
  border-radius: var(--radius-card);
  padding: 12px;
  display: flex;
}
.fragment-sheet {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
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
  border-radius: var(--radius-card);
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
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border-radius: var(--radius-card);
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
  padding: 96px 0;
  text-align: center;
}
.cta-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(40px, 5.6vw, 72px);
  line-height: 0.95;
  letter-spacing: -0.01em;
}
.cta-btn { margin-top: 32px; }
.cta-note { margin: 14px 0 0; font-size: 14px; color: var(--muted); }

/* ========================== colophon ============================== */
/* The back of the object: ink ground, paper text. */

.colophon {
  background: var(--text);
  color: #cfcdc6;
  padding: 56px 0;
}
.colophon-mark { margin: 0; font-weight: 600; color: var(--surface); font-size: 16px; }
.colophon-app-link { color: var(--surface); }
.colophon-line { margin: 12px 0 0; font-size: 14px; line-height: 1.6; max-width: 65ch; }
.colophon-line a { color: var(--surface); }
.colophon-fine { font-size: 14px; color: #9b9992; }

/* ============================ phone =============================== */

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 16px;
    min-height: 0;
  }
  /* The photograph comes first, the card overlaps its bottom edge. */
  .hero-photo {
    order: -1;
    position: static;
    height: 48svh;
  }
  .hero-card { margin-top: -24px; }
  .stripe { height: 40px; }
  .stripe-bar { width: 20px; }
  .hero-card-body { padding: 20px 16px 18px; }
  .hero-title { font-size: clamp(56px, 16vw, 96px); }
  /* Plates size naturally on phone (the card's height is auto, so a
     flex-stretched grid would collapse and collide with the links). */
  .hero-plates { flex: none; max-width: none; grid-template-rows: none; grid-auto-rows: 84px; }
  .section { padding: 88px 0; }
  .how {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .receipt { justify-self: stretch; max-width: none; }
  .sources-index { grid-template-columns: 1fr; gap: 32px; }
  .sources-preview { position: static; }
  .builder-fragment .fragment-body { grid-template-columns: 1fr; }
  .fragment-browser { display: none; }
  .people-plates { grid-template-columns: repeat(2, 1fr); }
}
</style>
