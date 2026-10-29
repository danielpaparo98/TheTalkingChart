/**
 * Contract types for the icon data pipeline and icon references.
 * These model the generated files in `public/icon-data/` and the
 * runtime icon references placed on chart slots. Source of truth —
 * do not rename or extend without updating the architecture contract.
 */

/** One entry of `public/icon-data/sets.json` — an offline Iconify bundle registry row. */
export interface IconSetMeta {
  /** Iconify set prefix, e.g. 'mdi' — also the basename of the bundle/index JSON files. */
  prefix: string
  /** Human-readable set name shown in the browser's set switcher. */
  label: string
  /** SPDX-style license identifier, e.g. 'Apache-2.0'. */
  license: string
  /** Exact attribution string to render wherever set content appears (browser, chart, exports). */
  attribution: string
  /** Number of icons in the set. */
  count: number
}

/** One row of a `{prefix}-index.json` search index. Field names are kept terse to match the generated files. */
export interface IconSearchEntry {
  /** Icon name (Iconify name within the set's prefix). */
  n: string
  /** Parent icon name — present only when this entry is an alias of another icon. */
  p?: string
  /** Category label, e.g. 'Math'. Empty string when uncategorized. */
  c?: string
  /** Tag/keywords string used for search matching. */
  t?: string
}

/** Shape of `public/icon-data/{prefix}-index.json` — the searchable index for one bundle. */
export interface IconIndex {
  /** Iconify set prefix this index belongs to. */
  prefix: string
  /** All entries of the set, in generation order. */
  entries: IconSearchEntry[]
}

/** Where an icon's pixels come from: an offline Iconify bundle or the ARASAAC online API. */
export type IconSource = 'bundle' | 'arasaac'

/**
 * A fully-qualified reference to one icon, stored on chart slots and persisted
 * to localStorage. Must stay serializable.
 */
export interface IconRef {
  /** Which provider renders this icon. */
  source: IconSource
  /** For `bundle`: the Iconify set prefix (e.g. 'mdi'). For `arasaac`: the literal string 'arasaac'. */
  set: string
  /** For `bundle`: the Iconify icon name within the set. For `arasaac`: the numeric pictogram id, as a string. */
  name: string
}
