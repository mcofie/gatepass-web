'use client'

import { useState } from 'react'
import { Ticket } from '@/types/gatepass'
import { formatDateTime } from '@/utils/format'
import { TransferModal } from '@/components/transfer/TransferModal'
import { Button } from '@/components/ui/Button'
import { Share2, QrCode, Download, Calendar, MapPin, Ticket as TicketIcon } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import QRCode from 'react-qr-code'
import Image from 'next/image'

interface MyTicketsClientProps {
    tickets: Ticket[]
}

export function MyTicketsClient({ tickets }: MyTicketsClientProps) {
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [isTransferring, setIsTransferring] = useState(false)
    const [showQR, setShowQR] = useState(false)

    // Group by Event
    const groupedTickets = tickets.reduce((acc, ticket) => {
        const eventId = ticket.event_id
        if (!acc[eventId]) {
            acc[eventId] = {
                event: ticket.events!,
                tickets: []
            }
        }
        acc[eventId].tickets.push(ticket)
        return acc
    }, {} as Record<string, { event: any, tickets: Ticket[] }>) // using any for event temporarily

    const handleTransfer = (ticket: Ticket) => {
        setSelectedTicket(ticket)
        setIsTransferring(true)
    }

    const handleViewQR = (ticket: Ticket) => {
        setSelectedTicket(ticket)
        setShowQR(true)
    }

    // Sort groups by event date (soonest first)
    const sortedGroups = Object.values(groupedTickets).sort((a, b) => {
        return new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()
    })

    if (tickets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                    <TicketIcon className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">No Tickets Yet</h3>
                <p className="text-gray-500 mb-8 max-w-sm">
                    You haven't purchased any tickets yet. Explore events to find your next experience.
                </p>
                <Button onClick={() => window.location.href = '/'}>
                    Explore Events
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            {sortedGroups.map(({ event, tickets }, index) => (
                <div key={event.id} className="space-y-6">
                    {/* Visual Divider for subsequent events */}
                    {index > 0 && (
                        <div className="border-t border-gray-100 dark:border-white/5 pb-6" />
                    )}

                    <div className="flex items-center gap-4 md:gap-5">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl relative overflow-hidden flex-shrink-0 shadow-sm border border-black/5 dark:border-white/10">
                            {event.poster_url ? (
                                <Image src={event.poster_url} alt={event.title} fill className="object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                                    <TicketIcon className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                                </div>
                            )}
                        </div>
                        <div className="space-y-1.5 min-w-0">
                            <h2 className="text-xl md:text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none truncate">{event.title}</h2>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">
                                <span className="flex items-center gap-1.5 whitespace-nowrap"><Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" /> {formatDateTime(event.starts_at)}</span>
                                <span className="flex items-center gap-1.5 whitespace-nowrap"><MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" /> {event.venue_name}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {tickets.map(ticket => (
                            <div key={ticket.id} className="group relative bg-white dark:bg-[#111] border border-gray-100 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                                {/* Ticket Stub Effect: Dashed Line & Notches */}
                                <div className="absolute top-[65%] left-0 right-0 h-px border-t-2 border-dashed border-gray-100 dark:border-white/10" />
                                <div className="absolute top-[65%] -left-3 -translate-y-1/2 w-6 h-6 bg-white dark:bg-black rounded-full border border-gray-100 dark:border-white/10 dark:border-l-transparent dark:border-t-transparent border-r-transparent border-b-transparent rotate-45" />
                                <div className="absolute top-[65%] -right-3 -translate-y-1/2 w-6 h-6 bg-white dark:bg-black rounded-full border border-gray-100 dark:border-white/10 dark:border-l-transparent dark:border-t-transparent border-l-transparent border-t-transparent -rotate-45" />

                                {/* Upper Section: Info */}
                                <div className="p-6 pb-8">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em]">
                                                {ticket.ticket_tiers?.name || 'General Access'}
                                            </p>
                                            <p className="text-xs font-mono text-gray-400 font-medium lowercase tracking-wide">
                                                #{ticket.id.slice(0, 8)}
                                            </p>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${ticket.status === 'valid'
                                            ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                                            : ticket.status === 'used'
                                                ? 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-500 dark:border-white/10'
                                                : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                            }`}>
                                            {ticket.status}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                                            <TicketIcon className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <div className="text-xs text-gray-400 font-medium">
                                            Standard Entry Ticket
                                        </div>
                                    </div>
                                </div>

                                {/* Lower Section: Actions */}
                                <div className="bg-gray-50/50 dark:bg-white/[0.02] p-4 pt-6 flex gap-3">
                                    <Button
                                        className="flex-1 h-11 rounded-xl text-xs md:text-sm font-bold bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 shadow-md transition-all active:scale-95 gap-2"
                                        onClick={() => handleViewQR(ticket)}
                                    >
                                        <QrCode size={16} />
                                        <span>Show Code</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11 rounded-xl border-gray-200 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 transition-all active:scale-95 bg-white dark:bg-transparent"
                                        onClick={() => handleTransfer(ticket)}
                                    >
                                        <Share2 size={16} />
                                    </Button>
                                    {ticket.status === 'valid' && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-11 w-11 rounded-xl border-gray-200 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/5 transition-all active:scale-95 bg-white dark:bg-transparent"
                                            onClick={() => { }}
                                        >
                                            <Download size={16} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {
                selectedTicket && (
                    <TransferModal
                        isOpen={isTransferring}
                        onClose={() => { setIsTransferring(false); setSelectedTicket(null); }}
                        ticketId={selectedTicket?.id || ''}
                        eventName={selectedTicket?.events?.title || 'Event'}
                        onTransferCreated={() => {
                            // refresh page or state? For now user can manually refresh or we can add a router refresh
                        }}
                    />
                )
            }

            <Dialog open={showQR} onOpenChange={setShowQR}>
                <DialogContent className="sm:max-w-sm flex flex-col items-center p-8">
                    <h3 className="text-lg font-bold mb-6 text-center">Scan at Entry</h3>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-inner">
                        <QRCode value={selectedTicket?.qr_code_hash || ''} size={200} />
                    </div>
                    <div className="mt-6 text-center">
                        <p className="font-bold text-lg mb-1">{selectedTicket?.events?.title}</p>
                        <p className="text-sm text-gray-500 mb-4">{selectedTicket?.ticket_tiers?.name}</p>
                        <p className="text-xs font-mono text-gray-400 bg-gray-50 dark:bg-zinc-800 px-3 py-1 rounded-full">
                            {selectedTicket?.qr_code_hash?.slice(0, 16)}...
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    )
}
