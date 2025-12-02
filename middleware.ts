import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create response to potentially modify
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if needed
  const { data: { user } } = await supabase.auth.getUser()

  // Public routes - no auth required
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
  ]

  // Check if it's a public route
  if (publicRoutes.includes(pathname)) {
    // If logged in and trying to access login/signup, redirect to dashboard
    if (user && (pathname === '/login' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // Interview routes - public (candidates access without login)
  if (pathname.startsWith('/interview/')) {
    return response
  }

  // Webhook routes - public (but should verify signature in route handler)
  if (pathname.startsWith('/api/webhooks/')) {
    return response
  }

  // API routes that don't require auth
  const publicApiRoutes = [
    '/api/auth/signup',
    '/api/interview/', // Interview API routes are accessed by candidates
  ]

  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    return response
  }

  // Protected routes - require authentication

  // Dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    return response
  }

  // Admin API routes - require authentication
  if (pathname.startsWith('/api/admin')) {
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }
    // Additional admin role check is done in the route handlers
    return response
  }

  // Other API routes that require auth
  const protectedApiRoutes = [
    '/api/roles/',
    '/api/candidates/',
  ]

  if (protectedApiRoutes.some(route => pathname.startsWith(route))) {
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }
    return response
  }

  // Health check endpoint - public
  if (pathname === '/api/health') {
    return response
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
