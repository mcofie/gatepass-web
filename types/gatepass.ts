export interface Event {
    id: string
    created_at: string
    title: string
    description: string
    slug: string
    venue_name: string
    venue_address: string
    starts_at: string
    ends_at?: string
    poster_url?: string
    is_published: boolean
    organizer_id: string
    fee_bearer: 'customer' | 'organizer'
    platform_fee_percent: number
}

export interface TicketTier {
    id: string
    created_at: string
    event_id: string
    name: string
    price: number
    currency: string
    total_quantity: number
    quantity_sold: number
    description?: string
}

export interface Ticket {
    id: string
    created_at: string
    user_id: string
    event_id: string
    tier_id: string
    reservation_id: string
    qr_code_hash: string
    status: 'valid' | 'used' | 'cancelled'
    order_reference?: string
    ticket_tiers?: TicketTier
    events?: Event
    profiles?: Profile
}

export interface Profile {
    id: string
    full_name?: string
    avatar_url?: string
    email?: string
}
