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
    { id: 'basics', title: 'Basics', description: 'Name and description' },
    { id: 'location', title: 'Date & location', description: 'When and where' },
    { id: 'media', title: 'Media', description: 'Images and video' },
    { id: 'lineup', title: 'Lineup', description: 'Artists and speakers' },
    { id: 'tickets', title: 'Tickets', description: 'Pricing and capacity' },
    { id: 'review', title: 'Review', description: 'Check and create' }
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
        payment_gateway: 'paystack' as 'paystack',
        sales_enabled: true,
        platform_fee_percent: PLATFORM_FEE_PERCENT,
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
                const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + crypto.randomUUID().split('-')[0]

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
                    perks: tier.perks || [],
                    tags: tier.tags || []
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
        <div className="mx-auto max-w-[1180px] pb-28 font-sans md:pb-16">
            <Link href="/dashboard/events" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-black dark:text-gray-400 dark:hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Events
            </Link>
            <div className="mb-8">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">New event</p>
                <h1 className="text-[32px] font-semibold tracking-tight text-gray-950 dark:text-white sm:text-[38px]">Create event</h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Add the essentials first. You can review everything before creating the event.</p>
            </div>

            <div className="grid items-start gap-6 md:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">

                {/* Steps Sidebar */}
                <div className="hidden space-y-1 md:block">
                    {STEPS.map((step, index) => {
                        const isActive = index === currentStep
                        const isPast = index < currentStep

                        return (
                            <div key={step.id}
                                className={clsx("flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors", {
                                    'bg-gray-100 dark:bg-white/10': isActive,
                                    'text-gray-400 dark:text-gray-500': !isActive && !isPast,
                                    'text-black dark:text-white': isActive || isPast
                                })}
                            >
                                <div className={clsx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", {
                                    'bg-black text-white dark:bg-white dark:text-black': isActive,
                                    'bg-gray-200 text-gray-700 dark:bg-white/15 dark:text-white': isPast,
                                    'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-500': !isActive && !isPast
                                })}>
                                    {isPast ? <Check className="w-4 h-4" /> : index + 1}
                                </div>
                                <div>
                                    <div className={clsx("text-sm font-medium", isActive ? "text-black dark:text-white" : "text-gray-500 dark:text-gray-400")}>{step.title}</div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500">{step.description}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Main Form Area */}
                <div className="relative flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] sm:p-7">

                    {/* Header */}
                    <div className="mb-7">
                        <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Step {currentStep + 1} of {STEPS.length}</p>
                        <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">{STEPS[currentStep].title}</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{STEPS[currentStep].description}</p>
                        <div className="mt-5 flex gap-1.5 md:hidden" aria-label={`Step ${currentStep + 1} of ${STEPS.length}`}>
                            {STEPS.map((step, index) => <span key={step.id} className={`h-1 flex-1 rounded-full ${index <= currentStep ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-white/10'}`} />)}
                        </div>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1">
                        {/* STEP 1: BASICS */}
                        {currentStep === 0 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label htmlFor="event-title" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Event name</label>
                                    <input
                                        id="event-title"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleChange}
                                        type="text"
                                        autoFocus
                                        required
                                        placeholder="e.g. 99 Problems"
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent focus:bg-white dark:focus:bg-[#111] transition-all outline-none font-medium text-gray-900 dark:text-white dark:placeholder-gray-600"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="event-slug" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Event link</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center relative">
                                            <span className="hidden rounded-l-xl border border-r-0 border-gray-200 bg-gray-100 px-4 py-3 text-sm font-medium text-gray-500 dark:border-white/10 dark:bg-white/10 dark:text-gray-400 sm:block">gatepass.so/events/</span>
                                            <input
                                                id="event-slug"
                                                name="slug"
                                                value={formData.slug}
                                                onChange={handleChange}
                                                type="text"
                                                required
                                                className={`min-w-0 flex-1 rounded-xl border bg-gray-50 px-4 py-3 font-medium outline-none transition-colors focus:border-gray-500 dark:bg-white/5 dark:text-white sm:rounded-l-none ${slugStatus === 'taken' ? 'border-red-300 text-red-600' :
                                                    slugStatus === 'available' ? 'border-gray-300 text-gray-900 dark:border-white/20 dark:text-white' :
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
                                            className="rounded-lg border border-gray-200 px-3 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                                        >
                                            Generate
                                        </button>
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 sm:hidden">gatepass.so/events/{formData.slug || 'your-event'}</p>
                                    {slugStatus === 'taken' && <p className="text-xs text-red-500 mt-1.5 font-medium">This slug is already taken.</p>}
                                    {slugStatus === 'available' && formData.slug && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Link available</p>}
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
                                        <label htmlFor="event-venue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Venue name</label>
                                        <input
                                            id="event-venue"
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
                                        <label htmlFor="event-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address</label>
                                        <input
                                            id="event-address"
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
                                        <label htmlFor="event-latitude" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Latitude (optional)</label>
                                        <input
                                            id="event-latitude"
                                            name="latitude"
                                            value={formData.latitude || ''}
                                            onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                            type="number"
                                            step="any"
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent focus:bg-white dark:focus:bg-[#111] transition-all outline-none font-medium text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="event-longitude" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Longitude (optional)</label>
                                        <input
                                            id="event-longitude"
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
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Starts at</label>
                                        <DateTimePicker
                                            date={formData.starts_at}
                                            setDate={(date) => setFormData(prev => ({ ...prev, starts_at: date }))}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ends at (optional)</label>
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
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Event poster</label>
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
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Event video</label>
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
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Event logo (optional)</label>
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
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Accent color</label>
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
                                                        path={`${formData.organization_id}/lineup/${crypto.randomUUID()}`}
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
                            </div>
                        )}
                    </div>

                    {/* Footer / Navigation */}
                    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-[#111] md:static md:mt-8 md:border-gray-100 md:bg-transparent md:px-0 md:pb-0 md:pt-5 dark:md:bg-transparent">
                        {currentStep > 0 ? (
                            <button
                                onClick={prevStep}
                                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-black dark:text-gray-400 dark:hover:text-white"
                            >
                                Back
                            </button>
                        ) : (
                            <Link href="/dashboard/events" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-black dark:text-gray-400 dark:hover:text-white">Cancel</Link>
                        )}

                        <div className="flex gap-2">
                            {currentStep === 5 && (
                                <button
                                    type="button"
                                    onClick={() => setShowPreview(true)}
                                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                                >
                                    Preview
                                </button>
                            )}

                            {currentStep < 5 ? (
                                <button
                                    onClick={nextStep}
                                    className="flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
                                >
                                    Next <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50 dark:bg-white dark:text-black"
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
