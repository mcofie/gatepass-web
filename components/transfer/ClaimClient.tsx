'use client'

import { useState } from 'react'
import { claimTransferAction } from '@/utils/actions/transfer'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowRight, LogIn } from 'lucide-react'

interface ClaimClientProps {
    token: string
    isLoggedIn: boolean
    userEmail?: string
}

export function ClaimClient({ token, isLoggedIn, userEmail }: ClaimClientProps) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleClaim = async () => {
        setLoading(true)
        try {
            const res = await claimTransferAction(token)
            if (res.success) {
                toast.success('Ticket claimed successfully!')
                router.push('/my-tickets')
            } else {
                toast.error(res.message || 'Failed to claim ticket')
            }
        } catch (e) {
            toast.error('An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const handleLogin = () => {
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(`/claim/${token}`)
        router.push(`/login?next=${returnUrl}`)
    }

    return (
        <div className="space-y-4">
            {isLoggedIn ? (
                <>
                    <p className="text-sm text-center text-gray-500 mb-2">
                        Claiming as <span className="font-bold text-black dark:text-white">{userEmail}</span>
                    </p>
                    <Button
                        onClick={handleClaim}
                        disabled={loading}
                        className="w-full h-12 text-base font-bold"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {loading ? 'Claiming...' : 'Accept Ticket'}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                        By accepting, this ticket will be added to your account.
                    </p>
                </>
            ) : (
                <>
                    <p className="text-sm text-center text-gray-500 mb-2">
                        You need to log in to claim this ticket.
                    </p>
                    <Button
                        onClick={handleLogin}
                        className="w-full h-12 text-base font-bold bg-black dark:bg-white text-white dark:text-black"
                    >
                        <LogIn className="w-4 h-4 mr-2" /> Login to Claim
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                        We'll verify your email to create an account securely.
                    </p>
                </>
            )}
        </div>
    )
}
