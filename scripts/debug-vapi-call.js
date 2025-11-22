// Debug script to fetch and analyze Vapi call data
require('dotenv').config({ path: '.env.local' })

async function debugVapiCall() {
  const vapiCallId = '019aab87-b333-711d-83b7-9fe869e5e88e' // Most recent call

  console.log('Fetching call data from Vapi...\n')
  const response = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`
    }
  })

  if (!response.ok) {
    console.error('Failed:', response.status)
    return
  }

  const callData = await response.json()

  console.log('=== FULL CALL DATA STRUCTURE ===')
  console.log(JSON.stringify(callData, null, 2))

  console.log('\n=== METADATA CHECK ===')
  console.log('callData.metadata:', callData.metadata)

  console.log('\n=== TRANSCRIPT CHECK ===')
  if (callData.transcript) {
    console.log('✓ Found callData.transcript')
    console.log('Length:', callData.transcript.length)
  }
  if (callData.artifact?.messages) {
    console.log('✓ Found callData.artifact.messages')
    console.log('Count:', callData.artifact.messages.length)
  }
  if (callData.messages) {
    console.log('✓ Found callData.messages')
    console.log('Count:', callData.messages.length)
  }
}

debugVapiCall().catch(console.error)
