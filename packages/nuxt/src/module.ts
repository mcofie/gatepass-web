import { addComponent, addImports, addPlugin, createResolver, defineNuxtModule } from '@nuxt/kit'

export interface ModuleOptions {
    /** GatePass origin, e.g. a staging URL. Defaults to https://gatepass.so */
    origin?: string
}

export default defineNuxtModule<ModuleOptions>({
    meta: { name: '@gatepass/nuxt', configKey: 'gatepass' },
    defaults: { origin: 'https://gatepass.so' },
    setup(options, nuxt) {
        const { resolve } = createResolver(import.meta.url)
        nuxt.options.runtimeConfig.public.gatepass = { origin: options.origin }

        // Checkout runs in the browser, so the components render client-side only
        for (const name of ['GatePassWidget', 'GatePassButton']) {
            addComponent({ name, export: name, filePath: '@gatepass/vue', mode: 'client' })
        }
        addImports([
            { name: 'useGatePassEvent', from: '@gatepass/vue' },
            { name: 'useGatePassListener', from: '@gatepass/vue' },
            { name: 'openCheckout', from: '@gatepass/vue' },
        ])
        addPlugin(resolve('./runtime/plugin'))
    },
})
