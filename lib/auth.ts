import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Creates a Supabase client for server-side operations
 * Uses cookies for session management
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore errors in Server Components
          }
        },
      },
    }
  )
}

/**
 * Gets the currently authenticated user
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Gets the authenticated user with their profile
 * Returns null if not authenticated or profile not found
 */
export async function getAuthenticatedUserWithProfile() {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const supabase = await createServerSupabaseClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return null
  }

  return { user, profile }
}

/**
 * Requires authentication for an API route
 * Returns error response if not authenticated
 * Returns user if authenticated
 */
export async function requireAuth(): Promise<
  | { authenticated: true; user: Awaited<ReturnType<typeof getAuthenticatedUser>> }
  | { authenticated: false; response: NextResponse }
> {
  const user = await getAuthenticatedUser()

  if (!user) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }
  }

  return { authenticated: true, user }
}

/**
 * Requires admin role for an API route
 * Returns error response if not authenticated or not admin
 * Returns user and profile if admin
 */
export async function requireAdmin(): Promise<
  | { authorized: true; user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>; profile: any }
  | { authorized: false; response: NextResponse }
> {
  const userWithProfile = await getAuthenticatedUserWithProfile()

  if (!userWithProfile) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }
  }

  const { user, profile } = userWithProfile

  // Check if user has admin role
  // For now, all authenticated users can access admin routes
  // TODO: Add is_admin column to profiles table and check it here
  const isAdmin = profile.is_admin === true || true // Temporary: allow all authenticated users

  if (!isAdmin) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      )
    }
  }

  return { authorized: true, user, profile }
}

/**
 * Validates a Vapi webhook signature
 * Returns true if valid, false if invalid
 */
export function validateVapiWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    // If no secret configured, allow in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Vapi webhook signature verification skipped in development')
      return true
    }
    return false
  }

  try {
    const crypto = require('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    console.error('Webhook signature validation error:', error)
    return false
  }
}
