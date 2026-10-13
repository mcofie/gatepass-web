'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, CreditCard, Globe2, MapPin, QrCode, Ticket as TicketIcon, X } from 'lucide-react'
import QRCode from 'react-qr-code'
import { AddToAppleWallet } from '@/components/ticket/AddToAppleWallet'
import { Ticket, InstalmentReservation } from '@/types/gatepass'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { TransferModal } from '@/components/transfer/TransferModal'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'

interface MyTicketsClientProps {
    tickets: Ticket[]
    instalments?: InstalmentReservation[]
}

interface GroupedEvent {
    event: {
        id: string
        title: string
        poster_url?: string | null
        starts_at: string
        ends_at?: string | null
        venue_name: string
    }
    tickets: Ticket[]
    instalments: InstalmentReservation[]
}

type Filter = 'all' | 'upcoming' | 'past'
type Sort = 'event-asc' | 'event-desc' | 'purchase-desc' | 'purchase-asc'

const primaryAction = 'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#111] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5] dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#080808]'
const secondaryAction = 'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#dedede] px-4 text-[13px] font-semibold text-[#222] transition-colors hover:border-[#aaa] hover:bg-[#f7f7f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:border-[#383838] dark:text-white dark:hover:bg-[#202020] dark:focus-visible:ring-white'

function displayTierName(name?: string) {
    if (!name) return 'General admission'
    if (/^virtual\s*\/\s*livestream\s*\/\s*online$/i.test(name)) return 'Livestream'
    if (/^pay[\s-]*what[\s-]*you[\s-]*want\s*\/\s*pay[\s-]*what[\s-]*you[\s-]*can$/i.test(name)) return 'Pay what you want'
    return name
}

function statusLabel(status: Ticket['status'], eventEnded: boolean) {
    return status === 'valid' ? eventEnded ? 'Unused' : 'Valid' : status === 'used' ? 'Used' : 'Cancelled'
}

function hasEventEnded(event: GroupedEvent['event'], now: number) {
    const start = new Date(event.starts_at).getTime()
    const end = event.ends_at ? new Date(event.ends_at).getTime() : start + 4 * 60 * 60 * 1000
    return end < now
}

