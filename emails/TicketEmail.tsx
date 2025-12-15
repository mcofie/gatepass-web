import {
    Body,
    Container,
    Column,
    Head,
    Heading,
    Hr,
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

interface TicketEmailProps {
    eventName?: string;
    eventDate?: string;
    venueName?: string;
    ticketType?: string;
    qrCodeUrl?: string;
    customerName?: string;
    ticketId?: string;
    posterUrl?: string;
}

export const TicketEmail = ({
    eventName = "Exclusive Event",
    eventDate = "Dec 25, 2025 • 8:00 PM",
    venueName = "The Grand Arena, Accra",
    ticketType = "VIP Access",
    qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=GATEPASS-DEMO",
    customerName = "Guest",
    ticketId = "GP-123456",
    posterUrl,
}: TicketEmailProps) => {
    const previewText = `Your ticket for ${eventName}`;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName)}`;
    const dashboardUrl = `https://gatepass.xyz/my-tickets`; // Fallback/Actual URL

    return (
        <Html>
            <Head />
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
                                    200: "#e5e7eb",
                                    300: "#d1d5db",
                                    400: "#9ca3af",
                                    500: "#6b7280",
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
                <Body className="bg-white my-auto mx-auto font-sans antialiased text-black">
                    <Container className="border border-gray-100 rounded-2xl my-[40px] mx-auto p-0 max-w-[420px] overflow-hidden shadow-sm">

                        {/* Hero Section (Poster or Gradient) */}
                        <Section className="bg-gray-50 relative">
                            {posterUrl ? (
                                <Img
                                    src={posterUrl}
                                    width="100%"
                                    height="auto"
                                    alt={eventName}
                                    className="w-full object-cover max-h-[300px]"
                                />
                            ) : (
                                <div className="h-[120px] bg-gray-900 w-full flex items-center justify-center">
                                    <Text className="text-white font-bold text-2xl tracking-tighter m-0 pt-10 text-center w-full">GATEPASS</Text>
                                </div>
                            )}
                        </Section>

                        <Section className="px-[32px] py-[32px]">
                            <Heading className="text-[22px] font-bold text-gray-900 text-center p-0 m-0 leading-tight">
                                {eventName}
                            </Heading>
                            <Text className="text-[14px] text-gray-500 text-center mt-[8px] mb-0 font-medium">
                                Admitting: {customerName}
                            </Text>

                            {/* QR Code Card */}
                            <Section className="mt-[32px] mb-[32px] text-center">
                                <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 inline-block">
                                    <Img
                                        src={qrCodeUrl}
                                        width="180"
                                        height="180"
                                        alt="QR Code"
                                        className="rounded-sm"
                                    />
                                </div>
                                <Text className="text-[12px] font-mono text-gray-400 mt-3 tracking-[0.2em] uppercase">
                                    {ticketId}
                                </Text>
                            </Section>

                            {/* Event Details Grid */}
                            <Section className="bg-gray-50 rounded-xl p-5 mb-[24px]">
                                <Row className="mb-4">
                                    <Column align="left">
                                        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0 mb-1">
                                            Date & Time
                                        </Text>
                                        <Text className="text-[13px] font-semibold text-gray-900 m-0">
                                            {eventDate}
                                        </Text>
                                    </Column>
                                    <Column align="right">
                                        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0 mb-1">
                                            Ticket Type
                                        </Text>
                                        <Text className="text-[13px] font-semibold text-gray-900 m-0">
                                            {ticketType}
                                        </Text>
                                    </Column>
                                </Row>
                                <Row>
                                    <Column align="left">
                                        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider m-0 mb-1">
                                            Location
                                        </Text>
                                        <Link href={mapUrl} className="text-[13px] font-semibold text-gray-900 m-0 underline decoration-gray-300 underline-offset-2">
                                            {venueName}
                                        </Link>
                                    </Column>
                                </Row>
                            </Section>

                            {/* Action Button */}
                            <Section className="text-center mb-[20px]">
                                <Button
                                    href={dashboardUrl}
                                    className="bg-black text-white px-6 py-3 rounded-full text-[13px] font-bold no-underline block w-full hover:bg-gray-800 transition-colors"
                                >
                                    Manage My Tickets
                                </Button>
                                <Text className="text-[11px] text-gray-400 mt-3 text-center">
                                    View in app for Apple Wallet & PDF
                                </Text>
                            </Section>
                        </Section>

                        <Hr className="border-gray-100 mx-0 w-full" />

                        {/* Footer */}
                        <Section className="bg-gray-50 py-[24px]">
                            <Text className="text-[11px] text-center text-gray-500 m-0 mb-2">
                                Powered by <span className="font-bold text-black">GatePass</span>
                            </Text>
                            <Text className="text-[10px] text-center text-gray-400 m-0">
                                This email was sent to you because you purchased a ticket.
                            </Text>
                        </Section>

                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default TicketEmail;
