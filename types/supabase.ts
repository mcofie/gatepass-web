export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    gatepass: {
        Tables: {
            events: {
                Row: {
                    id: string
                    organizer_id: string
                    title: string
                    slug: string
                    description: string | null
                    venue_name: string | null
                    venue_address: string | null
                    starts_at: string
                    // ends_at: string | null // Removed as per schema
                    is_published: boolean | null
                    poster_url: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    organizer_id: string
                    title: string
                    slug: string
                    description?: string | null
                    venue_name?: string | null
                    venue_address?: string | null
                    starts_at: string
                    // ends_at?: string | null
                    is_published?: boolean | null
                    poster_url?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    organizer_id?: string
                    title?: string
                    slug?: string
                    description?: string | null
                    venue_name?: string | null
                    venue_address?: string | null
                    starts_at?: string
                    // ends_at?: string | null
                    is_published?: boolean | null
                    poster_url?: string | null
                    created_at?: string | null
                }
            }
            profiles: {
                Row: {
                    id: string
                    full_name: string | null
                    phone_number: string | null
                    avatar_url: string | null
                    updated_at: string | null
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    phone_number?: string | null
                    avatar_url?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    phone_number?: string | null
                    avatar_url?: string | null
                    updated_at?: string | null
                }
            }
            reservations: {
                Row: {
                    id: string
                    user_id: string
                    tier_id: string
                    event_id: string
                    quantity: number
                    expires_at: string
                    status: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    tier_id: string
                    event_id: string
                    quantity?: number
                    expires_at?: string
                    status?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    tier_id?: string
                    event_id?: string
                    quantity?: number
                    expires_at?: string
                    status?: string | null
                    created_at?: string | null
                }
            }
            ticket_tiers: {
                Row: {
                    id: string
                    event_id: string
                    name: string
                    description: string | null
                    price: number
                    currency: string | null
                    total_quantity: number
                    quantity_sold: number
                    max_per_order: number | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    event_id: string
                    name: string
                    description?: string | null
                    price?: number
                    currency?: string | null
                    total_quantity: number
                    quantity_sold?: number
                    max_per_order?: number | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    event_id?: string
                    name?: string
                    description?: string | null
                    price?: number
                    currency?: string | null
                    total_quantity?: number
                    quantity_sold?: number
                    max_per_order?: number | null
                    created_at?: string | null
                }
            }
            tickets: {
                Row: {
                    id: string
                    event_id: string
                    tier_id: string
                    user_id: string
                    order_reference: string | null
                    qr_code_hash: string
                    status: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    event_id: string
                    tier_id: string
                    user_id: string
                    order_reference?: string | null
                    qr_code_hash: string
                    status?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    event_id?: string
                    tier_id?: string
                    user_id?: string
                    order_reference?: string | null
                    qr_code_hash?: string
                    status?: string | null
                    created_at?: string | null
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
