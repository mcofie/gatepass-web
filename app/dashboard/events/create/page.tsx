'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ArrowLeft, Check, ChevronRight, X, Plus } from 'lucide-react'
import Link from 'next/link'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { TicketManager } from '@/components/common/TicketManager'
import { TicketTier, LineupItem } from '@/types/gatepass'
import { PreviewModal } from '@/components/common/PreviewModal'
import { logActivity } from '@/app/actions/logger'
import { toast } from 'sonner'
import clsx from 'clsx'
import { PLATFORM_FEE_PERCENT } from '@/utils/fees'

const STEPS = [
    { id: 'basics', title: 'Basics', description: 'Name & Details' },
    { id: 'location', title: 'Time & Place', description: 'Vehicle & Date' },
    { id: 'media', title: 'Media', description: 'Photos & Videos' },
    { id: 'lineup', title: 'Lineup', description: 'Speakers & Artists' },
    { id: 'tickets', title: 'Tickets', description: 'Admission & Pricing' },
    { id: 'review', title: 'Review', description: 'Finalize' }
]

export default function CreateEventPage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)

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
        logo_url: '',
        latitude: null as number | null,
        longitude: null as number | null,
        slug: '',
        fee_bearer: 'customer' as 'customer' | 'organizer',
        platform_fee_percent: PLATFORM_FEE_PERCENT * 100,
        organization_id: '',
        primary_color: '#000000',
        tiers: [] as Partial<TicketTier>[],
        lineup: [] as LineupItem[]
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
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    // Lineup Management
    const [newLineupItem, setNewLineupItem] = useState<LineupItem>({ name: '', role: '', image_url: '' })
    const [isAddingLineup, setIsAddingLineup] = useState(false)

    const addLineupItem = () => {
        if (!newLineupItem.name || !newLineupItem.role) {
            toast.error('Name and Role are required')
            return
        }
        setFormData(prev => ({ ...prev, lineup: [...(prev.lineup || []), newLineupItem] }))
        setNewLineupItem({ name: '', role: '', image_url: '' })
        setIsAddingLineup(false)
    }

    const removeLineupItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            lineup: (prev.lineup || []).filter((_, i) => i !== index)
        }))
    }

    const validateStep = (step: number) => {
        switch (step) {
            case 0: // Basics
                if (!formData.title) { toast.error('Event title is required'); return false }
                if (!formData.slug) { toast.error('URL slug is required'); return false }
                if (slugStatus === 'taken') { toast.error('URL slug is already taken'); return false }
                return true
            case 1: // Location
                if (!formData.venue_name) { toast.error('Venue name is required'); return false }
                if (!formData.venue_address) { toast.error('Address is required'); return false }
                if (!formData.starts_at) { toast.error('Start date is required'); return false }
                return true
            case 2: // Media
                if (!formData.poster_url) { toast.error('Event poster is required'); return false }
                if (!formData.video_url) { toast.error('Event trailer/teaser is required'); return false }
                return true
            case 3: // Lineup (Optional)
                return true
            default:
                return true
        }
    }

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(c => Math.min(c + 1, STEPS.length - 1))
        }
    }

    const prevStep = () => {
        setCurrentStep(c => Math.max(c - 1, 0))
    }

    const handleSubmit = async () => {
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            if (!formData.organization_id) throw new Error('Organization profile not found')

            // Ensure profile exists to satisfy FK
            const { data: profile } = await supabase.schema('gatepass').from('profiles').select('id').eq('id', user.id).single()

            if (!profile) {
                await supabase.schema('gatepass').from('profiles').insert({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || '',
                    updated_at: new Date().toISOString()
                })
            }

            const { tiers, ...eventData } = formData

            const { data, error } = await supabase
                .schema('gatepass')
                .from('events')
                .insert({
                    ...eventData,
                    starts_at: formData.starts_at?.toISOString(),
                    ends_at: formData.ends_at?.toISOString() || null,
                    organizer_id: user.id,
                    organization_id: formData.organization_id,
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

            // Log Activity
            await logActivity(formData.organization_id, 'create_event', 'event', data.id, { title: data.title })

            router.push(`/dashboard/events/${data.id}`)
        } catch (e: any) {
            toast.error('Error creating event: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto py-8 font-sans">
            <Link href="/dashboard/events" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-black mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Link>

            <div className="flex gap-8 items-start">

                {/* Steps Sidebar */}
                <div className="hidden md:block w-64 shrink-0 space-y-1">
                    {STEPS.map((step, index) => {
                        const isActive = index === currentStep
                        const isPast = index < currentStep

                        return (
                            <div key={step.id}
                                className={clsx("flex items-center gap-3 p-3 rounded-xl transition-all", {
                                    'bg-white dark:bg-[#111] shadow-sm border border-gray-100 dark:border-white/10': isActive,
                                    'text-gray-400 dark:text-gray-500': !isActive && !isPast,
                                    'text-black dark:text-white': isActive || isPast
                                })}
                            >
                                <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all", {
                                    'bg-black text-white dark:bg-white dark:text-black': isActive,
                                    'bg-green-500 text-white': isPast,
                                    'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-500': !isActive && !isPast
                                })}>
                                    {isPast ? <Check className="w-4 h-4" /> : index + 1}
                                </div>
                                <div>
                                    <div className={clsx("text-sm font-bold", isActive ? "text-black dark:text-white" : "text-gray-500 dark:text-gray-400")}>{step.title}</div>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">{step.description}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Main Form Area */}
                <div className="flex-1 bg-white dark:bg-[#111] p-10 rounded-3xl border border-gray-100 dark:border-white/10 shadow-[0_2px_40px_rgba(0,0,0,0.04)] min-h-[600px] flex flex-col relative">

                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{STEPS[currentStep].title}</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Step {currentStep + 1} of {STEPS.length}</p>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1">
                        {/* STEP 1: BASICS */}
                        {currentStep === 0 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Event Title</label>
                                    <input
                                        name="title"
                                        value={formData.title}
                                        onChange={handleChange}
                                        type="text"
                                        autoFocus
                                        required
                                        placeholder="e.g. Summer Music Festival 2024"
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent focus:bg-white dark:focus:bg-[#111] transition-all outline-none font-medium text-gray-900 dark:text-white dark:placeholder-gray-600"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">URL Slug</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center relative">
                                            <span className="bg-gray-100 dark:bg-white/10 border border-r-0 border-gray-200 dark:border-white/10 rounded-l-xl px-4 py-3 text-gray-500 dark:text-gray-400 text-sm font-medium">gatepass.com/events/</span>
                                            <input
                                                name="slug"
                                                value={formData.slug}
                                                onChange={handleChange}
                                                type="text"
                                                required
                                                className={`flex-1 px-4 py-3 bg-gray-50 dark:bg-white/5 border rounded-r-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent focus:bg-white dark:focus:bg-[#111] transition-all outline-none font-medium dark:text-white ${slugStatus === 'taken' ? 'border-red-300 text-red-600 focus:ring-red-200' :
                                                    slugStatus === 'available' ? 'border-green-300 text-green-700 dark:text-green-400 focus:ring-green-200' :
                                                        'border-gray-200 dark:border-white/10'
                                                    }`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                {slugStatus === 'checking' && <div className="w-4 h-4 border-2 border-gray-200 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleGenerateSlug}
                                            className="px-4 py-3 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-600 dark:text-gray-300 rounded-xl font-medium text-sm transition-colors whitespace-nowrap"
                                        >
                                            Generate
                                        </button>
                                    </div>
                                    {slugStatus === 'taken' && <p className="text-xs text-red-500 mt-1.5 font-medium">This slug is already taken.</p>}
                                    {slugStatus === 'available' && formData.slug && <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 font-medium">Slug available!</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</label>
                                    <RichTextEditor
                                        value={formData.description}
                                        onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                                        placeholder="Tell people what your event is about..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* STEP 2: LOCATION */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Venue Name</label>
                                        <input
                                            name="venue_name"
                                            value={formData.venue_name}
                                            onChange={handleChange}
                                            type="text"
                                            required
                                            placeholder="e.g. The Grand Arena"
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent focus:bg-white dark:focus:bg-[#111] transition-all outline-none font-medium text-gray-900 dark:text-white dark:placeholder-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Address</label>
                                        <input
                                            name="venue_address"
                                            value={formData.venue_address}
                                            onChange={handleChange}
                                            type="text"
                                            required
                                            placeholder="e.g. 123 Main St, Accra"
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent focus:bg-white dark:focus:bg-[#111] transition-all outline-none font-medium text-gray-900 dark:text-white dark:placeholder-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Latitude (Optional)</label>
                                        <input
                                            name="latitude"
                                            value={formData.latitude || ''}
                                            onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                            type="number"
                                            step="any"
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent focus:bg-white dark:focus:bg-[#111] transition-all outline-none font-medium text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Longitude (Optional)</label>
                                        <input
                                            name="longitude"
                                            value={formData.longitude || ''}
                                            onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                            type="number"
                                            step="any"
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent focus:bg-white dark:focus:bg-[#111] transition-all outline-none font-medium text-gray-900 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Starts At</label>
                                        <DateTimePicker
                                            date={formData.starts_at}
                                            setDate={(date) => setFormData(prev => ({ ...prev, starts_at: date }))}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ends At (Optional)</label>
                                        <DateTimePicker
                                            date={formData.ends_at}
                                            setDate={(date) => setFormData(prev => ({ ...prev, ends_at: date }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: MEDIA */}
                        {currentStep === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="grid gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Poster URL</label>
                                        <MediaUploader
                                            type="image"
                                            path={`${formData.organization_id}/uploads`}
                                            value={formData.poster_url}
                                            onChange={(url) => setFormData(prev => ({ ...prev, poster_url: url }))}
                                        />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                            Recommended: 1080x1350px (4:5) or 1080x1920px (9:16). Max 5MB.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Event Trailer/Teaser (Required)</label>
                                        <MediaUploader
                                            type="video"
                                            path={`${formData.organization_id}/uploads`}
                                            value={formData.video_url}
                                            onChange={(url) => setFormData(prev => ({ ...prev, video_url: url }))}
                                        />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                            Short teaser video (15-30s). Max 50MB. Will be auto-optimized to WebM.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Event Logo (Optional)</label>
                                        <div className="flex items-start gap-6">
                                            <div className="w-32 shrink-0">
                                                <MediaUploader
                                                    type="image"
                                                    path={`${formData.organization_id}/uploads`}
                                                    value={formData.logo_url}
                                                    onChange={(url) => setFormData(prev => ({ ...prev, logo_url: url }))}
                                                    className="!rounded-full !aspect-square"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex-1">
                                                Displayed on ticket cards and receipts. Square image recommended (e.g. 500x500px).
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Event Theme Color</label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                name="primary_color"
                                                value={formData.primary_color}
                                                onChange={handleChange}
                                                type="color"
                                                className="w-12 h-12 p-1 rounded-xl cursor-pointer bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10"
                                            />
                                            <input
                                                name="primary_color"
                                                value={formData.primary_color}
                                                onChange={handleChange}
                                                type="text"
                                                placeholder="#000000"
                                                className="w-32 px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all outline-none font-medium uppercase text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: LINEUP */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex items-start gap-8">
                                    {/* List */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold text-gray-900 dark:text-white">Current Lineup</div>
                                            <button
                                                onClick={() => setIsAddingLineup(true)}
                                                className="text-xs font-bold text-black dark:text-white hover:underline flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" /> Add Artist
                                            </button>
                                        </div>

                                        {(formData.lineup || []).length === 0 ? (
                                            <div className="p-8 border border-dashed border-gray-200 dark:border-white/10 rounded-xl text-center">
                                                <p className="text-sm text-gray-500 dark:text-gray-400">No artists added yet.</p>
                                                <button onClick={() => setIsAddingLineup(true)} className="mt-2 text-sm font-bold text-black dark:text-white hover:underline">Add One</button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {(formData.lineup || []).map((item, index) => (
                                                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 group">
                                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden shrink-0">
                                                            {item.image_url ? (
                                                                <img src={item.image_url} className="w-full h-full object-cover" alt={item.name} />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                                                                    {item.name.charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="font-bold text-sm text-gray-900 dark:text-white">{item.name}</div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">{item.role}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => removeLineupItem(index)}
                                                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-all"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Add Form */}
                                    {isAddingLineup && (
                                        <div className="w-80 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl space-y-4">
                                            <h4 className="font-bold text-sm text-gray-900 dark:text-white">Add Performer</h4>
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
                                                <input
                                                    value={newLineupItem.name}
                                                    onChange={e => setNewLineupItem(p => ({ ...p, name: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg text-sm"
                                                    placeholder="Artist Name"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Role</label>
                                                <input
                                                    value={newLineupItem.role}
                                                    onChange={e => setNewLineupItem(p => ({ ...p, role: e.target.value }))}
                                                    className="w-full mt-1 px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg text-sm"
                                                    placeholder="DJ, Host, etc."
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Photo</label>
                                                <div className="mt-1">
                                                    <MediaUploader
                                                        type="image"
                                                        path={`${formData.organization_id}/lineup/${Math.random().toString(36).substring(7)}`}
                                                        value={newLineupItem.image_url || ''}
                                                        onChange={url => setNewLineupItem(p => ({ ...p, image_url: url }))}
                                                        className="!h-32"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => setIsAddingLineup(false)}
                                                    className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={addLineupItem}
                                                    className="flex-1 py-2 text-xs font-bold bg-black dark:bg-white text-white dark:text-black rounded-lg"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* STEP 5: TICKETS */}
                        {currentStep === 4 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <TicketManager
                                    tiers={formData.tiers}
                                    onChange={(tiers) => setFormData(prev => ({ ...prev, tiers }))}
                                />
                            </div>
                        )}

                        {/* STEP 6: REVIEW */}
                        {currentStep === 5 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-2xl border border-gray-100 dark:border-white/10 space-y-4">
                                    <h4 className="font-bold text-gray-900 dark:text-white">Event Summary</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-500 dark:text-gray-400">Title</p>
                                            <p className="font-medium text-gray-900 dark:text-white">{formData.title}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 dark:text-gray-400">Venue</p>
                                            <p className="font-medium text-gray-900 dark:text-white">{formData.venue_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 dark:text-gray-400">Start Date</p>
                                            <p className="font-medium text-gray-900 dark:text-white">{formData.starts_at?.toLocaleDateString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 dark:text-gray-400">Ticket Tiers</p>
                                            <p className="font-medium text-gray-900 dark:text-white">{formData.tiers.length}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 dark:text-gray-400">Lineup</p>
                                            <p className="font-medium text-gray-900 dark:text-white">{(formData.lineup || []).length} artists</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Fee Bearer</label>
                                    <div className="relative">
                                        <select
                                            name="fee_bearer"
                                            value={formData.fee_bearer}
                                            onChange={(e) => setFormData(prev => ({ ...prev, fee_bearer: e.target.value as 'customer' | 'organizer' }))}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent focus:bg-white dark:focus:bg-[#111] transition-all outline-none font-medium appearance-none text-gray-900 dark:text-white"
                                        >
                                            <option value="customer" className="dark:bg-[#111]">Customer (Pass fees)</option>
                                            <option value="organizer" className="dark:bg-[#111]">Organizer (Absorb fees)</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer / Navigation */}
                    <div className="pt-8 mt-4 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
                        {currentStep > 0 ? (
                            <button
                                onClick={prevStep}
                                className="px-6 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                            >
                                Back
                            </button>
                        ) : (
                            <Link href="/dashboard/events">
                                <button
                                    className="px-6 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                            </Link>
                        )}

                        <div className="flex gap-4">
                            {currentStep === 5 && (
                                <button
                                    type="button"
                                    onClick={() => setShowPreview(true)}
                                    className="px-6 py-3 rounded-xl font-bold text-black dark:text-white border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    Preview
                                </button>
                            )}

                            {currentStep < 5 ? (
                                <button
                                    onClick={nextStep}
                                    className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-lg shadow-black/20 dark:shadow-none flex items-center gap-2"
                                >
                                    Next <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-lg shadow-black/20 dark:shadow-none flex items-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Event'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <PreviewModal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                formData={formData}
                tiers={formData.tiers}
            />
        </div>
    )
}
