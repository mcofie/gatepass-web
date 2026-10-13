export default defineNuxtConfig({
    modules: ['../src/module'],
    gatepass: { origin: 'http://localhost:3000' },
    devtools: { enabled: false },
    compatibilityDate: '2024-10-01',
})
