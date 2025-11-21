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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-blue-100 text-blue-800'
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
          
          {/* Role Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{role.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className={`px-3 py-1 rounded-full ${getStatusColor(role.status)}`}>
                  {role.status}
                </span>
                <span>Created {new Date(role.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <button
              onClick={() => router.push(`/dashboard/roles/${roleId}/invite`)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              📧 Invite Candidates
            </button>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/dashboard/roles/${roleId}/invite`)}
                  className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                >
                  📧 Invite Candidates
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
                  <span className="text-gray-600">Interview Questions</span>
                  <span className="font-semibold text-gray-900">{questions.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(role.status)}`}>
                    {role.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}