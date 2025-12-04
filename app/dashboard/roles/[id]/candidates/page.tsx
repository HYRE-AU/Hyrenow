'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Interview = {
  id: string
  status: string
  created_at: string
  candidates: {
    id: string
    name: string
    email: string
  } | null
}

type Role = {
  id: string
  title: string
}

export default function RoleCandidatesPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const roleId = params.id as string

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      
      // Fetch role
      const { data: roleData } = await supabase
        .from('roles')
        .select('id, title')
        .eq('id', roleId)
        .single()

      // Fetch interviews with candidates
      const { data: interviewsData } = await supabase
        .from('interviews')
        .select(`
          id,
          status,
          created_at,
          candidates (
            id,
            name,
            email
          )
        `)
        .eq('role_id', roleId)
        .order('created_at', { ascending: false })

      setRole(roleData)
      setInterviews((interviewsData as any) || [])
      setLoading(false)
    }

    fetchData()
  }, [roleId])

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    switch (normalizedStatus) {
      case 'invited': return 'bg-cyan-100 text-cyan-700 border border-cyan-200'
      case 'in_progress': return 'bg-amber-100 text-amber-700 border border-amber-200'
      case 'completed': return 'bg-purple-100 text-purple-700 border border-purple-200'
      case 'rejected': return 'bg-red-100 text-red-700 border border-red-200'
      case 'progressed': return 'bg-purple-100 text-purple-700 border border-purple-200'
      default: return 'bg-gray-100 text-gray-600 border border-gray-200'
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <button
            onClick={() => router.push(`/dashboard/roles/${roleId}`)}
            className="text-purple-600 hover:text-purple-700 mb-4 flex items-center gap-2"
          >
            ← Back to Role
          </button>
          <h1 className="text-4xl font-bold text-gray-900">
            Candidates for {role?.title}
          </h1>
          <p className="text-gray-600 mt-2">
            {interviews.length} candidate{interviews.length !== 1 ? 's' : ''} invited
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {interviews.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No candidates yet</h3>
              <p className="text-gray-600 mb-6">Invite candidates to start interviewing</p>
              <button
                onClick={() => router.push(`/dashboard/roles/${roleId}`)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-200"
              >
                Invite Candidate
              </button>
            </div>
          ) : (
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
                  {interviews.map((interview) => (
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
                          className="text-purple-600 hover:text-purple-700 font-medium"
                        >
                          View Profile →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  )
}