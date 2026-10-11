import Image from 'next/image'
import QRCode from 'react-qr-code'
import { ArrowUpRight, CalendarDays, Globe2, MapPin, Ticket as TicketIcon } from 'lucide-react'
import { GatePassMark } from '@/components/branding/GatePassMark'

interface TicketPassProps {
    id?: string
    event: {
        title: string
        poster_url?: string | null
        starts_at: string
        ends_at?: string | null
        venue_name: string
        venue_address: string
    }
    ticket: {
        id: string
        qr_code_hash?: string | null
        status: 'valid' | 'used' | 'cancelled'
        reservations?: {
            guest_name?: string
            profiles?: { full_name?: string }
        }
    }
    tierName?: string
    isPrint?: boolean
    isVirtual?: boolean
    eventEnded: boolean
    virtualLink?: string | null
    virtualInstructions?: string | null
}

function displayTierName(name: string) {
    if (/^virtual\s*\/\s*livestream\s*\/\s*online$/i.test(name)) return 'Livestream'
    if (/^pay[\s-]*what[\s-]*you[\s-]*want\s*\/\s*pay[\s-]*what[\s-]*you[\s-]*can$/i.test(name)) return 'Pay what you want'
    return name
}

function safeExternalUrl(value?: string | null) {
    if (!value) return null
    try {
        const url = new URL(value)
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
    } catch {
        return null
    }
}

function calendarDate(date: Date) {
    return date.toISOString().replace(/[-:]|\.\d{3}/g, '')
}

