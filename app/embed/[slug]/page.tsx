import { createClient } from '@/utils/supabase/server'
import { EmbedWidget } from '@/components/EmbedWidget'
import { Event, TicketTier } from '@/types/gatepass'
import { Metadata } from 'next'
import { getFeeSettings } from '@/utils/settings'

export const revalidate = 0

interface PageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const supabase = await createClient()
    const { slug } = await params

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)

    let query = supabase
        .schema('gatepass')
        .from('events')
        .select('title, description, poster_url, is_published')

    if (isUuid) {
        query = query.eq('id', slug)
    } else {
        query = query.eq('slug', slug)
    }

    const { data: event } = await query.single()

    if (!event) {
        return {
            title: 'Event Not Found | GatePass',
        }
    }

    return {
        title: `${event.title} - Buy Tickets | GatePass`,
        description: event.description || `Get tickets for ${event.title} on GatePass.`,
    }
}

export default async function EmbedPage({ params, searchParams }: PageProps) {
    const supabase = await createClient()
    const { slug } = await params
    const resolvedSearchParams = await searchParams

    // Check if slug is UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)

    let query = supabase
        .schema('gatepass')
        .from('events')
        .select('*, organizers(*)')

    if (isUuid) {
        query = query.eq('id', slug)
    } else {
        query = query.eq('slug', slug)
    }

    const { data: event } = await query.single()

    if (!event || !event.is_published) {
        return (
            <div className="w-full min-h-[400px] flex items-center justify-center bg-white rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Event not available.</p>
            </div>
        )
    }

    // Fetch tiers (only visible ones)
    const { data: tiers } = await supabase
        .schema('gatepass')
        .from('ticket_tiers')
        .select('*')
        .eq('event_id', event.id)
        .neq('is_visible', false)
        .order('sort_order', { ascending: true })

    // Fetch addons
    const { data: addons } = await supabase
        .schema('gatepass')
        .from('event_addons')
        .select('*')
        .eq('event_id', event.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

    // Fetch fee settings
    const feeSettings = await getFeeSettings()

    // Get cheapest tier for "From" price
    const cheapestTier = tiers && tiers.length > 0
        ? tiers.reduce((min, t) => t.price < min.price ? t : min, tiers[0])
        : null

    return (
        <EmbedWidget
            event={event as Event}
            cheapestTier={cheapestTier as TicketTier | null}
            tiers={(tiers as TicketTier[]) || []}
            feeRates={feeSettings}
            availableAddons={addons || []}
            initialSearchParams={resolvedSearchParams}
        />
    )
}
