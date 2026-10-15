'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Loader2, X } from 'lucide-react'
import { GatePassMark } from '@/components/branding/GatePassMark'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { createClient } from '@/utils/supabase/client'
import { setActiveOrganization } from '@/app/actions/switch-org'
import { getManagedPaymentsSetup, type ManagedPaymentsSetup } from '@/app/actions/managed-payments'
import { PayoutAccountForm } from '@/components/payments/PayoutAccountForm'
import { PROVIDERS } from '@/lib/integrations/providers'
import { priceIn } from '@/lib/billing/prices'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'

type FormValues = {
    name: string
    slug: string
    description: string
    logo_url: string
    website: string
    twitter: string
    instagram: string
}

const initialValues: FormValues = { name: '', slug: '', description: '', logo_url: '', website: '', twitter: '', instagram: '' }

const steps = [
    { title: 'Organization', heading: 'Start with your organization.', lede: 'Your name and logo appear on every event page and ticket.' },
    { title: 'Getting paid', heading: 'How do you want to get paid?', lede: 'Pick what suits you now. You can switch or add another way later.' },
    { title: 'Set up', heading: 'Set up payouts.', lede: '' },
    { title: 'Ready', heading: 'You’re ready.', lede: 'Your workspace is set up. Create your first event next.' },
]

type PayChoice = 'gatepass' | 'own' | 'free'
type Plan = { name: string; max_tickets: number | null; price_minor: number; currency: string; prices?: Record<string, number> | null }

// The organization created in step 1, so a refresh mid-way resumes instead of creating another
const ORG_KEY = 'gatepass-onboarding-org'

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken'

const fieldClass = 'h-12 w-full rounded-xl border border-[#dedede] bg-white px-4 text-[15px] outline-none transition-colors placeholder:text-[#a3a3a3] focus:border-black dark:border-white/15 dark:bg-[#111] dark:focus:border-white'
const labelClass = 'mb-2 flex items-baseline justify-between text-[13px] font-semibold text-[#171717] dark:text-white'
const optional = <span className="text-xs font-normal text-[#8a8a8a]">Optional</span>

