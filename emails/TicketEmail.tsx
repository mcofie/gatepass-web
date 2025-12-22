import {
    Body,
    Container,
    Column,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Row,
    Section,
    Text,
    Tailwind,
    Button,
} from "@react-email/components";
import * as React from "react";

interface TicketItem {
    id: string
    qrCodeUrl: string
    type: string
}

interface TicketEmailProps {
    eventName?: string;
    eventDate?: string;
    venueName?: string;
    // Legacy props for single ticket (optional now)
    ticketType?: string;
    qrCodeUrl?: string;
    ticketId?: string;
    // New prop for multiple tickets
    tickets?: TicketItem[];
    customerName?: string;
    posterUrl?: string;
    reservationId?: string;
}

export const TicketEmail = ({
    eventName = "Exclusive Event",
    eventDate = "Dec 25, 2025 • 8:00 PM",
    venueName = "The Grand Arena, Accra",
    ticketType = "VIP Access",
    qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=GATEPASS-DEMO",
    customerName = "Guest",
    ticketId = "GP-123456",
    tickets = [],
    posterUrl,
    reservationId,
}: TicketEmailProps) => {
    const previewText = `Your ${tickets.length > 1 ? 'tickets' : 'ticket'} for ${eventName}`;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName)}`;

    // Normalize tickets: if array is empty, use the single props
    const ticketList = tickets.length > 0 ? tickets : [{ id: ticketId, qrCodeUrl, type: ticketType }];

    return (
        <Html>
            <Preview>{previewText}</Preview>
            <Tailwind
                config={{
                    theme: {
                        extend: {
                            colors: {
                                black: "#000",
                                gray: {
                                    50: "#f9fafb",
                                    100: "#f3f4f6",
                                    800: "#1f2937",
                                    900: "#111827",
                                },
                            },
                            fontFamily: {
                                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
                            },
                        },
                    },
                }}
            >
                <Head />
                <Body className="bg-white my-auto mx-auto font-sans antialiased text-black">
                    <Container className="my-[40px] mx-auto p-0 max-w-[420px]">

                        {/* Logo Header */}
                        <Section className="text-center mb-8">
                            <Text className="text-2xl font-black tracking-tighter m-0">GATEPASS</Text>
                        </Section>

                        {ticketList.map((ticket) => (
                            <Section key={ticket.id} className="mb-8 border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                                {/* Header Image (Only if poster exists) */}
                                {posterUrl && (
                                    <Section className="bg-gray-100 relative">
                                        <Img
                                            src={posterUrl}
                                            width="100%"
                                            alt={eventName}
                                            className="w-full object-cover rounded-t-3xl"
                                        />
                                    </Section>
                                )}

                                <Section className="p-8 bg-white border border-gray-200 rounded-b-3xl" style={{ borderTop: posterUrl ? 'none' : '1px solid #e5e7eb', borderRadius: posterUrl ? '0 0 24px 24px' : '24px' }}>
                                    {/* Event Title */}
                                    <Heading className="text-2xl font-black text-gray-900 leading-tight mb-2 text-center">
                                        {eventName}
                                    </Heading>
                                    <Text className="text-sm text-gray-500 text-center m-0 mb-8 font-medium">
                                        Admit One • {customerName}
                                    </Text>

                                    {/* Info Grid */}
                                    <Section className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
                                        <Row className="mb-4">
                                            <Column align="left">
                                                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest m-0 mb-1">DATE</Text>
                                                <Text className="text-sm font-bold text-gray-900 m-0">{eventDate}</Text>
                                            </Column>
                                            <Column align="right">
                                                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest m-0 mb-1">TIER</Text>
                                                <Text className="text-sm font-bold text-gray-900 m-0">{ticket.type}</Text>
                                            </Column>
                                        </Row>
                                        <Row>
                                            <Column align="left">
                                                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest m-0 mb-1">VENUE</Text>
                                                <Link href={mapUrl} className="text-sm font-bold text-gray-900 m-0 underline decoration-gray-300 underline-offset-2">
                                                    {venueName}
                                                </Link>
                                            </Column>
                                        </Row>
                                    </Section>

                                    {/* QR Code */}
                                    <Section className="text-center mb-8">
                                        <div className="bg-white p-3 border-2 border-dashed border-gray-200 rounded-2xl inline-block">
                                            <Img
                                                src={ticket.qrCodeUrl}
                                                width="160"
                                                height="160"
                                                alt="QR Code"
                                                className="rounded-lg mix-blend-multiply"
                                            />
                                        </div>
                                        <Text className="text-xs font-mono text-gray-400 mt-4 tracking-[0.2em] uppercase">
                                            {ticket.id.substring(0, 8).toUpperCase()}
                                        </Text>
                                    </Section>

                                    {/* CTAs */}
                                    <Button
                                        href={`https://gatepass.so/ticket/${ticket.id}`}
                                        className="bg-black text-white px-8 py-4 rounded-xl text-base font-bold no-underline block w-full text-center shadow-lg shadow-black/20 hover:bg-gray-900 transition-all"
                                    >
                                        Access Ticket
                                    </Button>

                                    {reservationId && (
                                        <Section className="mt-4 text-center">
                                            <Link
                                                href={`https://gatepass.so/api/reservations/${reservationId}/receipt`}
                                                className="text-sm font-bold text-gray-400 underline decoration-gray-200 underline-offset-4 hover:text-black transition-colors"
                                            >
                                                Download Purchase Receipt
                                            </Link>
                                        </Section>
                                    )}
                                </Section>
                            </Section>
                        ))}

                        {/* Footer */}
                        <Section className="mt-8 text-center">
                            <Text className="text-xs text-gray-400 m-0">
                                © 2025 GatePass. All rights reserved.
                            </Text>
                        </Section>

                    </Container>
                </Body>
            </Tailwind>
        </Html >
    );
};

export default TicketEmail;
