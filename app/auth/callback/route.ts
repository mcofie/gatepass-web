import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    // Check for errors returned by Supabase Auth (e.g. link expired, bad request)
    const error = searchParams.get('error')
    const errorCode = searchParams.get('error_code')
    const errorDescription = searchParams.get('error_description')

    if (error) {
        console.error(`[Auth Callback] Error from provider: ${error} - ${errorDescription}`)
        const params = new URLSearchParams({
            error: error,
            error_code: errorCode || '',
            error_description: errorDescription || ''
        })
        return NextResponse.redirect(`${origin}/auth/auth-code-error?${params.toString()}`)
    }

    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/dashboard'

    const supabase = await createClient()

    let session = null
    let user = null

    // 1. Try to exchange code if present
    if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
            console.error('[Auth Callback] Exchange Error:', exchangeError)
            // Don't fail yet, check if we have a session anyway (e.g. pre-fetched)
        }
    }

    // 2. Get the current session (whether just exchanged or existing)
    const { data: sessionData } = await supabase.auth.getSession()
    session = sessionData.session
    user = sessionData.session?.user

    // 3. User is authenticated?
    if (user) {
        console.log(`[Auth Callback] User logged in: ${user.email}`)

        // 1. Check for explicit path first
        const explicitNext = searchParams.get('next') || searchParams.get('redirect')
        if (explicitNext && explicitNext !== '/') {
            console.log(`[Auth Callback] Honoring explicit return path: ${explicitNext}`)
            return NextResponse.redirect(`${origin}${explicitNext}`)
        }

        // 2. Check Super Admin via Database
        const { data: profile } = await supabase
            .schema('gatepass')
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single()

        if (profile?.is_super_admin) {
            console.log('[Auth Callback] Redirecting Super Admin')
            return NextResponse.redirect(`${origin}/dashboard?login=success`)
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
            return NextResponse.redirect(`${origin}/dashboard?login=success`)
        }

        // 3. Check if Staff (Organization Team)
        // We sync their memberships and redirect to dashboard setting if they have any successful link
        const { syncUserTeamMemberships } = await import('@/app/actions/team')
        const syncResult = await syncUserTeamMemberships()

        if (syncResult.success && syncResult.count && syncResult.count > 0) {
            console.log(`[Auth Callback] Synced ${syncResult.count} staff memberships`)
            return NextResponse.redirect(`${origin}/dashboard?login=success`)
        } else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[Auth Callback] Missing SUPABASE_SERVICE_ROLE_KEY')
        }

        // We can just rely on the sync process silently and proceed to regular tickets if none synced,
        // Wait, what if they were already linked and just logging in? We should check if they are in organization_team!
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const { createClient: createAdminClient } = await import('@supabase/supabase-js')
            const adminSupabase = createAdminClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            const { data: existingStaff } = await adminSupabase
                .schema('gatepass')
                .from('organization_team')
                .select('id')
                .eq('user_id', user.id)
                .limit(1)

            if (existingStaff && existingStaff.length > 0) {
                console.log('[Auth Callback] Found Existing Staff Member')
                return NextResponse.redirect(`${origin}/dashboard?login=success`)
            }
        }

        // 4. Default: Regular User -> My Tickets
        console.log('[Auth Callback] Regular User -> My Tickets')
        return NextResponse.redirect(`${origin}/my-tickets`)
    }

    // 4. No Session & No Code -> Error
    if (!code) {
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=no_code&error_description=No+authentication+code+provided`)
    }

    // 5. Code present but exchange failed & no session -> Error
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=exchange_failed&error_description=Authentication+failed+or+link+expired`)
}
