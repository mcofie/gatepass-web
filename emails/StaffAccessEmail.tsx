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

interface StaffAccessEmailProps {
    eventName?: string
    staffName?: string
    accessCode?: string
    posterUrl?: string
}

const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

export const StaffAccessEmail = ({
    eventName = 'Gatepass Event',
    staffName = 'Gatepass Staff',
    accessCode = 'ABC12',
    posterUrl
}: StaffAccessEmailProps) => {
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
            <Preview>Your Gatepass Access Code for {eventName}</Preview>
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
                            <Heading className="text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                                <strong>Staff Access</strong>
                            </Heading>
                            <Text className="text-[14px] leading-[24px] text-gray-500">
                                Hello {staffName},
                            </Text>
                            <Text className="text-[14px] leading-[24px] text-black">
                                You have been invited to perform check-ins for <strong>{eventName}</strong>. Use the code below to log in to the Gatepass Check-in App.
                            </Text>

                            <Section className="bg-gray-100 rounded-lg p-6 my-6 mx-auto w-full max-w-[300px] border border-gray-200 border-dashed text-center">
                                <Text className="font-mono text-4xl font-bold tracking-[0.2em] m-0 text-black mb-4">
                                    {accessCode}
                                </Text>
                                <Img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${accessCode}`}
                                    width="150"
                                    height="150"
                                    alt="Access QR Code"
                                    className="mx-auto rounded-lg border border-gray-200"
                                />
                                <Text className="text-[10px] text-gray-400 mt-2 uppercase tracking-wide font-bold">
                                    Scan to Login
                                </Text>
                            </Section>

                            <Text className="text-[14px] leading-[24px] text-gray-500">
                                You can also click the button below to log in automatically on your device.
                            </Text>

                            <Section className="mt-4 mb-4">
                                <Link
                                    href={`https://gatepass.xyz/staff-login?code=${accessCode}`}
                                    className="bg-black text-white text-[14px] font-bold no-underline text-center block w-full py-3 rounded-lg shadow-lg"
                                >
                                    Log in automatically
                                </Link>
                            </Section>
                        </Section>

                        <Section>
                            <Link
                                href="https://gatepass.so/staff" // Placeholder link or app store link
                                className="bg-black text-white text-[14px] font-bold no-underline text-center block w-full py-3 rounded-lg"
                            >
                                Download Check-in App
                            </Link>
                        </Section>

                        <Text className="text-[#666666] text-[12px] leading-[24px] text-center mt-8">
                            This invitation was sent by the event organizer via Gatepass.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

export default StaffAccessEmail
