import { MPESA_EXPRESS_NOT_ENABLED } from '@/lib/payments/providers/mpesa'
import type { ResolvedIntegration } from './store'
import { africasTalkingBase, infobipBase, termiiBase } from './sms'
import { mailgunBase, signSesRequest } from './email'
import { paypalToken } from '@/lib/payments/providers/paypal'
import { PaymentProviderError } from '@/lib/payments/types'
import { pesapalToken } from '@/lib/payments/providers/pesapal'

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
                if (!response.ok || !data.access_token) return { ok: false, message: 'Safaricom rejected the consumer key or secret.' }

                // A token alone isn't enough: probe M-Pesa Express with a dummy status query.
                // "Invalid Access Token" here means the Daraja app doesn't have M-Pesa Express enabled.
                const probeResponse = await fetch(`https://${host}/mpesa/stkpushquery/v1/query`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${data.access_token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ BusinessShortCode: c.shortcode, Password: '', Timestamp: '', CheckoutRequestID: 'ws_CO_gatepass_check' }),
                    cache: 'no-store',
                })
                const probe = await probeResponse.json().catch(() => ({}))
                if (probe.errorCode === '404.001.03') return { ok: false, message: MPESA_EXPRESS_NOT_ENABLED }
                return { ok: true, message: 'Connected to M-Pesa Daraja with M-Pesa Express.' }
            }
            case 'payments:gatepass': {
                const { createAdminClient } = await import('@/utils/supabase/admin')
                const { data } = await createAdminClient().schema('gatepass').from('organizer_payout_accounts').select('paystack_subaccount_code').eq('organizer_id', integration.organizerId).maybeSingle()
                return data?.paystack_subaccount_code
                    ? { ok: true, message: 'GatePass Payments is set up.' }
                    : { ok: false, message: 'Finish setting up your payout account.' }
            }
            case 'payments:paypal':
                await paypalToken(integration)
                return { ok: true, message: `Connected to PayPal${integration.mode === 'test' ? ' sandbox' : ''}.` }
            case 'payments:pesapal':
                await pesapalToken(integration)
                return { ok: true, message: `Connected to Pesapal${integration.mode === 'test' ? ' sandbox' : ''}.` }
            case 'payments:korapay':
                return checkKeyMode(c.secret_key, integration.mode, 'sk_live_', 'sk_test_')
                    ?? await probe('https://api.korapay.com/merchant/api/v1/balances', { Authorization: `Bearer ${c.secret_key}` }, 'Korapay')
            case 'payments:chapa':
                return checkKeyMode(c.secret_key, integration.mode, 'CHASECK-', 'CHASECK_TEST-')
                    ?? await probe('https://api.chapa.co/v1/banks', { Authorization: `Bearer ${c.secret_key}` }, 'Chapa')
            case 'payments:yoco':
                // Yoco has no read-only endpoint for keys; the key format and mode are checked instead
                if (!/^sk_(live|test)_/.test(c.secret_key ?? '')) return { ok: false, message: 'A Yoco secret key starts with sk_live_ or sk_test_.' }
                return checkKeyMode(c.secret_key, integration.mode, 'sk_live_', 'sk_test_')
                    ?? { ok: true, message: 'Key saved. Run a test checkout to confirm it works.' }
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
            case 'sms:vonage':
                return await probe(`https://rest.nexmo.com/account/get-balance?api_key=${encodeURIComponent(c.api_key)}&api_secret=${encodeURIComponent(c.api_secret)}`, {}, 'Vonage')
            case 'sms:infobip':
                if (!c.base_url) return { ok: false, message: 'Add your Infobip API base URL, e.g. xxxxx.api.infobip.com.' }
                return await probe(`${infobipBase(c.base_url)}/account/1/balance`, { Authorization: `App ${c.api_key}`, Accept: 'application/json' }, 'Infobip')
            case 'sms:plivo':
                return await probe(`https://api.plivo.com/v1/Account/${encodeURIComponent(c.auth_id)}/`, { Authorization: basic(c.auth_id, c.auth_token) }, 'Plivo')
            case 'sms:africastalking':
                return await probe(`${africasTalkingBase(integration.mode === 'test')}/version1/user?username=${encodeURIComponent(c.username)}`, { apiKey: c.api_key, Accept: 'application/json' }, 'Africa’s Talking')
            case 'sms:termii': {
                // Termii answers bad keys with 4xx bodies rather than 401s, so read the balance response
                const response = await fetch(`${termiiBase(c.base_url)}/api/get-balance?api_key=${encodeURIComponent(c.api_key)}`, { cache: 'no-store' })
                const data = await response.json().catch(() => ({}))
                return response.ok && data.balance !== undefined
                    ? { ok: true, message: 'Connected to Termii.' }
                    : { ok: false, message: data.message ? `Termii: ${data.message}` : 'Termii rejected this API key.' }
            }
            case 'sms:arkesel': {
                const response = await fetch('https://sms.arkesel.com/api/v2/clients/balance-details', { headers: { 'api-key': c.api_key }, cache: 'no-store' })
                const data = await response.json().catch(() => ({}))
                return response.ok && data.status === 'success'
                    ? { ok: true, message: 'Connected to Arkesel.' }
                    : { ok: false, message: data.message ? `Arkesel: ${data.message}` : 'Arkesel rejected this API key.' }
            }
            case 'sms:mnotify': {
                const response = await fetch(`https://api.mnotify.com/api/balance/sms?key=${encodeURIComponent(c.api_key)}`, { cache: 'no-store' })
                const data = await response.json().catch(() => ({}))
                return response.ok && data.status === 'success'
                    ? { ok: true, message: 'Connected to mNotify.' }
                    : { ok: false, message: data.message ? `mNotify: ${data.message}` : 'mNotify rejected this API key.' }
            }
            case 'sms:hubtel':
            case 'sms:zend':
                // No read-only endpoint to check against; delivery is confirmed with a test message instead.
                return { ok: true, message: 'Keys saved. Send a test message to confirm delivery.' }
            case 'email:resend': {
                // Resend answers bad keys with 400, so only a 200 counts
                const response = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${c.api_key}` }, cache: 'no-store' })
                if (response.ok) return { ok: true, message: 'Connected to Resend.' }
                const data = await response.json().catch(() => ({}))
                return { ok: false, message: data.message ? `Resend: ${data.message}` : 'Resend rejected this API key.' }
            }
            case 'email:sendgrid':
                return await probe('https://api.sendgrid.com/v3/scopes', { Authorization: `Bearer ${c.api_key}` }, 'SendGrid')
            case 'email:mailgun':
                return await probe(`${mailgunBase(c.region)}/v3/domains/${encodeURIComponent(c.domain)}`, { Authorization: basic('api', c.api_key) }, 'Mailgun')
            case 'email:postmark':
                return await probe('https://api.postmarkapp.com/server', { 'X-Postmark-Server-Token': c.server_token, Accept: 'application/json' }, 'Postmark')
            case 'email:brevo':
                return await probe('https://api.brevo.com/v3/account', { 'api-key': c.api_key, Accept: 'application/json' }, 'Brevo')
            case 'email:mailjet':
                return await probe('https://api.mailjet.com/v3/REST/user', { Authorization: basic(c.api_key, c.secret_key) }, 'Mailjet')
            case 'email:sendchamp':
                return await probe('https://api.sendchamp.com/api/v1/wallet/wallet_balance', { Authorization: `Bearer ${c.api_key}`, Accept: 'application/json' }, 'Sendchamp')
            case 'email:ses': {
                const signed = signSesRequest({ method: 'GET', region: (c.region || '').trim(), path: '/v2/email/account', body: '', accessKeyId: c.access_key_id, secretAccessKey: c.secret_access_key })
                return await probe(signed.url, signed.headers, 'Amazon SES')
            }
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
        // Our own adapters throw readable messages (e.g. "PayPal rejected the client ID or secret")
        if (e instanceof PaymentProviderError) return { ok: false, message: e.message }
        return { ok: false, message: `Could not reach the provider: ${e instanceof Error ? e.message : String(e)}` }
    }
}
