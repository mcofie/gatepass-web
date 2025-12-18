export const PLATFORM_FEE_PERCENT = 0.04
export const PROCESSOR_FEE_PERCENT = 0.0195

interface FeeResult {
    subtotal: number
    platformFee: number // 4%, always absorbed in ticket price (customer perspective) or deducted (organizer perspective)
    processorFee: number // 1.95%, added to total if customer bears, or deducted from payout if organizer bears
    clientFees: number // Total fees paid by customer
    customerTotal: number // What the customer pays
    organizerPayout: number // What the organizer gets (Net)
}

export const calculateFees = (subtotal: number, feeBearer: 'customer' | 'organizer' = 'customer'): FeeResult => {
    // 1. Platform Fee: ALWAYS 4% paid by the customer on top of ticket.
    const platformFee = subtotal * PLATFORM_FEE_PERCENT

    // 2. Processor Fee: 1.95%
    // If 'customer' bears fees -> Added to customer total.
    // If 'organizer' bears fees -> Deducted from organizer payout.
    const processorFee = subtotal * PROCESSOR_FEE_PERCENT

    // clientFees = What the customer sees added to the Ticket Price
    // Always includes Platform Fee. Includes Processor Fee only if Customer bears it.
    const clientFees = platformFee + (feeBearer === 'customer' ? processorFee : 0)

    // customerTotal = Ticket + Client Fees
    const customerTotal = subtotal + clientFees

    // organizerPayout = Ticket - Deductions
    // If Organizer bears fees, Processor Fee is deducted. Platform Fee is never deducted (customer paid it).
    const organizerPayout = subtotal - (feeBearer === 'organizer' ? processorFee : 0)

    return {
        subtotal,
        platformFee,
        processorFee,
        clientFees,
        customerTotal,
        organizerPayout
    }
}
