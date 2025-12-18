const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function debug() {
  const { data, error } = await supabase.schema('gatepass').from('transactions').select('*').limit(1)
  if (data && data.length > 0) {
    console.log('Columns in transactions:', Object.keys(data[0]))
  } else {
    console.log('No data found in transactions to infer columns.')
  }
}
debug()
