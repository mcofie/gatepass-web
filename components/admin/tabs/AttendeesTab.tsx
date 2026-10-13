import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Download, Loader2, MoreHorizontal, QrCode, Search, Upload, UserRound, X } from 'lucide-react'
import { generateCSV, downloadCSV } from '@/utils/analytics'
import { toast } from 'sonner'
import { Event, Ticket, TicketTier } from '@/types/gatepass'
import { QRCodeModal } from '@/components/admin/QRCodeModal'
import { GuestImportModal } from '@/components/admin/GuestImportModal'
import { SecondaryButton, inputClass } from '@/components/dashboard/ui'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

interface AttendeesTabProps {
    event: Event
    tiers?: TicketTier[]
    isStaff?: boolean
}

type GuestTicket = {
    id: string
    status: 'valid' | 'used' | 'cancelled' | string
    order_reference: string | null
    created_at: string
    reservation_id: string
    tier_id: string | null
    ticket_tiers: { name: string } | null
    reservations: { guest_name: string | null; guest_email: string | null } | null
    profiles: { id: string; full_name: string | null; email: string | null } | null
}

type StatusFilter = 'all' | 'waiting' | 'in' | 'cancelled'

const PAGE_SIZE = 25
const FETCH_BATCH = 1000
const MAX_GUESTS = 20000

const nameOf = (t: GuestTicket) => t.profiles?.full_name || t.reservations?.guest_name || 'Guest'
const emailOf = (t: GuestTicket) => t.profiles?.email || t.reservations?.guest_email || ''
const isCheckedIn = (t: GuestTicket) => t.status === 'used' || t.status === 'checked_in'

