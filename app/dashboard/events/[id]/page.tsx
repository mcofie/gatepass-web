import { createClient } from '@/utils/supabase/server'
import { EventManageClient } from '@/components/admin/EventManageClient'
import { Event, TicketTier } from '@/types/gatepass'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function ManageEventPage({ params }: PageProps) {
    const supabase = await createClient()
    const { id } = await params

    // Fetch Event
    const { data: event } = await supabase.schema('gatepass').from('events').select('*').eq('id', id).single()

    // Fetch Tiers
    const { data: tiers } = await supabase.schema('gatepass').from('ticket_tiers').select('*').eq('event_id', id).order('price')

    if (!event) return <div>Event not found</div>

    return (
        <EventManageClient event={event as Event} initialTiers={(tiers as TicketTier[]) || []} />
    )
}
