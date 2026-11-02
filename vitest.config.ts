import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Pure-logic unit tests only (presets math, templates, later: undo stack,
    // doc reducers). DOM-level tests would add the happy-dom environment —
    // intentionally not set up yet.
    include: ['app/**/*.test.ts'],
  },
})
