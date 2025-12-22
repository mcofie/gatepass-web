import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { format } from 'date-fns'

// Register Fonts (Optional: Use standard fonts for simplicity first, or register custom if needed)
// Font.register({ family: 'Inter', src: '...' })

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF', // White background
        fontFamily: 'Helvetica',
    },
    container: {
        padding: 40,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
    },
    header: {
        marginBottom: 20,
    },
    brand: {
        fontSize: 10,
        color: '#666',
        letterSpacing: 2,
        marginBottom: 40,
        textTransform: 'uppercase'
    },
    eventName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#000'
    },
    eventDetail: {
        fontSize: 12,
        color: '#444',
        marginBottom: 4,
    },
    divider: {
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        marginVertical: 20,
    },
    ticketInfo: {
        marginBottom: 20
    },
    label: {
        fontSize: 9,
        color: '#888',
        textTransform: 'uppercase',
        marginBottom: 4,
        letterSpacing: 1
    },
    value: {
        fontSize: 14,
        color: '#000',
        marginBottom: 15,
        fontWeight: 'bold'
    },
    qrContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        padding: 20,
        backgroundColor: '#f9fafb', // Zinc-50 equivalent
        borderRadius: 12,
    },
    qrImage: {
        width: 200,
        height: 200,
    },
    qrCode: {
        marginTop: 10,
        fontSize: 10,
        color: '#666',
        letterSpacing: 2,
    },
    footer: {
        marginTop: 'auto',
        borderTopWidth: 1,
        borderTopColor: '#EEE',
        paddingTop: 20,
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    footerText: {
        fontSize: 8,
        color: '#999'
    }
})

interface TicketPageProps {
    event: any
    ticket: any
}

const TicketPage = ({ event, ticket }: TicketPageProps) => {
    // Generate QR URL (Using server API)
    const qrData = ticket.qr_code_hash
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${qrData}`

    const holderName = ticket.profiles?.full_name || ticket.guest_name || 'Guest'
    const eventDate = new Date(event.starts_at)

    return (
        <Page size="A6" style={styles.page}>
            {/* A6 is good for mobile tickets, or use A4/Letter if preferred. A6 feels like a ticket. */}
            <View style={styles.container}>
                <View>
                    <Text style={styles.brand}>GATEPASS</Text>

                    <View style={styles.header}>
                        <Text style={styles.eventName}>{event.title}</Text>
                        <Text style={styles.eventDetail}>{format(eventDate, 'EEEE, MMM d, yyyy')}</Text>
                        <Text style={styles.eventDetail}>{format(eventDate, 'h:mm a')}</Text>
                        <Text style={styles.eventDetail}>{event.venue_name}</Text>
                        {event.venue_address && <Text style={styles.eventDetail}>{event.venue_address}</Text>}
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.ticketInfo}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={styles.label}>TICKET TYPE</Text>
                                <Text style={styles.value}>{ticket.ticket_tiers.name}</Text>
                            </View>
                            <View>
                                <Text style={styles.label}>ADMIT</Text>
                                <Text style={styles.value}>1</Text>
                            </View>
                        </View>

                        <View>
                            <Text style={styles.label}>TICKET HOLDER</Text>
                            <Text style={styles.value}>{holderName}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.qrContainer}>
                    <Image src={qrUrl} style={styles.qrImage} />
                    <Text style={styles.qrCode}>{ticket.qr_code_hash}</Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>ID: {ticket.id.split('-')[0]}</Text>
                    <Text style={styles.footerText}>Scan at entry</Text>
                </View>
            </View>
        </Page>
    )
}

interface TicketPdfProps {
    event: any
    tickets: any[]
}

export const TicketPdf = ({ event, tickets }: TicketPdfProps) => {
    // Normalize tickets to array if passed as object (defensive)
    const ticketList = Array.isArray(tickets) ? tickets : [tickets]

    return (
        <Document>
            {ticketList.map((ticket) => (
                <TicketPage key={ticket.id} event={event} ticket={ticket} />
            ))}
        </Document>
    )
}
