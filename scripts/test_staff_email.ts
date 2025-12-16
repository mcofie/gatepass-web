import { sendStaffAccessEmail } from '@/utils/email'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
    console.log('Testing Staff Access Email...')
    if (!process.env.RESEND_API_KEY) {
        console.error('ERROR: RESEND_API_KEY is missing in env')
        return
    }

    try {
        const result = await sendStaffAccessEmail({
            to: 'maxcofie@gmail.com', // Using user's likely email or a safe test one. Let's use the one found in middleware/constants typically, or just asking user. I'll use a placeholder or safe one.
            // Actually, I should use a hardcoded one for the test, or 'onboarding@resend.dev' if they are in sandbox.
            // Let's try sending to maxcofie@gmail.com as seen in other files.
            eventName: 'Test Event',
            staffName: 'Test Staff',
            accessCode: 'TEST1'
        })
        console.log('Email sent successfully:', result)
    } catch (e) {
        console.error('Failed to send email:', e)
    }
}

main()
