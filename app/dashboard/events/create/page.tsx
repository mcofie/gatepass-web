'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { ImageDropzone } from '@/components/common/ImageDropzone'
import { TicketManager } from '@/components/common/TicketManager'
import { TicketTier } from '@/types/gatepass'
import { PreviewModal } from '@/components/common/PreviewModal'

export default function CreateEventPage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [showPreview, setShowPreview] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        venue_name: '',
        venue_address: '',
        starts_at: undefined as Date | undefined,
        ends_at: undefined as Date | undefined,
        poster_url: '',
        video_url: '',
        latitude: null as number | null,
        longitude: null as number | null,
        slug: '',
        fee_bearer: 'customer' as 'customer' | 'organizer',
        platform_fee_percent: 5.0,
        organization_id: '',
        tiers: [] as Partial<TicketTier>[]
    })

    // Fetch or Create Organizer on Mount
    React.useEffect(() => {
        const initOrganizer = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Check for existing organizer profile
            const { data: existingOrgs } = await supabase
                .schema('gatepass')
                .from('organizers')
                .select('*')
                .eq('user_id', user.id)

            if (existingOrgs && existingOrgs.length > 0) {
                setFormData(prev => ({ ...prev, organization_id: existingOrgs[0].id }))
            } else {
                // Auto-create default organizer
                const name = user.user_metadata?.full_name || 'My Organization'
                const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(7)

                const { data: newOrg, error } = await supabase
                    .schema('gatepass')
                    .from('organizers')
                    .insert({
                        user_id: user.id,
                        name: name,
                        slug: slug,
                    })
                    .select()
                    .single()

                if (newOrg) {
                    setFormData(prev => ({ ...prev, organization_id: newOrg.id }))
                }
            }
        }
        initOrganizer()
    }, [])



    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

    // Debounce check slug
    React.useEffect(() => {
        const checkSlug = async () => {
            if (!formData.slug) {
                setSlugStatus('idle')
                return
            }

            setSlugStatus('checking')
            try {
                const { data, error } = await supabase
                    .schema('gatepass')
                    .from('events')
                    .select('id')
                    .eq('slug', formData.slug)
                    .single()

                if (data) {
                    setSlugStatus('taken')
                } else {
                    setSlugStatus('available')
                }
            } catch (e) {
                // If error is "row not found", then it's available
                setSlugStatus('available')
            }
        }

        const timeoutId = setTimeout(checkSlug, 500)
        return () => clearTimeout(timeoutId)
    }, [formData.slug])

    const handleGenerateSlug = () => {
        if (!formData.title) return
        const slug = formData.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '')

        setFormData(prev => ({ ...prev, slug }))
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        // Prevent auto-generation if user manually edits slug
        if (name === 'slug') {
            // allow manual edit
        }
        setFormData(prev => ({ ...prev, [name]: value }))
    }
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            if (!formData.organization_id) throw new Error('Organization profile not found')

            const { tiers, ...eventData } = formData

            const { data, error } = await supabase
                .schema('gatepass')
                .from('events')
                .insert({
                    ...eventData,
                    starts_at: formData.starts_at?.toISOString(),
                    ends_at: formData.ends_at?.toISOString() || null,
                    organizer_id: user.id, // Legacy: User Creator
                    organization_id: formData.organization_id, // New: Linked Organization
                    is_published: false // Default to draft
                })
                .select()
                .single()

            if (data && formData.tiers.length > 0) {
                const tiersToInsert = formData.tiers.map(tier => ({
                    event_id: data.id,
                    name: tier.name,
                    price: tier.price,
                    total_quantity: tier.total_quantity,
                    description: tier.description,
                    currency: tier.currency || 'GHS',
                    quantity_sold: 0,
                    perks: tier.perks || []
                }))

                const { error: ticketsError } = await supabase
                    .schema('gatepass')
                    .from('ticket_tiers')
                    .insert(tiersToInsert)

                if (ticketsError) throw ticketsError
            }

            if (error) throw error

            router.push(`/dashboard/events/${data.id}`)
            router.refresh()
        } catch (e: any) {
            alert('Error creating event: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto py-8">
            <Link href="/dashboard/events" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-black mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Link>

            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_2px_40px_rgba(0,0,0,0.04)]">
                <div className="mb-10">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Create New Event</h1>
                    <p className="text-gray-500">Fill in the details to launch your next experience.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2">Basic Information</h3>

                        <div className="grid gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Title</label>
                                <input
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    type="text"
                                    required
                                    placeholder="e.g. Summer Music Festival 2024"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent focus:bg-white transition-all outline-none font-medium"
                                />
                            </div>



                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">URL Slug</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center relative">
                                        <span className="bg-gray-100 border border-r-0 border-gray-200 rounded-l-xl px-4 py-3 text-gray-500 text-sm font-medium">gatepass.com/events/</span>
                                        <input
                                            name="slug"
                                            value={formData.slug}
                                            onChange={handleChange}
                                            type="text"
                                            required
                                            className={`flex-1 px-4 py-3 bg-gray-50 border rounded-r-xl focus:ring-2 focus:ring-black focus:border-transparent focus:bg-white transition-all outline-none font-medium ${slugStatus === 'taken' ? 'border-red-300 text-red-600 focus:ring-red-200' :
                                                slugStatus === 'available' ? 'border-green-300 text-green-700 focus:ring-green-200' :
                                                    'border-gray-200'
                                                }`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {slugStatus === 'checking' && <div className="w-4 h-4 border-2 border-gray-200 border-t-black rounded-full animate-spin"></div>}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleGenerateSlug}
                                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-medium text-sm transition-colors whitespace-nowrap"
                                    >
                                        Generate
                                    </button>
                                </div>
                                {slugStatus === 'taken' && <p className="text-xs text-red-500 mt-1.5 font-medium">This slug is already taken.</p>}
                                {slugStatus === 'available' && formData.slug && <p className="text-xs text-green-600 mt-1.5 font-medium">Slug available!</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                                <RichTextEditor
                                    value={formData.description}
                                    onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                                    placeholder="Tell people what your event is about..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Venue & Time */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 pt-4">Location & Time</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Venue Name</label>
                                <input
                                    name="venue_name"
                                    value={formData.venue_name}
                                    onChange={handleChange}
                                    type="text"
                                    required
                                    placeholder="e.g. The Grand Arena"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent focus:bg-white transition-all outline-none font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                                <input
                                    name="venue_address"
                                    value={formData.venue_address}
                                    onChange={handleChange}
                                    type="text"
                                    required
                                    placeholder="e.g. 123 Main St, Accra"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent focus:bg-white transition-all outline-none font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Latitude (Optional)</label>
                                <input
                                    name="latitude"
                                    value={formData.latitude || ''}
                                    onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                    type="number"
                                    step="any"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent focus:bg-white transition-all outline-none font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Longitude (Optional)</label>
                                <input
                                    name="longitude"
                                    value={formData.longitude || ''}
                                    onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                    type="number"
                                    step="any"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent focus:bg-white transition-all outline-none font-medium"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Starts At</label>
                                <DateTimePicker
                                    date={formData.starts_at}
                                    setDate={(date) => setFormData(prev => ({ ...prev, starts_at: date }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Ends At (Optional)</label>
                                <DateTimePicker
                                    date={formData.ends_at}
                                    setDate={(date) => setFormData(prev => ({ ...prev, ends_at: date }))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Media */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 pt-4">Media</h3>

                        <div className="grid gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Poster URL</label>
                                <ImageDropzone
                                    value={formData.poster_url}
                                    onChange={(url) => setFormData(prev => ({ ...prev, poster_url: url || '' }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Video URL (Optional)</label>
                                <input
                                    name="video_url"
                                    value={formData.video_url}
                                    onChange={handleChange}
                                    type="url"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent focus:bg-white transition-all outline-none font-medium"
                                />
                            </div>
                        </div>
                    </div>


                    {/* Tickets */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 pt-4">Tickets</h3>
                        <TicketManager
                            tiers={formData.tiers}
                            onChange={(tiers) => setFormData(prev => ({ ...prev, tiers }))}
                        />
                    </div>

                    {/* Settings */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 pt-4">Configuration</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Fee Bearer</label>
                                <div className="relative">
                                    <select
                                        name="fee_bearer"
                                        value={formData.fee_bearer}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fee_bearer: e.target.value as 'customer' | 'organizer' }))}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent focus:bg-white transition-all outline-none font-medium appearance-none"
                                    >
                                        <option value="customer">Customer (Pass fees)</option>
                                        <option value="organizer">Organizer (Absorb fees)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Choose who pays the processing fees.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 border-t flex items-center justify-end gap-4">
                        <Link href="/dashboard/events">
                            <button type="button" className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:text-black hover:bg-gray-50 transition-colors">Cancel</button>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setShowPreview(true)}
                            className="px-6 py-3 rounded-xl font-bold text-black border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            Preview
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-black/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {loading ? 'Creating...' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div >

            <PreviewModal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                formData={formData}
                tiers={formData.tiers}
            />
        </div >
    )
}
