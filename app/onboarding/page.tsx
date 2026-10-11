'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { GatePassMark } from '@/components/branding/GatePassMark'
import { MediaUploader } from '@/components/admin/MediaUploader'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/utils/supabase/client'

type FormValues = {
    name: string
    slug: string
    description: string
    logo_url: string
    website: string
    twitter: string
    instagram: string
    bank_name: string
    account_number: string
    account_name: string
}

const initialValues: FormValues = {
    name: '', slug: '', description: '', logo_url: '', website: '',
    twitter: '', instagram: '', bank_name: '', account_number: '', account_name: '',
}

const steps = [
    { title: 'Organization', detail: 'Name and identity' },
    { title: 'Online presence', detail: 'Where people find you' },
    { title: 'Payout details', detail: 'Where earnings go' },
    { title: 'Review', detail: 'Confirm your setup' },
]

const fieldClass = 'h-11 rounded-xl border-[#dedede] bg-white text-[15px] shadow-none focus-visible:border-black focus-visible:ring-black/10 dark:border-white/20 dark:bg-[#111] dark:focus-visible:border-white'
const labelClass = 'mb-1.5 block text-[13px] font-semibold text-[#171717] dark:text-white'
const helperClass = 'mt-1.5 text-xs leading-relaxed text-[#747474] dark:text-[#a2a2a2]'

