import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import QRCode from 'qrcode'

/* eslint-disable @typescript-eslint/no-explicit-any -- tickets arrive as loosely typed joined rows */

// No mid-word hyphenation in short ticket copy
Font.registerHyphenationCallback(word => [word])

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gatepass.so').replace(/\/$/, '')

const INK = '#0d0d0d'
const MUTED = '#6b6b6b'
const LINE = '#e6e6e6'

const s = StyleSheet.create({
    page: { backgroundColor: '#ffffff', fontFamily: 'Helvetica', color: INK, padding: 28 },
    card: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 18, overflow: 'hidden' },

    hero: { height: 150, backgroundColor: INK, position: 'relative' },
    heroImage: { width: '100%', height: '100%', objectFit: 'cover' },
    heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, backgroundColor: '#000000', opacity: 0.25 },
    brand: { position: 'absolute', top: 14, left: 16, flexDirection: 'row', alignItems: 'center' },
    brandMark: { width: 14, height: 14, borderRadius: 3, marginRight: 5 },
    brandText: { color: '#ffffff', fontSize: 9, fontFamily: 'Helvetica-Bold' },
    counter: { position: 'absolute', top: 15, right: 16, color: '#ffffff', fontSize: 8, opacity: 0.85 },

    body: { paddingHorizontal: 22, paddingTop: 18 },
    title: { fontSize: 22, fontFamily: 'Helvetica-Bold', lineHeight: 1.1, letterSpacing: -0.4 },
    when: { marginTop: 8, fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
    where: { marginTop: 2, fontSize: 9.5, color: MUTED },

    grid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: LINE },
    cell: { width: '50%', paddingTop: 10, paddingBottom: 4, paddingRight: 8 },
    label: { fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
    value: { marginTop: 3, fontSize: 10, fontFamily: 'Helvetica-Bold' },

    tear: { marginTop: 14, flexDirection: 'row', alignItems: 'center' },
    notch: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE },
    dashes: { flex: 1, borderTopWidth: 1, borderTopColor: LINE, borderTopStyle: 'dashed' },

    stub: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14 },
    qrBox: { padding: 6, borderWidth: 1, borderColor: LINE, borderRadius: 10 },
    qr: { width: 118, height: 118 },
    stubText: { flex: 1, marginLeft: 18 },
    stubTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
    stubNote: { marginTop: 4, fontSize: 8.5, color: MUTED, lineHeight: 1.4 },
    ref: { marginTop: 10, fontSize: 9, fontFamily: 'Courier-Bold', letterSpacing: 1 },

    footer: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: MUTED },
})

export type PdfTicket = {
    id: string
    qr_code_hash: string | null
    order_reference?: string | null
    guest_name?: string | null
    ticket_tiers?: { name?: string | null } | null
    profiles?: { full_name?: string | null } | null
    qrDataUrl: string
}

/** QR codes are drawn here, from the full ticket code, so nothing is sent to an outside QR service. */
export async function withQrCodes(tickets: any[]): Promise<PdfTicket[]> {
    return Promise.all(tickets.map(async t => ({
        ...t,
        qrDataUrl: await QRCode.toDataURL(t.qr_code_hash || t.id, { margin: 0, width: 480, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }),
    })))
}

// Events don't store a time zone yet; the currency is a good hint for where they happen
export const ZONE_BY_CURRENCY: Record<string, string> = {
    GHS: 'Africa/Accra', NGN: 'Africa/Lagos', KES: 'Africa/Nairobi', UGX: 'Africa/Kampala', TZS: 'Africa/Dar_es_Salaam',
    RWF: 'Africa/Kigali', ZAR: 'Africa/Johannesburg', ZMW: 'Africa/Lusaka', XOF: 'Africa/Dakar', XAF: 'Africa/Douala', GMD: 'Africa/Banjul',
}

function formatWhen(iso: string, currency?: string | null) {
    const timeZone = ZONE_BY_CURRENCY[(currency || '').toUpperCase()] ?? 'Africa/Accra'
    const date = new Date(iso)
    const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone })
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone })
    return `${day} · ${time}`
}

const TicketPage = ({ event, ticket, index, total }: { event: any; ticket: PdfTicket; index: number; total: number }) => {
    const name = ticket.profiles?.full_name || ticket.guest_name || 'Guest'
    const tier = ticket.ticket_tiers?.name || 'General admission'
    const ref = ticket.id.slice(0, 8).toUpperCase()
    const where = [event.venue_name, event.venue_address].filter(Boolean).join(', ')

    return (
        <Page size="A5" style={s.page}>
            <View style={s.card}>
                <View style={s.hero}>
                    {event.poster_url ? (
                        <>
                            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                            <Image src={event.poster_url} style={s.heroImage} />
                            <View style={s.heroShade} />
                        </>
                    ) : null}
                    <View style={s.brand}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image src={`${SITE_URL}/email/gatepass-mark.png`} style={s.brandMark} />
                        <Text style={s.brandText}>GatePass</Text>
                    </View>
                    {total > 1 && <Text style={s.counter}>Ticket {index + 1} of {total}</Text>}
                </View>

                <View style={s.body}>
                    <Text style={s.title}>{event.title}</Text>
                    <Text style={s.when}>{formatWhen(event.starts_at, event.currency)}</Text>
                    {where ? <Text style={s.where}>{where}</Text> : null}

                    <View style={s.grid}>
                        <View style={s.cell}><Text style={s.label}>Name</Text><Text style={s.value}>{name}</Text></View>
                        <View style={s.cell}><Text style={s.label}>Ticket</Text><Text style={s.value}>{tier}</Text></View>
                        <View style={s.cell}><Text style={s.label}>Order</Text><Text style={s.value}>{(ticket.order_reference || ref).slice(0, 12).toUpperCase()}</Text></View>
                        <View style={s.cell}><Text style={s.label}>Organizer</Text><Text style={s.value}>{event.organizers?.name || '—'}</Text></View>
                    </View>
                </View>

                <View style={s.tear}>
                    <View style={[s.notch, { marginLeft: -7 }]} />
                    <View style={s.dashes} />
                    <View style={[s.notch, { marginRight: -7 }]} />
                </View>

                <View style={s.stub}>
                    <View style={s.qrBox}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image src={ticket.qrDataUrl} style={s.qr} />
                    </View>
                    <View style={s.stubText}>
                        <Text style={s.stubTitle}>Show this at the door</Text>
                        <Text style={s.stubNote}>Each code works once. Keep it private: anyone with this code can use the ticket.</Text>
                        <Text style={s.ref}>#{ref}</Text>
                    </View>
                </View>
            </View>
            <View style={s.footer}>
                <Text>Manage or transfer at gatepass.so/my-tickets</Text>
                <Text>gatepass.so</Text>
            </View>
        </Page>
    )
}

export const TicketPdf = ({ event, tickets }: { event: any; tickets: PdfTicket[] }) => (
    <Document title={`Tickets for ${event.title}`} author="GatePass">
        {tickets.map((ticket, i) => <TicketPage key={ticket.id} event={event} ticket={ticket} index={i} total={tickets.length} />)}
    </Document>
)
