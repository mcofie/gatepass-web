const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    const { data: user, error: err } = await supabase.auth.admin.getUserById('338c1c0f-175f-4210-986c-7bdcac08069e')
    if (err) {
        console.error('Error:', err)
    } else {
        console.log('User 338c1c0f:', user.user.email)
    }

    // Let's find other users who have tickets
    const { data: tickets, error } = await supabase.schema('gatepass').from('tickets').select('user_id')
    const userIds = [...new Set(tickets.map(t => t.user_id).filter(Boolean))]
    console.log('User IDs with tickets:', userIds)

    // Find emails for these user IDs
    for (const id of userIds.slice(0, 5)) {
        const { data } = await supabase.auth.admin.getUserById(id)
        if (data && data.user) {
            console.log(`- Email: ${data.user.email}, ID: ${id}`)
        }
    }
}

run()
