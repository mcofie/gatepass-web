import {
    Body,
    Container,
    Font,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Tailwind,
    Text,
} from '@react-email/components'
import * as React from 'react'

interface VirtualLinkEmailProps {
    eventName?: string
    customerName?: string
    virtualLink?: string
    virtualInstructions?: string | null
    posterUrl?: string | null
}

export const VirtualLinkEmail = ({
    eventName = 'Gatepass Event',
    customerName = 'Attendee',
    virtualLink = 'https://gatepass.so',
    virtualInstructions = '',
    posterUrl
}: VirtualLinkEmailProps) => {
    return (
        <Html>
            <Head>
                <Font
                    fontFamily="Inter"
                    fallbackFontFamily="Helvetica"
                    webFont={{
                        url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2',
                        format: 'woff2',
                    }}
                    fontWeight={400}
                    fontStyle="normal"
                />
            </Head>
            <Preview>Your Livestream details for {eventName} are ready!</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans text-gray-900">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
                        <Section className="mt-[32px]">
                            {/* Logo */}
                            <Img
                                src="https://framerusercontent.com/images/3m5fSGwK99sKzF5E5pjoGDqE.png"
                                width="40"
                                height="40"
                                alt="Gatepass"
                                className="my-0 mx-auto"
                            />
                        </Section>

                        <Section className="text-center mt-[32px] mb-[32px]">
                            {posterUrl && (
                                <Img
                                    src={posterUrl}
                                    width="100%"
                                    className="rounded-xl object-cover mb-6 border border-gray-100"
                                    alt={eventName}
                                />
                            )}
                            <Heading className="text-[24px] font-bold text-center p-0 my-[30px] mx-0 text-black">
                                Livestream Link Published
                            </Heading>
                            <Text className="text-[14px] leading-[24px] text-gray-500">
                                Hello {customerName},
                            </Text>
                            <Text className="text-[14px] leading-[24px] text-black">
                                The livestream access details for <strong>{eventName}</strong> have been updated. You can now join the stream using the link below:
                            </Text>

                            <Section className="mt-8 mb-8">
                                <Link
                                    href={virtualLink}
                                    className="bg-black text-white text-[14px] font-bold no-underline text-center block w-full py-3.5 rounded-xl shadow-lg hover:bg-gray-800 transition-colors"
                                >
                                    Join Livestream
                                </Link>
                            </Section>

                            {virtualInstructions && (
                                <Section className="bg-gray-50 rounded-xl p-5 my-6 text-left border border-gray-100">
                                    <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-wider m-0 mb-2">
                                        Access Instructions
                                    </Text>
                                    <Text className="text-[13px] leading-[20px] m-0 text-gray-800 whitespace-pre-wrap font-medium">
                                        {virtualInstructions}
                                    </Text>
                                </Section>
                            )}
                        </Section>

                        <Text className="text-[#999999] text-[11px] leading-[18px] text-center mt-8">
                            You are receiving this update because you purchased a Virtual / Remote Access pass for this event.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

export default VirtualLinkEmail
