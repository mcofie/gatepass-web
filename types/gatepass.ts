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
    is_featured?: boolean
    view_count?: number
    currency?: string
    primary_color?: string
    logo_url?: string
    lineup?: LineupItem[]
    publish_at?: string
    payment_plans?: PaymentPlan[]
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
    updated_at?: string
    bank_name?: string
    account_number?: string
    account_name?: string
    platform_fee_percent?: number
    bank_code?: string
    paystack_bank_code?: string
    paystack_recipient_code?: string
}

export interface LineupItem {
    name: string
    role: string
    image_url?: string
    time?: string
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
    perks?: string[]
    is_visible?: boolean
    sort_order?: number
    allow_instalments?: boolean
    payment_plans?: PaymentPlan[]
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
    reservations?: Reservation
    checked_in_by?: string | null
}

export interface Profile {
    id: string
    full_name?: string
    avatar_url?: string
    email?: string
    is_super_admin?: boolean
    username?: string
    updated_at?: string
}

export interface Reservation {
    id: string
    created_at: string
    event_id: string
    tier_id: string
    user_id: string
    quantity: number
    status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'instalment'
    expires_at: string
    discount_id?: string
    events?: Event
    ticket_tiers?: TicketTier
    profiles?: Profile
    guest_name?: string
    guest_email?: string
    addons?: Record<string, number> // Map of AddonID -> Quantity
    metadata?: Record<string, any>
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
    tier_id?: string | null
    affiliate_email?: string | null
    affiliate_commission_percent?: number | null
    notify_affiliate_on_sale?: boolean
}

export interface EventStaff {
    id: string
    created_at: string
    event_id: string
    name: string
    email: string
    access_code: string
    role: string
    last_active_at?: string
    // Extended properties
    check_in_count?: number
}

export interface EventAddon {
    id: string
    created_at: string
    event_id: string
    name: string
    description?: string
    price: number
    currency: string
    image_url?: string
    total_quantity?: number | null
    quantity_sold: number
    is_active: boolean
    selection_type: 'quantity' | 'toggle'
}

// ============ INSTALMENT PAYMENT TYPES ============

export interface PaymentPlan {
    id: string
    tier_id: string
    event_id: string
    name: string
    num_instalments: number
    initial_percent: number
    deadline_days: number
    is_active: boolean
    allow_early_completion: boolean
    forfeit_on_miss: boolean
    grace_period_hours: number
    created_at: string
}

export interface InstalmentReservation {
    id: string
    reservation_id: string
    payment_plan_id: string
    user_id?: string
    total_amount: number
    amount_paid: number
    currency: string
    status: 'active' | 'completed' | 'forfeited' | 'refunded'
    next_instalment_due_at?: string
    completed_at?: string
    forfeited_at?: string
    contact_email?: string
    contact_name?: string
    contact_phone?: string
    created_at: string
    updated_at: string
    // Relations
    reservation?: Reservation
    payment_plan?: PaymentPlan
    instalment_payments?: InstalmentPayment[]
    // Joined from reservation
    events?: Event
    ticket_tiers?: TicketTier
}

export interface InstalmentPayment {
    id: string
    instalment_reservation_id: string
    instalment_number: number
    amount: number
    currency: string
    transaction_reference?: string
    status: 'pending' | 'paid' | 'failed' | 'overdue'
    due_at: string
    paid_at?: string
    platform_fee: number
    processor_fee: number
    created_at: string
}
