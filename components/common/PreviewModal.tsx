'use client'

import React from 'react'
import { X } from 'lucide-react'
import { EventDetailClient } from '@/components/EventDetailClient'
import { Event, TicketTier } from '@/types/gatepass'

interface PreviewModalProps {
    isOpen: boolean
    onClose: () => void
    formData: any // We'll cast this to Event
    tiers: Partial<TicketTier>[]
}

export function PreviewModal({ isOpen, onClose, formData, tiers }: PreviewModalProps) {
    if (!isOpen) return null

    // Mock Event Object
    const mockEvent: Event = {
        id: 'preview-id',
        created_at: new Date().toISOString(),
        title: formData.title || 'Untitled Event',
        description: formData.description || '',
        slug: formData.slug || 'preview',
        venue_name: formData.venue_name || 'Venue Name',
        venue_address: formData.venue_address || 'Address',
        starts_at: formData.starts_at?.toISOString() || new Date().toISOString(),
        ends_at: formData.ends_at?.toISOString(),
        poster_url: formData.poster_url,
        video_url: formData.video_url,
        latitude: formData.latitude || undefined,
        longitude: formData.longitude || undefined,
        is_published: false,
        organizer_id: 'preview-organizer',
        organization_id: formData.organization_id,
        fee_bearer: formData.fee_bearer,
        platform_fee_percent: formData.platform_fee_percent,
        // Mock Organizer Profile (Optional, might show "GP" if missing)
        organizers: {
            id: 'preview-org',
            user_id: 'preview-user',
            name: 'Preview Organizer',
            slug: 'preview-org',
            created_at: new Date().toISOString(),
            logo_url: undefined // We could pass this if we had it in form, but we don't fetch it explicitly here except ID
        }
    }

    // Mock Tiers
    const mockTiers: TicketTier[] = tiers.map((tier, index) => ({
        id: tier.id || `tier-${index}`,
        created_at: new Date().toISOString(),
        event_id: 'preview-id',
        name: tier.name || 'General Admission',
        price: tier.price || 0,
        currency: tier.currency || 'GHS',
        total_quantity: tier.total_quantity || 100,
        quantity_sold: 0,
        description: tier.description,
        max_per_order: 10
    }))

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="relative w-full h-full max-w-4xl bg-gray-100 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="absolute top-4 right-4 z-[110]">
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/50 hover:bg-white rounded-full text-black transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="absolute top-4 left-4 z-[110] bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase">
                    Preview Mode
                </div>

                {/* Content */}
                <div className="flex-1 w-full h-full overflow-hidden relative">
                    {/* We pass isFeedItem=true effectively or normal layout? 
                        The EventDetailClient is usually "fixed" position. 
                        We need to contain it. 
                        Actually EventDetailClient uses `fixed inset-0` usually... 
                        Wait, looking at code:
                        It uses `fixed ... bottom-4 left-4 ...`.
                        If we want to preview it, we might just want to let it render "fixed" but on top of everything.
                        Yes, let's just render it directly and let it take over the screen, but with a CLOSE button from this modal.
                    */}
                    <div className="absolute inset-0 pointer-events-auto">
                        <EventDetailClient
                            event={mockEvent}
                            tiers={mockTiers}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
