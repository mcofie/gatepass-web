import { createAdminClient } from '@/utils/supabase/admin'
import { formatCurrency } from '@/utils/format'
import { getManagedTerms } from '@/lib/payments/managed'
import { PayoutActions, TrustToggle } from '@/components/admin/PayoutActions'

/* eslint-disable @typescript-eslint/no-explicit-any -- joined rows */

export const dynamic = 'force-dynamic'

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default async function PayoutsPage() {
    // Access is checked in the admin layout
    const db = createAdminClient().schema('gatepass')
    const now = new Date().toISOString()
    const [terms, { data: reserves }, { data: accounts }] = await Promise.all([
        getManagedTerms(),
        db.from('payment_reserves').select('*, events(title), organizers(name)').order('release_after', { ascending: true }).limit(300),
        db.from('organizer_payout_accounts').select('organizer_id, bank_name, account_name, account_number, account_type, trust_level, organizers(name)').order('created_at', { ascending: false }),
    ])

    const accountFor = new Map((accounts ?? []).map((a: any) => [a.organizer_id, a]))
    const due = (reserves ?? []).filter((r: any) => ['held', 'failed'].includes(r.status) && r.release_after <= now)
    const upcoming = (reserves ?? []).filter((r: any) => (r.status === 'held' && r.release_after > now) || r.status === 'on_hold')
    const released = (reserves ?? []).filter((r: any) => r.status === 'released').slice(-20).reverse()
    const total = (rows: any[]) => rows.reduce((sum, r) => sum + Number(r.amount_minor), 0)

    const renderRow = (r: any, actions: boolean) => {
        const account: any = accountFor.get(r.organizer_id)
        return (
            <li key={r.reference} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-950 dark:text-white">{r.organizers?.name ?? 'Organizer'} · {r.events?.title ?? 'Event'}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {account ? `${account.bank_name} · ${account.account_name} · ${account.account_number}` : 'No payout account'}
                        {' · '}{r.status === 'on_hold' ? 'Paused' : r.status === 'released' ? `Released ${r.released_at ? when(r.released_at) : ''}` : `Due ${when(r.release_after)}`}
                        {r.failure_reason ? ` · ${r.failure_reason}` : ''}
                    </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-gray-950 dark:text-white">{formatCurrency(Number(r.amount_minor) / 100, r.currency)}</p>
                {actions && <PayoutActions reference={r.reference} status={r.status} />}
            </li>
        )
    }

    const renderSection = (title: string, rows: any[], actions: boolean, empty: string) => (
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10 sm:px-6">
                <h2 className="text-base font-semibold text-gray-950 dark:text-white">{title}</h2>
                <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">{rows.length ? formatCurrency(total(rows) / 100, rows[0].currency) : ''}</span>
            </div>
            {rows.length ? <ul className="divide-y divide-gray-100 dark:divide-white/10">{rows.map(r => renderRow(r, actions))}</ul> : <p className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{empty}</p>}
        </section>
    )

    return (
        <div className="space-y-8 pb-8">
            <header>
                <h1 className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-gray-950 dark:text-white sm:text-[44px]">Payouts</h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    GatePass Payments: {terms.feePercent}% per ticket, and {terms.reservePercent}% of each sale from new organizers held until {terms.releaseHours} hours after their event.
                    Pay due holds from the Paystack dashboard (Transfers), then mark them released here.
                </p>
            </header>

            {renderSection('Due for release', due, true, 'Nothing due right now.')}
            {renderSection('Held', upcoming, true, 'No holds waiting on an event.')}

            <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
                <div className="border-b border-gray-100 px-5 py-4 dark:border-white/10 sm:px-6">
                    <h2 className="text-base font-semibold text-gray-950 dark:text-white">Organizers on GatePass Payments</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Trusted organizers have nothing held from new sales.</p>
                </div>
                {accounts?.length ? (
                    <ul className="divide-y divide-gray-100 dark:divide-white/10">
                        {accounts.map((a: any) => (
                            <li key={a.organizer_id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-950 dark:text-white">{a.organizers?.name ?? 'Organizer'}</p>
                                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{a.bank_name} · {a.account_name} · ••••{String(a.account_number).slice(-4)}</p>
                                </div>
                                <TrustToggle organizerId={a.organizer_id} trusted={a.trust_level === 'trusted'} />
                            </li>
                        ))}
                    </ul>
                ) : <p className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No organizers have set up GatePass Payments yet.</p>}
            </section>

            {renderSection('Recently released', released, false, 'Nothing released yet.')}
        </div>
    )
}
