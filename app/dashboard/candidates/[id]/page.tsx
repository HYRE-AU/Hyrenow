'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Candidate = {
  id: string
  name: string
  email: string
  cv_url: string | null
  created_at: string
}

type Interview = {
  id: string
  status: string
  created_at: string
  slug: string
  started_at: string | null
  completed_at: string | null
  progressed_at: string | null
  rejected_at: string | null
  score: number | null
  recommendation: string | null
  structured_evaluation: any | null
  transcript: any | null
  duration_seconds: number | null
  roles: {
    id: string
    title: string
  } | null
}

export default function CandidateProfilePage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedInterview, setExpandedInterview] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('Our Company')
  
  const router = useRouter()
  const params = useParams()
  const candidateId = params.id as string

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()

        const { data: candidateData, error: candidateError } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidateId)
          .single()

        if (candidateError) {
          console.error('Error fetching candidate:', candidateError)
          setLoading(false)
          return
        }

        const { data: interviewsData, error: interviewsError } = await supabase
          .from('interviews')
          .select(`
            id,
            status,
            created_at,
            slug,
            started_at,
            completed_at,
            progressed_at,
            rejected_at,
            score,
            recommendation,
            structured_evaluation,
            transcript,
            duration_seconds,
            roles (
              id,
              title
            )
          `)
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: false })

        if (interviewsError) {
          console.error('Error fetching interviews:', interviewsError)
        }

        // Get org name
        if (candidateData) {
          const { data: orgData } = await supabase
            .from('organisations')
            .select('name')
            .eq('id', candidateData.org_id)
            .single()
          
          if (orgData) setOrgName(orgData.name)
        }

        setCandidate(candidateData)
        setInterviews((interviewsData as any) || [])
      } catch (error) {
        console.error('Error in fetchData:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [candidateId])

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getStatusDateInfo = (interview: Interview): { label: string; date: string } => {
    switch (interview.status) {
      case 'invited':
        return { label: 'Invited on', date: interview.created_at }
      case 'in_progress':
        return interview.started_at
          ? { label: 'Started on', date: interview.started_at }
          : { label: 'Invited on', date: interview.created_at }
      case 'completed':
        return interview.completed_at
          ? { label: 'Completed on', date: interview.completed_at }
          : { label: 'Invited on', date: interview.created_at }
      case 'progressed':
        return interview.progressed_at
          ? { label: 'Progressed on', date: interview.progressed_at }
          : { label: 'Invited on', date: interview.created_at }
      case 'rejected':
        return interview.rejected_at
          ? { label: 'Rejected on', date: interview.rejected_at }
          : { label: 'Invited on', date: interview.created_at }
      default:
        return { label: 'Created on', date: interview.created_at }
    }
  }

  async function handleProceed(interview: Interview) {
    if (!confirm('Mark this candidate as progressed? This indicates you\'re moving forward with them.')) {
      return
    }

    setActionLoading(interview.id)
    try {
      const response = await fetch('/api/interview/proceed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: interview.id })
      })

      if (!response.ok) throw new Error('Failed to update status')

      // Update local state
      setInterviews(interviews.map(i =>
        i.id === interview.id ? { ...i, status: 'progressed', progressed_at: new Date().toISOString() } : i
      ))

      alert('✅ Candidate marked as progressed!')
    } catch (error) {
      alert('Failed to update candidate status')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(interview: Interview) {
    if (!confirm('Send rejection email to this candidate?')) {
      return
    }

    setActionLoading(interview.id)
    try {
      const response = await fetch('/api/interview/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: interview.id,
          candidateName: candidate!.name,
          candidateEmail: candidate!.email,
          roleTitle: interview.roles?.title || 'the position',
          companyName: orgName
        })
      })

      if (!response.ok) throw new Error('Failed to generate rejection')

      const data = await response.json()

      // Update local state
      setInterviews(interviews.map(i =>
        i.id === interview.id ? { ...i, status: 'rejected', rejected_at: new Date().toISOString() } : i
      ))

      // Open mailto link
      const mailtoLink = `mailto:${candidate!.email}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.emailBody)}`
      window.location.href = mailtoLink

    } catch (error) {
      alert('Failed to generate rejection email')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="text-red-600">Candidate not found</div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'invited': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'progressed': return 'bg-purple-100 text-purple-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'invited': return '📧'
      case 'in_progress': return '⏳'
      case 'completed': return '✅'
      case 'progressed': return '🎯'
      case 'rejected': return '❌'
      default: return '❓'
    }
  }

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'strong yes': return 'bg-green-100 text-green-800 border-green-300'
      case 'yes': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'no': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'strong no': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="/dashboard" className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
              HyreNow
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-indigo-600 hover:text-indigo-700 mb-4 flex items-center gap-2"
          >
            &larr; Back to Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Candidate Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                  {candidate.name.charAt(0).toUpperCase()}
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{candidate.name}</h1>
                <p className="text-gray-600 mt-1">{candidate.email}</p>
              </div>

              <div className="space-y-3 pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Member Since</span>
                  <span className="font-medium text-gray-900 text-sm">
                    {new Date(candidate.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Total Interviews</span>
                  <span className="font-medium text-gray-900 text-sm">
                    {interviews.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Completed</span>
                  <span className="font-medium text-gray-900 text-sm">
                    {interviews.filter(i => i.status === 'completed' || i.status === 'progressed' || i.status === 'rejected').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resume / CV</h3>
              {candidate.cv_url ? (
                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="text-3xl">📄</div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">Resume.pdf</p>
                    <p className="text-xs text-gray-600">Uploaded</p>
                  </div>
                  <a
                    href={candidate.cv_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                  >
                    View →
                  </a>
                </div>
              ) : (
                <div className="text-center p-6 bg-gray-50 rounded-xl">
                  <div className="text-4xl mb-2">📄</div>
                  <p className="text-sm text-gray-600">No CV uploaded yet</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Will appear after candidate starts interview
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Interviews */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Interview History ({interviews.length})
              </h2>

              {interviews.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No interviews yet</h3>
                  <p className="text-gray-600">This candidate hasn&apos;t been invited to any roles</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {interviews.map((interview) => (
                    <div
                      key={interview.id}
                      className="border-2 border-gray-200 rounded-2xl overflow-hidden"
                    >
                      {/* Interview Summary Card - Always Visible */}
                      <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-2xl font-bold text-gray-900">
                                {interview.roles?.title || 'Unknown Role'}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                                {getStatusIcon(interview.status)} {interview.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>📅 {getStatusDateInfo(interview).label} {new Date(getStatusDateInfo(interview).date).toLocaleDateString()}</span>
                              {interview.duration_seconds && (
                                <span>⏱️ {formatDuration(interview.duration_seconds)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Key Metrics */}
                        {interview.structured_evaluation && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {/* Recommendation Badge */}
                            <div>
                              <p className="text-xs text-gray-600 mb-2 font-medium">Recommendation</p>
                              <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold border-2 ${getRecommendationColor(interview.structured_evaluation.recommendation)}`}>
                                {interview.structured_evaluation.recommendation === 'strong yes' && '✓✓ '}
                                {interview.structured_evaluation.recommendation === 'strong no' && '✗✗ '}
                                {interview.structured_evaluation.recommendation?.toUpperCase()}
                              </div>
                            </div>

                            {/* Score */}
                            {interview.score !== null && (
                              <div>
                                <p className="text-xs text-gray-600 mb-2 font-medium">Interview Score</p>
                                <div className="flex items-center gap-3">
                                  <div className="text-2xl font-bold text-indigo-600">
                                    {interview.score}%
                                  </div>
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-gradient-to-r from-indigo-600 to-cyan-600 h-2 rounded-full"
                                      style={{ width: `${interview.score}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Top Reasons Preview */}
                        {interview.structured_evaluation?.reasons_to_proceed?.length > 0 && (
                          <div className="bg-white rounded-lg p-4 mb-4">
                            <p className="text-sm font-semibold text-gray-700 mb-2">Key Strengths:</p>
                            <ul className="space-y-1">
                              {interview.structured_evaluation.reasons_to_proceed.slice(0, 3).map((reason: string, idx: number) => (
                                <li key={idx} className="text-sm text-gray-600 flex gap-2">
                                  <span className="text-green-600">✓</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                            {interview.structured_evaluation.reasons_to_proceed.length > 3 && (
                              <button
                                onClick={() => setExpandedInterview(expandedInterview === interview.id ? null : interview.id)}
                                className="text-xs text-indigo-600 hover:text-indigo-700 mt-2"
                              >
                                +{interview.structured_evaluation.reasons_to_proceed.length - 3} more reasons
                              </button>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        {(interview.status === 'completed') && interview.structured_evaluation && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleProceed(interview)}
                              disabled={actionLoading === interview.id}
                              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              {actionLoading === interview.id ? 'Processing...' : '✅ Proceed to Interview'}
                            </button>
                            <button
                              onClick={() => handleReject(interview)}
                              disabled={actionLoading === interview.id}
                              className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
                            >
                              {actionLoading === interview.id ? 'Processing...' : '❌ Send Rejection'}
                            </button>
                          </div>
                        )}

                        {interview.status === 'progressed' && (
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <p className="text-sm text-purple-800 font-medium">
                              ✅ Marked as progressed - Next: Schedule interview with hiring manager
                            </p>
                          </div>
                        )}

                        {interview.status === 'rejected' && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm text-red-800 font-medium">
                              ❌ Candidate rejected - Rejection email was sent
                            </p>
                          </div>
                        )}

                        {/* View Full Evaluation Toggle */}
                        {interview.structured_evaluation && (
                          <button
                            onClick={() => setExpandedInterview(expandedInterview === interview.id ? null : interview.id)}
                            className="w-full mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            {expandedInterview === interview.id ? '▼ Hide Full Evaluation' : '▶ View Full Evaluation'}
                          </button>
                        )}
                      </div>

                      {/* Expanded Full Evaluation */}
                      {expandedInterview === interview.id && interview.structured_evaluation && (
                        <div className="border-t border-gray-200 p-6 bg-white space-y-6">
                          {/* Full Reasons to Proceed */}
                          {interview.structured_evaluation.reasons_to_proceed?.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-3">✓ All Reasons to Proceed</h4>
                              <ul className="space-y-2">
                                {interview.structured_evaluation.reasons_to_proceed.map((reason: string, idx: number) => (
                                  <li key={idx} className="flex gap-3 text-gray-700">
                                    <span className="text-green-600 font-bold">•</span>
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Flags/Risks */}
                          {interview.structured_evaluation.flags_risks?.length > 0 && (
                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                              <h4 className="text-lg font-semibold text-gray-900 mb-3">⚠️ Flags & Risks</h4>
                              <ul className="space-y-2">
                                {interview.structured_evaluation.flags_risks.map((flag: string, idx: number) => (
                                  <li key={idx} className="flex gap-3 text-gray-700">
                                    <span className="text-orange-600 font-bold">•</span>
                                    <span>{flag}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Question Performance */}
                          {interview.structured_evaluation.question_evaluations?.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-4">Question-by-Question Performance</h4>
                              <div className="space-y-4">
                                {interview.structured_evaluation.question_evaluations.map((qe: any, idx: number) => (
                                  <div key={idx} className="border-l-4 border-indigo-500 pl-4 py-2">
                                    <div className="flex justify-between items-start mb-2">
                                      <p className="font-semibold text-gray-900">Q{idx + 1}: {qe.question}</p>
                                      {qe.answer_duration_seconds > 0 && (
                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-medium ml-2">
                                          ⏱️ {formatDuration(qe.answer_duration_seconds)}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600">{qe.evaluation}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Transcript */}
                          {interview.transcript && (
                            <div className="bg-gray-50 rounded-xl p-4">
                              <details>
                                <summary className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-indigo-600">
                                  📄 View Full Transcript
                                </summary>
                                <div className="mt-4 bg-white rounded-lg p-4 max-h-96 overflow-y-auto">
                                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                                    {typeof interview.transcript === 'object' ? interview.transcript.text : interview.transcript}
                                  </pre>
                                </div>
                              </details>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Invited Status - Show Link */}
                      {interview.status === 'invited' && (
                        <div className="bg-blue-50 p-6 border-t border-gray-200">
                          <p className="text-sm font-medium text-gray-700 mb-2">Interview Link:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={`${process.env.NEXT_PUBLIC_APP_URL}/interview/${interview.slug}`}
                              readOnly
                              className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL}/interview/${interview.slug}`)
                                alert('Link copied!')
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}