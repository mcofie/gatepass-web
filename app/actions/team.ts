'use server'

import { createClient } from '@/utils/supabase/server'
import { Resend } from 'resend'
import { logActivity } from '@/app/actions/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function inviteTeamMember(organizationId: string, email: string, role: 'admin' | 'staff', organizationName: string) {
    const supabase = await createClient()

    // 1. Verify Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Check if user already exists to pre-link
    let targetUserId = null
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: profile } = await adminSupabase
            .schema('gatepass')
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .maybeSingle()
        if (profile) targetUserId = profile.id
    }

    // 2. Insert into Database (RLS will verify permission)
    const { error: dbError } = await supabase
        .schema('gatepass')
        .from('organization_team')
        .insert({
            organization_id: organizationId,
            email: email,
            role: role,
            user_id: targetUserId,
        })

    if (dbError) {
        // Handle unique constraint manually for cleaner error
        if (dbError.code === '23505') {
            return { error: 'This user has already been invited.' }
        }
        return { error: dbError.message }
    }

    // Log Activity
    await logActivity(organizationId, 'invite_staff', 'staff', undefined, { email, role })

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

    } catch (e) {
        console.error('Email sending failed:', e)
        // We generally don't want to fail the whole action if only email fails, but for this use-case, notifying user is good.
    }

    return { success: true }
}

export async function updateTeamMemberRole(teamMemberId: string, newRole: 'admin' | 'staff', organizationId: string) {
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
        .update({ role: newRole })
        .eq('id', teamMemberId)
        .eq('organization_id', organizationId) // Extra safety

    if (dbError) {
        return { error: dbError.message }
    }

    // Log Activity
    await logActivity(organizationId, 'update_role', 'staff', undefined, { teamMemberId, newRole })

    return { success: true }
}

export async function syncUserTeamMemberships() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) return { success: false, reason: 'unauthenticated' }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { success: false, reason: 'missing_keys' }

    try {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const normalizedEmail = user.email.toLowerCase().trim()
        console.log(`[Sync Team] Executing sync for logged in user:`, {
            id: user.id,
            email: normalizedEmail,
        })

        // 0. Ensure Profile Exists (Avoid Foreign Key Violation)
        const { data: profile } = await adminSupabase
            .schema('gatepass')
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle()

        if (!profile) {
            console.log(`[Sync Team] Profile missing for ${user.id}, creating one...`)
            const { error: pError } = await adminSupabase
                .schema('gatepass')
                .from('profiles')
                .insert({
                    id: user.id,
                    email: normalizedEmail,
                    full_name: user.user_metadata?.full_name || 'Staff Member'
                })

            if (pError) {
                console.error('[Sync Team] Failed to auto-create profile:', pError.message)
            } else {
                console.log(`[Sync Team] Successfully created profile for ${user.id}`)
            }
        }

        // 1. Search for pending records by email
        // We MUST use ilike and admin client since RLS prevents users from seeing records where user_id is NULL
        const { data: pendingMembers, error: fetchError } = await adminSupabase
            .schema('gatepass')
            .from('organization_team')
            .select('id, organization_id, email')
            .ilike('email', normalizedEmail)
            .is('user_id', null)

        if (fetchError) {
            console.error('[Sync Team] Fetch pending invites error:', fetchError.message || fetchError)
            throw fetchError
        }

        if (pendingMembers && pendingMembers.length > 0) {
            console.log(`[Sync Team] Found ${pendingMembers.length} pending invites for ${normalizedEmail}`)
            for (const member of pendingMembers) {
                // Defensive check: is there already a linked account for this user+org?
                const { data: alreadyLinked } = await adminSupabase
                    .schema('gatepass')
                    .from('organization_team')
                    .select('id')
                    .eq('organization_id', member.organization_id)
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (alreadyLinked) {
                    console.log(`[Sync Team] User ${user.id} already linked to org ${member.organization_id}, removing redundant pending record ${member.id}`)
                    await adminSupabase
                        .schema('gatepass')
                        .from('organization_team')
                        .delete()
                        .eq('id', member.id)
                    continue
                }

                // Link the user account!
                const { error: updateError } = await adminSupabase
                    .schema('gatepass')
                    .from('organization_team')
                    .update({
                        user_id: user.id,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', member.id)

                if (updateError) {
                    console.error(`[Sync Team] Failed to link member ${member.id}:`, updateError.message || JSON.stringify(updateError))
                } else {
                    console.log(`[Sync Team] Successfully linked member record ${member.id} to user ${user.id}`)
                }
            }
            return { success: true, count: pendingMembers.length }
        }

        console.log(`[Sync Team] No pending invites found for ${normalizedEmail}`)
        return { success: true, count: 0 }
    } catch (e: unknown) {
        const error = e as Error
        console.error('Failed to sync user team memberships:', error.message || error)
        return { success: false, error: error.message || error }
    }
}

export async function resendTeamInvite(organizationId: string, email: string, role: 'admin' | 'staff', organizationName: string) {
    const supabase = await createClient()

    // 1. Verify Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Not authenticated' }
    }

    // 2. Verify they are actually in the team pending
    const { data: member } = await supabase
        .schema('gatepass')
        .from('organization_team')
        .select('id, user_id')
        .eq('organization_id', organizationId)
        .eq('email', email)
        .single()

    if (!member) return { error: 'Staff member not found.' }
    if (member.user_id) return { error: 'Staff member is already active.' }

    // Log Activity
    await logActivity(organizationId, 'resend_invite', 'staff', undefined, { email, role })

    // 3. Send Email
    try {
        const { error: emailError } = await resend.emails.send({
            from: 'GatePass Team <team@updates.gatepass.so>',
            to: [email],
            subject: `Reminder: Join ${organizationName} on GatePass`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1>You've been invited!</h1>
                    <p>This is a reminder that you have been invited to join <strong>${organizationName}</strong> as a ${role}.</p>
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

    } catch (e) {
        console.error('Email sending failed:', e)
        return { error: 'Failed to send email' }
    }

    return { success: true }
}
