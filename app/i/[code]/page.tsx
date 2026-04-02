import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'

// High-speed redirector for shortened instalment links (e.g. gatepass.io/i/ABC123)
// This keeps SMS reminders clean and within the 160-character segment limit

export default async function ShortLinkRedirect({ params }: { params: any }) {
    const { code } = await params
    console.log(`[ShortLink] Resolving code: ${code}`)
    const supabase = await createClient()

    // 1. Resolve short code (can be custom short_code or legacy 8-char UUID prefix)
    // First: Match short_code column
    let { data: instalment, error } = await supabase
        .schema('gatepass')
        .from('instalment_reservations')
        .select('id')
        .ilike('short_code', code)
        .maybeSingle()

    // Second: Try matching ID prefix if no short_code match
    if (!instalment && !error) {
        const { data: prefixMatch, error: prefixError } = await supabase
            .schema('gatepass')
            .from('instalment_reservations')
            .select('id')
            .ilike('id', `${code}%`)
            .maybeSingle()
        
        if (prefixError) {
            console.error('[ShortLink] Prefix Match Error:', prefixError)
        }
        instalment = prefixMatch
    }

    if (error) {
        console.error('[ShortLink] Main DB Error:', error)
    }

    if (!instalment) {
        console.log(`[ShortLink] No match found for: ${code}`)
        // Fallback for direct UUID if someone accidentally pastes it here
        if (code.length === 36) {
            return redirect(`/checkout/instalments/${code}`)
        }
        notFound()
    }

    // 2. Optimized Redirect to the guest checkout portal
    redirect(`/checkout/instalments/${instalment.id}`)
}
