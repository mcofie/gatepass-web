import { FinanceDashboard } from '@/components/admin/FinanceDashboard'

export default function FinancialsPage() {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Pass adminMode=true to FinanceDashboard to fetch global stats */}
            <FinanceDashboard adminMode={true} />
        </div>
    )
}
