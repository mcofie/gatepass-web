import { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { EventDetailClient } from '@/components/EventDetailClient'
import { EmbedTheme } from '@/components/embed/EmbedTheme'
import { Event, TicketTier } from '@/types/gatepass'
import { getFeeSettings } from '@/utils/settings'

export const revalidate = 0

interface PageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const supabase = await createClient()
    const { slug } = await params
    const { data: event } = await supabase
        .schema('gatepass')
        .from('events')
        .select('title, description')
        .eq(isUuid(slug) ? 'id' : 'slug', slug)
        .maybeSingle()

    return event
        ? { title: `${event.title} · Tickets`, description: `Get tickets for ${event.title} on GatePass.` }
        : { title: 'Event not found · GatePass' }
}

/** The same checkout as the event page, sized to fill an iframe on an organizer's site. */
export default async function EmbedPage({ params, searchParams }: PageProps) {
    const supabase = await createClient()
    const { slug } = await params
    const { theme } = await searchParams
    const embedTheme = theme === 'dark' ? 'dark' : 'light'

    const { data: event } = await supabase
        .schema('gatepass')
        .from('events')
        .select('*, organizers(*)')
        .eq(isUuid(slug) ? 'id' : 'slug', slug)
        .maybeSingle()

    if (!event || !event.is_published) {
        return (
            <>
                <EmbedTheme theme={embedTheme} />
                <div className="flex min-h-[100dvh] items-center justify-center bg-white p-6 text-center dark:bg-zinc-900">
                    <p className="text-sm text-gray-500 dark:text-zinc-400">Tickets for this event aren’t available.</p>
                </div>
            </>
        )
    }

    const [{ data: tiers }, { data: addons }, feeSettings] = await Promise.all([
        supabase.schema('gatepass').from('ticket_tiers').select('*, payment_plans(*)').eq('event_id', event.id).neq('is_visible', false).order('sort_order', { ascending: true }),
        supabase.schema('gatepass').from('event_addons').select('*').eq('event_id', event.id).eq('is_active', true).order('created_at', { ascending: true }),
        getFeeSettings(),
    ])

    return (
        <>
            <EmbedTheme theme={embedTheme} />
            <div className="min-h-[100dvh] bg-white dark:bg-zinc-900">
            <EventDetailClient
                variant="embed"
                event={event as Event}
                tiers={(tiers as TicketTier[]) || []}
                feeRates={feeSettings}
                availableAddons={addons || []}
            />
            </div>
        </>
    )
}
