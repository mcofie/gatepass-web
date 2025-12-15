export const PLATFORM_FEE_PERCENT = 0.04
export const PROCESSOR_FEE_PERCENT = 0.0195

interface FeeResult {
    subtotal: number
    platformFee: number // 4%, always absorbed in ticket price (customer perspective) or deducted (organizer perspective)
    processorFee: number // 1.95%, added to total if customer bears, or deducted from payout if organizer bears
    customerTotal: number // What the customer pays
    organizerPayout: number // What the organizer gets (Net)
}

export const calculateFees = (subtotal: number, feeBearer: 'customer' | 'organizer' = 'customer'): FeeResult => {
    const platformFee = subtotal * PLATFORM_FEE_PERCENT

    // Processor fee is typically calculated on the transaction amount.
    // For simplicity and standard usage, we Calculate it on the Subtotal here unless specified otherwise.
    // If strict reverse-calc is needed for "Organizer receives exactly X", that's different.
    // Assuming straightforward multiplication based on prompt context.
    const processorFee = subtotal * PROCESSOR_FEE_PERCENT

    let customerTotal = subtotal

    if (feeBearer === 'customer') {
        customerTotal = subtotal + processorFee
    }

    // Payout = Total Collected (from Customer perspective relative to ticket price) - ALL Fees?
    // User request: "payout fee for the organizer is ticket price - platform fee - payment processor fee"
    // This implies straightforward deduction from the Base Ticket Price regardless of who paid the extra.
    // If Customer PAID the extra processor fee, the Organizer shouldn't necessarily "lose" it from their base, 
    // BUT usually the payment processor takes their cut from the TOTAL incoming.

    // Let's interpret "ticket price - platform fee - payment processor fee" literally for now as the NET.
    const organizerPayout = subtotal - platformFee - processorFee

    return {
        subtotal,
        platformFee,
        processorFee,
        customerTotal,
        organizerPayout
    }
}
