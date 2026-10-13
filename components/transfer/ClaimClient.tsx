'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { claimTransferAction } from '@/utils/actions/transfer'

interface ClaimClientProps {
    token: string
    userEmail: string | null
    /** Masked address the sender chose, when the transfer was sent by email */
    recipientHint: string | null
}

const primaryButton = 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111] text-[14px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black'

export function ClaimClient({ token, userEmail, recipientHint }: ClaimClientProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const loginHref = `/login?next=${encodeURIComponent(`/claim/${token}`)}`

    const handleClaim = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await claimTransferAction(token)
            if (res.success) {
                toast.success('Ticket added to your account')
                router.push('/my-tickets')
                return
            }
            if (res.redirect) return router.push(loginHref)
            setError(res.message)
        } catch {
            setError('Something went wrong. Try again.')
        } finally {
            setLoading(false)
        }
    }

    if (!userEmail) {
        return (
            <div className="space-y-3">
                <a href={loginHref} className={primaryButton}>Sign in to claim</a>
                <p className="text-center text-[12px] leading-snug text-[#777] dark:text-[#999]">
                    {recipientHint ? <>Use the email it was sent to ({recipientHint}). New here? We’ll create your account.</> : 'New here? We’ll create your account with your email.'}
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <button type="button" onClick={handleClaim} disabled={loading} className={primaryButton}>
                {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Accept ticket
            </button>
            {error ? (
                <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] leading-snug text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
            ) : (
                <p className="text-center text-[12px] leading-snug text-[#777] dark:text-[#999]">
                    Signed in as <span className="font-semibold text-[#111] dark:text-white">{userEmail}</span>. You’ll get a fresh QR code.
                </p>
            )}
        </div>
    )
}
