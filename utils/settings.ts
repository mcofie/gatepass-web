import { createClient } from '@/utils/supabase/server'
import { PLATFORM_FEE_PERCENT, PROCESSOR_FEE_PERCENT } from '@/utils/fees'

export interface FeeSettings {
    platformFeePercent: number
    processorFeePercent: number
}

export async function getFeeSettings(): Promise<FeeSettings> {
    try {
        const supabase = await createClient()
        const { data } = await supabase
            .schema('gatepass')
            .from('system_settings')
            .select('value')
            .eq('key', 'fees')
            .single()

        if (data && data.value) {
            return {
                platformFeePercent: Number(data.value.platform_fee_percent) || PLATFORM_FEE_PERCENT,
                processorFeePercent: Number(data.value.processor_fee_percent) || PROCESSOR_FEE_PERCENT
            }
        }
    } catch (error) {
        console.warn('Failed to fetch fee settings, using defaults:', error)
    }

    return {
        platformFeePercent: PLATFORM_FEE_PERCENT,
        processorFeePercent: PROCESSOR_FEE_PERCENT
    }
}
