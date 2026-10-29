<script setup lang="ts">
/**
 * AttributionNotice — licence attribution for the icon sources actually used.
 *
 * Two variants (contract line 70; licensing hard requirement, context lines
 * 82-83):
 *  - `compact`: one quiet 11px line used as the sheet's footer strip, so it
 *    prints/exports WITH the chart (legal requirement for CC BY-SA /
 *    CC BY-NC-SA content). Plain text — no anchors, it must survive print.
 *  - `full`: stacked 12px list for the ExportDialog — one row per used
 *    source, each row the byte-exact attribution string recorded in
 *    sets.json (via the catalog store), its URL rendered as a real anchor
 *    (text content unchanged), plus the free-to-print note and the repo
 *    MIT note.
 *
 * Rows render only for sources actually present: unique `icon.set` prefixes
 * from doc.slots, plus the ARASAAC row iff doc.usesArasaac (byte-exact
 * ARASAAC_ATTRIBUTION). Attribution strings come from catalog.sets first and
 * fall back to a local registry that mirrors sets.json byte-for-byte, so the
 * notice stays correct before the lazy registry fetch resolves.
 *
 * Renders nothing when the chart has no placed icons — the sheet and the
 * dialog own their empty states.
 */
import { computed } from 'vue'
import { useChartStore } from '~/stores/chart'
import { ARASAAC_SET_PREFIX, useCatalogStore } from '~/stores/catalog'
import { ARASAAC_ATTRIBUTION } from '~/composables/useArasaac'
import type { IconSetMeta } from '~/types/icons'

defineProps<{
  /** 'compact' = in-sheet footer strip (prints with the chart); 'full' = export-dialog block. */
  variant: 'compact' | 'full'
}>()

const chartStore = useChartStore()
const catalogStore = useCatalogStore()

/**
 * Local fallback registry — byte-identical to `public/icon-data/sets.json`
 * (plus the synthetic online ARASAAC row, whose string is the imported
 * ARASAAC_ATTRIBUTION constant). Used for prefixes the catalog store has not
 * loaded yet; the store's rows win once the registry fetch resolves.
 */
const FALLBACK_SETS: readonly IconSetMeta[] = [
  {
    prefix: 'mdi',
    label: 'Material Design Icons',
    license: 'Apache-2.0',
    attribution:
      'Material Design Icons by Pictogrammers — https://pictogrammers.com/library/mdi/ (Apache-2.0)',
    count: 14001,
  },
  {
    prefix: 'material-symbols',
    label: 'Material Symbols',
    license: 'Apache-2.0',
    attribution: 'Material Symbols by Google — https://fonts.google.com/icons (Apache-2.0)',
    count: 24641,
  },
  {
    prefix: 'tabler',
    label: 'Tabler Icons',
    license: 'MIT',
    attribution: 'Tabler Icons — https://tabler.io/icons (MIT)',
    count: 6499,
  },
  {
    prefix: 'openmoji',
    label: 'OpenMoji',
    license: 'CC BY-SA 4.0',
    attribution: 'OpenMoji — https://openmoji.org (CC BY-SA 4.0)',
    count: 4651,
  },
  {
    prefix: ARASAAC_SET_PREFIX,
    label: 'ARASAAC',
    license: 'CC BY-NC-SA 4.0',
    attribution: ARASAAC_ATTRIBUTION,
    count: 0,
  },
]

/** First URL inside an attribution string (stops at whitespace or ')'). */
const ATTRIBUTION_URL_PATTERN = /https?:\/\/[^\s)]+/

/** An attribution string split at its first URL — concatenation reproduces it byte-exactly. */
interface AttributionParts {
  before: string
  url: string
  after: string
}

/** One used source: its exact meta plus the URL split for the full variant's anchor. */
interface AttributionSource {
  meta: IconSetMeta
  parts: AttributionParts | null
}

function splitAttributionUrl(attribution: string): AttributionParts | null {
  const match = ATTRIBUTION_URL_PATTERN.exec(attribution)
  if (match === null) return null
  return {
    before: attribution.slice(0, match.index),
    url: match[0],
    after: attribution.slice(match.index + match[0].length),
  }
}

