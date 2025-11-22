require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function checkInterview() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  // Check all interviews
  const { data: allData, error: allError } = await supabase
    .from('interviews')
    .select('slug, status, vapi_call_id, completed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (allError) {
    console.error('Error:', allError)
    return
  }

  console.log('Recent interviews:')
  allData.forEach(i => {
    console.log(`- ${i.slug}: ${i.status} (created: ${i.created_at})`)
  })

  // Check XWEN5mw4at
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('slug', 'XWEN5mw4at')
    .maybeSingle()

  if (error) {
    console.error('\nError:', error)
    return
  }

  if (!data) {
    console.log('\nInterview XWEN5mw4at not found')
    return
  }

  console.log('\nInterview XWEN5mw4at:')
  console.log('Status:', data.status)
  console.log('Transcript:', JSON.stringify(data.transcript, null, 2))
  console.log('Completed at:', data.completed_at)
  console.log('Vapi Call ID:', data.vapi_call_id)
}

checkInterview().catch(console.error)
