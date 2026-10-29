// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  // devtools disabled — Vue Devtools v7 __vrv_devtools conflicts in SPA mode
  devtools: { enabled: false },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  // SPA mode — fully static for GitHub Pages
  ssr: false,

  app: {
    // Matches GitHub repo name so deployment "just works"
    baseURL: '/visual-communication-app/',
    buildAssetsDir: 'assets',
    head: {
      link: [
        // Barlow Condensed 700 (display) + Barlow 400/500/600 (text) — the dealt
        // faces (.taste-skill/direction.json seed 756865226). Preconnect both
        // font hosts, then the stylesheet.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Barlow:wght@400;500;600&display=swap',
        },
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
