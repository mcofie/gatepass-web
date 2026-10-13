'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { encryptCredentials, decryptCredentials, hintFor } from '@/lib/integrations/crypto'
import { getProvider, providerSupportsCurrency, type IntegrationCategory } from '@/lib/integrations/providers'
import { resolve, type IntegrationRow } from '@/lib/integrations/store'
import { verifyIntegration } from '@/lib/integrations/verify'
import { sendSms } from '@/lib/integrations/sms'
import { webhookUrlFor } from '@/lib/integrations/webhook-url'

export type IntegrationSummary = {
    id: string
    category: IntegrationCategory
    provider: string
    mode: 'test' | 'live'
    publicConfig: Record<string, string>
    credentialHints: Record<string, string>
    status: IntegrationRow['status']
    statusMessage: string | null
    lastVerifiedAt: string | null
    isDefault: boolean
    webhookUrl: string
}

/** Only the organizer's owner and team admins may manage integrations. */
async function assertCanManage(organizerId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const admin = createAdminClient()
    const { data: org } = await admin.schema('gatepass').from('organizers').select('user_id').eq('id', organizerId).single()
    if (!org) throw new Error('Organization not found')
    if (org.user_id === user.id) return user

    const { data: member } = await admin
        .schema('gatepass')
        .from('organization_team')
        .select('role')
        .eq('organization_id', organizerId)
        .eq('user_id', user.id)
        .maybeSingle()
    if (member?.role === 'admin') return user

    throw new Error('Only owners and admins can manage integrations')
}

function summarize(row: IntegrationRow): IntegrationSummary {
    return {
        id: row.id,
        category: row.category,
        provider: row.provider,
        mode: row.mode,
        publicConfig: row.public_config,
        credentialHints: row.credential_hints,
        status: row.status,
        statusMessage: row.status_message,
        lastVerifiedAt: row.last_verified_at,
        isDefault: row.is_default,
        webhookUrl: webhookUrlFor(row.provider, row.id, row.webhook_token),
    }
}

export async function listIntegrations(organizerId: string): Promise<IntegrationSummary[]> {
    await assertCanManage(organizerId)
    const { data, error } = await createAdminClient()
        .schema('gatepass')
        .from('organizer_integrations')
        .select('*')
        .eq('organizer_id', organizerId)
        .order('created_at')
    if (error) throw new Error(error.message)
    return (data as IntegrationRow[]).map(summarize)
}

/**
 * Create or update an integration. Secret fields left blank on update keep their stored value,
 * so the UI never needs to send existing secrets back.
 */
export async function saveIntegration(input: {
    organizerId: string
    category: IntegrationCategory
    provider: string
    mode: 'test' | 'live'
    values: Record<string, string>
}): Promise<IntegrationSummary> {
    const user = await assertCanManage(input.organizerId)
    const definition = getProvider(input.category, input.provider)
    if (!definition) throw new Error('Unknown provider')
    if (input.mode === 'test' && !definition.supportsTestMode) throw new Error(`${definition.name} does not support test mode`)

    const admin = createAdminClient()
    const { data: existing } = await admin
        .schema('gatepass')
        .from('organizer_integrations')
        .select('*')
        .eq('organizer_id', input.organizerId)
        .eq('category', input.category)
        .eq('provider', input.provider)
        .maybeSingle()
    const current = existing as IntegrationRow | null
    const currentSecrets = current?.encrypted_credentials ? decryptCredentials(current.encrypted_credentials) : {}

    const publicConfig: Record<string, string> = {}
    const secrets: Record<string, string> = {}
    const hints: Record<string, string> = {}

    for (const field of definition.fields) {
        const value = (input.values[field.key] ?? '').trim()
        if (field.secret) {
            const resolved = value || currentSecrets[field.key] || ''
            if (resolved) {
                secrets[field.key] = resolved
                hints[field.key] = hintFor(resolved)
            }
            if (field.required && !resolved) throw new Error(`${field.label} is required`)
        } else {
            if (value) publicConfig[field.key] = value
            if (field.required && !value) throw new Error(`${field.label} is required`)
        }
    }

    // The first integration in a category becomes the default automatically
    let isDefault = current?.is_default ?? false
    if (!current) {
        const { count } = await admin
            .schema('gatepass')
            .from('organizer_integrations')
            .select('id', { count: 'exact', head: true })
            .eq('organizer_id', input.organizerId)
            .eq('category', input.category)
        isDefault = (count ?? 0) === 0
    }

    const { data, error } = await admin
        .schema('gatepass')
        .from('organizer_integrations')
        .upsert({
            ...(current ? { id: current.id } : {}),
            organizer_id: input.organizerId,
            category: input.category,
            provider: input.provider,
            mode: input.mode,
            public_config: publicConfig,
            encrypted_credentials: Object.keys(secrets).length ? encryptCredentials(secrets) : null,
            credential_hints: hints,
            // Credentials changed, so they must be verified again
            status: 'unverified',
            status_message: null,
            last_verified_at: null,
            is_default: isDefault,
            created_by: current ? undefined : user.id,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'organizer_id,category,provider' })
        .select('*')
        .single()
    if (error) throw new Error(error.message)

    const verified = await runVerification(data as IntegrationRow)
    revalidatePath('/dashboard/settings')
    if (input.category === 'marketing') revalidateTag('marketing-ids', 'max')
    return summarize(verified)
}

