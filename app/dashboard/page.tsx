'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)
      setLoading(false)
    }
    
    getUser()
  }, [router])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
              HyreNow
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to your Dashboard! 🎉
          </h2>
          <p className="text-gray-600 mb-6">
            You're successfully logged in.
          </p>
          
          <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-xl p-6 border border-indigo-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Account</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Email:</span> {user?.email}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">User ID:</span> {user?.id}
              </p>
            </div>
          </div>

          <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              🚀 Next Steps
            </h3>
            <p className="text-gray-600">
              Your authentication is working perfectly! Next we'll build the interview features.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}