import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { interviewId, candidateName, candidateEmail, roleTitle, companyName } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get interview evaluation
    const { data: interview } = await supabase
      .from('interviews')
      .select('structured_evaluation, recommendation')
      .eq('id', interviewId)
      .single()

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
              content: `Generate a single professional sentence explaining why a candidate wasn't selected, based on their interview evaluation. Be tactful, constructive, and brief. Focus on "fit" and "current needs" rather than deficiencies. Keep it under 25 words.`
            },
            {
              role: 'user',
              content: `Interview evaluation: ${evaluationContext}\n\nGenerate ONE tactful sentence for why this candidate wasn't selected.`
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
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}