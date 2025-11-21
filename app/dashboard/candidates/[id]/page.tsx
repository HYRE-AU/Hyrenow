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
  score: number | null
  recommendation: string | null
  structured_evaluation: any | null
  transcript: any | null
  roles: {
    id: string
    title: string
  } | null
}

export default function CandidateProfilePage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
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
            score,
            recommendation,
            structured_evaluation,
            transcript,
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
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'invited': return '📧'
      case 'in_progress': return '⏳'
      case 'completed': return '✅'
      default: return '❓'
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
                    {interviews.filter(i => i.status === 'completed').length}
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
                <div className="space-y-4">
                  {interviews.map((interview) => (
                    <div
                      key={interview.id}
                      className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <button
                              onClick={() => interview.roles && router.push(`/dashboard/roles/${interview.roles.id}`)}
                              className="text-xl font-bold text-gray-900 hover:text-indigo-600 transition-colors"
                            >
                              {interview.roles?.title || 'Unknown Role'}
                            </button>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                              {getStatusIcon(interview.status)} {interview.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Invited {new Date(interview.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                            interview.created_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            ✓
                          </div>
                          <p className="text-xs font-medium text-gray-900">Invited</p>
                          <p className="text-xs text-gray-500">
                            {new Date(interview.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-center">
                          <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                            interview.started_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {interview.started_at ? '✓' : '○'}
                          </div>
                          <p className="text-xs font-medium text-gray-900">Started</p>
                          <p className="text-xs text-gray-500">
                            {interview.started_at ? new Date(interview.started_at).toLocaleDateString() : 'Pending'}
                          </p>
                        </div>
                        <div className="text-center">
                          <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                            interview.completed_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {interview.completed_at ? '✓' : '○'}
                          </div>
                          <p className="text-xs font-medium text-gray-900">Completed</p>
                          <p className="text-xs text-gray-500">
                            {interview.completed_at ? new Date(interview.completed_at).toLocaleDateString() : 'Pending'}
                          </p>
                        </div>
                      </div>

                      {interview.status === 'invited' && (
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Interview Link:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={`${process.env.NEXT_PUBLIC_APP_URL}/interview/${interview.slug}`}
                              readOnly
                              className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm"
                            />
                            <button
                              onClick={() => {
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

                      {interview.score !== null && (
                        <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-lg p-4 mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Interview Score</p>
                          <div className="flex items-center gap-3">
                            <div className="text-3xl font-bold text-indigo-600">
                              {interview.score}%
                            </div>
                            <div className="flex-1 bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-gradient-to-r from-indigo-600 to-cyan-600 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${interview.score}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Structured Evaluation */}
                      {interview.structured_evaluation ? (
                        <div className="space-y-6">
                          {/* Recommendation Badge */}
                          <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl p-6 border border-indigo-100">
                            <h3 className="text-sm font-medium text-gray-700 mb-3">Recommendation</h3>
                            <div className={`inline-flex items-center px-6 py-3 rounded-full text-lg font-bold ${
                              interview.structured_evaluation.recommendation === 'strong yes' ? 'bg-green-100 text-green-800' :
                              interview.structured_evaluation.recommendation === 'yes' ? 'bg-blue-100 text-blue-800' :
                              interview.structured_evaluation.recommendation === 'no' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {interview.structured_evaluation.recommendation === 'strong yes' && '✓✓ '}
                              {interview.structured_evaluation.recommendation === 'strong no' && '✗✗ '}
                              {interview.structured_evaluation.recommendation?.toUpperCase()}
                            </div>
                          </div>

                          {/* Reasons to Proceed */}
                          {interview.structured_evaluation.reasons_to_proceed?.length > 0 && (
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">✓ Reasons to Proceed</h3>
                              <ul className="space-y-3">
                                {interview.structured_evaluation.reasons_to_proceed.map((reason: string, idx: number) => (
                                  <li key={idx} className="flex gap-3">
                                    <span className="text-green-600 font-bold">•</span>
                                    <span className="text-gray-700">{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Flags/Risks */}
                          {interview.structured_evaluation.flags_risks?.length > 0 && (
                            <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Flags & Risks</h3>
                              <ul className="space-y-3">
                                {interview.structured_evaluation.flags_risks.map((flag: string, idx: number) => (
                                  <li key={idx} className="flex gap-3">
                                    <span className="text-orange-600 font-bold">•</span>
                                    <span className="text-gray-700">{flag}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Question-by-Question Evaluation */}
                          {interview.structured_evaluation.question_evaluations?.length > 0 && (
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-6">Question Performance</h3>
                              <div className="space-y-6">
                                {interview.structured_evaluation.question_evaluations.map((qe: any, idx: number) => (
                                  <div key={idx} className="border-l-4 border-indigo-500 pl-4">
                                    <p className="font-semibold text-gray-900 mb-2">Q{idx + 1}: {qe.question}</p>
                                    <p className="text-sm text-gray-600">{qe.evaluation}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Transcript Tab */}
                          {interview.transcript && (
                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                              <details className="cursor-pointer">
                                <summary className="text-lg font-semibold text-gray-900 mb-4 cursor-pointer hover:text-indigo-600">
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
                      ) : interview.recommendation && (
                        // Fallback for old format
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Evaluation Summary</p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {interview.recommendation}
                          </p>
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