import type { ResolvedIntegration } from './store'

export type VerifyResult = { ok: boolean; message: string }

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`

/** Status codes that mean the credentials themselves were rejected. Anything else means auth passed. */
const isAuthFailure = (status: number) => status === 401 || status === 403

async function probe(url: string, headers: Record<string, string>, providerName: string): Promise<VerifyResult> {
    const response = await fetch(url, { headers, cache: 'no-store' })
    if (isAuthFailure(response.status)) return { ok: false, message: `${providerName} rejected these credentials.` }
    if (response.status >= 500) return { ok: false, message: `${providerName} is unavailable right now (${response.status}). Try again shortly.` }
    return { ok: true, message: `Connected to ${providerName}.` }
}

function checkKeyMode(key: string, mode: 'test' | 'live', livePrefix: string, testPrefix: string): VerifyResult | null {
    if (mode === 'live' && key.startsWith(testPrefix)) return { ok: false, message: 'This is a test key. Switch to test mode or use your live key.' }
    if (mode === 'test' && key.startsWith(livePrefix)) return { ok: false, message: 'This is a live key. Switch to live mode or use your test key.' }
    return null
}

/** Makes one cheap, read-only call to the provider to confirm the stored credentials work. */
export async function verifyIntegration(integration: ResolvedIntegration): Promise<VerifyResult> {
    const c = integration.credentials
    try {
        switch (`${integration.category}:${integration.provider}`) {
            case 'payments:stripe':
                return checkKeyMode(c.secret_key, integration.mode, 'sk_live_', 'sk_test_')
                    ?? await probe('https://api.stripe.com/v1/balance', { Authorization: `Bearer ${c.secret_key}` }, 'Stripe')
            case 'payments:paystack':
                return checkKeyMode(c.secret_key, integration.mode, 'sk_live_', 'sk_test_')
                    ?? await probe('https://api.paystack.co/transaction?perPage=1', { Authorization: `Bearer ${c.secret_key}` }, 'Paystack')
            case 'payments:flutterwave':
                return checkKeyMode(c.secret_key, integration.mode, 'FLWSECK-', 'FLWSECK_TEST-')
                    ?? await probe('https://api.flutterwave.com/v3/balances', { Authorization: `Bearer ${c.secret_key}` }, 'Flutterwave')
            case 'payments:hubtel':
                return await probe(
                    `https://api-txnstatus.hubtel.com/transactions/${encodeURIComponent(c.merchant_account_number)}/status?clientReference=gatepass-verify`,
                    { Authorization: basic(c.client_id, c.client_secret) },
                    'Hubtel'
                )
            case 'payments:mpesa': {
                const host = integration.mode === 'test' ? 'sandbox.safaricom.co.ke' : 'api.safaricom.co.ke'
                const response = await fetch(`https://${host}/oauth/v1/generate?grant_type=client_credentials`, {
                    headers: { Authorization: basic(c.consumer_key, c.consumer_secret) },
                    cache: 'no-store',
                })
                const data = await response.json().catch(() => ({}))
                return response.ok && data.access_token
                    ? { ok: true, message: 'Connected to M-Pesa Daraja.' }
                    : { ok: false, message: 'Safaricom rejected the consumer key or secret.' }
            }
            case 'payments:wave':
                return await probe(
                    'https://api.wave.com/v1/checkout/sessions/search?client_reference=gatepass-verify',
                    { Authorization: `Bearer ${c.api_key}` },
                    'Wave'
                )
            case 'sms:twilio':
                return await probe(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.account_sid)}.json`, { Authorization: basic(c.account_sid, c.auth_token) }, 'Twilio')
            case 'sms:clicksend':
                return await probe('https://rest.clicksend.com/v3/account', { Authorization: basic(c.username, c.api_key) }, 'ClickSend')
            case 'sms:hubtel':
            case 'sms:zend':
                // No read-only endpoint to check against; delivery is confirmed with a test message instead.
                return { ok: true, message: 'Keys saved. Send a test message to confirm delivery.' }
            case 'marketing:meta':
                return /^\d{6,20}$/.test(c.pixel_id ?? '')
                    ? { ok: true, message: 'Pixel ID saved.' }
                    : { ok: false, message: 'A Meta Pixel ID is a string of digits, e.g. 1234567890.' }
            case 'marketing:ga4':
                return /^G-[A-Z0-9]{4,}$/i.test(c.measurement_id ?? '')
                    ? { ok: true, message: 'Measurement ID saved.' }
                    : { ok: false, message: 'A GA4 Measurement ID looks like G-XXXXXXXXXX.' }
            default:
                return { ok: false, message: 'This provider cannot be verified yet.' }
        }
    } catch (e) {
        return { ok: false, message: `Could not reach the provider: ${e instanceof Error ? e.message : String(e)}` }
    }
}
