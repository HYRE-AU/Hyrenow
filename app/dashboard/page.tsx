'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = {
  id: string
  title: string
  status: string
  created_at: string
  _count?: {
    interviews: number
  }
}

type Interview = {
  id: string
  status: string
  created_at: string
  candidates: {
    id: string
    name: string
    email: string
  }
  roles: {
    id: string
    title: string
  }
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [rolesPage, setRolesPage] = useState(1)
  const [interviewsPage, setInterviewsPage] = useState(1)
  const [totalRoles, setTotalRoles] = useState(0)
  const [totalInterviews, setTotalInterviews] = useState(0)
  const router = useRouter()
  
  const ITEMS_PER_PAGE = 6

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)
      fetchData(user.id)
    }
    
    getUser()
  }, [router])

  async function fetchData(userId: string) {
    const supabase = createClient()
    
    // Get user's org_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single()

    if (!profile) return

    // Fetch roles with count
    const { data: rolesData, count: rolesCount } = await supabase
      .from('roles')
      .select('*', { count: 'exact' })
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })
      .range((rolesPage - 1) * ITEMS_PER_PAGE, rolesPage * ITEMS_PER_PAGE - 1)

    // Fetch interviews with candidates and roles
    const { data: interviewsData, count: interviewsCount } = await supabase
      .from('interviews')
      .select(`
        id,
        status,
        created_at,
        candidates (
          id,
          name,
          email
        ),
        roles (
          id,
          title
        )
      `, { count: 'exact' })
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })
      .range((interviewsPage - 1) * ITEMS_PER_PAGE, interviewsPage * ITEMS_PER_PAGE - 1)

    setRoles(rolesData || [])
    setInterviews(interviewsData || [])
    setTotalRoles(rolesCount || 0)
    setTotalInterviews(interviewsCount || 0)
    setLoading(false)
  }

  useEffect(() => {
    if (user) {
      fetchData(user.id)
    }
  }, [rolesPage, interviewsPage, user])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'invited': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  const totalRolesPages = Math.ceil(totalRoles / ITEMS_PER_PAGE)
  const totalInterviewsPages = Math.ceil(totalInterviews / ITEMS_PER_PAGE)

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
              HyreNow
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back! 👋
          </h2>
          <p className="text-gray-600">
            Here's what's happening with your interviews
          </p>
        </div>

        {/* Quick Action */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard/roles/new')}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
          >
            + Create New Role
          </button>
        </div>

        {/* Roles Section */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              Active Roles ({totalRoles})
            </h3>
          </div>

          {roles.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center border border-gray-100">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No roles yet</h3>
              <p className="text-gray-600 mb-6">Create your first role to start interviewing candidates</p>
              <button
                onClick={() => router.push('/dashboard/roles/new')}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
              >
                Create First Role
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    onClick={() => router.push(`/dashboard/roles/${role.id}`)}
                    className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-200"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-xl font-bold text-gray-900 line-clamp-2">
                        {role.title}
                      </h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(role.status)}`}>
                        {role.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      Created {new Date(role.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                      <span className="text-sm text-gray-600">View Details</span>
                      <span className="text-indigo-600">→</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Roles Pagination */}
              {totalRolesPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <button
                    onClick={() => setRolesPage(p => Math.max(1, p - 1))}
                    disabled={rolesPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-gray-700">
                    Page {rolesPage} of {totalRolesPages}
                  </span>
                  <button
                    onClick={() => setRolesPage(p => Math.min(totalRolesPages, p + 1))}
                    disabled={rolesPage === totalRolesPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Candidates Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              Recent Candidates ({totalInterviews})
            </h3>
          </div>

          {interviews.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center border border-gray-100">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No candidates yet</h3>
              <p className="text-gray-600">Invite candidates to start conducting interviews</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
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
                          Role
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                          Invited
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {interviews.map((interview) => (
                        <tr key={interview.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">
                              {interview.candidates.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {interview.candidates.email}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => router.push(`/dashboard/roles/${interview.roles.id}`)}
                              className="text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                              {interview.roles.title}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(interview.status)}`}>
                              {interview.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {new Date(interview.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Interviews Pagination */}
              {totalInterviewsPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <button
                    onClick={() => setInterviewsPage(p => Math.max(1, p - 1))}
                    disabled={interviewsPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-gray-700">
                    Page {interviewsPage} of {totalInterviewsPages}
                  </span>
                  <button
                    onClick={() => setInterviewsPage(p => Math.min(totalInterviewsPages, p + 1))}
                    disabled={interviewsPage === totalInterviewsPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}