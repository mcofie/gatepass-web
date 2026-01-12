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
    const r = reservation
    const quantity = r.quantity || 1

    // Logic Mirror from TransactionDetailModal to ensure consistency
    const ticketBasePrice = r.ticket_tiers?.price || 0
    const ticketRevenueRaw = ticketBasePrice * quantity

    // Discount
    const discount = Array.isArray(r.discounts) ? r.discounts[0] : r.discounts
    let discountAmount = 0
    if (discount) {
        if (discount.type === 'fixed') discountAmount = discount.value
        else if (discount.type === 'percentage') {
            discountAmount = ticketRevenueRaw * (discount.value / 100)
        }
    }

    // Fees Strategy: Re-derive based on standard rates if raw fields missing, 
    // BUT rely on total amount paid (truth).
    // Normalize old 2% rate to current 1.95% for consistent display
    const storedProcessorRate = transaction?.applied_processor_rate
    const normalizedProcessorRate = (storedProcessorRate === 0.02 || !storedProcessorRate)
        ? 0.0195
        : storedProcessorRate

    const effectiveRates = {
        platformFeePercent: transaction?.applied_fee_rate ?? 0.04,
        processorFeePercent: normalizedProcessorRate
    }

    const ticketRevenueNetBase = Math.max(0, ticketRevenueRaw - discountAmount)

    // Calculate expected fees
    const calcPlatformFee = ticketRevenueNetBase * effectiveRates.platformFeePercent
    const calcProcessorFee = amountPaid * effectiveRates.processorFeePercent
    const displayPlatformFee = transaction?.platform_fee ?? calcPlatformFee
    // If we don't have stored processor fee, we estimate it
    const displayProcessorFee = transaction?.applied_processor_fee ?? calcProcessorFee

    const totalFees = displayPlatformFee + displayProcessorFee

    // Did user pay fees? Compare "Amount Paid" vs "Ticket Price".
    // If Paid > Ticket Price, likely Customer Paid Fees.
    // However, Add-ons complicate this. 
    // Best proxy: Check Event Fee Bearer setting if passed, or infer.
    // Inference: If `amountPaid` > `ticketRevenueNetBase + 1` (tolerance), assume Customer Fees + Addons

    // Let's deduce "Net Product Value" (Tickets + Addons)
    // If Fee Bearer = Customer, Net Product = Total - Fees
    // If Fee Bearer = Organizer, Net Product = Total (Fees internal)

    // We'll check the 'event.fee_bearer' if available (passed in prop as event object)
    const feeBearer = event.fee_bearer || 'customer'

    let finalClientFees = 0
    let productsTotal = amountPaid

    if (feeBearer === 'customer') {
        finalClientFees = totalFees
        productsTotal = amountPaid - totalFees
    }

    // Now split ProductsTotal into Tickets vs Addons
    // Addon = ProductsTotal - TicketNet
    let addonRevenue = Math.max(0, productsTotal - ticketRevenueNetBase)
    let effectiveTicketPrice = ticketBasePrice

    // Rounding clean up
    if (addonRevenue < 0.05) addonRevenue = 0

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
                    {event.starts_at && (
                        <Text style={styles.value}>{format(new Date(event.starts_at), 'PPP p')}</Text>
                    )}
                </View>

                <View style={styles.lineItems}>
                    {/* 1. TICKETS */}
                    <View style={styles.row}>
                        <Text style={styles.rowLabel}>
                            {reservation.ticket_tiers?.name || 'General Admission'} (x{reservation.quantity || 1})
                        </Text>
                        <Text style={styles.rowValue}>
                            {currency} {(effectiveTicketPrice * quantity).toFixed(2)}
                        </Text>
                    </View>

                    {/* 2. ADD-ONS */}
                    {addonRevenue > 0 && (
                        <View style={styles.row}>
                            <Text style={styles.rowLabel}>Add-ons</Text>
                            <Text style={styles.rowValue}>
                                {currency} {addonRevenue.toFixed(2)}
                            </Text>
                        </View>
                    )}

                    {/* 3. DISCOUNT */}
                    {discountAmount > 0 && (
                        <View style={styles.row}>
                            <Text style={[styles.rowLabel, { color: '#e11d48' }]}>Discount ({discount?.code})</Text>
                            <Text style={[styles.rowValue, { color: '#e11d48' }]}>
                                - {currency} {discountAmount.toFixed(2)}
                            </Text>
                        </View>
                    )}

                    {/* 4. FEES (If User Paid) */}
                    {finalClientFees > 0 ? (
                        <>
                            <View style={styles.row}>
                                <Text style={styles.rowLabel}>Service Fee (GatePass)</Text>
                                <Text style={styles.rowValue}>
                                    {currency} {displayPlatformFee.toFixed(2)}
                                </Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.rowLabel}>Processing Fee</Text>
                                <Text style={styles.rowValue}>
                                    {currency} {displayProcessorFee.toFixed(2)}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <View style={styles.row}>
                            <Text style={styles.rowLabel}>Fees</Text>
                            <Text style={styles.rowValue}>Included</Text>
                        </View>
                    )}

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
