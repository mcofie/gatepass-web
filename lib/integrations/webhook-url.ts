/** The inbound webhook URL organizers paste into their provider's dashboard. */
export function webhookUrlFor(provider: string, integrationId: string, token: string): string {
    const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
    return `${base}/api/webhooks/${provider}/${integrationId}?token=${token}`
}
