'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUpRight, Check, Copy, Loader2, X } from 'lucide-react'
import { ManagedPaymentsCard } from './ManagedPaymentsCard'
import { PROVIDER_GROUPS, providersFor, type IntegrationCategory, type ProviderDefinition } from '@/lib/integrations/providers'
import {
    deleteIntegration,
    saveIntegration,
    sendTestSms,
    setDefaultIntegration,
    testIntegration,
    type IntegrationSummary,
} from '@/app/actions/integrations'

const COPY: Record<IntegrationCategory, { eyebrow: string; title: string; lede: string; footnote: string; hasDefault: boolean }> = {
    payments: {
        eyebrow: 'Payments',
        title: 'Get paid directly.',
        lede: 'Connect your own payment provider. Ticket revenue lands in your account the moment it’s paid. GatePass never holds your money.',
        footnote: 'Processing fees are charged by your provider. Your default is used for every event unless you choose another on the event itself.',
        hasDefault: true,
    },
    sms: {
        eyebrow: 'Messaging',
        title: 'Text your attendees.',
        lede: 'Use your own SMS account for reminders, blasts and ticket notifications.',
        footnote: 'Messages are sent and billed by your provider. Your default is used for all outgoing SMS.',
        hasDefault: true,
    },
    marketing: {
        eyebrow: 'Marketing',
        title: 'Measure what sells.',
        lede: 'Add your tracking IDs and GatePass will fire page views and purchases on your event pages.',
        footnote: 'Every connected tracker runs on all of your public event pages.',
        hasDefault: false,
    },
}

type Status = IntegrationSummary['status'] | 'none'

const STATUS_STYLE: Record<Status, { label: string; dot: string }> = {
    connected: { label: 'Connected', dot: 'bg-emerald-500' },
    error: { label: 'Needs attention', dot: 'bg-red-500' },
    unverified: { label: 'Not verified', dot: 'bg-amber-500' },
    none: { label: 'Not connected', dot: 'bg-gray-300 dark:bg-white/25' },
}

function StatusPill({ status }: { status: Status }) {
    const { label, dot } = STATUS_STYLE[status]
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:border-white/10 dark:text-gray-300">
            <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
            {label}
        </span>
    )
}

