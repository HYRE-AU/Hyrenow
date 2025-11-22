'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Vapi from '@vapi-ai/web'

type Interview = {
  id: string
  status: string
  slug: string
  roles: {
    id: string
    title: string
    jd_text: string
    organisations: {
      name: string
    }
  }
  candidates: {
    name: string
    email: string
  }
  questions: Array<{
    text: string
    order_index: number
  }>
}

type Step = 'landing' | 'consent' | 'preparation' | 'interview' | 'completed'

export default function InterviewPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [step, setStep] = useState<Step>('landing')
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle')
  const [vapi, setVapi] = useState<Vapi | null>(null)
  const [showJD, setShowJD] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [recruiterEmail, setRecruiterEmail] = useState('support@hyrenow.com')
  const vapiCallIdRef = useRef<string | null>(null)
  
  // Survey states
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const [surveyRating, setSurveyRating] = useState<number | null>(null)
  const [surveyFeedback, setSurveyFeedback] = useState('')
  const [surveyLoading, setSurveyLoading] = useState(false)

  useEffect(() => {
    async function fetchInterview() {
      try {
        const res = await fetch(`/api/interview/${slug}`)
        if (!res.ok) throw new Error('Interview not found')
        const data = await res.json()
        
        // Check if already completed
        if (data.status === 'completed') {
          setStep('completed')
        }
        
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
      // Update interview status to in_progress
      await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug })
      })

      // Start Vapi call
      await vapi.start({
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en',
          endpointing: 400
        },
        model: {
          provider: 'openai',
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a professional AI interviewer conducting an interview for the position of ${interview.roles.title} at ${interview.roles.organisations.name}. 

You will ask the following questions one at a time:
${interview.questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

Ask each question naturally, wait for the candidate's full response, acknowledge their answer briefly, and move to the next question. Be professional, encouraging, and conversational. After all questions, thank them for their time.`
            }
          ]
        },
        voice: {
          provider: '11labs',
          voiceId: 'paula'
        },
        firstMessage: `Hello ${interview.candidates.name.split(' ')[0]}! Thank you for joining us today for the ${interview.roles.title} interview. I'll be asking you ${interview.questions.length} questions. Are you ready to begin?`
      })

      setCallState('active')
      setStep('interview')
    } catch (err: any) {
      console.error('Call failed:', err)
      setError('Failed to start interview. Please try again.')
      setCallState('idle')
    }
  }

  async function submitSurvey() {
    if (!surveyRating) {
      alert('Please select a rating')
      return
    }

    setSurveyLoading(true)
    try {
      const response = await fetch('/api/interview/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: interview!.id,
          rating: surveyRating,
          feedbackText: surveyFeedback.trim() || null
        })
      })

      if (!response.ok) throw new Error('Failed to submit feedback')

      setSurveySubmitted(true)
    } catch (error) {
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setSurveyLoading(false)
    }
  }

  // Vapi event handlers
  useEffect(() => {
    if (!vapi) return

    vapi.on('call-start', () => {
      console.log('Call started')
      setCallState('active')
    })

    vapi.on('call-start-success', (event) => {
      console.log('Call started successfully', event)
      if (event.callId) {
        vapiCallIdRef.current = event.callId
        console.log('✅ Stored Vapi call ID in ref:', event.callId)
      }
    })

    vapi.on('call-end', async () => {
      console.log('Call ended')
      console.log('📤 Sending Vapi call ID to complete endpoint:', vapiCallIdRef.current)
      setCallState('ended')

      await fetch('/api/interview/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          vapiCallId: vapiCallIdRef.current
        })
      })

      setStep('completed')
    })

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Interview Link Inactive</h1>
          <p className="text-gray-600 mb-6">
            This interview link isn't active. Please ask your recruiter for a new link.
          </p>
          <p className="text-sm text-gray-500">
            Having issues? Contact{' '}
            <a href={`mailto:${recruiterEmail}`} className="text-indigo-600 hover:underline">
              {recruiterEmail}
            </a>
          </p>
        </div>
      </div>
    )
  }

  // Step 1: Landing Page
  if (step === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
        <div className="max-w-3xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-block px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-4">
                Screening Interview
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                {interview.roles.title}
              </h1>
              <p className="text-xl text-gray-600 mb-4">
                at {interview.roles.organisations.name}
              </p>
              <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  ⏱️ Takes ~15–20 minutes
                </span>
                <span className="flex items-center gap-2">
                  🎙️ Recorded for assessment
                </span>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl p-6 mb-6">
              <p className="text-gray-700 leading-relaxed">
                Hi {interview.candidates.name.split(' ')[0]}! 👋 Welcome to your screening interview. 
                This is an AI-powered voice interview that helps us get to know you better. A human recruiter 
                will review your responses and get back to you with next steps.
              </p>
            </div>

            {/* Job Description */}
            <div className="border border-gray-200 rounded-xl mb-6">
              <button
                onClick={() => setShowJD(!showJD)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900">📋 Job Description</span>
                <span className="text-gray-500">{showJD ? '▼' : '▶'}</span>
              </button>
              {showJD && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-200">
                  <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                    {interview.roles.jd_text}
                  </p>
                </div>
              )}
            </div>

            {/* Privacy Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                🔒 Your interview will be recorded, transcribed, and reviewed by our hiring team. 
                We take your privacy seriously and handle all data in accordance with our{' '}
                <a href="#" className="text-indigo-600 hover:underline">privacy policy</a>.
              </p>
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              <button
                onClick={() => setStep('consent')}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
              >
                Next →
              </button>
              <p className="text-center text-sm text-gray-500">
                Having issues? Contact{' '}
                <a href={`mailto:${recruiterEmail}`} className="text-indigo-600 hover:underline">
                  {recruiterEmail}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Consent Page
  if (step === 'consent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Before We Begin
              </h1>
              <p className="text-gray-600">
                We need your consent to proceed with the interview
              </p>
            </div>

            {/* Consent Explanation */}
            <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">What happens during this interview:</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex gap-3">
                  <span>🎙️</span>
                  <span>Your voice responses will be recorded and transcribed</span>
                </li>
                <li className="flex gap-3">
                  <span>🤖</span>
                  <span>An AI interviewer will ask you questions about your experience</span>
                </li>
                <li className="flex gap-3">
                  <span>👤</span>
                  <span>A human recruiter will review your interview and make the hiring decision</span>
                </li>
                <li className="flex gap-3">
                  <span>🔒</span>
                  <span>Your data is processed securely and used only for recruitment purposes</span>
                </li>
              </ul>
            </div>

            {/* Consent Checkbox */}
            <div className="border-2 border-gray-200 rounded-xl p-6 mb-6">
              <label className="flex gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-6 h-6 mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-gray-700 leading-relaxed">
                  I consent to the recording, transcription, and processing of my interview for recruitment purposes. 
                  I understand that a human will review my interview and that my data will be handled according to the{' '}
                  <a href="#" className="text-indigo-600 hover:underline">privacy policy</a>.
                </span>
              </label>
            </div>

            {/* CTAs */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('landing')}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep('preparation')}
                disabled={!consentChecked}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Preparation Page
  if (step === 'preparation') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">🎯</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Get Ready for Your Interview
              </h1>
              <p className="text-gray-600">
                This is just like a normal first-round screening call
              </p>
            </div>

            {/* Comfort Message */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-6">
              <p className="text-gray-700 leading-relaxed">
                We'll ask you a few questions about your experience and what you bring to the role. 
                This is your chance to share what's not on your CV and show us your personality and passion. 
                There are no trick questions – just be yourself! 🌟
              </p>
            </div>

            {/* Tips */}
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Tips:</h3>
              <div className="space-y-3">
                <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                  <span className="text-2xl">🔇</span>
                  <div>
                    <p className="font-medium text-gray-900">Find a quiet place</p>
                    <p className="text-sm text-gray-600">Minimize background noise for the best experience</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                  <span className="text-2xl">💭</span>
                  <div>
                    <p className="font-medium text-gray-900">Take your time</p>
                    <p className="text-sm text-gray-600">It's okay to pause and think before answering</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 bg-indigo-50 rounded-lg">
                  <span className="text-2xl">🎧</span>
                  <div>
                    <p className="font-medium text-gray-900">Use headphones if possible</p>
                    <p className="text-sm text-gray-600">This helps ensure clear audio quality</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('consent')}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={startInterview}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
              >
                🎙️ I'm Ready, Let's Go!
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 4: Active Interview
  if (step === 'interview') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {callState === 'connecting' && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Connecting to interview...</p>
              </div>
            )}

            {callState === 'active' && (
              <div className="text-center py-12">
                <div className="w-32 h-32 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <span className="text-5xl text-white">🎙️</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Interview in Progress</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  The AI interviewer is speaking with you. Speak clearly and take your time with your answers.
                </p>
                
                <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl p-6 mb-6">
                  <p className="text-sm text-gray-700">
                    💡 <strong>Tip:</strong> Treat this like a conversation with a real person. Be natural and authentic!
                  </p>
                </div>

                <div className="bg-red-50 rounded-xl p-4 inline-block">
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to end the interview?')) {
                        vapi?.stop()
                      }
                    }}
                    className="px-8 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
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

  // Step 5: Completed - Survey Submitted
  if (step === 'completed' && surveySubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="text-6xl mb-6">🙏</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Thank You for Your Feedback!</h1>
            <p className="text-gray-600 text-lg mb-6">
              We appreciate you taking the time to share your thoughts. Good luck with your application! 🍀
            </p>
            
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
              <p className="text-gray-700">
                You can now close this window. We'll be in touch soon with next steps.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 5: Completed - Show Survey
  if (step === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Completion Message */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-6">🎉</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Interview Complete!</h1>
              <p className="text-gray-600 mb-6 text-lg">
                Thank you for completing the interview. We're processing your responses and will be in touch soon with next steps.
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
              <ul className="text-left space-y-2 text-gray-700">
                <li className="flex gap-3">
                  <span>1️⃣</span>
                  <span>Our recruitment team will review your interview</span>
                </li>
                <li className="flex gap-3">
                  <span>2️⃣</span>
                  <span>We'll evaluate your responses against the role requirements</span>
                </li>
                <li className="flex gap-3">
                  <span>3️⃣</span>
                  <span>You'll hear from us within 3-5 business days</span>
                </li>
              </ul>
            </div>

            {/* Survey Section */}
            <div className="border-t-2 border-gray-200 pt-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quick Feedback</h2>
                <p className="text-gray-600">Help us improve the interview experience</p>
              </div>

              {/* Rating */}
              <div className="mb-6">
                <label className="block text-center font-medium text-gray-900 mb-4">
                  Rate your interview experience today
                </label>
                <div className="flex justify-center gap-4">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setSurveyRating(rating)}
                      className={`w-16 h-16 rounded-full text-2xl font-bold transition-all ${
                        surveyRating === rating
                          ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white scale-110 shadow-lg'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-3 px-4">
                  <span>Poor</span>
                  <span>Excellent</span>
                </div>
              </div>

              {/* Optional Feedback */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Anything we could improve? (Optional)
                </label>
                <input
                  type="text"
                  value={surveyFeedback}
                  onChange={(e) => setSurveyFeedback(e.target.value)}
                  placeholder="Your suggestions..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  maxLength={500}
                />
              </div>

              {/* Submit */}
              <button
                onClick={submitSurvey}
                disabled={!surveyRating || surveyLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {surveyLoading ? 'Submitting...' : 'Submit & Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}