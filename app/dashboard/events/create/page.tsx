'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function CreateEventPage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        venue_name: '',
        venue_address: '',
        starts_at: '',
        ends_at: '',
        poster_url: '',
        video_url: '',
        latitude: null as number | null,
        longitude: null as number | null,
        slug: '',
        fee_bearer: 'customer' as 'customer' | 'organizer',
        platform_fee_percent: 5.0,
        organization_id: ''
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))

        // Auto-generate slug from title
        if (name === 'title' && !formData.slug) {
            setFormData(prev => ({
                ...prev,
                slug: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
            }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            if (!formData.organization_id) throw new Error('Organization profile not found')

            const { data, error } = await supabase
                .schema('gatepass')
                .from('events')
                .insert({
                    ...formData,
                    ends_at: formData.ends_at || null,
                    organizer_id: user.id, // Legacy: User Creator
                    organization_id: formData.organization_id, // New: Linked Organization
                    is_published: false // Default to draft
                })
                .select()
                .single()

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
        <div className="max-w-2xl mx-auto">
            <Link href="/dashboard/events" className="inline-flex items-center text-sm text-gray-500 hover:text-black mb-6">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Events
            </Link>

            <div className="bg-white p-8 rounded-xl border shadow-sm">
                <h1 className="text-2xl font-bold mb-8">Create New Event</h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Event Title</label>
                            <input
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                type="text"
                                required
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">URL Slug</label>
                            <div className="flex items-center">
                                <span className="bg-gray-50 border border-r-0 rounded-l-lg px-3 py-2 text-gray-500 text-sm">gatepass.com/events/</span>
                                <input
                                    name="slug"
                                    value={formData.slug}
                                    onChange={handleChange}
                                    type="text"
                                    required
                                    className="flex-1 px-4 py-2 border rounded-r-lg focus:ring-2 focus:ring-black focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={4}
                                required
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                            ></textarea>
                        </div>


                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Venue Name</label>
                                <input
                                    name="venue_name"
                                    value={formData.venue_name}
                                    onChange={handleChange}
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Venue Address</label>
                                <input
                                    name="venue_address"
                                    value={formData.venue_address}
                                    onChange={handleChange}
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Latitude (Optional)</label>
                                <input
                                    name="latitude"
                                    value={formData.latitude || ''}
                                    onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                    type="number"
                                    step="any"
                                    placeholder="e.g. 5.6037"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Longitude (Optional)</label>
                                <input
                                    name="longitude"
                                    value={formData.longitude || ''}
                                    onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                    type="number"
                                    step="any"
                                    placeholder="e.g. -0.1870"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                                />
                            </div>
                        </div>


                        <div className="pt-4 border-t">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Ticket Settings</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Fee Bearer</label>
                                    <p className="text-xs text-gray-500 mb-2">Who pays the platform fees?</p>
                                    <select
                                        name="fee_bearer"
                                        value={formData.fee_bearer}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fee_bearer: e.target.value as 'customer' | 'organizer' }))}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none bg-white"
                                    >
                                        <option value="customer">Customer (Ticket Price + Fees)</option>
                                        <option value="organizer">Organizer (Fees deducted from revenue)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Platform Fee (%)</label>
                                    <p className="text-xs text-gray-500 mb-2">Service charge per ticket</p>
                                    <input
                                        name="platform_fee_percent"
                                        value={formData.platform_fee_percent}
                                        onChange={(e) => setFormData(prev => ({ ...prev, platform_fee_percent: parseFloat(e.target.value) }))}
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Starts At</label>
                                <input
                                    name="starts_at"
                                    value={formData.starts_at}
                                    onChange={handleChange}
                                    type="datetime-local"
                                    required
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Ends At (Optional)</label>
                                <input
                                    name="ends_at"
                                    value={formData.ends_at}
                                    onChange={handleChange}
                                    type="datetime-local"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Poster URL</label>
                            <input
                                name="poster_url"
                                value={formData.poster_url}
                                onChange={handleChange}
                                type="url"
                                placeholder="https://..."
                                required
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Video URL (Optional)</label>
                            <input
                                name="video_url"
                                value={formData.video_url}
                                onChange={handleChange}
                                type="url"
                                placeholder="https://... (MP4 preferred)"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:outline-none"
                            />
                        </div>

                    </div>

                    <div className="pt-6 border-t flex justify-end gap-3">
                        <Link href="/dashboard/events">
                            <button type="button" className="px-6 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    )
}
