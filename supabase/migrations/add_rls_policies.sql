-- ============================================================================
-- HYRE Row Level Security (RLS) Migration
-- Enables multi-tenancy data isolation across all core tables
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Enable RLS on all core tables
-- ============================================================================

-- Profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Organisations table
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Candidates table
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Interviews table
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Competencies table
ALTER TABLE competencies ENABLE ROW LEVEL SECURITY;

-- Questions table
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Knockout questions table
ALTER TABLE knockout_questions ENABLE ROW LEVEL SECURITY;

-- Knockout responses table
ALTER TABLE knockout_responses ENABLE ROW LEVEL SECURITY;

-- Question evaluations table
ALTER TABLE question_evaluations ENABLE ROW LEVEL SECURITY;

-- Screening summaries table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'screening_summaries') THEN
    ALTER TABLE screening_summaries ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Interview feedback table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'interview_feedback') THEN
    ALTER TABLE interview_feedback ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================================
-- PART 2: Create policies for profiles table
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Service role can insert profiles (for signup)
CREATE POLICY "Service role can insert profiles" ON profiles
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- PART 3: Create policies for organisations table
-- ============================================================================

-- Users can view their own organization
CREATE POLICY "Users can view own organisation" ON organisations
  FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can update their own organization
CREATE POLICY "Users can update own organisation" ON organisations
  FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- PART 4: Create policies for roles table
-- ============================================================================

-- Users can view roles in their organization
CREATE POLICY "Users can view org roles" ON roles
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can insert roles for their organization
CREATE POLICY "Users can insert org roles" ON roles
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can update roles in their organization
CREATE POLICY "Users can update org roles" ON roles
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can delete roles in their organization
CREATE POLICY "Users can delete org roles" ON roles
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- PART 5: Create policies for candidates table
-- ============================================================================

-- Users can view candidates in their organization
CREATE POLICY "Users can view org candidates" ON candidates
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can insert candidates for their organization
CREATE POLICY "Users can insert org candidates" ON candidates
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can update candidates in their organization
CREATE POLICY "Users can update org candidates" ON candidates
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- PART 6: Create policies for interviews table
-- ============================================================================

-- Users can view interviews in their organization
CREATE POLICY "Users can view org interviews" ON interviews
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can insert interviews for their organization
CREATE POLICY "Users can insert org interviews" ON interviews
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can update interviews in their organization
CREATE POLICY "Users can update org interviews" ON interviews
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- PART 7: Create policies for competencies table
-- ============================================================================

-- Users can view competencies for roles in their organization
CREATE POLICY "Users can view org competencies" ON competencies
  FOR SELECT
  USING (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can insert competencies for their org's roles
CREATE POLICY "Users can insert org competencies" ON competencies
  FOR INSERT
  WITH CHECK (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can update competencies for their org's roles
CREATE POLICY "Users can update org competencies" ON competencies
  FOR UPDATE
  USING (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can delete competencies for their org's roles
CREATE POLICY "Users can delete org competencies" ON competencies
  FOR DELETE
  USING (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- PART 8: Create policies for questions table
-- ============================================================================

-- Users can view questions for roles in their organization
CREATE POLICY "Users can view org questions" ON questions
  FOR SELECT
  USING (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can insert questions for their org's roles
CREATE POLICY "Users can insert org questions" ON questions
  FOR INSERT
  WITH CHECK (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can update questions for their org's roles
CREATE POLICY "Users can update org questions" ON questions
  FOR UPDATE
  USING (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can delete questions for their org's roles
CREATE POLICY "Users can delete org questions" ON questions
  FOR DELETE
  USING (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- PART 9: Create policies for knockout_questions table
-- ============================================================================

-- Users can view knockout questions for roles in their organization
CREATE POLICY "Users can view org knockout_questions" ON knockout_questions
  FOR SELECT
  USING (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can insert knockout questions for their org's roles
CREATE POLICY "Users can insert org knockout_questions" ON knockout_questions
  FOR INSERT
  WITH CHECK (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can update knockout questions for their org's roles
CREATE POLICY "Users can update org knockout_questions" ON knockout_questions
  FOR UPDATE
  USING (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can delete knockout questions for their org's roles
CREATE POLICY "Users can delete org knockout_questions" ON knockout_questions
  FOR DELETE
  USING (
    role_id IN (
      SELECT id FROM roles WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- PART 10: Create policies for knockout_responses table
-- ============================================================================

-- Users can view knockout responses for interviews in their organization
CREATE POLICY "Users can view org knockout_responses" ON knockout_responses
  FOR SELECT
  USING (
    interview_id IN (
      SELECT id FROM interviews WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Users can insert knockout responses for their org's interviews
CREATE POLICY "Users can insert org knockout_responses" ON knockout_responses
  FOR INSERT
  WITH CHECK (
    interview_id IN (
      SELECT id FROM interviews WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- PART 11: Create policies for question_evaluations table
-- ============================================================================

-- Users can view question evaluations for interviews in their organization
CREATE POLICY "Users can view org question_evaluations" ON question_evaluations
  FOR SELECT
  USING (
    interview_id IN (
      SELECT id FROM interviews WHERE org_id IN (
        SELECT org_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Service role can insert question evaluations (for evaluation API)
CREATE POLICY "Service role can insert question_evaluations" ON question_evaluations
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- PART 12: Create policies for screening_summaries table (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'screening_summaries') THEN
    -- Users can view screening summaries for interviews in their organization
    EXECUTE 'CREATE POLICY "Users can view org screening_summaries" ON screening_summaries
      FOR SELECT
      USING (
        interview_id IN (
          SELECT id FROM interviews WHERE org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
          )
        )
      )';

    -- Service role can insert screening summaries
    EXECUTE 'CREATE POLICY "Service role can insert screening_summaries" ON screening_summaries
      FOR INSERT
      WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================================
-- PART 13: Create policies for interview_feedback table (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'interview_feedback') THEN
    -- Users can view feedback for interviews in their organization
    EXECUTE 'CREATE POLICY "Users can view org interview_feedback" ON interview_feedback
      FOR SELECT
      USING (
        interview_id IN (
          SELECT id FROM interviews WHERE org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
          )
        )
      )';

    -- Anyone can insert feedback (candidates submit feedback)
    EXECUTE 'CREATE POLICY "Anyone can insert interview_feedback" ON interview_feedback
      FOR INSERT
      WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================================
-- PART 14: Create helper function for org lookup
-- ============================================================================

-- Create a function to get user's org_id efficiently
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================================
-- VERIFICATION QUERIES (run these to check the migration worked)
-- ============================================================================

-- Check RLS is enabled on all tables
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('profiles', 'organisations', 'roles', 'candidates', 'interviews',
--                     'competencies', 'questions', 'knockout_questions', 'knockout_responses',
--                     'question_evaluations', 'error_logs');

-- Check policies exist
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
