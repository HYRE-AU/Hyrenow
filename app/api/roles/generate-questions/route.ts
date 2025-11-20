import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { jdText } = await request.json()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert technical recruiter. Generate 5-7 specific, behavioral interview questions based on the job description provided. Return ONLY a JSON array of question strings, no other text, no markdown formatting.',
        },
        {
          role: 'user',
          content: `Generate interview questions for this role:\n\n${jdText}`,
        },
      ],
      temperature: 0.7,
    })

    let content = completion.choices[0].message.content
    if (!content) throw new Error('No response from OpenAI')

    // Strip markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const questions = JSON.parse(content)

    return NextResponse.json({ questions })
  } catch (error: any) {
    console.error('Question generation error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}