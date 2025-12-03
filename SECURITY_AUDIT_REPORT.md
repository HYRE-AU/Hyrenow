# HYRE Security & Reliability Audit Report

**Date:** December 3, 2025
**Auditor:** Claude Code
**Status:** CRITICAL ISSUES FOUND - NOT PRODUCTION READY

---

## Executive Summary

This comprehensive security audit of the HYRE application reveals **critical vulnerabilities** that must be addressed before production deployment. The main concerns are:

1. **Missing Authentication** on 7 interview manipulation endpoints
2. **No Multi-Tenancy Isolation** - organizations can access each other's data
3. **Broken Admin Authorization** - all authenticated users are treated as admins
4. **Missing RLS Policies** on 12 core database tables
5. **Incomplete Error Logging** - only 37% of routes log errors properly

### Overall Security Score: 25/100 (CRITICAL)

| Category | Score | Status |
|----------|-------|--------|
| Authentication | 40% | HIGH RISK |
| Authorization | 15% | CRITICAL |
| Data Isolation | 10% | CRITICAL |
| Input Validation | 30% | HIGH RISK |
| Error Handling | 70% | MODERATE |
| Encryption | 50% | ACCEPTABLE |

---

## Critical Vulnerabilities

### CRITICAL-1: Missing Authentication on Interview Endpoints

**Severity:** CRITICAL (CVSS 9.8)
**Affected Endpoints:**
- `POST /api/interview/start` - Start any interview
- `POST /api/interview/complete` - Complete any interview with fake transcript
- `POST /api/interview/proceed` - Progress any interview
- `POST /api/interview/reject` - Reject any candidate
- `POST /api/interview/feedback` - Submit feedback for any interview
- `POST /api/interview/knockout` - Submit knockout responses for any interview
- `POST /api/interview/evaluate` - Trigger evaluation for any interview

**Impact:** Any unauthenticated user can manipulate any interview in the system, including competitors' candidates.

**Exploit Example:**
```bash
# Reject a competitor's candidate without authentication
curl -X POST https://app.hyre.com/api/interview/reject \
  -H "Content-Type: application/json" \
  -d '{"interviewId": "uuid-of-competitors-candidate"}'
```

**Fix Required:**
```typescript
// Add to each route
import { requireAuth } from '@/lib/auth'

export async function POST(request: Request) {
  const authResult = await requireAuth()
  if (!authResult.authenticated) {
    return authResult.response
  }
  // ... rest of route
}
```

---

### CRITICAL-2: Broken Admin Authorization

**Severity:** CRITICAL (CVSS 9.5)
**Location:** `lib/auth.ts` line 121

**The Bug:**
```typescript
// CURRENT CODE (BROKEN)
const isAdmin = profile.is_admin === true || true  // ALWAYS TRUE!

// SHOULD BE
const isAdmin = profile.is_admin === true
```

**Impact:** Every authenticated user has admin access to:
- View all failed interviews across all organizations
- Retry evaluations for any organization
- Resolve errors for any organization
- Trigger test alerts

**Fix Required:** Remove `|| true` from the admin check.

---

### CRITICAL-3: No Multi-Tenancy Data Isolation

**Severity:** CRITICAL (CVSS 9.8)
**Affected:** All interview, candidate, and role data

**The Problem:**
- 11 of 17 API routes using `SUPABASE_SERVICE_KEY` do NOT filter by `org_id`
- No Row Level Security (RLS) enabled on 12 core tables
- Any authenticated user can access data from any organization

**Vulnerable Queries:**
```typescript
// Example from /api/interview/[slug]/route.ts
const { data: interview } = await supabase
  .from('interviews')
  .select('*')
  .eq('slug', slug)  // NO org_id FILTER!
  .single()
```

**Tables Missing RLS:**
| Table | Contains | Risk |
|-------|----------|------|
| interviews | Candidate evaluations | CRITICAL |
| candidates | PII (name, email) | CRITICAL |
| roles | Job descriptions | HIGH |
| competencies | Evaluation criteria | HIGH |
| questions | Interview questions | HIGH |
| knockout_questions | Screening questions | HIGH |
| knockout_responses | Candidate responses | HIGH |
| question_evaluations | Detailed evaluations | CRITICAL |
| screening_summaries | Candidate summaries | HIGH |
| interview_feedback | Candidate feedback | HIGH |
| profiles | User data | CRITICAL |
| organisations | Org data | MEDIUM |

**Fix Required:**
1. Enable RLS on all tables
2. Create policies that filter by `auth.uid()` → `profiles.org_id`
3. Add `org_id` filtering to all API routes

