import { createAdminClient } from '@/utils/supabase/admin'
import { decryptCredentials } from './crypto'
import type { IntegrationCategory } from './providers'

// Server-only access to organizer integrations. Every read goes through the service role,
// so callers are responsible for authorising the organizer first.

export type IntegrationRow = {
    id: string
    organizer_id: string
    category: IntegrationCategory
    provider: string
    mode: 'test' | 'live'
    public_config: Record<string, string>
    encrypted_credentials: string | null
    credential_hints: Record<string, string>
    webhook_token: string
    status: 'unverified' | 'connected' | 'error'
    status_message: string | null
    last_verified_at: string | null
    is_default: boolean
    created_at: string
    updated_at: string
}

export type ResolvedIntegration = {
    id: string
    organizerId: string
    category: IntegrationCategory
    provider: string
    mode: 'test' | 'live'
    webhookToken: string
    // Public config and decrypted secrets merged into one map
    credentials: Record<string, string>
}

export function resolve(row: IntegrationRow): ResolvedIntegration {
    const secrets = row.encrypted_credentials ? decryptCredentials(row.encrypted_credentials) : {}
    return {
        id: row.id,
        organizerId: row.organizer_id,
        category: row.category,
        provider: row.provider,
        mode: row.mode,
        webhookToken: row.webhook_token,
        credentials: { ...row.public_config, ...secrets },
    }
}

const table = () => createAdminClient().schema('gatepass').from('organizer_integrations')

export async function getIntegrationById(id: string): Promise<ResolvedIntegration | null> {
    const { data } = await table().select('*').eq('id', id).maybeSingle()
    return data ? resolve(data as IntegrationRow) : null
}

export async function getDefaultIntegration(organizerId: string, category: IntegrationCategory): Promise<ResolvedIntegration | null> {
    const { data } = await table()
        .select('*')
        .eq('organizer_id', organizerId)
        .eq('category', category)
        .eq('is_default', true)
        .maybeSingle()
    return data ? resolve(data as IntegrationRow) : null
}

/** The event's override if set, otherwise the organizer's default payment provider. */
export async function getEventPaymentIntegration(eventId: string): Promise<ResolvedIntegration | null> {
    const { data: event } = await createAdminClient()
        .schema('gatepass')
        .from('events')
        .select('organization_id, payment_integration_id')
        .eq('id', eventId)
        .single()
    if (!event?.organization_id) return null

    if (event.payment_integration_id) {
        const override = await getIntegrationById(event.payment_integration_id)
        if (override && override.organizerId === event.organization_id) return override
    }
    return getDefaultIntegration(event.organization_id, 'payments')
}

/** Public tracking IDs for event pages. Marketing integrations are all active at once, so there is no default. */
export async function getMarketingIds(organizerId: string): Promise<{ metaPixelId?: string; ga4Id?: string }> {
    const { data } = await table()
        .select('provider, public_config')
        .eq('organizer_id', organizerId)
        .eq('category', 'marketing')
    const byProvider = Object.fromEntries((data ?? []).map(row => [row.provider, row.public_config as Record<string, string>]))
    return {
        metaPixelId: byProvider.meta?.pixel_id,
        ga4Id: byProvider.ga4?.measurement_id,
    }
}
