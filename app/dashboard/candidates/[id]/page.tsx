'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GlassCard, GlassButton, StatusBadge, CircularProgress } from '@/components/ui'
import {
  ArrowLeft, User, Mail, Calendar, FileText, Clock,
  CheckCircle2, AlertTriangle, TrendingUp, MessageSquare,
  Copy, ExternalLink, ChevronDown, ChevronRight, Scale
} from 'lucide-react'

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
  recording_url: string | null  // <-- ADD THIS LINE
  roles: {
    id: string
    title: string
    company_name: string | null
  } | null
}

export default function CandidateProfilePage() {
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedInterview, setExpandedInterview] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
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
    recording_url,
    roles (
      id,
      title,
      company_name
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
      const companyName = interview.roles?.company_name || 'the company'

      const response = await fetch('/api/interview/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: interview.id,
          candidateName: candidate!.name,
          candidateEmail: candidate!.email,
          roleTitle: interview.roles?.title || 'the position',
          companyName: companyName
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
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <GlassCard className="p-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></div>
            <span className="text-gray-700 font-medium">Loading candidate profile...</span>
          </div>
        </GlassCard>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <GlassCard className="p-8 text-center">
          <div className="text-red-600 font-semibold">Candidate not found</div>
        </GlassCard>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    switch (normalizedStatus) {
      case 'invited': return 'bg-cyan-100 text-cyan-700 border border-cyan-200'
      case 'in_progress': return 'bg-amber-100 text-amber-700 border border-amber-200'
      case 'completed': return 'bg-purple-100 text-purple-700 border border-purple-200'
      case 'progressed': return 'bg-purple-100 text-purple-700 border border-purple-200'
      case 'rejected': return 'bg-red-100 text-red-700 border border-red-200'
      default: return 'bg-gray-100 text-gray-600 border border-gray-200'
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
      case 'borderline': return 'bg-amber-100 text-amber-800 border-amber-300'
      case 'no': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'strong no': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  return (
    <div className="min-h-screen gradient-mesh">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 animate-fadeInUp">
          <GlassButton
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Dashboard
          </GlassButton>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Candidate Info */}
          <div className="lg:col-span-1 space-y-6">
            <GlassCard className="p-8 animate-scaleIn">
              {/* Avatar Header */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#5B8DEF] to-[#9D6DD9] flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-glow-purple">
                  {candidate.name[0]?.toUpperCase()}
                </div>
                <h1 className="text-2xl font-bold text-gray-900 text-center">{candidate.name}</h1>
                <div className="flex items-center gap-2 mt-2 text-gray-600">
                  <Mail className="w-4 h-4" />
                  <p className="text-sm">{candidate.email}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-4 pt-6 border-t border-gray-200/50">
                <div className="flex items-center justify-between p-3 glass-card rounded-xl">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium">Member Since</span>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm">
                    {new Date(candidate.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 glass-card rounded-xl">
                  <div className="flex items-center gap-2 text-gray-600">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm font-medium">Total Interviews</span>
                  </div>
                  <span className="font-semibold text-purple-600 text-sm">
                    {interviews.length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 glass-card rounded-xl">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                  <span className="font-semibold text-emerald-600 text-sm">
                    {interviews.filter(i => i.status === 'completed' || i.status === 'progressed' || i.status === 'rejected').length}
                  </span>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6 animate-scaleIn" style={{ animationDelay: '0.1s' }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Resume / CV
              </h3>
              {candidate.cv_url ? (
                <GlassCard className="p-4 hover:scale-[1.02] transition-transform cursor-pointer">
                  <a
                    href={candidate.cv_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3"
                  >
                    <div className="bg-gradient-to-br from-[#5B8DEF] to-[#9D6DD9] p-3 rounded-xl shadow-md">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">Resume.pdf</p>
                      <p className="text-xs text-gray-600">Click to view</p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-[#9D6DD9]" />
                  </a>
                </GlassCard>
              ) : (
                <div className="text-center p-6 glass-card rounded-xl">
                  <div className="bg-gray-200 p-4 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 font-medium">No CV uploaded yet</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Will appear after candidate starts interview
                  </p>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Right Column - Interviews */}
          <div className="lg:col-span-2">
            <GlassCard className="p-8 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <TrendingUp className="w-7 h-7 text-purple-600" />
                Interview History ({interviews.length})
              </h2>

              {interviews.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-gradient-to-br from-[#5B8DEF] to-[#9D6DD9] p-6 rounded-2xl w-20 h-20 mx-auto mb-4 flex items-center justify-center shadow-lg">
                    <MessageSquare className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No interviews yet</h3>
                  <p className="text-gray-600">This candidate hasn&apos;t been invited to any roles</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {interviews.map((interview) => (
                    <GlassCard
                      key={interview.id}
                      className="overflow-hidden"
                    >
                      {/* Interview Summary Card - Always Visible */}
                      <div className="glass-card-strong p-6">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-xl font-bold text-gray-900">
                                {interview.roles?.title || 'Unknown Role'}
                              </h3>
                              <StatusBadge status={interview.status as any} />
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                <span>{getStatusDateInfo(interview).label} {new Date(getStatusDateInfo(interview).date).toLocaleDateString()}</span>
                              </div>
                              {interview.duration_seconds && (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-4 h-4" />
                                  <span>{formatDuration(interview.duration_seconds)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Key Metrics */}
                        {interview.structured_evaluation && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Score with Circular Progress */}
                            {interview.score !== null && (
                              <div className="flex justify-center">
                                <CircularProgress value={interview.score} size={140} />
                              </div>
                            )}

{/* Recommendation Badge */}
<div className="flex flex-col justify-center">
  <p className="text-sm text-gray-600 mb-3 font-medium">Recommendation</p>
  <div className={`glass-card p-4 rounded-xl text-center border-2 ${getRecommendationColor(interview.structured_evaluation.recommendation)}`}>
    <div className="text-lg font-bold flex items-center justify-center gap-2">
      {(interview.structured_evaluation.recommendation === 'strong yes' || interview.structured_evaluation.recommendation === 'yes') && <CheckCircle2 className="w-6 h-6" />}
      {interview.structured_evaluation.recommendation === 'borderline' && <Scale className="w-6 h-6" />}
      {(interview.structured_evaluation.recommendation === 'no' || interview.structured_evaluation.recommendation === 'strong no') && <AlertTriangle className="w-6 h-6" />}
      {interview.structured_evaluation.recommendation?.toUpperCase()}
    </div>
    {interview.structured_evaluation.confidence && (
      <p className="text-xs mt-2 opacity-75">
        {interview.structured_evaluation.confidence} confidence
      </p>
    )}
  </div>
</div>
                          </div>
                        )}

{/* Borderline Preview */}
{interview.structured_evaluation?.recommendation === 'borderline' && (
  <GlassCard className="p-5 mb-6 bg-amber-50/50 border-2 border-amber-200">
    <p className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
      <Scale className="w-5 h-5 text-amber-600" />
      Why Borderline - Human Review Needed
    </p>
    {interview.structured_evaluation.borderline_triggers?.map((trigger: string, idx: number) => (
      <p key={idx} className="text-sm text-amber-800 mb-2">• {trigger}</p>
    ))}
    {interview.structured_evaluation.review_focus && (
      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>📋 Review Focus:</strong> {interview.structured_evaluation.review_focus}
        </p>
      </div>
    )}
  </GlassCard>
)}

{/* No/Strong No - Key Concerns Preview */}
{(interview.structured_evaluation?.recommendation === 'no' || interview.structured_evaluation?.recommendation === 'strong no') && 
 interview.structured_evaluation?.reasons_not_to_proceed?.length > 0 && (
  <GlassCard className="p-5 mb-6 bg-red-50/50 border-2 border-red-200">
    <p className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
      <AlertTriangle className="w-5 h-5 text-red-600" />
      Key Concerns
    </p>
    <ul className="space-y-2">
      {interview.structured_evaluation.reasons_not_to_proceed.slice(0, 3).map((reason: string, idx: number) => (
        <li key={idx} className="text-sm text-red-800 flex gap-2 items-start">
          <span>•</span>
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  </GlassCard>
)}

                        {/* Action Buttons */}
                        {(interview.status === 'completed') && interview.structured_evaluation && (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <GlassButton
                              onClick={() => handleProceed(interview)}
                              disabled={actionLoading === interview.id}
                              loading={actionLoading === interview.id}
                              className="flex-1 !bg-gradient-to-r !from-[#47C68D] !to-[#6DD3A5]"
                              icon={<CheckCircle2 className="w-5 h-5" />}
                            >
                              {actionLoading === interview.id ? 'Processing...' : 'Proceed to Interview'}
                            </GlassButton>
                            <GlassButton
                              onClick={() => handleReject(interview)}
                              disabled={actionLoading === interview.id}
                              loading={actionLoading === interview.id}
                              variant="destructive"
                              className="flex-1"
                            >
                              {actionLoading === interview.id ? 'Processing...' : 'Send Rejection'}
                            </GlassButton>
                          </div>
                        )}

                        {interview.status === 'progressed' && (
                          <GlassCard className="bg-purple-50/50 border-2 border-purple-300 p-4">
                            <p className="text-sm text-purple-800 font-medium flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5" />
                              Marked as progressed - Next: Schedule interview with hiring manager
                            </p>
                          </GlassCard>
                        )}

                        {interview.status === 'rejected' && (
                          <GlassCard className="bg-red-50/50 border-2 border-red-300 p-4">
                            <p className="text-sm text-red-800 font-medium flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5" />
                              Candidate rejected - Rejection email was sent
                            </p>
                          </GlassCard>
                        )}

                        {/* View Full Evaluation Toggle */}
                        {interview.structured_evaluation && (
                          <GlassButton
                            variant="ghost"
                            onClick={() => setExpandedInterview(expandedInterview === interview.id ? null : interview.id)}
                            className="w-full mt-4"
                            icon={expandedInterview === interview.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          >
                            {expandedInterview === interview.id ? 'Hide Full Evaluation' : 'View Full Evaluation'}
                          </GlassButton>
                        )}
                      </div>

                      {/* Expanded Full Evaluation */}
                      {expandedInterview === interview.id && interview.structured_evaluation && (
                        <div className="border-t border-gray-200/50 p-6 bg-white/30 space-y-6">
                          {/* Full Reasons to Proceed */}
                          {interview.structured_evaluation.reasons_to_proceed?.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                All Reasons to Proceed
                              </h4>
                              <ul className="space-y-3">
                                {interview.structured_evaluation.reasons_to_proceed.map((reason: string, idx: number) => (
                                  <li key={idx} className="flex gap-3 text-gray-700">
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Flags/Risks */}
                          {interview.structured_evaluation.flags_risks?.length > 0 && (
                            <GlassCard className="bg-orange-50/50 border-2 border-orange-200 p-4">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-6 h-6 text-orange-600" />
                                Flags & Risks
                              </h4>
                              <ul className="space-y-3">
                                {interview.structured_evaluation.flags_risks.map((flag: string, idx: number) => (
                                  <li key={idx} className="flex gap-3 text-gray-700">
                                    <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                                    </div>
                                    <span>{flag}</span>
                                  </li>
                                ))}
                              </ul>
                            </GlassCard>
                          )}

                          {/* Borderline - Considerations For/Against (Expanded) */}
{interview.structured_evaluation.recommendation === 'borderline' && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {interview.structured_evaluation.considerations_for?.length > 0 && (
      <GlassCard className="p-4 bg-green-50/50 border-2 border-green-200">
        <h4 className="text-md font-semibold text-green-900 mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          Considerations For
        </h4>
        <ul className="space-y-2">
          {interview.structured_evaluation.considerations_for.map((item: string, idx: number) => (
            <li key={idx} className="text-sm text-green-800 flex gap-2">
              <span className="text-green-600">+</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    )}
    {interview.structured_evaluation.considerations_against?.length > 0 && (
      <GlassCard className="p-4 bg-red-50/50 border-2 border-red-200">
        <h4 className="text-md font-semibold text-red-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Considerations Against
        </h4>
        <ul className="space-y-2">
          {interview.structured_evaluation.considerations_against.map((item: string, idx: number) => (
            <li key={idx} className="text-sm text-red-800 flex gap-2">
              <span className="text-red-600">−</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    )}
  </div>
)}

{/* Competency Breakdown with Weights */}
{interview.structured_evaluation.competency_scores?.length > 0 && (
  <div>
    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
      📊 Competency Breakdown
    </h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {interview.structured_evaluation.competency_scores.map((cs: any, idx: number) => (
        <GlassCard 
          key={idx} 
          className={`p-4 border-l-4 ${
            cs.weight === 3 ? 'border-red-500' : 
            cs.weight === 2 ? 'border-amber-500' : 'border-gray-400'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold text-gray-900">{cs.competency_name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                cs.weight === 3 ? 'bg-red-100 text-red-700' :
                cs.weight === 2 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {cs.weight === 3 ? '🔴 Critical' : cs.weight === 2 ? '🟠 Important' : '🟢 Nice-to-Have'} ({cs.weight}×)
              </span>
            </div>
            <span className="text-lg font-bold text-gray-900">{cs.raw_score}/4</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className={`h-2 rounded-full ${
                cs.raw_score >= 3 ? 'bg-green-500' : 
                cs.raw_score >= 2 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${(cs.raw_score / 4) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Contribution: {cs.weighted_contribution}/{cs.max_contribution} ({Math.round((cs.weighted_contribution / cs.max_contribution) * 100)}%)
          </p>
        </GlassCard>
      ))}
    </div>
  </div>
)}

                          {/* Question Performance */}
                          {interview.structured_evaluation.question_evaluations?.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <MessageSquare className="w-6 h-6 text-purple-600" />
                                Question-by-Question Performance
                              </h4>
                              <div className="space-y-4">
                                {interview.structured_evaluation.question_evaluations.map((qe: any, idx: number) => (
                                  <GlassCard key={idx} className="p-4 border-l-4 border-purple-500">
                                    <div className="flex justify-between items-start mb-2">
                                      <p className="font-semibold text-gray-900">Q{idx + 1}: {qe.question}</p>
                                      {qe.answer_duration_seconds > 0 && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full font-medium ml-2 flex items-center gap-1 shrink-0">
                                          <Clock className="w-3 h-3" />
                                          {formatDuration(qe.answer_duration_seconds)}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 leading-relaxed">{qe.evaluation}</p>
                                  </GlassCard>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Audio Recording */}
{interview.recording_url && (
  <GlassCard className="p-4 bg-gradient-to-r from-purple-50/50 to-blue-50/50">
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        🎧 Interview Recording
      </h4>
      <span className="text-xs text-gray-500 bg-white/50 px-2 py-1 rounded-full">
        Listen to assess communication quality
      </span>
    </div>
    <audio 
      controls 
      src={interview.recording_url}
      className="w-full"
      preload="metadata"
    >
      Your browser does not support the audio element.
    </audio>
  </GlassCard>
)}

{/* Transcript */}
                          {interview.transcript && (
                            <GlassCard className="p-4">
                              <details>
                                <summary className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-purple-600 flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-purple-600" />
                                  View Full Transcript
                                </summary>
                                <div className="mt-4 glass-card rounded-lg p-4 max-h-96 overflow-y-auto">
                                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                                    {typeof interview.transcript === 'object' ? interview.transcript.text : interview.transcript}
                                  </pre>
                                </div>
                              </details>
                            </GlassCard>
                          )}
                        </div>
                      )}

                      {/* Invited Status - Show Link */}
                      {interview.status === 'invited' && (
                        <div className="glass-card-strong p-6 border-t border-gray-200/50">
                          <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Interview Link
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={`${process.env.NEXT_PUBLIC_APP_URL}/interview/${interview.slug}`}
                              readOnly
                              className="flex-1 px-4 py-3 glass-card rounded-xl text-sm font-mono"
                            />
                            <GlassButton
                              onClick={(e) => {
                                e && e.stopPropagation()
                                navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL}/interview/${interview.slug}`)
                                alert('Link copied!')
                              }}
                              icon={<Copy className="w-4 h-4" />}
                            >
                              Copy
                            </GlassButton>
                          </div>
                        </div>
                      )}
                    </GlassCard>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  )
}