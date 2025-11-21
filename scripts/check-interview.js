// Script to check interview data for debugging
const { createClient } = require('@supabase/supabase-js')

async function checkInterview() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const candidateId = '3a2a9031-c6d5-436d-855a-bac86dbe1c91'

  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('candidate_id', candidateId)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('\nInterview Data:')
  console.log('================')
  data.forEach(interview => {
    console.log('\nInterview ID:', interview.id)
    console.log('Status:', interview.status)
    console.log('Started At:', interview.started_at)
    console.log('Completed At:', interview.completed_at)
    console.log('Score:', interview.score)
    console.log('Recommendation Length:', interview.recommendation?.length || 0)
    console.log('Transcript:', interview.transcript)
    console.log('Vapi Call ID:', interview.vapi_call_id)
    console.log('---')
  })
}

checkInterview().catch(console.error)
