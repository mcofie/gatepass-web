'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'

export function DashboardFilter() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentRange = searchParams.get('range') || '30d'

    const handleRangeChange = (range: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('range', range)
        router.push(`?${params.toString()}`)
    }

    return (
        <div className="flex items-center gap-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 p-1 rounded-lg">
            <button
                onClick={() => handleRangeChange('7d')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${currentRange === '7d' ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
                7D
            </button>
            <button
                onClick={() => handleRangeChange('30d')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${currentRange === '30d' ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
                30D
            </button>
            <button
                onClick={() => handleRangeChange('90d')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${currentRange === '90d' ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
                3M
            </button>
            <button
                onClick={() => handleRangeChange('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${currentRange === 'all' ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
                All
            </button>
        </div>
    )
}
