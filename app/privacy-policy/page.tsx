import type { Metadata } from 'next'
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPolicy() {
    return (
        <LegalPageLayout
            activePage="privacy"
            title="Privacy Policy"
            introduction="This policy explains what information GatePass collects, how it’s used, and who it’s shared with, including the organizers of events you attend. Last updated 13 October 2026."
        >
            <LegalSection number="01" title="Who’s responsible">
                <p>GatePass is responsible for your account and for how the platform handles your information. When you buy a ticket, the event’s organizer also receives some of your information, and is responsible for how they use it.</p>
            </LegalSection>

            <LegalSection number="02" title="What we collect">
                <ul>
                    <li><strong>Account details:</strong> your name, email address and, if you add it, your phone number and photo.</li>
                    <li><strong>Orders and tickets:</strong> the events and tickets you buy, amounts, payment status and references, check-ins and transfers.</li>
                    <li><strong>Answers you give:</strong> responses to an organizer’s questions at checkout.</li>
                    <li><strong>Your attendee profile, if you fill it in:</strong> city, country, birthday, a short bio, interests, dietary and accessibility needs, and social handles. All of it is optional.</li>
                    <li><strong>Technical information:</strong> device, browser and usage data that keep the service working and secure.</li>
                    <li><strong>For organizers:</strong> organization details, team members, and the credentials of the payment, SMS and analytics accounts you connect. Credentials are stored encrypted.</li>
                </ul>
            </LegalSection>

            <LegalSection number="03" title="Payments">
                <p>GatePass doesn’t collect or store card, mobile money or bank details. You enter them directly with the organizer’s payment provider (such as Stripe, Paystack, Flutterwave, Hubtel, M-Pesa or Wave). The provider handles them under its own privacy policy. GatePass receives confirmation of the payment: the amount, status, reference and payment method type.</p>
            </LegalSection>

            <LegalSection number="04" title="What organizers see">
                <p>When you get a ticket, the organizer of that event receives your name, email, phone number if you gave one, your tickets, and your answers to their questions. They need this to run the event and contact you about it.</p>
                <p><strong>Your attendee profile is shared only if you choose to.</strong> If you turn on “Share with organizers” in My tickets → Profile, organizers of events you hold tickets for can see it. Turn it off any time and they’ll stop seeing it. Organizers may already have kept copies, which they’re responsible for under data protection law.</p>
                <p>Dietary and accessibility needs can reveal information about your health. They’re optional, and they’re only shared if you turn sharing on.</p>
            </LegalSection>

            <LegalSection number="05" title="How we use your information">
                <ul>
                    <li>to create your account, issue and deliver tickets, and process check-ins and transfers;</li>
                    <li>to send you tickets, receipts, reminders and important updates about events you’re attending;</li>
                    <li>to prevent fraud, secure the service and fix problems;</li>
                    <li>to understand how GatePass is used and improve it.</li>
                </ul>
                <p>We don’t sell your personal information. We send marketing only if you’ve agreed to it, and you can opt out at any time.</p>
            </LegalSection>

            <LegalSection number="06" title="Services we rely on">
                <p>We use trusted providers to run GatePass, including hosting (Netlify), database and sign-in (Supabase) and email delivery (Resend). Organizers may also connect their own payment and SMS providers, and add analytics such as Meta Pixel or Google Analytics to their event pages. Those tools are run by those companies under their own policies.</p>
            </LegalSection>

            <LegalSection number="07" title="How long we keep it">
                <p>We keep account information while your account is open. We keep order and ticket records as long as needed for the event, for accounting, and to meet legal obligations. Then we delete or anonymize them.</p>
            </LegalSection>

            <LegalSection number="08" title="Your choices and rights">
                <p>You can update your profile and sharing settings at any time in My tickets → Profile. You can also ask us to access, correct or delete your information, or object to how we use it, as data protection laws allow, including Ghana’s Data Protection Act, 2012 (Act 843). Email <a href="mailto:support@gatepass.so">support@gatepass.so</a>. For information an organizer holds, you can also contact the organizer directly.</p>
            </LegalSection>

            <LegalSection number="09" title="Security">
                <p>We use industry-standard measures to protect your information, including encryption in transit and for stored provider credentials. No system is perfectly secure. If we learn of a breach that affects you, we’ll tell you as the law requires.</p>
            </LegalSection>

            <LegalSection number="10" title="Contact">
                <p>Questions about this policy or your information? Email <a href="mailto:support@gatepass.so">support@gatepass.so</a>.</p>
            </LegalSection>
        </LegalPageLayout>
    )
}
