import type { Metadata } from 'next'
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPolicy() {
    return (
        <LegalPageLayout
            activePage="privacy"
            title="Privacy Policy"
            introduction="At GatePass, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information when you use our video-first ticketing platform."
        >
            <LegalSection number="01" title="Information We Collect">
                We collect information you provide directly to us, such as when you create an account, purchase tickets, or contact customer support. This may include your name, email address, payment information, and device data.
            </LegalSection>
            <LegalSection number="02" title="How We Use Your Information">
                We use your information to provide/improve our services, process transactions, send you event updates, and personalize your experience. We do not sell your personal data to third parties.
            </LegalSection>
            <LegalSection number="03" title="Data Security">
                We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure.
            </LegalSection>
            <LegalSection number="04" title="Contact Us">
                If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@gatepass.so" className="font-medium text-black underline underline-offset-4 hover:decoration-2 dark:text-white">support@gatepass.so</a>.
            </LegalSection>
        </LegalPageLayout>
    )
}
