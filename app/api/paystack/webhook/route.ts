import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Use SECRET KEY for verification as per Paystack docs (or explicit Webhook Secret)
const WH_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY!;

export async function POST(req: NextRequest) {
    try {
        const raw = await req.text();
        const sig = req.headers.get("x-paystack-signature") ?? "";

        if (!WH_SECRET) {
            console.error('PAYSTACK_SECRET_KEY missing')
            // Accept request to avoid retry loops if we are broken, but log error
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

            // Check if this is an instalment payment
            if (metadata.payment_type === 'instalment') {
                if (metadata.instalment_payment_id) {
                    // Subsequent instalment payment
                    const { processInstalmentPayment } = await import('@/utils/actions/instalment')
                    const result = await processInstalmentPayment(reference, metadata.instalment_payment_id, tx)

                    if (!result.success) {
                        console.error('[paystack-webhook] Instalment processing failed:', result.error)
                        return NextResponse.json({ ok: false }, { status: 500 })
                    }
                    console.log(`[paystack-webhook] Successfully processed instalment ref: ${reference}`)
                } else {
                    // First instalment — handled by verify-instalment callback route
                    console.log(`[paystack-webhook] First instalment ref: ${reference} — handled by callback`)
                }
            } else {
                // Standard full payment
                const { processSuccessfulPayment } = await import('@/utils/actions/payment')
                const result = await processSuccessfulPayment(reference, undefined, tx)

                if (!result.success) {
                    console.error('[paystack-webhook] Processing failed:', result.error);
                    return NextResponse.json({ ok: false }, { status: 500 });
                }
                console.log(`[paystack-webhook] Successfully processed ref: ${reference}`)
            }
        }

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('[paystack-webhook] Error:', error);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
