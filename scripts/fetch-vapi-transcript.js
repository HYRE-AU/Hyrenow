// Script to retroactively fetch transcript from Vapi and update interview
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const OpenAI = require('openai').default

async function fetchAndUpdateTranscript() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  // Get Bella's completed interview
  const { data: interviews, error: fetchError } = await supabase
    .from('interviews')
    .select(`
      *,
      role:roles(title, jd_text),
      candidate:candidates(name, email)
    `)
    .eq('status', 'completed')

  if (fetchError) {
    console.error('Error fetching interviews:', fetchError)
    return
  }

  console.log(`Found ${interviews.length} completed interview(s)\n`)

  for (const interview of interviews) {
    console.log('---')
    console.log('Processing interview for:', interview.candidate?.name)
    console.log('Role:', interview.role?.title)
    console.log('Current Vapi Call ID:', interview.vapi_call_id)
    console.log('Current Score:', interview.score)

    // Check if we already have a valid transcript
    if (interview.transcript?.text && interview.transcript.text !== 'Transcript not available') {
      console.log('✓ Already has valid transcript, skipping...\n')
      continue
    }

    // Try to get the call ID from the interview
    // Since vapi_call_id is null, we need to check if there's any way to retrieve it
    if (!interview.vapi_call_id) {
      console.log('✗ No Vapi Call ID found. Cannot fetch transcript.')
      console.log('  The call ID was not saved when the interview was completed.\n')
      continue
    }

    // Fetch transcript from Vapi
    try {
      console.log('Fetching call data from Vapi...')
      const vapiResponse = await fetch(`https://api.vapi.ai/call/${interview.vapi_call_id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`
        }
      })

      if (!vapiResponse.ok) {
        console.error('✗ Failed to fetch from Vapi:', vapiResponse.status, await vapiResponse.text())
        continue
      }

      const callData = await vapiResponse.json()
      console.log('✓ Call data received from Vapi')

      // Extract transcript
      let transcript = 'Transcript not available'
      if (callData.artifact?.messages) {
        transcript = callData.artifact.messages
          .map((msg) => `${msg.role}: ${msg.content || msg.message}`)
          .join('\n\n')
      } else if (callData.messages) {
        transcript = callData.messages
          .map((msg) => `${msg.role}: ${msg.content || msg.message}`)
          .join('\n\n')
      } else if (callData.transcript) {
        transcript = callData.transcript
      }

      if (transcript === 'Transcript not available') {
        console.log('✗ No transcript found in Vapi response')
        console.log('Available fields:', Object.keys(callData))
        continue
      }

      console.log('✓ Transcript extracted, length:', transcript.length)
      console.log('\nTranscript preview:')
      console.log(transcript.substring(0, 500) + '...\n')

      // Get questions for re-evaluation
      const { data: questions } = await supabase
        .from('questions')
        .select('text, order_index')
        .eq('role_id', interview.role_id)
        .order('order_index')

      // Re-generate evaluation with actual transcript
      console.log('Generating new evaluation with OpenAI...')
      const evaluation = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert interviewer evaluating a candidate's interview performance.

Role: ${interview.role?.title || 'N/A'}
Job Description: ${interview.role?.jd_text || 'N/A'}

Questions Asked:
${questions?.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

Analyze the transcript and provide:
1. An overall score from 0-100
2. A detailed evaluation covering:
   - Communication skills
   - Relevant experience
   - Technical knowledge
   - Cultural fit
   - Strengths
   - Areas for improvement

Return ONLY a JSON object in this exact format (no markdown, no extra text):
{
  "score": <number 0-100>,
  "evaluation": "<detailed multi-paragraph evaluation>"
}`,
          },
          {
            role: 'user',
            content: `Interview Transcript:\n\n${transcript}`,
          },
        ],
        temperature: 0.3,
      })

      const content = evaluation.choices[0].message.content
      if (!content) {
        console.error('✗ No evaluation generated')
        continue
      }

      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const { score, evaluation: evaluationText } = JSON.parse(cleanContent)

      console.log('✓ New evaluation generated')
      console.log('New Score:', score)
      console.log('Evaluation preview:', evaluationText.substring(0, 200) + '...\n')

      // Update database
      const { error: updateError } = await supabase
        .from('interviews')
        .update({
          transcript: { text: transcript },
          score,
          recommendation: evaluationText,
        })
        .eq('id', interview.id)

      if (updateError) {
        console.error('✗ Error updating database:', updateError)
        continue
      }

      console.log('✓ Interview updated successfully!\n')

    } catch (error) {
      console.error('✗ Error processing interview:', error.message)
    }
  }

  console.log('Done!')
}

fetchAndUpdateTranscript().catch(console.error)
