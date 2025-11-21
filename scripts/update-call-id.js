require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function updateCallId() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const callId = '019aa377-dc50-7005-b39b-c13bf910f314'
  
  const { data, error } = await supabase
    .from('interviews')
    .update({ vapi_call_id: callId })
    .eq('status', 'completed')
    .eq('candidate_id', (await supabase
      .from('candidates')
      .select('id')
      .eq('email', 'bella@gmail.com')
      .single()).data.id)
    .select()

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('✓ Updated interview with Vapi call ID:', callId)
  console.log('Interview ID:', data[0]?.id)
}

updateCallId().catch(console.error)