export function MyTicketsClient({ tickets, instalments = [] }: MyTicketsClientProps) {
    const router = useRouter()
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [isTransferring, setIsTransferring] = useState(false)
    const [showQR, setShowQR] = useState(false)
    const [activeFilter, setActiveFilter] = useState<Filter>('all')
    const [sortBy, setSortBy] = useState<Sort>('event-asc')
    const [currentPage, setCurrentPage] = useState(1)

    const safeTickets = tickets || []
    const safeInstalments = instalments || []
    const now = Date.now()

    const groupedItems = [...safeTickets, ...safeInstalments].reduce<Record<string, GroupedEvent>>((groups, item) => {
        const isInstalment = 'amount_paid' in item
        const event = isInstalment ? (item as InstalmentReservation).reservations?.events : (item as Ticket).events
        if (!event) return groups

        groups[event.id] ??= { event, tickets: [], instalments: [] }
        if (isInstalment) groups[event.id].instalments.push(item as InstalmentReservation)
        else groups[event.id].tickets.push(item as Ticket)
        return groups
    }, {})

    const allGroups = Object.values(groupedItems)
    const upcomingCount = allGroups.filter(({ event }) => !hasEventEnded(event, now)).length
    const pastCount = allGroups.length - upcomingCount
    const filteredGroups = allGroups.filter(({ event }) => {
        if (activeFilter === 'all') return true
        const isUpcoming = !hasEventEnded(event, now)
        return activeFilter === 'upcoming' ? isUpcoming : !isUpcoming
    })
    const sortedGroups = filteredGroups.sort((a, b) => {
        const dateA = new Date(a.event.starts_at).getTime()
        const dateB = new Date(b.event.starts_at).getTime()
        if (sortBy === 'event-asc') {
            const upcomingA = !hasEventEnded(a.event, now)
            const upcomingB = !hasEventEnded(b.event, now)
            if (upcomingA !== upcomingB) return upcomingA ? -1 : 1
            return upcomingA ? dateA - dateB : dateB - dateA
        }
        if (sortBy === 'event-desc') return dateB - dateA

        const purchaseTime = (group: GroupedEvent) => {
            const times = [...group.tickets.map(ticket => new Date(ticket.created_at).getTime()), ...group.instalments.map(plan => new Date(plan.created_at).getTime())]
            return sortBy === 'purchase-desc' ? Math.max(...times) : Math.min(...times)
        }
        return sortBy === 'purchase-desc' ? purchaseTime(b) - purchaseTime(a) : purchaseTime(a) - purchaseTime(b)
    })

    const itemsPerPage = 5
    const totalPages = Math.ceil(sortedGroups.length / itemsPerPage)
    const page = Math.min(currentPage, Math.max(1, totalPages))
    const paginatedGroups = sortedGroups.slice((page - 1) * itemsPerPage, page * itemsPerPage)

    const openCode = (ticket: Ticket) => {
        setSelectedTicket(ticket)
        setShowQR(true)
    }
    const openTransfer = (ticket: Ticket) => {
        setSelectedTicket(ticket)
        setIsTransferring(true)
    }

    if (safeTickets.length === 0 && safeInstalments.length === 0) {
        return (
            <div className="rounded-[20px] border border-[#e5e5e5] dark:border-[#303030]">
                <EmptyState
                    illustration="ticket"
                    title="No tickets yet"
                    description="When you book an event, your passes appear here."
                    action={<Link href="/" className={primaryAction}>Explore events <ArrowRight className="size-4" aria-hidden="true" /></Link>}
                />
            </div>
        )
    }

    return (
        <div>
            <div className="mb-5 flex flex-col gap-2 border-b sm:mb-7 sm:gap-4 border-[#e8e8e8] sm:flex-row sm:items-end sm:justify-between dark:border-[#2e2e2e]">
                <div className="flex gap-6 overflow-x-auto" aria-label="Filter events">
                    {([
                        { id: 'all', label: 'All events', count: allGroups.length },
                        { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
                        { id: 'past', label: 'Past', count: pastCount },
                    ] as const).map((filter) => (
                        <button
                            key={filter.id}
                            type="button"
                            aria-pressed={activeFilter === filter.id}
                            onClick={() => { setActiveFilter(filter.id); setCurrentPage(1) }}
                            className={`flex h-11 shrink-0 items-center gap-1.5 border-b-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white ${activeFilter === filter.id ? 'border-black text-black dark:border-white dark:text-white' : 'border-transparent text-[#777] hover:text-black dark:text-[#999] dark:hover:text-white'}`}
                        >
                            {filter.label}<span className="text-[11px] font-medium opacity-65">{filter.count}</span>
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 pb-4 sm:pb-2">
                    <label htmlFor="ticket-sort" className="shrink-0 text-[12px] font-medium text-[#777] dark:text-[#999]">Sort</label>
                    <div className="relative">
                        <select
                            id="ticket-sort"
                            value={sortBy}
                            onChange={(event) => { setSortBy(event.target.value as Sort); setCurrentPage(1) }}
                            className="h-9 appearance-none rounded-lg border border-[#dedede] bg-white pl-3 pr-8 text-[12px] font-medium text-[#222] outline-none focus:border-black focus:ring-2 focus:ring-black/10 dark:border-[#383838] dark:bg-[#101010] dark:text-white dark:focus:border-white"
                        >
                            <option value="event-asc">Upcoming first</option>
                            <option value="event-desc">Event date: latest</option>
                            <option value="purchase-desc">Recently purchased</option>
                            <option value="purchase-asc">Oldest purchase</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#777]" aria-hidden="true" />
                    </div>
                </div>
            </div>

            {paginatedGroups.length === 0 ? (
                <div className="rounded-[20px] border border-[#e5e5e5] dark:border-[#303030]">
                    <EmptyState
                        illustration="calendar"
                        title={`No ${activeFilter} events`}
                        description="Your other passes are still in All events."
                        action={<button type="button" onClick={() => setActiveFilter('all')} className={secondaryAction}>View all tickets</button>}
                    />
                </div>
            ) : (
                <div className="space-y-5 sm:space-y-8">
                    {paginatedGroups.map(({ event, tickets: eventTickets, instalments: eventInstalments }) => (
                        <section key={event.id} aria-labelledby={`event-${event.id}`} className="overflow-hidden rounded-[20px] border border-[#e5e5e5] dark:border-[#303030]">
                            <div className="flex items-center gap-4 border-b border-[#eaeaea] bg-[#fafafa] px-4 py-4 sm:px-6 dark:border-[#303030] dark:bg-[#111]">
                                <div className="relative size-12 shrink-0 overflow-hidden rounded-xl sm:size-14 bg-[#e9e9e9] dark:bg-[#222]">
                                    {event.poster_url ? <Image src={event.poster_url} alt="" fill className="object-cover" /> : <TicketIcon className="absolute left-4 top-4 size-6 text-[#777]" aria-hidden="true" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <h2 id={`event-${event.id}`} className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.035em] sm:text-[20px]">{event.title}</h2>
                                        {hasEventEnded(event, now) && <span className="text-[11px] font-medium text-[#777] dark:text-[#aaa]">Past event</span>}
                                    </div>
                                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#666] dark:text-[#aaa]">
                                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden="true" />{formatDateTime(event.starts_at)}</span>
                                        {event.venue_name && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{event.venue_name}</span>}
                                    </p>
                                </div>
                                <Link href={`/events/${event.id}`} aria-label={`View ${event.title}`} className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#555] transition-colors hover:bg-[#eee] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:text-[#aaa] dark:hover:bg-[#292929] dark:hover:text-white dark:focus-visible:ring-white">
                                    <ArrowUpRight className="size-4" aria-hidden="true" />
                                </Link>
                            </div>

                            <div className="divide-y divide-[#eaeaea] dark:divide-[#303030]">
                                {eventTickets.map((ticket) => {
                                    const isVirtual = Boolean(ticket.ticket_tiers?.is_virtual)
                                    const virtualLink = ticket.ticket_tiers?.virtual_link
                                    const isValid = ticket.status === 'valid'
                                    const eventEnded = hasEventEnded(event, now)
                                    const ticketHint = !isValid
                                        ? ticket.status === 'used' ? 'Already checked in' : 'This pass is no longer active'
                                        : eventEnded
                                            ? isVirtual && virtualLink ? 'Stream link is available' : 'Event has ended'
                                            : isVirtual
                                                ? virtualLink ? 'Stream link is ready' : 'Stream details are on your pass'
                                                : 'Show this code at entry'
                                    return (
                                        <article key={ticket.id} className="px-4 py-4 sm:px-6">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f3f3f3] text-[#444] dark:bg-[#222] dark:text-[#ccc]">
                                                        {isVirtual ? <Globe2 className="size-4" strokeWidth={1.7} aria-hidden="true" /> : <TicketIcon className="size-4" strokeWidth={1.7} aria-hidden="true" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="text-[15px] font-semibold leading-5">{displayTierName(ticket.ticket_tiers?.name)}</h3>
                                                        <p className="mt-1 text-[12px] text-[#777] dark:text-[#aaa]">{isVirtual ? 'Online pass' : 'Entry pass'} · #{ticket.id.slice(0, 8)}</p>
                                                    </div>
                                                </div>
                                                <span className={`inline-flex shrink-0 items-center gap-1.5 pt-1 text-[11px] font-medium ${ticket.status === 'cancelled' ? 'text-red-600 dark:text-red-400' : 'text-[#666] dark:text-[#aaa]'}`}>
                                                    <span className={`size-1.5 rounded-full ${ticket.status === 'cancelled' ? 'bg-red-500' : ticket.status === 'used' ? 'bg-[#999]' : 'bg-[#111] dark:bg-white'}`} />
                                                    {statusLabel(ticket.status, eventEnded)}
                                                </span>
                                            </div>
                                            <div className="mt-4 flex flex-col gap-3 sm:mt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:pl-12">
                                                <p className="text-[12px] text-[#777] dark:text-[#aaa]">{ticketHint}</p>
                                                <div className="grid grid-cols-2 gap-2 *:w-full sm:flex sm:flex-wrap sm:items-center sm:*:w-auto [&>*:first-child:last-child]:col-span-2">
                                                    {!isValid ? (
                                                        <Link href={`/ticket/${ticket.id}`} className={secondaryAction}>View pass <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
                                                    ) : isVirtual && virtualLink ? (
                                                        <a href={virtualLink} target="_blank" rel="noopener noreferrer" className={primaryAction}>{eventEnded ? 'Open stream' : 'Join stream'} <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
                                                    ) : isVirtual || eventEnded ? (
                                                        <Link href={`/ticket/${ticket.id}`} className={primaryAction}>View pass <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
                                                    ) : (
                                                        <button type="button" onClick={() => openCode(ticket)} className={primaryAction}><QrCode className="size-3.5" aria-hidden="true" />Show code</button>
                                                    )}
                                                    {isValid && !isVirtual && !eventEnded && <button type="button" onClick={() => openTransfer(ticket)} className={secondaryAction}>Transfer</button>}
                                                    {isValid && !isVirtual && !eventEnded && <AddToAppleWallet ticketId={ticket.id} className="col-span-2 h-10 rounded-full px-3.5 text-[12px] sm:h-9" />}
                                                </div>
                                            </div>
                                        </article>
                                    )
                                })}

                                {eventInstalments.map((plan) => {
                                    const remaining = Math.max(0, plan.total_amount - plan.amount_paid)
                                    const progress = plan.total_amount > 0 ? Math.min(100, Math.max(0, plan.amount_paid / plan.total_amount * 100)) : 0
                                    const currency = plan.currency || plan.reservations?.ticket_tiers?.currency || 'GHS'
                                    const eventEnded = hasEventEnded(event, now)
                                    const dueDate = plan.next_instalment_due_at ? new Date(plan.next_instalment_due_at) : null
                                    const dueLabel = dueDate && !Number.isNaN(dueDate.getTime()) && plan.status === 'active'
                                        ? `${dueDate.getTime() < now ? 'Payment was due' : 'Next payment'} ${dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                        : `Plan #${plan.id.slice(0, 8)}`
                                    return (
                                        <article key={plan.id} className="px-4 py-5 sm:px-6">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f3f3f3] text-[#444] dark:bg-[#222] dark:text-[#ccc]">
                                                        <CreditCard className="size-4" strokeWidth={1.7} aria-hidden="true" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="text-[15px] font-semibold leading-5">Payment plan</h3>
                                                        <p className="mt-1 text-[12px] text-[#777] dark:text-[#aaa]">{displayTierName(plan.reservations?.ticket_tiers?.name)} · {plan.reservations?.quantity || 1} {plan.reservations?.quantity === 1 ? 'ticket' : 'tickets'}</p>
                                                    </div>
                                                </div>
                                                <span className="inline-flex shrink-0 items-center gap-1.5 pt-1 text-[11px] font-medium capitalize text-[#666] dark:text-[#aaa]"><span className="size-1.5 rounded-full bg-[#111] dark:bg-white" />{plan.status === 'active' ? eventEnded ? 'Event ended' : 'In progress' : plan.status}</span>
                                            </div>
                                            <div className="mt-4 sm:pl-12">
                                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px]">
                                                    <span><strong className="font-semibold">{formatCurrency(plan.amount_paid, currency)}</strong><span className="text-[#777] dark:text-[#aaa]"> of {formatCurrency(plan.total_amount, currency)} paid</span></span>
                                                    <span className="font-semibold">{formatCurrency(remaining, currency)} remaining</span>
                                                </div>
                                                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e9e9e9] dark:bg-[#333]" role="progressbar" aria-label="Payment progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                                                    <div className="h-full rounded-full bg-[#111] dark:bg-white" style={{ width: `${progress}%` }} />
                                                </div>
                                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                                    <p className="text-[12px] text-[#777] dark:text-[#aaa]">{dueLabel}</p>
                                                    <Link href={`/my-tickets/instalments/${plan.id}`} className={secondaryAction}>Manage plan <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
                                                </div>
                                            </div>
                                        </article>
                                    )
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <nav aria-label="Ticket pages" className="mt-8 flex items-center justify-between border-t border-[#e8e8e8] pt-5 dark:border-[#303030]">
                    <span className="text-[12px] text-[#777] dark:text-[#aaa]">Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                        <button type="button" disabled={page === 1} onClick={() => { setCurrentPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`${secondaryAction} disabled:cursor-not-allowed disabled:opacity-40`}>Previous</button>
                        <button type="button" disabled={page === totalPages} onClick={() => { setCurrentPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`${secondaryAction} disabled:cursor-not-allowed disabled:opacity-40`}>Next</button>
                    </div>
                </nav>
            )}

            {selectedTicket && (
                <TransferModal
                    isOpen={isTransferring}
                    onClose={() => { setIsTransferring(false); setSelectedTicket(null) }}
                    ticketId={selectedTicket.id}
                    eventName={selectedTicket.events?.title || 'Event'}
                    onTransferCreated={() => router.refresh()}
                />
            )}

            <Dialog open={showQR} onOpenChange={(open) => { setShowQR(open); if (!open) setSelectedTicket(null) }}>
                <DialogContent role="dialog" aria-modal="true" aria-labelledby="entry-code-title" className="mx-4 max-w-[360px] rounded-[20px] border-[#e5e5e5] p-6 shadow-xl dark:border-[#303030] dark:bg-[#111]">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 id="entry-code-title" className="text-[22px] font-semibold tracking-[-0.04em]">Entry code</h2>
                            <p className="mt-1 text-[13px] text-[#666] dark:text-[#aaa]">Show this at the door.</p>
                        </div>
                        <button type="button" onClick={() => { setShowQR(false); setSelectedTicket(null) }} aria-label="Close entry code" className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-[#f3f3f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:hover:bg-[#292929] dark:focus-visible:ring-white"><X className="size-4" aria-hidden="true" /></button>
                    </div>
                    <div className="mt-6 flex justify-center rounded-xl border border-[#eaeaea] bg-white p-5"><QRCode value={selectedTicket?.qr_code_hash || ''} size={200} /></div>
                    <p className="mt-5 text-center text-[15px] font-semibold">{selectedTicket?.events?.title}</p>
                    <p className="mt-1 text-center text-[12px] text-[#777] dark:text-[#aaa]">{displayTierName(selectedTicket?.ticket_tiers?.name)} · #{selectedTicket?.id.slice(0, 8)}</p>
                    {selectedTicket && <div className="mt-5 flex justify-center"><AddToAppleWallet ticketId={selectedTicket.id} /></div>}
                </DialogContent>
            </Dialog>
        </div>
    )
}
