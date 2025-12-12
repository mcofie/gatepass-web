'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Event, TicketTier } from '@/types/gatepass'
import clsx from 'clsx'

interface EventManageClientProps {
    event: Event
    initialTiers: TicketTier[]
}

export function EventManageClient({ event: initialEvent, initialTiers }: EventManageClientProps) {
    const [event, setEvent] = useState(initialEvent)
    const [tiers, setTiers] = useState(initialTiers)
    const [activeTab, setActiveTab] = useState<'details' | 'tickets' | 'attendees'>('tickets')
    const [loading, setLoading] = useState(false)
    const [tickets, setTickets] = useState<any[]>([])
    const [loadingTickets, setLoadingTickets] = useState(false)

    // Tier Form
    const [tierForm, setTierForm] = useState({ name: '', price: 0, total_quantity: 100, description: '' })
    const [creatingTier, setCreatingTier] = useState(false)

    const supabase = createClient()
    const router = useRouter()

    // ---------------- DETAILS LOGIC ----------------
    const updateEvent = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { error } = await supabase.schema('gatepass').from('events').update({
                title: event.title,
                description: event.description,
                venue_name: event.venue_name,
                venue_address: event.venue_address,
                poster_url: event.poster_url,
                is_published: event.is_published,
                fee_bearer: event.fee_bearer,
                platform_fee_percent: event.platform_fee_percent
            }).eq('id', event.id)

            if (error) throw error
            alert('Event updated successfully')
            router.refresh()
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    // ---------------- TICKETS / TIERS LOGIC ----------------
    const fetchTiers = async () => {
        const { data } = await supabase.schema('gatepass').from('ticket_tiers').select('*').eq('event_id', event.id).order('price')
        if (data) setTiers(data as TicketTier[])
    }

    const addTier = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreatingTier(true)
        try {
            const { error } = await supabase.schema('gatepass').from('ticket_tiers').insert({
                event_id: event.id,
                ...tierForm
            })
            if (error) throw error

            await fetchTiers()
            setTierForm({ name: '', price: 0, total_quantity: 100, description: '' })
        } catch (e: any) {
            alert(e.message)
        } finally {
            setCreatingTier(false)
        }
    }

    const deleteTier = async (id: string) => {
        if (!confirm('Are you sure?')) return
        const { error } = await supabase.schema('gatepass').from('ticket_tiers').delete().eq('id', id)
        if (error) alert(error.message)
        else await fetchTiers()
    }

    // ---------------- ATTENDEES LOGIC ----------------
    const fetchTickets = async () => {
        setLoadingTickets(true)
        const { data } = await supabase
            .schema('gatepass')
            .from('tickets')
            .select(`
                id, status, order_reference, created_at,
                ticket_tiers ( name ),
                profiles ( full_name, id )
            `)
            .eq('event_id', event.id)
            .order('created_at', { ascending: false })

        if (data) setTickets(data)
        setLoadingTickets(false)
    }

    const updateTicketStatus = async (ticketId: string, status: string) => {
        if (!confirm(`Mark as ${status}?`)) return
        const { error } = await supabase.schema('gatepass').from('tickets').update({ status }).eq('id', ticketId)
        if (error) alert(error.message)
        else fetchTickets()
    }

    // On Tab Change
    React.useEffect(() => {
        if (activeTab === 'attendees') {
            fetchTickets()
        }
    }, [activeTab])

    const tabClass = (tab: string) => clsx(
        "px-4 py-2 text-sm font-medium rounded-full transition-colors",
        activeTab === tab ? "bg-black text-white" : "text-gray-500 hover:text-black hover:bg-gray-100"
    )

    return (
        <div className="container mx-auto p-6 max-w-5xl font-sans">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-10">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Link href="/dashboard/events" className="hover:text-black transition-colors">Dashboard</Link>
                    <span>/</span>
                    <span>Events</span>
                    <span>/</span>
                    <span className="text-black font-medium">{event.title}</span>
                </div>
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{event.title}</h1>
                        <p className="text-gray-500 mt-1">{event.venue_name}</p>
                    </div>
                    <div className="flex gap-2">
                        <Link href={`/events/${event.slug || event.id}`} target="_blank" className="text-sm font-medium px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">
                            View Public Page
                        </Link>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 mb-8 border-b pb-4">
                <button onClick={() => setActiveTab('details')} className={tabClass('details')}>Overview</button>
                <button onClick={() => setActiveTab('tickets')} className={tabClass('tickets')}>Tickets</button>
                <button onClick={() => setActiveTab('attendees')} className={tabClass('attendees')}>Guest List</button>
            </div>

            {/* DETAILS TAB */}
            {activeTab === 'details' && (
                <div className="max-w-3xl">
                    <form onSubmit={updateEvent} className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="space-y-6">
                            <div className="grid gap-6 p-6 border rounded-xl bg-white shadow-sm">
                                <h3 className="font-semibold text-lg">General Information</h3>
                                <div className="grid gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Event Title</label>
                                    <input
                                        value={event.title}
                                        onChange={e => setEvent({ ...event, title: e.target.value })}
                                        className="w-full border-gray-200 rounded-lg p-3 focus:ring-black focus:border-black transition-all"
                                        placeholder="E.g. Summer Music Festival"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Description</label>
                                    <textarea
                                        value={event.description}
                                        onChange={e => setEvent({ ...event, description: e.target.value })}
                                        rows={5}
                                        className="w-full border-gray-200 rounded-lg p-3 focus:ring-black focus:border-black transition-all"
                                        placeholder="Describe your event..."
                                    ></textarea>
                                </div>
                            </div>

                            <div className="grid gap-6 p-6 border rounded-xl bg-white shadow-sm">
                                <h3 className="font-semibold text-lg">Location</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="grid gap-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Venue Name</label>
                                        <input
                                            value={event.venue_name}
                                            onChange={e => setEvent({ ...event, venue_name: e.target.value })}
                                            className="w-full border-gray-200 rounded-lg p-3 focus:ring-black focus:border-black transition-all"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Address</label>
                                        <input
                                            value={event.venue_address}
                                            onChange={e => setEvent({ ...event, venue_address: e.target.value })}
                                            className="w-full border-gray-200 rounded-lg p-3 focus:ring-black focus:border-black transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-6 p-6 border rounded-xl bg-white shadow-sm">
                                <h3 className="font-semibold text-lg">Tickets & Fees</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="grid gap-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Fee Bearer</label>
                                        <select
                                            value={event.fee_bearer}
                                            onChange={e => setEvent({ ...event, fee_bearer: e.target.value as 'customer' | 'organizer' })}
                                            className="w-full border-gray-200 rounded-lg p-3 focus:ring-black focus:border-black transition-all bg-white"
                                        >
                                            <option value="customer">Customer (Ticket Price + Fees)</option>
                                            <option value="organizer">Organizer (Fees deducted from revenue)</option>
                                        </select>
                                        <p className="text-xs text-gray-400">Determines who pays the service fees.</p>
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Platform Fee (%)</label>
                                        <input
                                            type="number"
                                            value={event.platform_fee_percent}
                                            onChange={e => setEvent({ ...event, platform_fee_percent: parseFloat(e.target.value) })}
                                            className="w-full border-gray-200 rounded-lg p-3 focus:ring-black focus:border-black transition-all"
                                            min="0"
                                            step="0.1"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-6 p-6 border rounded-xl bg-white shadow-sm">
                                <h3 className="font-semibold text-lg">Media & Visibility</h3>
                                <div className="grid gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Poster URL</label>
                                    <input
                                        value={event.poster_url || ''}
                                        onChange={e => setEvent({ ...event, poster_url: e.target.value })}
                                        className="w-full border-gray-200 rounded-lg p-3 focus:ring-black focus:border-black transition-all"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="flex items-center gap-3 pt-2">
                                    <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                        <input
                                            type="checkbox"
                                            name="toggle"
                                            id="pub"
                                            checked={event.is_published}
                                            onChange={e => setEvent({ ...event, is_published: e.target.checked })}
                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                                            style={{ right: event.is_published ? '0' : 'auto', left: event.is_published ? 'auto' : '0' }}
                                        />
                                        <label htmlFor="pub" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${event.is_published ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                                    </div>
                                    <label htmlFor="pub" className="text-sm font-medium">Publish Event (Visible to public)</label>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-8 border-t border-gray-100 mt-8">
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) return
                                    const { error } = await supabase.schema('gatepass').from('events').delete().eq('id', event.id)
                                    if (error) alert(error.message)
                                    else router.push('/dashboard/events')
                                }}
                                className="text-red-500 font-medium hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors"
                            >
                                Delete Event
                            </button>

                            <button
                                type="submit"
                                className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                disabled={loading}
                            >
                                {loading ? 'Saving Changes...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TICKETS TAB */}
            {activeTab === 'tickets' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid lg:grid-cols-2 gap-6">
                        {tiers.map(tier => (
                            <div key={tier.id} className="relative group bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-bold text-xl mb-1">{tier.name}</h4>
                                        <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">Tier ID: {tier.id.slice(0, 8)}...</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black">{tier.currency} {tier.price}</p>
                                    </div>
                                </div>

                                <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                                    <div
                                        className="bg-black h-2 rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.min((tier.quantity_sold / tier.total_quantity) * 100, 100)}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-sm mb-6">
                                    <span className="font-medium text-gray-900">{tier.quantity_sold} sold</span>
                                    <span className="text-gray-500">{tier.total_quantity} total</span>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => deleteTier(tier.id)}
                                        className="text-red-500 text-sm font-medium hover:bg-red-50 px-3 py-1.5 rounded transition-colors"
                                    >
                                        Delete Tier
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Add New Tier Card */}
                        <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-300 flex flex-col justify-center">
                            <h3 className="font-bold text-lg mb-4 text-center text-gray-700">Add New Ticket Tier</h3>
                            <form onSubmit={addTier} className="space-y-4">
                                <div>
                                    <input
                                        value={tierForm.name}
                                        onChange={e => setTierForm({ ...tierForm, name: e.target.value })}
                                        required
                                        placeholder="Ticket Name (e.g. VIP)"
                                        className="w-full border-gray-200 rounded-lg p-2.5 text-sm focus:ring-black focus:border-black"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="number"
                                        value={tierForm.price}
                                        onChange={e => setTierForm({ ...tierForm, price: Number(e.target.value) })}
                                        required
                                        placeholder="Price"
                                        className="w-full border-gray-200 rounded-lg p-2.5 text-sm focus:ring-black focus:border-black"
                                    />
                                    <input
                                        type="number"
                                        value={tierForm.total_quantity}
                                        onChange={e => setTierForm({ ...tierForm, total_quantity: Number(e.target.value) })}
                                        required
                                        placeholder="Quantity"
                                        className="w-full border-gray-200 rounded-lg p-2.5 text-sm focus:ring-black focus:border-black"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-white border border-gray-300 text-black py-2.5 rounded-lg font-bold hover:bg-gray-50 hover:border-black transition-all disabled:opacity-50 text-sm"
                                    disabled={creatingTier}
                                >
                                    {creatingTier ? 'Adding...' : 'Add Tier'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ATTENDEES TAB */}
            {activeTab === 'attendees' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center backdrop-blur-sm">
                        <h3 className="font-semibold text-gray-900">Guest List</h3>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 bg-white border rounded-full text-xs font-medium text-gray-600 shadow-sm">
                                {tickets.length} attendees
                            </span>
                        </div>
                    </div>

                    {loadingTickets ? (
                        <div className="p-12 text-center text-gray-500 animate-pulse">Loading guest list...</div>
                    ) : tickets.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 text-xs uppercase tracking-wider">Reference</th>
                                        <th className="px-6 py-3 text-xs uppercase tracking-wider">Guest</th>
                                        <th className="px-6 py-3 text-xs uppercase tracking-wider">Ticket</th>
                                        <th className="px-6 py-3 text-xs uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-xs uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {tickets.map((ticket: any) => (
                                        <tr key={ticket.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-gray-500">{ticket.order_reference?.substring(0, 8) || 'N/A'}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
                                                        {ticket.profiles?.full_name?.charAt(0) || 'G'}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">{ticket.profiles?.full_name || 'Guest User'}</div>
                                                        <div className="text-xs text-gray-400 font-mono">{ticket.profiles?.id.slice(0, 8)}...</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                    {ticket.ticket_tiers?.name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border", {
                                                    'bg-green-50 text-green-700 border-green-200': ticket.status === 'valid',
                                                    'bg-gray-100 text-gray-600 border-gray-200': ticket.status === 'used',
                                                    'bg-red-50 text-red-700 border-red-200': ticket.status === 'cancelled'
                                                })}>
                                                    <span className={clsx("w-1.5 h-1.5 rounded-full", {
                                                        'bg-green-500': ticket.status === 'valid',
                                                        'bg-gray-500': ticket.status === 'used',
                                                        'bg-red-500': ticket.status === 'cancelled'
                                                    })}></span>
                                                    {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {ticket.status === 'valid' && (
                                                    <button
                                                        onClick={() => updateTicketStatus(ticket.id, 'used')}
                                                        className="text-xs font-medium bg-black text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
                                                    >
                                                        Check In
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-16 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
                            </div>
                            <h3 className="text-gray-900 font-medium mb-1">No tickets sold yet</h3>
                            <p className="text-gray-500 text-sm">Once people buy tickets, they will appear here.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
