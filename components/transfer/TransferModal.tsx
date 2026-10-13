'use client'

import { useEffect, useId, useState } from 'react'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'
import { ArrowLeft, Check, ChevronRight, Copy, Link2, Loader2, Mail, QrCode, Share2, X } from 'lucide-react'
import { cancelTransfer, getPendingTransfer, startTransfer, type PendingTransfer } from '@/utils/actions/transfer'

interface TransferModalProps {
    isOpen: boolean
    onClose: () => void
    ticketId: string
    eventName: string
    ticketName?: string
    onTransferCreated?: () => void
}

type Step = 'loading' | 'choose' | 'email' | 'pending'

const primaryButton = 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111] text-[14px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black'
const secondaryButton = 'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#e2e2e2] px-4 text-[13px] font-semibold text-[#111] transition-colors hover:bg-[#f6f6f6] dark:border-[#333] dark:text-white dark:hover:bg-[#1c1c1c]'

function expiryLabel(iso: string) {
    const hours = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000))
    if (hours < 1) return 'less than an hour'
    if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
    return `${Math.round(hours / 24)} days`
}

export function TransferModal({ isOpen, onClose, ticketId, eventName, ticketName, onTransferCreated }: TransferModalProps) {
    const titleId = useId()
    const [step, setStep] = useState<Step>('loading')
    const [pending, setPending] = useState<PendingTransfer | null>(null)
    const [email, setEmail] = useState('')
    const [busy, setBusy] = useState<null | 'link' | 'email' | 'cancel'>(null)
    const [copied, setCopied] = useState(false)
    const [showQr, setShowQr] = useState(false)

    // Pick up a link the owner already created, instead of making a new one each time
    useEffect(() => {
        if (!isOpen) return
        let active = true
        getPendingTransfer(ticketId)
            .then(existing => {
                if (!active) return
                setPending(existing)
                setStep(existing ? 'pending' : 'choose')
            })
            .catch(() => active && setStep('choose'))
        return () => { active = false }
    }, [isOpen, ticketId])

    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    if (!isOpen) return null

    function close() {
        setStep('loading')
        setPending(null)
        setEmail('')
        setShowQr(false)
        setCopied(false)
        onClose()
    }

    const begin = async (kind: 'link' | 'email') => {
        setBusy(kind)
        try {
            const res = await startTransfer(ticketId, kind === 'email' ? email : undefined)
            if (!res.success) return toast.error(res.message)
            setPending(res.transfer)
            setStep('pending')
            onTransferCreated?.()
            if (kind === 'email') {
                if (res.emailSent) toast.success(`Sent to ${res.transfer.recipientEmail}`)
                else toast.warning('Link created, but the email didn’t send. Share the link instead.')
            }
        } catch {
            toast.error('Something went wrong. Try again.')
        } finally {
            setBusy(null)
        }
    }

    const cancel = async () => {
        if (!pending) return
        setBusy('cancel')
        try {
            const res = await cancelTransfer(pending.id)
            if (!res.success) return toast.error(res.message)
            toast.success('Transfer cancelled. The link no longer works.')
            setPending(null)
            setShowQr(false)
            setStep('choose')
            onTransferCreated?.()
        } finally {
            setBusy(null)
        }
    }

    const copy = async () => {
        if (!pending) return
        await navigator.clipboard.writeText(pending.url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const share = async () => {
        if (!pending) return
        try {
            await navigator.share({ title: `Ticket for ${eventName}`, text: `I’m sending you my ticket for ${eventName}. Claim it here:`, url: pending.url })
        } catch {
            // Closed the share sheet
        }
    }

    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    const whatsappHref = pending ? `https://wa.me/?text=${encodeURIComponent(`I’m sending you my ticket for ${eventName}. Claim it here: ${pending.url}`)}` : '#'

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-5">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={close} aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[#111] shadow-2xl animate-in slide-in-from-bottom-8 duration-300 dark:bg-[#111] dark:text-white sm:max-w-[420px] sm:rounded-[28px] sm:p-7 sm:slide-in-from-bottom-0 sm:zoom-in-95"
            >
                <div className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-[#e2e2e2] dark:bg-[#333] sm:hidden" aria-hidden="true" />
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-2">
                        {step === 'email' && (
                            <button type="button" onClick={() => setStep('choose')} aria-label="Back" className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-[#f3f3f3] dark:hover:bg-[#222]">
                                <ArrowLeft className="size-4" aria-hidden="true" />
                            </button>
                        )}
                        <h2 id={titleId} className="text-[24px] font-semibold tracking-[-0.04em]">
                            {step === 'email' ? 'Send by email' : step === 'pending' ? 'Transfer started' : 'Transfer ticket'}
                        </h2>
                    </div>
                    <button type="button" onClick={close} aria-label="Close" className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-[#f3f3f3] dark:hover:bg-[#222]">
                        <X className="size-4" aria-hidden="true" />
                    </button>
                </div>

                <div className="mt-4 rounded-2xl bg-[#f6f6f6] px-4 py-3 dark:bg-[#1a1a1a]">
                    <p className="truncate text-[15px] font-semibold">{eventName}</p>
                    <p className="text-[13px] text-[#666] dark:text-[#aaa]">{ticketName || 'Ticket'} · #{ticketId.slice(0, 8)}</p>
                </div>

                {step === 'loading' && (
                    <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-[#999]" aria-label="Loading" /></div>
                )}

                {step === 'choose' && (
                    <div className="mt-5 animate-in fade-in duration-200">
                        <div className="divide-y divide-[#eee] overflow-hidden rounded-2xl border border-[#e8e8e8] dark:divide-[#262626] dark:border-[#2a2a2a]">
                            <button type="button" onClick={() => setStep('email')} className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-[#fafafa] dark:hover:bg-[#161616]">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#111] text-white dark:bg-white dark:text-black"><Mail className="size-4" aria-hidden="true" /></span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] font-semibold">Send to their email</span>
                                    <span className="block text-[13px] leading-snug text-[#666] dark:text-[#aaa]">Only they can claim it.</span>
                                </span>
                                <ChevronRight className="size-4 text-[#999]" aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => begin('link')} disabled={!!busy} className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-[#fafafa] disabled:opacity-60 dark:hover:bg-[#161616]">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e2e2e2] dark:border-[#333]"><Link2 className="size-4" aria-hidden="true" /></span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] font-semibold">Share a link</span>
                                    <span className="block text-[13px] leading-snug text-[#666] dark:text-[#aaa]">For WhatsApp or any chat. Whoever opens it first can claim it.</span>
                                </span>
                                {busy === 'link' ? <Loader2 className="size-4 animate-spin text-[#999]" aria-hidden="true" /> : <ChevronRight className="size-4 text-[#999]" aria-hidden="true" />}
                            </button>
                        </div>
                        <ol className="mt-5 space-y-2 text-[13px] leading-snug text-[#666] dark:text-[#aaa]">
                            <li className="flex gap-3"><span className="w-4 shrink-0 font-semibold tabular-nums text-[#111] dark:text-white">1</span>Your ticket stays yours until it’s claimed.</li>
                            <li className="flex gap-3"><span className="w-4 shrink-0 font-semibold tabular-nums text-[#111] dark:text-white">2</span>When they claim it, they get a new QR code and yours stops working.</li>
                            <li className="flex gap-3"><span className="w-4 shrink-0 font-semibold tabular-nums text-[#111] dark:text-white">3</span>Changed your mind? Cancel any time before then.</li>
                        </ol>
                    </div>
                )}

                {step === 'email' && (
                    <form onSubmit={e => { e.preventDefault(); begin('email') }} className="mt-5 space-y-4 animate-in fade-in duration-200">
                        <div className="space-y-2">
                            <label htmlFor="transfer-email" className="text-[13px] font-medium">Their email</label>
                            <input
                                id="transfer-email"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                autoFocus
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="friend@example.com"
                                className="h-12 w-full rounded-2xl border border-[#e2e2e2] bg-white px-4 text-[15px] outline-none transition-colors placeholder:text-[#aaa] focus:border-[#111] dark:border-[#333] dark:bg-[#0b0b0b] dark:focus:border-white/60"
                            />
                            <p className="text-[12px] leading-snug text-[#777] dark:text-[#999]">We’ll email them a link. They’ll need to sign in with this address to claim it.</p>
                        </div>
                        <button type="submit" disabled={!!busy} className={primaryButton}>
                            {busy === 'email' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                            Send ticket
                        </button>
                    </form>
                )}

                {step === 'pending' && pending && (
                    <div className="mt-5 space-y-4 animate-in fade-in duration-200">
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#111] text-white dark:bg-white dark:text-black"><Check className="size-3.5" aria-hidden="true" /></span>
                            <p className="text-[14px] leading-relaxed text-[#444] dark:text-[#ccc]">
                                {pending.recipientEmail
                                    ? <>Sent to <strong className="font-semibold text-[#111] dark:text-white">{pending.recipientEmail}</strong>. Only they can claim it.</>
                                    : 'Share this link. Whoever claims it first gets the ticket.'}
                                {' '}It expires in {expiryLabel(pending.expiresAt)}.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-2xl border border-[#e2e2e2] p-1.5 pl-4 dark:border-[#333]">
                            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#555] dark:text-[#bbb]">{pending.url.replace(/^https?:\/\//, '')}</span>
                            <button type="button" onClick={copy} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#111] px-3.5 text-[12px] font-semibold text-white dark:bg-white dark:text-black">
                                {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {canShare ? (
                                <button type="button" onClick={share} className={secondaryButton}><Share2 className="size-4" aria-hidden="true" />Share</button>
                            ) : (
                                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={secondaryButton}>WhatsApp</a>
                            )}
                            <button type="button" onClick={() => setShowQr(v => !v)} aria-expanded={showQr} className={secondaryButton}>
                                <QrCode className="size-4" aria-hidden="true" />{showQr ? 'Hide QR' : 'QR code'}
                            </button>
                        </div>

                        {showQr && (
                            <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#f6f6f6] p-5 animate-in fade-in duration-200 dark:bg-[#1a1a1a]">
                                <div className="rounded-xl bg-white p-3"><QRCode value={pending.url} size={156} /></div>
                                <p className="text-[12px] text-[#777] dark:text-[#999]">They scan this to claim the ticket</p>
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3 border-t border-[#eee] pt-4 dark:border-[#262626]">
                            <button type="button" onClick={cancel} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 text-[13px] font-semibold text-red-600 disabled:opacity-50 dark:text-red-400">
                                {busy === 'cancel' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                                Cancel transfer
                            </button>
                            <button type="button" onClick={close} className="inline-flex h-10 items-center rounded-full bg-[#111] px-5 text-[13px] font-semibold text-white dark:bg-white dark:text-black">Done</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

