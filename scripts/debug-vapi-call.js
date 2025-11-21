// Debug script to fetch and analyze Vapi call data
require('dotenv').config({ path: '.env.local' })

async function debugVapiCall() {
  const vapiCallId = '019aa3c0-30bd-7aa1-9b4c-9a7c4ea93c58'

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
  console.log('Call Data Keys:', Object.keys(callData))
  console.log('\nCall ID field:', callData.id)
  console.log('Status:', callData.status)
  console.log('Created:', callData.createdAt)
  console.log('\nChecking for transcript in different locations...\n')

  if (callData.artifact?.messages) {
    console.log('✓ Found in callData.artifact.messages')
    console.log('Message count:', callData.artifact.messages.length)
  }
  if (callData.messages) {
    console.log('✓ Found in callData.messages')
    console.log('Message count:', callData.messages.length)
  }
  if (callData.transcript) {
    console.log('✓ Found in callData.transcript')
  }

  // Extract transcript
  let transcript = ''
  if (callData.artifact?.messages) {
    transcript = callData.artifact.messages
      .map(msg => `${msg.role}: ${msg.content || msg.message}`)
      .join('\n\n')
  }

  console.log('\nTranscript length:', transcript.length)
  console.log('\nFirst 500 chars:')
  console.log(transcript.substring(0, 500))
}

debugVapiCall().catch(console.error)
