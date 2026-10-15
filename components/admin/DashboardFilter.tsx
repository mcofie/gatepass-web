'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const RANGES = [
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: '90d', label: '90 days' },
    { id: 'all', label: 'All time' },
]

export function DashboardFilter() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const current = searchParams.get('range') || '30d'

    const select = (range: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('range', range)
        router.push(`?${params.toString()}`, { scroll: false })
    }

    return (
        <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-full border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-[#0b0b0b]">
            {RANGES.map(range => (
                <button
                    key={range.id}
                    type="button"
                    role="radio"
                    aria-checked={current === range.id}
                    onClick={() => select(range.id)}
                    className={cn('h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors', current === range.id ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white')}
                >
                    {range.label}
                </button>
            ))}
        </div>
    )
}
