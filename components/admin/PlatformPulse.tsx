'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { UserPlus, CalendarPlus, Banknote, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import Link from 'next/link'

interface PulseItem {
    id: string
    type: 'user' | 'event' | 'sale'
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
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 text-center text-gray-500">
                No recent activity found.
            </div>
        )
    }

    return (

        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Platform Pulse</h3>
                <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-white/10">
                {items.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-4 group">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-inner ${item.type === 'user' ? 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-500/20 dark:text-blue-400' :
                            item.type === 'event' ? 'bg-purple-50 border-purple-100 text-purple-600 dark:bg-purple-900/20 dark:border-purple-500/20 dark:text-purple-400' :
                                'bg-green-50 border-green-100 text-green-600 dark:bg-green-900/20 dark:border-green-500/20 dark:text-green-400'
                            }`}>
                            {item.type === 'user' && <UserPlus className="w-5 h-5" />}
                            {item.type === 'event' && <CalendarPlus className="w-5 h-5" />}
                            {item.type === 'sale' && <Banknote className="w-5 h-5" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate pr-4">
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

            <div className="p-3 bg-gray-50 dark:bg-white/5 text-center border-t border-gray-100 dark:border-white/10">
                {viewAllLink ? (
                    <Link href={viewAllLink} className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white uppercase tracking-wider transition-colors flex items-center justify-center gap-1">
                        View All Activity <ArrowRight className="w-3 h-3" />
                    </Link>
                ) : (
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Real-time Data</p>
                )}
            </div>
        </div>
    )
}
