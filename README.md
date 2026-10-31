# The Talking Chart

**Free, printable PECs communication charts for everyone.**

Browse ~50,000 open-source icons, arrange them on a chart grid, add labels, and
print. No sign-up, no cost, no tracking. Runs entirely in your browser — the icon
library works offline.

## Features

- **~49,800 offline icons** across four open-source sets — Material Design Icons,
  Material Symbols, Tabler, and OpenMoji — bundled locally, searchable, browsable
  by category
- **ARASAAC online pictograms** — optional live search of the ARASAAC AAC
  pictogram library (~13,000 pictograms, CC BY-NC-SA), with attribution handled
  automatically
- **Chart grid** — 2×2, 3×3, 4×5 and 5×4 presets; click an icon to place it
- **Editable labels & card colors** — give each card a short, clear label
- **True-to-print canvas** — the editor shows an actual A4 landscape sheet with
  the printable area marked; what you see is what prints
- **Print, PNG and PDF export** — clean A4 landscape output with icon licenses
  included
- **Auto-save** — your chart persists in the browser (localStorage)
- **100% free, open source (MIT)** — no ads, no tracking, no sign-up

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Nuxt 4 (SPA mode) |
| Styling | Tailwind CSS v4 |
| State | Pinia + localStorage |
| Icons | @iconify/vue with offline IconifyJSON bundles + ARASAAC API |
| Export | html2canvas-pro + jsPDF; native browser print |
| Fonts | Barlow + Barlow Condensed |
| Deployment | GitHub Pages (via Nuxt generate) |

## Icon library

Icons are bundled at install time by `scripts/build-icon-data.mjs`, which copies
curated sets from the `@iconify-json/*` packages into `public/icon-data/` as
lazy-loaded JSON, plus a build-time search index (names, tags, aliases,
categories). Adding or updating sets is a change to the `SETS` list in that
script — no app code changes needed.

Per-set licenses and attribution requirements: see [ATTRIBUTION.md](ATTRIBUTION.md).

## Development

```bash
# Install dependencies (also builds the icon bundles)
bun install

# Start dev server
bun run dev

# Rebuild icon bundles from the @iconify-json packages
bun run icons

# Typecheck (strict)
bun run typecheck

# Generate static site
bun run generate

# Preview production build
bun run preview
```

> Local preview note: `nuxt preview` serves the static output at the site root,
> but the app is built for the `/visual-communication-app/` sub-path (GitHub
> Pages project sites). Previewing locally requires a static server that serves
> the output under that prefix; on GitHub Pages it works as-is.

## Deployment

The app deploys to GitHub Pages automatically via GitHub Actions when pushing to
the `main` branch.

The live site is at: **https://papar.github.io/visual-communication-app/**

### Manual deploy

```bash
bun run generate
# The output goes to .output/public/ — deploy that folder anywhere static
```

## License

MIT — see [LICENSE](LICENSE).

Icon sets remain under their own licenses (Apache-2.0, MIT, CC BY-SA 4.0,
CC BY-NC-SA for ARASAAC) — see [ATTRIBUTION.md](ATTRIBUTION.md).

Built by Daniel Paparo to help individuals with communication difficulties.
