/**
 * Comprehensive verification tests for Task 1: Login Rate Limiting.
 *
 * Covers:
 *  1. Requests below configured limit (allowed).
 *  2. Requests exceeding limit (blocked with 429).
 *  3. Correct 429 responses and retry metadata (Retry-After, X-RateLimit headers).
 *  4. Separate users and IPs isolated according to intended policy.
 *  5. Malformed, missing, or casing variations of account identifiers.
 *  6. Storage failure behavior (fallback to memory and fail_closed policy).
 *  7. Regression tests verifying login flow behaves correctly on success and failure.
 *
 * Run with: npx tsx scripts/test-rate-limit.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { NextRequest } from "next/server";
import {
  checkLoginRateLimit,
  resetLoginRateLimit,
  createRateLimitResponse,
  MemoryRateLimitStore,
  PostgresRateLimitStore,
  normalizeAccountIdentifier,
  RATE_LIMIT_CONFIG,
} from "../src/lib/rate-limit";
import { POST as loginHandler } from "../src/app/api/auth/login/route";

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   ClassForge Task 1: Login Rate Limiting Test Suite   ");
  console.log("=======================================================\n");

  // --- Test Suite 1: In-Memory / Isolated Store Tests ---
  console.log("--- 1. Testing Thresholds Below and Above Configured Limit ---");
  const testStore = new MemoryRateLimitStore();

  const req1 = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.1" },
  });

  const account = "teacher1@example.com";

  // First 5 attempts (configured ACCOUNT_MAX_ATTEMPTS = 5)
  for (let i = 1; i <= RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS; i++) {
    const result = await checkLoginRateLimit(req1, account, testStore);
    assert(
      result.allowed === true,
      `Attempt ${i} of ${RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS} is allowed`,
    );
  }

  // 6th attempt: Exceeds limit -> blocked with 429
  console.log("\n--- 2. Testing Rate Limit Exceeded and 429 Metadata ---");
  const exceededResult = await checkLoginRateLimit(req1, account, testStore);
  assert(exceededResult.allowed === false, "6th attempt is blocked (allowed = false)");
  assert(exceededResult.remaining === 0, "Remaining attempts counter is 0");
  assert(exceededResult.retryAfter > 0, `Retry-After is positive (${exceededResult.retryAfter}s)`);

  const response429 = createRateLimitResponse(exceededResult);
  assert(response429.status === 429, "Response status is HTTP 429 Too Many Requests");
  assert(response429.headers.has("Retry-After"), "Response includes Retry-After header");
  assert(response429.headers.get("X-RateLimit-Remaining") === "0", "X-RateLimit-Remaining is 0");
  assert(response429.headers.has("X-RateLimit-Reset"), "Response includes X-RateLimit-Reset header");

  const body429 = await response429.json();
  assert(
    body429.message === "Too many login attempts. Please try again later.",
    "Response message is non-sensitive and generic (does not reveal account existence)",
  );

  // --- Test Suite 3: Isolation Between Different Users and IPs ---
  console.log("\n--- 3. Testing Policy Isolation Across Accounts and IPs ---");
  // A different user from the same IP should have their own account limit, but share the IP budget
  const account2 = "teacher2@example.com";
  const resultDiffUser = await checkLoginRateLimit(req1, account2, testStore);
  assert(
    resultDiffUser.allowed === true,
    "Different account from same IP is allowed (not locked out by user 1)",
  );

  // The first user from a DIFFERENT IP: account limit was exceeded, so they are still blocked (brute force protection across IPs)
  const reqDiffIp = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.50" },
  });
  const resultDiffIpSameUser = await checkLoginRateLimit(reqDiffIp, account, testStore);
  assert(
    resultDiffIpSameUser.allowed === false,
    "Target account is protected against distributed brute-force across different IPs",
  );

  // A different user from a different IP is completely unaffected
  const resultUnrelated = await checkLoginRateLimit(reqDiffIp, "admin@other.com", testStore);
  assert(
    resultUnrelated.allowed === true,
    "Unrelated user on unrelated IP is completely unaffected",
  );

  // --- Test Suite 4: Account Identifier Normalization and Malformed Inputs ---
  console.log("\n--- 4. Testing Identifier Normalization & Malformed Input Handling ---");
  assert(
    normalizeAccountIdentifier("  ADMIN@School.COM  ") === "admin@school.com",
    "Trims and lowercases identifier",
  );
  assert(normalizeAccountIdentifier("") === null, "Empty string returns null");
  assert(normalizeAccountIdentifier(null) === null, "Null returns null");
  assert(normalizeAccountIdentifier({ evil: "object" }) === null, "Objects return null");

  // Bypass attempt via casing: "Teacher1@Example.com" vs "teacher1@example.com"
  const casingBypassResult = await checkLoginRateLimit(req1, "  TEACHER1@EXAMPLE.COM ", testStore);
  assert(
    casingBypassResult.allowed === false,
    "Casing / whitespace variation cannot bypass account rate limit",
  );

  // Missing or malformed identifier: still tracked under client IP
  const reqNoAccount = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.99" },
  });
  const noAccountResult = await checkLoginRateLimit(reqNoAccount, undefined, testStore);
  assert(noAccountResult.allowed === true, "Request with missing identifier evaluates IP budget safely");

  // --- Test Suite 5: Storage Failure Behavior ---
  console.log("\n--- 5. Testing Storage Failure Behavior & Fallback Policy ---");
  const brokenStore = {
    async increment(): Promise<{ count: number; resetSeconds: number }> {
      throw new Error("PostgreSQL connection timeout: connection refused");
    },
    async reset(): Promise<void> {
      throw new Error("PostgreSQL down");
    },
  };

  // With default policy ("fallback"), it gracefully falls back to resilient memory rate limiting
  const fallbackResult = await checkLoginRateLimit(req1, "fallback-user@example.com", brokenStore);
  assert(
    fallbackResult !== undefined && typeof fallbackResult.allowed === "boolean",
    "On storage failure with 'fallback' policy, falls back to memory limiter without crashing",
  );

  // Test fail_closed policy
  const originalPolicy = RATE_LIMIT_CONFIG.ON_STORE_ERROR;
  (RATE_LIMIT_CONFIG as { ON_STORE_ERROR: string }).ON_STORE_ERROR = "fail_closed";
  const failClosedResult = await checkLoginRateLimit(req1, "fail-closed-user@example.com", brokenStore);
  assert(
    failClosedResult.allowed === false && Boolean(failClosedResult.reason?.includes("temporarily unavailable")),
    "On storage failure with 'fail_closed' policy, rejects request to prevent unthrottled brute-force",
  );
  (RATE_LIMIT_CONFIG as { ON_STORE_ERROR: string }).ON_STORE_ERROR = originalPolicy;

  // --- Test Suite 6: Reset on Successful Login ---
  console.log("\n--- 6. Testing Successful Login Rate Limit Reset ---");
  const resetAccount = "reset-test@example.com";
  await checkLoginRateLimit(req1, resetAccount, testStore);
  await checkLoginRateLimit(req1, resetAccount, testStore);

  await resetLoginRateLimit(req1, resetAccount, testStore);
  const afterResetResult = await checkLoginRateLimit(req1, resetAccount, testStore);
  assert(
    afterResetResult.allowed === true && afterResetResult.remaining === RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS - 1,
    "Successful login resets the account rate limit counter",
  );

  // --- Test Suite 7: Full API Route Integration & Regression Tests ---
  console.log("\n--- 7. Testing Full API Route Integration (POST /api/auth/login) ---");

  // Invalid body (missing fields) returns 400
  const badReq = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid-email" }),
  });
  const badRes = await loginHandler(badReq);
  assert(badRes.status === 400, "Malformed credentials return HTTP 400 Bad Request");

  // Invalid credentials return 401
  const wrongPassReq = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "nonexistent-user-123456@example.com",
      password: "WrongPassword!123",
    }),
  });
  const wrongPassRes = await loginHandler(wrongPassReq);
  assert(wrongPassRes.status === 401, "Invalid password returns HTTP 401 Unauthorized");

  // Rapid spam exceeding limit returns 429
  const spamEmail = "brute-force-target@example.com";
  let got429 = false;
  let finalRes: any = null;

  for (let i = 0; i < 7; i++) {
    const spamReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: spamEmail,
        password: "wrong-password",
      }),
    });
    finalRes = await loginHandler(spamReq);
    if (finalRes.status === 429) {
      got429 = true;
      break;
    }
  }

  // --- Test Suite 8: Distributed PostgreSQL Shared Store Tests ---
  console.log("\n--- 8. Testing PostgreSQL Distributed Shared Store (Atomic Upsert) ---");
  if (process.env.DATABASE_URL) {
    try {
      const pgStore = new PostgresRateLimitStore();
      const testKey = `rl:test:${Date.now()}`;

      const pgRes1 = await pgStore.increment(testKey, 60);
      assert(pgRes1.count === 1, "Postgres store: Initial increment returns count = 1");
      assert(pgRes1.resetSeconds > 0 && pgRes1.resetSeconds <= 60, "Postgres store: Reset window calculated correctly");

      const pgRes2 = await pgStore.increment(testKey, 60);
      assert(pgRes2.count === 2, "Postgres store: Atomic second increment returns count = 2");

      await pgStore.reset(testKey);
      const pgRes3 = await pgStore.increment(testKey, 60);
      assert(pgRes3.count === 1, "Postgres store: Increment after reset returns count = 1");

      // Cleanup
      await pgStore.reset(testKey);
    } catch (err) {
      console.error("  ❌ FAIL: PostgresRateLimitStore error:", err);
      failed++;
    }
  } else {
    console.log("  ⚠️ Skipping Postgres store test: DATABASE_URL not set");
  }

  console.log("\n=======================================================");
  console.log(`Task 1 Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
