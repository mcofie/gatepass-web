import { FinanceDashboard } from '@/components/admin/FinanceDashboard'
import { getFeeSettings } from '@/utils/settings'

export default async function FinancialsPage() {
    const feeSettings = await getFeeSettings()
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Pass adminMode=true to FinanceDashboard to fetch global stats */}
            <FinanceDashboard adminMode={true} feeRates={feeSettings} />
        </div>
    )
}
