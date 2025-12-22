import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { format } from 'date-fns'

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        fontFamily: 'Helvetica',
        padding: 40,
    },
    header: {
        marginBottom: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    brand: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 2,
        textTransform: 'uppercase'
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000'
    },
    metaGrid: {
        flexDirection: 'row',
        marginBottom: 40,
        gap: 60
    },
    metaItem: {
        flexDirection: 'column'
    },
    label: {
        fontSize: 8,
        color: '#888',
        marginBottom: 4,
        textTransform: 'uppercase'
    },
    value: {
        fontSize: 10,
        color: '#000'
    },
    lineItems: {
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#EEE',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    rowLabel: {
        fontSize: 10,
        color: '#444'
    },
    rowValue: {
        fontSize: 10,
        color: '#000',
        fontWeight: 'bold'
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 15,
        marginTop: 10
    },
    totalLabel: {
        fontSize: 12,
        fontWeight: 'bold'
    },
    totalValue: {
        fontSize: 16,
        fontWeight: 'bold'
    },
    footer: {
        marginTop: 'auto',
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#EEE'
    },
    footerText: {
        fontSize: 8,
        color: '#999',
        textAlign: 'center',
        marginBottom: 4
    }
})

interface ReceiptPdfProps {
    reservation: any
    transaction: any
    event: any
    formattedDate: string
}

export const ReceiptPdf = ({ reservation, transaction, event, formattedDate }: ReceiptPdfProps) => {
    // Calculations
    // Assuming transaction amount is in minor units (cents) if fetched from Paystack/stored raw
    // Or major units? In payment.ts we stored `rawAmount` which was `tx.amount / 100`.
    // So transaction.amount is in MAJOR units (Dollars/Cedis).

    const amountPaid = transaction?.amount || 0
    const currency = transaction?.currency || 'GHS'
    const subtotal = amountPaid // Simplified, need to separate fees if possible

    // Attempt to deduce fees if stored
    const platformFee = transaction?.platform_fee || 0
    // If platform_fee is stored, subtotal usually includes it or excludes it?
    // In payment.ts: `rawAmount` is what user paid. `platformFee` is calculated from subtotal.
    // If Fee Bearer is Customer: User Paid = Price + Fees.
    // If Fee Bearer is Organizer: User Paid = Price.
    // Let's rely on `amount` as Total Paid.

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.brand}>GATEPASS</Text>
                    <Text style={styles.title}>RECEIPT</Text>
                </View>

                <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                        <Text style={styles.label}>DATE</Text>
                        <Text style={styles.value}>{formattedDate}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Text style={styles.label}>ORDER REFERENCE</Text>
                        <Text style={styles.value}>{reservation.reference}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Text style={styles.label}>BILLED TO</Text>
                        <Text style={styles.value}>
                            {reservation.profiles?.full_name || reservation.guest_name || 'Guest Customer'}
                        </Text>
                        <Text style={styles.value}>
                            {reservation.profiles?.email || reservation.guest_email}
                        </Text>
                    </View>
                </View>

                <View style={[styles.metaItem, { marginBottom: 40 }]}>
                    <Text style={styles.label}>EVENT</Text>
                    <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{event.title}</Text>
                    <Text style={styles.value}>{event.venue_name}</Text>
                    <Text style={styles.value}>{format(new Date(event.starts_at), 'PPP p')}</Text>
                </View>

                <View style={styles.lineItems}>
                    <View style={styles.row}>
                        <Text style={styles.rowLabel}>
                            {reservation.ticket_tiers?.name || 'Ticket'} x {reservation.quantity || 1}
                        </Text>
                        <Text style={styles.rowValue}>
                            {currency} {amountPaid.toFixed(2)}
                        </Text>
                    </View>

                    {/* If we had specific fee breakdown visible to user, add here.
                        For now, showing distinct subtotal/fee is risky if data isn't perfect.
                        Standard receipt shows Total.
                    */}

                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>TOTAL PAID</Text>
                        <Text style={styles.totalValue}>{currency} {amountPaid.toFixed(2)}</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Authorized by GatePass</Text>
                    <Text style={styles.footerText}>Thank you for your purchase.</Text>
                </View>
            </Page>
        </Document>
    )
}
