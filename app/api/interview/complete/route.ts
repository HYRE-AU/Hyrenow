import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError } from '@/lib/errorLogger'

export async function POST(request: Request) {
  let slug: string | undefined
  let vapiCallId: string | undefined
  let interviewId: string | undefined

  try {
    const body = await request.json()
    slug = body.slug
    vapiCallId = body.vapiCallId

    console.log('📥 Interview completion request:', { slug, vapiCallId })

    if (!slug) {
      await logError({
        endpoint: '/api/interview/complete',
        errorType: 'validation_error',
        errorMessage: 'No interview slug provided',
        requestBody: { vapiCallId }
      })
      return NextResponse.json({ error: 'Interview slug is required' }, { status: 400 })
    }

    if (!vapiCallId) {
      console.error('❌ CRITICAL: No vapiCallId received! Cannot fetch transcript.')
      await logError({
        endpoint: '/api/interview/complete',
        errorType: 'missing_vapi_call_id',
        errorMessage: 'No vapiCallId received - transcript fetch will fail',
        interviewSlug: slug
      })
    } else {
      console.log('✅ Valid vapiCallId received:', vapiCallId)
    }

    // Fetch transcript from Vapi API
    let transcript = 'Transcript not available'
    let messages: any[] = []
    let recordingUrl: string | null = null

    if (vapiCallId) {
      try {
        console.log('🔍 Fetching transcript from Vapi for call:', vapiCallId)
        const vapiResponse = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`
          }
        })

        if (vapiResponse.ok) {
          const callData = await vapiResponse.json()
          console.log('✅ Vapi call data received successfully')

          // Extract recording URL
          if (callData.artifact?.recordingUrl) {
            recordingUrl = callData.artifact.recordingUrl
            console.log('🎙️ Found recording URL in artifact')
          } else if (callData.recordingUrl) {
            recordingUrl = callData.recordingUrl
            console.log('🎙️ Found recording URL at top level')
          }

          // Extract messages with timestamps
          if (callData.artifact?.messages) {
            messages = callData.artifact.messages
            console.log('📝 Found messages in callData.artifact.messages')
          } else if (callData.messages) {
            messages = callData.messages
            console.log('📝 Found messages in callData.messages')
          }

          // Build text transcript
          if (messages.length > 0) {
            transcript = messages
              .map((msg: any) => `[${msg.time || msg.timestamp || 'unknown'}] ${msg.role}: ${msg.content || msg.message}`)
              .join('\n\n')
            console.log('✅ Built transcript from messages. Messages:', messages.length, 'Transcript length:', transcript.length)
          } else if (callData.transcript) {
            transcript = callData.transcript
            console.log('✅ Used callData.transcript directly. Length:', transcript.length)
          } else {
            console.warn('⚠️ No messages or transcript found in Vapi response')
          }
        } else {
          const errorBody = await vapiResponse.text()
          console.error('❌ Failed to fetch from Vapi. Status:', vapiResponse.status, 'StatusText:', vapiResponse.statusText)
          console.error('Error response:', errorBody)
          await logError({
            endpoint: '/api/interview/complete',
            errorType: 'vapi_fetch_failed',
            errorMessage: `Vapi API returned ${vapiResponse.status}: ${errorBody.slice(0, 500)}`,
            interviewSlug: slug,
            requestBody: { vapiCallId }
          })
        }
      } catch (vapiError: any) {
        console.error('❌ Error fetching transcript from Vapi:', vapiError)
        await logError({
          endpoint: '/api/interview/complete',
          errorType: 'vapi_fetch_exception',
          errorMessage: vapiError.message || 'Unknown Vapi fetch error',
          errorStack: vapiError.stack,
          interviewSlug: slug,
          requestBody: { vapiCallId }
        })
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get interview details
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('id, role_id, started_at')
      .eq('slug', slug)
      .single()

    if (interviewError || !interview) {
      await logError({
        endpoint: '/api/interview/complete',
        errorType: 'interview_not_found',
        errorMessage: interviewError?.message || `Interview not found for slug: ${slug}`,
        interviewSlug: slug,
        requestBody: { vapiCallId }
      })
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    interviewId = interview.id

    // Calculate interview duration
    let durationSeconds = null
    if (interview.started_at) {
      const startTime = new Date(interview.started_at)
      const endTime = new Date()
      durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      console.log('Interview duration:', durationSeconds, 'seconds')
    }

    // Update interview with transcript, duration, and recording URL
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        transcript: { text: transcript, messages: messages },
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        vapi_call_id: vapiCallId,
        recording_url: recordingUrl,
        status: 'completed'
      })
      .eq('id', interview.id)

    if (updateError) {
      await logError({
        endpoint: '/api/interview/complete',
        errorType: 'interview_update_failed',
        errorMessage: updateError.message,
        interviewId: interview.id,
        interviewSlug: slug
      })
      return NextResponse.json({ error: 'Failed to save interview data' }, { status: 500 })
    }

    console.log('✅ Interview data saved - waiting for Vapi webhook to trigger evaluation')
    console.log('Interview completed successfully for slug:', slug)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Interview completion error:', error)

    await logError({
      endpoint: '/api/interview/complete',
      errorType: 'complete_exception',
      errorMessage: error.message || 'Unknown completion error',
      errorStack: error.stack,
      interviewId,
      interviewSlug: slug,
      requestBody: { vapiCallId }
    })

    return NextResponse.json(
      { error: error.message || 'Interview completion failed' },
      { status: 500 }
    )
  }
}