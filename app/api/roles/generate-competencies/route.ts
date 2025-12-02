import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { title, description } = await request.json()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert HR professional creating a competency matrix with BARS (Behaviorally Anchored Rating Scales) for interview evaluation.

Generate exactly 5 core competencies that are most critical for this role based on the job description.

For each competency, provide:
1. A clear name (2-4 words)
2. A brief description (1 sentence)
3. A weight indicating importance: 3 = Critical (must-have for day-one success), 2 = Important (significantly impacts performance), 1 = Nice-to-Have (beneficial but can be developed)
4. A 4-level BARS rubric with behavioral anchors:
   - Level 1 (Below Expectations): Specific observable behaviors
   - Level 2 (Meets Expectations): Specific observable behaviors
   - Level 3 (Exceeds Expectations): Specific observable behaviors
   - Level 4 (Outstanding): Specific observable behaviors

IMPORTANT: Assign weights based on job requirements. Typically 1-2 competencies should be Critical (3), 2-3 should be Important (2), and 0-1 should be Nice-to-Have (1).

Return ONLY valid JSON in this format:
{
  "competencies": [
    {
      "name": "Problem Solving",
      "description": "Ability to analyze complex issues and develop effective solutions",
      "weight": 3,
      "bars_rubric": {
        "level_1": {
          "label": "Below Expectations",
          "description": "Struggles to identify root causes; proposes surface-level solutions without considering alternatives"
        },
        "level_2": {
          "label": "Meets Expectations", 
          "description": "Identifies key issues and develops workable solutions with some guidance"
        },
        "level_3": {
          "label": "Exceeds Expectations",
          "description": "Independently analyzes complex problems, considers multiple perspectives, and implements effective solutions"
        },
        "level_4": {
          "label": "Outstanding",
          "description": "Demonstrates exceptional analytical thinking, anticipates future challenges, and creates innovative solutions that become best practices"
        }
      }
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Job Title: ${title}\n\nJob Description:\n${description}`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    })

    const content = completion.choices[0].message.content
    if (!content) throw new Error('No competencies generated')

    const result = JSON.parse(content)
    
    // Validate we have exactly 5 competencies
    if (!result.competencies || result.competencies.length !== 5) {
      throw new Error('Must generate exactly 5 competencies')
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Competency generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate competencies' },
      { status: 500 }
    )
  }
}