import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { logError } from '@/lib/errorLogger'
import { getAuthenticatedUserWithProfile } from '@/lib/auth'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  let interviewId: string | undefined

  try {
    // Require authentication - this is a hiring manager action
    const userWithProfile = await getAuthenticatedUserWithProfile()
    if (!userWithProfile) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }

    const { profile } = userWithProfile
    const body = await request.json()
    interviewId = body.interviewId
    const { candidateName, candidateEmail, roleTitle, companyName } = body

    // Validate required fields
    if (!interviewId) {
      return NextResponse.json(
        { error: 'Interview ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get interview evaluation and verify ownership
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('structured_evaluation, recommendation, org_id')
      .eq('id', interviewId)
      .single()

    if (fetchError || !interview) {
      await logError({
        endpoint: '/api/interview/reject',
        errorType: 'interview_not_found',
        errorMessage: `Interview not found: ${interviewId}`,
        interviewId
      })
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }

    // Verify organization ownership
    if (interview.org_id !== profile.org_id) {
      await logError({
        endpoint: '/api/interview/reject',
        errorType: 'unauthorized_access',
        errorMessage: `User org ${profile.org_id} attempted to reject interview from org ${interview.org_id}`,
        interviewId
      })
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }

    // Generate personalized rejection reason using AI
    let rejectionReason = 'We felt other candidates were a closer match for this particular role.'
    
    if (interview?.structured_evaluation || interview?.recommendation) {
      try {
        const evaluationContext = interview.structured_evaluation 
          ? JSON.stringify(interview.structured_evaluation)
          : interview.recommendation

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Generate a single professional sentence explaining why this candidate wasn't selected, based on their interview evaluation.

IMPORTANT: Address the candidate directly using "you" and "your" (second person) - NOT "the candidate" or "they".

Be tactful, constructive, and brief. Focus on "fit" and "current needs" rather than deficiencies. Keep it under 25 words.

Example good output: "While you showed enthusiasm, we're looking for someone with more hands-on experience in this specific area."
Example bad output: "The candidate lacked the required experience." (Don't use third person)`
            },
            {
              role: 'user',
              content: `Interview evaluation: ${evaluationContext}\n\nGenerate ONE tactful sentence addressed directly to the candidate (using "you/your") for why they weren't selected.`
            }
          ],
          temperature: 0.7,
          max_tokens: 100
        })

        rejectionReason = completion.choices[0].message.content?.trim() || rejectionReason
      } catch (aiError) {
        console.error('AI generation failed, using default reason:', aiError)
      }
    }

    // Create email body
    const firstName = candidateName.split(' ')[0]
    const emailBody = `Hi ${firstName},

Thanks again for taking the time to interview for the ${roleTitle} position and for your interest in ${companyName}.

After careful consideration, we've decided to move forward with other candidates whose experience is a closer match to our current needs. ${rejectionReason} This role was competitive, which made the decision particularly difficult.

We genuinely appreciate the effort you put into the process and the interest you've shown in joining our team. Please don't hesitate to reapply for future opportunities that align with your skills and experience. We'd be happy to review your profile again.

Best regards,
The ${companyName} Team`

    // Update interview status
    await supabase
      .from('interviews')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString()
      })
      .eq('id', interviewId)

    return NextResponse.json({ 
      success: true,
      emailBody,
      subject: `${roleTitle} - Application Update`
    })
  } catch (error: any) {
    console.error('Rejection error:', error)

    await logError({
      endpoint: '/api/interview/reject',
      errorType: 'reject_exception',
      errorMessage: error.message || 'Failed to reject interview',
      errorStack: error.stack,
      interviewId
    })

    return NextResponse.json(
      { error: error.message || 'Failed to reject interview' },
      { status: 500 }
    )
  }
}