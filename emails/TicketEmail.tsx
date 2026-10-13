import {
    Body,
    Button,
    Column,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Row,
    Section,
    Tailwind,
    Text,
} from "@react-email/components";
import * as React from "react";

interface TicketItem {
    id: string
    qrCodeUrl: string
    type: string
    isVirtual?: boolean
    virtualLink?: string | null
    virtualInstructions?: string | null
}

interface TicketGroup {
    tierName: string
    isVirtual?: boolean
    virtualLink?: string | null
    virtualInstructions?: string | null
    tickets: { id: string; qrCodeUrl: string }[]
}

interface TicketEmailProps {
    eventName?: string;
    eventDate?: string;
    venueName?: string;
    // Single ticket (legacy callers)
    ticketType?: string;
    qrCodeUrl?: string;
    ticketId?: string;
    isVirtual?: boolean;
    virtualLink?: string | null;
    virtualInstructions?: string | null;
    // One tier, flat list
    tickets?: TicketItem[];
    // Several tiers
    ticketGroups?: TicketGroup[];
    customerName?: string;
    posterUrl?: string;
    reservationId?: string;
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://gatepass.so").replace(/\/$/, "");
// Above this, the email lists codes and points to My Tickets instead of rendering every QR
const MAX_QR_CODES = 10;

const shortCode = (id: string) => id.substring(0, 8).toUpperCase();

/** Every caller shape becomes a list of tier groups. */
function toGroups(props: TicketEmailProps): TicketGroup[] {
    if (props.ticketGroups?.length) return props.ticketGroups;
    const tickets = props.tickets?.length
        ? props.tickets
        : [{ id: props.ticketId ?? "", qrCodeUrl: props.qrCodeUrl ?? "", type: props.ticketType ?? "Ticket", isVirtual: props.isVirtual, virtualLink: props.virtualLink, virtualInstructions: props.virtualInstructions }];
    const first = tickets[0];
    return [{
        tierName: first.type,
        isVirtual: first.isVirtual,
        virtualLink: first.virtualLink,
        virtualInstructions: first.virtualInstructions,
        tickets: tickets.map(t => ({ id: t.id, qrCodeUrl: t.qrCodeUrl })),
    }];
}

export const TicketEmail = (props: TicketEmailProps) => {
    const {
        eventName = "Your event",
        eventDate = "",
        venueName = "",
        customerName = "Guest",
        posterUrl,
        reservationId,
    } = props;

    const groups = toGroups(props);
    const ticketCount = groups.reduce((sum, g) => sum + g.tickets.length, 0);
    const physicalCount = groups.filter(g => !g.isVirtual).reduce((sum, g) => sum + g.tickets.length, 0);
    const showEveryQr = physicalCount <= MAX_QR_CODES;
    const firstName = customerName.split(" ")[0];
    const mapUrl = venueName ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName)}` : null;

    return (
        <Html>
            <Head />
            <Preview>{`You're going to ${eventName}. ${ticketCount > 1 ? `Your ${ticketCount} tickets are` : "Your ticket is"} inside.`}</Preview>
            <Tailwind
                config={{
                    theme: {
                        extend: {
                            fontFamily: {
                                sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
                            },
                        },
                    },
                }}
            >
                <Body className="m-0 bg-[#f4f4f4] font-sans text-[#0d0d0d] antialiased">
                    <Container className="mx-auto my-0 max-w-[480px] px-4 py-10">
                        <Section className="mb-8">
                            <Row>
                                <Column className="w-[36px] align-middle">
                                    <Img src={`${SITE_URL}/email/gatepass-mark.png`} width="28" height="28" alt="GatePass" className="block rounded-[7px]" />
                                </Column>
                                <Column className="align-middle">
                                    <Text className="m-0 text-[18px] font-semibold tracking-[-0.03em]">GatePass</Text>
                                </Column>
                            </Row>
                        </Section>

                        <Section className="overflow-hidden rounded-[28px] bg-white">
                            {posterUrl && <Img src={posterUrl} width="480" alt="" className="block w-full" />}

                            <Section className="px-7 pb-2 pt-8">
                                <Text className="m-0 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8a8a8a]">You&apos;re going</Text>
                                <Heading className="m-0 mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.04em]">{eventName}</Heading>
                                <Text className="m-0 mt-3 text-[15px] leading-6 text-[#555]">
                                    Hi {firstName}, {ticketCount > 1 ? `here are your ${ticketCount} tickets` : "here's your ticket"}.{" "}
                                    {physicalCount === 0
                                        ? "Your livestream details are below."
                                        : physicalCount > 1
                                            ? "Show each code at the door, or add them to Apple Wallet."
                                            : "Show the code at the door, or add it to Apple Wallet."}
                                </Text>
                            </Section>

                            <Section className="px-7 pt-4">
                                {eventDate && (
                                    <Row className="border-0 border-b border-solid border-[#eeeeee]">
                                        <Column className="w-[90px] py-3 align-top"><Text className="m-0 text-[13px] text-[#8a8a8a]">When</Text></Column>
                                        <Column className="py-3"><Text className="m-0 text-[14px] font-medium">{eventDate}</Text></Column>
                                    </Row>
                                )}
                                {venueName && (
                                    <Row className="border-0 border-b border-solid border-[#eeeeee]">
                                        <Column className="w-[90px] py-3 align-top"><Text className="m-0 text-[13px] text-[#8a8a8a]">Where</Text></Column>
                                        <Column className="py-3"><Link href={mapUrl!} className="text-[14px] font-medium text-[#0d0d0d] underline">{venueName}</Link></Column>
                                    </Row>
                                )}
                                <Row>
                                    <Column className="w-[90px] py-3 align-top"><Text className="m-0 text-[13px] text-[#8a8a8a]">Tickets</Text></Column>
                                    <Column className="py-3">
                                        <Text className="m-0 text-[14px] font-medium">
                                            {groups.map(g => `${g.tickets.length} × ${g.tierName}`).join(", ")}
                                        </Text>
                                    </Column>
                                </Row>
                            </Section>

                            {groups.map((group, gIndex) => (
                                <Section key={gIndex} className="px-7 pt-6">
                                    <Hr className="m-0 mb-6 border-[#eeeeee]" />
                                    {groups.length > 1 && (
                                        <Text className="m-0 mb-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8a8a8a]">{group.tierName}</Text>
                                    )}

                                    {group.isVirtual ? (
                                        <Section>
                                            {group.virtualLink ? (
                                                <Button href={group.virtualLink} className="block rounded-full bg-[#0d0d0d] py-3.5 text-center text-[14px] font-semibold text-white no-underline">
                                                    Join livestream
                                                </Button>
                                            ) : (
                                                <Text className="m-0 rounded-2xl bg-[#f4f4f4] p-4 text-[14px] leading-6 text-[#555]">
                                                    The livestream link isn&apos;t ready yet. We&apos;ll email and text you as soon as it is.
                                                </Text>
                                            )}
                                            {group.virtualInstructions && (
                                                <Text className="m-0 mt-4 whitespace-pre-wrap text-[13px] leading-5 text-[#555]">{group.virtualInstructions}</Text>
                                            )}
                                        </Section>
                                    ) : showEveryQr ? (
                                        group.tickets.map((ticket, tIndex) => (
                                            <Section key={ticket.id} className={`text-center ${tIndex > 0 ? "mt-8" : ""}`}>
                                                <Img src={ticket.qrCodeUrl} width="180" height="180" alt={`Entry code for ticket ${shortCode(ticket.id)}`} className="mx-auto block" />
                                                <Text className="m-0 mt-3 font-mono text-[12px] tracking-[0.2em] text-[#8a8a8a]">
                                                    {group.tickets.length > 1 ? `${tIndex + 1} of ${group.tickets.length} · ` : ""}{shortCode(ticket.id)}
                                                </Text>
                                                <Link href={`${SITE_URL}/api/wallet/apple?ticketId=${ticket.id}`} className="mt-3 inline-block rounded-full bg-[#0d0d0d] px-4 py-2 text-[12px] font-semibold text-white no-underline">
                                                    Add to Apple Wallet
                                                </Link>
                                            </Section>
                                        ))
                                    ) : (
                                        <Text className="m-0 text-[14px] leading-6 text-[#555]">
                                            {group.tickets.length} tickets: {group.tickets.map(t => shortCode(t.id)).join(", ")}. Open My Tickets to show each code at the door.
                                        </Text>
                                    )}
                                </Section>
                            ))}

                            <Section className="px-7 pb-8 pt-8">
                                <Button href={`${SITE_URL}/my-tickets`} className="block rounded-full bg-[#0d0d0d] py-4 text-center text-[15px] font-semibold text-white no-underline">
                                    View in My Tickets
                                </Button>
                                {ticketCount > 1 && (
                                    <Text className="m-0 mt-4 text-center text-[13px] leading-5 text-[#8a8a8a]">
                                        Going with friends? Send them their tickets from My Tickets.
                                    </Text>
                                )}
                            </Section>
                        </Section>

                        <Section className="px-2 pt-6">
                            {reservationId && (
                                <Link href={`${SITE_URL}/api/reservations/${reservationId}/receipt`} className="text-[13px] text-[#555] underline">
                                    Download receipt
                                </Link>
                            )}
                            <Text className="m-0 mt-4 text-[12px] leading-5 text-[#8a8a8a]">
                                Payment for this order was made to the event organizer. GatePass issued your tickets.
                            </Text>
                            <Text className="m-0 mt-2 text-[12px] text-[#8a8a8a]">© {new Date().getFullYear()} GatePass · Accra, Ghana</Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default TicketEmail;
