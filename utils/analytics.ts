
import { Ticket } from "@/types/gatepass"

export function aggregateSalesOverTime(tickets: Ticket[]) {
    const salesMap = new Map<string, { date: string; count: number }>()

    tickets.forEach(ticket => {
        if (!ticket.created_at) return
        const createdAt = new Date(ticket.created_at)
        if (Number.isNaN(createdAt.getTime())) return
        const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`
        const date = createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const previous = salesMap.get(key)
        salesMap.set(key, { date, count: (previous?.count || 0) + 1 })
    })

    return Array.from(salesMap.entries())
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([, sale]) => sale)
}

export function aggregateTicketTypes(tickets: Ticket[]) {
    const typeMap = new Map<string, number>()

    tickets.forEach(ticket => {
        const typeName = ticket.ticket_tiers?.name || 'Unknown'
        typeMap.set(typeName, (typeMap.get(typeName) || 0) + 1)
    })

    return Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }))
}

export function generateCSV(tickets: Ticket[]) {
    const headers = ['Reference', 'Guest Name', 'Email', 'Ticket Type', 'Status', 'Purchase Date', 'Checked In']

    // Check if tickets is empty
    if (!tickets.length) return ''

    const rows = tickets.map(t => [
        t.order_reference || 'N/A',
        t.profiles?.full_name || t.reservations?.guest_name || 'Guest',
        t.profiles?.email || t.reservations?.guest_email || 'N/A',
        t.ticket_tiers?.name || 'General',
        t.status,
        new Date(t.created_at).toLocaleDateString(),
        t.status === 'used' ? 'Yes' : 'No'
    ])

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return csvContent
}

export function downloadCSV(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }
}
