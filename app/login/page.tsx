import { Suspense } from 'react'
import { LoginContent } from '@/components/auth/LoginContent'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Login',
}

export default function LoginPage() {
    return (
            <Suspense fallback={<div className="flex min-h-svh items-center justify-center bg-white text-sm text-[#666] dark:bg-[#080808] dark:text-[#aaa]">Loading sign in…</div>}>
            <LoginContent />
        </Suspense>
    )
}
