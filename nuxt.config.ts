// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  // devtools disabled — Vue Devtools v7 __vrv_devtools conflicts in SPA mode
  devtools: { enabled: false },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  // SPA mode — fully static for GitHub Pages
  ssr: false,

  app: {
    // Root base — the app is served at the custom domain thetalkingchart.com
    // (GitHub Pages, deployed from main via .github/workflows/deploy.yml)
    baseURL: '/',
    buildAssetsDir: 'assets',
    head: {
      // SPA shell defaults — the pre-hydration HTML must carry a title and
      // description (crawlers and slow devices see the shell first).
      // Pages override via useHead when they mount.
      title: 'The Talking Chart — free printable picture communication charts',
      meta: [
        {
          name: 'description',
          content:
            'For speech therapists, parents and teachers. Pick from 50,000 open-source icons, place them on a chart, label each card, and print. Free, no sign-up, works offline.',
        },
      ],
      // SPA mode renders <html> without a lang attribute unless declared
      // here — required for screen-reader pronunciation (WCAG 3.1.1).
      htmlAttrs: { lang: 'en' },
      link: [
        // Mint poster system: Anton (landing display) + Work Sans (all UI and
        // the chart sheet) — design_iterations/design-system.md.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Anton&family=Work+Sans:wght@400;500;600;700&display=swap',
        },
        // the logo tile doubles as the favicon
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },

  nitro: {
    preset: 'github-pages',
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },

  typescript: {
    strict: true,
  },
})
