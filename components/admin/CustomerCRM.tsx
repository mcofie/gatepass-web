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
    total_spent: number
    tickets_bought: number
    last_seen: string
}

export function CustomerCRM() {
    const supabase = createClient()
    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<'spend' | 'recent'>('spend')

    const PAGE_SIZE = 50
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)

    useEffect(() => {
        const fetchCustomers = async () => {
            setLoading(true)
            try {
                // Determine Organization Context (Similar to Dashboard)
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) throw new Error('No user')

                let { data: org } = await supabase.schema('gatepass').from('organizers').select('id').eq('user_id', user.id).single()
                if (!org) {
                    const { data: teamMember } = await supabase.schema('gatepass').from('organization_team').select('organization_id').eq('user_id', user.id).single()
                    if (teamMember) org = { id: teamMember.organization_id }
                }

                if (!org) {
                    setCustomers([])
                    setHasMore(false)
                    setLoading(false)
                    return
                }

                let query = supabase
                    .schema('gatepass')
                    .from('customer_stats')
                    .select('*')
                    .eq('organization_id', org.id) // Filter by Org
                    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

                if (searchQuery) {
                    query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
                }

                if (sortBy === 'spend') {
                    query = query.order('total_spent', { ascending: false })
                } else {
                    query = query.order('last_seen', { ascending: false })
                }

                const { data, error } = await query

                if (error) throw error

                // @ts-ignore - View type definition might be missing
                setCustomers(data || [])
                setHasMore((data || []).length === PAGE_SIZE)

            } catch (e) {
                console.error(e)
                toast.error('Failed to load customers')
            } finally {
                setLoading(false)
            }
        }

        // Debounce search
        const timeoutId = setTimeout(() => {
            fetchCustomers()
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [page, searchQuery, sortBy])

    // Client-side filtering removed in favor of server-side
    // But for export we might want to export ALL? 
    // For now, export current view or strict export query.
    // Let's keep export simple (export visible) or maybe implement "Export All" later.
    const filteredCustomers = customers

    const handleExport = () => {
        const data = filteredCustomers.map(c => ({
            Name: c.name,
            Email: c.email,
            Phone: c.phone || '',
            'Total Spent': c.total_spent,
            'Tickets Count': c.tickets_bought,
            'Last Seen': new Date(c.last_seen).toLocaleDateString()
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
                                    {new Date(c.last_seen).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="font-bold text-gray-900">{formatCurrency(c.total_spent, 'GHS')}</div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-medium mt-0.5">
                                        {c.tickets_bought} Orders
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
            {/* Pagination Controls */}
            <div className="flex justify-between items-center pt-4">
                <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Previous
                </button>
                <div className="text-sm font-medium text-gray-600">
                    Page {page + 1}
                </div>
                <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasMore || loading}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Next
                </button>
            </div>
        </div>
    )
}
