import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { slug, transcript, vapiCallId } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get interview details
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

    if (interviewError) throw interviewError

    // Get questions for this role
    const { data: questions } = await supabase
      .from('questions')
      .select('text, order_index')
      .eq('role_id', interview.role_id)
      .order('order_index')

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
    if (!content) throw new Error('No evaluation generated')

    // Parse the evaluation
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const { score, evaluation: evaluationText } = JSON.parse(cleanContent)

    // Update interview in database
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        transcript,
        score,
        evaluation: evaluationText,
        vapi_call_id: vapiCallId,
      })
      .eq('slug', slug)

    if (updateError) throw updateError

    return NextResponse.json({ 
      success: true, 
      score, 
      evaluation: evaluationText 
    })
  } catch (error: any) {
    console.error('Interview completion error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}