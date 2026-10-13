import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { ZONE_BY_CURRENCY } from './TicketPdf'

Font.registerHyphenationCallback(word => [word])

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gatepass.so').replace(/\/$/, '')
const INK = '#0d0d0d'
const MUTED = '#6b6b6b'
const LINE = '#e6e6e6'

const s = StyleSheet.create({
    page: { backgroundColor: '#ffffff', fontFamily: 'Helvetica', color: INK, paddingVertical: 48, paddingHorizontal: 52, fontSize: 10 },
    top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    brand: { flexDirection: 'row', alignItems: 'center' },
    brandMark: { width: 18, height: 18, borderRadius: 4, marginRight: 6 },
    brandText: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
    status: { fontSize: 9, color: MUTED },

    label: { fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
    amountLabel: { marginTop: 36, fontSize: 10, color: MUTED },
    amount: { marginTop: 4, fontSize: 34, fontFamily: 'Helvetica-Bold', letterSpacing: -1 },
    paidOn: { marginTop: 6, fontSize: 10, color: MUTED },

    meta: { marginTop: 28, flexDirection: 'row', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 14 },
    metaCell: { flex: 1, paddingRight: 12 },
    metaValue: { marginTop: 4, fontSize: 10, fontFamily: 'Helvetica-Bold' },
    metaSub: { marginTop: 2, fontSize: 9, color: MUTED },

    section: { marginTop: 30 },
    sectionTitle: { fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: LINE },
    rowLabel: { flex: 1, paddingRight: 12 },
    rowDetail: { color: MUTED },
    rowValue: { fontFamily: 'Helvetica-Bold' },
    muted: { color: MUTED },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
    totalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
    totalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold' },

    note: { marginTop: 30, padding: 14, backgroundColor: '#f6f6f6', borderRadius: 10, fontSize: 9, color: MUTED, lineHeight: 1.5 },
    footer: { position: 'absolute', left: 52, right: 52, bottom: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: MUTED },
})

export type ReceiptLine = { label: string; detail?: string; amount: number; tone?: 'muted' }

export type ReceiptData = {
    reference: string
    paidAt: string
    status: 'paid' | 'free' | 'pending'
    currency: string
    total: number
    lines: ReceiptLine[]
    buyer: { name: string; email?: string | null }
    event: { title: string; startsAt?: string | null; venue?: string | null }
    organizer?: string | null
    provider?: { name: string; method?: string | null } | null
}

const money = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)

// Local time where the event happens (guessed from its currency until events store a zone)
const longDate = (iso: string, currency: string) =>
    new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONE_BY_CURRENCY[currency] ?? 'Africa/Accra' })

/** A plain receipt: what was bought, what was paid, who sold it and who processed the payment. */
export const ReceiptPdf = ({ data }: { data: ReceiptData }) => {
    const { currency } = data
    return (
        <Document title={`Receipt ${data.reference}`} author="GatePass">
            <Page size="A4" style={s.page}>
                <View style={s.top}>
                    <View style={s.brand}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                        <Image src={`${SITE_URL}/email/gatepass-mark.png`} style={s.brandMark} />
                        <Text style={s.brandText}>GatePass</Text>
                    </View>
                    <Text style={s.status}>Receipt · {data.status === 'free' ? 'Free order' : data.status === 'paid' ? 'Paid' : 'Pending'}</Text>
                </View>

                <Text style={s.amountLabel}>{data.status === 'free' ? 'Total' : 'Amount paid'}</Text>
                <Text style={s.amount}>{data.total === 0 ? 'Free' : money(data.total, currency)}</Text>
                <Text style={s.paidOn}>{longDate(data.paidAt, currency)}</Text>

                <View style={s.meta}>
                    <View style={s.metaCell}>
                        <Text style={s.label}>Billed to</Text>
                        <Text style={s.metaValue}>{data.buyer.name}</Text>
                        {data.buyer.email ? <Text style={s.metaSub}>{data.buyer.email}</Text> : null}
                    </View>
                    <View style={s.metaCell}>
                        <Text style={s.label}>Event</Text>
                        <Text style={s.metaValue}>{data.event.title}</Text>
                        {data.event.startsAt ? <Text style={s.metaSub}>{longDate(data.event.startsAt, currency)}</Text> : null}
                        {data.event.venue ? <Text style={s.metaSub}>{data.event.venue}</Text> : null}
                    </View>
                    <View style={s.metaCell}>
                        <Text style={s.label}>Reference</Text>
                        <Text style={[s.metaValue, { fontFamily: 'Courier-Bold' }]}>{data.reference}</Text>
                    </View>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionTitle}>Order</Text>
                    {data.lines.map((line, i) => (
                        <View key={i} style={s.row}>
                            <Text style={[s.rowLabel, line.tone === 'muted' ? s.muted : {}]}>
                                {line.label}{line.detail ? <Text style={s.rowDetail}>  {line.detail}</Text> : null}
                            </Text>
                            <Text style={[s.rowValue, line.tone === 'muted' ? s.muted : {}]}>
                                {line.amount < 0 ? `- ${money(-line.amount, currency)}` : money(line.amount, currency)}
                            </Text>
                        </View>
                    ))}
                    <View style={s.totalRow}>
                        <Text style={s.totalLabel}>Total</Text>
                        <Text style={s.totalValue}>{money(data.total, currency)}</Text>
                    </View>
                </View>

                {data.provider || data.organizer ? (
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Payment</Text>
                        {data.provider ? (
                            <View style={s.row}>
                                <Text style={s.rowLabel}>Paid with</Text>
                                <Text style={s.rowValue}>{data.provider.name}{data.provider.method ? ` · ${data.provider.method}` : ''}</Text>
                            </View>
                        ) : null}
                        {data.organizer ? (
                            <View style={s.row}>
                                <Text style={s.rowLabel}>Sold by</Text>
                                <Text style={s.rowValue}>{data.organizer}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                <Text style={s.note}>
                    {data.organizer ? `Tickets are sold by ${data.organizer}` : 'Tickets are sold by the event organizer'}
                    {data.provider ? `, and the payment was processed by ${data.provider.name} directly to their account` : ''}. GatePass provides the ticketing platform and doesn’t hold ticket payments. For refunds or questions about the event, contact the organizer.
                </Text>

                <View style={s.footer} fixed>
                    <Text>GatePass · gatepass.so</Text>
                    <Text>support@gatepass.so</Text>
                </View>
            </Page>
        </Document>
    )
}
