'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (path: string) => {
    if (path === '/dashboard/talent-hub') {
      return pathname.startsWith('/dashboard/talent-hub')
    }
    if (path === '/dashboard') {
      // Home is active for /dashboard and any route except talent-hub
      return pathname === '/dashboard' || (!pathname.startsWith('/dashboard/talent-hub'))
    }
    return false
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex">
      {/* Left Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
        {/* Logo */}
        <div className="p-6">
          <Image
            src="/hyrenow-logo.png"
            alt="HyreNow"
            width={231}
            height={105}
            className="w-full h-auto"
            priority
          />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => router.push('/dashboard')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${
              isActive('/dashboard')
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => router.push('/dashboard/talent-hub')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${
              isActive('/dashboard/talent-hub')
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Talent Hub
          </button>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
