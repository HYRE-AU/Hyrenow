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

type KnockoutQuestion = {
  question_text: string
  required_answer: boolean
  order_index: number
}

type Step = 'details' | 'competencies' | 'questions' | 'briefing' | 'knockout' | 'review'

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
  
  // Step 4: Role Briefing (Pitch Notes)
  const [roleBriefing, setRoleBriefing] = useState('')
  
  // Step 5: Knockout Questions
  const [knockoutQuestions, setKnockoutQuestions] = useState<KnockoutQuestion[]>([])
  const [newKnockoutQuestion, setNewKnockoutQuestion] = useState('')
  const [newKnockoutRequiredAnswer, setNewKnockoutRequiredAnswer] = useState(true)
  
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

  function updateCompetency(index: number, field: keyof Competency | string, value: any) {
    const updated = [...competencies]

    if (field === 'name' || field === 'description') {
      updated[index] = { ...updated[index], [field]: value }
    } else if (field.startsWith('bars_rubric.')) {
      const level = field.split('.')[1] as 'level_1' | 'level_2' | 'level_3' | 'level_4'
      updated[index] = {
        ...updated[index],
        bars_rubric: {
          ...updated[index].bars_rubric,
          [level]: {
            ...updated[index].bars_rubric[level],
            description: value
          }
        }
      }
    }

    setCompetencies(updated)
  }

  function addCompetency() {
    const newCompetency: Competency = {
      name: '',
      description: '',
      bars_rubric: {
        level_1: { label: 'Below Expectations', description: '' },
        level_2: { label: 'Meets Expectations', description: '' },
        level_3: { label: 'Exceeds Expectations', description: '' },
        level_4: { label: 'Outstanding', description: '' }
      }
    }
    setCompetencies([...competencies, newCompetency])
  }

  function removeCompetency(index: number) {
    if (competencies.length <= 1) {
      alert('You need at least one competency')
      return
    }
    setCompetencies(competencies.filter((_, i) => i !== index))
  }

  // Knockout Question Functions
  function addKnockoutQuestion() {
    if (!newKnockoutQuestion.trim()) return
    
    const newKQ: KnockoutQuestion = {
      question_text: newKnockoutQuestion,
      required_answer: newKnockoutRequiredAnswer,
      order_index: knockoutQuestions.length
    }
    
    setKnockoutQuestions([...knockoutQuestions, newKQ])
    setNewKnockoutQuestion('')
    setNewKnockoutRequiredAnswer(true)
  }

  function removeKnockoutQuestion(index: number) {
    const updated = knockoutQuestions.filter((_, i) => i !== index)
    setKnockoutQuestions(updated.map((kq, i) => ({ ...kq, order_index: i })))
  }

  function moveKnockoutQuestion(index: number, direction: 'up' | 'down') {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === knockoutQuestions.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...knockoutQuestions]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp

    setKnockoutQuestions(updated.map((kq, i) => ({ ...kq, order_index: i })))
  }

  async function createRole() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        alert('Please log in')
        router.push('/login')
        return
      }

      const response = await fetch('/api/roles/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title,
          description,
          companyName,
          competencies,
          questions: allQuestions,
          knockoutQuestions,
          roleBriefing
        })
      })

      if (!response.ok) throw new Error('Failed to create role')

      const data = await response.json()
      router.push(`/dashboard/roles/${data.roleId}`)
    } catch (error) {
      alert('Failed to create role')
    } finally {
      setLoading(false)
    }
  }

  // STEP 2: Competencies
  if (step === 'competencies') {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="mb-6">
            <button
              onClick={() => setStep('details')}
              className="text-purple-600 hover:text-purple-700 flex items-center gap-2"
            >
              ← Back to Details
            </button>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Competency Matrix</h1>
          <p className="text-gray-600 mb-8">
            Review and customize the competencies used to evaluate candidates
          </p>

          <div className="space-y-6 mb-6">
            {competencies.map((comp, index) => (
              <div key={index} className="border-2 border-purple-200 rounded-xl p-6 bg-purple-50">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 mr-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Competency Name
                    </label>
                    <input
                      type="text"
                      value={comp.name}
                      onChange={(e) => updateCompetency(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <button
                    onClick={() => removeCompetency(index)}
                    className="text-red-500 hover:text-red-700 px-3 py-2"
                  >
                    ✕ Remove
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={comp.description}
                    onChange={(e) => updateCompetency(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <details className="mt-4">
                  <summary className="text-sm font-semibold text-purple-700 cursor-pointer">
                    View BARS Rubric (Scoring Levels)
                  </summary>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['level_1', 'level_2', 'level_3', 'level_4'] as const).map((level) => (
                      <div key={level} className="bg-white p-3 rounded-lg border">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          {comp.bars_rubric[level].label}
                        </label>
                        <textarea
                          value={comp.bars_rubric[level].description}
                          onChange={(e) => updateCompetency(index, `bars_rubric.${level}`, e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                        />
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>

          <button
            onClick={addCompetency}
            className="w-full mb-4 px-6 py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-purple-400 hover:text-purple-600 font-medium"
          >
            + Add Competency
          </button>

          <button
            onClick={generateInterviewQuestions}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
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
              className="text-purple-600 hover:text-purple-700 flex items-center gap-2"
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
                    : 'border-purple-200 bg-purple-50'
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
                        : 'bg-purple-100 text-purple-800'
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

          {/* Continue to Pitch Notes */}
          <button
            onClick={() => setStep('briefing')}
            disabled={allQuestions.length === 0}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
          >
            Continue to Pitch Notes
          </button>
        </div>
      </div>
    )
  }

  // STEP 4: Pitch Notes (Role Briefing)
  if (step === 'briefing') {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="mb-6">
            <button
              onClick={() => setStep('questions')}
              className="text-purple-600 hover:text-purple-700 flex items-center gap-2"
            >
              ← Back to Questions
            </button>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pitch Notes</h1>
          <p className="text-gray-600 mb-2">
            Give candidates context about the company and role before the interview begins.
          </p>
          <p className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg p-3 mb-8">
            🎯 The AI will convert your notes into natural speech and deliver it to candidates at the start of the interview. This saves you from repeating the same pitch on every call.
          </p>

          {/* Pitch Notes Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What should candidates know about this opportunity?
            </label>
            <textarea
              value={roleBriefing}
              onChange={(e) => setRoleBriefing(e.target.value)}
              placeholder={`Example bullet points:
- Company recently raised Series A from [Investors]
- Team of 15, growing to 25 this year
- Role exists because of expansion into APAC market
- Reporting to Head of Marketing based in Sydney
- Opportunity to work with AU/NZ enterprise clients
- Clear path to senior role within 12-18 months`}
              rows={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">
              Write in bullet points or short paragraphs. The AI will deliver this naturally, not word-for-word.
            </p>
          </div>

          {/* What to Include */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">💡 What to include:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <span className="text-teal-600">✓</span>
                <span>Company story & mission</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-600">✓</span>
                <span>Recent funding or growth</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-600">✓</span>
                <span>Why this role exists</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-600">✓</span>
                <span>Team structure & who they'd work with</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-600">✓</span>
                <span>Growth & learning opportunities</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-600">✓</span>
                <span>What makes this exciting</span>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">🎙️ How it works</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• The AI reads this context at the start of the interview</li>
              <li>• It converts your bullet points into natural, conversational speech</li>
              <li>• Candidates arrive at human calls already informed and excited</li>
              <li>• Your live calls can focus on depth, not &quot;what does the company do?&quot;</li>
            </ul>
          </div>

          {/* Continue Button */}
          <button
            onClick={() => setStep('knockout')}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] transition-all duration-200"
          >
            {roleBriefing.trim() ? 'Continue to Pre-Screening' : 'Skip & Continue to Pre-Screening'}
          </button>
        </div>
      </div>
    )
  }

  // STEP 5: Knockout Questions
  if (step === 'knockout') {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="mb-6">
            <button
              onClick={() => setStep('briefing')}
              className="text-purple-600 hover:text-purple-700 flex items-center gap-2"
            >
              ← Back to Pitch Notes
            </button>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pre-Screening Questions</h1>
          <p className="text-gray-600 mb-2">
            Add yes/no questions to filter out candidates who don't meet basic requirements.
          </p>
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-8">
            ⚡ Candidates who fail these questions will be politely rejected before the voice interview, saving you time and AI costs.
          </p>

          {/* Existing Knockout Questions */}
          {knockoutQuestions.length > 0 && (
            <div className="space-y-4 mb-6">
              {knockoutQuestions.map((kq, index) => (
                <div 
                  key={index} 
                  className="border-2 border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => moveKnockoutQuestion(index, 'up')}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveKnockoutQuestion(index, 'down')}
                      disabled={index === knockoutQuestions.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800">
                        Pre-Screen
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        kq.required_answer 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        Must answer: {kq.required_answer ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <p className="text-gray-900">{kq.question_text}</p>
                  </div>
                  <button
                    onClick={() => removeKnockoutQuestion(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Knockout Question */}
          <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 mb-8 bg-amber-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Pre-Screening Question
            </label>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={newKnockoutQuestion}
                onChange={(e) => setNewKnockoutQuestion(e.target.value)}
                placeholder="e.g., Do you have permanent working rights in Malaysia?"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && addKnockoutQuestion()}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">Candidate must answer:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewKnockoutRequiredAnswer(true)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        newKnockoutRequiredAnswer
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Yes ✓
                    </button>
                    <button
                      onClick={() => setNewKnockoutRequiredAnswer(false)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        !newKnockoutRequiredAnswer
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      No ✗
                    </button>
                  </div>
                </div>
                <button
                  onClick={addKnockoutQuestion}
                  className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  Add Question
                </button>
              </div>
            </div>
            
            {/* Example Questions */}
            <div className="mt-4 pt-4 border-t border-amber-200">
              <p className="text-xs text-gray-500 mb-2">Example questions (click to use):</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { text: 'Do you have permanent working rights in Malaysia without sponsorship?', answer: true },
                  { text: 'Are you currently based in Malaysia or willing to relocate?', answer: true },
                  { text: 'Are you open to a salary range of 8,000-9,000 MYR?', answer: true },
                  { text: 'Do you have at least 2 years of agency experience?', answer: true },
                  { text: 'Will you require visa sponsorship?', answer: false },
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setNewKnockoutQuestion(example.text)
                      setNewKnockoutRequiredAnswer(example.answer)
                    }}
                    className="text-xs px-3 py-1.5 bg-white border border-amber-200 rounded-full hover:bg-amber-100 text-gray-700"
                  >
                    {example.text.substring(0, 40)}...
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">💡 How Pre-Screening Works</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Candidates see these questions before starting the voice interview</li>
              <li>• If they fail any question, they get a polite rejection message</li>
              <li>• Only candidates who pass all questions proceed to the AI interview</li>
              <li>• This saves your time and AI interview costs</li>
            </ul>
          </div>

          {/* Create Role */}
          <button
            onClick={createRole}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Creating Role...' : knockoutQuestions.length > 0 ? 'Create Role with Pre-Screening' : 'Create Role (No Pre-Screening)'}
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
        <div className="mb-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            LinkedIn Job URL (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/view/..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={parseJobUrl}
              disabled={parsing}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-50"
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>

        {/* Generate Competencies */}
        <button
          onClick={generateCompetencies}
          disabled={loading || !title.trim() || !description.trim()}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
        >
          {loading ? 'Generating Competency Matrix...' : 'Continue to Competencies'}
        </button>
      </div>
    </div>
  )
}