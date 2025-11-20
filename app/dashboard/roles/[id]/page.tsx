'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = {
  id: string
  title: string
  jd_text: string
  status: string
  created_at: string
}

type Question = {
  id: string
  text: string
  order_index: number
}

export default function RoleDetailPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [interviewLink, setInterviewLink] = useState('')
  const router = useRouter()
  const params = useParams()
  const roleId = params.id as string

  useEffect(() => {
    async function fetchRoleData() {
      const supabase = createClient()
      
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .single()

      if (roleError) {
        console.error('Error fetching role:', roleError)
        return
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('role_id', roleId)
        .order('order_index')

      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
      }

      setRole(roleData)
      setQuestions(questionsData || [])
      setLoading(false)
    }

    fetchRoleData()
  }, [roleId])

  async function handleInviteCandidate(e: React.FormEvent) {
    e.preventDefault()
    setInviteLoading(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/candidates/invite', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          roleId,
          candidateName,
          candidateEmail,
        }),
      })

      if (!response.ok) throw new Error('Failed to invite candidate')

      const data = await response.json()
      setInterviewLink(data.interviewLink)
      setInviteSuccess(true)
      setCandidateName('')
      setCandidateEmail('')
    } catch (error: any) {
      alert(error.message)
    } finally {
      setInviteLoading(false)
    }
  }

  function closeModal() {
    setShowInviteModal(false)
    setInviteSuccess(false)
    setInterviewLink('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="text-red-600">Role not found</div>
      </div>
    )
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
            ← Back to Dashboard
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">{role.title}</h1>
              <p className="text-gray-500 mt-2">
                Created {new Date(role.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {role.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Job Description</h2>
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{role.jd_text}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Interview Questions ({questions.length})
              </h2>
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="p-4 bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl border border-indigo-100"
                  >
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                        {index + 1}
                      </div>
                      <p className="text-gray-800 flex-1">{question.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                >
                  📧 Invite Candidate
                </button>
                <button
                  onClick={() => router.push(`/dashboard/roles/${roleId}/candidates`)}
                  className="w-full bg-white border-2 border-indigo-600 text-indigo-600 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-all duration-200"
                >
                  👥 View Candidates
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Questions Generated</span>
                  <span className="font-semibold text-gray-900">{questions.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            {!inviteSuccess ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Invite Candidate</h2>
                <form onSubmit={handleInviteCandidate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Candidate Name *
                    </label>
                    <input
                      type="text"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={candidateEmail}
                      onChange={(e) => setCandidateEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 outline-none"
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={inviteLoading}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
                    >
                      {inviteLoading ? 'Sending...' : 'Send Invite'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">✅</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Sent!</h2>
                  <p className="text-gray-600">The candidate has been invited to interview</p>
                </div>

                <div className="bg-indigo-50 rounded-xl p-4 mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-2">Interview Link:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={interviewLink}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(interviewLink)
                        alert('Link copied!')
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <button
                  onClick={closeModal}
                  className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}