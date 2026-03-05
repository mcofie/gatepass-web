import { Resend } from 'resend'
import { formatCurrency } from '@/utils/format'

// ============================================================
// INSTALMENT EMAIL UTILITIES
// Sends emails for instalment lifecycle events:
// - Plan confirmation with full schedule
// - Individual instalment received
// - Payment reminders
// - Overdue notices
// - Completion / ticket issued
// - Forfeit notification
// ============================================================

function getResend() {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY is missing')
    return new Resend(apiKey)
}

const FROM = 'GatePass <notifications@updates.gatepass.so>'

interface InstalmentScheduleItem {
    instalment_number: number
    amount: number
    due_at: string
    status: string
}

// ---------- Confirmation Email ----------

interface InstalmentConfirmationProps {
    to: string
    customerName: string
    eventName: string
    eventDate: string
    tierName: string
    quantity: number
    totalAmount: number
    amountPaid: number
    currency: string
    schedule: InstalmentScheduleItem[]
    instalmentReservationId: string
}

export const sendInstalmentConfirmationEmail = async (props: InstalmentConfirmationProps) => {
    const resend = getResend()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gatepass.so'

    const scheduleHtml = props.schedule.map(s => {
        const date = new Date(s.due_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        })
        const isPaid = s.status === 'paid'
        return `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px 16px; font-size: 14px; color: #333;">
                    Instalment ${s.instalment_number}
                </td>
                <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #333;">
                    ${formatCurrency(s.amount, props.currency)}
                </td>
                <td style="padding: 12px 16px; font-size: 14px; color: ${isPaid ? '#16a34a' : '#6b7280'};">
                    ${isPaid ? '✅ Paid' : date}
                </td>
            </tr>
        `
    }).join('')

    const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="background:#000;padding:32px 24px;text-align:center;">
                <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">Payment Plan Started 🎉</h1>
                <p style="color:#9ca3af;font-size:14px;margin:0;">${props.eventName}</p>
            </div>
            <div style="padding:32px 24px;">
                <p style="font-size:16px;color:#111;margin:0 0 24px;">Hi ${props.customerName},</p>
                <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
                    Your instalment plan for <strong>${props.quantity}x ${props.tierName}</strong> ticket(s) has been activated.
                    Your ticket will be reserved and issued once all payments are complete.
                </p>

                <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                        <span style="font-size:13px;color:#6b7280;">Total Amount</span>
                        <span style="font-size:16px;font-weight:700;color:#111;">${formatCurrency(props.totalAmount, props.currency)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
                        <span style="font-size:13px;color:#6b7280;">Paid Today</span>
                        <span style="font-size:14px;font-weight:600;color:#16a34a;">${formatCurrency(props.amountPaid, props.currency)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span style="font-size:13px;color:#6b7280;">Remaining</span>
                        <span style="font-size:14px;font-weight:600;color:#f59e0b;">${formatCurrency(props.totalAmount - props.amountPaid, props.currency)}</span>
                    </div>
                </div>

                <h3 style="font-size:14px;font-weight:700;color:#111;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Payment Schedule</h3>
                <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                    <thead>
                        <tr style="background:#f9fafb;">
                            <th style="padding:10px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;text-align:left;">Payment</th>
                            <th style="padding:10px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;text-align:left;">Amount</th>
                            <th style="padding:10px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;text-align:left;">Due</th>
                        </tr>
                    </thead>
                    <tbody>${scheduleHtml}</tbody>
                </table>

                <a href="${appUrl}/my-tickets/instalments/${props.instalmentReservationId}" 
                   style="display:block;text-align:center;background:#000;color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;">
                    View Payment Plan
                </a>

                <p style="font-size:12px;color:#9ca3af;text-align:center;margin:24px 0 0;">
                    Your ticket will be issued once all payments are complete. You'll receive a reminder before each payment is due.
                </p>
            </div>
        </div>
    </body>
    </html>
    `

    return resend.emails.send({
        from: FROM,
        to: props.to,
        subject: `Payment Plan Confirmed – ${props.eventName}`,
        html
    })
}

// ---------- Instalment Received Email ----------

interface InstalmentReceivedProps {
    to: string
    customerName: string
    eventName: string
    tierName: string
    instalmentNumber: number
    totalInstalments: number
    amountPaid: number
    totalPaid: number
    totalAmount: number
    remaining: number
    currency: string
    nextDueAt?: string
    nextAmount?: number
    instalmentReservationId: string
}

export const sendInstalmentReceivedEmail = async (props: InstalmentReceivedProps) => {
    const resend = getResend()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gatepass.so'
    const progressPct = Math.round((props.totalPaid / props.totalAmount) * 100)

    const nextDueStr = props.nextDueAt
        ? new Date(props.nextDueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A'

    const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="background:#000;padding:32px 24px;text-align:center;">
                <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">Payment Received ✅</h1>
                <p style="color:#9ca3af;font-size:14px;margin:0;">Instalment ${props.instalmentNumber} of ${props.totalInstalments}</p>
            </div>
            <div style="padding:32px 24px;">
                <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi ${props.customerName},</p>
                <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
                    We've received your payment of <strong>${formatCurrency(props.amountPaid, props.currency)}</strong> for ${props.eventName}.
                </p>

                <!-- Progress Bar -->
                <div style="background:#f0f0f0;border-radius:999px;height:8px;margin-bottom:8px;">
                    <div style="background:#16a34a;border-radius:999px;height:8px;width:${progressPct}%;transition:width 0.3s;"></div>
                </div>
                <p style="font-size:12px;color:#9ca3af;margin:0 0 24px;text-align:right;">${progressPct}% paid</p>

                <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="font-size:13px;color:#6b7280;">Total Paid</span>
                        <span style="font-size:14px;font-weight:600;color:#16a34a;">${formatCurrency(props.totalPaid, props.currency)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="font-size:13px;color:#6b7280;">Remaining</span>
                        <span style="font-size:14px;font-weight:600;color:#f59e0b;">${formatCurrency(props.remaining, props.currency)}</span>
                    </div>
                    ${props.nextAmount ? `
                    <div style="display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:8px;margin-top:8px;">
                        <span style="font-size:13px;color:#6b7280;">Next Payment</span>
                        <span style="font-size:14px;font-weight:600;color:#111;">${formatCurrency(props.nextAmount, props.currency)} by ${nextDueStr}</span>
                    </div>` : ''}
                </div>

                <a href="${appUrl}/my-tickets/instalments/${props.instalmentReservationId}" 
                   style="display:block;text-align:center;background:#000;color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;">
                    ${props.remaining > 0 ? 'Make Next Payment' : 'View Your Ticket'}
                </a>
            </div>
        </div>
    </body>
    </html>
    `

    return resend.emails.send({
        from: FROM,
        to: props.to,
        subject: `Payment ${props.instalmentNumber}/${props.totalInstalments} received – ${props.eventName}`,
        html
    })
}

// ---------- Payment Reminder Email ----------

interface InstalmentReminderProps {
    to: string
    customerName: string
    eventName: string
    amount: number
    currency: string
    dueAt: string
    instalmentNumber: number
    totalInstalments: number
    instalmentReservationId: string
    isOverdue?: boolean
}

export const sendInstalmentReminderEmail = async (props: InstalmentReminderProps) => {
    const resend = getResend()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gatepass.so'
    const dueStr = new Date(props.dueAt).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    })

    const isOverdue = props.isOverdue || false
    const title = isOverdue ? 'Payment Overdue ⚠️' : 'Payment Reminder 📅'
    const subject = isOverdue
        ? `Overdue: ${formatCurrency(props.amount, props.currency)} for ${props.eventName}`
        : `Reminder: ${formatCurrency(props.amount, props.currency)} due ${dueStr}`

    const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="background:${isOverdue ? '#dc2626' : '#000'};padding:32px 24px;text-align:center;">
                <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">${title}</h1>
                <p style="color:${isOverdue ? '#fca5a5' : '#9ca3af'};font-size:14px;margin:0;">
                    Instalment ${props.instalmentNumber} of ${props.totalInstalments}
                </p>
            </div>
            <div style="padding:32px 24px;">
                <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi ${props.customerName},</p>
                <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
                    ${isOverdue
            ? `Your payment of <strong>${formatCurrency(props.amount, props.currency)}</strong> for ${props.eventName} was due on <strong>${dueStr}</strong>. Please pay as soon as possible to keep your ticket reservation.`
            : `Just a reminder that your next payment of <strong>${formatCurrency(props.amount, props.currency)}</strong> for ${props.eventName} is due on <strong>${dueStr}</strong>.`
        }
                </p>

                <a href="${appUrl}/my-tickets/instalments/${props.instalmentReservationId}" 
                   style="display:block;text-align:center;background:${isOverdue ? '#dc2626' : '#000'};color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;">
                    Pay Now – ${formatCurrency(props.amount, props.currency)}
                </a>

                ${isOverdue ? `
                <p style="font-size:12px;color:#dc2626;text-align:center;margin:16px 0 0;">
                    ⚠️ If payment is not received within the grace period, your reservation may be forfeited.
                </p>` : ''}
            </div>
        </div>
    </body>
    </html>
    `

    return resend.emails.send({
        from: FROM,
        to: props.to,
        subject,
        html
    })
}

// ---------- Forfeit Notification ----------

interface InstalmentForfeitProps {
    to: string
    customerName: string
    eventName: string
    totalPaid: number
    totalAmount: number
    currency: string
}

export const sendInstalmentForfeitEmail = async (props: InstalmentForfeitProps) => {
    const resend = getResend()

    const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="background:#dc2626;padding:32px 24px;text-align:center;">
                <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">Reservation Forfeited</h1>
                <p style="color:#fca5a5;font-size:14px;margin:0;">${props.eventName}</p>
            </div>
            <div style="padding:32px 24px;">
                <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi ${props.customerName},</p>
                <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
                    Unfortunately, your ticket reservation for <strong>${props.eventName}</strong> has been forfeited
                    due to missed instalment payments.
                </p>
                <div style="background:#fef2f2;border-radius:12px;padding:20px;margin-bottom:24px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="font-size:13px;color:#6b7280;">Total Paid</span>
                        <span style="font-size:14px;font-weight:600;color:#111;">${formatCurrency(props.totalPaid, props.currency)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span style="font-size:13px;color:#6b7280;">Total Required</span>
                        <span style="font-size:14px;font-weight:600;color:#111;">${formatCurrency(props.totalAmount, props.currency)}</span>
                    </div>
                </div>
                <p style="font-size:12px;color:#9ca3af;text-align:center;">
                    For refund inquiries on payments already made, please contact the event organizer.
                </p>
            </div>
        </div>
    </body>
    </html>
    `

    return resend.emails.send({
        from: FROM,
        to: props.to,
        subject: `Reservation Forfeited – ${props.eventName}`,
        html
    })
}

