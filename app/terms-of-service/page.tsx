import type { Metadata } from 'next'
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsOfService() {
    return (
        <LegalPageLayout
            activePage="terms"
            title="Terms of Service"
            introduction="Welcome to GatePass. By accessing or using our platform, you agree to be bound by these Terms of Service."
        >
            <LegalSection number="01" title="Acceptance of Terms">
                By creating an account or purchasing a ticket, you agree to these legal terms. If you do not agree, strictly do not use our services.
            </LegalSection>
            <LegalSection number="02" title="User Conduct">
                You agree not to misuse the platform, infringe on intellectual property, or engage in fraudulent activities. We reserve the right to suspend accounts violating these rules.
            </LegalSection>
            <LegalSection number="03" title="Ticket Purchases & Refunds">
                All ticket sales are final unless otherwise stated by the event organizer. GatePass is a platform and is not responsible for event cancellations, though we will assist in refund processing where applicable.
            </LegalSection>
            <LegalSection number="04" title="Limitation of Liability">
                GatePass is provided &quot;as is&quot;. We are not liable for indirect damages, data loss, or service interruptions.
            </LegalSection>
        </LegalPageLayout>
    )
}
