'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { PreviewModal } from '@/components/common/PreviewModal'
import { logActivity } from '@/app/actions/logger'
import { getActiveOrganization, type ActiveOrganization } from '@/app/actions/organization'
import { getDefaultPaymentProvider } from '@/app/actions/integrations'
import { getManagedPaymentsSetup, type ManagedPaymentsSetup } from '@/app/actions/managed-payments'
import { PayoutAccountForm } from '@/components/payments/PayoutAccountForm'
import { CURRENCY_NAMES, getProvider } from '@/lib/integrations/providers'
import { Field, PrimaryButton, SecondaryButton, inputClass } from '@/components/dashboard/ui'
import { formatCurrency } from '@/utils/format'
import { priceIn } from '@/lib/billing/prices'
import type { TicketTier } from '@/types/gatepass'

const STEPS = [
    { title: 'Details', heading: 'What and when.', lede: 'The essentials. Everything can be changed later.' },
    { title: 'Look', heading: 'Make it yours.', lede: 'A poster and a few lines go a long way. Video and logo are optional.' },
    { title: 'Tickets', heading: 'Set your tickets.', lede: 'Add the ticket types you’ll sell. Descriptions, perks and limits can be added later.' },
    { title: 'Review', heading: 'Ready to create.', lede: 'Your event is saved as a draft. Publish it from the event page when you’re ready.' },
]

const ACCENTS = ['#0D0D0D', '#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#16A34A', '#0891B2']

type TicketDraft = { key: string; name: string; price: string; quantity: string }

type Draft = {
    title: string
    slug: string
    slugEdited: boolean
    starts_at: string | null
    ends_at: string | null
    venue_name: string
    venue_address: string
    description: string
    poster_url: string
    video_url: string
    video_url_portrait: string
    logo_url: string
    primary_color: string
    currency: string
    tickets: TicketDraft[]
}

type PlanTier = { name: string; max_tickets: number | null; price_minor: number; currency: string; prices?: Record<string, number> | null }

const newTicket = (name = '', price = '', quantity = '100'): TicketDraft => ({ key: crypto.randomUUID(), name, price, quantity })

const emptyDraft = (): Draft => ({
    title: '', slug: '', slugEdited: false, starts_at: null, ends_at: null, venue_name: '', venue_address: '',
    description: '', poster_url: '', video_url: '', video_url_portrait: '', logo_url: '', primary_color: ACCENTS[0], currency: 'GHS',
    tickets: [newTicket('General admission')],
})

const toSlug = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)

const pad = (n: number) => String(n).padStart(2, '0')
const storageKey = (orgId: string) => `gatepass:create-event:${orgId}`

