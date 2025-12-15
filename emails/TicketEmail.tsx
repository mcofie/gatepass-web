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
    posterUrl?: string; // Optional: Event poster image
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
                                    100: "#f5f5f5",
                                    200: "#e5e5e5",
                                    500: "#737373",
                                    900: "#171717",
                                },
                            },
                            fontFamily: {
                                sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
                            },
                        },
                    },
                }}
            >
                <Body className="bg-white my-auto mx-auto font-sans antialiased text-black">
                    <Container className="border border-gray-200 rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        {/* Logo / Header */}
                        <Section className="mt-[20px] mb-[32px]">
                            <Text className="text-[24px] font-bold text-center p-0 m-0 tracking-tight">
                                GatePass
                            </Text>
                        </Section>

                        <Heading className="text-[20px] font-bold text-center p-0 my-[30px] mx-0">
                            See you at {eventName}!
                        </Heading>

                        {/* Poster Image (Optional) */}
                        {posterUrl && (
                            <Section className="mb-[24px]">
                                <Img
                                    src={posterUrl}
                                    width="100%"
                                    height="auto"
                                    alt={eventName}
                                    className="rounded-lg object-cover"
                                />
                            </Section>
                        )}

                        {/* QR Code */}
                        <Section className="text-center mb-[32px]">
                            <div className="inline-block p-4 border border-gray-200 rounded-xl bg-gray-50">
                                <Img
                                    src={qrCodeUrl}
                                    width="200"
                                    height="200"
                                    alt="Ticket QR Code"
                                    className="mx-auto"
                                />
                            </div>
                            <Text className="text-[12px] text-gray-500 mt-2 tracking-widest uppercase">
                                {ticketId}
                            </Text>
                        </Section>

                        <Hr className="border-gray-200 mx-0 w-full" />

                        {/* Ticket Details */}
                        <Section className="my-[24px]">
                            <Row>
                                <Column>
                                    <Text className="text-[12px] font-bold text-gray-500 uppercase tracking-wider m-0">
                                        Event
                                    </Text>
                                    <Text className="text-[14px] font-medium text-black mt-[4px] mb-[16px]">
                                        {eventName}
                                    </Text>
                                </Column>
                                <Column>
                                    <Text className="text-[12px] font-bold text-gray-500 uppercase tracking-wider m-0">
                                        Date
                                    </Text>
                                    <Text className="text-[14px] font-medium text-black mt-[4px] mb-[16px]">
                                        {eventDate}
                                    </Text>
                                </Column>
                            </Row>
                            <Row>
                                <Column>
                                    <Text className="text-[12px] font-bold text-gray-500 uppercase tracking-wider m-0">
                                        Venue
                                    </Text>
                                    <Text className="text-[14px] font-medium text-black mt-[4px] mb-[16px]">
                                        {venueName}
                                    </Text>
                                </Column>
                                <Column>
                                    <Text className="text-[12px] font-bold text-gray-500 uppercase tracking-wider m-0">
                                        Ticket Type
                                    </Text>
                                    <Text className="text-[14px] font-medium text-black mt-[4px] mb-[16px]">
                                        {ticketType}
                                    </Text>
                                </Column>
                            </Row>
                        </Section>

                        <Hr className="border-gray-200 mx-0 w-full" />

                        {/* Footer */}
                        <Text className="text-[12px] text-center text-gray-500 mt-[32px]">
                            Need help? Reply to this email or contact support.
                        </Text>
                        <Text className="text-[10px] text-center text-gray-400 mt-[8px]">
                            © 2025 GatePass. All rights reserved.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default TicketEmail;
