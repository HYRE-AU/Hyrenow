import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { slug, vapiCallId } = await request.json()

    console.log('Interview completion request:', { slug, vapiCallId })

    // Fetch transcript and timing from Vapi API
    let transcript = 'Transcript not available'
    let messages: any[] = []
    
    if (vapiCallId) {
      try {
        console.log('Fetching transcript from Vapi for call:', vapiCallId)
        const vapiResponse = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`
          }
        })

        if (vapiResponse.ok) {
          const callData = await vapiResponse.json()
          console.log('Vapi call data received')

          // Extract messages with timestamps
          if (callData.artifact?.messages) {
            messages = callData.artifact.messages
          } else if (callData.messages) {
            messages = callData.messages
          }

          // Build text transcript
          if (messages.length > 0) {
            transcript = messages
              .map((msg: any) => `[${msg.time || msg.timestamp || 'unknown'}] ${msg.role}: ${msg.content || msg.message}`)
              .join('\n\n')
          } else if (callData.transcript) {
            transcript = callData.transcript
          }

          console.log('Extracted messages:', messages.length, 'transcript length:', transcript.length)
        } else {
          console.error('Failed to fetch from Vapi:', vapiResponse.status)
        }
      } catch (vapiError) {
        console.error('Error fetching transcript from Vapi:', vapiError)
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get interview details with started_at for duration calculation
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select(`
        id,
        role_id,
        started_at,
        roles (
          title,
          jd_text
        )
      `)
      .eq('slug', slug)
      .single()

    if (interviewError) throw interviewError

    // Calculate interview duration
    let durationSeconds = null
    if (interview.started_at) {
      const startTime = new Date(interview.started_at)
      const endTime = new Date()
      durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      console.log('Interview duration:', durationSeconds, 'seconds')
    }

    // Get questions for this role
    const { data: questions } = await supabase
      .from('questions')
      .select('text, order_index')
      .eq('role_id', interview.role_id)
      .order('order_index')

    // Calculate actual answer durations from message timestamps
    const questionTimings = calculateQuestionTimings(messages, questions || [])
    console.log('Question timings:', questionTimings)

    // Generate evaluation using OpenAI
    const evaluation = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert interviewer evaluating a candidate's interview performance.

Role: ${(interview.roles as any)?.title || 'N/A'}
Job Description: ${(interview.roles as any)?.jd_text || 'N/A'}

Questions Asked:
${questions?.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

Question Timings (actual seconds per answer):
${questionTimings.map((qt, i) => `Q${i + 1}: ${qt.duration}s`).join('\n')}

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
      "evaluation": "<2-3 sentence summary of performance>",
      "answer_duration_seconds": <use the actual timing provided above>
    }
  ]
}

IMPORTANT:
- recommendation must be exactly one of: "strong yes", "yes", "no", "strong no"
- reasons_to_proceed: maximum 5 clear, specific points
- flags_risks: only include genuine concerns, can be empty array [] if none
- question_evaluations: one entry per question with concise performance summary
- answer_duration_seconds: use the EXACT timings provided above, not estimates`,
        },
        {
          role: 'user',
          content: `Interview Transcript:\n\n${transcript}`,
        },
      ],
      temperature: 0.3,
    })

    const content = evaluation.choices[0].message.content
    if (!content) throw new Error('No evaluation generated')

    // Parse the evaluation
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    console.log('OpenAI response received')

    const evaluationData = JSON.parse(cleanContent)
    console.log('Parsed evaluation:', { 
      score: evaluationData.score, 
      recommendation: evaluationData.recommendation,
      duration: durationSeconds 
    })

    // Update interview in database
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        transcript: { text: transcript, messages: messages },
        score: evaluationData.score,
        recommendation: evaluationData.recommendation,
        structured_evaluation: evaluationData,
        vapi_call_id: vapiCallId,
        duration_seconds: durationSeconds,
      })
      .eq('slug', slug)

    if (updateError) {
      console.error('Database update error:', updateError)
      throw updateError
    }

    console.log('Interview completed successfully for slug:', slug)

    return NextResponse.json({
      success: true,
      ...evaluationData
    })
  } catch (error: any) {
    console.error('Interview completion error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Helper function to calculate actual answer durations from message timestamps
function calculateQuestionTimings(messages: any[], questions: any[]) {
  const timings: Array<{ question: string; duration: number }> = []
  
  if (!messages || messages.length === 0) {
    // Return default timings if no messages
    return questions.map(q => ({ question: q.text, duration: 0 }))
  }

  // Try to parse timestamps and calculate durations
  for (let i = 0; i < messages.length - 1; i++) {
    const currentMsg = messages[i]
    const nextMsg = messages[i + 1]
    
    if (currentMsg.role === 'assistant' && nextMsg.role === 'user') {
      // Assistant asked question, user answered
      const startTime = parseMessageTime(currentMsg)
      const endTime = parseMessageTime(nextMsg)
      
      if (startTime && endTime) {
        const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
        timings.push({
          question: currentMsg.content || currentMsg.message || '',
          duration: Math.max(0, duration)
        })
      }
    }
  }

  // If we couldn't get timings, return defaults
  if (timings.length === 0) {
    return questions.map(q => ({ question: q.text, duration: 0 }))
  }

  return timings
}

function parseMessageTime(message: any): Date | null {
  try {
    if (message.time) return new Date(message.time)
    if (message.timestamp) return new Date(message.timestamp)
    if (message.created_at) return new Date(message.created_at)
    return null
  } catch {
    return null
  }
}