export function AttendeesTab({ event, tiers = [], isStaff = false }: AttendeesTabProps) {
    const supabase = useMemo(() => createClient(), [])
    const [tickets, setTickets] = useState<GuestTicket[]>([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [status, setStatus] = useState<StatusFilter>('all')
    const [tierId, setTierId] = useState('')
    const [page, setPage] = useState(0)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [menuId, setMenuId] = useState<string | null>(null)
    const [qrTicket, setQrTicket] = useState<GuestTicket | null>(null)
    const [showImport, setShowImport] = useState(false)
    const [details, setDetails] = useState<{ reservationId: string; userId: string | null; name: string } | null>(null)

    // Guest lists are small enough to load once, so search, filters and export cover everyone
    const loadTickets = useCallback(async () => {
        const all: GuestTicket[] = []
        for (let from = 0; from < MAX_GUESTS; from += FETCH_BATCH) {
            const { data, error } = await supabase
                .schema('gatepass')
                .from('tickets')
                .select('id, status, order_reference, created_at, reservation_id, tier_id, ticket_tiers ( name ), reservations ( guest_name, guest_email ), profiles ( id, full_name, email )')
                .eq('event_id', event.id)
                .order('created_at', { ascending: false })
                .range(from, from + FETCH_BATCH - 1)
            if (error) {
                toast.error('Could not load the guest list')
                break
            }
            all.push(...(data as unknown as GuestTicket[]))
            if (!data || data.length < FETCH_BATCH) break
        }
        return all
    }, [supabase, event.id])

    const fetchTickets = useCallback(() => loadTickets().then(all => {
        setTickets(all)
        setLoading(false)
    }), [loadTickets])

    useEffect(() => {
        let active = true
        loadTickets().then(all => {
            if (!active) return
            setTickets(all)
            setLoading(false)
        })
        return () => { active = false }
    }, [loadTickets])

    useEffect(() => {
        if (!menuId) return
        const close = () => setMenuId(null)
        document.addEventListener('click', close)
        return () => document.removeEventListener('click', close)
    }, [menuId])

    const counts = useMemo(() => {
        const active = tickets.filter(t => t.status !== 'cancelled')
        const checkedIn = active.filter(isCheckedIn).length
        return { total: active.length, checkedIn, waiting: active.length - checkedIn, cancelled: tickets.length - active.length }
    }, [tickets])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return tickets.filter(t => {
            if (status === 'waiting' && (t.status !== 'valid')) return false
            if (status === 'in' && !isCheckedIn(t)) return false
            if (status === 'cancelled' && t.status !== 'cancelled') return false
            if (status === 'all' && t.status === 'cancelled') return false
            if (tierId && t.tier_id !== tierId) return false
            if (!q) return true
            return nameOf(t).toLowerCase().includes(q) || emailOf(t).toLowerCase().includes(q) || (t.order_reference ?? '').toLowerCase().includes(q) || t.id.startsWith(q)
        })
    }, [tickets, query, status, tierId])

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const currentPage = Math.min(page, pageCount - 1)
    const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

    const setTicketStatus = async (ticket: GuestTicket, next: 'used' | 'valid' | 'cancelled') => {
        if (next === 'cancelled' && !confirm(`Cancel ${nameOf(ticket)}’s ticket? Their QR code stops working. Refunds happen in your payment provider.`)) return
        setBusyId(ticket.id)
        setMenuId(null)
        const previous = ticket.status
        setTickets(list => list.map(t => t.id === ticket.id ? { ...t, status: next } : t))
        const { error } = await supabase.schema('gatepass').from('tickets').update({ status: next }).eq('id', ticket.id)
        setBusyId(null)
        if (error) {
            setTickets(list => list.map(t => t.id === ticket.id ? { ...t, status: previous } : t))
            return toast.error(error.message)
        }
        if (next === 'used') toast.success(`${nameOf(ticket)} checked in`, { action: { label: 'Undo', onClick: () => setTicketStatus({ ...ticket, status: 'used' }, 'valid') } })
        else if (next === 'cancelled') toast.success('Ticket cancelled')
    }

    const exportCsv = () => {
        if (!filtered.length) return
        downloadCSV(generateCSV(filtered as unknown as Ticket[]), `${event.slug}-guests.csv`)
    }

    const filters: { id: StatusFilter; label: string; count: number }[] = [
        { id: 'all', label: 'All', count: counts.total },
        { id: 'waiting', label: 'Not checked in', count: counts.waiting },
        { id: 'in', label: 'Checked in', count: counts.checkedIn },
        ...(counts.cancelled ? [{ id: 'cancelled' as const, label: 'Cancelled', count: counts.cancelled }] : []),
    ]

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Guest list</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Everyone holding a ticket. Check guests in here or with the door scanner.</p>
                </div>
                {!isStaff && (
                    <div className="flex gap-2">
                        <SecondaryButton type="button" size="sm" onClick={() => setShowImport(true)}><Upload className="size-4" aria-hidden="true" /> Import</SecondaryButton>
                        <SecondaryButton type="button" size="sm" onClick={exportCsv} disabled={!filtered.length}><Download className="size-4" aria-hidden="true" /> Export</SecondaryButton>
                    </div>
                )}
            </div>

            {/* Arrivals */}
            <section aria-label="Check-in progress" className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#0b0b0b] sm:p-7">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Checked in</p>
                        <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-gray-950 dark:text-white">
                            {counts.checkedIn.toLocaleString()}<span className="text-gray-300 dark:text-gray-600"> / {counts.total.toLocaleString()}</span>
                        </p>
                    </div>
                    <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">{counts.waiting.toLocaleString()} still to arrive</p>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" aria-hidden="true">
                    <div className="h-full rounded-full bg-gray-950 transition-[width] duration-500 dark:bg-white" style={{ width: `${counts.total ? (counts.checkedIn / counts.total) * 100 : 0}%` }} />
                </div>
            </section>

            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                {/* Toolbar */}
                <div className="space-y-3 border-b border-gray-100 p-4 dark:border-white/10 sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                            <input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} placeholder="Search name, email or order" aria-label="Search guests" className={cn(inputClass, 'rounded-full pl-10')} />
                        </div>
                        {tiers.length > 1 && (
                            <select value={tierId} onChange={e => { setTierId(e.target.value); setPage(0) }} aria-label="Ticket type" className={cn(inputClass, 'rounded-full sm:w-52')}>
                                <option value="">All ticket types</option>
                                {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        )}
                    </div>
                    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
                        {filters.map(f => (
                            <button key={f.id} type="button" aria-pressed={status === f.id} onClick={() => { setStatus(f.id); setPage(0) }} className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors', status === f.id ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10')}>
                                {f.label}<span className="tabular-nums opacity-60">{f.count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-gray-500"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading guests</div>
                ) : visible.length === 0 ? (
                    <EmptyState
                        illustration="ticket"
                        title={tickets.length === 0 ? 'No guests yet' : 'No guests match'}
                        description={tickets.length === 0 ? 'Guests show up here as tickets sell. You can also import a list.' : 'Try another name, or clear the filters.'}
                        action={tickets.length > 0 ? <button type="button" onClick={() => { setQuery(''); setStatus('all'); setTierId('') }} className="text-sm font-medium text-gray-950 underline underline-offset-4 dark:text-white">Clear filters</button> : undefined}
                    />
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-white/10">
                        {visible.map(ticket => {
                            const checkedIn = isCheckedIn(ticket)
                            const cancelled = ticket.status === 'cancelled'
                            const name = nameOf(ticket)
                            return (
                                <li key={ticket.id} className={cn('flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5', cancelled && 'opacity-50')}>
                                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold', checkedIn ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300')} aria-hidden="true">
                                        {name.charAt(0).toUpperCase()}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[15px] font-medium text-gray-950 dark:text-white">{name}</p>
                                        <p className="truncate text-[13px] text-gray-500 dark:text-gray-400">
                                            {ticket.ticket_tiers?.name ?? 'Ticket'}
                                            <span className="hidden sm:inline">{emailOf(ticket) && ` · ${emailOf(ticket)}`}</span>
                                            {cancelled && ' · Cancelled'}
                                        </p>
                                    </div>
                                    <p className="hidden w-24 shrink-0 text-right font-mono text-xs text-gray-400 md:block">#{(ticket.order_reference || ticket.id).slice(0, 8)}</p>

                                    {!cancelled && (checkedIn ? (
                                        <button type="button" onClick={() => setTicketStatus(ticket, 'valid')} disabled={busyId === ticket.id} title="Undo check-in" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3.5 text-[13px] font-medium text-gray-950 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5">
                                            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> In
                                        </button>
                                    ) : (
                                        <button type="button" onClick={() => setTicketStatus(ticket, 'used')} disabled={busyId === ticket.id} className="inline-flex h-9 shrink-0 items-center rounded-full bg-gray-950 px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50 dark:bg-white dark:text-black">
                                            Check in
                                        </button>
                                    ))}

                                    <div className="relative shrink-0">
                                        <button type="button" onClick={e => { e.stopPropagation(); setMenuId(menuId === ticket.id ? null : ticket.id) }} aria-label={`More for ${name}`} aria-expanded={menuId === ticket.id} className="flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:hover:bg-white/5 dark:hover:text-white">
                                            <MoreHorizontal className="size-4" aria-hidden="true" />
                                        </button>
                                        {menuId === ticket.id && (
                                            <div role="menu" onClick={e => e.stopPropagation()} className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1 shadow-xl animate-in fade-in zoom-in-95 duration-150 dark:border-white/10 dark:bg-[#111]">
                                                <button type="button" role="menuitem" onClick={() => { setDetails({ reservationId: ticket.reservation_id, userId: ticket.profiles?.id ?? null, name }); setMenuId(null) }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-gray-950 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5">
                                                    <UserRound className="size-4 text-gray-400" aria-hidden="true" /> Guest details
                                                </button>
                                                <button type="button" role="menuitem" onClick={() => { setQrTicket(ticket); setMenuId(null) }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-gray-950 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5">
                                                    <QrCode className="size-4 text-gray-400" aria-hidden="true" /> Show QR code
                                                </button>
                                                {!isStaff && !cancelled && (
                                                    <button type="button" role="menuitem" onClick={() => setTicketStatus(ticket, 'cancelled')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
                                                        <X className="size-4" aria-hidden="true" /> Cancel ticket
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}

                {filtered.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 dark:border-white/10 sm:px-5">
                        <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">{currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}</p>
                        <div className="flex gap-2">
                            <SecondaryButton type="button" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</SecondaryButton>
                            <SecondaryButton type="button" size="sm" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</SecondaryButton>
                        </div>
                    </div>
                )}
            </div>

            <QRCodeModal
                isOpen={!!qrTicket}
                onClose={() => setQrTicket(null)}
                ticketId={qrTicket?.id || ''}
                guestName={qrTicket ? nameOf(qrTicket) : 'Guest'}
                ticketType={qrTicket?.ticket_tiers?.name || 'Ticket'}
                eventSlug={event.slug || ''}
            />
            <GuestImportModal isOpen={showImport} onClose={() => setShowImport(false)} eventId={event.id} tiers={tiers} onImportComplete={fetchTickets} />
            <FormAnswersModal
                isOpen={!!details}
                onClose={() => setDetails(null)}
                reservationId={details?.reservationId || ''}
                userId={details?.userId ?? null}
                guestName={details?.name ?? 'Guest'}
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
