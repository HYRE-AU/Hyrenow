const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim()
    process.env[key] = value
  }
})

async function setupProfile() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const email = 'shenny1996@gmail.com'

  try {
    // 1. Get user by email
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
    if (userError) throw userError

    const user = users.find(u => u.email === email)
    if (!user) {
      console.log('❌ User not found with email:', email)
      return
    }

    console.log('✅ Found user:', user.id, '-', user.email)

    // 2. Check if profile exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      throw profileCheckError
    }

    if (existingProfile) {
      console.log('✅ Profile already exists!')
      console.log('   org_id:', existingProfile.org_id)
      console.log('   email:', existingProfile.email)
      console.log('   full_name:', existingProfile.full_name)
      return
    }

    console.log('⚠️  No profile found. Creating one...')

    // 3. Create organization
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .insert({ name: 'My Organization' })
      .select()
      .single()

    if (orgError) throw orgError
    console.log('✅ Created organization:', org.id, '-', org.name)

    // 4. Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        org_id: org.id,
        email: user.email,
        full_name: 'Shenny',
      })

    if (profileError) throw profileError

    console.log('✅ Created profile for user!')
    console.log('   user_id:', user.id)
    console.log('   org_id:', org.id)
    console.log('   email:', user.email)
    console.log('\n🎉 All done! You can now refresh the dashboard.')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

setupProfile()
