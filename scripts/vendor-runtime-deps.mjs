/**
 * Vendor runtime deps whose bundled transforms break.
 *
 * html2canvas-pro 2.5.2 hangs indefinitely when its ESM dist is transformed by
 * the Vite 8 (Rolldown) production build; the same untransformed file served
 * statically captures in ~1.4s. So we copy the dist file into public/vendor/
 * and import it at runtime with `/* @vite-ignore *​/` (see useExport.ts).
 *
 * Run on postinstall so CI and fresh clones are deterministic. The package
 * version follows package.json's pinned html2canvas-pro dependency.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendorDir = path.join(root, 'public', 'vendor')

// The package's `exports` map blocks subpath resolution; resolve the entry,
// then walk up to the package root (…/node_modules/html2canvas-pro).
const resolvedEntry = require.resolve('html2canvas-pro')
const pkgDir = path.dirname(path.dirname(resolvedEntry))
const pkg = require(path.join(pkgDir, 'package.json'))
const distFile = path.join(pkgDir, 'dist', 'html2canvas-pro.esm.js')

await mkdir(vendorDir, { recursive: true })
await copyFile(distFile, path.join(vendorDir, 'html2canvas-pro.esm.js'))
await writeFile(
  path.join(vendorDir, 'README.md'),
  `# Vendored runtime dependencies\n\n` +
    `- html2canvas-pro.esm.js — copied untransformed from html2canvas-pro@${pkg.version} ` +
    `(npm), because the bundler-transformed copy hangs at runtime. Imported by ` +
    `app/composables/useExport.ts. MIT licensed by the html2canvas-pro authors; ` +
    `see ATTRIBUTION.md.\n`,
)
console.log(`✓ vendored html2canvas-pro@${pkg.version} → public/vendor/`)
