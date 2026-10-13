import { getDefaultIntegration, type ResolvedIntegration } from './store'

export type SmsResult = { success: boolean; error?: string }

/** Sends one SMS through the organizer's default SMS integration. Callers must authorise first. */
export async function sendSmsForOrganizer(organizerId: string, to: string, message: string): Promise<SmsResult> {
    const integration = await getDefaultIntegration(organizerId, 'sms')
    if (!integration) return { success: false, error: 'SMS provider not configured for this organization.' }
    return sendSms(integration, to, message)
}

export async function sendSms(integration: ResolvedIntegration, to: string, message: string): Promise<SmsResult> {
    const c = integration.credentials
    const senderId = c.sender_id || 'GATEPASS'
    try {
        switch (integration.provider) {
            case 'hubtel': return await sendViaHubtel(c.client_id, c.client_secret, senderId, to, message)
            case 'zend': return await sendViaZend(c.api_key, senderId, to, message)
            case 'twilio': return await sendViaTwilio(c.account_sid, c.auth_token, c.sender_id, to, message)
            case 'clicksend': return await sendViaClickSend(c.username, c.api_key, senderId, to, message)
            default: return { success: false, error: `Unsupported SMS provider: ${integration.provider}` }
        }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** Local Ghana numbers (0XXXXXXXXX) become +233…; anything else is assumed to include a country code. */
function toE164(to: string): string {
    let digits = to.trim().replace(/\D/g, '')
    if (digits.startsWith('0') && digits.length === 10) digits = '233' + digits.substring(1)
    return '+' + digits
}

async function sendViaHubtel(clientId: string, clientSecret: string, from: string, to: string, content: string): Promise<SmsResult> {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const response = await fetch('https://api-v2.hubtel.com/messages', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            From: from.substring(0, 11),
            To: toE164(to).substring(1),
            Content: content,
            Direction: 'outbound'
        })
    })
    const data = await response.json().catch(() => ({}))
    const success = response.ok && (data.status === 'Success' || data.responseCode === '00' || data.status === 'Scheduled')
    return { success, error: success ? undefined : (data.message || `Hubtel responded with ${response.status}`) }
}

async function sendViaZend(apiKey: string, senderId: string, to: string, message: string): Promise<SmsResult> {
    // Normalize API Key (remove 'Bearer ' if already present to avoid duplication)
    const cleanKey = apiKey.trim().startsWith('Bearer ') ? apiKey.trim().split(' ')[1] : apiKey.trim()
    const response = await fetch('https://api.tryzend.com/messages', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'x-api-key': cleanKey, // Some versions use this header
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            to: toE164(to),
            body: message,
            sender_id: senderId.substring(0, 11), // TryZend specific field
            preferred_channels: ['sms']
        })
    })
    const data = await response.json().catch(() => ({}))
    const success = response.ok && (
        data.status === 'success' ||
        data.success === true ||
        String(data.status).toLowerCase().includes('queued') ||
        String(data.message).toLowerCase().includes('queued')
    )
    return { success, error: success ? undefined : (data.message || data.error || JSON.stringify(data)) }
}

async function sendViaTwilio(accountSid: string, authToken: string, from: string, to: string, message: string): Promise<SmsResult> {
    const body = new URLSearchParams({ To: toE164(to), Body: message })
    // A Messaging Service SID (MG…) lets Twilio pick the sender
    if (from.startsWith('MG')) body.set('MessagingServiceSid', from)
    else body.set('From', from)

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    })
    const data = await response.json().catch(() => ({}))
    return { success: response.ok, error: response.ok ? undefined : (data.message || `Twilio responded with ${response.status}`) }
}

async function sendViaClickSend(username: string, apiKey: string, senderId: string, to: string, message: string): Promise<SmsResult> {
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: [{ source: 'gatepass', from: senderId.substring(0, 11), to: toE164(to), body: message }] })
    })
    const data = await response.json().catch(() => ({}))
    const status = data?.data?.messages?.[0]?.status
    const success = response.ok && data.response_code === 'SUCCESS' && (!status || status === 'SUCCESS')
    return { success, error: success ? undefined : (status || data.response_msg || `ClickSend responded with ${response.status}`) }
}
