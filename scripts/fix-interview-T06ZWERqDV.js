// Fix the interview T06ZWERqDV with the correct transcript
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const OpenAI = require('openai').default

async function fixInterview() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const slug = 'T06ZWERqDV'
  const vapiCallId = '019aa3c0-30bd-7aa1-9b4c-9a7c4ea93c58'

  console.log('Fetching transcript from Vapi...\n')

  // Fetch from Vapi
  const vapiResponse = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`
    }
  })

  if (!vapiResponse.ok) {
    console.error('Failed to fetch from Vapi:', vapiResponse.status)
    return
  }

  const callData = await vapiResponse.json()
  console.log('✓ Call data received')

  // Extract transcript
  let transcript = ''
  if (callData.artifact?.messages) {
    transcript = callData.artifact.messages
      .map(msg => `${msg.role}: ${msg.content || msg.message}`)
      .join('\n\n')
  }

  console.log('✓ Transcript extracted, length:', transcript.length)
  console.log('\nTranscript preview:')
  console.log(transcript.substring(0, 300) + '...\n')

  // Get interview and role details
  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select(`
      id,
      role_id,
      roles (
        title,
        jd_text
      )
    `)
    .eq('slug', slug)
    .single()

  if (interviewError) {
    console.error('Error fetching interview:', interviewError)
    return
  }

  // Get questions
  const { data: questions } = await supabase
    .from('questions')
    .select('text, order_index')
    .eq('role_id', interview.role_id)
    .order('order_index')

  console.log('Generating evaluation with OpenAI...')

  // Generate evaluation
  const evaluation = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert interviewer evaluating a candidate's interview performance.

Role: ${interview.roles?.title || 'N/A'}
Job Description: ${interview.roles?.jd_text || 'N/A'}

Questions Asked:
${questions?.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

Analyze the transcript and provide a structured evaluation.

Return ONLY a JSON object in this exact format (no markdown, no extra text):
{
  "score": <number 0-100>,
  "recommendation": "<strong yes|yes|no|strong no>",
  "reasons_to_proceed": [
    "<bullet point 1>",
    "<bullet point 2>"
  ],
  "flags_risks": [
    "<concern 1>",
    "<concern 2>"
  ],
  "question_evaluations": [
    {
      "question": "<question text>",
      "evaluation": "<2-3 sentence summary of performance>"
    }
  ]
}

IMPORTANT:
- recommendation must be exactly one of: "strong yes", "yes", "no", "strong no"
- reasons_to_proceed: maximum 5 clear, specific points
- flags_risks: only include genuine concerns, can be empty array [] if none
- question_evaluations: one entry per question with concise performance summary`,
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
    console.error('No evaluation generated')
    return
  }

  const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const evaluationData = JSON.parse(cleanContent)

  console.log('✓ Evaluation generated')
  console.log('Score:', evaluationData.score)
  console.log('Recommendation:', evaluationData.recommendation)

  // Update database
  const { error: updateError } = await supabase
    .from('interviews')
    .update({
      transcript: { text: transcript },
      score: evaluationData.score,
      recommendation: evaluationData.recommendation,
      structured_evaluation: evaluationData,
      vapi_call_id: vapiCallId,
    })
    .eq('slug', slug)

  if (updateError) {
    console.error('Error updating database:', updateError)
    return
  }

  console.log('\n✓ Interview updated successfully!')
  console.log('\nYou can now view it at: http://localhost:3000/interview/' + slug)
}

fixInterview().catch(console.error)