function toSlug(value: string) {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function OnboardingPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const reduceMotion = useReducedMotion()
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState<FormValues>(initialValues)
    const [slugEdited, setSlugEdited] = useState(false)
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
        if (!name || !slug) { setError('Add an organization name and profile URL to continue.'); return false }
        setFormData(current => ({ ...current, name, slug }))
        return true
    }

    const validatePayout = () => {
        const fields = [formData.bank_name, formData.account_number, formData.account_name]
        if (fields.some(value => value.trim()) && fields.some(value => !value.trim())) {
            setError('Complete all payout fields, or skip this step and add them later.')
            return false
        }
        return true
    }

    const continueStep = () => {
        if (step === 1 && !validateOrganization()) return
        if (step === 3 && !validatePayout()) return
        goToStep(Math.min(step + 1, 4))
    }

    const skipStep = () => {
        if (step === 2) setFormData(current => ({ ...current, website: '', twitter: '', instagram: '' }))
        if (step === 3) setFormData(current => ({ ...current, bank_name: '', account_number: '', account_name: '' }))
        goToStep(step + 1)
    }

    const handleSubmit = async () => {
        if (!validateOrganization()) { setStep(1); return }
        if (!validatePayout()) { setStep(3); return }
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.replace('/login?next=%2Fonboarding')
                throw new Error('Your session expired. Please sign in again.')
            }
            const { error: insertError } = await supabase.schema('gatepass').from('organizers').insert({
                user_id: user.id,
                name: formData.name.trim(),
                slug: toSlug(formData.slug),
                description: formData.description.trim() || null,
                logo_url: formData.logo_url || null,
                website: formData.website.trim() || null,
                twitter: formData.twitter.trim() || null,
                instagram: formData.instagram.trim() || null,
                bank_name: formData.bank_name.trim() || null,
                account_number: formData.account_number.trim() || null,
                account_name: formData.account_name.trim() || null,
            })
            if (insertError) throw insertError
            toast.success('Organization created')
            router.push('/dashboard')
            router.refresh()
        } catch (caught) {
            const duplicateSlug = (caught as { code?: string })?.code === '23505'
            const message = duplicateSlug ? 'That profile URL is already taken. Choose another one.'
                : caught instanceof Error ? caught.message : 'Could not create your organization. Try again.'
            setError(message)
            if (duplicateSlug) setStep(1)
            toast.error(message)
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const hasOnlinePresence = Boolean(formData.website.trim() || formData.twitter.trim() || formData.instagram.trim())
    const hasPayout = Boolean(formData.bank_name && formData.account_number && formData.account_name)

    if (!authReady) return <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#080808]"><Loader2 className="size-5 animate-spin text-[#666]" aria-label="Loading setup" /></div>

    return (
        <div className="min-h-screen bg-white text-[#111] dark:bg-[#080808] dark:text-white">
            <header className="border-b border-[#ebebeb] dark:border-white/10">
                <div className="mx-auto flex h-[72px] max-w-[1160px] items-center justify-between px-5 sm:px-8">
                    <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg font-semibold tracking-[-0.025em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
                        <GatePassMark className="size-8" /><span className="text-[18px]">GatePass</span>
                    </Link>
                    <button type="button" onClick={handleLogout} className="rounded-lg px-2 py-2 text-sm font-medium text-[#737373] transition-colors hover:text-black focus-visible:outline focus-visible:outline-2 dark:text-[#aaa] dark:hover:text-white">Log out</button>
                </div>
            </header>

            <main className="mx-auto grid max-w-[1160px] gap-7 px-5 pb-16 pt-7 sm:px-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16 lg:pt-4">
                <aside className="lg:pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7a7a7a] dark:text-[#999]">Creator setup</p>
                    <h2 className="mt-4 hidden max-w-[320px] text-[52px] font-semibold leading-[1.08] tracking-[-0.055em] lg:block">Make your space on GatePass.</h2>
                    <p className="mt-5 hidden max-w-[285px] text-[15px] leading-7 text-[#6c6c6c] dark:text-[#aaa] lg:block">A few details now, and you’ll be ready to publish your first event. You can update everything later.</p>
                    <ol className="mt-12 hidden space-y-0 lg:block" aria-label="Setup progress">
                        {steps.map((item, index) => {
                            const number = index + 1
                            return <li key={item.title} className="flex min-h-[72px] gap-4">
                                <div className="flex w-8 flex-col items-center">
                                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${step === number ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : step > number ? 'border-black text-black dark:border-white dark:text-white' : 'border-[#d8d8d8] text-[#999] dark:border-white/20'}`}>
                                        {step > number ? <Check className="size-4" aria-hidden="true" /> : number}
                                    </span>
                                    {number < steps.length && <span className="h-10 w-px bg-[#e5e5e5] dark:bg-white/15" />}
                                </div>
                                <div className="pt-0.5"><p className={`text-sm font-semibold ${step < number ? 'text-[#999] dark:text-[#777]' : ''}`}>{item.title}</p><p className="mt-1 text-xs text-[#888] dark:text-[#999]">{item.detail}</p></div>
                            </li>
                        })}
                    </ol>
                    <div className="mt-4 lg:hidden" aria-label={`Step ${step} of ${steps.length}: ${steps[step - 1].title}`}>
                        <div className="flex justify-between text-xs font-semibold text-[#707070] dark:text-[#aaa]"><span>Step {step} of {steps.length}</span><span>{steps[step - 1].title}</span></div>
                        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#e8e8e8] dark:bg-white/15"><div className="h-full rounded-full bg-black transition-[width] duration-300 dark:bg-white" style={{ width: `${(step / steps.length) * 100}%` }} /></div>
                    </div>
                </aside>

                <section className="min-w-0 max-w-[640px] lg:pt-1" aria-label="Organization setup">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={step} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
                            <div className="mb-4">
                                <p className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-[#888] dark:text-[#aaa] lg:block">Step {step} / {steps.length}</p>
                                <h1 className="mt-2 text-[31px] font-semibold leading-tight tracking-[-0.045em] sm:text-[38px]">{step === 1 ? 'Start with your organization' : step === 2 ? 'Where can people find you?' : step === 3 ? 'Add payout details' : 'Review your details'}</h1>
                                <p className="mt-2.5 text-sm leading-6 text-[#707070] dark:text-[#aaa]">{step === 1 ? 'Give your page a name and a place to live.' : step === 2 ? 'These links are optional. Add them now or come back later.' : step === 3 ? 'Add a bank account now, or set one up before your first payout.' : 'Make sure everything looks right before creating your workspace.'}</p>
                            </div>

                            {step === 1 && <div className="space-y-3">
                                <div className="flex items-center gap-4 rounded-2xl border border-[#e6e6e6] p-3 dark:border-white/15">
                                    <div className="size-16 shrink-0"><MediaUploader type="image" aspectRatio="square" path="org-logos" value={formData.logo_url} onChange={url => updateField('logo_url', url)} label="Add logo" compact /></div>
                                    <div><p className="text-sm font-semibold">Organization logo <span className="font-normal text-[#888]">(optional)</span></p><p className="mt-1 text-xs leading-5 text-[#777] dark:text-[#aaa]">A square image works best. JPG, PNG or WebP, up to 5 MB.</p></div>
                                </div>
                                <div><label htmlFor="organization-name" className={labelClass}>Organization name</label><Input id="organization-name" name="organization-name" autoComplete="organization" value={formData.name} onChange={event => updateField('name', event.target.value)} placeholder="e.g. SQUA Events" className={fieldClass} /></div>
                                <div>
                                    <label htmlFor="profile-slug" className={labelClass}>Profile URL</label>
                                    <div className="flex h-11 overflow-hidden rounded-xl border border-[#dedede] bg-white focus-within:border-black focus-within:ring-1 focus-within:ring-black/10 dark:border-white/20 dark:bg-[#111] dark:focus-within:border-white">
                                        <span className="flex shrink-0 items-center border-r border-[#e9e9e9] bg-[#fafafa] px-3 text-sm text-[#777] dark:border-white/10 dark:bg-white/5 dark:text-[#aaa]">gatepass.so/</span>
                                        <input id="profile-slug" name="profile-slug" value={formData.slug} onChange={event => updateField('slug', event.target.value)} placeholder="your-name" spellCheck={false} autoCapitalize="none" className="min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-[#aaa]" aria-describedby="slug-help" />
                                    </div>
                                    <p id="slug-help" className={helperClass}>This is the link people will use to find your events.</p>
                                </div>
                                <div><label htmlFor="organization-description" className={labelClass}>Description <span className="font-normal text-[#888]">(optional)</span></label><textarea id="organization-description" name="organization-description" value={formData.description} onChange={event => updateField('description', event.target.value)} placeholder="What kind of events do you create?" rows={2} className="w-full resize-y rounded-xl border border-[#dedede] bg-white px-4 py-3 text-[15px] outline-none placeholder:text-[#aaa] focus:border-black focus:ring-1 focus:ring-black/10 dark:border-white/20 dark:bg-[#111] dark:focus:border-white" /></div>
                            </div>}

                            {step === 2 && <div className="space-y-5">
                                <div><label htmlFor="website" className={labelClass}>Website <span className="font-normal text-[#888]">(optional)</span></label><Input id="website" name="website" type="url" autoComplete="url" value={formData.website} onChange={event => updateField('website', event.target.value)} placeholder="https://yourwebsite.com" className={fieldClass} /></div>
                                <div><label htmlFor="x-handle" className={labelClass}>X <span className="font-normal text-[#888]">(optional)</span></label><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#888]">@</span><Input id="x-handle" name="x-handle" autoCapitalize="none" autoComplete="off" value={formData.twitter} onChange={event => updateField('twitter', event.target.value.replace(/^@+/, ''))} placeholder="username" className={`${fieldClass} pl-8`} /></div></div>
                                <div><label htmlFor="instagram-handle" className={labelClass}>Instagram <span className="font-normal text-[#888]">(optional)</span></label><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#888]">@</span><Input id="instagram-handle" name="instagram-handle" autoCapitalize="none" autoComplete="off" value={formData.instagram} onChange={event => updateField('instagram', event.target.value.replace(/^@+/, ''))} placeholder="username" className={`${fieldClass} pl-8`} /></div></div>
                            </div>}

                            {step === 3 && <div className="space-y-5">
                                <div><label htmlFor="bank-name" className={labelClass}>Bank name</label><Input id="bank-name" name="bank-name" autoComplete="off" value={formData.bank_name} onChange={event => updateField('bank_name', event.target.value)} placeholder="e.g. Ecobank Ghana" className={fieldClass} /></div>
                                <div><label htmlFor="account-number" className={labelClass}>Account number</label><Input id="account-number" name="account-number" inputMode="numeric" autoComplete="off" maxLength={20} value={formData.account_number} onChange={event => updateField('account_number', event.target.value.replace(/\D/g, ''))} placeholder="Enter account number" className={fieldClass} /></div>
                                <div><label htmlFor="account-name" className={labelClass}>Account name</label><Input id="account-name" name="account-name" autoComplete="name" value={formData.account_name} onChange={event => updateField('account_name', event.target.value)} placeholder="Name on the account" className={fieldClass} /></div>
                                <p className={helperClass}>If you add payout details, complete all three fields. You can also skip this step.</p>
                            </div>}

                            {step === 4 && <div className="divide-y divide-[#e8e8e8] rounded-2xl border border-[#e8e8e8] px-5 dark:divide-white/15 dark:border-white/15 sm:px-6">
                                <div className="flex items-start justify-between gap-4 py-5"><div className="min-w-0"><p className="text-xs font-medium text-[#888]">Organization</p><p className="mt-1 truncate font-semibold">{formData.name}</p><p className="mt-1 truncate text-sm text-[#777] dark:text-[#aaa]">gatepass.so/{formData.slug}</p>{formData.description.trim() && <p className="mt-2 line-clamp-2 text-sm text-[#777] dark:text-[#aaa]">{formData.description.trim()}</p>}</div><button type="button" onClick={() => goToStep(1)} className="shrink-0 text-sm font-semibold underline underline-offset-4">Edit</button></div>
                                <div className="flex items-start justify-between gap-4 py-5"><div className="min-w-0"><p className="text-xs font-medium text-[#888]">Online presence</p><p className="mt-1 truncate text-sm font-medium">{hasOnlinePresence ? [formData.website.trim(), formData.twitter.trim() && `X @${formData.twitter.trim()}`, formData.instagram.trim() && `Instagram @${formData.instagram.trim()}`].filter(Boolean).join(' · ') : 'Add later'}</p></div><button type="button" onClick={() => goToStep(2)} className="shrink-0 text-sm font-semibold underline underline-offset-4">Edit</button></div>
                                <div className="flex items-start justify-between gap-4 py-5"><div className="min-w-0"><p className="text-xs font-medium text-[#888]">Payout details</p><p className="mt-1 text-sm font-medium">{hasPayout ? `${formData.bank_name} ···· ${formData.account_number.slice(-4)}` : 'Add later'}</p></div><button type="button" onClick={() => goToStep(3)} className="shrink-0 text-sm font-semibold underline underline-offset-4">Edit</button></div>
                            </div>}

                            {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
                            <div className="mt-3 flex flex-col gap-3 border-t border-[#ebebeb] pt-4 dark:border-white/15 sm:flex-row sm:items-center sm:justify-between">
                                <div>{step > 1 && <button type="button" onClick={() => goToStep(step - 1)} className="inline-flex h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-[#666] transition-colors hover:text-black focus-visible:outline focus-visible:outline-2 dark:text-[#aaa] dark:hover:text-white"><ArrowLeft className="size-4" /> Back</button>}</div>
                                <div className="flex items-center gap-4">
                                    {(step === 2 || step === 3) && <button type="button" onClick={skipStep} className="text-sm font-medium text-[#777] underline-offset-4 hover:text-black hover:underline dark:text-[#aaa] dark:hover:text-white">Skip for now</button>}
                                    <button type="button" onClick={step === 4 ? handleSubmit : continueStep} disabled={loading} className="inline-flex h-12 min-w-[158px] flex-1 items-center justify-center gap-2 rounded-full bg-[#111] px-6 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-[#eee] sm:flex-none">
                                        {loading ? <><Loader2 className="size-4 animate-spin" /> Creating...</> : step === 4 ? 'Create workspace' : <>Continue <ArrowRight className="size-4" /></>}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </section>
            </main>
        </div>
    )
}
