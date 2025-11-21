// Check all completed interviews for missing transcripts
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

async function checkCompletedInterviews() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const { data, error } = await supabase
    .from('interviews')
    .select('slug, status, vapi_call_id, transcript, completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Completed Interviews:')
  console.log('====================\n')

  let needsFixing = []

  data.forEach(interview => {
    const hasValidTranscript = interview.transcript?.text && interview.transcript.text !== 'Transcript not available'
    const hasCallId = interview.vapi_call_id !== null

    console.log('Slug:', interview.slug)
    console.log('Vapi Call ID:', interview.vapi_call_id || 'MISSING')
    console.log('Has Valid Transcript:', hasValidTranscript ? 'Yes' : 'NO')
    console.log('Completed:', interview.completed_at)

    if (!hasValidTranscript || !hasCallId) {
      needsFixing.push(interview.slug)
      console.log('⚠️  NEEDS FIXING')
    } else {
      console.log('✓ OK')
    }
    console.log('---\n')
  })

  if (needsFixing.length > 0) {
    console.log('Interviews that need fixing:', needsFixing.join(', '))
  } else {
    console.log('✅ All completed interviews are OK!')
  }
}

checkCompletedInterviews().catch(console.error)
