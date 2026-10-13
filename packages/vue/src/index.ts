import { defineComponent, h, inject, onBeforeUnmount, onMounted, ref, shallowRef, watch, type App, type InjectionKey, type PropType, type Ref } from 'vue'
import {
    DEFAULT_ORIGIN,
    embedAttributes,
    getEvent,
    loadGatePass,
    onGatePassEvent,
    openCheckout,
    type GatePassEvent,
    type GatePassEventType,
    type PublicEvent,
    type Theme,
} from '@gatepass/js'

export type { EmbedOptions, GatePassEvent, GatePassEventType, PublicEvent, PublicTicket, Theme } from '@gatepass/js'
export { getEvent, getOrganizerEvents, openCheckout } from '@gatepass/js'

export const GATEPASS_ORIGIN: InjectionKey<string> = Symbol('gatepass-origin')
const useOrigin = () => inject(GATEPASS_ORIGIN, DEFAULT_ORIGIN)

const embedProps = {
    event: { type: String, required: true },
    theme: { type: String as PropType<Theme>, default: undefined },
    view: { type: String as PropType<'tickets'>, default: undefined },
    referral: { type: String, default: undefined },
} as const

/** Inline checkout that sizes itself to fit. */
export const GatePassWidget = defineComponent({
    name: 'GatePassWidget',
    props: embedProps,
    setup(props) {
        const origin = useOrigin()
        const el = ref<HTMLDivElement | null>(null)

        const mount = () => {
            const node = el.value
            if (!node) return
            node.removeAttribute('data-gatepass-mounted')
            node.innerHTML = ''
            loadGatePass(origin).then(gatepass => gatepass.mount(node.parentNode ?? undefined)).catch(console.error)
        }
        onMounted(mount)
        watch(() => [props.event, props.theme, props.view, props.referral], mount, { flush: 'post' })
        onBeforeUnmount(() => { if (el.value) el.value.innerHTML = '' })

        return () => h('div', { ref: el, ...embedAttributes(props.event, { theme: props.theme, view: props.view, ref: props.referral }) })
    },
})

/** A button that opens checkout in a pop-up over your page. */
export const GatePassButton = defineComponent({
    name: 'GatePassButton',
    props: embedProps,
    setup(props, { slots }) {
        const origin = useOrigin()
        onMounted(() => { loadGatePass(origin).catch(() => { /* retried on click */ }) })
        return () => h('button', {
            type: 'button',
            onClick: () => openCheckout(props.event, { theme: props.theme, view: props.view, ref: props.referral }, origin).catch(console.error),
        }, slots.default ? slots.default() : 'Buy tickets')
    },
})

/** Public event data (title, dates, venue, ticket prices and availability). */
export function useGatePassEvent(slug: Ref<string | null | undefined> | string) {
    const origin = useOrigin()
    const data = shallowRef<PublicEvent | null>(null)
    const error = shallowRef<Error | null>(null)
    const loading = ref(false)
    let controller: AbortController | null = null

    const load = (value: string | null | undefined) => {
        controller?.abort()
        if (!value) return
        controller = new AbortController()
        loading.value = true
        getEvent(value, { origin, signal: controller.signal })
            .then(result => { data.value = result; error.value = null })
            .catch(err => { if (!controller?.signal.aborted) error.value = err })
            .finally(() => { loading.value = false })
    }

    if (typeof slug === 'string') onMounted(() => load(slug))
    else watch(slug, load, { immediate: true })
    onBeforeUnmount(() => controller?.abort())

    return { data, error, loading }
}

/** Run a callback for checkout events from any GatePass widget or button on the page. */
export function useGatePassListener(type: GatePassEventType, handler: (event: GatePassEvent) => void) {
    const origin = useOrigin()
    let off: (() => void) | null = null
    onMounted(() => { off = onGatePassEvent(type, handler, origin) })
    onBeforeUnmount(() => off?.())
}

/** app.use(GatePass, { origin }) registers the components globally. */
export const GatePass = {
    install(app: App, options: { origin?: string } = {}) {
        app.provide(GATEPASS_ORIGIN, options.origin ?? DEFAULT_ORIGIN)
        app.component('GatePassWidget', GatePassWidget)
        app.component('GatePassButton', GatePassButton)
    },
}
export default GatePass
