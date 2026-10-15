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
            case 'vonage': return await sendViaVonage(c.api_key, c.api_secret, senderId, to, message)
            case 'infobip': return await sendViaInfobip(c.base_url, c.api_key, c.sender_id, to, message)
            case 'plivo': return await sendViaPlivo(c.auth_id, c.auth_token, senderId, to, message)
            case 'africastalking': return await sendViaAfricasTalking(c.username, c.api_key, c.sender_id, integration.mode === 'test', to, message)
            case 'termii': return await sendViaTermii(c.api_key, senderId, c.base_url, to, message)
            case 'arkesel': return await sendViaArkesel(c.api_key, senderId, to, message)
            case 'mnotify': return await sendViaMnotify(c.api_key, senderId, to, message)
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

/** "xxxxx.api.infobip.com" or a full URL → https origin without a trailing slash */
export function infobipBase(baseUrl: string): string {
    const trimmed = (baseUrl || '').trim().replace(/\/+$/, '')
    return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function termiiBase(baseUrl?: string): string {
    return (baseUrl?.trim() || 'https://api.ng.termii.com').replace(/\/+$/, '')
}

export function africasTalkingBase(sandbox: boolean): string {
    return sandbox ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com'
}

async function sendViaVonage(apiKey: string, apiSecret: string, from: string, to: string, text: string): Promise<SmsResult> {
    const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ api_key: apiKey, api_secret: apiSecret, from: from.substring(0, 11), to: toE164(to).substring(1), text }),
    })
    const data = await response.json().catch(() => ({}))
    const first = data?.messages?.[0]
    const success = response.ok && first?.status === '0'
    return { success, error: success ? undefined : (first?.['error-text'] || `Vonage responded with ${response.status}`) }
}

async function sendViaInfobip(baseUrl: string, apiKey: string, from: string | undefined, to: string, text: string): Promise<SmsResult> {
    const response = await fetch(`${infobipBase(baseUrl)}/sms/2/text/advanced`, {
        method: 'POST',
        headers: { Authorization: `App ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ messages: [{ destinations: [{ to: toE164(to).substring(1) }], ...(from ? { from } : {}), text }] }),
    })
    const data = await response.json().catch(() => ({}))
    const status = data?.messages?.[0]?.status
    const success = response.ok && status && status.groupName !== 'REJECTED'
    return { success: !!success, error: success ? undefined : (status?.description || data?.requestError?.serviceException?.text || `Infobip responded with ${response.status}`) }
}

async function sendViaPlivo(authId: string, authToken: string, src: string, to: string, text: string): Promise<SmsResult> {
    const response = await fetch(`https://api.plivo.com/v1/Account/${encodeURIComponent(authId)}/Message/`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ src, dst: toE164(to).substring(1), text }),
    })
    const data = await response.json().catch(() => ({}))
    return { success: response.ok, error: response.ok ? undefined : (data.error || `Plivo responded with ${response.status}`) }
}

async function sendViaAfricasTalking(username: string, apiKey: string, from: string | undefined, sandbox: boolean, to: string, message: string): Promise<SmsResult> {
    const body = new URLSearchParams({ username, to: toE164(to), message })
    if (from) body.set('from', from)
    const response = await fetch(`${africasTalkingBase(sandbox)}/version1/messaging`, {
        method: 'POST',
        headers: { apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    })
    const text = await response.text()
    let data: { SMSMessageData?: { Message?: string; Recipients?: { status?: string; statusCode?: number }[] } } = {}
    try { data = JSON.parse(text) } catch { /* plain-text error */ }
    const recipient = data.SMSMessageData?.Recipients?.[0]
    // 100 Processed, 101 Sent, 102 Queued
    const success = response.ok && !!recipient && [100, 101, 102].includes(Number(recipient.statusCode))
    return { success, error: success ? undefined : (recipient?.status || data.SMSMessageData?.Message || text || `Africa’s Talking responded with ${response.status}`) }
}

async function sendViaTermii(apiKey: string, from: string, baseUrl: string | undefined, to: string, sms: string): Promise<SmsResult> {
    const response = await fetch(`${termiiBase(baseUrl)}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, to: toE164(to).substring(1), from: from.substring(0, 11), sms, type: 'plain', channel: 'generic' }),
    })
    const data = await response.json().catch(() => ({}))
    const success = response.ok && (data.code === 'ok' || !!data.message_id)
    return { success, error: success ? undefined : (data.message || `Termii responded with ${response.status}`) }
}

async function sendViaArkesel(apiKey: string, sender: string, to: string, message: string): Promise<SmsResult> {
    const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: sender.substring(0, 11), message, recipients: [toE164(to).substring(1)] }),
    })
    const data = await response.json().catch(() => ({}))
    const success = response.ok && data.status === 'success'
    return { success, error: success ? undefined : (data.message || `Arkesel responded with ${response.status}`) }
}

async function sendViaMnotify(apiKey: string, sender: string, to: string, message: string): Promise<SmsResult> {
    const response = await fetch(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ recipient: [toE164(to).substring(1)], sender: sender.substring(0, 11), message, is_schedule: false, schedule_date: '' }),
    })
    const data = await response.json().catch(() => ({}))
    const success = response.ok && (data.status === 'success' || String(data.code) === '2000')
    return { success, error: success ? undefined : (data.message || `mNotify responded with ${response.status}`) }
}
