'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, Mail, Phone, User, Download } from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { toast } from 'sonner'
import { exportToCSV } from '@/utils/export'
import { Skeleton } from '@/components/ui/skeleton'

type Customer = {
    email: string
    name: string
    phone?: string
    total_spent: number
    tickets_bought: number
    last_seen: string
}

export function CustomerCRM({ organizationId }: { organizationId: string }) {
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
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) throw new Error('No user')

                let query = supabase
                    .schema('gatepass')
                    .from('customer_stats')
                    .select('*')
                    .eq('organization_id', organizationId)
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
    }, [organizationId, page, searchQuery, sortBy])

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
        <div className="mx-auto max-w-[1180px] space-y-7 pb-16">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Workspace</p>
                    <h1 className="text-[32px] font-semibold tracking-tight text-gray-950 dark:text-white sm:text-[38px]">Customers</h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">People who have bought tickets to your events.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExport} disabled={loading || customers.length === 0} className="flex h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#111] dark:text-white dark:hover:bg-white/5">
                        <Download className="w-4 h-4" /> Export page
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
                        placeholder="Search name or email"
                        aria-label="Search customers by name or email"
                        className="w-full pl-10 h-10 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] dark:text-white text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-[#111] p-1 rounded-lg border border-gray-200 dark:border-white/10">
                    <button
                        onClick={() => { setSortBy('spend'); setPage(0) }}
                        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none ${sortBy === 'spend' ? 'bg-gray-100 text-black dark:bg-white/10 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                        Top Spenders
                    </button>
                    <button
                        onClick={() => { setSortBy('recent'); setPage(0) }}
                        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none ${sortBy === 'recent' ? 'bg-gray-100 text-black dark:bg-white/10 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                        Recently Active
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="min-h-[320px] overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
                <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Customer list</h2>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{loading ? 'Loading customers' : `${customers.length} on this page`}</p>
                </div>
                <div className="divide-y divide-gray-100 sm:hidden dark:divide-white/10">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="space-y-3 p-5">
                                <Skeleton className="h-4 w-36 bg-gray-200" />
                                <Skeleton className="h-3 w-48 bg-gray-100" />
                                <Skeleton className="h-3 w-24 bg-gray-100" />
                            </div>
                        ))
                    ) : filteredCustomers.map(customer => (
                        <div key={customer.email} className="space-y-4 p-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                                    {customer.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{customer.name}</p>
                                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{customer.email}</p>
                                    {customer.phone && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{customer.phone}</p>}
                                </div>
                            </div>
                            <div className="flex items-end justify-between border-t border-gray-100 pt-3 text-xs dark:border-white/10">
                                <span className="text-gray-500 dark:text-gray-400">{customer.tickets_bought} {customer.tickets_bought === 1 ? 'order' : 'orders'} · Last seen {new Date(customer.last_seen).toLocaleDateString()}</span>
                                <span className="shrink-0 pl-2 font-semibold text-gray-900 dark:text-white">{formatCurrency(customer.total_spent, 'GHS')}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10 text-gray-500 dark:text-gray-400 font-medium">
                        <tr>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Contact</th>
                            <th className="px-6 py-4 text-right">Last Seen</th>
                            <th className="px-6 py-4 text-right">Total spent</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="w-8 h-8 rounded-full bg-gray-200" />
                                            <Skeleton className="h-4 w-32 bg-gray-200" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-2">
                                            <Skeleton className="h-3 w-40 bg-gray-200" />
                                            <Skeleton className="h-2 w-24 bg-gray-100" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Skeleton className="h-4 w-24 bg-gray-200 ml-auto" />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="space-y-1">
                                            <Skeleton className="h-4 w-16 bg-gray-200 ml-auto" />
                                            <Skeleton className="h-2 w-12 bg-gray-100 ml-auto" />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            filteredCustomers.map((c, i) => (
                                <tr key={c.email} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                                                {c.name.charAt(0)}
                                            </div>
                                            <span className="font-semibold text-gray-900 dark:text-white">{c.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
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
                                    <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">
                                        {new Date(c.last_seen).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(c.total_spent, 'GHS')}</div>
                                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                            {c.tickets_bought} {c.tickets_bought === 1 ? 'order' : 'orders'}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>
                {!loading && filteredCustomers.length === 0 && (
                    <div className="flex h-56 flex-col items-center justify-center px-6 text-center text-gray-500 dark:text-gray-400">
                        <User className="mb-3 h-6 w-6" />
                        <p className="font-medium text-gray-900 dark:text-white">{searchQuery ? 'No matching customers' : 'No customers yet'}</p>
                        <p className="mt-1 text-sm">{searchQuery ? 'Try another name or email.' : 'Ticket buyers will appear here.'}</p>
                    </div>
                )}
            </div>
            {/* Pagination Controls */}
            <div className="flex justify-between items-center pt-4">
                <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                    className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Previous
                </button>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Page {page + 1}
                </div>
                <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasMore || loading}
                    className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Next
                </button>
            </div>
        </div>
    )
}
