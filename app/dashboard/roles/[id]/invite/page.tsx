'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Candidate = {
  firstName: string
  lastName: string
  email: string
  id?: string
  slug?: string
  error?: string
}

type Role = {
  id: string
  title: string
  org_id: string
  company_name?: string
}

export default function InviteCandidatesPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([
    { firstName: '', lastName: '', email: '' }
  ])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'input' | 'success'>('input')
  const [orgName, setOrgName] = useState('')
  
  const router = useRouter()
  const params = useParams()
  const roleId = params.id as string

  useEffect(() => {
    async function fetchRole() {
      const supabase = createClient()
      const { data } = await supabase
        .from('roles')
        .select('id, title, org_id, company_name')
        .eq('id', roleId)
        .single()

      if (data) {
        setRole(data)
        setOrgName(data.company_name || 'Our Company')
      }
    }
    fetchRole()
  }, [roleId])

  function addCandidate() {
    setCandidates([...candidates, { firstName: '', lastName: '', email: '' }])
  }

  function removeCandidate(index: number) {
    if (candidates.length === 1) return
    setCandidates(candidates.filter((_, i) => i !== index))
  }

  function updateCandidate(index: number, field: keyof Candidate, value: string) {
    const updated = [...candidates]
    updated[index] = { ...updated[index], [field]: value }
    setCandidates(updated)
  }

  async function inviteCandidates() {
    // Validate
    const valid = candidates.every(c =>
      c.firstName.trim() && c.lastName.trim() && c.email.trim() && c.email.includes('@')
    )

    if (!valid) {
      alert('Please fill in all fields with valid information')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      // Get the user's session for auth token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        alert('You must be logged in to invite candidates')
        return
      }

      // Call the API route with all candidates at once
      const response = await fetch('/api/candidates/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          roleId,
          candidates
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite candidates')
      }

      // Map results back to candidate format
      const results: Candidate[] = data.results.map((result: any) => ({
        firstName: result.firstName,
        lastName: result.lastName,
        email: result.email,
        id: result.id,
        slug: result.slug,
        error: result.error
      }))

      setCandidates(results)
      setStep('success')
    } catch (error: any) {
      alert('Failed to invite candidates: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getMailtoLink = (candidate: Candidate) => {
    if (!candidate.slug) return '#'

    const interviewLink = `${process.env.NEXT_PUBLIC_APP_URL}/interview/${candidate.slug}`
    const subject = `Interview for ${role?.title} at ${orgName}`
    const body = `Hi ${candidate.firstName},

We'd like to invite you to complete a voice interview for the ${role?.title} position at ${orgName}.

Click here to start your interview:
${interviewLink}

The interview takes approximately 15-20 minutes. Please complete it within the next 7 days.

Best regards,
The ${orgName} Team`

    return `mailto:${candidate.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (step === 'success') {
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

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {candidates.length} Candidate{candidates.length > 1 ? 's' : ''} Invited!
              </h1>
              <p className="text-gray-600">
                Send interview links to each candidate
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {candidates.map((candidate, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {candidate.firstName} {candidate.lastName}
                      </h3>
                      <p className="text-sm text-gray-600">{candidate.email}</p>
                    </div>
                    {candidate.error ? (
                      <span className="text-red-600 text-sm">❌ Error: {candidate.error}</span>
                    ) : (
                      <span className="text-green-600 text-sm">✅ Invited</span>
                    )}
                  </div>

                  {candidate.slug && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={`${process.env.NEXT_PUBLIC_APP_URL}/interview/${candidate.slug}`}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL}/interview/${candidate.slug}`)
                            alert('Link copied!')
                          }}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700"
                        >
                          Copy Link
                        </button>
                      </div>
                      <a
                        href={getMailtoLink(candidate)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                      >
                        ✉️ Send Email to {candidate.firstName}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => router.push(`/dashboard/roles/${roleId}`)}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Back to Role
              </button>
              <button
                onClick={() => {
                  setCandidates([{ firstName: '', lastName: '', email: '' }])
                  setStep('input')
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-lg font-medium hover:shadow-lg"
              >
                Invite More Candidates
              </button>
            </div>
          </div>
        </main>
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="mb-8">
            <button
              onClick={() => router.push(`/dashboard/roles/${roleId}`)}
              className="text-indigo-600 hover:text-indigo-700 flex items-center gap-2"
            >
              ← Back to Role
            </button>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Invite Candidates</h1>
          <p className="text-gray-600 mb-2">
            for <span className="font-semibold">{role.title}</span>
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Add as many candidates as you'd like to invite
          </p>

          <div className="space-y-4 mb-6">
            {candidates.map((candidate, index) => (
              <div key={index} className="border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Candidate {index + 1}</h3>
                  {candidates.length > 1 && (
                    <button
                      onClick={() => removeCandidate(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={candidate.firstName}
                      onChange={(e) => updateCandidate(index, 'firstName', e.target.value)}
                      placeholder="John"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={candidate.lastName}
                      onChange={(e) => updateCandidate(index, 'lastName', e.target.value)}
                      placeholder="Doe"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={candidate.email}
                    onChange={(e) => updateCandidate(index, 'email', e.target.value)}
                    placeholder="john.doe@email.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addCandidate}
            className="w-full mb-6 px-6 py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-indigo-400 hover:text-indigo-600 font-medium"
          >
            + Add Another Candidate
          </button>

          <button
            onClick={inviteCandidates}
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Inviting Candidates...' : `Invite ${candidates.length} Candidate${candidates.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </main>
    </div>
  )
}