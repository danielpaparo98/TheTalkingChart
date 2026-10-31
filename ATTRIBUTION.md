# Icon & Asset Attribution

The Talking Chart is an MIT-licensed application. The **icons** it ships come from
several open-source projects, each under its own license. This file records exactly
what is bundled and on which terms. The app also displays these attributions in its
export dialog and prints a compact attribution line on every chart that uses icons.

## Bundled icon sets (offline, in `public/icon-data/`)

Bundles are generated at install time by `scripts/build-icon-data.mjs` from the
`@iconify-json/*` npm packages. Counts are per current bundle (~49,800 icons total).

| Set | Icons | License | Attribution |
|-----|-------|---------|-------------|
| Material Design Icons (`mdi`) | 14,001 | Apache-2.0 | Material Design Icons by Pictogrammers — https://pictogrammers.com/library/mdi/ (Apache-2.0) |
| Material Symbols (`material-symbols`) | 24,641 | Apache-2.0 | Material Symbols by Google — https://fonts.google.com/icons (Apache-2.0) |
| Tabler Icons (`tabler`) | 6,499 | MIT | Tabler Icons — https://tabler.io/icons (MIT) |
| OpenMoji (`openmoji`) | 4,651 | CC BY-SA 4.0 | OpenMoji — https://openmoji.org (CC BY-SA 4.0) |

**Share-alike note (CC BY-SA 4.0):** the OpenMoji pictograms remain under their own
license. The ShareAlike clause applies to the pictogram artwork (the bundled JSON
data in `public/icon-data/openmoji.json`), not to the application code. Charts
printed or exported from this app carry the attribution line shown above.

## ARASAAC pictograms (online only — never bundled)

The optional **ARASAAC** source in the icon browser fetches pictograms at runtime
from the free public API at `api.arasaac.org`. **No ARASAAC artwork is stored in
this repository.**

> Pictograms by ARASAAC (https://arasaac.org), licensed CC BY-NC-SA 4.0

ARASAAC pictograms are licensed **Attribution-NonCommercial-ShareAlike 4.0**:
they may be used freely for personal, educational and other non-commercial
purposes, with attribution. Commercial use requires permission from ARASAAC
(CATEDU, Government of Aragon). Every exported or printed chart that includes
ARASAAC pictograms carries this attribution automatically.

## Fonts

- **IBM Plex Sans** — SIL Open Font License 1.1, © IBM Corp.
  Loaded from Google Fonts.

## Application code

The Talking Chart application code is MIT-licensed — see [LICENSE](LICENSE).
Icon licenses above apply to the icon artwork, not to the application code.
