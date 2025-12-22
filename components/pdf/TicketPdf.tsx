import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { format } from 'date-fns'

// Register Fonts
// Note: Inter works better for modern tech aesthetic
// For now sticking to Helvetica (Standard) but optimizing layout

const styles = StyleSheet.create({
    page: {
        backgroundColor: '#FFFFFF',
        fontFamily: 'Helvetica',
        padding: 0,
    },
    // Ticket Container
    container: {
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    // Hero Poster Section
    posterSection: {
        width: '100%',
        height: 180,
        position: 'relative',
        backgroundColor: '#18181b', // zinc-900
    },
    posterImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    posterOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '15 20',
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: 'extrabold',
        color: '#FFFFFF',
        textTransform: 'uppercase',
    },
    // Content Section
    content: {
        padding: 30,
        flex: 1,
    },
    // Info Grid
    infoRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    infoBlock: {
        flex: 1,
    },
    label: {
        fontSize: 8,
        color: '#71717a', // zinc-500
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    value: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#000000',
    },
    // Multi-line values (address)
    subValue: {
        fontSize: 10,
        color: '#71717a',
        marginTop: 2,
    },
    // QR Code Section
    qrWrapper: {
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: '#f4f4f5', // zinc-100
        borderRadius: 20,
        marginVertical: 10,
    },
    qrCode: {
        width: 140,
        height: 140,
    },
    qrText: {
        marginTop: 10,
        fontSize: 8,
        color: '#a1a1aa', // zinc-400
        fontFamily: 'Courier',
        letterSpacing: 2,
    },
    // Border Divider
    divider: {
        height: 1,
        backgroundColor: '#e4e4e7', // zinc-200
        marginVertical: 15,
    },
    // Footer
    footer: {
        padding: '20 30',
        borderTopWidth: 1,
        borderTopColor: '#f4f4f5',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 7,
        color: '#a1a1aa',
        textTransform: 'uppercase',
        letterSpacing: 1,
    }
})

interface TicketPageProps {
    event: any
    ticket: any
}

const TicketPage = ({ event, ticket }: TicketPageProps) => {
    const qrData = ticket.qr_code_hash || ticket.id
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${qrData}&color=000000`

    const attendeeName = ticket.profiles?.full_name || ticket.guest_name || 'Valued Guest'
    const eventDate = new Date(event.starts_at)
    const tierName = ticket.ticket_tiers?.name || 'Entry Pass'

    return (
        <Page size="A6" style={styles.page}>
            <View style={styles.container}>
                {/* Hero Header */}
                <View style={styles.posterSection}>
                    {event.poster_url && (
                        <Image src={event.poster_url} style={styles.posterImage} />
                    )}
                    <View style={styles.posterOverlay}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                    </View>
                </View>

                {/* Body Content */}
                <View style={styles.content}>
                    {/* Time & Venue Row */}
                    <View style={styles.infoRow}>
                        <View style={styles.infoBlock}>
                            <Text style={styles.label}>Date & Time</Text>
                            <Text style={styles.value}>{format(eventDate, 'EEEE, MMM d')}</Text>
                            <Text style={styles.subValue}>{format(eventDate, 'h:mm a')}</Text>
                        </View>
                        <View style={styles.infoBlock}>
                            <Text style={styles.label}>Venue</Text>
                            <Text style={styles.value}>{event.venue_name}</Text>
                            {event.venue_address && (
                                <Text style={styles.subValue}>{event.venue_address}</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Attendee Row */}
                    <View style={styles.infoRow}>
                        <View style={styles.infoBlock}>
                            <Text style={styles.label}>Attendee</Text>
                            <Text style={styles.value}>{attendeeName}</Text>
                        </View>
                        <View style={styles.infoBlock}>
                            <Text style={styles.label}>Tier</Text>
                            <Text style={styles.value}>{tierName}</Text>
                        </View>
                    </View>

                    {/* QR Code Section */}
                    <View style={styles.qrWrapper}>
                        <Image src={qrUrl} style={styles.qrCode} />
                        <Text style={styles.qrText}>#{qrData.substring(0, 16).toUpperCase()}</Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>GatePass Digital Ticket</Text>
                    <Text style={styles.footerText}>Secure Entry</Text>
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
