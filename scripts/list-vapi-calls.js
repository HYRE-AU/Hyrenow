// Script to list recent Vapi calls to find missing call IDs
require('dotenv').config({ path: '.env.local' })

async function listVapiCalls() {
  try {
    console.log('Fetching recent calls from Vapi...\n')

    const response = await fetch('https://api.vapi.ai/call', {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`
      }
    })

    if (!response.ok) {
      console.error('Failed to fetch calls:', response.status, await response.text())
      return
    }

    const calls = await response.json()
    console.log(`Found ${calls.length} call(s)\n`)

    // Sort by createdAt descending (most recent first)
    calls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    calls.forEach((call, index) => {
      console.log(`${index + 1}. Call ID: ${call.id}`)
      console.log(`   Created: ${call.createdAt}`)
      console.log(`   Status: ${call.status}`)
      console.log(`   Duration: ${call.duration ? Math.round(call.duration) + 's' : 'N/A'}`)
      console.log(`   Cost: $${call.cost || 'N/A'}`)

      // Check if we have transcript info
      if (call.transcript) {
        console.log(`   Has transcript: Yes`)
      } else if (call.messages?.length > 0) {
        console.log(`   Messages: ${call.messages.length}`)
      } else if (call.artifact?.messages?.length > 0) {
        console.log(`   Artifact messages: ${call.artifact.messages.length}`)
      }
      console.log()
    })

    // If we found calls around the time of Bella's interview
    console.log('\nBella\'s interview completed at: 2025-11-20T22:57:43.827Z')
    console.log('Look for calls around this time to find the matching call ID.')

  } catch (error) {
    console.error('Error fetching calls:', error.message)
  }
}

listVapiCalls().catch(console.error)