async function runVerification(row: IntegrationRow): Promise<IntegrationRow> {
    const result = await verifyIntegration(resolve(row))
    const { data, error } = await createAdminClient()
        .schema('gatepass')
        .from('organizer_integrations')
        .update({
            status: result.ok ? 'connected' : 'error',
            status_message: result.message,
            last_verified_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .select('*')
        .single()
    if (error) throw new Error(error.message)
    return data as IntegrationRow
}

async function getOwnedRow(organizerId: string, integrationId: string): Promise<IntegrationRow> {
    const { data } = await createAdminClient()
        .schema('gatepass')
        .from('organizer_integrations')
        .select('*')
        .eq('id', integrationId)
        .eq('organizer_id', organizerId)
        .single()
    if (!data) throw new Error('Integration not found')
    return data as IntegrationRow
}

export async function testIntegration(organizerId: string, integrationId: string): Promise<IntegrationSummary> {
    await assertCanManage(organizerId)
    const verified = await runVerification(await getOwnedRow(organizerId, integrationId))
    revalidatePath('/dashboard/settings')
    return summarize(verified)
}

export async function sendTestSms(organizerId: string, integrationId: string, to: string): Promise<{ success: boolean; error?: string }> {
    await assertCanManage(organizerId)
    const row = await getOwnedRow(organizerId, integrationId)
    if (row.category !== 'sms') throw new Error('Not an SMS integration')
    const result = await sendSms(resolve(row), to, 'GatePass: your SMS provider is connected.')

    // A delivered test message is the only verification Hubtel and Zend SMS support
    await createAdminClient()
        .schema('gatepass')
        .from('organizer_integrations')
        .update({
            status: result.success ? 'connected' : 'error',
            status_message: result.success ? `Test message sent to ${to}.` : (result.error ?? 'Test message failed.'),
            last_verified_at: new Date().toISOString(),
        })
        .eq('id', integrationId)
    revalidatePath('/dashboard/settings')
    return result
}

export async function setDefaultIntegration(organizerId: string, integrationId: string) {
    await assertCanManage(organizerId)
    const admin = createAdminClient()
    const { data: target } = await admin
        .schema('gatepass')
        .from('organizer_integrations')
        .select('category')
        .eq('id', integrationId)
        .eq('organizer_id', organizerId)
        .single()
    if (!target) throw new Error('Integration not found')

    // Clear first so the partial unique index is never violated
    await admin
        .schema('gatepass')
        .from('organizer_integrations')
        .update({ is_default: false })
        .eq('organizer_id', organizerId)
        .eq('category', target.category)
    const { error } = await admin
        .schema('gatepass')
        .from('organizer_integrations')
        .update({ is_default: true })
        .eq('id', integrationId)
    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings')
}

export async function deleteIntegration(organizerId: string, integrationId: string) {
    await assertCanManage(organizerId)
    const admin = createAdminClient()
    const { data: removed, error } = await admin
        .schema('gatepass')
        .from('organizer_integrations')
        .delete()
        .eq('id', integrationId)
        .eq('organizer_id', organizerId)
        .select('category, is_default')
        .single()
    if (error) throw new Error(error.message)

    // Promote the oldest remaining integration in the category to default
    if (removed?.is_default) {
        const { data: next } = await admin
            .schema('gatepass')
            .from('organizer_integrations')
            .select('id')
            .eq('organizer_id', organizerId)
            .eq('category', removed.category)
            .order('created_at')
            .limit(1)
            .maybeSingle()
        if (next) await admin.schema('gatepass').from('organizer_integrations').update({ is_default: true }).eq('id', next.id)
    }

    revalidatePath('/dashboard/settings')
}

/** Per-event payment provider override. Pass null to fall back to the organization's default. */
export async function setEventPaymentIntegration(eventId: string, integrationId: string | null) {
    const admin = createAdminClient()
    const { data: event } = await admin.schema('gatepass').from('events').select('organization_id').eq('id', eventId).single()
    if (!event?.organization_id) throw new Error('Event not found')
    await assertCanManage(event.organization_id)

    let provider: string | null = null
    if (integrationId) {
        const { data: integration } = await admin
            .schema('gatepass')
            .from('organizer_integrations')
            .select('provider')
            .eq('id', integrationId)
            .eq('organizer_id', event.organization_id)
            .eq('category', 'payments')
            .single()
        if (!integration) throw new Error('Payment provider not found')
        provider = integration.provider
    }

    const { error } = await admin
        .schema('gatepass')
        .from('events')
        .update({
            payment_integration_id: integrationId,
            // Kept in step for anything still reading the legacy column
            ...(provider ? { payment_gateway: provider } : {}),
        })
        .eq('id', eventId)
    if (error) throw new Error(error.message)

    revalidatePath(`/dashboard/events/${eventId}`)
}

/** Sets an event's currency and moves all its ticket types to it. Must be one the event's provider supports. */
export async function setEventCurrency(eventId: string, currency: string) {
    const admin = createAdminClient()
    const code = currency.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(code)) throw new Error('Choose a currency')

    const { data: event } = await admin.schema('gatepass').from('events').select('organization_id, payment_integration_id').eq('id', eventId).single()
    if (!event?.organization_id) throw new Error('Event not found')
    await assertCanManage(event.organization_id)

    // The provider this event will charge through: its override, else the organization default
    let query = admin.schema('gatepass').from('organizer_integrations').select('provider').eq('organizer_id', event.organization_id).eq('category', 'payments')
    query = event.payment_integration_id ? query.eq('id', event.payment_integration_id) : query.eq('is_default', true)
    const { data: integration } = await query.maybeSingle()
    if (integration && !providerSupportsCurrency(integration.provider, code)) {
        throw new Error(`${getProvider('payments', integration.provider)?.name ?? 'Your payment provider'} can't charge in ${code}`)
    }

    const [eventUpdate, tiersUpdate] = await Promise.all([
        admin.schema('gatepass').from('events').update({ currency: code }).eq('id', eventId),
        admin.schema('gatepass').from('ticket_tiers').update({ currency: code }).eq('event_id', eventId),
    ])
    if (eventUpdate.error) throw new Error(eventUpdate.error.message)
    if (tiersUpdate.error) throw new Error(tiersUpdate.error.message)
    revalidatePath(`/dashboard/events/${eventId}`)
    revalidateTag('public-events', 'max')
}

/** The workspace's default payment provider (id only), for currency choices when creating an event. */
export async function getDefaultPaymentProvider(organizerId: string): Promise<string | null> {
    await assertCanManage(organizerId)
    const { data } = await createAdminClient()
        .schema('gatepass')
        .from('organizer_integrations')
        .select('provider')
        .eq('organizer_id', organizerId)
        .eq('category', 'payments')
        .eq('is_default', true)
        .maybeSingle()
    return data?.provider ?? null
}
