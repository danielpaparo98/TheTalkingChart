/**
 * Build-time icon data pipeline.
 *
 * Copies curated open-source Iconify sets from node_modules into
 * public/icon-data/ as lazy-loadable IconifyJSON bundles, and generates
 * a client-side search index per set (names, tags, aliases, categories).
 *
 * Sources (devDependencies):
 *  - @iconify-json/mdi              Material Design Icons   (Apache-2.0)
 *  - @iconify-json/material-symbols Material Symbols        (Apache-2.0)
 *  - @iconify-json/tabler           Tabler Icons            (MIT)
 *  - @iconify-json/openmoji         OpenMoji                (CC BY-SA 4.0)
 *
 * Run: node scripts/build-icon-data.mjs [--force]
 * Skips generation when outputs already exist (unless --force), so
 * `postinstall` can call it cheaply and the deploy workflow stays unchanged.
 */
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'icon-data')
const force = process.argv.includes('--force')

const SETS = [
  {
    prefix: 'mdi',
    label: 'Material Design Icons',
    license: 'Apache-2.0',
    attribution: 'Material Design Icons by Pictogrammers — https://pictogrammers.com/library/mdi/ (Apache-2.0)',
  },
  {
    prefix: 'material-symbols',
    label: 'Material Symbols',
    license: 'Apache-2.0',
    attribution: 'Material Symbols by Google — https://fonts.google.com/icons (Apache-2.0)',
  },
  {
    prefix: 'tabler',
    label: 'Tabler Icons',
    license: 'MIT',
    attribution: 'Tabler Icons — https://tabler.io/icons (MIT)',
  },
  {
    prefix: 'openmoji',
    label: 'OpenMoji',
    license: 'CC BY-SA 4.0',
    attribution: 'OpenMoji — https://openmoji.org (CC BY-SA 4.0)',
  },
]

/** Load a JSON file from a set package, or null when absent. */
function readSetFile(prefix, file) {
  try {
    const p = require.resolve(`@iconify-json/${prefix}/${file}`)
    // Bust require cache so repeated runs in the same process stay fresh.
    delete require.cache[p]
    return require(p)
  } catch {
    return null
  }
}

/** Build a slim search index entry list for one icon set. */
function buildIndex(icons, metadata) {
  /** @type {Record<string, string>} icon name -> category */
  const categoryOf = {}
  if (metadata?.categories && typeof metadata.categories === 'object') {
    for (const [category, names] of Object.entries(metadata.categories)) {
      if (Array.isArray(names)) {
        for (const n of names) categoryOf[n] = category
      }
    }
  }

  /** @type {Record<string, string>} icon name -> tag string */
  const tagOf = {}
  if (metadata?.tags && typeof metadata.tags === 'object') {
    for (const [name, tag] of Object.entries(metadata.tags)) {
      tagOf[name] = Array.isArray(tag) ? tag.join(' ') : String(tag)
    }
  }

  /** @type {Record<string, string>} alias name -> parent icon */
  const aliasParent = {}
  if (icons.aliases && typeof icons.aliases === 'object') {
    for (const [alias, entry] of Object.entries(icons.aliases)) {
      if (entry?.parent) aliasParent[alias] = entry.parent
    }
  }

  /** Extra keyword aliases from metadata (name -> string[]). */
  const keywordOf = {}
  if (metadata?.aliases && typeof metadata.aliases === 'object') {
    for (const [name, aliases] of Object.entries(metadata.aliases)) {
      if (Array.isArray(aliases)) keywordOf[name] = aliases.join(' ')
    }
  }

  const entries = []
  for (const name of Object.keys(icons.icons ?? {})) {
    entries.push({
      n: name,
      c: categoryOf[name] ?? '',
      t: [tagOf[name] ?? '', keywordOf[name] ?? ''].join(' ').trim(),
    })
  }
  for (const alias of Object.keys(icons.aliases ?? {})) {
    const parent = aliasParent[alias] ?? ''
    entries.push({
      n: alias,
      p: parent || undefined, // parent icon for rendering
      c: categoryOf[alias] ?? categoryOf[parent] ?? '',
      t: [tagOf[alias] ?? tagOf[parent] ?? '', keywordOf[alias] ?? keywordOf[parent] ?? ''].join(' ').trim(),
    })
  }
  return entries
}

async function main() {
  const registry = []

  for (const set of SETS) {
    const bundlePath = path.join(outDir, `${set.prefix}.json`)
    const indexPath = path.join(outDir, `${set.prefix}-index.json`)

    if (!force && existsSync(bundlePath) && existsSync(indexPath)) {
      console.log(`✓ ${set.prefix} — up to date, skipping (use --force to rebuild)`)
      // Still count icons for the registry from the existing index.
      try {
        const existing = require.resolve(`@iconify-json/${set.prefix}/icons.json`)
        delete require.cache[existing]
        const icons = require(existing)
        registry.push({
          prefix: set.prefix,
          label: set.label,
          license: set.license,
          attribution: set.attribution,
          count: Object.keys(icons.icons ?? {}).length + Object.keys(icons.aliases ?? {}).length,
        })
      } catch {
        /* registry entry skipped */
      }
      continue
    }

    const icons = readSetFile(set.prefix, 'icons.json')
    if (!icons) {
      console.error(`✗ ${set.prefix} — @iconify-json/${set.prefix} not installed; run "bun install"`)
      process.exitCode = 1
      continue
    }

    const metadata = readSetFile(set.prefix, 'metadata.json')
    const entries = buildIndex(icons, metadata)

    await mkdir(outDir, { recursive: true })
    await writeFile(bundlePath, JSON.stringify(icons))
    await writeFile(indexPath, JSON.stringify({ prefix: set.prefix, entries }))

    const count = entries.length
    registry.push({
      prefix: set.prefix,
      label: set.label,
      license: set.license,
      attribution: set.attribution,
      count,
    })
    console.log(`✓ ${set.prefix} — ${count.toLocaleString()} icons bundled + indexed`)
  }

  if (registry.length) {
    await mkdir(outDir, { recursive: true })
    await writeFile(
      path.join(outDir, 'sets.json'),
      JSON.stringify({ sets: registry, updated: new Date().toISOString() }, null, 2),
    )
    const total = registry.reduce((sum, s) => sum + s.count, 0)
    console.log(`✓ sets.json — ${registry.length} sets, ${total.toLocaleString()} icons total`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
