'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

/* eslint-disable @typescript-eslint/no-explicit-any -- joined rows */

export type ReportKind = 'sales' | 'plan_fees' | 'managed' | 'holds' | 'events' | 'users'

const LIMIT = 50000

async function requireSuperAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    const { data: profile } = await supabase.schema('gatepass').from('profiles').select('is_super_admin').eq('id', user.id).single()
    if (!profile?.is_super_admin) throw new Error('Forbidden')
}

const money = (minor: unknown) => (Number(minor ?? 0) / 100).toFixed(2)

function toCsv(rows: Record<string, unknown>[]) {
    if (!rows.length) return ''
    const headers = Object.keys(rows[0])
    const cell = (value: unknown) => {
        if (value === null || value === undefined) return ''
        let text = String(value)
        // Keep spreadsheet apps from running cell contents as formulas
        if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    return [headers.join(','), ...rows.map(row => headers.map(h => cell(row[h])).join(','))].join('\n')
}

/** Builds a CSV export of platform data between two dates. */
export async function generateAdminReport(kind: ReportKind, fromIso: string, toIso: string): Promise<{ csv: string; count: number }> {
    await requireSuperAdmin()
    const from = new Date(fromIso).toISOString()
    const to = new Date(toIso).toISOString()
    const db = createAdminClient().schema('gatepass')
    let rows: Record<string, unknown>[] = []

    if (kind === 'sales') {
        const { data, error } = await db.from('transactions')
            .select('reference, amount, currency, channel, status, created_at, paid_at, reservations(quantity, guest_name, guest_email, profiles(full_name, email), ticket_tiers(name), events(title, organizers(name)))')
            .gte('created_at', from).lte('created_at', to).order('created_at').limit(LIMIT)
        if (error) throw new Error(error.message)
        rows = (data ?? []).map((t: any) => ({
            date: t.paid_at ?? t.created_at,
            reference: t.reference,
            event: t.reservations?.events?.title ?? '',
            organization: t.reservations?.events?.organizers?.name ?? '',
            ticket: t.reservations?.ticket_tiers?.name ?? '',
            quantity: t.reservations?.quantity ?? '',
            buyer: t.reservations?.profiles?.full_name || t.reservations?.guest_name || '',
            buyer_email: t.reservations?.profiles?.email || t.reservations?.guest_email || '',
            amount: Number(t.amount ?? 0).toFixed(2),
            currency: t.currency,
            channel: t.channel ?? '',
            status: t.status,
        }))
    } else if (kind === 'plan_fees') {
        const { data, error } = await db.from('platform_fee_payments')
            .select('reference, amount_minor, currency, covered_tickets, status, created_at, paid_at, events(title), organizers(name), platform_pricing_tiers(name)')
            .gte('created_at', from).lte('created_at', to).order('created_at').limit(LIMIT)
        if (error) throw new Error(error.message)
        rows = (data ?? []).map((f: any) => ({
            started: f.created_at,
            paid: f.paid_at ?? '',
            reference: f.reference,
            event: f.events?.title ?? '',
            organization: f.organizers?.name ?? '',
            plan: f.platform_pricing_tiers?.name ?? '',
            tickets_covered: f.covered_tickets ?? '',
            amount: money(f.amount_minor),
            currency: f.currency,
            status: f.status,
        }))
    } else if (kind === 'managed') {
        const { data, error } = await db.from('payment_sessions')
            .select('reference, amount_minor, currency, metadata, status, created_at, paid_at, organizers(name)')
            .eq('provider', 'gatepass').gte('created_at', from).lte('created_at', to).order('created_at').limit(LIMIT)
        if (error) throw new Error(error.message)
        rows = (data ?? []).map((s: any) => {
            const split = s.metadata?.managed ?? {}
            const fee = Number(split.fee_minor ?? 0)
            const held = Number(split.reserve_minor ?? 0)
            return {
                date: s.paid_at ?? s.created_at,
                reference: s.reference,
                organization: s.organizers?.name ?? '',
                sale: money(s.amount_minor),
                gatepass_fee: money(fee),
                held: money(held),
                settled_to_organizer: money(Number(s.amount_minor) - fee - held),
                currency: s.currency,
                status: s.status,
            }
        })
    } else if (kind === 'holds') {
        const { data, error } = await db.from('payment_reserves')
            .select('reference, amount_minor, fee_minor, currency, status, release_after, released_at, transfer_code, created_at, events(title), organizers(name)')
            .gte('created_at', from).lte('created_at', to).order('created_at').limit(LIMIT)
        if (error) throw new Error(error.message)
        rows = (data ?? []).map((r: any) => ({
            held_on: r.created_at,
            reference: r.reference,
            organization: r.organizers?.name ?? '',
            event: r.events?.title ?? '',
            amount: money(r.amount_minor),
            currency: r.currency,
            status: r.status,
            release_after: r.release_after,
            released_at: r.released_at ?? '',
            note: r.transfer_code ?? '',
        }))
    } else if (kind === 'events') {
        const { data, error } = await db.from('events')
            .select('id, title, slug, created_at, starts_at, ends_at, venue_name, is_published, is_featured, currency, organizers(name), ticket_tiers(price, total_quantity, quantity_sold)')
            .gte('created_at', from).lte('created_at', to).order('created_at').limit(LIMIT)
        if (error) throw new Error(error.message)
        rows = (data ?? []).map((e: any) => {
            const tiers: any[] = e.ticket_tiers ?? []
            return {
                created: e.created_at,
                title: e.title,
                organization: e.organizers?.name ?? '',
                starts: e.starts_at,
                ends: e.ends_at ?? '',
                venue: e.venue_name ?? '',
                published: e.is_published ? 'yes' : 'no',
                featured: e.is_featured ? 'yes' : 'no',
                paid_tickets: tiers.some(t => Number(t.price) > 0) ? 'yes' : 'no',
                tickets_sold: tiers.reduce((sum, t) => sum + (Number(t.quantity_sold) || 0), 0),
                capacity: tiers.reduce((sum, t) => sum + (Number(t.total_quantity) || 0), 0),
                link: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/events/${e.slug || e.id}`,
            }
        })
    } else if (kind === 'users') {
        const admin = createAdminClient()
        const [{ data: profiles }, { data: owners }] = await Promise.all([
            db.from('profiles').select('id, full_name, email, phone_number, is_super_admin'),
            db.from('organizers').select('user_id'),
        ])
        const profileFor = new Map((profiles ?? []).map((p: any) => [p.id, p]))
        const ownerIds = new Set((owners ?? []).map((o: any) => o.user_id))
        const start = new Date(from).getTime()
        const end = new Date(to).getTime()
        for (let page = 1; page <= 50; page++) {
            const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
            if (error) throw new Error(error.message)
            for (const u of data.users) {
                const joined = new Date(u.created_at).getTime()
                if (joined < start || joined > end) continue
                const p: any = profileFor.get(u.id)
                rows.push({
                    joined: u.created_at,
                    name: p?.full_name ?? '',
                    email: p?.email ?? u.email ?? '',
                    phone: p?.phone_number ?? u.phone ?? '',
                    organizer: ownerIds.has(u.id) ? 'yes' : 'no',
                    platform_admin: p?.is_super_admin ? 'yes' : 'no',
                    last_signed_in: u.last_sign_in_at ?? '',
                })
            }
            if (data.users.length < 1000) break
        }
        rows.sort((a, b) => String(a.joined).localeCompare(String(b.joined)))
    }

    return { csv: toCsv(rows), count: rows.length }
}