function toSlug(value: string) {
    return value.normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function OnboardingPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const reduceMotion = useReducedMotion()
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState<FormValues>(initialValues)
    const [slugEdited, setSlugEdited] = useState(false)
    const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [authReady, setAuthReady] = useState(false)
    const [showLinks, setShowLinks] = useState(false)
    const [orgId, setOrgId] = useState<string | null>(null)
    const [payChoice, setPayChoice] = useState<PayChoice | null>(null)
    const [managed, setManaged] = useState<ManagedPaymentsSetup | null>(null)
    const [plans, setPlans] = useState<Plan[]>([])
    const [payoutDone, setPayoutDone] = useState(false)

    useEffect(() => {
        let active = true
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!active) return
            if (!user) { router.replace('/login?next=%2Fonboarding'); return }
            try {
                const saved = sessionStorage.getItem(ORG_KEY)
                if (saved) { setOrgId(saved); setStep(2) }
            } catch { /* storage unavailable */ }
            setAuthReady(true)
        }).catch(() => { if (active) router.replace('/login?next=%2Fonboarding') })
        return () => { active = false }
    }, [router, supabase])

    // Payment options depend on the organization (GatePass Payments terms) and current plans
    useEffect(() => {
        if (!orgId) return
        let active = true
        getManagedPaymentsSetup(orgId).then(setup => { if (active) setManaged(setup) }).catch(() => { if (active) setManaged(null) })
        supabase.schema('gatepass').from('platform_pricing_tiers').select('name, max_tickets, price_minor, currency, prices').eq('is_active', true).order('sort_order')
            .then(({ data }) => { if (active) setPlans((data ?? []) as Plan[]) })
        return () => { active = false }
    }, [orgId, supabase])

    // Check the handle is free while the organizer types
    useEffect(() => {
        const slug = formData.slug
        if (!slug) { setSlugStatus('idle'); return }
        setSlugStatus('checking')
        const timer = setTimeout(async () => {
            const { data } = await supabase.schema('gatepass').from('organizers').select('id').eq('slug', slug).maybeSingle()
            setSlugStatus(data ? 'taken' : 'available')
        }, 400)
        return () => clearTimeout(timer)
    }, [formData.slug, supabase])

    const updateField = (field: keyof FormValues, value: string) => {
        setError('')
        if (field === 'slug') setSlugEdited(true)
        setFormData(current => ({
            ...current,
            [field]: field === 'slug' ? toSlug(value) : value,
            ...(field === 'name' && !slugEdited ? { slug: toSlug(value) } : {}),
        }))
    }

    const goToStep = (next: number) => {
        setError('')
        setStep(next)
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
    }

    const validateOrganization = () => {
        const name = formData.name.trim()
        const slug = toSlug(formData.slug)
        if (!name) { setError('Add your organization name to continue.'); return false }
        if (!slug) { setError('Choose a handle to continue.'); return false }
        if (slugStatus === 'taken') { setError('That handle is taken. Try another one.'); return false }
        setFormData(current => ({ ...current, name, slug }))
        return true
    }

    const validatePresence = () => {
        const website = formData.website.trim()
        if (website && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(website)) {
            setError('Enter a full website address, starting with https://')
            return false
        }
        return true
    }

    /** Step 1: create the organization and make it the active workspace. */
    const createWorkspace = async () => {
        if (!validateOrganization() || !validatePresence()) return
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.replace('/login?next=%2Fonboarding')
                throw new Error('Your session expired. Please sign in again.')
            }
            const { data: org, error: insertError } = await supabase.schema('gatepass').from('organizers').insert({
                user_id: user.id,
                name: formData.name.trim(),
                slug: toSlug(formData.slug),
                description: formData.description.trim() || null,
                logo_url: formData.logo_url || null,
                website: formData.website.trim() || null,
                twitter: formData.twitter.trim() || null,
                instagram: formData.instagram.trim() || null,
            }).select('id').single()
            if (insertError) throw insertError
            await setActiveOrganization(org.id)
            try { sessionStorage.setItem(ORG_KEY, org.id) } catch { /* storage unavailable */ }
            setOrgId(org.id)
            goToStep(2)
        } catch (caught) {
            const duplicateSlug = (caught as { code?: string })?.code === '23505'
            setError(duplicateSlug ? 'That handle was just taken. Choose another one.'
                : caught instanceof Error ? caught.message : 'Could not create your organization. Try again.')
            if (duplicateSlug) setSlugStatus('taken')
        } finally {
            setLoading(false)
        }
    }

    const finish = (href: string) => {
        try { sessionStorage.removeItem(ORG_KEY) } catch { /* storage unavailable */ }
        router.push(href)
    }

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault()
        if (step === 1) { createWorkspace(); return }
        if (step === 2) {
            if (!payChoice) { setError('Choose how you want to get paid.'); return }
            goToStep(payChoice === 'free' ? 4 : 3)
            return
        }
        if (step === 3 && payChoice === 'gatepass' && !payoutDone) { setError('Add your payout account to continue, or go back and choose another option.'); return }
        if (step === 4) { finish('/dashboard/events/create'); return }
        goToStep(step + 1)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    if (!authReady) {
        return <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#080808]"><Loader2 className="size-5 animate-spin text-[#666]" aria-label="Loading setup" /></div>
    }

    const current = steps[step - 1]
    const currency = managed?.currency ?? 'GHS'
    const paidPlans = plans.filter(p => p.price_minor > 0)
    const freePlan = plans.find(p => p.price_minor === 0)
    const cheapest = paidPlans[0]
    const planPrice = (plan: Plan) => {
        const local = priceIn(plan, currency)
        return formatCurrency((local ?? plan.price_minor) / 100, local !== null ? currency : plan.currency)
    }
    const ownProviders = PROVIDERS.filter(p => p.category === 'payments' && p.id !== 'gatepass')
    const stepLede = step === 3
        ? payChoice === 'gatepass' ? 'Where should we send your money? We confirm the account name with Paystack before saving.' : 'Choose your provider. We’ll open its connection form, with the keys you need listed.'
        : current.lede
    const stepHeading = step === 3 && payChoice === 'own' ? 'Connect your payment account.' : current.heading

    return (
        <div className="min-h-screen bg-white text-[#0d0d0d] dark:bg-[#080808] dark:text-white">
            <header className="border-b border-black/[0.07] dark:border-white/10">
                <div className="mx-auto flex h-16 max-w-[1160px] items-center justify-between px-4 sm:h-[72px] sm:px-8">
                    <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg font-semibold tracking-[-0.025em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
                        <GatePassMark className="size-8" /><span className="text-[18px]">GatePass</span>
                    </Link>
                    <button type="button" onClick={handleLogout} className="rounded-lg px-2 py-2 text-sm font-medium text-[#737373] transition-colors hover:text-black dark:text-[#aaa] dark:hover:text-white">Log out</button>
                </div>
            </header>

            <main className="mx-auto grid max-w-[1160px] gap-8 px-4 pb-20 pt-8 sm:px-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-20 lg:pt-16">
                <aside>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7a7a7a] dark:text-[#999]">Set up your workspace</p>
                    <h2 className="mt-4 hidden text-[52px] font-semibold leading-[1.02] tracking-[-0.06em] lg:block">Your events. Your money.</h2>
                    <p className="mt-5 hidden max-w-[300px] text-[15px] leading-7 text-[#6c6c6c] dark:text-[#aaa] lg:block">A few short steps. Choose how you get paid: through GatePass, or straight into your own payment account.</p>

                    <ol className="mt-12 hidden border-t border-black/10 dark:border-white/15 lg:block" aria-label="Setup progress">
                        {steps.map((item, index) => {
                            const number = index + 1
                            const state = step === number ? 'current' : step > number ? 'done' : 'todo'
                            return (
                                <li key={item.title} aria-current={state === 'current' ? 'step' : undefined} className="flex items-center gap-4 border-b border-black/10 py-4 dark:border-white/15">
                                    <span className={`w-7 font-mono text-sm tabular-nums ${state === 'todo' ? 'text-[#b3b3b3] dark:text-[#555]' : ''}`}>{pad(number)}</span>
                                    <span className={`flex-1 text-[15px] font-medium ${state === 'todo' ? 'text-[#a3a3a3] dark:text-[#666]' : ''}`}>{item.title}</span>
                                    {state === 'done' && <Check className="size-4" aria-label="Done" />}
                                    {state === 'current' && <span className="size-2 rounded-full bg-black dark:bg-white" aria-hidden="true" />}
                                </li>
                            )
                        })}
                    </ol>

                    <div className="lg:hidden" aria-label={`Step ${step} of ${steps.length}: ${current.title}`}>
                        <div className="flex justify-between text-xs font-semibold text-[#707070] dark:text-[#aaa]"><span>{pad(step)} / {pad(steps.length)}</span><span>{current.title}</span></div>
                        <div className="mt-2.5 flex gap-1.5">
                            {steps.map((item, index) => <span key={item.title} className={`h-1 flex-1 rounded-full transition-colors ${index < step ? 'bg-black dark:bg-white' : 'bg-black/10 dark:bg-white/15'}`} />)}
                        </div>
                    </div>
                </aside>

                <section className="min-w-0 max-w-[600px]" aria-labelledby="step-heading">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.form
                            key={step}
                            onSubmit={handleNext}
                            noValidate
                            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                        >
                            <p className="hidden font-mono text-sm tabular-nums text-[#8a8a8a] lg:block">{pad(step)}</p>
                            <h1 id="step-heading" className="mt-2 text-[32px] font-semibold leading-[1.08] tracking-[-0.05em] sm:text-[42px]">{stepHeading}</h1>
                            {stepLede && <p className="mt-3 text-[15px] leading-6 text-[#6c6c6c] dark:text-[#aaa]">{stepLede}</p>}

                            <div className="mt-8">
                                {step === 1 && (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="size-20 shrink-0"><MediaUploader type="image" aspectRatio="square" path="org-logos" value={formData.logo_url} onChange={url => updateField('logo_url', url)} label="Add logo" compact /></div>
                                            <div>
                                                <p className="text-sm font-semibold">Logo <span className="font-normal text-[#8a8a8a]">· Optional</span></p>
                                                <p className="mt-1 text-xs leading-5 text-[#777] dark:text-[#aaa]">Square works best. JPG, PNG or WebP up to 5 MB.</p>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="organization-name" className={labelClass}>Organization name</label>
                                            <input id="organization-name" autoFocus autoComplete="organization" value={formData.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. SQUA Events" className={fieldClass} />
                                        </div>
                                        <div>
                                            <label htmlFor="handle" className={labelClass}>Handle</label>
                                            <div className="relative">
                                                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#8a8a8a]">@</span>
                                                <input
                                                    id="handle"
                                                    value={formData.slug}
                                                    onChange={e => updateField('slug', e.target.value)}
                                                    placeholder="squa-events"
                                                    spellCheck={false}
                                                    autoCapitalize="none"
                                                    aria-describedby="handle-status"
                                                    aria-invalid={slugStatus === 'taken'}
                                                    className={`${fieldClass} pl-8 pr-10 ${slugStatus === 'taken' ? 'border-red-400 focus:border-red-500' : ''}`}
                                                />
                                                <span className="absolute inset-y-0 right-4 flex items-center" aria-hidden="true">
                                                    {slugStatus === 'checking' && <Loader2 className="size-4 animate-spin text-[#999]" />}
                                                    {slugStatus === 'available' && <Check className="size-4 text-emerald-600" />}
                                                    {slugStatus === 'taken' && <X className="size-4 text-red-500" />}
                                                </span>
                                            </div>
                                            <p id="handle-status" aria-live="polite" className={`mt-2 text-xs ${slugStatus === 'taken' ? 'text-red-600 dark:text-red-400' : 'text-[#777] dark:text-[#aaa]'}`}>
                                                {slugStatus === 'taken' ? 'Taken. Try another handle.' : slugStatus === 'available' ? 'Available.' : 'Lowercase letters, numbers and dashes.'}
                                            </p>
                                        </div>
                                        <div>
                                            <label htmlFor="organization-description" className={labelClass}>About {optional}</label>
                                            <textarea id="organization-description" value={formData.description} onChange={e => updateField('description', e.target.value)} placeholder="What kind of events do you create?" rows={3} className="w-full resize-y rounded-xl border border-[#dedede] bg-white px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-[#a3a3a3] focus:border-black dark:border-white/15 dark:bg-[#111] dark:focus:border-white" />
                                        </div>
                                        <div className="border-t border-black/10 pt-5 dark:border-white/15">
                                            <button type="button" onClick={() => setShowLinks(v => !v)} aria-expanded={showLinks} className="flex items-center gap-2 text-sm font-semibold">
                                                <ChevronDown className={cn('size-4 transition-transform', showLinks && 'rotate-180')} aria-hidden="true" />
                                                Website and socials <span className="font-normal text-[#8a8a8a]">· Optional</span>
                                            </button>
                                            {showLinks && (
                                                <div className="mt-5 space-y-5">
                                                    <div>
                                                        <label htmlFor="website" className={labelClass}>Website</label>
                                                        <input id="website" type="url" autoComplete="url" value={formData.website} onChange={e => updateField('website', e.target.value)} placeholder="https://yourwebsite.com" className={fieldClass} />
                                                    </div>
                                                    <div className="grid gap-5 sm:grid-cols-2">
                                                        <div>
                                                            <label htmlFor="x-handle" className={labelClass}>X</label>
                                                            <div className="relative">
                                                                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#8a8a8a]">@</span>
                                                                <input id="x-handle" autoCapitalize="none" autoComplete="off" value={formData.twitter} onChange={e => updateField('twitter', e.target.value.replace(/^@+/, ''))} placeholder="username" className={`${fieldClass} pl-8`} />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label htmlFor="instagram-handle" className={labelClass}>Instagram</label>
                                                            <div className="relative">
                                                                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#8a8a8a]">@</span>
                                                                <input id="instagram-handle" autoCapitalize="none" autoComplete="off" value={formData.instagram} onChange={e => updateField('instagram', e.target.value.replace(/^@+/, ''))} placeholder="username" className={`${fieldClass} pl-8`} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div role="radiogroup" aria-label="How you get paid" className="space-y-3">
                                        {managed?.available && (
                                            <ChoiceCard
                                                selected={payChoice === 'gatepass'}
                                                onSelect={() => { setPayChoice('gatepass'); setError('') }}
                                                title="GatePass Payments"
                                                badge="No keys needed"
                                                price={`${managed.terms.feePercent}% per ticket`}
                                                points={[
                                                    'Buyers pay by card or mobile money',
                                                    'Your share lands in your MoMo or bank the next business day',
                                                    `New organizers: ${managed.terms.reservePercent}% held until ${managed.terms.releaseHours}h after the event`,
                                                    `Payouts in ${managed.currency}`,
                                                ]}
                                            />
                                        )}
                                        <ChoiceCard
                                            selected={payChoice === 'own'}
                                            onSelect={() => { setPayChoice('own'); setError('') }}
                                            title="Your own payment account"
                                            badge="0% per ticket"
                                            price={cheapest ? `from ${planPrice(cheapest)} per event` : 'One-time fee per event'}
                                            points={[
                                                `${ownProviders.slice(0, 5).map(p => p.name.replace(/ \(.*\)$/, '')).join(', ')} and more`,
                                                'Money goes straight to your account',
                                                freePlan?.max_tickets ? `Free for events up to ${freePlan.max_tickets.toLocaleString()} tickets` : 'A one-time fee by event size',
                                                'You’ll need API keys from your provider',
                                            ]}
                                        />
                                        <ChoiceCard
                                            selected={payChoice === 'free'}
                                            onSelect={() => { setPayChoice('free'); setError('') }}
                                            title="Free events for now"
                                            price="Set up payments later"
                                            points={['RSVPs and free tickets work right away', 'Add a way to get paid anytime in Settings']}
                                        />
                                    </div>
                                )}

                                {step === 3 && payChoice === 'gatepass' && orgId && (
                                    payoutDone ? (
                                        <p className="flex items-center gap-3 rounded-2xl bg-[#f6f6f6] px-5 py-4 text-[15px] dark:bg-white/5">
                                            <span className="flex size-7 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black"><Check className="size-4" aria-hidden="true" /></span>
                                            Payout account saved. GatePass Payments is ready.
                                        </p>
                                    ) : (
                                        <PayoutAccountForm organizerId={orgId} currency={currency} submitLabel="Save payout account" onDone={() => { setPayoutDone(true); setError('') }} />
                                    )
                                )}

                                {step === 3 && payChoice === 'own' && (
                                    <ul className="grid gap-2 sm:grid-cols-2">
                                        {ownProviders.map(provider => (
                                            <li key={provider.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => finish(`/dashboard/settings?tab=payments&connect=${provider.id}`)}
                                                    className="flex w-full items-center gap-3 rounded-2xl border border-[#e3e3e3] p-3.5 text-left transition-colors hover:border-black dark:border-white/15 dark:hover:border-white"
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={`/brands/${provider.id}.png`} alt="" className="size-9 shrink-0 rounded-lg bg-white object-contain" />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-sm font-semibold">{provider.name}</span>
                                                        <span className="block truncate text-xs text-[#777] dark:text-[#aaa]">{provider.regions}</span>
                                                    </span>
                                                    <ArrowRight className="size-4 shrink-0 text-[#999]" aria-hidden="true" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {step === 4 && (
                                    <ol className="border-t border-black/10 dark:border-white/15">
                                        {[
                                            { done: true, title: 'Workspace created', detail: `@${formData.slug || 'your-handle'}` },
                                            payChoice === 'gatepass'
                                                ? { done: payoutDone, title: 'GatePass Payments set up', detail: 'Sales settle to your payout account the next business day.' }
                                                : { done: false, title: 'Getting paid', detail: 'Free events work now. Add a way to get paid in Settings → Payments when you’re ready.' },
                                            { done: false, title: 'Create your first event', detail: 'Add the date, venue, tickets and a video. It takes a few minutes.' },
                                        ].map((item, index) => (
                                            <li key={item.title} className="grid grid-cols-[2.25rem_1fr] gap-x-2 border-b border-black/10 py-4 dark:border-white/15">
                                                <span className="pt-0.5">{item.done ? <Check className="size-4" aria-label="Done" /> : <span className="font-mono text-sm tabular-nums text-[#8a8a8a]">{pad(index + 1)}</span>}</span>
                                                <div>
                                                    <p className="text-[15px] font-medium">{item.title}</p>
                                                    <p className="mt-1 text-sm leading-6 text-[#6c6c6c] dark:text-[#aaa]">{item.detail}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>

                            {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

                            <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    {(step === 3 || (step === 4 && payChoice === 'free')) && (
                                        <button type="button" onClick={() => goToStep(2)} className="inline-flex h-11 items-center gap-2 rounded-full px-2 text-sm font-medium text-[#666] transition-colors hover:text-black dark:text-[#aaa] dark:hover:text-white">
                                            <ArrowLeft className="size-4" /> Back
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
                                    {step === 4 && (
                                        <button type="button" onClick={() => finish('/dashboard')} className="h-11 text-sm font-medium text-[#777] hover:text-black dark:text-[#aaa] dark:hover:text-white">
                                            Go to dashboard
                                        </button>
                                    )}
                                    {step === 3 && payChoice === 'own' && (
                                        <button type="button" onClick={() => goToStep(4)} className="h-11 text-sm font-medium text-[#777] hover:text-black dark:text-[#aaa] dark:hover:text-white">
                                            I’ll do this later
                                        </button>
                                    )}
                                    {!(step === 3 && payChoice === 'own') && (
                                        <button
                                            type="submit"
                                            disabled={loading || (step === 1 && slugStatus === 'checking')}
                                            className="inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full bg-[#0d0d0d] px-7 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50 dark:bg-white dark:text-black"
                                        >
                                            {loading
                                                ? <><Loader2 className="size-4 animate-spin" /> Creating workspace…</>
                                                : step === 1 ? <>Create workspace <ArrowRight className="size-4" /></>
                                                    : step === 4 ? <>Create your first event <ArrowRight className="size-4" /></>
                                                        : <>Continue <ArrowRight className="size-4" /></>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.form>
                    </AnimatePresence>
                </section>
            </main>
        </div>
    )
}

function ChoiceCard({ selected, onSelect, title, badge, price, points }: { selected: boolean; onSelect: () => void; title: string; badge?: string; price: string; points: string[] }) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            className={cn(
                'block w-full rounded-3xl border p-5 text-left transition-colors sm:p-6',
                selected ? 'border-black shadow-[0_0_0_1px_black] dark:border-white dark:shadow-[0_0_0_1px_white]' : 'border-[#e3e3e3] hover:border-[#999] dark:border-white/15 dark:hover:border-white/40',
            )}
        >
            <span className="flex items-start justify-between gap-4">
                <span>
                    <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[17px] font-semibold tracking-[-0.02em]">{title}</span>
                        {badge && <span className="rounded-full bg-[#f1f1f1] px-2.5 py-0.5 text-[11px] font-semibold text-[#444] dark:bg-white/10 dark:text-[#ddd]">{badge}</span>}
                    </span>
                    <span className="mt-1 block text-sm font-medium text-[#555] dark:text-[#bbb]">{price}</span>
                </span>
                <span className={cn('mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border', selected ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-[#ccc] dark:border-white/30')} aria-hidden="true">
                    {selected && <Check className="size-3" strokeWidth={3} />}
                </span>
            </span>
            <span className="mt-4 block space-y-1.5 border-t border-black/[0.07] pt-4 dark:border-white/10">
                {points.map(point => <span key={point} className="flex gap-2 text-[13px] leading-5 text-[#666] dark:text-[#aaa]"><span aria-hidden="true">·</span>{point}</span>)}
            </span>
        </button>
    )
}
