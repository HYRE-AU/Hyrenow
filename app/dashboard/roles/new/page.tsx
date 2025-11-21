'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewRolePage() {
  const [step, setStep] = useState<'details' | 'questions'>('details')
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  
  // Step 1: Job Details
  const [jobUrl, setJobUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  
  // Step 2: Questions
  const [questions, setQuestions] = useState<Array<{ text: string; order: number }>>([])
  const [newQuestion, setNewQuestion] = useState('')
  
  const router = useRouter()

  async function parseJobUrl() {
    if (!jobUrl.trim()) {
      alert('Please enter a job URL')
      return
    }

    setParsing(true)
    try {
      const response = await fetch('/api/roles/parse-job-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      const data = await response.json()
      setTitle(data.title || '')
      setDescription(data.description || '')
    } catch (error: any) {
      alert(error.message || 'Failed to parse job URL. Please enter details manually.')
    } finally {
      setParsing(false)
    }
  }

  async function generateQuestions() {
    if (!title.trim() || !description.trim()) {
      alert('Please provide job title and description')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/roles/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, count: 5 })
      })

      if (!response.ok) throw new Error('Failed to generate questions')

      const data = await response.json()
      setQuestions(data.questions.map((q: string, i: number) => ({ 
        text: q, 
        order: i 
      })))
      setStep('questions')
    } catch (error) {
      alert('Failed to generate questions')
    } finally {
      setLoading(false)
    }
  }

  function addQuestion() {
    if (!newQuestion.trim()) return
    setQuestions([...questions, { text: newQuestion, order: questions.length }])
    setNewQuestion('')
  }

  function removeQuestion(index: number) {
    const updated = questions.filter((_, i) => i !== index)
    setQuestions(updated.map((q, i) => ({ ...q, order: i })))
  }

  function moveQuestion(index: number, direction: 'up' | 'down') {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...questions]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setQuestions(updated.map((q, i) => ({ ...q, order: i })))
  }

  async function completeRoleCreation() {
    setLoading(true)
    try {
      const supabase = createClient()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!profile) throw new Error('Profile not found')

      // Create role
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .insert({
          org_id: profile.org_id,
          created_by: user.id,
          title,
          jd_text: description,
          status: 'active'
        })
        .select()
        .single()

      if (roleError) throw roleError

      // Create questions
      const questionInserts = questions.map(q => ({
        role_id: role.id,
        text: q.text,
        order_index: q.order,
        source: 'generated'
      }))

      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionInserts)

      if (questionsError) throw questionsError

      // Redirect to role page
      router.push(`/dashboard/roles/${role.id}`)
    } catch (error: any) {
      console.error('Error creating role:', error)
      alert('Failed to create role: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'questions') {
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
            <div className="mb-6">
              <button
                onClick={() => setStep('details')}
                className="text-indigo-600 hover:text-indigo-700 flex items-center gap-2"
              >
                ← Back to Details
              </button>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">Review Interview Questions</h1>
            <p className="text-gray-600 mb-8">
              Customize the questions or reorder them. Add your own if needed.
            </p>

            {/* Questions List */}
            <div className="space-y-4 mb-6">
              {questions.map((q, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 flex items-start gap-4">
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => moveQuestion(index, 'up')}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveQuestion(index, 'down')}
                      disabled={index === questions.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Question {index + 1}</p>
                    <p className="text-gray-900">{q.text}</p>
                  </div>
                  <button
                    onClick={() => removeQuestion(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add Question */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add Custom Question
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Enter your question..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && addQuestion()}
                />
                <button
                  onClick={addQuestion}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Complete Button */}
            <button
              onClick={completeRoleCreation}
              disabled={loading || questions.length === 0}
              className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
            >
              {loading ? 'Creating Role...' : 'Complete & Create Role'}
            </button>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Role</h1>
          <p className="text-gray-600 mb-8">
            Paste a LinkedIn job URL to auto-fill, or enter details manually
          </p>

          {/* Job URL Parser */}
          <div className="mb-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LinkedIn Job URL (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://www.linkedin.com/jobs/view/..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                onClick={parseJobUrl}
                disabled={parsing}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {parsing ? 'Parsing...' : 'Parse'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Or enter job details manually below
            </p>
          </div>

          {/* Job Title */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Senior Software Engineer"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Job Description */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the full job description including responsibilities, requirements, etc."
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Save & Continue */}
          <button
            onClick={generateQuestions}
            disabled={loading || !title.trim() || !description.trim()}
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Generating Questions...' : 'Save & Continue to Questions'}
          </button>
        </div>
      </main>
    </div>
  )
}