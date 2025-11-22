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
  type: string
  order_index: number
}

type Competency = {
  id: string
  name: string
  description: string
  bars_rubric: {
    level_1: { label: string; description: string }
    level_2: { label: string; description: string }
    level_3: { label: string; description: string }
    level_4: { label: string; description: string }
  }
}

type Interview = {
  id: string
  status: string
  created_at: string
  structured_evaluation: {
    recommendation?: string
  } | null
  candidates: {
    id: string
    name: string
    email: string
  } | null
}

export default function RoleDetailPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'jobDescription' | 'questions' | 'rubric'>('jobDescription')
  const [currentPage, setCurrentPage] = useState(1)
  const candidatesPerPage = 7
  
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

      const { data: competenciesData, error: competenciesError } = await supabase
        .from('competencies')
        .select('*')
        .eq('role_id', roleId)

      if (competenciesError) {
        console.error('Error fetching competencies:', competenciesError)
      }

      const { data: interviewsData, error: interviewsError } = await supabase
        .from('interviews')
        .select(`
          id,
          status,
          created_at,
          structured_evaluation,
          candidates (
            id,
            name,
            email
          )
        `)
        .eq('role_id', roleId)
        .order('created_at', { ascending: false })

      if (interviewsError) {
        console.error('Error fetching interviews:', interviewsError)
      }

      setRole(roleData)
      setQuestions(questionsData || [])
      setCompetencies(competenciesData || [])
      setInterviews((interviewsData as any) || [])
      setLoading(false)
    }

    fetchRoleData()
  }, [roleId])

  const getRoleStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  // Calculate days since role opened
  const getDaysSinceOpened = () => {
    if (!role) return 0
    const opened = new Date(role.created_at)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - opened.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Calculate candidate statistics
  const totalInvited = interviews.length
  const completed = interviews.filter(i => i.status === 'completed').length
  const passed = interviews.filter(i =>
    i.status === 'completed' &&
    i.structured_evaluation?.recommendation &&
    ['strong yes', 'yes'].includes(i.structured_evaluation.recommendation.toLowerCase())
  ).length
  const rejected = interviews.filter(i =>
    i.status === 'completed' &&
    i.structured_evaluation?.recommendation &&
    ['no', 'strong no'].includes(i.structured_evaluation.recommendation.toLowerCase())
  ).length

  // Pagination
  const totalPages = Math.ceil(interviews.length / candidatesPerPage)
  const paginatedInterviews = interviews.slice(
    (currentPage - 1) * candidatesPerPage,
    currentPage * candidatesPerPage
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'invited': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="/dashboard" className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
              HyreNow
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-indigo-600 hover:text-indigo-700 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>

          {/* Role Header with Invite Button */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{role.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className={`px-3 py-1 rounded-full ${getRoleStatusColor(role.status)}`}>
                  {role.status}
                </span>
                <span>Opened {new Date(role.created_at).toLocaleDateString()}</span>
                <span className="text-gray-500">•</span>
                <span>{getDaysSinceOpened()} days open</span>
              </div>
            </div>
            <button
              onClick={() => router.push(`/dashboard/roles/${roleId}/invite`)}
              className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              📧 Invite Candidates
            </button>
          </div>
        </div>

        {/* Statistics Cards - Top Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Candidates Invited</div>
            <div className="text-3xl font-bold text-gray-900">{totalInvited}</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Completed Interviews</div>
            <div className="text-3xl font-bold text-gray-900">{completed}</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Passed / Progressed</div>
            <div className="text-3xl font-bold text-green-600">{passed}</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Rejected</div>
            <div className="text-3xl font-bold text-red-600">{rejected}</div>
          </div>
        </div>

        {/* Invited Candidates Table */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-8">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Invited Candidates</h2>
            <button
              onClick={() => router.push(`/dashboard/roles/${roleId}/candidates`)}
              className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-2"
            >
              View All Candidates →
            </button>
          </div>

          {interviews.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No candidates yet</h3>
              <p className="text-gray-600">Invite candidates to start interviewing</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Candidate
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Invited
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedInterviews.map((interview) => (
                      <tr key={interview.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {interview.candidates?.name || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {interview.candidates?.email || 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(interview.status)}`}>
                            {interview.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {new Date(interview.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => interview.candidates && router.push(`/dashboard/candidates/${interview.candidates.id}`)}
                            className="text-indigo-600 hover:text-indigo-700 font-medium"
                            disabled={!interview.candidates}
                          >
                            View Profile →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {(currentPage - 1) * candidatesPerPage + 1} to {Math.min(currentPage * candidatesPerPage, interviews.length)} of {interviews.length} candidates
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          currentPage === page
                            ? 'bg-indigo-600 text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Job Description / Questions / Competency Rubric - Full Width Below */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Tab Headers */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('jobDescription')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'jobDescription'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Job Description
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'questions'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Questions ({questions.length})
            </button>
            <button
              onClick={() => setActiveTab('rubric')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'rubric'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Competency Rubric ({competencies.length})
            </button>
          </div>

          {/* Job Description Tab */}
          {activeTab === 'jobDescription' && (
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{role.jd_text}</p>
            </div>
          )}

          {/* Questions Tab */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className={`p-4 rounded-xl border ${
                    question.type === 'screening'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gradient-to-r from-indigo-50 to-cyan-50 border-indigo-100'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          question.type === 'screening'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {question.type === 'screening' ? 'Screening' : 'Interview'}
                        </span>
                      </div>
                      <p className="text-gray-800">{question.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rubric Tab - Optimized for wide table */}
          {activeTab === 'rubric' && (
            <div className="overflow-x-auto -mx-8 px-8">
              <table className="w-full border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-50 to-cyan-50">
                    <th className="border border-gray-300 px-3 py-3 text-left font-bold text-gray-900 w-32">
                      Competency
                    </th>
                    <th className="border border-gray-300 px-3 py-3 text-left font-bold text-gray-900 w-48">
                      Description
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-900">
                      <div className="text-sm">Level 1</div>
                      <div className="text-xs font-semibold text-red-700 mt-1">Below Expectations</div>
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-900">
                      <div className="text-sm">Level 2</div>
                      <div className="text-xs font-semibold text-yellow-700 mt-1">Meets Expectations</div>
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-900">
                      <div className="text-sm">Level 3</div>
                      <div className="text-xs font-semibold text-blue-700 mt-1">Exceeds Expectations</div>
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-900">
                      <div className="text-sm">Level 4</div>
                      <div className="text-xs font-semibold text-green-700 mt-1">Outstanding</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {competencies.map((comp, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="border border-gray-300 px-3 py-3 font-semibold text-sm text-gray-900 align-top">
                        {comp.name}
                      </td>
                      <td className="border border-gray-300 px-3 py-3 text-xs text-gray-700 align-top">
                        {comp.description}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 bg-red-50 align-top">
                        {comp.bars_rubric.level_1.description}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 bg-yellow-50 align-top">
                        {comp.bars_rubric.level_2.description}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 bg-blue-50 align-top">
                        {comp.bars_rubric.level_3.description}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 bg-green-50 align-top">
                        {comp.bars_rubric.level_4.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}