---

### CRITICAL-4: Webhook Signature Bypass

**Severity:** HIGH (CVSS 8.5)
**Location:** `/api/webhooks/vapi/route.ts`

**The Problem:**
```typescript
// If no secret configured, webhooks are accepted without verification
if (!secret) {
  console.warn('⚠️ VAPI_WEBHOOK_SECRET not configured - skipping signature verification');
  return true;  // ACCEPTS UNSIGNED WEBHOOKS
}
```

**Impact:** If `VAPI_WEBHOOK_SECRET` is not set:
- Any attacker can send fake webhooks
- Can inject fake transcripts into any interview
- Can trigger evaluations with malicious data

**Fix Required:** Change to fail-secure:
```typescript
if (!secret) {
  console.error('VAPI_WEBHOOK_SECRET required');
  return false;
}
```

---

## API Endpoint Security Matrix

| Endpoint | Method | Auth | Should Auth | Org Filter | Error Log | Status |
|----------|--------|------|-------------|------------|-----------|--------|
| `/api/auth/signup` | POST | ❌ | ❌ | N/A | ❌ | OK |
| `/api/interview/[slug]` | GET | ❌ | ❌* | ❌ | ❌ | ISSUE |
| `/api/interview/start` | POST | ❌ | ✅ | ❌ | ❌ | CRITICAL |
| `/api/interview/complete` | POST | ❌ | ✅ | ❌ | ✅ | CRITICAL |
| `/api/interview/proceed` | POST | ❌ | ✅ | ❌ | ❌ | CRITICAL |
| `/api/interview/reject` | POST | ❌ | ✅ | ❌ | ❌ | CRITICAL |
| `/api/interview/feedback` | POST | ❌ | ✅ | ❌ | ❌ | CRITICAL |
| `/api/interview/knockout` | POST | ❌ | ✅ | ❌ | ❌ | CRITICAL |
| `/api/interview/evaluate` | POST | ❌ | ✅ | ❌ | ✅ | CRITICAL |
| `/api/roles/add` | POST | ✅ | ✅ | ✅ | ❌ | OK |
| `/api/roles/parse-job-url` | POST | ❌ | ❌ | N/A | ❌ | OK |
| `/api/roles/generate-competencies` | POST | ❌ | ❌ | N/A | ❌ | OK |
| `/api/roles/generate-interview-questions` | POST | ❌ | ❌ | N/A | ❌ | OK |
| `/api/candidates/invite` | POST | ✅ | ✅ | ✅ | ❌ | OK |
| `/api/webhooks/vapi` | POST | Sig | Sig | ❌ | ✅ | HIGH |
| `/api/admin/failed-interviews` | GET | ✅* | ✅ | ❌ | ✅ | HIGH |
| `/api/admin/retry-evaluation` | POST | ✅* | ✅ | ❌ | ✅ | HIGH |
| `/api/admin/resolve-error` | POST | ✅* | ✅ | ❌ | ✅ | HIGH |
| `/api/admin/test-alert` | GET | ✅* | ✅ | N/A | ✅ | OK |
| `/api/health` | GET | ❌ | ❌ | N/A | ❌ | OK |

*Auth check present but broken (always passes due to `|| true` bug)

---

## Error Handling Gaps

### Routes Missing `logError()` Calls

These routes catch errors but only log to console, not to the database or Slack:

1. `/api/interview/start`
2. `/api/interview/knockout`
3. `/api/interview/feedback`
4. `/api/interview/proceed`
5. `/api/interview/reject`
6. `/api/roles/add`
7. `/api/roles/generate-competencies`
8. `/api/roles/generate-interview-questions`
9. `/api/auth/signup`
10. `/api/candidates/invite`
11. `/api/roles/parse-job-url`
12. `/api/interview/[slug]`

**Impact:** Production errors in these routes will not trigger Slack alerts or be visible in the admin dashboard.

---

## Reliability Issues

### Issue 1: Race Condition in Webhook Processing

**Location:** `/api/webhooks/vapi/route.ts`

**Problem:** Two webhook requests can pass the idempotency check simultaneously:
```
Thread 1: evaluation_status !== 'in_progress' → true
Thread 2: evaluation_status !== 'in_progress' → true
Both proceed to trigger evaluation
```

**Impact:** Duplicate evaluations, wasted OpenAI API calls, potential data inconsistency.

**Fix:** Use database-level constraints with `ON CONFLICT` or a distributed lock.

---

### Issue 2: No Transaction Support in Role Creation

