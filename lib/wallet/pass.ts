import fs from 'fs'
import path from 'path'
import { PKPass } from 'passkit-generator'
import { createAdminClient } from '@/utils/supabase/admin'
import { PASS_IMAGES } from './assets'

// Must match the Pass Type ID certificate (certs/signerCert.pem: UID and OU)
const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID || 'pass.so.gatepass'
const TEAM_ID = process.env.APPLE_TEAM_ID || '4473W94GFJ'
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gatepass.so').replace(/\/$/, '')

export class WalletPassError extends Error {
    constructor(message: string, readonly status: number, readonly code?: 'virtual') { super(message) }
}

type Certificates = { signerCert: Buffer; signerKey: Buffer; wwdr: Buffer; signerKeyPassphrase?: string }
let cachedCertificates: Certificates | null = null

/** Local certs/ in development, the private "certificates" storage bucket in production. */
async function loadCertificates(): Promise<Certificates> {
    if (cachedCertificates) return cachedCertificates
    const dir = path.resolve(process.cwd(), 'certs')
    const passphrase = process.env.APPLE_PASS_KEY_PASSPHRASE || undefined

    if (fs.existsSync(path.join(dir, 'signerCert.pem'))) {
        cachedCertificates = {
            signerCert: fs.readFileSync(path.join(dir, 'signerCert.pem')),
            signerKey: fs.readFileSync(path.join(dir, 'signerKey.pem')),
            wwdr: fs.readFileSync(path.join(dir, 'wwdr.pem')),
            signerKeyPassphrase: passphrase,
        }
        return cachedCertificates
    }

    const storage = createAdminClient().storage.from('certificates')
    const files = await Promise.all(['signerCert.pem', 'signerKey.pem', 'wwdr.pem'].map(name => storage.download(name)))
    const failed = files.find(f => f.error)
    if (failed) throw new WalletPassError('Apple Wallet is not configured: upload signerCert.pem, signerKey.pem and wwdr.pem to the "certificates" bucket.', 501)
    const [signerCert, signerKey, wwdr] = await Promise.all(files.map(async f => Buffer.from(await f.data!.arrayBuffer())))
    cachedCertificates = { signerCert, signerKey, wwdr, signerKeyPassphrase: passphrase }
    return cachedCertificates
}

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null)

type TicketRow = {
    id: string
    status: string | null
    qr_code_hash: string | null
    order_reference: string | null
    reservations: {
        guest_name: string | null
        profiles: { full_name: string | null } | { full_name: string | null }[] | null
        events: {
            title: string
            starts_at: string | null
            ends_at: string | null
            venue_name: string | null
            venue_address: string | null
            latitude: number | null
            longitude: number | null
            slug: string | null
            organizers: { name: string | null } | { name: string | null }[] | null
        } | null
        ticket_tiers: { name: string | null; is_virtual: boolean | null } | null
    } | null
}

/** Builds a signed .pkpass for one ticket. */
export async function buildTicketPass(ticketId: string): Promise<{ buffer: Buffer; filename: string }> {
    const { data, error } = await createAdminClient()
        .schema('gatepass')
        .from('tickets')
        .select(`
            id, status, qr_code_hash, order_reference,
            reservations (
                guest_name,
                profiles ( full_name ),
                events ( title, starts_at, ends_at, venue_name, venue_address, latitude, longitude, slug, organizers ( name ) ),
                ticket_tiers ( name, is_virtual )
            )
        `)
        .eq('id', ticketId)
        .maybeSingle()
    if (error || !data) throw new WalletPassError('Ticket not found', 404)

    const ticket = data as unknown as TicketRow
    const reservation = one(ticket.reservations)
    const event = one(reservation?.events)
    const tier = one(reservation?.ticket_tiers)
    if (!event) throw new WalletPassError('Ticket is missing its event', 404)
    if (tier?.is_virtual) throw new WalletPassError('Livestream tickets have no entry pass', 400, 'virtual')

    const holder = one(reservation?.profiles)?.full_name || reservation?.guest_name || 'Guest'
    const organizer = one(event.organizers)?.name
    const shortCode = ticket.id.substring(0, 8).toUpperCase()
    const startsAt = event.starts_at ? new Date(event.starts_at) : null

    const images = Object.fromEntries(Object.entries(PASS_IMAGES).map(([name, b64]) => [name, Buffer.from(b64, 'base64')]))
    const pass = new PKPass(
        { ...images, 'pass.json': Buffer.from(JSON.stringify({ formatVersion: 1 })) },
        await loadCertificates(),
        {
            passTypeIdentifier: PASS_TYPE_ID,
            teamIdentifier: TEAM_ID,
            serialNumber: ticket.id,
            organizationName: organizer || 'GatePass',
            description: `Ticket for ${event.title}`,
            logoText: 'GatePass',
            backgroundColor: 'rgb(13, 13, 13)',
            foregroundColor: 'rgb(255, 255, 255)',
            labelColor: 'rgb(150, 150, 150)',
            // Scanned or refunded tickets show as void in Wallet
            voided: ticket.status !== null && !['valid', 'active'].includes(ticket.status),
        },
    )

    pass.type = 'eventTicket'
    pass.headerFields.push({ key: 'tier', label: 'TICKET', value: tier?.name || 'General' })
    pass.primaryFields.push({ key: 'event', label: 'EVENT', value: event.title })
    if (startsAt) {
        pass.secondaryFields.push({ key: 'date', label: 'DATE', value: startsAt.toISOString(), dateStyle: 'PKDateStyleMedium', timeStyle: 'PKDateStyleShort' })
    }
    if (event.venue_name) pass.secondaryFields.push({ key: 'venue', label: 'VENUE', value: event.venue_name })
    pass.auxiliaryFields.push({ key: 'holder', label: 'GUEST', value: holder })
    pass.auxiliaryFields.push({ key: 'code', label: 'CODE', value: shortCode })

    pass.backFields.push(
        ...(organizer ? [{ key: 'organizer', label: 'Organizer', value: organizer }] : []),
        ...(event.venue_address ? [{ key: 'address', label: 'Address', value: event.venue_address }] : []),
        { key: 'order', label: 'Order', value: ticket.order_reference || shortCode },
        { key: 'manage', label: 'Manage your ticket', value: `${SITE_URL}/ticket/${ticket.id}`, attributedValue: `<a href="${SITE_URL}/ticket/${ticket.id}">Open on GatePass</a>` },
        { key: 'help', label: 'At the door', value: 'Show this code to be scanned. Each code admits one person once.' },
    )

    pass.setBarcodes({
        format: 'PKBarcodeFormatQR',
        message: ticket.qr_code_hash || ticket.id,
        messageEncoding: 'iso-8859-1',
        altText: shortCode,
    })

    // Surfaces the pass on the lock screen around the event
    if (startsAt) pass.setRelevantDate(startsAt)
    if (event.latitude != null && event.longitude != null) {
        pass.setLocations({ latitude: Number(event.latitude), longitude: Number(event.longitude), relevantText: `${event.title} is here` })
    }
    const endsAt = event.ends_at ? new Date(event.ends_at) : startsAt ? new Date(startsAt.getTime() + 12 * 60 * 60 * 1000) : null
    if (endsAt) pass.setExpirationDate(new Date(endsAt.getTime() + 24 * 60 * 60 * 1000))

    const safeTitle = event.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ticket'
    return { buffer: pass.getAsBuffer(), filename: `${safeTitle}-${shortCode}.pkpass` }
}
