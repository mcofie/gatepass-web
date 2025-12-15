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
    video_url?: string
    latitude?: number
    longitude?: number
    social_website?: string
    social_instagram?: string
    social_twitter?: string
    social_facebook?: string
    is_published: boolean
    organizer_id: string // This is the user_id (Creator)
    organization_id?: string // This is the profile/brand
    fee_bearer: 'customer' | 'organizer'
    platform_fee_percent: number
    organizers?: Organizer
}

export interface Organizer {
    id: string
    user_id: string
    name: string
    slug: string
    logo_url?: string
    description?: string
    website?: string
    twitter?: string
    instagram?: string
    created_at: string
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
    max_per_order?: number
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

export interface Reservation {
    id: string
    created_at: string
    event_id: string
    tier_id: string
    user_id: string
    quantity: number
    status: 'pending' | 'confirmed' | 'cancelled' | 'expired'
    expires_at: string
    discount_id?: string
    events?: Event
    ticket_tiers?: TicketTier
    profiles?: Profile
}

export interface Discount {
    id: string
    created_at: string
    event_id: string
    code: string
    type: 'percentage' | 'fixed'
    value: number
    max_uses?: number
    used_count: number
    expires_at?: string
}