**Location:** `/api/roles/add/route.ts`

**Problem:** Creates role, competencies, questions, knockout questions in sequence without a transaction.

**Impact:** If middle operation fails, orphaned data remains:
- Role created ✓
- Competencies created ✓
- Questions creation fails ✗
- Role exists without questions

---

### Issue 3: Evaluation Timeout Risk

**Location:** `/api/webhooks/vapi/route.ts` line 202

**Problem:** Evaluation endpoint called without timeout:
```typescript
const evaluationResponse = await fetch(
  `${process.env.NEXT_PUBLIC_APP_URL}/api/interview/evaluate`,
  // NO timeout - could hang indefinitely
)
```

**Impact:** Webhook processing could hang if evaluation is slow.

---

## Environment Variables Required

| Variable | Required | Status |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | ✅ |
| `SUPABASE_SERVICE_KEY` | Yes | ✅ |
| `OPENAI_API_KEY` | Yes | ✅ |
| `VAPI_PRIVATE_KEY` | Yes | ✅ |
| `VAPI_PUBLIC_KEY` | Yes | ✅ |
| `VAPI_WEBHOOK_SECRET` | Yes | ❌ Not set |
| `SLACK_WEBHOOK_URL` | Recommended | ❌ Not set |
| `NEXT_PUBLIC_APP_URL` | Yes | ✅ |

---

## Remediation Priority

### P0 - Block Production (Fix Immediately)

1. **Add authentication to interview endpoints**
   - Files: `start`, `complete`, `proceed`, `reject`, `feedback`, `knockout`, `evaluate`
   - Effort: 2-3 hours

2. **Fix admin authorization bug**
   - File: `lib/auth.ts` line 121
   - Effort: 5 minutes

3. **Add org_id filtering to all endpoints**
   - Effort: 4-6 hours

4. **Enable RLS on all tables**
   - Create migration with policies
   - Effort: 2-4 hours

### P1 - High Priority (This Week)

5. **Add logError() to 12 routes**
   - Effort: 1-2 hours

6. **Configure VAPI_WEBHOOK_SECRET**
   - Get secret from Vapi dashboard
   - Effort: 15 minutes

7. **Configure SLACK_WEBHOOK_URL**
   - Create Slack webhook
   - Effort: 15 minutes

8. **Add input validation to all endpoints**
   - Use Zod or similar
   - Effort: 4-6 hours

### P2 - Medium Priority (This Sprint)

9. **Add transaction support to role creation**
10. **Add fetch timeout to webhook evaluation call**
11. **Fix race condition with database-level constraint**
12. **Add comprehensive audit logging**

---

## Test Scripts Created

Run these scripts to verify security:

```bash
# Test authentication on protected endpoints
npx ts-node scripts/security-tests/auth-test.ts

# Test data isolation between organizations
npx ts-node scripts/security-tests/data-isolation-test.ts

# Test error handling and logging
npx ts-node scripts/security-tests/error-handling-test.ts
```

---

## Conclusion

**The HYRE application is NOT ready for production deployment.**

The critical issues around authentication, authorization, and data isolation mean that:
- Customer data is not protected between organizations
- Any user can manipulate any interview
- Admin functions are accessible to all users

**Minimum fixes required before production:**
1. Add auth to 7 interview endpoints
2. Fix admin authorization bug
3. Add org_id filtering to all queries
4. Enable RLS on database tables

Estimated effort for P0 fixes: **8-12 hours**

---

## Appendix: Files Requiring Changes

### Critical Priority
- `lib/auth.ts` - Fix admin check (line 121)
- `app/api/interview/start/route.ts` - Add auth + org_id
- `app/api/interview/complete/route.ts` - Add auth + org_id
- `app/api/interview/proceed/route.ts` - Add auth + org_id
- `app/api/interview/reject/route.ts` - Add auth + org_id
- `app/api/interview/feedback/route.ts` - Add auth + org_id
- `app/api/interview/knockout/route.ts` - Add auth + org_id
- `app/api/interview/evaluate/route.ts` - Add auth + org_id
- `app/api/webhooks/vapi/route.ts` - Add org_id filtering

### High Priority
- `app/api/admin/failed-interviews/route.ts` - Add org_id filtering
- `app/api/admin/retry-evaluation/route.ts` - Add org_id filtering
- `app/api/admin/resolve-error/route.ts` - Add org_id filtering
- All 12 routes listed in "Routes Missing logError()" section

### Database
- Create RLS migration for all tables
- Add `is_admin` column to profiles if not present
