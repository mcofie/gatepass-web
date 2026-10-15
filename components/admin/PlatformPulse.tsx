'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { UserPlus, CalendarPlus, Banknote, ArrowRight, ShieldAlert } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import Link from 'next/link'

export interface PulseItem {
    id: string
    type: 'user' | 'event' | 'sale' | 'admin_log'
    title: string
    subtitle: string
    timestamp: string
    meta?: any
}

interface PlatformPulseProps {
    items: PulseItem[]
    viewAllLink?: string
}

export function PlatformPulse({ items, viewAllLink }: PlatformPulseProps) {
    if (items.length === 0) {
        return (
            <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-[#0b0b0b] dark:text-gray-400">
                No recent activity.
            </div>
        )
    }

    return (

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10 sm:px-6">
                <h3 className="text-base font-semibold text-gray-950 dark:text-white">Latest activity</h3>
                <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-white/10">
                {items.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03] sm:px-6">
                        {/* Icon */}
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
                            {item.type === 'user' && <UserPlus className="size-4" aria-hidden="true" />}
                            {item.type === 'event' && <CalendarPlus className="size-4" aria-hidden="true" />}
                            {item.type === 'sale' && <Banknote className="size-4" aria-hidden="true" />}
                            {item.type === 'admin_log' && <ShieldAlert className="size-4" aria-hidden="true" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                                <p className="truncate pr-4 text-sm font-medium text-gray-950 dark:text-white">
                                    {item.title}
                                </p>
                                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {item.subtitle}
                            </p>
                        </div>

                        {/* Action Hint */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.type === 'event' && (
                                <Link href={`/admin/events`} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            )}
                            {item.type === 'user' && (
                                <Link href={`/admin/users`} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t border-gray-100 px-5 py-3 text-center dark:border-white/10">
                {viewAllLink ? (
                    <Link href={viewAllLink} className="inline-flex items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-950 dark:text-gray-400 dark:hover:text-white">
                        View all activity <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                ) : (
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Real-time Data</p>
                )}
            </div>
        </div>
    )
}
