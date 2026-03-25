import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Section,
    Text,
    Tailwind,
} from "@react-email/components";
import * as React from "react";

interface PayoutEmailProps {
    organizerName: string;
    amount: string;
    reference: string;
    eventName: string;
    date: string;
}

export const PayoutEmail = ({
    organizerName = "Organizer",
    amount = "GHS 0.00",
    reference = "GP-PAY-000",
    eventName = "Your Event",
    date = "Today",
}: PayoutEmailProps) => {
    const previewText = `Payout Successful: ${amount} for ${eventName}`;

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
                                    200: "#e5e7eb",
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
                        <Section className="text-center mb-8">
                            <Text className="text-2xl font-black tracking-tighter m-0">GATEPASS</Text>
                        </Section>

                        <Section className="p-8 bg-black text-white rounded-[2rem] shadow-xl text-center">
                            <Heading className="text-xl font-bold mb-2">Payout Sent Successfully!</Heading>
                            <Text className="text-sm text-white/60 mb-8">Hello {organizerName}, your funds are on the way.</Text>

                            <Section className="bg-white/10 rounded-2xl p-6 mb-8 border border-white/5">
                                <Text className="text-[10px] font-bold text-white/40 uppercase tracking-widest m-0 mb-1">TOTAL SENT</Text>
                                <Heading className="text-4xl font-black text-white m-0 mb-4">{amount}</Heading>
                                
                                <div className="border-t border-white/10 pt-4 space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/40">Event</span>
                                        <span className="font-bold">{eventName}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/40">Reference</span>
                                        <span className="font-mono">{reference}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/40">Date</span>
                                        <span className="font-bold">{date}</span>
                                    </div>
                                </div>
                            </Section>

                            <Text className="text-xs text-white/40 leading-relaxed">
                                Funds usually arrive within 1-2 hours for Mobile Money and 1 business day for Bank transfers.
                            </Text>
                        </Section>

                        <Section className="mt-8 text-center">
                            <Text className="text-xs text-gray-400 m-0">
                                © 2025 GatePass. All rights reserved.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default PayoutEmail;
