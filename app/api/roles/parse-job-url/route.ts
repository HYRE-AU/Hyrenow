import { NextResponse } from 'next/server'

/**
 * Extract job ID from various LinkedIn URL formats:
 * - https://www.linkedin.com/jobs/view/4099718842
 * - https://www.linkedin.com/jobs/view/software-developer-at-company-4099718842
 * - https://au.linkedin.com/jobs/view/4099718842?...
 */
function extractJobId(url: string): string | null {
  // Match job ID at the end of the path (with or without query params)
  const match = url.match(/linkedin\.com\/jobs\/view\/(?:.*-)?(\d{9,12})(?:\?|$|\/)/i)
  return match ? match[1] : null
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
}

/**
 * Parse LinkedIn guest API HTML response to extract job details
 */
function parseLinkedInHtml(html: string): { title: string; companyName: string; description: string } {
  // Extract job title from h2.top-card-layout__title or h1
  const titleMatch = html.match(
    /<h[12][^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>([^<]+)/i
  ) || html.match(
    /<h[12][^>]*class="[^"]*topcard__title[^"]*"[^>]*>([^<]+)/i
  )
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : ''

  // Extract company name from topcard__org-name-link
  const companyMatch = html.match(
    /<a[^>]*class="[^"]*topcard__org-name-link[^"]*"[^>]*>([^<]+)/i
  ) || html.match(
    /class="[^"]*top-card-layout__company[^"]*"[^>]*>\s*<a[^>]*>([^<]+)/i
  )
  const companyName = companyMatch ? decodeHtmlEntities(companyMatch[1].trim()) : ''

  // Extract description from show-more-less-html__markup div
  const descMatch = html.match(
    /<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<button|<\/section)/i
  )

  let description = ''
  if (descMatch) {
    description = descMatch[1]
      // Convert br tags to newlines
      .replace(/<br\s*\/?>/gi, '\n')
      // Convert block elements to newlines
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<(p|div|li|ul|ol|h[1-6])[^>]*>/gi, '\n')
      // Remove remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
      // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
  }

  return { title, companyName, description }
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Check if it's a LinkedIn URL
    if (!url.includes('linkedin.com/jobs')) {
      return NextResponse.json(
        { error: 'Only LinkedIn job URLs are supported' },
        { status: 400 }
      )
    }

    // Extract job ID from URL
    const jobId = extractJobId(url)
    if (!jobId) {
      return NextResponse.json(
        { error: 'Could not extract job ID from URL. Please ensure it\'s a valid LinkedIn job posting URL.' },
        { status: 400 }
      )
    }

    // Fetch from LinkedIn's guest API (no auth required)
    const guestApiUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`

    const response = await fetch(guestApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Job posting not found. It may have been removed or the URL is incorrect.' },
          { status: 404 }
        )
      }
      throw new Error(`LinkedIn API returned ${response.status}`)
    }

    const html = await response.text()

    // Parse job details from HTML
    const jobData = parseLinkedInHtml(html)

    // Validate we got the required fields
    if (!jobData.title && !jobData.description) {
      return NextResponse.json(
        { error: 'Could not extract job details. The job posting format may have changed.' },
        { status: 500 }
      )
    }

    return NextResponse.json(jobData)
  } catch (error: unknown) {
    console.error('Job URL parsing error:', error)
    const message = error instanceof Error ? error.message : 'Failed to parse job URL'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
