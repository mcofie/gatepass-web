
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function test() {
    const ref = process.argv[2]
    if (!ref) {
        console.error('Please provide reference')
        return
    }

    console.log(`Fetching transaction with reference: ${ref}`)
    const { data: tx, error } = await supabase
        .schema('gatepass')
        .from('transactions')
        .select(`
            id,
            amount,
            platform_fee,
            applied_processor_fee,
            reference,
            created_at,
            reservations (
                id,
                quantity,
                addons,
                ticket_tiers ( name, price ),
                events ( title, fee_bearer, platform_fee_percent )
            )
        `)
        .or(`reference.eq.${ref},id.eq.${ref}`)
        .single()

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log('Transaction:', JSON.stringify(tx, null, 2))
}

test()
