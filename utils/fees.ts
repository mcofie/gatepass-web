export const PLATFORM_FEE_PERCENT = 0.04
export const PROCESSOR_FEE_PERCENT = 0.0195

/**
 * Resolves the effective fee rates for a specific event, prioritizing event-specific overrides
 * over global settings, and falling back to system defaults.
 */
export const getEffectiveFeeRates = (
    globalRates?: FeeRates,
    eventOverride?: { platform_fee_percent?: number | null },
    organizerOverride?: { platform_fee_percent?: number | null }
): FeeRates => {
    // 1. Determine Platform Fee
    // Precedence: Event Override > Organizer Override > Global Setting > Default
    let platformRate = PLATFORM_FEE_PERCENT

    if (eventOverride?.platform_fee_percent !== undefined && eventOverride.platform_fee_percent !== null) {
        platformRate = eventOverride.platform_fee_percent
    } else if (organizerOverride?.platform_fee_percent !== undefined && organizerOverride.platform_fee_percent !== null) {
        platformRate = organizerOverride.platform_fee_percent
    } else if (globalRates?.platformFeePercent) {
        platformRate = globalRates.platformFeePercent
    }

    // 2. Determine Processor Fee
    // Currently only global or default (no event-specific override supported yet)
    const processorRate = (typeof globalRates?.processorFeePercent === 'number')
        ? globalRates.processorFeePercent
        : PROCESSOR_FEE_PERCENT

    return {
        platformFeePercent: platformRate,
        processorFeePercent: processorRate
    }
}

interface FeeResult {
    subtotal: number
    platformFee: number // 4%, always absorbed in ticket price (customer perspective) or deducted (organizer perspective)
    processorFee: number // 1.95%, added to total if customer bears, or deducted from payout if organizer bears
    clientFees: number // Total fees paid by customer
    customerTotal: number // What the customer pays
    organizerPayout: number // What the organizer gets (Net)
}

export interface FeeRates {
    platformFeePercent: number
    processorFeePercent: number
}

export const calculateFees = (
    ticketSubtotal: number,
    addonSubtotal: number = 0,
    feeBearer: 'customer' | 'organizer' = 'customer',
    rates?: FeeRates
): FeeResult => {
    // defaults
    // defaults - Ensure we default if rates provided but contain undefined/null/NaN
    const rawPlatform = rates?.platformFeePercent
    const platformRate = (typeof rawPlatform === 'number' && !isNaN(rawPlatform))
        ? rawPlatform
        : PLATFORM_FEE_PERCENT

    const rawProcessor = rates?.processorFeePercent
    const processorRate = (typeof rawProcessor === 'number' && !isNaN(rawProcessor))
        ? rawProcessor
        : PROCESSOR_FEE_PERCENT

    const combinedSubtotal = ticketSubtotal + addonSubtotal

    // 1. Platform Fee (Applies ONLY to Ticket Revenue)
    const platformFee = ticketSubtotal * platformRate

    // 2. Processor Fee Calculation
    // IMPORTANT: Paystack charges their fee on the GROSS payment amount (total customer pays),
    // not on the base subtotal. We need to calculate it correctly to avoid shortfall.
    // 
    // If customer bears fees:
    //   - Customer pays: subtotal + platformFee + processorFee
    //   - Paystack charges: (subtotal + platformFee + processorFee) * processorRate
    //   - To solve for processorFee: pf = (subtotal + platformFee + pf) * rate
    //   - pf = (subtotal + platformFee) * rate + pf * rate
    //   - pf - pf * rate = (subtotal + platformFee) * rate
    //   - pf * (1 - rate) = (subtotal + platformFee) * rate
    //   - pf = (subtotal + platformFee) * rate / (1 - rate)
    //
    // If organizer bears fees:
    //   - Customer pays: subtotal only
    //   - Paystack charges on subtotal (deducted from organizer)
    //   - processorFee = subtotal * rate

    let processorFee: number
    if (feeBearer === 'customer') {
        // Gross-up calculation: processor fee on gross amount (including itself)
        const baseForProcessorFee = combinedSubtotal + platformFee
        processorFee = (baseForProcessorFee * processorRate) / (1 - processorRate)
    } else {
        // Organizer bears: simple calculation on base
        processorFee = combinedSubtotal * processorRate
    }

    // clientFees = What the customer sees added to the Ticket Price
    // Always includes Platform Fee. Includes Processor Fee only if Customer bears it.
    const clientFees = platformFee + (feeBearer === 'customer' ? processorFee : 0)

    // customerTotal = Ticket + Addons + Client Fees
    const customerTotal = combinedSubtotal + clientFees

    // organizerPayout = (Tickets + Addons) - Deductions
    // If Organizer bears fees, Processor Fee is deducted. Platform Fee is never deducted (customer paid it effectively via markup, or it's separated at source).
    // Actually, Platform Fee is "deducted" in the sense that the Organizer doesn't receive it.
    // If Fee Bearer is Customer: Organizer gets (Ticket + Addon). (Platform Fee goes to Platform, Processor Fee goes to Processor).
    // If Fee Bearer is Organizer: Organizer gets (Ticket + Addon) - Processor Fee - Platform Fee (if implicit).

    // Let's stick to the Net Payout view:
    // Net = Collected - PlatformFee - ProcessorFee
    // If Customer Pays Fees: Collected = (Ticket+Addon) + PlatformFee + ProcessorFee. 
    //      Net = ((T+A)+PF+PrF) - PF - PrF = T+A. Correct.
    // If Organizer Pays Fees: Collected = (T+A).
    //      Net = (T+A) - PF - PrF. Correct.

    // However, our `organizerPayout` variable usually tracks "What amount is settled to the organizer".
    // Since we use Split Payments/Transaction Charge for Platform Fee, that amount never hits the Organizer's balance if handled correctly.

    const organizerPayout = combinedSubtotal - (feeBearer === 'organizer' ? processorFee : 0)

    return {
        subtotal: combinedSubtotal,
        platformFee,
        processorFee,
        clientFees,
        customerTotal,
        organizerPayout
    }
}
