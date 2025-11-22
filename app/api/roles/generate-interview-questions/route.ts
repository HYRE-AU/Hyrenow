import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { title, description, competencies } = await request.json()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert HR professional creating behavioral interview questions.

Generate exactly 5 interview questions (one per competency) that will help evaluate candidates against the provided competency matrix.

Requirements:
- Each question must be behavioral/situational (e.g., "Tell me about a time when...")
- Questions should elicit STAR-method responses (Situation, Task, Action, Result)
- Questions must be open-ended and require detailed answers
- Each question maps to ONE specific competency

Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "text": "Tell me about a time when you had to solve a complex technical problem with limited information. How did you approach it?",
      "competency_name": "Problem Solving"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Job Title: ${title}\n\nJob Description:\n${description}\n\nCompetencies:\n${JSON.stringify(competencies, null, 2)}`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    })

    const content = completion.choices[0].message.content
    if (!content) throw new Error('No questions generated')

    const result = JSON.parse(content)
    
    if (!result.questions || result.questions.length !== 5) {
      throw new Error('Must generate exactly 5 questions')
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Question generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate questions' },
      { status: 500 }
    )
  }
}