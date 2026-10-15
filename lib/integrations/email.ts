import { createHash, createHmac } from 'crypto'
import { getDefaultIntegration, type ResolvedIntegration } from './store'

// Organizer-owned email: ticket emails go out through the organizer's provider, from their domain.

export type EmailMessage = {
    to: string
    subject: string
    html: string
    text?: string
    /** Overrides the integration's from name, e.g. the organization name */
    fromName?: string
    replyTo?: string
}

export type EmailResult = { success: boolean; error?: string }

/** The organizer's default email integration, or null to use GatePass's own sender. */
export async function getOrganizerEmailIntegration(organizerId: string | null | undefined): Promise<ResolvedIntegration | null> {
    if (!organizerId) return null
    const integration = await getDefaultIntegration(organizerId, 'email')
    return integration
}

export async function sendEmail(integration: ResolvedIntegration, message: EmailMessage): Promise<EmailResult> {
    const c = integration.credentials
    const fromName = message.fromName || c.from_name || 'GatePass'
    const from = { email: c.from_email, name: fromName }
    try {
        switch (integration.provider) {
            case 'resend': return await viaResend(c.api_key, from, message)
            case 'sendgrid': return await viaSendGrid(c.api_key, from, message)
            case 'mailgun': return await viaMailgun(c.api_key, c.domain, c.region, from, message)
            case 'postmark': return await viaPostmark(c.server_token, c.message_stream, from, message)
            case 'ses': return await viaSes(c.access_key_id, c.secret_access_key, c.region, from, message)
            case 'brevo': return await viaBrevo(c.api_key, from, message)
            case 'mailjet': return await viaMailjet(c.api_key, c.secret_key, from, message)
            case 'sendchamp': return await viaSendchamp(c.api_key, from, message)
            default: return { success: false, error: `Unsupported email provider: ${integration.provider}` }
        }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
}

type From = { email: string; name: string }
const formatted = (from: From) => `${from.name.replace(/[<>"]/g, '')} <${from.email}>`
const fail = async (response: Response, provider: string) => {
    const body = await response.text().catch(() => '')
    let message = body
    try { const json = JSON.parse(body); message = json.message || json.errors?.[0]?.message || json.Message || json.error || body } catch { /* plain text */ }
    return { success: false, error: `${provider}: ${String(message || response.status).slice(0, 300)}` }
}

async function viaResend(apiKey: string, from: From, m: EmailMessage): Promise<EmailResult> {
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: formatted(from), to: [m.to], subject: m.subject, html: m.html, text: m.text, reply_to: m.replyTo }),
    })
    return response.ok ? { success: true } : fail(response, 'Resend')
}

async function viaSendGrid(apiKey: string, from: From, m: EmailMessage): Promise<EmailResult> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: m.to }] }],
            from,
            ...(m.replyTo ? { reply_to: { email: m.replyTo } } : {}),
            subject: m.subject,
            content: [...(m.text ? [{ type: 'text/plain', value: m.text }] : []), { type: 'text/html', value: m.html }],
        }),
    })
    return response.ok ? { success: true } : fail(response, 'SendGrid')
}

export const mailgunBase = (region?: string) => (region?.trim().toLowerCase() === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net')

async function viaMailgun(apiKey: string, domain: string, region: string | undefined, from: From, m: EmailMessage): Promise<EmailResult> {
    const body = new URLSearchParams({ from: formatted(from), to: m.to, subject: m.subject, html: m.html })
    if (m.text) body.set('text', m.text)
    if (m.replyTo) body.set('h:Reply-To', m.replyTo)
    const response = await fetch(`${mailgunBase(region)}/v3/${encodeURIComponent(domain)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}` },
        body,
    })
    return response.ok ? { success: true } : fail(response, 'Mailgun')
}

async function viaPostmark(token: string, stream: string | undefined, from: From, m: EmailMessage): Promise<EmailResult> {
    const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: { 'X-Postmark-Server-Token': token, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ From: formatted(from), To: m.to, Subject: m.subject, HtmlBody: m.html, TextBody: m.text, ReplyTo: m.replyTo, MessageStream: stream || 'outbound' }),
    })
    return response.ok ? { success: true } : fail(response, 'Postmark')
}

async function viaBrevo(apiKey: string, from: From, m: EmailMessage): Promise<EmailResult> {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: from, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text, ...(m.replyTo ? { replyTo: { email: m.replyTo } } : {}) }),
    })
    return response.ok ? { success: true } : fail(response, 'Brevo')
}

async function viaMailjet(apiKey: string, secretKey: string, from: From, m: EmailMessage): Promise<EmailResult> {
    const response = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ Messages: [{ From: { Email: from.email, Name: from.name }, To: [{ Email: m.to }], Subject: m.subject, HTMLPart: m.html, TextPart: m.text, ...(m.replyTo ? { ReplyTo: { Email: m.replyTo } } : {}) }] }),
    })
    if (!response.ok) return fail(response, 'Mailjet')
    const data = await response.json().catch(() => ({}))
    const status = data?.Messages?.[0]?.Status
    return status === 'success' ? { success: true } : { success: false, error: `Mailjet: ${data?.Messages?.[0]?.Errors?.[0]?.ErrorMessage ?? status ?? 'not sent'}` }
}

async function viaSendchamp(apiKey: string, from: From, m: EmailMessage): Promise<EmailResult> {
    const response = await fetch('https://api.sendchamp.com/api/v1/email/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to: [{ email: m.to, name: m.to }], from: { email: from.email, name: from.name }, subject: m.subject, message_body: { type: 'html', value: m.html } }),
    })
    const data = await response.json().catch(() => ({}))
    const success = response.ok && (data.status === 'success' || data.code === 200)
    return success ? { success: true } : { success: false, error: `Sendchamp: ${data.message || response.status}` }
}

// ---- Amazon SES (API v2) with AWS Signature Version 4 ----

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex')
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest()

/** Signs a request to SES v2. Exported for the connection check. */
export function signSesRequest(input: { method: 'GET' | 'POST'; region: string; path: string; body: string; accessKeyId: string; secretAccessKey: string }) {
    const host = `email.${input.region}.amazonaws.com`
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const date = amzDate.slice(0, 8)
    const payloadHash = sha256(input.body)
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
    const canonicalRequest = [input.method, input.path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
    const scope = `${date}/${input.region}/ses/aws4_request`
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n')
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, date), input.region), 'ses'), 'aws4_request')
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
    return {
        url: `https://${host}${input.path}`,
        headers: {
            'Content-Type': 'application/json',
            'X-Amz-Date': amzDate,
            'X-Amz-Content-Sha256': payloadHash,
            Authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        },
    }
}

async function viaSes(accessKeyId: string, secretAccessKey: string, region: string, from: From, m: EmailMessage): Promise<EmailResult> {
    const body = JSON.stringify({
        FromEmailAddress: formatted(from),
        Destination: { ToAddresses: [m.to] },
        ...(m.replyTo ? { ReplyToAddresses: [m.replyTo] } : {}),
        Content: { Simple: { Subject: { Data: m.subject, Charset: 'UTF-8' }, Body: { Html: { Data: m.html, Charset: 'UTF-8' }, ...(m.text ? { Text: { Data: m.text, Charset: 'UTF-8' } } : {}) } } },
    })
    const signed = signSesRequest({ method: 'POST', region: region.trim(), path: '/v2/email/outbound-emails', body, accessKeyId, secretAccessKey })
    const response = await fetch(signed.url, { method: 'POST', headers: signed.headers, body })
    return response.ok ? { success: true } : fail(response, 'Amazon SES')
}
