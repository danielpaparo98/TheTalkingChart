<script setup lang="ts">
/**
 * Accessibility — the plain-language statement: what this site does to be
 * usable by everyone, what still falls short, and how to report a barrier.
 * Calm and honest rather than exhaustive: this is a one-person project,
 * and the page says so.
 *
 * Chrome (header/footer/full-height paper) comes from the default layout,
 * which also owns the <main> landmark and the skip link — so this page is
 * a plain container, like the landing and the attributes page.
 */
useHead({
  title: 'Accessibility — The Talking Chart',
  meta: [
    {
      name: 'description',
      content:
        'How The Talking Chart supports accessibility: keyboard use, screen readers, reduced motion, contrast, and how to report a barrier.',
    },
  ],
})

/** Keep honest: bump this whenever the audit is re-run. */
const lastReviewed = 'November 2026'
</script>

<template>
  <div class="wrap">
    <h1>Accessibility</h1>
    <p class="intro rise d1">
      The Talking Chart is built for people with communication
      disabilities, so it has to work well for people with other
      disabilities too. This page says plainly what the site does, what it
      doesn't do yet, and how to tell me when something gets in your way.
    </p>

    <section class="block rise d2" aria-labelledby="doing-title">
      <h2 id="doing-title">What the site does</h2>
      <ul>
        <li>
          <strong>Full keyboard use.</strong> Everything — including the
          chart builder — works without a mouse, with a clearly visible
          focus ring. Dialogs keep keyboard focus where it belongs and
          return it when they close.
        </li>
        <li>
          <strong>Screen-reader support.</strong> Pages have proper
          landmarks, headings and button labels. Search results, progress
          ("8 of 16 placed"), undo/redo and errors are announced out loud.
        </li>
        <li>
          <strong>Respects reduced motion.</strong> Entrance animations and
          the landing carousel stop automatically when your device asks for
          reduced motion, and the carousel has a visible pause control.
        </li>
        <li>
          <strong>Contrast.</strong> Text and controls meet the WCAG 2.2 AA
          contrast minimums, including button borders and focus indicators.
        </li>
        <li>
          <strong>No drag required.</strong> Dragging pictures onto cards is
          optional — every picture also places with a single click or tap.
        </li>
        <li>
          <strong>Calm by design.</strong> No sign-up, no tracking, no
          moving things you can't stop; your chart stays on your device.
        </li>
      </ul>
    </section>

    <section class="block" aria-labelledby="known-title">
      <h2 id="known-title">What doesn't work yet</h2>
      <p>
        Being honest is part of the deal — this is a one-person project and
        it isn't perfect:
      </p>
      <ul>
        <li>
          The builder is a visual canvas. Screen-reader users can place and
          label cards, but getting a feel for the sheet takes some patience.
        </li>
        <li>
          There is no keyboard command to move a placed picture to a
          different card yet — remove and re-place is the current path.
        </li>
      </ul>
    </section>

    <section class="block" aria-labelledby="conformance-title">
      <h2 id="conformance-title">Conformance</h2>
      <p>
        The site aims for <abbr title="Web Content Accessibility Guidelines">WCAG</abbr> 2.2
        Level AA and was reviewed against it in {{ lastReviewed }}. It is
        largely conformant, with the gaps listed above. Fixing those is the
        next work, not a maybe.
      </p>
    </section>

    <section class="block" aria-labelledby="feedback-title">
      <h2 id="feedback-title">Found a barrier?</h2>
      <p>
        Tell me and it goes straight to the top of the list. Open an issue
        on
        <a href="https://github.com/danielpaparo98/TheTalkingChart" rel="noopener">GitHub</a>
        — or reach me via
        <a href="https://danielpaparo.com" rel="noopener">danielpaparo.com</a>.
        Describe what you were trying to do and what got in the way; that's
        all I need.
      </p>
    </section>
  </div>
</template>

<style scoped>
.wrap { width: 100%; max-width: 820px; margin: 0 auto; padding: 0 28px; }
a { color: inherit; }

h1 {
  margin: 40px 0 0;
  font-size: clamp(40px, 5vw, 64px);
  font-weight: 700; letter-spacing: -0.015em;
}
.intro {
  margin: 16px 0 0;
  max-width: 58ch;
  font-size: 16px; line-height: 1.6; color: #3d3d3a;
}

.rise { animation: rise 640ms ease backwards; }
.rise.d1 { animation-delay: 80ms; }
.rise.d2 { animation-delay: 160ms; }
@keyframes rise {
  from { translate: 0 14px; opacity: 0; }
  to { translate: 0 0; opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .rise { animation: none; }
}

.block { margin-top: 56px; }
.block h2 { margin: 0 0 14px; font-size: 20px; font-weight: 700; }

.block ul {
  margin: 0; padding: 0 0 0 22px;
  display: grid; gap: 12px;
  max-width: 62ch;
  font-size: 15px; line-height: 1.6;
}
.block li::marker { color: var(--mint-deep); }
.block li strong { font-weight: 600; }
.block p {
  margin: 0; max-width: 62ch;
  font-size: 15px; line-height: 1.6;
}
.block p + ul { margin-top: 12px; }
abbr { text-decoration: none; }

@media (max-width: 720px) {
  .wrap { padding: 0 20px; }
  h1 { margin-top: 24px; }
  .block { margin-top: 40px; }
}
</style>
