const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function debug() {
  const { data, error } = await supabase.schema('gatepass').from('transactions').select('*').limit(1)
  console.log('TX Data:', data)
  console.log('TX Error:', error)
}
debug()