export function TicketPass({
    id = 'ticket-pass-card',
    event,
    ticket,
    tierName = 'General admission',
    isPrint = false,
    isVirtual = false,
    eventEnded,
    virtualLink,
    virtualInstructions,
}: TicketPassProps) {
    const attendeeName = ticket.reservations?.guest_name || ticket.reservations?.profiles?.full_name || 'Guest'
    const eventDate = new Date(event.starts_at)
    const eventEnd = event.ends_at ? new Date(event.ends_at) : new Date(eventDate.getTime() + 4 * 60 * 60 * 1000)
    const streamUrl = safeExternalUrl(virtualLink)
    const isCancelled = ticket.status === 'cancelled'
    const canEnter = !isVirtual && ticket.status === 'valid' && !eventEnded
    const status = isCancelled ? 'Cancelled' : ticket.status === 'used' ? 'Checked in' : eventEnded ? 'Event ended' : 'Ready to use'
    const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Accra' }).format(eventDate)
    const time = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Accra' }).format(eventDate)
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${calendarDate(eventDate)}/${calendarDate(eventEnd)}&location=${encodeURIComponent(isVirtual ? 'Online' : `${event.venue_name} ${event.venue_address}`.trim())}`
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue_name} ${event.venue_address}`.trim())}`
    const accessTitle = isCancelled ? 'Access unavailable' : streamUrl ? 'Online access' : eventEnded ? 'No stream link available' : 'Stream link pending'
    const accessDescription = isCancelled
        ? 'This pass has been cancelled.'
        : streamUrl
            ? 'Open the link provided by the organizer to access this event.'
            : eventEnded
                ? 'This event has ended and no livestream link was published.'
                : 'The organizer has not added a link yet. Check back closer to the event.'

    return (
        <article id={id} className={`${isPrint ? 'w-[420px]' : 'w-full'} overflow-hidden rounded-[22px] border border-[#e3e3e3] bg-white text-[#111] dark:border-[#303030] dark:bg-[#111] dark:text-white`}>
            <div className="flex items-center gap-4 border-b border-[#e9e9e9] p-5 sm:p-7 dark:border-[#303030]">
                {!isPrint && (
                    <div className="relative size-[68px] shrink-0 overflow-hidden rounded-[14px] bg-[#efefef] dark:bg-[#222]">
                        {event.poster_url ? <Image src={event.poster_url} alt="" fill className="object-cover" sizes="68px" /> : <TicketIcon className="absolute left-[22px] top-[22px] size-6 text-[#777]" aria-hidden="true" />}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#777] dark:text-[#aaa]">Event pass</p>
                    <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.045em] sm:text-[28px]">{event.title}</h2>
                </div>
            </div>

            <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-[#777] dark:text-[#aaa]">Pass #{ticket.id.slice(0, 8)}</span>
                    <span className={`inline-flex items-center gap-2 text-[12px] font-medium ${isCancelled ? 'text-red-600 dark:text-red-400' : 'text-[#444] dark:text-[#ccc]'}`}>
                        <span className={`size-1.5 rounded-full ${isCancelled ? 'bg-red-500' : 'bg-[#111] dark:bg-white'}`} aria-hidden="true" />
                        {status}
                    </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-5 border-b border-[#e9e9e9] pb-6 dark:border-[#303030]">
                    <div>
                        <p className="text-[11px] font-medium text-[#777] dark:text-[#aaa]">Attendee</p>
                        <p className="mt-1 break-words text-[15px] font-semibold leading-5">{attendeeName}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-medium text-[#777] dark:text-[#aaa]">Pass type</p>
                        <p className="mt-1 text-[15px] font-semibold leading-5">{displayTierName(tierName)}</p>
                    </div>
                </div>

                {isVirtual ? (
                    <div className="mt-6 rounded-[16px] border border-[#e7e7e7] bg-[#fafafa] p-5 dark:border-[#333] dark:bg-[#1b1b1b]">
                        <div className="flex items-start gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#333] dark:bg-[#292929] dark:text-white"><Globe2 className="size-4" strokeWidth={1.7} aria-hidden="true" /></div>
                            <div className="min-w-0">
                                <h3 className="text-[15px] font-semibold">{accessTitle}</h3>
                                <p className="mt-1 text-[13px] leading-5 text-[#666] dark:text-[#aaa]">{accessDescription}</p>
                            </div>
                        </div>
                        {streamUrl && !isCancelled && (isPrint ? (
                            <p className="mt-4 break-all text-[12px] text-[#555]">{streamUrl}</p>
                        ) : (
                            <a href={streamUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#111] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5] dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#1b1b1b]">Open stream <ArrowUpRight className="size-4" aria-hidden="true" /></a>
                        ))}
                        {virtualInstructions && !isCancelled && (
                            <div className="mt-5 border-t border-[#e7e7e7] pt-4 dark:border-[#333]">
                                <p className="text-[11px] font-medium text-[#777] dark:text-[#aaa]">Organizer notes</p>
                                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5">{virtualInstructions}</p>
                            </div>
                        )}
                    </div>
                ) : canEnter ? (
                    <div className="mt-6 flex flex-col items-center rounded-[16px] border border-[#e7e7e7] p-6 text-center dark:border-[#333]">
                        <div className="rounded-[10px] bg-white p-3" role="img" aria-label="Entry QR code"><QRCode value={ticket.qr_code_hash || ticket.id} size={188} fgColor="#111111" bgColor="#ffffff" /></div>
                        <p className="mt-4 text-[13px] font-semibold">Show this code at entry</p>
                        <p className="mt-1 text-[12px] text-[#777] dark:text-[#aaa]">Keep this pass ready at the door.</p>
                    </div>
                ) : (
                    <div className="mt-6 rounded-[16px] border border-[#e7e7e7] bg-[#fafafa] p-5 dark:border-[#333] dark:bg-[#1b1b1b]">
                        <p className="text-[15px] font-semibold">{isCancelled ? 'Entry unavailable' : ticket.status === 'used' ? 'Already checked in' : 'Entry has closed'}</p>
                        <p className="mt-1 text-[13px] leading-5 text-[#666] dark:text-[#aaa]">{isCancelled ? 'This pass has been cancelled.' : ticket.status === 'used' ? 'This pass was already used for entry.' : 'This event has ended.'}</p>
                    </div>
                )}

                <div className="mt-7 grid grid-cols-2 gap-5 border-t border-[#e9e9e9] pt-6 dark:border-[#303030]">
                    <div>
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#777] dark:text-[#aaa]"><CalendarDays className="size-3.5" aria-hidden="true" />Date</p>
                        <p className="mt-1 text-[14px] font-semibold">{date}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-medium text-[#777] dark:text-[#aaa]">Time</p>
                        <p className="mt-1 text-[14px] font-semibold">{time}</p>
                    </div>
                    <div className="col-span-2">
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#777] dark:text-[#aaa]">{isVirtual ? <Globe2 className="size-3.5" aria-hidden="true" /> : <MapPin className="size-3.5" aria-hidden="true" />}{isVirtual ? 'Access' : 'Venue'}</p>
                        <p className="mt-1 text-[14px] font-semibold">{isVirtual ? 'Online event' : event.venue_name}</p>
                        {!isVirtual && event.venue_address && <p className="mt-0.5 text-[12px] text-[#777] dark:text-[#aaa]">{event.venue_address}</p>}
                    </div>
                </div>

                {!isPrint && !eventEnded && !isCancelled && (
                    <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-semibold">
                        <a href={calendarUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#444] hover:text-black hover:underline dark:text-[#ccc] dark:hover:text-white">Add to calendar <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
                        {!isVirtual && <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#444] hover:text-black hover:underline dark:text-[#ccc] dark:hover:text-white">View location <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-[#e9e9e9] px-5 py-4 text-[11px] font-medium text-[#777] sm:px-7 dark:border-[#303030] dark:text-[#aaa]">
                <span className="inline-flex items-center gap-2"><GatePassMark className="size-4 text-[#111] dark:text-white" />GatePass</span>
                <span>Pass #{ticket.id.slice(0, 8)}</span>
            </div>
        </article>
    )
}
