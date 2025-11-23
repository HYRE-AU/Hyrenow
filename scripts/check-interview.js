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

  for (const interview of data) {
    console.log('\n=== Interview ID:', interview.id, '===')
    console.log('Status:', interview.status)
    console.log('Started At:', interview.started_at)
    console.log('Completed At:', interview.completed_at)
    console.log('Score:', interview.score)
    console.log('Recommendation:', interview.recommendation)
    console.log('Transcript available:', interview.transcript ? 'Yes' : 'No')
    console.log('Vapi Call ID:', interview.vapi_call_id)

    console.log('\n--- Structured Evaluation ---')
    if (interview.structured_evaluation) {
      console.log('Has structured_evaluation: YES')
      console.log(JSON.stringify(interview.structured_evaluation, null, 2))
    } else {
      console.log('Has structured_evaluation: NO')
    }

    // Check question evaluations for this interview
    const { data: evaluations } = await supabase
      .from('question_evaluations')
      .select('*')
      .eq('interview_id', interview.id)

    console.log('\n--- Question Evaluations ---')
    console.log('Count:', evaluations?.length || 0)

    // Check screening summaries
    const { data: summaries } = await supabase
      .from('screening_summaries')
      .select('*')
      .eq('interview_id', interview.id)

    console.log('\n--- Screening Summaries ---')
    console.log('Count:', summaries?.length || 0)

    console.log('\n' + '='.repeat(60))
  }
}

checkInterview().catch(console.error)
