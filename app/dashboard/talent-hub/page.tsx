'use client'

export default function TalentHubPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Center content with narrower max-width */}
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Talent Hub</h1>
            <span className="px-4 py-2 rounded-full text-base font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg ring-2 ring-orange-300 ring-offset-2">
              Coming Soon
            </span>
          </div>
          <p className="text-lg text-gray-600">
            Transform your interviews into a smart, compounding talent pool. We'll automatically surface your best past candidates the moment a new role opens.
          </p>
        </div>

        {/* Problem Statement Banner */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-lg text-gray-900 font-semibold mb-1">
                  Tired of the same old grind?
                </p>
                <p className="text-gray-600">
                  Built for agencies and in-house TA who are done re-running the same LinkedIn search three times a week.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            When a new brief lands, you'll see:
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Feature Card 1 */}
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Finalists & Near-Misses
              </h3>
              <p className="text-gray-600">
                Instantly see top candidates from similar roles who were already vetted and ready to go
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Transferable Skills
              </h3>
              <p className="text-gray-600">
                Discover candidates with adjacent skills across roles and clients you never knew you had
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200">
              <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Real Interview Intelligence
              </h3>
              <p className="text-gray-600">
                Clear reasons why they match — based on actual interview data, not just CV keywords
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
