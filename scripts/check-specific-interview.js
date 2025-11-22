// Script to check specific interview data for debugging
const { createClient } = require('@supabase/supabase-js')

async function checkInterview() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const slug = 'iMeBRpzwjz'

  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('\n=== Interview Data ===')
  console.log('Interview ID:', data.id)
  console.log('Slug:', data.slug)
  console.log('Status:', data.status)
  console.log('Created At:', data.created_at)
  console.log('Started At:', data.started_at)
  console.log('Completed At:', data.completed_at)
  console.log('Duration (seconds):', data.duration_seconds)
  console.log('Score:', data.score)
  console.log('Recommendation:', data.recommendation)
  console.log('\n=== Vapi Call ID ===')
  console.log('Vapi Call ID:', data.vapi_call_id)
  console.log('Has vapi_call_id:', !!data.vapi_call_id)
  console.log('\n=== Transcript Data ===')
  console.log('Transcript type:', typeof data.transcript)
  console.log('Transcript:', JSON.stringify(data.transcript, null, 2))
  console.log('\n=== Analysis ===')

  if (!data.vapi_call_id) {
    console.log('❌ ISSUE: No vapi_call_id stored - call ID was never captured')
  } else {
    console.log('✅ Vapi call ID present:', data.vapi_call_id)
  }

  if (!data.transcript || (typeof data.transcript === 'object' && data.transcript.text === 'Transcript not available')) {
    console.log('❌ ISSUE: No valid transcript available')
  } else if (typeof data.transcript === 'object') {
    console.log('✅ Transcript object present with', data.transcript.messages?.length || 0, 'messages')
  } else {
    console.log('⚠️  Transcript present but in unexpected format')
  }
}

checkInterview().catch(console.error)
