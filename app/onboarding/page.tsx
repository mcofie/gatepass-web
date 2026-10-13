'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { GatePassMark } from '@/components/branding/GatePassMark'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { createClient } from '@/utils/supabase/client'
import { switchOrganization } from '@/app/actions/switch-org'

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
    { title: 'Online presence', heading: 'Where can people find you?', lede: 'Optional. Links show on your event pages so guests can follow along.' },
    { title: 'Review', heading: 'Ready when you are.', lede: 'Check your details. You can change all of this later in Settings.' },
]

// What happens after setup, in the order organizers do it
const nextUp = [
    { title: 'Connect your payment account', detail: 'Stripe, Paystack, Flutterwave, Hubtel, M-Pesa or Wave. Ticket money goes straight to you.' },
    { title: 'Create your first event', detail: 'Add tickets, add-ons and payment plans. Free events need no payment account.' },
    { title: 'Publish once, sell without commission', detail: 'A one-time fee by event size. Small events are free. 0% of ticket sales.' },
]

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

    useEffect(() => {
        let active = true
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!active) return
            if (!user) { router.replace('/login?next=%2Fonboarding'); return }
            setAuthReady(true)
        }).catch(() => { if (active) router.replace('/login?next=%2Fonboarding') })
        return () => { active = false }
    }, [router, supabase])

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

    const handleSubmit = async () => {
        if (!validateOrganization()) { goToStep(1); return }
        setLoading(true)
        let createdOrgId: string
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
            createdOrgId = org.id

            toast.success('Workspace created')
        } catch (caught) {
            const duplicateSlug = (caught as { code?: string })?.code === '23505'
            const message = duplicateSlug ? 'That handle was just taken. Choose another one.'
                : caught instanceof Error ? caught.message : 'Could not create your organization. Try again.'
            setError(message)
            if (duplicateSlug) { setSlugStatus('taken'); goToStep(1) }
            setLoading(false)
            return
        }

        // Make the new organization the active workspace and go straight to connecting payments.
        // The action ends in a redirect, which Next.js turns into client navigation.
        try {
            await switchOrganization(createdOrgId, '/dashboard/settings?tab=payments')
        } catch {
            router.push('/dashboard/settings?tab=payments')
        }
    }

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault()
        if (step === 1 && !validateOrganization()) return
        if (step === 2 && !validatePresence()) return
        if (step === 3) { handleSubmit(); return }
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
    const links = [
        formData.website.trim(),
        formData.twitter.trim() && `@${formData.twitter.trim()} on X`,
        formData.instagram.trim() && `@${formData.instagram.trim()} on Instagram`,
    ].filter(Boolean) as string[]

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
                    <p className="mt-5 hidden max-w-[300px] text-[15px] leading-7 text-[#6c6c6c] dark:text-[#aaa] lg:block">Three short steps. Ticket sales go straight to your own payment account.</p>

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
                            <h1 id="step-heading" className="mt-2 text-[32px] font-semibold leading-[1.08] tracking-[-0.05em] sm:text-[42px]">{current.heading}</h1>
                            <p className="mt-3 text-[15px] leading-6 text-[#6c6c6c] dark:text-[#aaa]">{current.lede}</p>

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
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-6">
                                        <div>
                                            <label htmlFor="website" className={labelClass}>Website {optional}</label>
                                            <input id="website" type="url" autoFocus autoComplete="url" value={formData.website} onChange={e => updateField('website', e.target.value)} placeholder="https://yourwebsite.com" className={fieldClass} />
                                        </div>
                                        <div>
                                            <label htmlFor="x-handle" className={labelClass}>X {optional}</label>
                                            <div className="relative">
                                                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#8a8a8a]">@</span>
                                                <input id="x-handle" autoCapitalize="none" autoComplete="off" value={formData.twitter} onChange={e => updateField('twitter', e.target.value.replace(/^@+/, ''))} placeholder="username" className={`${fieldClass} pl-8`} />
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="instagram-handle" className={labelClass}>Instagram {optional}</label>
                                            <div className="relative">
                                                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#8a8a8a]">@</span>
                                                <input id="instagram-handle" autoCapitalize="none" autoComplete="off" value={formData.instagram} onChange={e => updateField('instagram', e.target.value.replace(/^@+/, ''))} placeholder="username" className={`${fieldClass} pl-8`} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-10">
                                        <div className="rounded-3xl bg-[#0d0d0d] p-6 text-white dark:bg-white dark:text-black sm:p-8">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex min-w-0 items-center gap-4">
                                                    {formData.logo_url
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        ? <img src={formData.logo_url} alt="" className="size-14 shrink-0 rounded-2xl object-cover" />
                                                        : <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xl font-semibold dark:bg-black/10">{formData.name.trim().charAt(0).toUpperCase()}</span>}
                                                    <div className="min-w-0">
                                                        <p className="truncate text-2xl font-semibold tracking-[-0.03em]">{formData.name}</p>
                                                        <p className="mt-0.5 truncate text-sm opacity-60">@{formData.slug}</p>
                                                    </div>
                                                </div>
                                                <button type="button" onClick={() => goToStep(1)} className="shrink-0 rounded-full border border-white/25 px-3 py-1 text-xs font-medium transition-colors hover:bg-white/10 dark:border-black/20 dark:hover:bg-black/5">Edit</button>
                                            </div>
                                            {formData.description.trim() && <p className="mt-5 line-clamp-3 text-sm leading-6 opacity-75">{formData.description.trim()}</p>}
                                            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/15 pt-5 text-xs dark:border-black/10">
                                                {links.length
                                                    ? links.map(link => <span key={link} className="rounded-full bg-white/10 px-3 py-1 dark:bg-black/5">{link}</span>)
                                                    : <span className="opacity-60">No links yet</span>}
                                                <button type="button" onClick={() => goToStep(2)} className="ml-auto text-xs font-medium underline underline-offset-4 opacity-80 hover:opacity-100">Edit links</button>
                                            </div>
                                        </div>

                                        <div>
                                            <h2 className="text-sm font-semibold">What happens next</h2>
                                            <ol className="mt-4 border-t border-black/10 dark:border-white/15">
                                                {nextUp.map((item, index) => (
                                                    <li key={item.title} className="grid grid-cols-[2.25rem_1fr] gap-x-2 border-b border-black/10 py-4 dark:border-white/15">
                                                        <span className="font-mono text-sm tabular-nums text-[#8a8a8a]">{pad(index + 1)}</span>
                                                        <div>
                                                            <p className="text-[15px] font-medium">{item.title}</p>
                                                            <p className="mt-1 text-sm leading-6 text-[#6c6c6c] dark:text-[#aaa]">{item.detail}</p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

                            <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    {step > 1 && (
                                        <button type="button" onClick={() => goToStep(step - 1)} className="inline-flex h-11 items-center gap-2 rounded-full px-2 text-sm font-medium text-[#666] transition-colors hover:text-black dark:text-[#aaa] dark:hover:text-white">
                                            <ArrowLeft className="size-4" /> Back
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
                                    {step === 2 && (
                                        <button type="button" onClick={() => { setFormData(c => ({ ...c, website: '', twitter: '', instagram: '' })); goToStep(3) }} className="h-11 text-sm font-medium text-[#777] hover:text-black dark:text-[#aaa] dark:hover:text-white">
                                            Skip for now
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={loading || (step === 1 && slugStatus === 'checking')}
                                        className="inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full bg-[#0d0d0d] px-7 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50 dark:bg-white dark:text-black"
                                    >
                                        {loading
                                            ? <><Loader2 className="size-4 animate-spin" /> Creating workspace…</>
                                            : step === 3 ? <>Create workspace <ArrowRight className="size-4" /></> : <>Continue <ArrowRight className="size-4" /></>}
                                    </button>
                                </div>
                            </div>
                        </motion.form>
                    </AnimatePresence>
                </section>
            </main>
        </div>
    )
}
