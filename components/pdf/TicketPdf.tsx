import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { format } from 'date-fns'

const styles = StyleSheet.create({
    page: {
        backgroundColor: '#FFFFFF',
        fontFamily: 'Helvetica',
        padding: 0,
    },
    container: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
    },
    // Top: Main Information Section
    main: {
        width: '100%',
        height: '75%',
        padding: 40,
        display: 'flex',
        flexDirection: 'column',
    },
    eventLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 2.5,
        color: '#000000',
        marginBottom: 15,
    },
    eventTitle: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#000000',
        textTransform: 'uppercase',
        marginBottom: 60,
        lineHeight: 1,
    },

    gridRow: {
        flexDirection: 'row',
        borderTopWidth: 1.5,
        borderTopColor: '#000000',
        paddingTop: 20,
        marginBottom: 40,
    },
    gridCell: {
        flex: 1,
    },
    gridLabel: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#71717a',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 8,
    },
    gridValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#000000',
        textTransform: 'uppercase',
    },

    bottomSection: {
        marginTop: 'auto',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    brandMark: {
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: -0.5,
    },

    // Bottom: The Stub Section
    stub: {
        width: '100%',
        height: '25%',
        backgroundColor: '#000000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 40,
        position: 'relative',
    },
    perforationLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        borderTopWidth: 1,
        borderTopColor: '#FFFFFF',
        borderTopStyle: 'dashed',
        opacity: 0.3,
    },
    stubLabelGroup: {
        flexDirection: 'column',
    },
    stubLabel: {
        color: '#f59e0b',
        fontSize: 7,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 8,
    },
    qrWrapper: {
        backgroundColor: '#FFFFFF',
        padding: 8,
        borderRadius: 4,
    },
    qrImage: {
        width: 100,
        height: 100,
    },
    stubSerial: {
        color: '#FFFFFF',
        fontSize: 8,
        fontFamily: 'Courier',
        letterSpacing: 1.5,
        opacity: 0.6,
        marginTop: 10,
    },

    // Decorative Elements (Cutouts on side now)
    circleCutoutLeft: {
        position: 'absolute',
        top: '75%',
        left: -12,
        marginTop: -12,
        width: 24,
        height: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 100,
        zIndex: 100,
    },
    circleCutoutRight: {
        position: 'absolute',
        top: '75%',
        right: -12,
        marginTop: -12,
        width: 24,
        height: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 100,
        zIndex: 100,
    },
})

interface TicketPageProps {
    event: any
    ticket: any
}

const TicketPage = ({ event, ticket }: TicketPageProps) => {
    const qrData = (ticket.qr_code_hash || ticket.id).substring(0, 16).toUpperCase()
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${qrData}&color=000000`

    const attendeeName = (ticket.profiles?.full_name || ticket.guest_name || 'Valued Guest').toUpperCase()
    const eventDate = new Date(event.starts_at)
    const tierName = (ticket.ticket_tiers?.name || 'Entry Pass').toUpperCase()

    return (
        <Page size="A5" orientation="portrait" style={styles.page}>
            <View style={styles.container}>
                {/* Visual Cutouts */}
                <View style={styles.circleCutoutLeft} />
                <View style={styles.circleCutoutRight} />

                {/* Main Content Section */}
                <View style={styles.main}>
                    <Text style={styles.eventLabel}>Official Ticket / Entry Pass</Text>
                    <Text style={styles.eventTitle}>{event.title}</Text>

                    <View style={styles.gridRow}>
                        <View style={styles.gridCell}>
                            <Text style={styles.gridLabel}>Attendee</Text>
                            <Text style={styles.gridValue}>{attendeeName}</Text>
                        </View>
                        <View style={styles.gridCell}>
                            <Text style={styles.gridLabel}>Ticket Type</Text>
                            <Text style={[styles.gridValue, { color: '#f59e0b' }]}>{tierName}</Text>
                        </View>
                    </View>

                    <View style={styles.gridRow}>
                        <View style={[styles.gridCell, { flex: 1.2 }]}>
                            <Text style={styles.gridLabel}>Date / Time</Text>
                            <Text style={styles.gridValue}>
                                {format(eventDate, 'MMM dd yyyy')} — {format(eventDate, 'HH:mm')}
                            </Text>
                        </View>
                        <View style={styles.gridCell}>
                            <Text style={styles.gridLabel}>Location</Text>
                            <Text style={styles.gridValue}>{event.venue_name}</Text>
                        </View>
                    </View>

                    <View style={styles.bottomSection}>
                        <Text style={styles.brandMark}>GATEPASS</Text>
                        <Text style={[styles.gridLabel, { marginBottom: 0 }]}>
                            GP-{ticket.id.substring(0, 8).toUpperCase()}
                        </Text>
                    </View>
                </View>

                {/* The Ticket Stub */}
                <View style={styles.stub}>
                    <View style={styles.perforationLine} />

                    <View style={styles.stubLabelGroup}>
                        <Text style={styles.stubLabel}>Valid Entry</Text>
                        <Text style={styles.stubSerial}>{qrData}</Text>
                    </View>

                    <View style={styles.qrWrapper}>
                        <Image src={qrUrl} style={styles.qrImage} />
                    </View>
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
    const ticketList = Array.isArray(tickets) ? tickets : [tickets]

    return (
        <Document title={`Tickets for ${event.title}`}>
            {ticketList.map((ticket) => (
                <TicketPage key={ticket.id} event={event} ticket={ticket} />
            ))}
        </Document>
    )
}
