import { createClient } from '@supabase/supabase-js'

/**
 * Parameters for logging an error
 */
export interface ErrorLogParams {
  endpoint: string
  errorType: string
  errorMessage: string
  errorStack?: string
  interviewId?: string
  interviewSlug?: string
  candidateId?: string
  requestBody?: any
}

/**
 * Sends a Slack alert with error details
 * Uses Slack Block Kit for rich formatting
 */
async function sendSlackAlert(params: ErrorLogParams): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const timestamp = new Date().toISOString()
  const contextParts: string[] = []

  if (params.interviewSlug) {
    contextParts.push(`Interview: \`${params.interviewSlug}\``)
  }
  if (params.interviewId) {
    contextParts.push(`ID: \`${params.interviewId.slice(0, 8)}...\``)
  }
  if (params.candidateId) {
    contextParts.push(`Candidate: \`${params.candidateId.slice(0, 8)}...\``)
  }

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚨 HYRE Error: ${params.errorType}`,
        emoji: true
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Endpoint:*\n\`${params.endpoint}\``
        },
        {
          type: 'mrkdwn',
          text: `*Time:*\n${timestamp}`
        }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error Message:*\n\`\`\`${params.errorMessage.slice(0, 500)}${params.errorMessage.length > 500 ? '...' : ''}\`\`\``
      }
    }
  ]

  // Add context if available
  if (contextParts.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: contextParts.join(' | ')
        }
      ]
    } as any)
  }

  // Add divider at the end
  blocks.push({
    type: 'divider'
  } as any)

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `HYRE Error: ${params.errorType} in ${params.endpoint}`, // Fallback text
        blocks
      })
    })
  } catch (slackError) {
    // Don't let Slack failures break anything
    console.error('[ErrorLogger] Failed to send Slack alert:', slackError)
  }
}

/**
 * Logs an error to the database and sends alerts
 *
 * This function NEVER throws - it catches all errors internally
 * to ensure error logging doesn't break the main application flow.
 *
 * @param params - Error details to log
 * @returns Promise<void>
 *
 * @example
 * await logError({
 *   endpoint: '/api/webhooks/vapi',
 *   errorType: 'evaluation_failure',
 *   errorMessage: 'OpenAI rate limit exceeded',
 *   interviewSlug: 'abc123',
 *   interviewId: 'uuid-here'
 * })
 */
export async function logError(params: ErrorLogParams): Promise<void> {
  // Always log to console as backup
  console.error(`[ErrorLogger] ${params.errorType} in ${params.endpoint}:`, params.errorMessage)
  if (params.errorStack) {
    console.error('[ErrorLogger] Stack:', params.errorStack)
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('[ErrorLogger] Missing Supabase credentials, skipping DB log')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Insert error log into database
    const { error: insertError } = await supabase
      .from('error_logs')
      .insert({
        endpoint: params.endpoint,
        error_type: params.errorType,
        error_message: params.errorMessage,
        error_stack: params.errorStack || null,
        interview_id: params.interviewId || null,
        interview_slug: params.interviewSlug || null,
        candidate_id: params.candidateId || null,
        request_body: params.requestBody || null
      })

    if (insertError) {
      console.error('[ErrorLogger] Failed to insert error log:', insertError)
    }

    // Send Slack alert (async, don't await to avoid blocking)
    sendSlackAlert(params).catch((err) => {
      console.error('[ErrorLogger] Slack alert failed:', err)
    })

  } catch (loggerError) {
    // Never let the error logger itself cause problems
    console.error('[ErrorLogger] Internal error:', loggerError)
  }
}

/**
 * Helper to extract error details from various error types
 */
export function extractErrorDetails(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    }
  }
  if (typeof error === 'string') {
    return { message: error }
  }
  if (typeof error === 'object' && error !== null) {
    return {
      message: JSON.stringify(error),
      stack: undefined
    }
  }
  return { message: 'Unknown error' }
}
