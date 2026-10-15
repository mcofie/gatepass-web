'use client'

import { useMemo, useState } from 'react'
import { PRICE_CURRENCIES, priceIn } from '@/lib/billing/prices'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'

type Plan = { name: string; max_tickets: number | null; price_minor: number; currency: string; prices: Record<string, number> | null }

/** Plan list with a currency switcher; only currencies priced for every paid plan are offered. */
export function PlanPrices({ tiers }: { tiers: Plan[] }) {
    const base = tiers[0]?.currency ?? 'GHS'
    const currencies = useMemo(
        () => PRICE_CURRENCIES.filter(c => tiers.every(t => t.price_minor === 0 || priceIn(t, c) !== null)),
        [tiers],
    )
    const [currency, setCurrency] = useState<string>(base)

    return (
        <div>
            {currencies.length > 1 && (
                <div role="radiogroup" aria-label="Currency" className="mb-4 flex flex-wrap gap-1.5">
                    {currencies.map(c => (
                        <button
                            key={c}
                            type="button"
                            role="radio"
                            aria-checked={currency === c}
                            onClick={() => setCurrency(c)}
                            className={cn('h-8 rounded-full px-3.5 text-[12px] font-semibold transition-colors', currency === c ? 'bg-white text-black' : 'border border-white/20 text-white/70 hover:text-white')}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}
            <div className="divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/15">
                {tiers.map((tier, index) => {
                    const amount = priceIn(tier, currency) ?? tier.price_minor
                    const shown = priceIn(tier, currency) !== null ? currency : tier.currency
                    return (
                        <div key={tier.name} className="flex items-center justify-between gap-4 px-6 py-5">
                            <div>
                                <p className="text-[16px] font-semibold">{tier.name}</p>
                                <p className="mt-0.5 text-[13px] text-white/50">
                                    {tier.max_tickets === null
                                        ? `${((tiers[index - 1]?.max_tickets ?? 0) + 1).toLocaleString()}+ tickets`
                                        : `Up to ${tier.max_tickets.toLocaleString()} tickets`}
                                </p>
                            </div>
                            <p className="text-[22px] font-semibold tabular-nums tracking-[-0.03em]">{tier.price_minor === 0 ? 'Free' : formatCurrency(amount / 100, shown)}</p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
