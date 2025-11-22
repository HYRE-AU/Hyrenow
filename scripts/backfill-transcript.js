// Backfill transcript for interview XWEN5mw4at
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function backfillTranscript() {
  const slug = 'XWEN5mw4at'
  const vapiCallId = '019aab87-b333-711d-83b7-9fe869e5e88e'

  console.log(`Fetching transcript for ${slug} from Vapi...`)

  // Fetch call data from Vapi
  const response = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`
    }
  })

  if (!response.ok) {
    console.error('Failed to fetch call:', response.status)
    return
  }

  const callData = await response.json()

  console.log('Call data received')
  console.log('Transcript length:', callData.transcript?.length || 0)
  console.log('Messages count:', callData.messages?.length || 0)

  if (!callData.transcript || callData.transcript.length === 0) {
    console.error('No transcript available in Vapi data')
    return
  }

  // Update Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const { error } = await supabase
    .from('interviews')
    .update({
      transcript: { text: callData.transcript }
    })
    .eq('slug', slug)

  if (error) {
    console.error('Failed to update interview:', error)
    return
  }

  console.log('✅ Transcript backfilled successfully!')
}

backfillTranscript().catch(console.error)
