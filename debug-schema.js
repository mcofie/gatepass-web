const fs = require('fs')
const path = require('path')

try {
    const envConfig = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) {
            process.env[key.trim()] = value.trim()
        }
    })
} catch (e) {
    console.error('Could not read .env.local', e)
}

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    console.log('Checking reservations table...')

    // Try to insert a dummy record with discount_id to see if it errors
    // actually, simpler: just select it from a limit 1
    const { data, error } = await supabase
        .schema('gatepass')
        .from('reservations')
        .select('discount_id')
        .limit(1)

    if (error) {
        console.error('Error selecting discount_id:', error)
    } else {
        console.log('Successfully selected discount_id column. Data:', data)
    }
}

checkSchema()