export default function CreateEventPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const [org, setOrg] = useState<ActiveOrganization | null>(null)
    const [draft, setDraft] = useState<Draft>(emptyDraft)
    const [step, setStep] = useState(0)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
    const [editingSlug, setEditingSlug] = useState(false)
    const [showMore, setShowMore] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [creating, setCreating] = useState(false)
    const [plans, setPlans] = useState<PlanTier[]>([])
    // Currencies the workspace's default payment provider can charge in (all, if none connected yet)
    const [providerId, setProviderId] = useState<string | null>(null)
    // GatePass Payments terms, for organizers paid through GatePass or choosing how to get paid
    const [managed, setManaged] = useState<ManagedPaymentsSetup | null>(null)
    const restored = useRef(false)
    // Rounded to the next minute: the earliest an event can start
    const [now] = useState(() => new Date(Math.ceil(Date.now() / 60000) * 60000))

    // Workspace, pricing plans and any saved draft
    useEffect(() => {
        getActiveOrganization().then(active => {
            if (!active) { router.replace('/onboarding'); return }
            if (active.role === 'Staff') { toast.error('Only owners and admins can create events'); router.replace('/dashboard/events'); return }
            setOrg(active)
            getDefaultPaymentProvider(active.id).then(id => {
                setProviderId(id)
                const supported = id ? getProvider('payments', id)?.currencies : undefined
                // Start in a currency the provider accepts
                if (supported?.length) setDraft(d => (supported.includes(d.currency) ? d : { ...d, currency: supported[0] }))
            }).catch(() => {})
            getManagedPaymentsSetup(active.id).then(setManaged).catch(() => setManaged(null))
            try {
                const saved = localStorage.getItem(storageKey(active.id))
                if (saved) {
                    setDraft({ ...emptyDraft(), ...JSON.parse(saved) })
                    toast('Picked up where you left off', { action: { label: 'Start over', onClick: () => { localStorage.removeItem(storageKey(active.id)); setDraft(emptyDraft()); setStep(0) } } })
                }
            } catch { /* storage unavailable */ }
            restored.current = true
        })
        supabase.schema('gatepass').from('platform_pricing_tiers').select('name, max_tickets, price_minor, currency, prices').eq('is_active', true).order('sort_order')
            .then(({ data }) => setPlans((data ?? []) as PlanTier[]))
    }, [router, supabase])

    // Keep a local copy so a refresh never loses work
    useEffect(() => {
        if (!org || !restored.current) return
        const timer = setTimeout(() => {
            try { localStorage.setItem(storageKey(org.id), JSON.stringify(draft)) } catch { /* storage unavailable */ }
        }, 400)
        return () => clearTimeout(timer)
    }, [draft, org])

    // Link availability
    useEffect(() => {
        if (!draft.slug) { setSlugStatus('idle'); return }
        setSlugStatus('checking')
        const timer = setTimeout(async () => {
            const { data } = await supabase.schema('gatepass').from('events').select('id').eq('slug', draft.slug).maybeSingle()
            setSlugStatus(data ? 'taken' : 'available')
        }, 400)
        return () => clearTimeout(timer)
    }, [draft.slug, supabase])

    const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
        setErrors(e => { const next = { ...e }; delete next[key as string]; return next })
        setDraft(d => ({
            ...d,
            [key]: value,
            // The link follows the name until it's edited by hand
            ...(key === 'title' && !d.slugEdited ? { slug: toSlug(value as string) } : {}),
        }))
    }

    const updateTicket = (key: string, patch: Partial<TicketDraft>) => {
        setErrors(e => { const next = { ...e }; delete next.tickets; return next })
        setDraft(d => ({ ...d, tickets: d.tickets.map(t => (t.key === key ? { ...t, ...patch } : t)) }))
    }

    const startsAt = draft.starts_at ? new Date(draft.starts_at) : undefined
    const endsAt = draft.ends_at ? new Date(draft.ends_at) : undefined
    const capacity = draft.tickets.reduce((sum, t) => sum + (parseInt(t.quantity, 10) || 0), 0)
    const plan = useMemo(
        () => plans.filter(p => p.max_tickets === null || p.max_tickets >= capacity).sort((a, b) => (a.max_tickets ?? Infinity) - (b.max_tickets ?? Infinity))[0],
        [plans, capacity],
    )
    const hasPaidTickets = draft.tickets.some(t => Number(t.price) > 0)
    // Gross if every ticket sells, for the "what you keep" estimate
    const potential = draft.tickets.reduce((sum, t) => sum + (Number(t.price) || 0) * (parseInt(t.quantity, 10) || 0), 0)
    const gettingPaid = (
        <GettingPaid
            orgId={org?.id ?? ''}
            providerId={providerId}
            managed={managed}
            plan={plan}
            capacity={capacity}
            hasPaidTickets={hasPaidTickets}
            currency={draft.currency}
            potential={potential}
            onManagedReady={() => {
                setProviderId('gatepass')
                const supported = getProvider('payments', 'gatepass')?.currencies
                if (supported?.length && !supported.includes(draft.currency)) update('currency', supported[0])
            }}
        />
    )

    const validate = (index: number): boolean => {
        const next: Record<string, string> = {}
        if (index === 0) {
            if (!draft.title.trim()) next.title = 'Give your event a name.'
            if (!draft.slug) next.slug = 'Add a link for your event.'
            else if (slugStatus === 'taken') next.slug = 'That link is taken. Edit it to continue.'
            if (!startsAt) next.starts_at = 'Choose when it starts.'
            else if (startsAt.getTime() < Date.now()) next.starts_at = 'The start time is in the past.'
            if (endsAt && startsAt && endsAt <= startsAt) next.ends_at = 'It has to end after it starts.'
            if (!draft.venue_name.trim()) next.venue_name = 'Add the venue.'
        }
        if (index === 2) {
            const problem = draft.tickets.find(t => !t.name.trim() || !(parseInt(t.quantity, 10) > 0) || Number(t.price) < 0 || Number.isNaN(Number(t.price || 0)))
            if (draft.tickets.length === 0) next.tickets = 'Add at least one ticket type.'
            else if (problem) next.tickets = 'Each ticket type needs a name, a price (0 for free) and a quantity.'
        }
        setErrors(next)
        if (next.slug && index === 0) setEditingSlug(true)
        return Object.keys(next).length === 0
    }

    const goTo = (index: number) => {
        // Moving forward checks every step in between
        for (let i = step; i < index; i++) if (!validate(i)) { setStep(i); return }
        setErrors({})
        setStep(index)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault()
        if (step < STEPS.length - 1) goTo(step + 1)
        else handleCreate()
    }

    const handleCreate = async () => {
        if (!org) return
        for (let i = 0; i < STEPS.length - 1; i++) if (!validate(i)) { setStep(i); return }
        setCreating(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Your session expired. Please sign in again.')

            const { data: event, error } = await supabase.schema('gatepass').from('events').insert({
                title: draft.title.trim(),
                slug: draft.slug,
                description: draft.description,
                starts_at: startsAt!.toISOString(),
                ends_at: endsAt?.toISOString() ?? null,
                venue_name: draft.venue_name.trim(),
                venue_address: draft.venue_address.trim() || null,
                poster_url: draft.poster_url || null,
                video_url: draft.video_url || null,
                video_url_portrait: draft.video_url_portrait || null,
                logo_url: draft.logo_url || null,
                primary_color: draft.primary_color,
                currency: draft.currency,
                organization_id: org.id,
                organizer_id: user.id,
                is_published: false,
                sales_enabled: true,
                lineup: [],
            }).select('id, title').single()

            if (error) {
                if (error.code === '23505') {
                    setSlugStatus('taken')
                    setStep(0)
                    setEditingSlug(true)
                    setErrors({ slug: 'That link was just taken. Choose another.' })
                    return
                }
                throw error
            }

            const tiers: Partial<TicketTier>[] = draft.tickets.map((t, i) => ({
                event_id: event.id,
                name: t.name.trim(),
                price: Number(t.price) || 0,
                total_quantity: parseInt(t.quantity, 10),
                currency: draft.currency,
                quantity_sold: 0,
                sort_order: i,
                perks: [],
                tags: [],
            }))
            const { error: tiersError } = await supabase.schema('gatepass').from('ticket_tiers').insert(tiers)
            if (tiersError) toast.error(`Event created, but tickets couldn’t be saved: ${tiersError.message}. Add them on the event page.`)

            await logActivity(org.id, 'create_event', 'event', event.id, { title: event.title })
            try { localStorage.removeItem(storageKey(org.id)) } catch { /* storage unavailable */ }
            toast.success('Draft created')
            router.push(`/dashboard/events/${event.id}`)
        } catch (error) {
            // Supabase errors are plain objects, not Error instances: still show their message
            const message = error instanceof Error ? error.message : (error as { message?: string } | null)?.message
            toast.error(message ? `Could not create the event: ${message}` : 'Could not create the event')
        } finally {
            setCreating(false)
        }
    }

    if (!org) {
        return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-5 animate-spin text-gray-400" aria-label="Loading" /></div>
    }

    const current = STEPS[step]
    const errorText = (key: string) => errors[key] ? <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{errors[key]}</p> : null
    const invalid = (key: string) => (errors[key] ? 'border-red-400 focus:border-red-500 dark:border-red-500/60' : '')

    return (
        <div className="mx-auto max-w-[1080px] pb-32 md:pb-16">
            <Link href="/dashboard/events" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-950 dark:text-gray-400 dark:hover:text-white">
                <ArrowLeft className="size-4" aria-hidden="true" /> Events
            </Link>

            <div className="mt-8 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
                <aside>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">New event · {org.name}</p>
                    <ol className="mt-6 hidden border-t border-gray-200 dark:border-white/10 lg:block" aria-label="Steps">
                        {STEPS.map((s, i) => {
                            const state = i === step ? 'current' : i < step ? 'done' : 'todo'
                            return (
                                <li key={s.title} className="border-b border-gray-200 dark:border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => goTo(i)}
                                        aria-current={state === 'current' ? 'step' : undefined}
                                        className="flex w-full items-center gap-4 py-4 text-left"
                                    >
                                        <span className={`w-6 font-mono text-sm tabular-nums ${state === 'todo' ? 'text-gray-300 dark:text-gray-600' : 'text-gray-950 dark:text-white'}`}>{pad(i + 1)}</span>
                                        <span className={`flex-1 text-[15px] font-medium ${state === 'todo' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-950 dark:text-white'}`}>{s.title}</span>
                                        {state === 'done' && <Check className="size-4 text-gray-950 dark:text-white" aria-label="Done" />}
                                        {state === 'current' && <span className="size-2 rounded-full bg-gray-950 dark:bg-white" aria-hidden="true" />}
                                    </button>
                                </li>
                            )
                        })}
                    </ol>
                    <div className="mt-4 flex gap-1.5 lg:hidden" aria-label={`Step ${step + 1} of ${STEPS.length}: ${current.title}`}>
                        {STEPS.map((s, i) => <span key={s.title} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-gray-950 dark:bg-white' : 'bg-gray-200 dark:bg-white/10'}`} />)}
                    </div>
                </aside>

                <form onSubmit={handleNext} noValidate className="min-w-0">
                    <p className="hidden font-mono text-sm tabular-nums text-gray-400 lg:block">{pad(step + 1)}</p>
                    <h1 className="mt-2 text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] text-gray-950 dark:text-white sm:text-[42px]">{current.heading}</h1>
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-gray-500 dark:text-gray-400">{current.lede}</p>

                    <div className="mt-10 space-y-7">
                        {step === 0 && (
                            <>
                                <Field label="Event name" htmlFor="event-title">
                                    <input id="event-title" autoFocus value={draft.title} onChange={e => update('title', e.target.value)} placeholder="e.g. The Night Session" className={`${inputClass} h-12 text-base ${invalid('title')}`} aria-invalid={!!errors.title} />
                                    {errorText('title')}
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                        {editingSlug ? (
                                            <div className="flex w-full items-center gap-2">
                                                <span className="shrink-0 text-gray-500 dark:text-gray-400">gatepass.so/events/</span>
                                                <input
                                                    aria-label="Event link"
                                                    value={draft.slug}
                                                    // Lenient while typing so dashes can be entered; tidied on Done
                                                    onChange={e => setDraft(d => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').slice(0, 64), slugEdited: true }))}
                                                    onBlur={() => setDraft(d => ({ ...d, slug: toSlug(d.slug) }))}
                                                    className={`${inputClass} h-9 flex-1 text-sm ${invalid('slug')}`}
                                                    spellCheck={false}
                                                    autoCapitalize="none"
                                                />
                                                <button type="button" onClick={() => { setDraft(d => ({ ...d, slug: toSlug(d.slug) })); setEditingSlug(false) }} className="shrink-0 text-sm font-medium text-gray-950 underline underline-offset-4 dark:text-white">Done</button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-gray-500 dark:text-gray-400">gatepass.so/events/<span className="text-gray-950 dark:text-white">{draft.slug || 'your-event'}</span></span>
                                                <button type="button" onClick={() => setEditingSlug(true)} className="font-medium text-gray-950 underline underline-offset-4 dark:text-white">Edit link</button>
                                            </>
                                        )}
                                        <span aria-live="polite" className="text-xs">
                                            {slugStatus === 'checking' && <span className="text-gray-400">Checking…</span>}
                                            {slugStatus === 'available' && draft.slug && <span className="text-emerald-600 dark:text-emerald-400">Available</span>}
                                            {slugStatus === 'taken' && <span className="text-red-600 dark:text-red-400">Taken</span>}
                                        </span>
                                    </div>
                                    {errorText('slug')}
                                </Field>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <Field label="Starts">
                                        <DateTimePicker date={startsAt} setDate={d => update('starts_at', d ? d.toISOString() : null)} required minDate={now} />
                                        {errorText('starts_at')}
                                    </Field>
                                    <Field label="Ends" optional>
                                        <DateTimePicker date={endsAt} setDate={d => update('ends_at', d ? d.toISOString() : null)} minDate={startsAt ?? now} />
                                        {errorText('ends_at')}
                                    </Field>
                                </div>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <Field label="Venue" htmlFor="event-venue">
                                        <input id="event-venue" value={draft.venue_name} onChange={e => update('venue_name', e.target.value)} placeholder="e.g. Untitled Lounge" className={`${inputClass} ${invalid('venue_name')}`} aria-invalid={!!errors.venue_name} />
                                        {errorText('venue_name')}
                                    </Field>
                                    <Field label="Address" htmlFor="event-address" optional hint="Helps guests find you on the map.">
                                        <input id="event-address" autoComplete="street-address" value={draft.venue_address} onChange={e => update('venue_address', e.target.value)} placeholder="e.g. 12 Oxford St, Osu, Accra" className={inputClass} />
                                    </Field>
                                </div>
                            </>
                        )}

                        {step === 1 && (
                            <>
                                <div className="grid gap-7 sm:grid-cols-[220px_1fr]">
                                    <Field label="Poster" hint="Portrait works best (4:5 or 9:16). Up to 5 MB.">
                                        <MediaUploader type="image" path={`${org.id}/uploads`} value={draft.poster_url} onChange={url => update('poster_url', url)} />
                                    </Field>
                                    <Field label="Description" optional>
                                        <RichTextEditor value={draft.description} onChange={value => update('description', value)} placeholder="What should guests expect?" />
                                    </Field>
                                </div>

                                <Field label="Accent colour" hint="Used for buttons on your event page.">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {ACCENTS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => update('primary_color', color)}
                                                aria-label={`Accent ${color}`}
                                                aria-pressed={draft.primary_color.toUpperCase() === color}
                                                className="flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-white transition-shadow aria-pressed:ring-2 aria-pressed:ring-gray-950 dark:ring-offset-black dark:aria-pressed:ring-white"
                                                style={{ backgroundColor: color }}
                                            >
                                                {draft.primary_color.toUpperCase() === color && <Check className="size-4 text-white" aria-hidden="true" />}
                                            </button>
                                        ))}
                                        <label className="relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-gray-300 text-gray-500 dark:border-white/20" title="Custom colour">
                                            <Plus className="size-4" aria-hidden="true" />
                                            <input type="color" value={draft.primary_color} onChange={e => update('primary_color', e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom accent colour" />
                                        </label>
                                    </div>
                                </Field>

                                <div className="border-t border-gray-200 pt-5 dark:border-white/10">
                                    <button type="button" onClick={() => setShowMore(v => !v)} aria-expanded={showMore} className="flex items-center gap-2 text-sm font-medium text-gray-950 dark:text-white">
                                        <ChevronDown className={`size-4 transition-transform ${showMore ? 'rotate-180' : ''}`} aria-hidden="true" />
                                        Video and event logo
                                    </button>
                                    {showMore && (
                                        <div className="mt-6 grid gap-7 sm:grid-cols-[1fr_160px]">
                                            <div className="space-y-4">
                                                <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">A 15–30 second teaser plays behind your event page. Add a landscape cut for desktop and a portrait cut for phones.</p>
                                                <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                                                    <Field label="Landscape · desktop">
                                                        <MediaUploader type="video" aspectRatio="video" expectOrientation="landscape" label="Add landscape video" path={`${org.id}/uploads`} value={draft.video_url} onChange={url => update('video_url', url)} />
                                                    </Field>
                                                    <Field label="Portrait · phone">
                                                        <div className="w-32 sm:w-full">
                                                            <MediaUploader type="video" aspectRatio="portrait" expectOrientation="portrait" label="Add portrait video" path={`${org.id}/uploads`} value={draft.video_url_portrait} onChange={url => update('video_url_portrait', url)} />
                                                        </div>
                                                    </Field>
                                                </div>
                                            </div>
                                            <Field label="Event logo" optional hint="Shown on tickets.">
                                                <MediaUploader type="image" aspectRatio="square" path={`${org.id}/uploads`} value={draft.logo_url} onChange={url => update('logo_url', url)} />
                                            </Field>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <Field label="Currency" htmlFor="event-currency" hint={providerId ? `Currencies ${getProvider('payments', providerId)?.name ?? 'your payment provider'} can charge in.` : 'Connect a payment provider in Settings to sell paid tickets.'}>
                                    <select id="event-currency" value={draft.currency} onChange={e => update('currency', e.target.value)} className={`${inputClass} sm:max-w-xs`}>
                                        {(getProvider('payments', providerId ?? '')?.currencies ?? Object.keys(CURRENCY_NAMES)).map(code => (
                                            <option key={code} value={code}>{code} · {CURRENCY_NAMES[code] ?? code}</option>
                                        ))}
                                    </select>
                                </Field>

                                <div className="flex flex-wrap gap-2">
                                    <span className="self-center text-xs text-gray-500 dark:text-gray-400">Start from:</span>
                                    {[
                                        { label: 'Free RSVP', tickets: [newTicket('Free entry', '0', '100')] },
                                        { label: 'General + VIP', tickets: [newTicket('General admission', '', '200'), newTicket('VIP', '', '50')] },
                                        { label: 'Early bird + Regular', tickets: [newTicket('Early bird', '', '100'), newTicket('Regular', '', '300')] },
                                    ].map(preset => (
                                        <button key={preset.label} type="button" onClick={() => update('tickets', preset.tickets)} className="h-8 rounded-full border border-gray-200 px-3 text-xs font-medium text-gray-700 transition-colors hover:border-gray-950 hover:text-gray-950 dark:border-white/10 dark:text-gray-300 dark:hover:border-white dark:hover:text-white">
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="overflow-hidden rounded-3xl border border-gray-200 dark:border-white/10">
                                    <div className="hidden grid-cols-[1fr_140px_120px_40px] gap-3 border-b border-gray-100 bg-gray-50 px-5 py-2.5 text-xs font-medium text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 sm:grid">
                                        <span>Ticket type</span><span>Price ({draft.currency})</span><span>Quantity</span><span />
                                    </div>
                                    <ul className="divide-y divide-gray-100 dark:divide-white/10">
                                        {draft.tickets.map((ticket, i) => (
                                            <li key={ticket.key} className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-[1fr_140px_120px_40px] sm:items-center">
                                                <input aria-label={`Ticket ${i + 1} name`} value={ticket.name} onChange={e => updateTicket(ticket.key, { name: e.target.value })} placeholder="e.g. General admission" className={`${inputClass} col-span-2 sm:col-span-1`} />
                                                <div className="relative">
                                                    <input aria-label={`Ticket ${i + 1} price`} inputMode="decimal" value={ticket.price} onChange={e => updateTicket(ticket.key, { price: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="0" className={inputClass} />
                                                    {Number(ticket.price || 0) === 0 && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-gray-400">Free</span>}
                                                </div>
                                                <input aria-label={`Ticket ${i + 1} quantity`} inputMode="numeric" value={ticket.quantity} onChange={e => updateTicket(ticket.key, { quantity: e.target.value.replace(/\D/g, '') })} placeholder="100" className={inputClass} />
                                                <button type="button" onClick={() => update('tickets', draft.tickets.filter(t => t.key !== ticket.key))} aria-label={`Remove ${ticket.name || `ticket ${i + 1}`}`} disabled={draft.tickets.length === 1} className="col-span-2 flex size-10 items-center justify-center justify-self-end rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-red-500/10 sm:col-span-1">
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    <button type="button" onClick={() => update('tickets', [...draft.tickets, newTicket()])} className="flex w-full items-center gap-2 border-t border-gray-100 px-5 py-3.5 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5">
                                        <Plus className="size-4" aria-hidden="true" /> Add ticket type
                                    </button>
                                </div>
                                {errorText('tickets')}

                                {gettingPaid}
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <div className="overflow-hidden rounded-3xl border border-gray-200 dark:border-white/10">
                                    <div className="flex gap-5 p-5 sm:p-6">
                                        <div className="h-28 w-[90px] shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            {draft.poster_url && <img src={draft.poster_url} alt="" className="h-full w-full object-cover" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xl font-semibold tracking-tight text-gray-950 dark:text-white">{draft.title}</p>
                                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                {startsAt?.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                {endsAt ? ` – ${endsAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{draft.venue_name}{draft.venue_address ? ` · ${draft.venue_address}` : ''}</p>
                                            <p className="mt-2 truncate text-xs text-gray-400">gatepass.so/events/{draft.slug}</p>
                                        </div>
                                    </div>
                                    <ReviewRow label="Look" onEdit={() => setStep(1)}>
                                        <span className="inline-flex items-center gap-2"><span className="size-3 rounded-full" style={{ backgroundColor: draft.primary_color }} />{[draft.poster_url ? 'Poster' : 'No poster yet', (draft.video_url || draft.video_url_portrait) && (draft.video_url && draft.video_url_portrait ? 'both videos' : 'video'), draft.logo_url && 'logo'].filter(Boolean).join(', ')}</span>
                                    </ReviewRow>
                                    <ReviewRow label="Tickets" onEdit={() => setStep(2)}>
                                        {draft.tickets.map(t => `${t.name} · ${Number(t.price) > 0 ? formatCurrency(Number(t.price), draft.currency) : 'Free'} × ${t.quantity}`).join('  /  ')}
                                    </ReviewRow>
                                    <ReviewRow label="Getting paid" onEdit={() => setStep(2)}>
                                        {!hasPaidTickets ? 'Free event'
                                            : providerId === 'gatepass' ? `GatePass Payments · ${managed?.terms.feePercent ?? 5}% per paid ticket`
                                                : providerId ? `${getProvider('payments', providerId)?.name ?? 'Your provider'} · 0% per ticket + one-time plan fee`
                                                    : 'Not set up yet. Needed before you publish paid tickets.'}
                                    </ReviewRow>
                                </div>
                                {gettingPaid}
                            </>
                        )}
                    </div>

                    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-black/90 md:static md:mt-12 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none dark:md:bg-transparent">
                        {step > 0
                            ? <SecondaryButton type="button" onClick={() => setStep(step - 1)}><ArrowLeft className="size-4" aria-hidden="true" /> Back</SecondaryButton>
                            : <Link href="/dashboard/events" className="px-2 text-sm font-medium text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white">Cancel</Link>}
                        <div className="flex items-center gap-2">
                            {step === STEPS.length - 1 && <SecondaryButton type="button" onClick={() => setShowPreview(true)}>Preview</SecondaryButton>}
                            <PrimaryButton type="submit" loading={creating} disabled={step === 0 && slugStatus === 'checking'}>
                                {step === STEPS.length - 1 ? 'Create draft' : <>Continue <ArrowRight className="size-4" aria-hidden="true" /></>}
                            </PrimaryButton>
                        </div>
                    </div>
                </form>
            </div>

            <PreviewModal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                formData={{
                    title: draft.title, description: draft.description, slug: draft.slug,
                    venue_name: draft.venue_name, venue_address: draft.venue_address,
                    starts_at: startsAt, ends_at: endsAt, poster_url: draft.poster_url, video_url: draft.video_url, video_url_portrait: draft.video_url_portrait,
                    logo_url: draft.logo_url, primary_color: draft.primary_color, latitude: null, longitude: null,
                    organization_id: org.id, fee_bearer: 'customer', platform_fee_percent: 0, lineup: [],
                } as unknown as React.ComponentProps<typeof PreviewModal>['formData']}
                tiers={draft.tickets.map(t => ({ id: t.key, name: t.name, price: Number(t.price) || 0, total_quantity: parseInt(t.quantity, 10) || 0, quantity_sold: 0, currency: draft.currency }))}
            />
        </div>
    )
}

function ReviewRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 border-t border-gray-100 px-5 py-4 dark:border-white/10 sm:px-6">
            <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
                <div className="mt-1 text-sm text-gray-950 dark:text-white">{children}</div>
            </div>
            <button type="button" onClick={onEdit} className="shrink-0 text-sm font-medium text-gray-950 underline underline-offset-4 dark:text-white">Edit</button>
        </div>
    )
}

function PlanEstimate({ plan, capacity, hasPaidTickets, currency, providerName }: { plan?: PlanTier; capacity: number; hasPaidTickets: boolean; currency: string; providerName?: string }) {
    if (!plan) return null
    // The plan's fixed price in the event's currency when one is set
    const local = priceIn(plan, currency)
    const price = local !== null ? { minor: local, currency } : { minor: plan.price_minor, currency: plan.currency }
    return (
        <div className="rounded-3xl bg-gray-950 p-6 text-white dark:bg-white dark:text-black">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-60">GatePass plan</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{plan.name}</p>
                    <p className="mt-1 text-sm opacity-70">{capacity.toLocaleString()} tickets · 0% of ticket sales</p>
                </div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">{plan.price_minor === 0 ? 'Free' : formatCurrency(price.minor / 100, price.currency)}</p>
            </div>
            <p className="mt-4 border-t border-white/15 pt-4 text-sm opacity-70 dark:border-black/10">
                {plan.price_minor === 0 ? 'Nothing to pay before publishing.' : 'Paid once, before you publish.'}
                {hasPaidTickets && providerName ? ` Ticket money goes straight to your ${providerName} account.` : ''}
            </p>
        </div>
    )
}

/** How the organizer will be paid for this event, and what it costs them. */
function GettingPaid({ orgId, providerId, managed, plan, capacity, hasPaidTickets, currency, potential, onManagedReady }: {
    orgId: string
    providerId: string | null
    managed: ManagedPaymentsSetup | null
    plan?: PlanTier
    capacity: number
    hasPaidTickets: boolean
    currency: string
    potential: number
    onManagedReady: () => void
}) {
    const [settingUp, setSettingUp] = useState(false)
    const card = 'rounded-3xl bg-gray-950 p-6 text-white dark:bg-white dark:text-black'

    // GatePass Payments: a per-ticket fee instead of a plan fee
    if (hasPaidTickets && providerId === 'gatepass' && managed) {
        const keep = potential * (1 - managed.terms.feePercent / 100)
        return (
            <div className={card}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-60">Getting paid</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight">GatePass Payments</p>
                        <p className="mt-1 text-sm opacity-70">{managed.terms.feePercent}% per paid ticket · no plan fee</p>
                    </div>
                    {potential > 0 && (
                        <div className="text-right">
                            <p className="text-xs opacity-60">If every ticket sells, you keep about</p>
                            <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatCurrency(keep, currency)}</p>
                        </div>
                    )}
                </div>
                <p className="mt-4 border-t border-white/15 pt-4 text-sm opacity-70 dark:border-black/10">
                    Paid to {managed.account ? `${managed.account.bankName} ••••${managed.account.accountNumberHint}` : 'your payout account'} the next business day. Paystack’s processing fee also comes out of your share.
                    {managed.account?.trustLevel !== 'trusted' ? ` As a new organizer, ${managed.terms.reservePercent}% is held until ${managed.terms.releaseHours} hours after the event.` : ''}
                </p>
            </div>
        )
    }

    // Paid tickets with no way to get paid yet: set up GatePass Payments here, or connect a provider
    if (hasPaidTickets && !providerId) {
        return (
            <div className="rounded-3xl border border-gray-200 p-6 dark:border-white/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Getting paid</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-gray-950 dark:text-white">Choose how you’ll get paid</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">You can save this event as a draft now. It needs a way to get paid before you publish paid tickets.</p>
                {settingUp ? (
                    <div className="mt-5">
                        <PayoutAccountForm organizerId={orgId} currency={managed?.currency ?? 'GHS'} submitLabel="Save payout account" onCancel={() => setSettingUp(false)} onDone={() => { setSettingUp(false); onManagedReady(); toast.success('GatePass Payments is ready') }} />
                    </div>
                ) : (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {managed?.available && (
                            <button type="button" onClick={() => setSettingUp(true)} className="rounded-2xl border border-gray-200 p-4 text-left transition-colors hover:border-gray-950 dark:border-white/10 dark:hover:border-white">
                                <span className="block text-sm font-semibold text-gray-950 dark:text-white">GatePass Payments</span>
                                <span className="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">No keys. {managed.terms.feePercent}% per ticket, paid to your MoMo or bank. Set up here in a minute.</span>
                            </button>
                        )}
                        <Link href="/dashboard/settings?tab=payments" className="rounded-2xl border border-gray-200 p-4 text-left transition-colors hover:border-gray-950 dark:border-white/10 dark:hover:border-white">
                            <span className="block text-sm font-semibold text-gray-950 dark:text-white">Your own payment account</span>
                            <span className="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">Paystack, Stripe, Flutterwave and more. 0% per ticket plus a one-time plan fee. Your draft is saved.</span>
                        </Link>
                    </div>
                )}
            </div>
        )
    }

    // Own provider (or a free event): the one-time plan fee by size
    return <PlanEstimate plan={plan} capacity={capacity} hasPaidTickets={hasPaidTickets} currency={currency} providerName={providerId ? getProvider('payments', providerId)?.name : undefined} />
}