// ---------- Organizer Forfeit Notification ----------

interface OrganizerInstalmentForfeitProps {
    to: string
    organizerName: string
    customerName: string
    customerEmail: string
    eventName: string
    amountPaid: number
    currency: string
}

export const sendInstalmentForfeitEmailToOrganizer = async (props: OrganizerInstalmentForfeitProps) => {
    const resend = getResend()

    const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="background:#dc2626;padding:32px 24px;text-align:center;">
                <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">Action Required: Ticket Forfeited</h1>
                <p style="color:#fca5a5;font-size:14px;margin:0;">${props.eventName}</p>
            </div>
            <div style="padding:32px 24px;">
                <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi ${props.organizerName},</p>
                <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
                    A customer's instalment ticket reservation for <strong>${props.eventName}</strong> has been automatically forfeited due to missed payments exceeding the grace period. Their ticket inventory has been released.
                </p>
                <div style="background:#fef2f2;border-radius:12px;padding:20px;margin-bottom:24px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="font-size:13px;color:#6b7280;">Customer</span>
                        <span style="font-size:14px;font-weight:600;color:#111;">${props.customerName} (${props.customerEmail})</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span style="font-size:13px;color:#6b7280;">Amount Paid</span>
                        <span style="font-size:14px;font-weight:600;color:#dc2626;">${formatCurrency(props.amountPaid, props.currency)}</span>
                    </div>
                </div>
                <h3 style="font-size:14px;font-weight:700;color:#111;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Refund Required?</h3>
                <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
                    The customer has already paid ${formatCurrency(props.amountPaid, props.currency)}. Depending on your event's refund policy, you may need to issue a partial or full refund for this amount.
                </p>
                <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
                    <strong>To issue a refund:</strong> Please log in to your Paystack dashboard, locate the specific transactions for this customer, and initiate a refund from there. GatePass does not automatically refund forfeited instalments.
                </p>
            </div>
        </div>
    </body>
    </html>
    `

    return resend.emails.send({
        from: FROM,
        to: props.to,
        subject: `Action Required: Forfeited Ticket - ${props.eventName}`,
        html
    })
}