/** Canonical row order: sets.json order first (fallback mirrors it), store-only rows after. ARASAAC sits last in both. */
const knownSets = computed<IconSetMeta[]>(() => {
  const seen = new Set<string>()
  const out: IconSetMeta[] = []
  for (const meta of [...FALLBACK_SETS, ...catalogStore.sets]) {
    if (seen.has(meta.prefix)) continue
    seen.add(meta.prefix)
    out.push(meta)
  }
  return out
})

/**
 * Sources actually present in the chart: unique bundle prefixes from the
 * placed icons — ARASAAC rows are governed by `doc.usesArasaac` instead —
 * in registry order, ARASAAC appended last when used. Unknown prefixes
 * (absent from every registry) are skipped: inventing licence text is
 * never acceptable.
 */
const usedSources = computed<AttributionSource[]>(() => {
  const usedPrefixes = new Set<string>()
  for (const slot of chartStore.doc.slots) {
    if (slot.icon === null || slot.icon.source === 'arasaac') continue
    usedPrefixes.add(slot.icon.set)
  }
  const out: AttributionSource[] = []
  for (const meta of knownSets.value) {
    const used =
      meta.prefix === ARASAAC_SET_PREFIX ? chartStore.doc.usesArasaac : usedPrefixes.has(meta.prefix)
    if (!used) continue
    out.push({ meta, parts: splitAttributionUrl(meta.attribution) })
  }
  return out
})

/**
 * Compact strip text — 'Icons: <label> (<license>)' per bundle set, joined
 * with middots. The ARASAAC segment is the byte-exact attribution string
 * (legal requirement), so it carries its own licence wording. The line may
 * ellipsize on screen; the full text remains in the title attribute and in
 * the full variant.
 */
const compactLine = computed<string>(() => {
  const segments = usedSources.value.map(({ meta }) =>
    meta.prefix === ARASAAC_SET_PREFIX ? meta.attribution : `${meta.label} (${meta.license})`,
  )
  return segments.length === 0 ? '' : `Icons: ${segments.join(' · ')}`
})
</script>

<template>
  <!-- Compact: quiet one-line strip inside the sheet; prints with the chart (plain text, no anchors). -->
  <p
    v-if="variant === 'compact' && usedSources.length > 0"
    class="notice-compact"
    :title="compactLine"
  >
    {{ compactLine }}
  </p>
  <!-- Full: stacked list for the export dialog; URLs are real anchors, row text stays byte-exact. -->
  <div v-else-if="variant === 'full' && usedSources.length > 0" class="notice-full">
    <p v-for="source in usedSources" :key="source.meta.prefix" class="notice-full-row">
      <template v-if="source.parts !== null"
        >{{ source.parts.before }}<a
          :href="source.parts.url"
          target="_blank"
          rel="noopener noreferrer"
          >{{ source.parts.url }}</a
        >{{ source.parts.after }}</template
      >
      <template v-else>{{ source.meta.attribution }}</template>
    </p>
    <p class="notice-full-note">This chart is free to print and share. Icon licenses apply to the icons.</p>
    <p class="notice-full-note">App code: MIT</p>
  </div>
</template>

<style scoped>
/*
 * Plain roots — the notice carries no border, background or elevation of its
 * own: compact sits on the white sheet, full sits in the dialog. Muted ink
 * (#5d5f60 on white ≈ 6.5:1) passes AA at these sizes.
 */
.notice-compact {
  margin: 0;
  font-size: 11px; /* house floor — nothing renders under 11px */
  line-height: 1.35;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notice-full {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notice-full-row,
.notice-full-note {
  margin: 0;
  font-size: var(--text-small); /* 12px */
  line-height: 1.45;
  color: var(--muted);
}

.notice-full-note {
  /* Closing notes get a touch more air than the licence rows (4px gap + 4px). */
  margin-top: 4px;
}

.notice-full-row a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--control);
  text-underline-offset: 2px;
}

.notice-full-row a:hover {
  text-decoration-color: var(--muted);
}

/* Exact colours survive print and export capture — compact prints with the sheet. */
@media print {
  .notice-compact,
  .notice-full,
  .notice-full-row,
  .notice-full-note {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
