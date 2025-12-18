'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function LoginNotification() {
    const searchParams = useSearchParams()
    const router = useRouter()

    useEffect(() => {
        if (searchParams.get('login') === 'success') {
            toast.success('Welcome back to GatePass!')

            // Clean up the URL
            const newUrl = new URL(window.location.href)
            newUrl.searchParams.delete('login')
            router.replace(newUrl.pathname + newUrl.search)
        }
    }, [searchParams, router])

    return null
}
