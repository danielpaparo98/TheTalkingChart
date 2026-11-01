# The Talking Chart

**Free, printable picture communication charts — live at [thetalkingchart.com](https://thetalkingchart.com/).**

Browse ~50,000 open-source icons, arrange them on a chart grid, add labels, and
print. No sign-up, no cost, no tracking. Runs entirely in your browser — the icon
library works offline.

## Features

- **Card-first builder** — tap a card, type what it should say, pick a picture;
  the next empty card asks automatically as the chart fills
- **Undo / redo** — every placement, label, colour and grid change is one
  step back (Ctrl/Cmd+Z)
- **~49,800 offline icons** across four open-source sets — Material Design Icons,
  Material Symbols, Tabler, and OpenMoji — bundled locally, searchable, browsable
  by category; the library docks beside the sheet on wide screens
- **ARASAAC online pictograms** — optional live search of the ARASAAC AAC
  pictogram library (~13,000 pictograms, CC BY-NC-SA), with attribution handled
  automatically
- **Chart grid** — 2×2, 3×3, 4×5 and 5×4 presets, switchable from the toolbar
- **Editable labels & card colours** — give each card a short, clear label and a
  warm pastel tint
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
| Fonts | Anton (landing display) + Work Sans (UI) |
| Deployment | GitHub Actions → GitHub Pages → thetalkingchart.com |

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

## Deployment

Every push to `main` builds the static site with Bun + Nuxt and deploys it to
GitHub Pages via [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
GitHub Pages serves the result at the custom domain
**https://thetalkingchart.com/**.

> Note: an early version of this site (a static README page) lived on the
> `master` branch. It is superseded — `main` is the deployment branch and the
> Pages source is the GitHub Actions workflow.

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
