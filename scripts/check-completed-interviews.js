// Script to check all completed interviews
const { createClient } = require('@supabase/supabase-js')

async function checkCompletedInterviews() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const { data, error } = await supabase
    .from('interviews')
    .select(`
      *,
      candidate:candidates(name, email),
      role:roles(title)
    `)
    .eq('status', 'completed')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('\nCompleted Interviews:')
  console.log('=====================')
  console.log('Total:', data.length)
  
  data.forEach(interview => {
    console.log('\n---')
    console.log('Candidate:', interview.candidate?.name, `(${interview.candidate?.email})`)
    console.log('Role:', interview.role?.title)
    console.log('Status:', interview.status)
    console.log('Started At:', interview.started_at)
    console.log('Completed At:', interview.completed_at)
    console.log('Score:', interview.score)
    console.log('Vapi Call ID:', interview.vapi_call_id)
    console.log('Transcript:', JSON.stringify(interview.transcript, null, 2))
    console.log('Recommendation preview:', interview.recommendation?.substring(0, 200))
  })
}

checkCompletedInterviews().catch(console.error)
