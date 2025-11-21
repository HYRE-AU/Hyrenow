import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { title, description, count = 5 } = await request.json()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert HR professional creating interview questions. Generate exactly ${count} insightful interview questions designed to extract key information from candidates that will allow evaluation against the job description.

Focus on questions that:
- Assess relevant experience and skills
- Evaluate problem-solving abilities
- Gauge cultural fit
- Uncover specific examples from past work
- Are open-ended to encourage detailed responses

Return ONLY a JSON array of question strings:
["Question 1", "Question 2", ...]`
        },
        {
          role: 'user',
          content: `Job Title: ${title}\n\nJob Description:\n${description}`
        }
      ],
      temperature: 0.7,
    })

    const content = completion.choices[0].message.content
    if (!content) throw new Error('No questions generated')

    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const questions = JSON.parse(cleanContent)

    return NextResponse.json({ questions })
  } catch (error: any) {
    console.error('Question generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate questions' },
      { status: 500 }
    )
  }
}