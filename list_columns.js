const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function debug() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'transactions' })
  if (error) {
     const { data: d2, error: e2 } = await supabase.from('pg_attribute')
        .select('attname')
        .eq('attrelid', 'gatepass.transactions'::regclass)
     console.log('Columns:', d2)
  } else {
     console.log('Columns:', data)
  }
}
// since I can't easily do raw SQL without a specific RPC, let's just try to fetch 1 row and print it better
async function debug2() {
  const { data, error } = await supabase.schema('gatepass').from('transactions').select('*').limit(1)
  console.log(JSON.stringify({data, error}, null, 2))
}
debug2()
