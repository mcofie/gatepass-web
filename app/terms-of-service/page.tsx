import type { Metadata } from 'next'
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsOfService() {
    return (
        <LegalPageLayout
            activePage="terms"
            title="Terms of Service"
            introduction="These terms cover your use of GatePass, whether you organize events or buy tickets. By creating an account, publishing an event or buying a ticket, you agree to them. Last updated 13 October 2026."
        >
            <LegalSection number="01" title="What GatePass is">
                <p>GatePass is a platform that lets organizers create event pages, sell tickets and manage guests. Organizers run their events and sell tickets to buyers. GatePass provides the software that connects them.</p>
                <p>When you buy a ticket, your agreement for that event is with its organizer. The organizer is responsible for the event itself: what it includes, when and where it happens, who gets in, and any changes or cancellations.</p>
            </LegalSection>

            <LegalSection number="02" title="Accounts">
                <p>You need an account to organize events and to hold tickets. Keep your sign-in details secure and tell us at <a href="mailto:support@gatepass.so">support@gatepass.so</a> if you think someone else has used your account. You’re responsible for activity on your account, and for anyone you add to your organization’s team.</p>
            </LegalSection>

            <LegalSection number="03" title="Payments go straight to organizers">
                <p>Organizers connect their own payment account, such as Stripe, Paystack, Flutterwave, Hubtel, M-Pesa or Wave. When you buy a ticket, you pay the organizer through that provider.</p>
                <ul>
                    <li><strong>GatePass does not receive, hold or pay out ticket money.</strong> Funds settle in the organizer’s provider account under that provider’s terms and timelines.</li>
                    <li>Card, mobile money and bank details are entered with the payment provider, not with GatePass.</li>
                    <li>Payment providers charge their own processing fees under their own terms. GatePass does not charge a fee per ticket.</li>
                </ul>
            </LegalSection>

            <LegalSection number="04" title="Refunds, cancellations and chargebacks">
                <p>Because payments go to the organizer, <strong>organizers are responsible for refunds, cancellations and chargebacks</strong>.</p>
                <ul>
                    <li>Whether a ticket can be refunded is set by the organizer’s refund policy. If the event page doesn’t state one, contact the organizer.</li>
                    <li>Refunds are issued by the organizer through their payment provider. GatePass can’t issue a refund or move money on anyone’s behalf.</li>
                    <li>Payment disputes and chargebacks are handled between the buyer, the organizer and the payment provider. Organizers are responsible for any amounts, fees or penalties that result.</li>
                    <li>If an event is cancelled, the organizer is expected to tell ticket holders and refund them as their policy and the law require.</li>
                </ul>
                <p>If you can’t reach an organizer, write to <a href="mailto:support@gatepass.so">support@gatepass.so</a> and we’ll try to put you in touch.</p>
            </LegalSection>

            <LegalSection number="05" title="Organizer responsibilities">
                <p>If you organize events on GatePass, you agree to:</p>
                <ul>
                    <li>describe your event accurately, honour the tickets you sell, and follow the laws that apply to your event and your sales;</li>
                    <li>publish a clear refund policy and handle refunds, cancellations and disputes promptly;</li>
                    <li>keep the payment, SMS and analytics accounts you connect in good standing, and keep their credentials secure;</li>
                    <li>use attendee information, including any profile details an attendee chooses to share with you, only to run and improve your events, as data protection law allows, and only send marketing to people who have agreed to receive it.</li>
                </ul>
            </LegalSection>

            <LegalSection number="06" title="Platform fees">
                <p>GatePass charges organizers a one-time fee per event, based on the number of tickets on sale. The amount is shown before you pay and must be paid before the event is published. Free plans, where offered, are shown the same way.</p>
                <p>Platform fees aren’t tied to ticket sales and aren’t refunded if an event sells fewer tickets than expected or is cancelled, unless we agree otherwise in writing or the law requires it.</p>
            </LegalSection>

            <LegalSection number="07" title="Tickets and transfers">
                <ul>
                    <li>Each ticket has a QR code for entry. Keep it private: anyone holding the code may be able to use it.</li>
                    <li>You can transfer a ticket to someone else through GatePass. When they claim it, they get a new code and yours stops working. Organizers may limit transfers or resale for their events.</li>
                    <li>We or the organizer may cancel tickets bought fraudulently or in breach of these terms.</li>
                </ul>
            </LegalSection>

            <LegalSection number="08" title="Acceptable use">
                <p>Don’t use GatePass to sell tickets to events that don’t exist, to mislead buyers, to infringe others’ rights, to send spam, or to interfere with the service. We may remove events and suspend accounts that break these rules.</p>
            </LegalSection>

            <LegalSection number="09" title="Third-party services">
                <p>Payment providers, SMS providers, analytics tools and other services that organizers connect are run by those companies under their own terms and privacy policies. GatePass isn’t responsible for them.</p>
            </LegalSection>

            <LegalSection number="10" title="Liability">
                <p>GatePass is provided “as is”. To the extent the law allows, we aren’t liable for the events organizers run, for payments handled by payment providers, or for indirect losses, lost profits or service interruptions. Nothing in these terms limits liability that can’t be limited by law.</p>
            </LegalSection>

            <LegalSection number="11" title="Changes and contact">
                <p>We may update these terms as GatePass changes. We’ll post the new version here and, for significant changes, let account holders know. Questions? Write to <a href="mailto:support@gatepass.so">support@gatepass.so</a>.</p>
            </LegalSection>
        </LegalPageLayout>
    )
}
