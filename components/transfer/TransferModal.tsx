'use client'

import { useState } from 'react'
import { createTransfer } from '@/utils/actions/transfer'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { Copy, Mail, Check, Link as LinkIcon, Loader2, ArrowRight, Send } from 'lucide-react'
import QRCode from 'react-qr-code'
import { sendTransferByEmail } from '@/utils/actions/transfer'

interface TransferModalProps {
    isOpen: boolean
    onClose: () => void
    ticketId: string
    eventName: string
    onTransferCreated?: () => void
}

export function TransferModal({ isOpen, onClose, ticketId, eventName, onTransferCreated }: TransferModalProps) {
    const [step, setStep] = useState<'method' | 'email' | 'link'>('method')
    const [loading, setLoading] = useState(false)
    const [recipientEmail, setRecipientEmail] = useState('')
    const [transferLink, setTransferLink] = useState('')
    const [copied, setCopied] = useState(false)

    const handleCreateLink = async () => {
        setLoading(true)
        try {
            const res = await createTransfer(ticketId)
            if (res.success && res.token) {
                const link = `${window.location.origin}/claim/${res.token}`
                setTransferLink(link)
                setStep('link')
                if (onTransferCreated) onTransferCreated()
            } else {
                toast.error(res.message || 'Failed to create link')
            }
        } catch (e) {
            toast.error('An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!recipientEmail) return

        setLoading(true)
        try {
            const res = await sendTransferByEmail(ticketId, recipientEmail)
            if (res.success) {
                toast.success(`Ticket sent to ${recipientEmail}`)
                if (onTransferCreated) onTransferCreated()
                reset()
            } else {
                toast.error(res.message || 'Failed to send email')
            }
        } catch (e) {
            toast.error('An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(transferLink)
        setCopied(true)
        toast.success('Link copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
    }

    const reset = () => {
        setStep('method')
        setRecipientEmail('')
        setTransferLink('')
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={reset}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Transfer Ticket</DialogTitle>
                    <DialogDescription>
                        Send this ticket for <strong>{eventName}</strong> to a friend.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {step === 'method' && (
                        <div className="grid gap-4">
                            <Button variant="outline" className="h-auto p-4 justify-start space-x-4" onClick={handleCreateLink} disabled={loading}>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-full">
                                    <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold">Share a Link</div>
                                    <div className="text-xs text-muted-foreground">Get a unique link to send via WhatsApp, iMessage, etc.</div>
                                </div>
                                {loading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                            </Button>

                            {/* Email Flow Placeholder - Can be implemented later if email service is ready */}
                            <Button variant="outline" className="h-auto p-4 justify-start space-x-4" onClick={() => setStep('email')}>
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-full">
                                    <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="text-left">
                                    <div className="font-semibold">Send via Email</div>
                                    <div className="text-xs text-muted-foreground">We'll email them the ticket directly.</div>
                                </div>
                            </Button>
                        </div>
                    )}

                    {step === 'email' && (
                        <form onSubmit={handleSendEmail} className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Recipient's Email</label>
                                <Input
                                    autoFocus
                                    type="email"
                                    placeholder="friend@example.com"
                                    value={recipientEmail}
                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                    required
                                    className="h-12 bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/10 rounded-xl"
                                />
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl flex items-start gap-3">
                                <div className="shrink-0 bg-amber-100 dark:bg-amber-900/50 p-1.5 rounded-full text-amber-600 dark:text-amber-400 mt-0.5">
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                                <p className="text-[11px] text-amber-800/80 dark:text-amber-200/60 leading-relaxed font-medium">
                                    Once they claim the ticket from the email, it will be removed from your account and their access will be generated.
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="h-12 text-sm font-bold bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-90 transition-all"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                    {loading ? 'Sending...' : 'Send Ticket'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setStep('method')}
                                    className="h-10 text-xs font-medium text-gray-400 hover:text-black dark:hover:text-white"
                                >
                                    Go Back
                                </Button>
                            </div>
                        </form>
                    )}

                    {step === 'link' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-3 rounded-lg flex items-start gap-3">
                                <div className="shrink-0 bg-amber-100 dark:bg-amber-800/50 p-1 rounded-full text-amber-600 dark:text-amber-400 mt-0.5">
                                    <ArrowRight className="w-3 h-3" />
                                </div>
                                <p className="text-xs text-amber-800 dark:text-amber-200">
                                    Once claimed, this ticket will be removed from your account and a new QR code will be generated for the recipient.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-muted-foreground">Transfer Link</label>
                                <div className="flex gap-2">
                                    <Input readOnly value={transferLink} className="font-mono text-xs bg-muted" />
                                    <Button size="icon" onClick={handleCopy}>
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex justify-center pt-4">
                                <QRCode value={transferLink} size={150} />
                            </div>
                            <p className="text-center text-xs text-muted-foreground">Scan to claim</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
