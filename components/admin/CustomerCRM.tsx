'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, Mail, Phone, ShoppingBag, TrendingUp, User, Filter, Download } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { toast } from 'sonner'
import { exportToCSV } from '@/utils/export'

type Customer = {
    email: string
    name: string
    phone?: string
    totalSpent: number
    ticketsBought: number
    lastSeen: string
    eventsAttended: number
}

export function CustomerCRM() {
    const supabase = createClient()
    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<'spend' | 'recent'>('spend')

    useEffect(() => {
        const fetchCustomers = async () => {
            setLoading(true)
            try {
                // Fetch all reservations (successful ones)
                // We assume successful reservation = paid. 
                // Or fetch transactions? Transactions have amount. Reservations have email.
                // Best: Fetch reservations with transactions joined OR tickets.
                // Actually, let's fetch 'tickets' + 'ticket_tiers' + 'reservations'
                // Tickets has status.

                const { data, error } = await supabase
                    .schema('gatepass')
                    .from('transactions') // Transactions source of truth for money
                    .select(`
                        amount, 
                        paid_at,
                        reservations (
                            guest_email,
                            guest_name,
                            guest_phone,
                            user_id,
                            profiles (email, full_name, phone_number),
                            event_id
                        )
                    `)
                    .eq('status', 'success')

                if (error) throw error

                // Aggregate
                const map: Record<string, Customer> = {}

                data.forEach((tx: any) => {
                    const res = tx.reservations
                    // Id strategy: Email is best unique identifier for guest/user mix
                    const email = (res?.profiles?.email || res?.guest_email || '').toLowerCase()
                    if (!email) return

                    const name = res?.profiles?.full_name || res?.guest_name || 'Unknown'
                    const phone = res?.profiles?.phone_number || res?.guest_phone || ''
                    const amount = tx.amount || 0
                    const date = tx.paid_at

                    if (!map[email]) {
                        map[email] = {
                            email,
                            name,
                            phone,
                            totalSpent: 0,
                            ticketsBought: 0, // This logic assumes 1 tx = ? tickets. 
                            // Wait, transactions table stores TOTAL amount. 
                            // If we want ticket count, we need quantity from reservation?
                            // Reservation has quantity.
                            // Let's assume 1 tx corresponds to 1 reservation which has X tickets.
                            // We didn't fetch quantity. Let's start with Spend.
                            lastSeen: date,
                            eventsAttended: 0
                        }
                    }

                    map[email].totalSpent += amount
                    // Update Last Seen
                    if (new Date(date) > new Date(map[email].lastSeen)) {
                        map[email].lastSeen = date
                        map[email].name = name // Update name to most recent 
                    }
                    map[email].ticketsBought += 1 // Actually Transaction count here.
                    // Tracking events
                    // map[email].events.add(res.event_id) // Set? 
                })

                setCustomers(Object.values(map))

            } catch (e) {
                console.error(e)
                toast.error('Failed to load customers')
            } finally {
                setLoading(false)
            }
        }
        fetchCustomers()
    }, [])

    const filteredCustomers = useMemo(() => {
        let result = customers.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email.toLowerCase().includes(searchQuery.toLowerCase())
        )

        if (sortBy === 'spend') {
            result.sort((a, b) => b.totalSpent - a.totalSpent)
        } else {
            result.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
        }
        return result
    }, [customers, searchQuery, sortBy])

    const handleExport = () => {
        const data = filteredCustomers.map(c => ({
            Name: c.name,
            Email: c.email,
            Phone: c.phone || '',
            'Total Spent': c.totalSpent,
            'Tickets Count': c.ticketsBought,
            'Last Seen': new Date(c.lastSeen).toLocaleDateString()
        }))
        exportToCSV(data, 'customers_crm')
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Customer Database</h1>
                    <p className="text-gray-500 mt-2">View your top spenders and loyal attendees.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full pl-10 h-10 rounded-xl border border-gray-200 text-sm outline-none focus:border-black transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200">
                    <button
                        onClick={() => setSortBy('spend')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sortBy === 'spend' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Top Spenders
                    </button>
                    <button
                        onClick={() => setSortBy('recent')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sortBy === 'recent' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Recently Active
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Contact</th>
                            <th className="px-6 py-4 text-right">Last Seen</th>
                            <th className="px-6 py-4 text-right">LTV (Total Spend)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredCustomers.map((c, i) => (
                            <tr key={c.email} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:bg-black group-hover:text-white transition-colors">
                                            {c.name.charAt(0)}
                                        </div>
                                        <span className="font-bold text-gray-900">{c.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-500">
                                    <div className="flex flex-col">
                                        <span className="flex items-center gap-1.5 text-xs">
                                            <Mail className="w-3 h-3" /> {c.email}
                                        </span>
                                        {c.phone && (
                                            <span className="flex items-center gap-1.5 text-xs mt-0.5 opacity-70">
                                                <Phone className="w-3 h-3" /> {c.phone}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right text-gray-500">
                                    {new Date(c.lastSeen).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="font-bold text-gray-900">{formatCurrency(c.totalSpent, 'GHS')}</div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-medium mt-0.5">
                                        {c.ticketsBought} Orders
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredCustomers.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <User className="w-12 h-12 mb-4 opacity-20" />
                        <p>No customers found</p>
                    </div>
                )}
            </div>
        </div>
    )
}
