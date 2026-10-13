import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getPublicEvent, listPublicEvents, type PublicEvent } from '@/lib/public-api/events'

// Public GatePass MCP server: lets AI assistants find events and hand people a checkout link.
// Read-only, no sign-in. Payment always happens on GatePass, never inside the assistant.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gatepass.so').replace(/\/$/, '')

const INSTRUCTIONS = `GatePass sells tickets to events (mostly in Ghana and West Africa).
Use search_events to find events, get_event for details and ticket prices, and create_checkout_link when someone wants to buy.
Never ask for card or mobile money details: share the checkout link and let the person pay on GatePass.
Prices are in the event's currency (often GHS). Dates are ISO 8601 in UTC; convert to the person's local time when you describe them.`

const money = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: amount % 1 ? 2 : 0 }).format(amount)

/** Compact shape for lists, so assistants don't receive full descriptions they won't use. */
function summary(event: PublicEvent) {
    return {
        slug: event.slug,
        title: event.title,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        venue: [event.venue.name, event.venue.address].filter(Boolean).join(', ') || null,
        organizer: event.organizer?.name ?? null,
        from_price: event.from_price ? money(event.from_price.amount, event.from_price.currency) : null,
        on_sale: event.on_sale,
        url: event.url,
    }
}

const json = (value: unknown) => ({ type: 'text' as const, text: JSON.stringify(value, null, 2) })
const fail = (message: string) => ({ content: [{ type: 'text' as const, text: message }], isError: true })

export function createGatePassMcpServer() {
    const server = new McpServer(
        { name: 'gatepass', title: 'GatePass', version: '1.0.0', websiteUrl: SITE_URL },
        { instructions: INSTRUCTIONS },
    )

    server.registerTool(
        'search_events',
        {
            title: 'Search events',
            description: 'Find upcoming events on GatePass by name, venue or city. Returns at most 20 events, soonest first.',
            inputSchema: {
                query: z.string().max(100).optional().describe('Words to match in the event name, venue or address, e.g. "Accra jazz". Omit to list upcoming events.'),
                limit: z.number().int().min(1).max(20).optional().describe('How many events to return (default 10).'),
            },
            annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async ({ query, limit }) => {
            const events = await listPublicEvents({ query, limit: limit ?? 10 })
            if (events.length === 0) return { content: [{ type: 'text', text: query ? `No upcoming events match "${query}".` : 'No upcoming events right now.' }] }
            return { content: [json(events.map(summary))] }
        },
    )

    server.registerTool(
        'get_event',
        {
            title: 'Get event details',
            description: 'Full details for one event: description, date and time, venue, organizer, and every ticket type with its price and how many are left.',
            inputSchema: {
                event: z.string().min(1).max(120).describe('The event slug (from search_events or a gatepass.so/events/<slug> link).'),
            },
            annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async ({ event: slug }) => {
            const event = await getPublicEvent(slug)
            if (!event) return fail(`No published event found for "${slug}".`)
            return {
                content: [json({
                    ...summary(event),
                    description: event.description.slice(0, 2000),
                    tickets: event.tickets.map(t => ({
                        id: t.id,
                        name: t.name,
                        description: t.description,
                        price: t.price === 0 ? 'Free' : money(t.price, t.currency),
                        available: t.sold_out ? 'Sold out' : t.available === null ? 'Available' : `${t.available} left`,
                        max_per_order: t.max_per_order,
                        online_access: t.online,
                    })),
                })],
            }
        },
    )

    server.registerTool(
        'list_organizer_events',
        {
            title: 'List an organizer’s events',
            description: 'Upcoming events from one organizer, using their GatePass handle.',
            inputSchema: {
                organizer: z.string().min(1).max(60).describe('The organizer handle, e.g. "squa-events".'),
            },
            annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async ({ organizer }) => {
            const events = await listPublicEvents({ organizerHandle: organizer, limit: 20 })
            if (events.length === 0) return { content: [{ type: 'text', text: `No upcoming events from "${organizer}".` }] }
            return { content: [json(events.map(summary))] }
        },
    )

    server.registerTool(
        'create_checkout_link',
        {
            title: 'Create a checkout link',
            description: 'A link that opens checkout for an event with the chosen tickets already selected. Give this link to the person: they review the order and pay on GatePass. Does not reserve tickets or take payment.',
            inputSchema: {
                event: z.string().min(1).max(120).describe('The event slug.'),
                tickets: z.array(z.object({
                    ticket_id: z.string().describe('A ticket id from get_event.'),
                    quantity: z.number().int().min(1).max(20),
                })).max(10).optional().describe('Tickets to preselect. Omit to let the person choose.'),
            },
            annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async ({ event: slug, tickets }) => {
            const event = await getPublicEvent(slug)
            if (!event) return fail(`No published event found for "${slug}".`)
            if (!event.on_sale) return fail(`Tickets for ${event.title} aren't on sale right now.`)

            const picks: string[] = []
            for (const pick of tickets ?? []) {
                const ticket = event.tickets.find(t => t.id === pick.ticket_id)
                if (!ticket) return fail(`"${pick.ticket_id}" isn't a ticket type for ${event.title}. Use get_event to see the options.`)
                if (ticket.sold_out) return fail(`${ticket.name} is sold out.`)
                if (ticket.available !== null && pick.quantity > ticket.available) return fail(`Only ${ticket.available} ${ticket.name} tickets are left.`)
                if (ticket.max_per_order && pick.quantity > ticket.max_per_order) return fail(`${ticket.name} is limited to ${ticket.max_per_order} per order.`)
                picks.push(`${ticket.id}:${pick.quantity}`)
            }

            const params = new URLSearchParams({ view: 'tickets', utm_source: 'mcp', utm_medium: 'assistant' })
            if (picks.length) params.set('select', picks.join(','))
            const url = `${event.url}?${params.toString()}`

            const lines = (tickets ?? []).map(p => {
                const t = event.tickets.find(x => x.id === p.ticket_id)!
                return `${p.quantity} × ${t.name} (${t.price === 0 ? 'Free' : money(t.price, t.currency)} each)`
            })
            return {
                content: [json({
                    checkout_url: url,
                    event: event.title,
                    starts_at: event.starts_at,
                    selected: lines,
                    note: 'The person completes payment on GatePass. Prices and availability are confirmed at checkout.',
                })],
            }
        },
    )

    return server
}
