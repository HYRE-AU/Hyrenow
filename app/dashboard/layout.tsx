'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Home, Sparkles, LogOut } from 'lucide-react'

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
    <div className="h-screen gradient-mesh flex overflow-hidden">
      {/* Left Sidebar Navigation */}
      <aside className="w-64 glass-card-strong border-r border-white/20 h-full flex flex-col shadow-glow-purple">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200/30">
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
        <nav className="flex-1 px-4 py-6 space-y-2">
          <button
            onClick={() => router.push('/dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
              isActive('/dashboard')
                ? 'bg-gradient-to-r from-[#5B8DEF] to-[#9D6DD9] text-white shadow-glow-purple scale-[1.02]'
                : 'text-gray-700 hover:bg-white/50 hover:scale-[1.01]'
            }`}
          >
            <Home className="w-5 h-5" />
            Home
          </button>
          <button
            onClick={() => router.push('/dashboard/talent-hub')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
              isActive('/dashboard/talent-hub')
                ? 'bg-gradient-to-r from-[#5B8DEF] to-[#9D6DD9] text-white shadow-glow-purple scale-[1.02]'
                : 'text-gray-700 hover:bg-white/50 hover:scale-[1.01]'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            Talent Hub
          </button>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200/30 space-y-2">
          {user && (
            <div className="glass-card px-4 py-3 rounded-xl mb-2">
              <p className="text-xs text-gray-500 mb-1">Signed in as</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:text-red-600 hover:bg-red-50/50 rounded-xl transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-full">
        {children}
      </main>
    </div>
  )
}
