// Platform fee price points per currency. Safe for the browser: no server imports.

/** Currencies the platform fee has fixed prices in, in display order */
export const PRICE_CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP', 'NGN', 'KES', 'ZAR'] as const

export type TierPrices = {
    price_minor: number
    currency: string
    prices?: Record<string, number> | null
}

/** A tier's fixed price in this currency, or null when none is set. */
export function priceIn(tier: TierPrices, currency: string): number | null {
    const code = currency.toUpperCase()
    if (code === tier.currency.toUpperCase()) return Number(tier.price_minor)
    const value = tier.prices?.[code]
    return value === undefined || value === null ? null : Number(value)
}

/**
 * What to show and what to charge for a tier, given the event's currency and the currencies
 * GatePass's own payment account accepts. Shows the local price when one is set; charges it
 * when the account can take that currency, otherwise charges the base price.
 */
export function resolveTierPrice(tier: TierPrices, eventCurrency: string, chargeable: readonly string[]) {
    const local = priceIn(tier, eventCurrency)
    const display = local !== null
        ? { amountMinor: local, currency: eventCurrency.toUpperCase() }
        : { amountMinor: Number(tier.price_minor), currency: tier.currency.toUpperCase() }
    const charge = chargeable.includes(display.currency)
        ? display
        : { amountMinor: Number(tier.price_minor), currency: tier.currency.toUpperCase() }
    return { display, charge }
}
