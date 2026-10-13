import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { GATEPASS_ORIGIN } from '@gatepass/vue'

export default defineNuxtPlugin(nuxtApp => {
    const origin = (useRuntimeConfig().public.gatepass as { origin?: string } | undefined)?.origin
    if (origin) nuxtApp.vueApp.provide(GATEPASS_ORIGIN, origin)
})
