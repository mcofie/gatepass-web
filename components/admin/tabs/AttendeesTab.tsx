import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, Download, ScanLine, QrCode, Upload, FileText, X, Loader2 } from 'lucide-react'
import { generateCSV, downloadCSV } from '@/utils/analytics'
import clsx from 'clsx'
import { toast } from 'sonner'
import { Event, TicketTier } from '@/types/gatepass'
import { QRCodeModal } from '@/components/admin/QRCodeModal'
import { GuestImportModal } from '@/components/admin/GuestImportModal'

interface AttendeesTabProps {
    event: Event
    tiers?: TicketTier[]
    isStaff?: boolean
}

export function AttendeesTab({ event, tiers = [], isStaff = false }: AttendeesTabProps) {
    const [tickets, setTickets] = useState<any[]>([])
    const [loadingTickets, setLoadingTickets] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isCheckInMode, setIsCheckInMode] = useState(false)
    const [ticketPage, setTicketPage] = useState(0)
    const [ticketCount, setTicketCount] = useState(0)
    const [selectedTicketForQR, setSelectedTicketForQR] = useState<any>(null)
    const [showImportModal, setShowImportModal] = useState(false)
    const [selectedReservationForForms, setSelectedReservationForForms] = useState<{ reservationId: string; userId: string | null; name: string } | null>(null)
    const TICKETS_PER_PAGE = 20

    const supabase = createClient()

    const fetchTickets = async (page = 0) => {
        setLoadingTickets(true)
        const from = page * TICKETS_PER_PAGE
        const to = from + TICKETS_PER_PAGE - 1

        let query = supabase
            .schema('gatepass')
            .from('tickets')
            .select(`
                id, status, order_reference, created_at, reservation_id,
                ticket_tiers ( name, price, currency ),
                reservations ( guest_name, guest_email ),
                profiles ( full_name, id, email )
            `, { count: 'exact' })
            .eq('event_id', event.id)
            .order('created_at', { ascending: false })
            .range(from, to)

        if (searchQuery) {
            query = query.ilike('profiles.full_name', `%${searchQuery}%`)
        }

        const { data, count } = await query

        if (data) {
            setTickets(data)
            setTicketCount(count || 0)
        }
        setLoadingTickets(false)
    }

    useEffect(() => {
        fetchTickets(ticketPage)
    }, [ticketPage, searchQuery])

    const updateTicketStatus = async (ticketId: string, status: string) => {
        if (!confirm(`Mark as ${status}?`)) return
        const { error } = await supabase.schema('gatepass').from('tickets').update({ status }).eq('id', ticketId)
        if (error) toast.error(error.message)
        else {
            await fetchTickets(ticketPage)
            toast.success(`Ticket marked as ${status}`)
        }
    }

    return (
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b] animate-in fade-in duration-200">
            <div className="flex flex-col gap-4 border-b border-gray-100 p-5 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between lg:p-6">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Guest list</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{ticketCount} {ticketCount === 1 ? 'guest' : 'guests'} for this event</p>
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search guests"
                            aria-label="Search guests"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setTicketPage(0) // Reset page on search
                            }}
                            className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                    </div>
                    {!isStaff && (
                        <>
                            <button
                                onClick={() => {
                                    const csv = generateCSV(tickets)
                                    downloadCSV(csv, `${event.slug}-guests.csv`)
                                }}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 dark:border-white/10 dark:bg-[#111] dark:text-gray-300"
                            >
                                <Download className="w-4 h-4" />
                                Export page
                            </button>
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 dark:border-white/10 dark:bg-[#111] dark:text-gray-300"
                            >
                                <Upload className="w-4 h-4" />
                                Import CSV
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setIsCheckInMode(!isCheckInMode)}
                        aria-pressed={isCheckInMode}
                        className={clsx("inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors", {
                            'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black': isCheckInMode,
                            'border-gray-200 bg-white text-gray-700 hover:border-gray-400 dark:border-white/10 dark:bg-[#111] dark:text-gray-300': !isCheckInMode
                        })}
                    >
                        <ScanLine className="w-4 h-4" />
                        {isCheckInMode ? 'Check-in mode on' : 'Check-in'}
                    </button>
                </div>
            </div>

            {loadingTickets ? (
                <div className="px-5 py-14 text-center text-sm text-gray-500">Loading guest list…</div>
            ) : tickets.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm">
                        <thead className="border-b border-gray-100 bg-gray-50/50 text-xs text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                            <tr>
                                <th className="px-5 py-3 font-medium">Reference</th>
                                <th className="px-5 py-3 font-medium">Guest</th>
                                <th className="px-5 py-3 font-medium">Ticket</th>
                                <th className="px-5 py-3 font-medium">Purchased</th>
                                <th className="px-5 py-3 font-medium">Status</th>
                                <th className="px-5 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                            {tickets.map((ticket: any) => (
                                <tr key={ticket.id} className={clsx("hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group", {
                                    'opacity-60': isCheckInMode && ticket.status !== 'valid'
                                })}>
                                    <td className="px-5 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{ticket.order_reference?.substring(0, 8) || '—'}</td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                                                {ticket.profiles?.full_name?.charAt(0) || ticket.reservations?.guest_name?.charAt(0) || 'G'}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {ticket.profiles?.full_name || ticket.reservations?.guest_name || 'Guest'}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {ticket.profiles?.email || ticket.reservations?.guest_email || 'No email'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            {ticket.ticket_tiers?.name}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            {new Date(ticket.created_at).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold", {
                                            'bg-green-100/80 text-green-700 dark:bg-green-500/10 dark:text-green-400': ticket.status === 'valid',
                                            'bg-gray-100/80 text-gray-600 dark:bg-white/10 dark:text-gray-400': ticket.status === 'used',
                                            'bg-blue-100/80 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400': ticket.status === 'checked_in',
                                            'bg-red-100/80 text-red-700 dark:bg-red-500/10 dark:text-red-400': ticket.status === 'cancelled'
                                        })}>
                                            <span className={clsx("w-1.5 h-1.5 rounded-full", {
                                                'bg-green-500': ticket.status === 'valid',
                                                'bg-gray-400': ticket.status === 'used',
                                                'bg-blue-500': ticket.status === 'checked_in',
                                                'bg-red-500': ticket.status === 'cancelled'
                                            })}></span>
                                            {(ticket.status === 'checked_in' ? 'Checked In' : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1))}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setSelectedReservationForForms({ reservationId: ticket.reservation_id, userId: ticket.profiles?.id ?? null, name: ticket.profiles?.full_name || ticket.reservations?.guest_name || 'Guest' })}
                                                className="p-2 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                                title="Guest details"
                                                aria-label="Guest details"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setSelectedTicketForQR(ticket)}
                                                className="p-2 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                                title="View QR Code"
                                                aria-label="View QR code"
                                            >
                                                <QrCode className="w-4 h-4" />
                                            </button>
                                            {ticket.status === 'valid' && (
                                                <button
                                                    onClick={() => updateTicketStatus(ticket.id, 'checked_in')}
                                                    className={clsx("rounded-lg bg-black font-semibold text-white dark:bg-white dark:text-black", {
                                                        'px-4 py-2.5 text-sm': isCheckInMode,
                                                        'px-3 py-2 text-xs': !isCheckInMode
                                                    })}
                                                >
                                                    Check in
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="px-5 py-14 text-center">
                    <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">No tickets sold yet</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Guests will appear here when tickets are purchased.</p>
                </div>
            )}

            {/* Pagination Footer */}
            {tickets.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 p-4 dark:border-white/10">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Showing {ticketPage * TICKETS_PER_PAGE + 1}–{Math.min((ticketPage + 1) * TICKETS_PER_PAGE, ticketCount)} of {ticketCount}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTicketPage(p => Math.max(0, p - 1))}
                            disabled={ticketPage === 0 || loadingTickets}
                            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-white/10 dark:bg-[#111] dark:text-gray-300"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setTicketPage(p => p + 1)}
                            disabled={(ticketPage + 1) * TICKETS_PER_PAGE >= ticketCount || loadingTickets}
                            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-white/10 dark:bg-[#111] dark:text-gray-300"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            <QRCodeModal
                isOpen={!!selectedTicketForQR}
                onClose={() => setSelectedTicketForQR(null)}
                ticketId={selectedTicketForQR?.id || ''}
                guestName={selectedTicketForQR?.profiles?.full_name || selectedTicketForQR?.reservations?.guest_name || 'Guest'}
                ticketType={selectedTicketForQR?.ticket_tiers?.name || 'Ticket'}
                eventSlug={event.slug || ''}
            />

            {/* Guest Import Modal */}
            <GuestImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                eventId={event.id}
                tiers={tiers}
                onImportComplete={() => fetchTickets(0)}
            />

            {/* Form Answers Modal */}
            <FormAnswersModal
                isOpen={!!selectedReservationForForms}
                onClose={() => setSelectedReservationForForms(null)}
                reservationId={selectedReservationForForms?.reservationId || ''}
                userId={selectedReservationForForms?.userId ?? null}
                guestName={selectedReservationForForms?.name ?? 'Guest'}
            />
        </div>
    )
}

interface FormAnswersModalProps {
    isOpen: boolean
    onClose: () => void
    reservationId: string
    userId?: string | null
    guestName?: string
}

interface SharedProfile {
    city: string | null
    country: string | null
    birthday: string | null
    bio: string | null
    interests: string[]
    dietary_needs: string | null
    accessibility_needs: string | null
    instagram: string | null
    x_handle: string | null
}

interface FormResponseItem {
    id: string
    answer: string
    event_form_questions: {
        label: string
    } | null
}

export function FormAnswersModal({ isOpen, onClose, reservationId, userId, guestName = 'Guest' }: FormAnswersModalProps) {
    const [responses, setResponses] = useState<FormResponseItem[]>([])
    const [profile, setProfile] = useState<SharedProfile | null>(null)
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        const fetchAnswers = async () => {
            if (!reservationId) return
            setLoading(true)
            setProfile(null)
            // Only returns a row when the guest chose to share their profile with organizers
            const [{ data }, { data: shared }] = await Promise.all([
                supabase
                    .schema('gatepass')
                    .from('event_form_responses')
                    .select(`
                        id,
                        answer,
                        event_form_questions(label)
                    `)
                    .eq('reservation_id', reservationId),
                userId
                    ? supabase.schema('gatepass').from('attendee_profiles').select('city, country, birthday, bio, interests, dietary_needs, accessibility_needs, instagram, x_handle').eq('user_id', userId).maybeSingle()
                    : Promise.resolve({ data: null }),
            ])
            setProfile(shared as SharedProfile | null)

            if (data) {
                const mapped: FormResponseItem[] = (data as {
                    id: string
                    answer: string
                    event_form_questions: { label: string } | { label: string }[] | null
                }[]).map(item => {
                    const q = item.event_form_questions
                    return {
                        id: item.id,
                        answer: item.answer,
                        event_form_questions: Array.isArray(q) ? (q[0] || null) : q
                    }
                })
                setResponses(mapped)
            }
            setLoading(false)
        }

        if (isOpen) {
            fetchAnswers()
        }
    }, [isOpen, reservationId, userId])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-5">
            <div role="dialog" aria-modal="true" aria-label={`${guestName} details`} className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0b0b0b]">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
                    <h3 className="truncate text-base font-semibold text-gray-950 dark:text-white">{guestName}</h3>
                    <button type="button" onClick={onClose} aria-label="Close guest details" className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="max-h-[65dvh] space-y-4 overflow-y-auto p-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                            <Loader2 className="mb-2 h-6 w-6 animate-spin" />
                            <p className="text-sm">Loading responses…</p>
                        </div>
                    ) : (
                        <>
                        <GuestProfileDetails profile={profile} />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Form answers</p>
                        {responses.length > 0 ? (
                        <div className="space-y-4">
                            {responses.map((r) => (
                                <div key={r.id} className="space-y-1 border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-white/10">
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {r.event_form_questions?.label || 'Question'}
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {r.answer}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No form answers for this order.
                        </p>
                        )}
                        </>
                    )}
                </div>
                <div className="flex justify-end border-t border-gray-100 px-5 py-4 dark:border-white/10">
                    <button type="button" onClick={onClose} className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white dark:bg-white dark:text-black">
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

function ageFrom(birthday: string) {
    const born = new Date(`${birthday}T00:00:00`)
    const today = new Date()
    const hadBirthday = today.getMonth() > born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate())
    return today.getFullYear() - born.getFullYear() - (hadBirthday ? 0 : 1)
}

function GuestProfileDetails({ profile }: { profile: SharedProfile | null }) {
    if (!profile) {
        return (
            <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">
                This guest hasn&apos;t shared a profile.
            </p>
        )
    }
    const age = profile.birthday ? ageFrom(profile.birthday) : null
    const rows: [string, React.ReactNode][] = [
        ['From', [profile.city, profile.country].filter(Boolean).join(', ')],
        ['Age', age !== null && age > 0 ? `${age}` : ''],
        ['Dietary needs', profile.dietary_needs],
        ['Accessibility', profile.accessibility_needs],
        ['Socials', [profile.instagram && `Instagram @${profile.instagram}`, profile.x_handle && `X @${profile.x_handle}`].filter(Boolean).join(' · ')],
    ]
    return (
        <div className="space-y-4 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
            {profile.bio && <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{profile.bio}</p>}
            {profile.interests?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {profile.interests.map(i => <span key={i} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">{i}</span>)}
                </div>
            )}
            <dl className="space-y-2.5">
                {rows.filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 text-sm">
                        <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                        <dd className="break-words font-medium text-gray-950 dark:text-white">{value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    )
}
