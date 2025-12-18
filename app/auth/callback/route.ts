import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                console.log(`[Auth Callback] User logged in: ${user.email}`)

                // 1. Check Super Admin
                const superAdmins = ['maxcofie@gmail.com', 'samuel@thedsgnjunkies.com']
                if (superAdmins.includes(user.email || '')) {
                    console.log('[Auth Callback] Redirecting Super Admin')
                    return NextResponse.redirect(`${origin}/dashboard`)
                }

                // 2. Check if Owner (Organizer)
                const { data: organizer } = await supabase
                    .schema('gatepass')
                    .from('organizers')
                    .select('id')
                    .eq('user_id', user.id)
                    .single()

                if (organizer) {
                    console.log('[Auth Callback] Redirecting Organizer Owner')
                    return NextResponse.redirect(`${origin}/dashboard`)
                }

                // 3. Check if Staff (Organization Team) - USE ADMIN CLIENT TO BYPASS RLS
                // We need admin rights to search by email if the user_id isn't linked yet
                if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
                    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
                    const adminSupabase = createAdminClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.SUPABASE_SERVICE_ROLE_KEY!
                    )

                    const { data: staffMember } = await adminSupabase
                        .schema('gatepass')
                        .from('organization_team')
                        .select('id, organization_id, user_id')
                        .eq('email', user.email)
                        .single()

                    if (staffMember) {
                        console.log('[Auth Callback] Found Staff Member', staffMember.id)

                        // Link user_id if not set
                        if (!staffMember.user_id) {
                            await adminSupabase
                                .schema('gatepass')
                                .from('organization_team')
                                .update({ user_id: user.id })
                                .eq('id', staffMember.id)
                            console.log('[Auth Callback] Linked Staff User ID')
                        }

                        return NextResponse.redirect(`${origin}/dashboard`)
                    }
                } else {
                    console.error('[Auth Callback] Missing SUPABASE_SERVICE_ROLE_KEY')
                }

                // 4. New User -> Onboarding
                console.log('[Auth Callback] New User -> Onboarding')
                return NextResponse.redirect(`${origin}/onboarding`)
            }

            // Fallback
            return NextResponse.redirect(`${origin}${next}`)
        } else {
            console.error('[Auth Callback] Exchange Error:', error)
            return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
