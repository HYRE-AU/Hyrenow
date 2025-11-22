'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Competency = {
  name: string
  description: string
  bars_rubric: {
    level_1: { label: string; description: string }
    level_2: { label: string; description: string }
    level_3: { label: string; description: string }
    level_4: { label: string; description: string }
  }
}

type InterviewQuestion = {
  text: string
  competency_name: string
  type: 'interview'
  order: number
}

type ScreeningQuestion = {
  text: string
  type: 'screening'
  order: number
}

type Question = InterviewQuestion | ScreeningQuestion

type Step = 'details' | 'competencies' | 'questions' | 'review'

export default function NewRolePage() {
  const [step, setStep] = useState<Step>('details')
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  
  // Step 1: Job Details
  const [jobUrl, setJobUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [companyName, setCompanyName] = useState('')
  
  // Step 2: Competencies
  const [competencies, setCompetencies] = useState<Competency[]>([])
  
  // Step 3: Questions
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([])
  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[]>([])
  const [newScreeningQuestion, setNewScreeningQuestion] = useState('')
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  
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
      setCompanyName(data.companyName || '')
    } catch (error: any) {
      alert(error.message || 'Failed to parse job URL. Please enter details manually.')
    } finally {
      setParsing(false)
    }
  }

  async function generateCompetencies() {
    if (!title.trim() || !description.trim()) {
      alert('Please provide job title and description')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/roles/generate-competencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      })

      if (!response.ok) throw new Error('Failed to generate competencies')

      const data = await response.json()
      setCompetencies(data.competencies)
      setStep('competencies')
    } catch (error) {
      alert('Failed to generate competencies')
    } finally {
      setLoading(false)
    }
  }

  async function generateInterviewQuestions() {
    setLoading(true)
    try {
      const response = await fetch('/api/roles/generate-interview-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          description,
          competencies 
        })
      })

      if (!response.ok) throw new Error('Failed to generate questions')

      const data = await response.json()
      const questionsWithOrder = data.questions.map((q: any, i: number) => ({
        ...q,
        type: 'interview' as const,
        order: i
      }))
      
      setInterviewQuestions(questionsWithOrder)
      setAllQuestions(questionsWithOrder)
      setStep('questions')
    } catch (error) {
      alert('Failed to generate interview questions')
    } finally {
      setLoading(false)
    }
  }

  function addScreeningQuestion() {
    if (!newScreeningQuestion.trim()) return
    
    const newQuestion: ScreeningQuestion = {
      text: newScreeningQuestion,
      type: 'screening',
      order: allQuestions.length
    }
    
    setScreeningQuestions([...screeningQuestions, newQuestion])
    setAllQuestions([...allQuestions, newQuestion])
    setNewScreeningQuestion('')
  }

  function removeQuestion(index: number) {
    const updated = allQuestions.filter((_, i) => i !== index)
    setAllQuestions(updated.map((q, i) => ({ ...q, order: i })))
    
    // Update separate arrays
    setInterviewQuestions(updated.filter(q => q.type === 'interview') as InterviewQuestion[])
    setScreeningQuestions(updated.filter(q => q.type === 'screening') as ScreeningQuestion[])
  }

  function moveQuestion(index: number, direction: 'up' | 'down') {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === allQuestions.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...allQuestions]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    
    setAllQuestions(updated.map((q, i) => ({ ...q, order: i })))
  }

  async function createRole() {
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
          company_name: companyName || null,
          status: 'active'
        })
        .select()
        .single()

      if (roleError) throw roleError

      // Create competencies
      const competencyInserts = competencies.map(c => ({
        role_id: role.id,
        name: c.name,
        description: c.description,
        bars_rubric: c.bars_rubric
      }))

      const { data: createdCompetencies, error: competenciesError } = await supabase
        .from('competencies')
        .insert(competencyInserts)
        .select()

      if (competenciesError) throw competenciesError

      // Create competency name to ID map
      const competencyMap = new Map(
        createdCompetencies.map(c => [c.name, c.id])
      )

      // Create questions
      const questionInserts = allQuestions.map(q => ({
        role_id: role.id,
        text: q.text,
        order_index: q.order,
        type: q.type,
        competency_id: q.type === 'interview' 
          ? competencyMap.get((q as InterviewQuestion).competency_name) 
          : null,
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

  // STEP 2: Competencies Review
  if (step === 'competencies') {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="mb-6">
              <button
                onClick={() => setStep('details')}
                className="text-indigo-600 hover:text-indigo-700 flex items-center gap-2"
              >
                ← Back to Details
              </button>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">Review Competency Matrix</h1>
            <p className="text-gray-600 mb-8">
              These competencies with BARS rubrics will be used to evaluate candidates
            </p>

            {/* Competency Table */}
            <div className="overflow-x-auto mb-8">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-50 to-cyan-50">
                    <th className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-900 w-48">
                      Competency
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-bold text-gray-900 w-40">
                      Description
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">
                      <div>Level 1</div>
                      <div className="text-xs font-semibold text-red-700 mt-1">Below Expectations</div>
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">
                      <div>Level 2</div>
                      <div className="text-xs font-semibold text-yellow-700 mt-1">Meets Expectations</div>
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">
                      <div>Level 3</div>
                      <div className="text-xs font-semibold text-blue-700 mt-1">Exceeds Expectations</div>
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">
                      <div>Level 4</div>
                      <div className="text-xs font-semibold text-green-700 mt-1">Outstanding</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {competencies.map((comp, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">
                        {comp.name}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                        {comp.description}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 bg-red-50">
                        {comp.bars_rubric.level_1.description}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 bg-yellow-50">
                        {comp.bars_rubric.level_2.description}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 bg-blue-50">
                        {comp.bars_rubric.level_3.description}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700 bg-green-50">
                        {comp.bars_rubric.level_4.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={generateInterviewQuestions}
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
            >
              {loading ? 'Generating Questions...' : 'Continue to Questions'}
            </button>
          </div>
      </div>
    )
  }

  // STEP 3: Questions Setup
  if (step === 'questions') {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="mb-6">
              <button
                onClick={() => setStep('competencies')}
                className="text-indigo-600 hover:text-indigo-700 flex items-center gap-2"
              >
                ← Back to Competencies
              </button>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">Setup Interview Questions</h1>
            <p className="text-gray-600 mb-8">
              Arrange questions in order. Add screening questions for logistics.
            </p>

            {/* Questions List */}
            <div className="space-y-4 mb-6">
              {allQuestions.map((q, index) => (
                <div 
                  key={index} 
                  className={`border-2 rounded-lg p-4 flex items-start gap-4 ${
                    q.type === 'screening' 
                      ? 'border-blue-200 bg-blue-50' 
                      : 'border-indigo-200 bg-indigo-50'
                  }`}
                >
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
                      disabled={index === allQuestions.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        q.type === 'screening'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {q.type === 'screening' ? 'Screening' : 'Interview'}
                      </span>
                      {q.type === 'interview' && (
                        <span className="text-xs text-gray-600">
                          → {(q as InterviewQuestion).competency_name}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900">{q.text}</p>
                  </div>
                  {q.type === 'screening' && (
                    <button
                      onClick={() => removeQuestion(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Screening Question */}
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 mb-8 bg-blue-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add Screening Question (logistics only, not scored)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newScreeningQuestion}
                  onChange={(e) => setNewScreeningQuestion(e.target.value)}
                  placeholder="e.g., Are you comfortable with 4 days in office?"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && addScreeningQuestion()}
                />
                <button
                  onClick={addScreeningQuestion}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Create Role */}
            <button
              onClick={createRole}
              disabled={loading || allQuestions.length === 0}
              className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
            >
              {loading ? 'Creating Role...' : 'Create Role'}
            </button>
          </div>
      </div>
    )
  }

  // STEP 1: Job Details
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
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

          {/* Company Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Corporation"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be used in candidate invitation emails
            </p>
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

          {/* Generate Competencies */}
          <button
            onClick={generateCompetencies}
            disabled={loading || !title.trim() || !description.trim()}
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Generating Competency Matrix...' : 'Continue to Competencies'}
          </button>
        </div>
    </div>
  )
}