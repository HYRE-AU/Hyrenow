// Script to fetch transcript from Vapi API for debugging

async function fetchVapiTranscript() {
  const vapiCallId = '019aab50-ceb9-7667-924f-197c0d70c311'
  const apiKey = process.env.VAPI_PRIVATE_KEY

  if (!apiKey) {
    console.error('❌ VAPI_PRIVATE_KEY not set')
    return
  }

  console.log('\n=== Fetching from Vapi API ===')
  console.log('Call ID:', vapiCallId)
  console.log('API Key present:', !!apiKey)
  console.log('API Key length:', apiKey.length)

  try {
    const url = `https://api.vapi.ai/call/${vapiCallId}`
    console.log('URL:', url)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    console.log('\n=== Response ===')
    console.log('Status:', response.status)
    console.log('Status Text:', response.statusText)
    console.log('Headers:', Object.fromEntries(response.headers.entries()))

    const data = await response.json()

    console.log('\n=== Response Data ===')
    console.log(JSON.stringify(data, null, 2))

    console.log('\n=== Analysis ===')
    console.log('Has artifact:', !!data.artifact)
    console.log('Has artifact.messages:', !!data.artifact?.messages)
    console.log('Has messages:', !!data.messages)
    console.log('Has transcript:', !!data.transcript)
    console.log('artifact.messages count:', data.artifact?.messages?.length || 0)
    console.log('messages count:', data.messages?.length || 0)

    if (data.artifact?.messages) {
      console.log('\n=== Sample Messages ===')
      data.artifact.messages.slice(0, 3).forEach((msg, i) => {
        console.log(`Message ${i + 1}:`, {
          role: msg.role,
          time: msg.time,
          timestamp: msg.timestamp,
          content: msg.content?.substring(0, 100) || msg.message?.substring(0, 100)
        })
      })
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

fetchVapiTranscript().catch(console.error)
