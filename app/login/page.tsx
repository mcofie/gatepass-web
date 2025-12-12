import { Suspense } from 'react'
import { LoginContent } from '@/components/auth/LoginContent'

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <LoginContent />
        </Suspense>
    )
}
