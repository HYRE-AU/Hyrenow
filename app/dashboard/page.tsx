'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GlassCard, GlassButton, StatusBadge, StatCard } from '@/components/ui'
import { Briefcase, Users, CheckCircle, TrendingUp, Plus, FileText, ArrowRight } from 'lucide-react'

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
  } | null
  roles: {
    id: string
    title: string
  } | null
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
    try {
      const supabase = createClient()

      // Get user's org_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Profile error:', profileError)
        setLoading(false)
        return
      }

      if (!profile) {
        console.error('No profile found for user')
        setLoading(false)
        return
      }

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
      setInterviews((interviewsData as any) || [])
      setTotalRoles(rolesCount || 0)
      setTotalInterviews(interviewsCount || 0)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchData(user.id)
    }
  }, [rolesPage, interviewsPage, user])

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    switch (normalizedStatus) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
      case 'invited': return 'bg-cyan-100 text-cyan-700 border border-cyan-200'
      case 'in_progress': return 'bg-amber-100 text-amber-700 border border-amber-200'
      case 'completed': return 'bg-purple-100 text-purple-700 border border-purple-200'
      case 'rejected': return 'bg-red-100 text-red-700 border border-red-200'
      case 'progressed': return 'bg-purple-100 text-purple-700 border border-purple-200'
      default: return 'bg-gray-100 text-gray-600 border border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <GlassCard className="p-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></div>
            <span className="text-gray-700 font-medium">Loading your dashboard...</span>
          </div>
        </GlassCard>
      </div>
    )
  }

  const totalRolesPages = Math.ceil(totalRoles / ITEMS_PER_PAGE)
  const totalInterviewsPages = Math.ceil(totalInterviews / ITEMS_PER_PAGE)

  // Calculate stats
  const completedInterviews = interviews.filter(i => i.status === 'completed').length
  const inProgressInterviews = interviews.filter(i => i.status === 'in_progress').length
  const activeRoles = roles.filter(r => r.status === 'active').length

  return (
    <div className="min-h-full">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fadeInUp">
          <h2 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome back! 👋
          </h2>
          <p className="text-gray-600 text-lg">
            Here's what's happening with your interviews
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Active Roles"
            value={activeRoles}
            icon={Briefcase}
            description={`${totalRoles} total`}
            gradient="blue"
          />
          <StatCard
            title="Total Candidates"
            value={totalInterviews}
            icon={Users}
            description="All interviews"
            gradient="purple"
          />
          <StatCard
            title="Completed"
            value={completedInterviews}
            icon={CheckCircle}
            description="Finished interviews"
            gradient="emerald"
          />
          <StatCard
            title="In Progress"
            value={inProgressInterviews}
            icon={TrendingUp}
            description="Ongoing interviews"
            gradient="cyan"
          />
        </div>

        {/* Quick Action */}
        <div className="mb-8 animate-fadeInUp">
          <GlassButton
            onClick={() => router.push('/dashboard/roles/new')}
            icon={<Plus className="w-5 h-5" />}
            size="lg"
          >
            Create New Role
          </GlassButton>
        </div>

        {/* Roles Section */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Briefcase className="w-7 h-7 text-purple-600" />
              Active Roles ({totalRoles})
            </h3>
          </div>

          {roles.length === 0 ? (
            <GlassCard className="p-12 text-center animate-scaleIn">
              <div className="mb-4 flex justify-center">
                <div className="bg-gradient-to-br from-[#5B8DEF] to-[#9D6DD9] p-6 rounded-2xl shadow-lg">
                  <FileText className="w-12 h-12 text-white" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No roles yet</h3>
              <p className="text-gray-600 mb-6">Create your first role to start interviewing candidates</p>
              <GlassButton
                onClick={() => router.push('/dashboard/roles/new')}
                icon={<Plus className="w-5 h-5" />}
              >
                Create First Role
              </GlassButton>
            </GlassCard>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map((role, index) => (
                  <GlassCard
                    key={role.id}
                    hover
                    onClick={() => router.push(`/dashboard/roles/${role.id}`)}
                    className={`p-6 animate-fadeInUp`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="bg-gradient-to-br from-[#5B8DEF] to-[#9D6DD9] p-2.5 rounded-lg shrink-0 shadow-md">
                          <Briefcase className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 line-clamp-2">
                          {role.title}
                        </h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <StatusBadge status={role.status as any} />
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      Created {new Date(role.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200/50">
                      <span className="text-sm text-gray-600 font-medium">View Details</span>
                      <ArrowRight className="w-5 h-5 text-purple-600" />
                    </div>
                  </GlassCard>
                ))}
              </div>

              {/* Roles Pagination */}
              {totalRolesPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <GlassButton
                    variant="secondary"
                    onClick={() => setRolesPage(p => Math.max(1, p - 1))}
                    disabled={rolesPage === 1}
                  >
                    Previous
                  </GlassButton>
                  <GlassCard className="px-4 py-2">
                    <span className="text-gray-700 font-medium">
                      Page {rolesPage} of {totalRolesPages}
                    </span>
                  </GlassCard>
                  <GlassButton
                    variant="secondary"
                    onClick={() => setRolesPage(p => Math.min(totalRolesPages, p + 1))}
                    disabled={rolesPage === totalRolesPages}
                  >
                    Next
                  </GlassButton>
                </div>
              )}
            </>
          )}
        </div>

        {/* Candidates Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-7 h-7 text-purple-600" />
              Recent Candidates ({totalInterviews})
            </h3>
          </div>

          {interviews.length === 0 ? (
            <GlassCard className="p-12 text-center animate-scaleIn">
              <div className="mb-4 flex justify-center">
                <div className="bg-gradient-to-br from-[#4DB8D8] to-[#5B8DEF] p-6 rounded-2xl shadow-lg">
                  <Users className="w-12 h-12 text-white" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No candidates yet</h3>
              <p className="text-gray-600">Invite candidates to start conducting interviews</p>
            </GlassCard>
          ) : (
            <>
              <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="glass-card-strong border-b border-gray-200/50">
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
                    <tbody className="divide-y divide-gray-200/30">
                      {interviews.map((interview) => (
                        <tr key={interview.id} className="hover:bg-white/30 transition-all duration-200">
                          <td className="px-6 py-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (interview.candidates) {
                                  router.push(`/dashboard/candidates/${interview.candidates.id}`)
                                }
                              }}
                              className="font-semibold text-gray-900 hover:text-[#9D6DD9] transition-colors text-left cursor-pointer flex items-center gap-2"
                              type="button"
                            >
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5B8DEF] to-[#9D6DD9] flex items-center justify-center text-white text-sm font-bold shadow-md">
                                {interview.candidates?.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              {interview.candidates?.name || 'Unknown'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {interview.candidates?.email || 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => interview.roles && router.push(`/dashboard/roles/${interview.roles.id}`)}
                              className="text-purple-600 hover:text-purple-700 font-medium transition-colors"
                            >
                              {interview.roles?.title || 'Unknown Role'}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={interview.status as any} />
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {new Date(interview.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>

              {/* Interviews Pagination */}
              {totalInterviewsPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <GlassButton
                    variant="secondary"
                    onClick={() => setInterviewsPage(p => Math.max(1, p - 1))}
                    disabled={interviewsPage === 1}
                  >
                    Previous
                  </GlassButton>
                  <GlassCard className="px-4 py-2">
                    <span className="text-gray-700 font-medium">
                      Page {interviewsPage} of {totalInterviewsPages}
                    </span>
                  </GlassCard>
                  <GlassButton
                    variant="secondary"
                    onClick={() => setInterviewsPage(p => Math.min(totalInterviewsPages, p + 1))}
                    disabled={interviewsPage === totalInterviewsPages}
                  >
                    Next
                  </GlassButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}