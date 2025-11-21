import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    // Since we can't directly scrape LinkedIn (requires auth),
    // we'll ask the user to paste the job description text
    // OR we can use a third-party scraping service
    
    // For MVP: We'll use OpenAI to extract info from pasted text
    // In production: Use services like Apify, ScrapingBee, or Bright Data

    // For now, let's fetch the URL and try to extract text
    let jobText = ''
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        
        // Basic HTML cleaning to extract text
        jobText = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
    } catch (fetchError) {
      console.error('Failed to fetch URL:', fetchError)
      return NextResponse.json(
        { error: 'Unable to fetch job posting. Please paste the job description manually.' },
        { status: 400 }
      )
    }

    // Use OpenAI to extract structured info
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract job information from the provided text and return ONLY a JSON object with:
{
  "title": "<job title>",
  "companyName": "<company name>",
  "description": "<full job description including responsibilities, requirements, etc.>"
}

If you cannot find clear information, return empty strings.`
        },
        {
          role: 'user',
          content: jobText.substring(0, 10000) // Limit to avoid token limits
        }
      ],
      temperature: 0.3,
    })

    const content = extraction.choices[0].message.content
    if (!content) throw new Error('No extraction generated')

    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jobData = JSON.parse(cleanContent)

    return NextResponse.json(jobData)
  } catch (error: any) {
    console.error('Job URL parsing error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse job URL' },
      { status: 500 }
    )
  }
}