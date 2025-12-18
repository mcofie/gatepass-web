'use server'

import { createClient } from '@/utils/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function inviteTeamMember(organizationId: string, email: string, role: 'admin' | 'staff', organizationName: string) {
    const supabase = await createClient()

    // 1. Verify Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Not authenticated' }
    }

    // 2. Insert into Database (RLS will verify permission)
    const { error: dbError } = await supabase
        .schema('gatepass')
        .from('organization_team')
        .insert({
            organization_id: organizationId,
            email: email,
            role: role
        })

    if (dbError) {
        // Handle unique constraint manually for cleaner error
        if (dbError.code === '23505') {
            return { error: 'This user has already been invited.' }
        }
        return { error: dbError.message }
    }

    // 3. Send Email
    try {
        const { error: emailError } = await resend.emails.send({
            from: 'GatePass Team <team@updates.gatepass.so>',
            to: [email],
            subject: `Join ${organizationName} on GatePass`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1>You've been invited!</h1>
                    <p>You have been invited to join <strong>${organizationName}</strong> as a ${role}.</p>
                    <p>Click the link below to accept the invitation and log in:</p>
                    <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Accept Invitation
                    </a>
                    <p style="margin-top: 24px; color: #666; font-size: 14px;">
                        If you didn't expect this invitation, you can ignore this email.
                    </p>
                </div>
            `
        })

        if (emailError) {
            console.error('Resend Error:', emailError)
            return { error: `Email Error: ${emailError.message} (${emailError.name})` }
        }

    } catch (e: any) {
        console.error('Email sending failed:', e)
        // We generally don't want to fail the whole action if only email fails, but for this use-case, notifying user is good.
    }

    return { success: true }
}
