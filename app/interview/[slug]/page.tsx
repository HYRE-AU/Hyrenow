'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Vapi from '@vapi-ai/web'
import posthog from 'posthog-js'

type KnockoutQuestion = {
  id: string
  question_text: string
  required_answer: boolean
  order_index: number
}

type Interview = {
  id: string
  status: string
  slug: string
  screened_out_at: string | null
  screened_out_reason: string | null
  roles: {
    id: string
    title: string
    jd_text: string
    company_name: string | null
    role_briefing: string | null
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
  knockoutQuestions: KnockoutQuestion[]
}

type Step = 'knockout' | 'landing' | 'consent' | 'preparation' | 'interview' | 'completed' | 'screened_out'

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
  
  // Knockout states
  const [knockoutResponses, setKnockoutResponses] = useState<Record<string, boolean | null>>({})
  const [knockoutSubmitting, setKnockoutSubmitting] = useState(false)
  
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
        
        // Set initial step based on status and knockout questions
        if (data.status === 'completed') {
          setStep('completed')
        } else if (data.status === 'screened_out') {
          setStep('screened_out')
        } else if (data.knockoutQuestions && data.knockoutQuestions.length > 0) {
          setStep('knockout')
          // Initialize knockout responses
          const initialResponses: Record<string, boolean | null> = {}
          data.knockoutQuestions.forEach((kq: KnockoutQuestion) => {
            initialResponses[kq.id] = null
          })
          setKnockoutResponses(initialResponses)
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

  async function submitKnockout() {
    if (!interview) return
    
    // Check all questions are answered
    const unanswered = Object.values(knockoutResponses).some(v => v === null)
    if (unanswered) {
      alert('Please answer all questions')
      return
    }

    setKnockoutSubmitting(true)
    try {
      const responses = Object.entries(knockoutResponses).map(([knockoutQuestionId, answer]) => ({
        knockoutQuestionId,
        answer
      }))

      const res = await fetch('/api/interview/knockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: interview.id,
          responses
        })
      })

      const data = await res.json()

      posthog.capture('knockout_submitted', {
        interview_id: interview.id,
        candidate_name: interview.candidates.name,
        role_title: interview.roles.title,
        passed: data.passed,
        questions_count: interview.knockoutQuestions.length
      })

      if (data.passed) {
        setStep('landing')
      } else {
        posthog.capture('knockout_failed', {
          interview_id: interview.id,
          candidate_name: interview.candidates.name,
          role_title: interview.roles.title
        })
        setStep('screened_out')
      }
    } catch (err) {
      alert('Failed to submit. Please try again.')
    } finally {
      setKnockoutSubmitting(false)
    }
  }

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
                content: `You are a warm, professional AI interviewer conducting a screening interview for the position of ${interview.roles.title} at ${interview.roles.company_name || interview.roles.organisations.name}.

The candidate's name is ${interview.candidates.name}. Address them by their first name (${interview.candidates.name.split(' ')[0]}) throughout the interview.

${interview.roles.role_briefing ? `ROLE BRIEFING:
After greeting, share these key points about the opportunity:

${interview.roles.role_briefing
  .replace(/\$(\d+)/g, '$1 dollars')
  .replace(/(\d+)\s*dollars\s*million/gi, '$1 million dollars')
  .replace(/(\d+)\s*dollars\s*billion/gi, '$1 billion dollars')
}

HOW TO DELIVER THIS (CRITICAL):
- Talk like you're genuinely excited to tell a friend about a cool job
- Use SHORT sentences. Max 8-10 words each. This prevents monotone.
- Mix up your energy: some sentences excited, some calm and informative
- Use casual connectors: "So...", "And get this...", "Oh, and...", "The cool thing is..."
- Pause naturally between different topics
- NO formal corporate speak. Be warm and human.
- End with ONE simple question like "Any questions before we get started?" (not multiple questions)

Example - BAD (robotic, too long):
"The company has secured 24 million dollars in Series B funding led by Bessemer Venture Partners with participation from King River Capital and Insight Partners, and the team consists of 80 people."

Example - GOOD (natural, energetic):
"So, exciting news on the funding front. They just closed a Series B. 24 million dollars. Bessemer led it, which is huge. The team's around 80 people now. Growing really fast."

