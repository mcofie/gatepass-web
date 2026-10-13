import { Metadata } from 'next'
import { EventDetailClient } from '@/components/EventDetailClient'
import { EmbedTheme } from '@/components/embed/EmbedTheme'
import { Event, TicketTier } from '@/types/gatepass'
import { getEventBySlug, getEventPurchaseData } from '@/lib/public-data'
import { withSafeDescription } from '@/lib/sanitize'

export const revalidate = 0

interface PageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const event = await getEventBySlug(slug)
    return event
        ? { title: `${event.title} · Tickets`, description: `Get tickets for ${event.title} on GatePass.` }
        : { title: 'Event not found · GatePass' }
}

/** The same checkout as the event page, sized to fill an iframe on an organizer's site. */
export default async function EmbedPage({ params, searchParams }: PageProps) {
    const { slug } = await params
    const { theme, autosize } = await searchParams
    const embedTheme = theme === 'dark' ? 'dark' : 'light'
    const event = await getEventBySlug(slug)

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

    const { tiers, addons } = await getEventPurchaseData(event.id)

    return (
        <>
            <EmbedTheme theme={embedTheme} />
            <div className={autosize === '1' ? 'bg-white dark:bg-zinc-900' : 'min-h-[100dvh] bg-white dark:bg-zinc-900'}>
            <EventDetailClient
                variant="embed"
                event={withSafeDescription(event) as Event}
                tiers={tiers as TicketTier[]}
                availableAddons={addons}
            />
            </div>
        </>
    )
}
