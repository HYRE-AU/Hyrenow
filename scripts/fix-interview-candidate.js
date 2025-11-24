/**
 * Script to fix interview candidate association
 * Usage: node scripts/fix-interview-candidate.js <interview_slug> <candidate_email>
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function fixInterviewCandidate(slug, candidateEmail) {
  try {
    // Find the interview
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('id, slug, candidate_id, candidates(name, email)')
      .eq('slug', slug)
      .single()

    if (interviewError || !interview) {
      console.error('❌ Interview not found:', slug)
      return
    }

    console.log('📋 Current interview data:')
    console.log('   Slug:', interview.slug)
    console.log('   Current candidate:', interview.candidates.name, `(${interview.candidates.email})`)
    console.log('')

    // Find the correct candidate
    const { data: correctCandidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id, name, email')
      .eq('email', candidateEmail)
      .single()

    if (candidateError || !correctCandidate) {
      console.error('❌ Candidate not found with email:', candidateEmail)
      return
    }

    console.log('✅ Found correct candidate:')
    console.log('   Name:', correctCandidate.name)
    console.log('   Email:', correctCandidate.email)
    console.log('')

    // Update the interview
    const { error: updateError } = await supabase
      .from('interviews')
      .update({ candidate_id: correctCandidate.id })
      .eq('id', interview.id)

    if (updateError) {
      console.error('❌ Failed to update interview:', updateError.message)
      return
    }

    console.log('✅ Successfully updated interview!')
    console.log('   Interview slug:', slug)
    console.log('   New candidate:', correctCandidate.name, `(${correctCandidate.email})`)
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Get command line arguments
const slug = process.argv[2]
const candidateEmail = process.argv[3]

if (!slug || !candidateEmail) {
  console.log('Usage: node scripts/fix-interview-candidate.js <interview_slug> <candidate_email>')
  console.log('Example: node scripts/fix-interview-candidate.js Tph2X4ARHe belle@example.com')
  process.exit(1)
}

fixInterviewCandidate(slug, candidateEmail)
