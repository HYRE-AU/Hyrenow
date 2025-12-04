'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import posthog from 'posthog-js'

type Competency = {
  name: string
  description: string
  weight: number
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

  // UI State
  const [expandedCompetencyIndex, setExpandedCompetencyIndex] = useState<number | null>(null)

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

      posthog.capture('job_description_parsed', {
        job_url: jobUrl,
        parsed_title: data.title,
        parsed_company: data.companyName,
        has_description: !!data.description
      })
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

    if (field === 'name' || field === 'description' || field === 'weight') {
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
      weight: 2,
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

      posthog.capture('role_created', {
        role_id: data.roleId,
        role_title: title,
        company_name: companyName,
        competencies_count: competencies.length,
        interview_questions_count: interviewQuestions.length,
        screening_questions_count: screeningQuestions.length,
        knockout_questions_count: knockoutQuestions.length,
        has_role_briefing: !!roleBriefing
      })

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
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold">1</div>
              <span className="text-purple-600 font-medium">Job Details</span>
            </div>
            <div className="flex-1 h-1 bg-purple-600 mx-3"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold">2</div>
              <span className="text-purple-600 font-medium">Competencies</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-3"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">3</div>
              <span className="text-gray-500">Questions</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-3"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">4</div>
              <span className="text-gray-500">Review</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6 text-white">
            <button
              onClick={() => setStep('details')}
              className="text-purple-200 hover:text-white flex items-center gap-2 mb-4 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Job Details
            </button>
            <h1 className="text-2xl font-bold mb-2">Evaluation Criteria</h1>
            <p className="text-purple-100 text-sm">
              These are the skills and qualities the AI will assess during the interview. Each competency has scoring criteria to ensure fair, consistent evaluation.
            </p>
          </div>

          {/* Explanation Card */}
          <div className="px-8 py-4 bg-purple-50 border-b border-purple-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-purple-900 text-sm">How it works</h3>
                <p className="text-purple-700 text-sm mt-1">
                  The AI asks questions to assess each competency, then scores candidates 1-4 based on their responses.
                  <span className="font-medium"> Priority weights</span> determine how much each competency affects the final score.
                </p>
              </div>
            </div>
          </div>

          {/* Competencies List */}
          <div className="p-8">
            <div className="space-y-4">
              {competencies.map((comp, index) => (
                <div
                  key={index}
                  className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                    expandedCompetencyIndex === index
                      ? 'border-purple-300 shadow-lg shadow-purple-100'
                      : 'border-gray-200 hover:border-purple-200'
                  }`}
                >
                  {/* Competency Header - Always Visible */}
                  <div className="p-5 bg-white">
                    <div className="flex items-start gap-4">
                      {/* Priority Indicator */}
                      <div className={`w-2 h-full min-h-[80px] rounded-full flex-shrink-0 ${
                        comp.weight === 3 ? 'bg-red-500' :
                        comp.weight === 2 ? 'bg-amber-500' : 'bg-gray-300'
                      }`}></div>

                      <div className="flex-1 min-w-0">
                        {/* Name & Priority Row */}
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="text"
                            value={comp.name}
                            onChange={(e) => updateCompetency(index, 'name', e.target.value)}
                            className="text-lg font-semibold text-gray-900 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-purple-500 focus:ring-0 px-0 py-1 flex-1 bg-transparent"
                            placeholder="Competency name"
                          />
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            comp.weight === 3 ? 'bg-red-100 text-red-700' :
                            comp.weight === 2 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {comp.weight === 3 ? 'Must Have' : comp.weight === 2 ? 'Important' : 'Nice to Have'}
                          </span>
                        </div>

                        {/* Description */}
                        <textarea
                          value={comp.description}
                          onChange={(e) => updateCompetency(index, 'description', e.target.value)}
                          rows={2}
                          className="w-full text-sm text-gray-600 border-0 focus:ring-0 px-0 py-1 resize-none bg-transparent"
                          placeholder="Brief description of what this competency measures..."
                        />

                        {/* Priority Selector */}
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-xs text-gray-500 mr-2">Priority:</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateCompetency(index, 'weight', 3)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                comp.weight === 3
                                  ? 'bg-red-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600'
                              }`}
                            >
                              Must Have
                            </button>
                            <button
                              onClick={() => updateCompetency(index, 'weight', 2)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                comp.weight === 2
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-600'
                              }`}
                            >
                              Important
                            </button>
                            <button
                              onClick={() => updateCompetency(index, 'weight', 1)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                comp.weight === 1
                                  ? 'bg-gray-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              Nice to Have
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setExpandedCompetencyIndex(expandedCompetencyIndex === index ? null : index)}
                          className={`p-2 rounded-lg transition-all ${
                            expandedCompetencyIndex === index
                              ? 'bg-purple-100 text-purple-600'
                              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                          }`}
                          title="Edit scoring rubric"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeCompetency(index)}
                          className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all"
                          title="Remove competency"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded BARS Rubric Section */}
                  {expandedCompetencyIndex === index && (
                    <div className="border-t border-gray-100 bg-gray-50 p-5">
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Scoring Rubric
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Define what each score level looks like for this competency
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {([
                          { key: 'level_1', color: 'red', label: '1 - Below' },
                          { key: 'level_2', color: 'amber', label: '2 - Meets' },
                          { key: 'level_3', color: 'green', label: '3 - Exceeds' },
                          { key: 'level_4', color: 'purple', label: '4 - Outstanding' }
                        ] as const).map((level) => (
                          <div
                            key={level.key}
                            className={`bg-white rounded-lg border-2 p-3 ${
                              level.color === 'red' ? 'border-red-200' :
                              level.color === 'amber' ? 'border-amber-200' :
                              level.color === 'green' ? 'border-green-200' : 'border-purple-200'
                            }`}
                          >
                            <div className={`text-xs font-bold mb-2 ${
                              level.color === 'red' ? 'text-red-600' :
                              level.color === 'amber' ? 'text-amber-600' :
                              level.color === 'green' ? 'text-green-600' : 'text-purple-600'
                            }`}>
                              {level.label}
                            </div>
                            <textarea
                              value={comp.bars_rubric[level.key].description}
                              onChange={(e) => updateCompetency(index, `bars_rubric.${level.key}`, e.target.value)}
                              rows={3}
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                              placeholder={`What does a "${level.label.split(' - ')[1]}" response look like?`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Competency Button */}
            <button
              onClick={addCompetency}
              className="w-full mt-4 px-6 py-4 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 font-medium transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Another Competency
            </button>
          </div>

          {/* Footer Actions */}
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {competencies.length} competenc{competencies.length === 1 ? 'y' : 'ies'} configured
              </p>
              <button
                onClick={generateInterviewQuestions}
                disabled={loading || competencies.length === 0}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/25 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Questions...
                  </>
                ) : (
                  <>
                    Continue to Questions
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
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
                placeholder="e.g., Do you have the right to work in this location?"
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
                  { text: 'Do you have the right to work in this location?', answer: true },
                  { text: 'Are you available to start within the required timeframe?', answer: true },
                  { text: 'Do you meet the minimum experience requirements?', answer: true },
                  { text: 'Are you comfortable with the salary range offered?', answer: true },
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