function Monogram({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
    const initials = name.replace(/\(.*\)/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    return (
        <span
            aria-hidden="true"
            className={`flex shrink-0 items-center justify-center rounded-xl bg-gray-950 font-semibold tracking-tight text-white dark:bg-white dark:text-black ${size === 'lg' ? 'size-12 text-base' : 'size-10 text-sm'}`}
        >
            {initials}
        </span>
    )
}

/** Provider logo from /public/brands, falling back to initials. */
function BrandLogo({ provider, size = 'md' }: { provider: ProviderDefinition; size?: 'md' | 'lg' }) {
    const [failed, setFailed] = React.useState(false)
    if (failed) return <Monogram name={provider.name} size={size} />
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={`/brands/${provider.id}.png`}
            alt=""
            onError={() => setFailed(true)}
            className={`shrink-0 rounded-xl object-cover ring-1 ring-black/[0.06] dark:ring-white/10 ${size === 'lg' ? 'size-12' : 'size-10'}`}
        />
    )
}

function timeAgo(iso: string | null): string {
    if (!iso) return 'Not checked yet'
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
    const days = Math.round(hours / 24)
    return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The provider every event uses by default: status, mode, key in use, last check and webhook. */
function DefaultProviderCard({ organizerId, category, provider, integration, canEdit, onManage, onUpdated }: {
    organizerId: string
    category: IntegrationCategory
    provider: ProviderDefinition
    integration: IntegrationSummary
    canEdit: boolean
    onManage: () => void
    onUpdated: (integration: IntegrationSummary) => void
}) {
    const [testing, setTesting] = React.useState(false)
    const [copied, setCopied] = React.useState(false)
    const healthy = integration.status === 'connected'
    const keyField = provider.fields.find(f => f.secret && integration.credentialHints[f.key])

    const handleTest = async () => {
        setTesting(true)
        try {
            const result = await testIntegration(organizerId, integration.id)
            onUpdated(result)
            if (result.status === 'connected') toast.success(`${provider.name} is working`)
            else toast.error(result.statusMessage ?? 'Verification failed')
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not test the connection')
        } finally {
            setTesting(false)
        }
    }

    const details = [
        keyField && `${keyField.label} ••••${integration.credentialHints[keyField.key]}`,
        integration.lastVerifiedAt ? `Checked ${timeAgo(integration.lastVerifiedAt).toLowerCase()}` : 'Not checked yet',
    ].filter(Boolean).join(' · ')

    return (
        <section aria-label={`Default ${category === 'payments' ? 'payment' : 'SMS'} provider`} className="rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-center gap-4">
                    <BrandLogo provider={provider} size="lg" />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold tracking-tight text-gray-950 dark:text-white">{provider.name}</p>
                            <span className="rounded-full bg-gray-950 px-2.5 py-0.5 text-[11px] font-medium text-white dark:bg-white dark:text-black">Default</span>
                            <StatusPill status={integration.status} />
                            {provider.supportsTestMode && integration.mode === 'test' && (
                                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">Test mode</span>
                            )}
                        </div>
                        <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{details}</p>
                    </div>
                </div>
                <div className="flex shrink-0 gap-2">
                    {canEdit && (
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={testing}
                            className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                        >
                            {testing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                            Test
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onManage}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gray-950 px-4 text-sm font-medium text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-black"
                    >
                        Manage <ArrowUpRight className="size-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {!healthy && integration.statusMessage && (
                <p role="alert" className="mx-5 mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300 sm:mx-6">
                    {integration.statusMessage}
                </p>
            )}

            {category === 'payments' && (
                <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-3 dark:border-white/10 sm:px-6">
                    <p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">Webhook</p>
                    <p className="min-w-0 flex-1 truncate font-mono text-xs text-gray-600 dark:text-gray-300">{integration.webhookUrl}</p>
                    <button
                        type="button"
                        onClick={async () => {
                            await navigator.clipboard.writeText(integration.webhookUrl)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 1500)
                        }}
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-gray-950 hover:underline dark:text-white"
                    >
                        {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            )}
        </section>
    )
}

export function IntegrationsPanel({
    organizerId,
    category,
    initialIntegrations,
    canEdit,
}: {
    organizerId: string
    category: IntegrationCategory
    initialIntegrations: IntegrationSummary[]
    canEdit: boolean
}) {
    const copy = COPY[category]
    // GatePass Payments has its own card; the grid lists providers organizers bring keys for
    const providers = providersFor(category).filter(p => p.id !== 'gatepass')
    const allProviders = providersFor(category)
    const [integrations, setIntegrations] = React.useState(() => initialIntegrations.filter(i => i.category === category))
    const [openProvider, setOpenProvider] = React.useState<ProviderDefinition | null>(null)

    const byProvider = new Map(integrations.map(i => [i.provider, i]))
    const defaultIntegration = integrations.find(i => i.isDefault)
    const defaultProvider = defaultIntegration && allProviders.find(p => p.id === defaultIntegration.provider)

    const router = useRouter()
    // Keep the server-rendered props fresh so switching tabs doesn't show stale state
    const update = (fn: (list: IntegrationSummary[]) => IntegrationSummary[]) => {
        setIntegrations(fn)
        router.refresh()
    }
    const upsertLocal = (next: IntegrationSummary) =>
        update(list => [...list.filter(i => i.id !== next.id), next])

    return (
        <section aria-labelledby={`${category}-heading`} className="max-w-3xl space-y-10">
            <header className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{copy.eyebrow}</p>
                <h2 id={`${category}-heading`} className="text-[28px] font-semibold leading-tight tracking-tight text-gray-950 dark:text-white sm:text-[34px]">{copy.title}</h2>
                <p className="max-w-xl text-[15px] leading-relaxed text-gray-500 dark:text-gray-400">{copy.lede}</p>
            </header>

            {category === 'payments' && (
                <ManagedPaymentsCard organizerId={organizerId} canEdit={canEdit} onConnected={() => window.location.reload()} />
            )}

            {copy.hasDefault && (
                defaultIntegration && defaultProvider ? (
                    <DefaultProviderCard
                        organizerId={organizerId}
                        category={category}
                        provider={defaultProvider}
                        integration={defaultIntegration}
                        canEdit={canEdit}
                        onManage={() => setOpenProvider(defaultProvider)}
                        onUpdated={upsertLocal}
                    />
                ) : (
                    <div className="rounded-3xl border border-dashed border-gray-300 p-6 dark:border-white/15 sm:p-8">
                        <p className="text-lg font-semibold tracking-tight text-gray-950 dark:text-white">No provider connected yet</p>
                        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                            {category === 'payments'
                                ? 'Paid events can’t be published until you connect one. Free events work without it.'
                                : 'Pick a provider below to start sending messages.'}
                        </p>
                    </div>
                )
            )}

            {(() => {
                const renderCard = (provider: ProviderDefinition) => {
                        const integration = byProvider.get(provider.id)
                        return (
                            <li key={provider.id}>
                                <button
                                    type="button"
                                    onClick={() => setOpenProvider(provider)}
                                    className="group flex h-full w-full flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-gray-950 dark:border-white/10 dark:bg-[#111] dark:hover:border-white/60"
                                >
                                    <div className="flex w-full items-start justify-between gap-3">
                                        <BrandLogo provider={provider} />
                                        <div className="flex items-center gap-2">
                                            {integration?.isDefault && copy.hasDefault && (
                                                <span className="rounded-full bg-gray-950 px-2.5 py-1 text-[11px] font-medium text-white dark:bg-white dark:text-black">Default</span>
                                            )}
                                            <StatusPill status={integration?.status ?? 'none'} />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold tracking-tight text-gray-950 dark:text-white">{provider.name}</p>
                                        <p className="mt-1 text-sm leading-snug text-gray-500 dark:text-gray-400">{provider.description}</p>
                                        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{provider.regions}</p>
                                    </div>
                                    <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-gray-950 dark:text-white">
                                        {integration ? 'Manage' : 'Connect'}
                                        <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                                    </span>
                                </button>
                            </li>
                        )
}
                // Long lists (SMS) are grouped by where each provider is strongest
                const groups = PROVIDER_GROUPS
                const grouped = providers.some(p => p.group)
                return grouped ? (
                    <div className="space-y-8">
                        {groups.map(group => {
                            const list = providers.filter(p => p.group === group)
                            if (!list.length) return null
                            return (
                                <div key={group}>
                                    <h3 className="mb-4 text-sm font-semibold text-gray-950 dark:text-white">{group} <span className="font-normal text-gray-400">· {list.length}</span></h3>
                                    <ul className="grid gap-3 sm:grid-cols-2">{list.map(renderCard)}</ul>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div>
                        <h3 className="mb-4 text-sm font-semibold text-gray-950 dark:text-white">{copy.hasDefault ? 'All providers' : 'Trackers'}</h3>
                        <ul className="grid gap-3 sm:grid-cols-2">{providers.map(renderCard)}</ul>
                    </div>
                )
            })()}

            <p className="border-t border-gray-200 pt-6 text-xs leading-relaxed text-gray-500 dark:border-white/10 dark:text-gray-400">{copy.footnote}</p>

            {openProvider && (
                <ProviderSheet
                    key={openProvider.id}
                    organizerId={organizerId}
                    provider={openProvider}
                    integration={byProvider.get(openProvider.id)}
                    showDefault={copy.hasDefault}
                    canEdit={canEdit}
                    onClose={() => setOpenProvider(null)}
                    onSaved={upsertLocal}
                    onDefault={id => update(list => list.map(i => ({ ...i, isDefault: i.id === id })))}
                    onRemoved={id => update(list => {
                        const removed = list.find(i => i.id === id)
                        const rest = list.filter(i => i.id !== id)
                        // Mirrors the server: the oldest remaining integration becomes the default
                        if (removed?.isDefault && rest.length && copy.hasDefault) rest[0] = { ...rest[0], isDefault: true }
                        return rest
                    })}
                />
            )}
        </section>
    )
}

function ProviderSheet({
    organizerId,
    provider,
    integration,
    showDefault,
    canEdit,
    onClose,
    onSaved,
    onDefault,
    onRemoved,
}: {
    organizerId: string
    provider: ProviderDefinition
    integration?: IntegrationSummary
    showDefault: boolean
    canEdit: boolean
    onClose: () => void
    onSaved: (integration: IntegrationSummary) => void
    onDefault: (id: string) => void
    onRemoved: (id: string) => void
}) {
    const [mode, setMode] = React.useState<'test' | 'live'>(integration?.mode ?? 'live')
    const [values, setValues] = React.useState<Record<string, string>>(() => ({ ...(integration?.publicConfig ?? {}) }))
    const [busy, setBusy] = React.useState<null | 'save' | 'test' | 'default' | 'remove' | 'sms'>(null)
    const [testPhone, setTestPhone] = React.useState('')
    const [copied, setCopied] = React.useState(false)
    const [confirmRemove, setConfirmRemove] = React.useState(false)
    const panelRef = React.useRef<HTMLDivElement>(null)

    const onCloseRef = React.useRef(onClose)
    React.useEffect(() => { onCloseRef.current = onClose })

    // Runs once per open sheet: focus the first control and close on Escape
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
        document.addEventListener('keydown', onKey)
        panelRef.current?.querySelector<HTMLElement>('input:not([disabled]), button')?.focus()
        return () => document.removeEventListener('keydown', onKey)
    }, [])

    const run = async <T,>(kind: NonNullable<typeof busy>, fn: () => Promise<T>): Promise<T | undefined> => {
        setBusy(kind)
        try {
            return await fn()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Something went wrong')
        } finally {
            setBusy(null)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const saved = await run('save', () => saveIntegration({ organizerId, category: provider.category, provider: provider.id, mode, values }))
        if (!saved) return
        onSaved(saved)
        // Secrets are never sent back, so clear them from the form once stored
        setValues({ ...saved.publicConfig })
        if (saved.status === 'connected') toast.success(saved.statusMessage ?? `${provider.name} connected`)
        else toast.error(saved.statusMessage ?? 'Saved, but verification failed')
    }

    const status: Status = integration?.status ?? 'none'
    const inputClass = 'h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-950 disabled:opacity-50 dark:border-white/10 dark:bg-[#0b0b0b] dark:text-white dark:focus:border-white/60'

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="provider-sheet-title"
                className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#0b0b0b] dark:shadow-black"
            >
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-6 dark:border-white/10">
                    <div className="flex items-center gap-4">
                        <BrandLogo provider={provider} size="lg" />
                        <div>
                            <h2 id="provider-sheet-title" className="text-lg font-semibold tracking-tight text-gray-950 dark:text-white">{provider.name}</h2>
                            <div className="mt-1"><StatusPill status={status} /></div>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-white/10 dark:hover:text-white">
                        <X className="size-4" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-6 overflow-y-auto p-6">
                        {integration?.statusMessage && (
                            <p role="status" className={`rounded-xl px-4 py-3 text-sm ${integration.status === 'error'
                                ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                                : 'bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>
                                {integration.statusMessage}
                            </p>
                        )}

                        <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                            Find these in your{' '}
                            <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-950 underline underline-offset-4 dark:text-white">
                                {provider.name} dashboard
                            </a>.
                        </p>

                        {provider.supportsTestMode && (
                            <fieldset>
                                <legend className="mb-2 text-sm font-medium text-gray-950 dark:text-white">Mode</legend>
                                <div className="inline-flex rounded-full bg-gray-100 p-1 dark:bg-white/10">
                                    {(['live', 'test'] as const).map(m => (
                                        <label key={m} className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gray-950 ${mode === m
                                            ? 'bg-white text-gray-950 shadow-sm dark:bg-black dark:text-white'
                                            : 'text-gray-500 dark:text-gray-400'}`}>
                                            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} disabled={!canEdit} className="sr-only" />
                                            {m}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        )}

                        {provider.fields.map(field => {
                            const hint = integration?.credentialHints[field.key]
                            const id = `field-${provider.id}-${field.key}`
                            return (
                                <div key={field.key} className="space-y-2">
                                    <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-gray-950 dark:text-white">
                                        {field.label}
                                        {!field.required && <span className="text-xs font-normal text-gray-400">Optional</span>}
                                    </label>
                                    <input
                                        id={id}
                                        type={field.secret ? 'password' : 'text'}
                                        autoComplete="off"
                                        spellCheck={false}
                                        disabled={!canEdit}
                                        value={values[field.key] ?? ''}
                                        onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                                        placeholder={hint ? `••••••••${hint}` : field.placeholder}
                                        className={`${inputClass} font-mono`}
                                    />
                                    {(hint || field.help) && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {hint ? 'Saved. Leave blank to keep the current value.' : field.help}
                                        </p>
                                    )}
                                </div>
                            )
                        })}

                        {integration && provider.category === 'payments' && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-gray-950 dark:text-white">Webhook URL</p>
                                <div className="flex gap-2">
                                    <code className="min-w-0 flex-1 truncate rounded-xl bg-gray-50 px-3.5 py-3 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">{integration.webhookUrl}</code>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(integration.webhookUrl)
                                            setCopied(true)
                                            setTimeout(() => setCopied(false), 1500)
                                        }}
                                        aria-label="Copy webhook URL"
                                        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:text-gray-950 dark:border-white/10 dark:text-gray-300 dark:hover:text-white"
                                    >
                                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Add this in {provider.name} so payments are confirmed even if a buyer closes the page.</p>
                            </div>
                        )}

                        {integration && provider.category === 'sms' && canEdit && (
                            <div className="space-y-2 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                                <label htmlFor="test-phone" className="text-sm font-medium text-gray-950 dark:text-white">Send a test message</label>
                                <div className="flex gap-2">
                                    <input id="test-phone" type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+233 24 000 0000" className={inputClass} />
                                    <button
                                        type="button"
                                        disabled={!testPhone.trim() || busy !== null}
                                        onClick={async () => {
                                            const result = await run('sms', () => sendTestSms(organizerId, integration.id, testPhone.trim()))
                                            if (!result) return
                                            if (result.success) {
                                                toast.success('Test message sent')
                                                onSaved({ ...integration, status: 'connected', statusMessage: `Test message sent to ${testPhone.trim()}.` })
                                            } else {
                                                toast.error(result.error ?? 'Test message failed')
                                                onSaved({ ...integration, status: 'error', statusMessage: result.error ?? 'Test message failed.' })
                                            }
                                        }}
                                        className="h-11 shrink-0 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-950 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                                    >
                                        {busy === 'sms' ? <Loader2 className="size-4 animate-spin" /> : 'Send'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {!canEdit && (
                            <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">Only owners and admins can change providers.</p>
                        )}
                    </div>

                    {canEdit && (
                        <div className="space-y-3 border-t border-gray-200 p-6 dark:border-white/10">
                            <button
                                type="submit"
                                disabled={busy !== null}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gray-950 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black"
                            >
                                {busy === 'save' && <Loader2 className="size-4 animate-spin" />}
                                {integration ? 'Save and verify' : `Connect ${provider.name}`}
                            </button>

                            {integration && (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            disabled={busy !== null}
                                            onClick={async () => {
                                                const result = await run('test', () => testIntegration(organizerId, integration.id))
                                                if (!result) return
                                                onSaved(result)
                                                if (result.status === 'connected') toast.success(result.statusMessage ?? 'Connected')
                                                else toast.error(result.statusMessage ?? 'Verification failed')
                                            }}
                                            className="h-9 rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-950 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                                        >
                                            {busy === 'test' ? <Loader2 className="size-4 animate-spin" /> : 'Test connection'}
                                        </button>
                                        {showDefault && !integration.isDefault && (
                                            <button
                                                type="button"
                                                disabled={busy !== null}
                                                onClick={async () => {
                                                    const done = await run('default', async () => { await setDefaultIntegration(organizerId, integration.id); return true })
                                                    if (!done) return
                                                    onDefault(integration.id)
                                                    toast.success(`${provider.name} is now your default`)
                                                }}
                                                className="h-9 rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-950 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                                            >
                                                {busy === 'default' ? <Loader2 className="size-4 animate-spin" /> : 'Make default'}
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={busy !== null}
                                        onClick={async () => {
                                            if (!confirmRemove) { setConfirmRemove(true); return }
                                            const done = await run('remove', async () => { await deleteIntegration(organizerId, integration.id); return true })
                                            if (!done) return
                                            onRemoved(integration.id)
                                            toast.success(`${provider.name} disconnected`)
                                            onClose()
                                        }}
                                        className="h-9 rounded-full px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                                    >
                                        {busy === 'remove' ? <Loader2 className="size-4 animate-spin" /> : confirmRemove ? 'Click again to disconnect' : 'Disconnect'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </form>
            </div>
        </div>
    )
}
