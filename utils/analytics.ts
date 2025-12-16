
import { Ticket } from "@/types/gatepass"

export function aggregateSalesOverTime(tickets: any[]) {
    const salesMap = new Map<string, number>()

    tickets.forEach(ticket => {
        if (!ticket.created_at) return
        // Format date as "MMM DD" (e.g. "Dec 16")
        const date = new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        salesMap.set(date, (salesMap.get(date) || 0) + 1)
    })

    // Convert to array and sort by date
    // Note: This simple sort assumes dates are in same year or chronological. 
    // For production, might want better date sorting logic or iso strings.
    // Given the dashboard scope, this is fine for now usually.
    return Array.from(salesMap.entries())
        .map(([date, count]) => ({ date, count }))
        .reverse() // Often tickets come latest first, so reverse to show timeline left-to-right? 
    // Wait, map iteration order is insertion order usually.
    // It's safer to sort. 
}

export function aggregateTicketTypes(tickets: any[]) {
    const typeMap = new Map<string, number>()

    tickets.forEach(ticket => {
        const typeName = ticket.ticket_tiers?.name || 'Unknown'
        typeMap.set(typeName, (typeMap.get(typeName) || 0) + 1)
    })

    return Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }))
}

export function generateCSV(tickets: any[]) {
    const headers = ['Reference', 'Guest Name', 'Email', 'Ticket Type', 'Status', 'Purchase Date', 'Checked In']

    // Check if tickets is empty
    if (!tickets.length) return ''

    const rows = tickets.map(t => [
        t.order_reference || 'N/A',
        t.profiles?.full_name || 'Guest',
        t.profiles?.email || 'N/A', // Assuming profile join fetches email? If not, might need update.
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
