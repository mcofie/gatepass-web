'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EventSection = 'details' | 'tickets' | 'attendees' | 'discounts' | 'sales' | 'team' | 'lineup' | 'addons' | 'widgets' | 'instalments' | 'forms'

type Item = { id: EventSection; label: string; description?: string; adminOnly?: boolean }

// Day-to-day work stays in view; setup and occasional tools sit under More
const PRIMARY: Item[] = [
    { id: 'details', label: 'Overview' },
    { id: 'tickets', label: 'Tickets' },
    { id: 'attendees', label: 'Guest list' },
    { id: 'sales', label: 'Sales', adminOnly: true },
    { id: 'discounts', label: 'Promotions', adminOnly: true },
]

const MORE: Item[] = [
    { id: 'addons', label: 'Add-ons', description: 'Merch, parking and upgrades' },
    { id: 'forms', label: 'Forms', description: 'Questions after checkout', adminOnly: true },
    { id: 'instalments', label: 'Instalments', description: 'Payment plans', adminOnly: true },
    { id: 'widgets', label: 'Embed', description: 'Sell on your own site' },
    { id: 'team', label: 'Team', description: 'Staff and door scanners' },
]

export function EventSectionNav({ active, onChange, isAdmin }: { active: EventSection; onChange: (section: EventSection) => void; isAdmin: boolean }) {
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const primary = PRIMARY.filter(i => isAdmin || !i.adminOnly)
    const more = MORE.filter(i => isAdmin || !i.adminOnly)
    const activeMore = more.find(i => i.id === active)

    useEffect(() => {
        if (!open) return
        const onPointer = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false) }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('pointerdown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onPointer)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    // Keep the selected tab visible when the row scrolls on small screens
    useEffect(() => {
        const row = scrollRef.current
        const selected = row?.querySelector<HTMLElement>('[aria-current="page"]')
        if (!row || !selected) return
        const left = selected.offsetLeft - (row.clientWidth - selected.offsetWidth) / 2
        row.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }, [active])

    const tab = (selected: boolean) => cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors',
        selected ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white',
    )

    return (
        <nav aria-label="Event sections" className="flex items-center gap-1 border-b border-gray-200 pb-3 dark:border-white/10">
            <div ref={scrollRef} className="-ml-1 flex min-w-0 items-center gap-1 overflow-x-auto pl-1 [scrollbar-width:none]">
                {primary.map(item => (
                    <button key={item.id} type="button" aria-current={active === item.id ? 'page' : undefined} onClick={() => onChange(item.id)} className={tab(active === item.id)}>
                        {item.label}
                    </button>
                ))}
            </div>

            <div ref={menuRef} className="relative shrink-0">
                <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)} className={tab(!!activeMore)}>
                    {activeMore ? activeMore.label : 'More'}
                    <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                </button>
                {open && (
                    <div role="menu" className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 dark:border-white/10 dark:bg-[#111]">
                        {more.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                role="menuitem"
                                onClick={() => { onChange(item.id); setOpen(false) }}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-gray-950 dark:text-white">{item.label}</span>
                                    {item.description && <span className="block text-xs text-gray-500 dark:text-gray-400">{item.description}</span>}
                                </span>
                                {active === item.id && <Check className="size-4 text-gray-950 dark:text-white" aria-hidden="true" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </nav>
    )
}
