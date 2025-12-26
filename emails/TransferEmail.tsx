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

interface TransferEmailProps {
    eventName?: string;
    senderName?: string;
    claimUrl?: string;
    posterUrl?: string;
}

export const TransferEmail = ({
    eventName = "Exclusive Event",
    senderName = "A friend",
    claimUrl = "https://gatepass.so/claim/demo",
    posterUrl,
}: TransferEmailProps) => {
    const previewText = `${senderName} sent you a ticket for ${eventName}`;

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
                        <Section className="text-center mb-10">
                            <Text className="text-2xl font-black tracking-tighter m-0">GATEPASS</Text>
                        </Section>

                        <Section className="mb-8 border border-gray-100 rounded-[32px] overflow-hidden shadow-2xl shadow-black/5">
                            {/* Header Image */}
                            {posterUrl && (
                                <Section className="bg-gray-100">
                                    <Img
                                        src={posterUrl}
                                        width="100%"
                                        alt={eventName}
                                        className="w-full object-cover"
                                    />
                                </Section>
                            )}

                            <Section className="p-10 bg-white" style={{ borderRadius: '32px' }}>
                                {/* User Avatars Row Concept */}
                                <Section className="mb-8">
                                    <Text className="text-[13px] font-bold text-gray-400 uppercase tracking-widest text-center m-0 mb-4">Ticket Transfer</Text>
                                    <Heading className="text-3xl font-black text-gray-900 leading-tight mb-2 text-center">
                                        You've got a ticket!
                                    </Heading>
                                    <Text className="text-base text-gray-600 text-center m-0 font-medium leading-relaxed">
                                        <span className="font-bold text-black">{senderName}</span> just sent you an invite to <span className="font-bold text-black">{eventName}</span>.
                                    </Text>
                                </Section>

                                <Section className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent w-full mb-8" />

                                {/* CTA */}
                                <Section className="text-center">
                                    <Button
                                        href={claimUrl}
                                        style={{
                                            backgroundColor: '#000000',
                                            borderRadius: '16px',
                                            color: '#fff',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            textDecoration: 'none',
                                            textAlign: 'center' as const,
                                            display: 'block',
                                            width: '100%',
                                            padding: '20px 0',
                                        }}
                                    >
                                        Accept Ticket
                                    </Button>
                                    <Text className="text-xs text-gray-400 mt-4 leading-relaxed font-medium">
                                        This link will expire in 48 hours. Please claim it soon to secure your spot.
                                    </Text>
                                </Section>
                            </Section>
                        </Section>

                        {/* Footer */}
                        <Section className="mt-8 text-center px-4">
                            <Text className="text-xs text-gray-400 mb-2 font-medium">
                                GatePass is the first video-powered marketplace for modern creators and discerning attendees.
                            </Text>
                            <Text className="text-xs text-gray-400 m-0 font-bold">
                                © 2025 GatePass. Digital Assets for the Physical World.
                            </Text>
                        </Section>

                    </Container>
                </Body>
            </Tailwind>
        </Html >
    );
};

export default TransferEmail;
