import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { notifyDiscord } from "@/utils/discord";

// Use SECRET KEY for verification as per Paystack docs (or explicit Webhook Secret)
const WH_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY!;

export async function POST(req: NextRequest) {
    try {
        const raw = await req.text();
        const sig = req.headers.get("x-paystack-signature") ?? "";

        if (!WH_SECRET) {
            console.error('PAYSTACK_SECRET_KEY missing')
            return NextResponse.json({ ok: false }, { status: 500 });
        }

        const hash = crypto.createHmac("sha512", WH_SECRET).update(raw).digest("hex");

        if (hash !== sig) {
            console.warn('Tap/Webhook Signature Mismatch', { hash, sig })
            return NextResponse.json({ ok: false }, { status: 401 });
        }

        const evt = JSON.parse(raw);

        if (evt.event === "charge.success") {
            const tx = evt.data;
            const reference = tx.reference;
            const metadata = tx.metadata || {};
            const amount = tx.amount / 100;
            const currency = tx.currency;

            // Check if this is an instalment payment
            if (metadata.payment_type === 'instalment') {
                if (metadata.is_full_payment) {
                    // Settle all remaining instalments at once
                    const { processFullInstalmentPayment } = await import('@/utils/actions/instalment')
                    const result = await processFullInstalmentPayment(reference, metadata.instalment_reservation_id, tx)

                    if (!result.success) {
                        await notifyDiscord(`❌ **Full Instalment Payment FAILED to Process**\nRef: ${reference}\nError: ${result.error}`, 'warning')
                        console.error('[paystack-webhook] Full instalment processing failed:', result.error)
                        return NextResponse.json({ ok: false }, { status: 500 })
                    }

                    await notifyDiscord(
                        `💰 **Full Instalment Settle Successful**\n` +
                        `**Customer:** ${tx.customer.email}\n` +
                        `**Amount:** ${currency} ${amount}\n` +
                        `**Res ID:** ${metadata.instalment_reservation_id}`,
                        'success'
                    )
                } else if (metadata.instalment_payment_id) {
                    // Subsequent instalment payment
                    const { processInstalmentPayment } = await import('@/utils/actions/instalment')
                    const result = await processInstalmentPayment(reference, metadata.instalment_payment_id, tx)

                    if (!result.success) {
                        await notifyDiscord(`❌ **Subsequent Instalment FAILED to Process**\nRef: ${reference}\nError: ${result.error}`, 'warning')
                        console.error('[paystack-webhook] Instalment processing failed:', result.error)
                        return NextResponse.json({ ok: false }, { status: 500 })
                    }

                    await notifyDiscord(
                        `💳 **Subsequent Instalment Payment Received**\n` +
                        `**Customer:** ${tx.customer.email}\n` +
                        `**Amount:** ${currency} ${amount}\n` +
                        `**Payment ID:** ${metadata.instalment_payment_id}`,
                        'success'
                    )
                } else {
                    // First instalment — handled by verify-instalment callback route but we can notify here too
                    await notifyDiscord(
                        `✨ **First Instalment Deposit Successful**\n` +
                        `**Customer:** ${tx.customer.email}\n` +
                        `**Amount:** ${currency} ${amount}`,
                        'success'
                    )
                }
            } else {
                // Standard full payment
                const { processSuccessfulPayment } = await import('@/utils/actions/payment')
                const result = await processSuccessfulPayment(reference, undefined, tx)

                if (!result.success) {
                    await notifyDiscord(`❌ **Standard Payment FAILED to Process**\nRef: ${reference}\nError: ${result.error}`, 'warning')
                    console.error('[paystack-webhook] Processing failed:', result.error);
                    return NextResponse.json({ ok: false }, { status: 500 });
                }

                await notifyDiscord(
                    `🎉 **New Ticket Purchase Successful**\n` +
                    `**Customer:** ${tx.customer.email}\n` +
                    `**Amount:** ${currency} ${amount}\n` +
                    `**Ref:** ${reference}`,
                    'success'
                )
            }
        }

        return NextResponse.json({ ok: true });

    } catch (error: any) {
        await notifyDiscord(`🔥 **CRITICAL WEBHOOK ERROR**\nError: ${error.message}`, 'warning')
        console.error('[paystack-webhook] Error:', error);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