` : ''}
INTERVIEW QUESTIONS:
After the briefing (or greeting if no briefing), you will ask the following questions one at a time:
${interview.questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

Ask each question naturally, wait for the candidate's full response, acknowledge their answer briefly with something genuine (not just "great" or "thanks"), then transition smoothly to the next question. Be professional, encouraging, and conversational. After all questions, thank them warmly for their time and let them know the team will be in touch.`
              }
            ]
        },
        voice: {
          provider: '11labs',
          voiceId: '21m00Tcm4TlvDq8ikWAM' // Rachel - warm, friendly, energetic
        },
        firstMessage: interview.roles.role_briefing
          ? `Hi ${interview.candidates.name.split(' ')[0]}! Thanks so much for joining me today. I'm really excited to chat with you about the ${interview.roles.title} role at ${interview.roles.company_name || interview.roles.organisations.name}. Before we jump into the interview questions, let me give you a bit of background on the company and what makes this opportunity special.`
          : `Hi ${interview.candidates.name.split(' ')[0]}! Thanks so much for joining me today for the ${interview.roles.title} interview. I've got ${interview.questions.length} questions for us to go through. Ready to get started?`,metadata: {
          interviewSlug: slug
        },
        artifactPlan: {
          recordingEnabled: true
        }
      })
      
      setCallState('active')
      setStep('interview')

      posthog.capture('interview_started', {
        interview_id: interview.id,
        candidate_name: interview.candidates.name,
        role_title: interview.roles.title,
        company_name: interview.roles.company_name || interview.roles.organisations.name,
        questions_count: interview.questions.length,
        has_role_briefing: !!interview.roles.role_briefing
      })
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

      posthog.capture('candidate_feedback_submitted', {
        interview_id: interview!.id,
        candidate_name: interview?.candidates.name,
        role_title: interview?.roles.title,
        rating: surveyRating,
        has_feedback_text: !!surveyFeedback.trim()
      })

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

      posthog.capture('interview_completed', {
        interview_id: interview?.id,
        candidate_name: interview?.candidates.name,
        role_title: interview?.roles.title,
        company_name: interview?.roles.company_name || interview?.roles.organisations.name,
        questions_count: interview?.questions.length
      })

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-gray-600">Loading interview...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
          <div className="text-red-500 text-xl font-semibold">{error}</div>
        </div>
      </div>
    )
  }

  // SCREENED OUT - Polite Rejection Page
  if (step === 'screened_out') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="text-6xl mb-6">🙏</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Thank You for Your Interest
            </h1>
            <p className="text-gray-600 text-lg mb-6">
              We appreciate you taking the time to apply for the{' '}
              <strong>{interview?.roles.title}</strong> position at{' '}
              <strong>{interview?.roles.company_name || interview?.roles.organisations.name}</strong>.
            </p>
            
            <div className="bg-gray-50 rounded-xl p-6 mb-6 text-left">
              <p className="text-gray-700 mb-4">
                After reviewing your responses to our initial screening questions, we've determined that this particular role may not be the best match for your current situation.
              </p>
              <p className="text-gray-700">
                This decision is based solely on the specific requirements for this position and is not a reflection of your overall qualifications or experience.
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-6 text-left">
              <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
              <ul className="text-blue-800 space-y-2 text-sm">
                <li>• We encourage you to apply for other roles that may better match your profile</li>
                <li>• Keep an eye on new opportunities that may become available</li>
                <li>• We wish you the very best in your job search</li>
              </ul>
            </div>

            <p className="text-gray-500 text-sm mt-6">
              You may now close this window.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // KNOCKOUT SCREENING STEP
  if (step === 'knockout' && interview?.knockoutQuestions && interview.knockoutQuestions.length > 0) {
    const allAnswered = Object.values(knockoutResponses).every(v => v !== null)
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">📋</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Quick Eligibility Check
              </h1>
              <p className="text-gray-600">
                Before we begin, please answer a few quick questions about the{' '}
                <strong>{interview.roles.title}</strong> position.
              </p>
            </div>

            {/* Questions */}
            <div className="space-y-6 mb-8">
              {interview.knockoutQuestions.map((kq, index) => (
                <div 
                  key={kq.id}
                  className="bg-gray-50 rounded-xl p-6 border border-gray-200"
                >
                  <p className="text-gray-900 font-medium mb-4">
                    {index + 1}. {kq.question_text}
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setKnockoutResponses(prev => ({ ...prev, [kq.id]: true }))}
                      className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
                        knockoutResponses[kq.id] === true
                          ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-green-400'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setKnockoutResponses(prev => ({ ...prev, [kq.id]: false }))}
                      className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
                        knockoutResponses[kq.id] === false
                          ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-red-400'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit */}
            <button
              onClick={submitKnockout}
              disabled={!allAnswered || knockoutSubmitting}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {knockoutSubmitting ? 'Checking...' : 'Continue'}
            </button>

            <p className="text-center text-gray-500 text-sm mt-4">
              These questions help us ensure this role is a good match for you.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Step 1: Landing Page
  if (step === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl text-white">🎙️</span>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome, {interview?.candidates.name.split(' ')[0]}!
              </h1>
              <p className="text-gray-600 text-lg">
                You've been invited to interview for
              </p>
            </div>

            {/* Role Info */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6 border border-purple-100">
              <h2 className="text-xl font-bold text-gray-900">{interview?.roles.title}</h2>
              <p className="text-gray-600">
                {interview?.roles.company_name || interview?.roles.organisations.name}
              </p>
            </div>

            {/* Job Description Toggle */}
            <div className="mb-6">
              <button
                onClick={() => setShowJD(!showJD)}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-2"
              >
                {showJD ? '▼ Hide' : '▶ View'} Job Description
              </button>
              {showJD && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans">{interview?.roles.jd_text}</pre>
                </div>
              )}
            </div>

            {/* What to Expect */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What to expect:</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex gap-3">
                  <span className="text-purple-600">✓</span>
                  <span>{interview?.questions.length} questions, approximately 10-15 minutes</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-purple-600">✓</span>
                  <span>AI-powered voice interview - speak naturally</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-purple-600">✓</span>
                  <span>Your responses will be reviewed by the hiring team</span>
                </li>
              </ul>
            </div>

            {/* CTA */}
            <button
              onClick={() => setStep('consent')}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02] transition-all duration-200"
            >
              Let's Get Started →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Consent
  if (step === 'consent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Before We Begin</h1>

            {/* Privacy Notice */}
            <div className="bg-blue-50 rounded-xl p-6 mb-8 border border-blue-100">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                🔒 Privacy & Recording Notice
              </h3>
              <p className="text-gray-700 text-sm mb-3">
                This interview will be recorded, transcribed, and assessed using AI. Your responses and assessment results will be shared with the hiring team.
              </p>
              <p className="text-gray-700 text-sm mb-4">
                Your data is processed and retained for 30 days before deletion. A human will review your evaluation before any hiring decision is made.
              </p>
              <p className="text-gray-700 text-sm mb-4">
                For full details, see our{' '}
                <a href="https://hyrenow.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                  Privacy Policy
                </a>.
              </p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">
                  I understand and consent to the recording of this interview
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
                onClick={() => {
                  posthog.capture('interview_consent_given', {
                    interview_id: interview?.id,
                    candidate_name: interview?.candidates.name,
                    role_title: interview?.roles.title
                  })
                  setStep('preparation')
                }}
                disabled={!consentChecked}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                I Agree, Continue →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Preparation
  if (step === 'preparation') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Quick Tips</h1>
            <p className="text-gray-600 mb-6">Set yourself up for success</p>

            {/* Tips */}
            <div className="space-y-4 mb-8">
              <div className="flex gap-4 p-4 bg-green-50 rounded-lg border border-green-100">
                <span className="text-2xl">🎤</span>
                <div>
                  <p className="font-medium text-gray-900">Check your microphone</p>
                  <p className="text-sm text-gray-600">Make sure your browser has permission to access your mic</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-2xl">🔇</span>
                <div>
                  <p className="font-medium text-gray-900">Find a quiet place</p>
                  <p className="text-sm text-gray-600">Minimize background noise for the best experience</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
                <span className="text-2xl">💭</span>
                <div>
                  <p className="font-medium text-gray-900">Take your time</p>
                  <p className="text-sm text-gray-600">It's okay to pause and think before answering</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-2xl">🎧</span>
                <div>
                  <p className="font-medium text-gray-900">Use headphones if possible</p>
                  <p className="text-sm text-gray-600">This helps ensure clear audio quality</p>
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {callState === 'connecting' && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Connecting to interview...</p>
              </div>
            )}

            {callState === 'active' && (
              <div className="text-center py-12">
                <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse shadow-xl shadow-purple-500/30">
                  <span className="text-5xl text-white">🎙️</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Interview in Progress</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  The AI interviewer is speaking with you. Speak clearly and take your time with your answers.
                </p>

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6 border border-purple-100">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
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
            
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-8">
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
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white scale-110 shadow-xl shadow-purple-500/30'
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  maxLength={500}
                />
              </div>

              {/* Submit */}
              <button
                onClick={submitSurvey}
                disabled={!surveyRating || surveyLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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