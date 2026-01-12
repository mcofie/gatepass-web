import { Resend } from 'resend'

export const notifyAdminOfSale = async (data: {
    eventName: string,
    customerName: string,
    amount: number,
    currency: string,
    quantity: number,
    ticketType: string
}) => {
    const slackWebhookUrl = process.env.ADMIN_SLACK_WEBHOOK_URL
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
    const adminEmail = process.env.ADMIN_EMAIL
    const resendApiKey = process.env.RESEND_API_KEY

    // 1. Notify via Slack
    if (slackWebhookUrl) {
        try {
            await fetch(slackWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `🚀 *New Sale on GatePass!*\n*Event:* ${data.eventName}\n*Customer:* ${data.customerName}\n*Ticket:* ${data.quantity}x ${data.ticketType}\n*Total:* ${data.currency} ${data.amount.toFixed(2)}`
                })
            })
            console.log('Admin Slack notification sent.')
        } catch (err) {
            console.error('Failed to send Slack notification:', err)
        }
    }

    // 2. Notify via Discord
    if (discordWebhookUrl) {
        try {
            await fetch(discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                        title: "🚀 New Sale on GatePass!",
                        color: 0x000000, // Black to match GatePass branding
                        fields: [
                            { name: "Event", value: data.eventName, inline: true },
                            { name: "Customer", value: data.customerName, inline: true },
                            { name: "Tickets", value: `${data.quantity}x ${data.ticketType}`, inline: false },
                            { name: "Total Amount", value: `${data.currency} ${data.amount.toFixed(2)}`, inline: true }
                        ],
                        footer: { text: "GatePass Notifications" },
                        timestamp: new Date().toISOString()
                    }]
                })
            })
            console.log('Admin Discord notification sent.')
        } catch (err) {
            console.error('Failed to send Discord notification:', err)
        }
    }

    // 3. Notify via Email
    if (adminEmail && resendApiKey) {
        try {
            const resend = new Resend(resendApiKey)
            await resend.emails.send({
                from: 'GatePass Sales <sales@updates.gatepass.so>',
                to: adminEmail,
                subject: `New Sale: ${data.eventName}`,
                html: `
                    <h1>New Sale Alert!</h1>
                    <p><strong>Event:</strong> ${data.eventName}</p>
                    <p><strong>Customer:</strong> ${data.customerName}</p>
                    <p><strong>Tickets:</strong> ${data.quantity}x ${data.ticketType}</p>
                    <p><strong>Total Amount:</strong> ${data.currency} ${data.amount.toFixed(2)}</p>
                    <hr />
                    <p>Login to the admin dashboard to view details.</p>
                `
            })
            console.log('Admin email notification sent.')
        } catch (err) {
            console.error('Failed to send admin email notification:', err)
        }
    }
}

/**
 * Notify organizer of a new ticket sale (if they have notifications enabled)
 */
export const notifyOrganizerOfSale = async (data: {
    organizerEmail: string,
    organizerName: string,
    eventName: string,
    customerName: string,
    amount: number,
    currency: string,
    quantity: number,
    ticketType: string,
    eventUrl?: string
}) => {
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey || !data.organizerEmail) {
        console.log('Skipping organizer notification: Missing API key or email')
        return
    }

    try {
        const resend = new Resend(resendApiKey)
        await resend.emails.send({
            from: 'GatePass <notifications@updates.gatepass.so>',
            to: data.organizerEmail,
            subject: `💰 New Sale: ${data.quantity}x ${data.ticketType} for ${data.eventName}`,
            html: `
                <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #000 0%, #333 100%); color: white; padding: 30px; border-radius: 16px; margin-bottom: 20px;">
                        <h1 style="margin: 0 0 10px 0; font-size: 24px;">New Ticket Sale! 🎉</h1>
                        <p style="margin: 0; opacity: 0.8; font-size: 14px;">Someone just bought tickets for your event</p>
                    </div>
                    
                    <div style="background: #f9fafb; padding: 24px; border-radius: 12px; margin-bottom: 20px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Event</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.eventName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Customer</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.customerName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tickets</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.quantity}x ${data.ticketType}</td>
                            </tr>
                            <tr style="border-top: 1px solid #e5e7eb;">
                                <td style="padding: 12px 0 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
                                <td style="padding: 12px 0 8px 0; text-align: right; font-weight: 700; font-size: 18px; color: #16a34a;">${data.currency} ${data.amount.toFixed(2)}</td>
                            </tr>
                        </table>
                    </div>
                    
                    ${data.eventUrl ? `
                    <a href="${data.eventUrl}" style="display: block; background: #000; color: white; text-align: center; padding: 14px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">
                        View Event Dashboard
                    </a>
                    ` : ''}
                    
                    <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
                        You're receiving this because you enabled sale notifications.<br/>
                        Manage preferences in Settings → Notifications
                    </p>
                </div>
            `
        })
        console.log(`Organizer notification sent to ${data.organizerEmail}`)
    } catch (err) {
        console.error('Failed to send organizer notification:', err)
    }
}
