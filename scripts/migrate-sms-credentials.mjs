/* eslint-disable */
// One-off: copy Hubtel/Zend SMS credentials from gatepass.organizers into the encrypted
// gatepass.organizer_integrations table. Safe to re-run (existing integrations are skipped).
// Run after 20261013120000_create_organizer_integrations.sql and before 20261013130000_drop_legacy_organizer_columns.sql:
//   node scripts/migrate-sms-credentials.mjs
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, randomBytes } from 'crypto'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INTEGRATIONS_ENCRYPTION_KEY } = process.env
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !INTEGRATIONS_ENCRYPTION_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or INTEGRATIONS_ENCRYPTION_KEY')
    process.exit(1)
}

// Must match lib/integrations/crypto.ts
const key = Buffer.from(INTEGRATIONS_ENCRYPTION_KEY, 'base64')
if (key.length !== 32) {
    console.error('INTEGRATIONS_ENCRYPTION_KEY must decode to 32 bytes')
    process.exit(1)
}
function encrypt(credentials) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()])
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':')
}
const hint = s => (s.length <= 4 ? '••••' : s.slice(-4))

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const { data: orgs, error } = await supabase
    .schema('gatepass')
    .from('organizers')
    .select('id, sms_provider, hubtel_client_id, hubtel_client_secret, zend_api_key, sms_sender_id')
if (error) throw error

let migrated = 0
for (const org of orgs) {
    const sender = org.sms_sender_id ? { sender_id: org.sms_sender_id } : {}
    const candidates = []
    if (org.hubtel_client_id && org.hubtel_client_secret) {
        candidates.push({ provider: 'hubtel', public_config: { client_id: org.hubtel_client_id, ...sender }, secrets: { client_secret: org.hubtel_client_secret } })
    }
    if (org.zend_api_key) {
        candidates.push({ provider: 'zend', public_config: { ...sender }, secrets: { api_key: org.zend_api_key } })
    }

    for (const c of candidates) {
        const { data: existing } = await supabase
            .schema('gatepass')
            .from('organizer_integrations')
            .select('id')
            .eq('organizer_id', org.id)
            .eq('category', 'sms')
            .eq('provider', c.provider)
            .maybeSingle()
        if (existing) continue

        const { error: insertError } = await supabase.schema('gatepass').from('organizer_integrations').insert({
            organizer_id: org.id,
            category: 'sms',
            provider: c.provider,
            mode: 'live',
            public_config: c.public_config,
            encrypted_credentials: encrypt(c.secrets),
            credential_hints: Object.fromEntries(Object.entries(c.secrets).map(([k, v]) => [k, hint(v)])),
            // The provider the organizer had selected stays their default
            is_default: org.sms_provider === c.provider,
        })
        if (insertError) {
            console.error(`Organizer ${org.id} (${c.provider}):`, insertError.message)
        } else {
            migrated++
        }
    }
}

console.log(`Migrated ${migrated} SMS integration(s).`)
