-- ============================================================================
-- HYRE Reliability Migration
-- Adds evaluation tracking, error logging, and idempotency support
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Add columns to interviews table
-- ============================================================================

-- Add evaluation status tracking (separate from interview status)
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS evaluation_status TEXT DEFAULT 'pending';

-- Add evaluation error message storage
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS evaluation_error TEXT;

-- Add evaluation completion timestamp
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS evaluation_completed_at TIMESTAMPTZ;

-- Note: vapi_call_id may already exist, so we use IF NOT EXISTS
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS vapi_call_id TEXT;

-- Add comment to explain evaluation_status values
COMMENT ON COLUMN interviews.evaluation_status IS 'Values: pending, in_progress, completed, failed, pending_retry';

-- ============================================================================
-- PART 2: Create error_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Error context
  endpoint TEXT NOT NULL,
  error_type TEXT NOT NULL,

  -- Related records (nullable for flexibility)
  interview_id UUID REFERENCES interviews(id) ON DELETE SET NULL,
  interview_slug TEXT,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,

  -- Error details
  error_message TEXT,
  error_stack TEXT,
  request_body JSONB,

  -- Resolution tracking
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT
);

-- Add comments for documentation
COMMENT ON TABLE error_logs IS 'Tracks API errors and failures for debugging and recovery';
COMMENT ON COLUMN error_logs.error_type IS 'Categories: webhook_failure, evaluation_failure, vapi_error, supabase_error, openai_error, validation_error';
COMMENT ON COLUMN error_logs.resolved_at IS 'Set when error has been manually reviewed and resolved';

-- ============================================================================
-- PART 3: Create indexes for performance
-- ============================================================================

-- Index for finding interviews that need evaluation retry
CREATE INDEX IF NOT EXISTS idx_interviews_evaluation_status
ON interviews(evaluation_status)
WHERE evaluation_status IN ('failed', 'pending_retry', 'pending');

-- Index for finding interviews by vapi_call_id (for idempotency)
CREATE INDEX IF NOT EXISTS idx_interviews_vapi_call_id
ON interviews(vapi_call_id)
WHERE vapi_call_id IS NOT NULL;

-- Index for finding unresolved errors
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved
ON error_logs(created_at DESC)
WHERE resolved_at IS NULL;

-- Index for finding errors by endpoint
CREATE INDEX IF NOT EXISTS idx_error_logs_endpoint
ON error_logs(endpoint, created_at DESC);

-- Index for finding errors by interview
CREATE INDEX IF NOT EXISTS idx_error_logs_interview
ON error_logs(interview_id)
WHERE interview_id IS NOT NULL;

-- ============================================================================
-- PART 4: Enable RLS on error_logs
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view error logs for their org
-- Note: This assumes you have org_id on interviews and a way to get user's org
CREATE POLICY "Users can view error logs for their org interviews" ON error_logs
  FOR SELECT
  USING (
    interview_id IN (
      SELECT i.id FROM interviews i
      JOIN profiles p ON i.org_id = p.org_id
      WHERE p.id = auth.uid()
    )
    OR interview_id IS NULL -- Allow viewing errors without interview context
  );

-- Policy: Allow service role to insert error logs (for API routes)
CREATE POLICY "Service role can insert error logs" ON error_logs
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow authenticated users to update resolution fields
CREATE POLICY "Users can resolve errors for their org" ON error_logs
  FOR UPDATE
  USING (
    interview_id IN (
      SELECT i.id FROM interviews i
      JOIN profiles p ON i.org_id = p.org_id
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    interview_id IN (
      SELECT i.id FROM interviews i
      JOIN profiles p ON i.org_id = p.org_id
      WHERE p.id = auth.uid()
    )
  );

-- ============================================================================
-- PART 5: Backfill existing data
-- ============================================================================

-- Set evaluation_status for existing completed interviews with evaluations
UPDATE interviews
SET evaluation_status = 'completed',
    evaluation_completed_at = completed_at
WHERE structured_evaluation IS NOT NULL
  AND evaluation_status = 'pending';

-- Set evaluation_status to 'pending' for completed interviews without evaluations
UPDATE interviews
SET evaluation_status = 'pending'
WHERE status = 'completed'
  AND structured_evaluation IS NULL
  AND evaluation_status = 'pending';

-- ============================================================================
-- VERIFICATION QUERIES (run these to check the migration worked)
-- ============================================================================

-- Check interviews table structure
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'interviews'
--   AND column_name IN ('evaluation_status', 'evaluation_error', 'evaluation_completed_at', 'vapi_call_id');

-- Check error_logs table exists
-- SELECT * FROM error_logs LIMIT 1;

-- Check indexes
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('interviews', 'error_logs');
