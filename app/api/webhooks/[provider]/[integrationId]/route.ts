import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { resolve, type IntegrationRow } from '@/lib/integrations/store'
import { confirmPayment, findSessionByProviderReference, getAdapter, getSession } from '@/lib/payments'
import { processSuccessfulPayment } from '@/utils/actions/payment'
import { notifyDiscord } from '@/utils/discord'

/**
 * Inbound payment webhooks for one organizer integration:
 *   /api/webhooks/<provider>/<integrationId>?token=<webhook_token>
 * The token proves the caller knows the organizer's private URL, the provider signature is checked
 * where the provider signs, and the payment itself is always re-fetched from the provider's API.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string; integrationId: string }> }) {
    const { provider, integrationId } = await params
    const token = req.nextUrl.searchParams.get('token') ?? ''

    const { data } = await createAdminClient()
        .schema('gatepass')
        .from('organizer_integrations')
        .select('*')
        .eq('id', integrationId)
        .eq('category', 'payments')
        .maybeSingle()
    const row = data as IntegrationRow | null
    if (!row || row.provider !== provider || token.length !== row.webhook_token.length
        || !timingSafeEqual(Buffer.from(token), Buffer.from(row.webhook_token))) {
        return NextResponse.json({ ok: false }, { status: 401 })
    }

    const integration = resolve(row)
    const rawBody = await req.text()

    try {
        const hint = await getAdapter(provider).parseWebhook(integration, { headers: req.headers, rawBody })
        if (!hint) return NextResponse.json({ ok: true, ignored: true })

        const session = hint.reference
            ? await getSession(hint.reference)
            : hint.providerReference ? await findSessionByProviderReference(provider, hint.providerReference) : null
        // Not ours (e.g. a payment made outside GatePass on the same account)
        if (!session || session.integration_id !== integration.id) return NextResponse.json({ ok: true, ignored: true })

        const confirmation = await confirmPayment(session.reference, integration)
        if (confirmation.status !== 'success') return NextResponse.json({ ok: true, status: confirmation.status })

        const { transaction } = confirmation
        const metadata = confirmation.session.metadata as {
            payment_type?: string
            is_full_payment?: boolean
            instalment_payment_id?: string
            instalment_reservation_id?: string
        }
        const amount = `${transaction.currency} ${(transaction.amount / 100).toLocaleString()}`

        if (metadata.payment_type === 'instalment') {
            const instalments = await import('@/utils/actions/instalment')
            if (metadata.is_full_payment && metadata.instalment_reservation_id) {
                const result = await instalments.processFullInstalmentPayment(session.reference, metadata.instalment_reservation_id, transaction)
                if (!result.success) throw new Error(result.error)
                await notifyDiscord(`💰 **Full Instalment Settled**\n**Amount:** ${amount}\n**Res ID:** ${metadata.instalment_reservation_id}`, 'success')
            } else if (metadata.instalment_payment_id) {
                const result = await instalments.processInstalmentPayment(session.reference, metadata.instalment_payment_id, transaction)
                if (!result.success) throw new Error(result.error)
                await notifyDiscord(`💳 **Instalment Payment Received**\n**Amount:** ${amount}\n**Payment ID:** ${metadata.instalment_payment_id}`, 'success')
            }
        } else if (metadata.payment_type === 'instalment_first') {
            // The deposit is activated by the buyer's return page, which creates the plan's schedule
            await notifyDiscord(`✨ **First Instalment Deposit**\n**Amount:** ${amount}\n**Ref:** ${session.reference}`, 'success')
        } else {
            const result = await processSuccessfulPayment(session.reference, confirmation.session.reservation_ids, transaction)
            if (!result.success) throw new Error(result.error)
            await notifyDiscord(`🎉 **Ticket Purchase**\n**Provider:** ${provider}\n**Amount:** ${amount}\n**Ref:** ${session.reference}`, 'success')
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[webhooks/${provider}]`, error)
        await notifyDiscord(`❌ **Payment webhook failed** (${provider})\nIntegration: ${integrationId}\nError: ${message}`, 'warning')
        // Non-2xx so the provider retries
        return NextResponse.json({ ok: false }, { status: 500 })
    }
}
