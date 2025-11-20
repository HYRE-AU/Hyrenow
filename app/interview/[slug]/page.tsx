'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Vapi from '@vapi-ai/web'

type Interview = {
  id: string
  status: string
  slug: string
  role: {
    id: string
    title: string
  }
  candidate: {
    name: string
    email: string
  }
  questions: Array<{
    text: string
    order_index: number
  }>
}

export default function InterviewPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle')
  const [vapi, setVapi] = useState<Vapi | null>(null)

  useEffect(() => {
    async function fetchInterview() {
      try {
        const res = await fetch(`/api/interview/${slug}`)
        if (!res.ok) throw new Error('Interview not found')
        const data = await res.json()
        setInterview(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchInterview()

    // Initialize Vapi
    const vapiInstance = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!)
    setVapi(vapiInstance)

    return () => {
      vapiInstance.stop()
    }
  }, [slug])

  async function startInterview() {
    if (!vapi || !interview) return

    setCallState('connecting')

    try {
      // Start Vapi call
      await vapi.start({
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en'
        },
        model: {
          provider: 'openai',
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a professional AI interviewer conducting an interview for the position of ${interview.role.title}.

You will ask the following questions one at a time:
${interview.questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

Ask each question naturally, wait for the candidate's full response, acknowledge their answer briefly, and move to the next question. Be professional, encouraging, and conversational. After all questions, thank them for their time.`
            }
          ]
        },
        voice: {
          provider: '11labs',
          voiceId: 'paula' // Professional female voice
        },
        firstMessage: `Hello ${interview.candidate.name}! Thank you for joining us today for the ${interview.role.title} interview. I'll be asking you ${interview.questions.length} questions. Are you ready to begin?`
      })

      setCallState('active')
    } catch (err: any) {
      console.error('Call failed:', err)
      setError('Failed to start interview. Please try again.')
      setCallState('idle')
    }
  }

  // Vapi event handlers
  useEffect(() => {
    if (!vapi) return

    vapi.on('call-start', () => {
      console.log('Call started')
      setCallState('active')
    })

    vapi.on('call-end', (async (callData: any) => {
      console.log('Call ended', callData)
      setCallState('ended')

      // Get transcript and send to completion endpoint
      const transcript = callData?.transcript || 'Transcript not available'

      await fetch('/api/interview/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          transcript: typeof transcript === 'string' ? transcript : JSON.stringify(transcript),
          vapiCallId: callData?.callId
        })
      })
    }) as any)

    vapi.on('error', (error) => {
      console.error('Vapi error:', error)
      setError('An error occurred during the interview')
      setCallState('idle')
    })
  }, [vapi, slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="text-gray-600">Loading interview...</div>
      </div>
    )
  }

  if (error || !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Interview Not Found</h1>
          <p className="text-gray-600">{error || 'This interview link is invalid or has expired.'}</p>
        </div>
      </div>
    )
  }

  if (interview.status === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Interview Completed</h1>
          <p className="text-gray-600">You've already completed this interview. Thank you for your time!</p>
        </div>
      </div>
    )
  }

  if (callState === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Interview Complete!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for completing the interview. We're processing your responses and will be in touch soon.
          </p>
          <div className="bg-indigo-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              You can now close this window. We'll review your interview and get back to you with next steps.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {interview.role.title}
            </h1>
            <p className="text-gray-600">Interview for {interview.candidate.name}</p>
          </div>

          {callState === 'idle' && (
            <>
              {/* Interview Info */}
              <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">What to Expect</h2>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-600 text-xl">🎤</span>
                    <span>This is a voice interview - you'll have a conversation with an AI interviewer</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-600 text-xl">❓</span>
                    <span>You'll be asked {interview.questions.length} questions about your experience and skills</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-600 text-xl">⏱️</span>
                    <span>The interview typically takes 15-20 minutes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-600 text-xl">💡</span>
                    <span>Speak naturally and take your time with each answer</span>
                  </li>
                </ul>
              </div>

              {/* Technical Requirements */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Before You Start:</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>✓ Make sure your microphone is working</li>
                  <li>✓ Find a quiet place with minimal background noise</li>
                  <li>✓ Allow microphone access when prompted</li>
                  <li>✓ Use headphones for better audio quality (recommended)</li>
                </ul>
              </div>

              {/* Start Button */}
              <button
                onClick={startInterview}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
              >
                🎙️ Start Interview
              </button>
            </>
          )}

          {callState === 'connecting' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Connecting to interview...</p>
            </div>
          )}

          {callState === 'active' && (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <span className="text-4xl text-white">🎙️</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview in Progress</h2>
              <p className="text-gray-600 mb-6">
                The AI interviewer is speaking with you. Speak clearly and naturally.
              </p>
              <div className="bg-red-50 rounded-xl p-4 inline-block">
                <button
                  onClick={() => vapi?.stop()}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  End Interview
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}