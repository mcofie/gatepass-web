'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Dashboard Error:', error)
    }, [error])

    return (
        <div className="h-[calc(100vh-80px)] w-full flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mb-4 border border-red-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">Dashboard Error</h3>
            <p className="text-gray-500 max-w-xs mb-6 text-sm">
                We encountered an issue loading this section.
            </p>

            <div className="flex gap-3">
                <button
                    onClick={reset}
                    className="bg-black text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-gray-800 transition-colors"
                >
                    Refresh
                </button>
                <Link href="/dashboard">
                    <button className="px-4 py-2 rounded-lg font-bold text-xs text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200">
                        Dashboard Home
                    </button>
                </Link>
            </div>
        </div>
    )
}
