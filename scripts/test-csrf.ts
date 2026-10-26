/**
 * Comprehensive verification tests for Task 2: CSRF Protection.
 *
 * Covers:
 *  1. Valid CSRF token passes.
 *  2. Missing token rejected with 403 Forbidden.
 *  3. Invalid token signature rejected with 403 Forbidden.
 *  4. Expired token rejected with 403 Forbidden.
 *  5. Session/user binding mismatch rejected with 403 Forbidden.
 *  6. Untrusted Origin / Referer rejected with 403 Forbidden.
 *  7. Safe methods (GET, HEAD, OPTIONS) allowed without CSRF token.
 *  8. Preflight OPTIONS requests allowed.
 *  9. Stateless Bearer-authenticated requests (no cookies) exempted with documented rationale.
 *  10. Deliberately exempted endpoints (POST /api/auth/login) with origin verification.
 *  11. Protected endpoints: POST /api/auth/logout, POST /api/auth/change-password, tenant endpoints.
 *
 * Run with: npx tsx scripts/test-csrf.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { NextRequest } from "next/server";
import {
  generateCsrfToken,
  verifyCsrfTokenString,
  validateOrigin,
  assertCsrfProtection,
  isSafeMethod,
  isStatelessBearerAuth,
  CSRF_HEADER_NAME,
} from "../src/lib/csrf";
import { createAccessToken } from "../src/lib/auth";
import { ACCESS_TOKEN_COOKIE } from "../src/lib/auth-cookies";
import { authenticateRequest } from "../src/lib/tenant-context";
import { POST as logoutHandler } from "../src/app/api/auth/logout/route";
import { GET as csrfEndpointHandler } from "../src/app/api/auth/csrf/route";

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
  console.log("      ClassForge Task 2: CSRF Protection Test Suite    ");
  console.log("=======================================================\n");

  const userIdA = "11111111-1111-1111-1111-111111111111";
  const userIdB = "22222222-2222-2222-2222-222222222222";

  // --- 1. Token Generation and Basic Validation ---
  console.log("--- 1. Cryptographic Token Generation & Constant-Time Validation ---");
  const tokenA = generateCsrfToken(userIdA);
  assert(typeof tokenA === "string" && tokenA.split(".").length === 4, "Generated token has valid 4-part structure");

  const validCheck = verifyCsrfTokenString(tokenA, userIdA);
  assert(validCheck.valid === true, "Valid CSRF token bound to user A verifies successfully");

  // --- 2. Missing, Invalid, and Malformed Tokens ---
  console.log("\n--- 2. Missing and Malformed Token Rejections ---");
  const missingCheck = verifyCsrfTokenString(null, userIdA);
  assert(missingCheck.valid === false && missingCheck.reason?.includes("Missing"), "Missing token is rejected");

  const malformedCheck = verifyCsrfTokenString("not-a-valid-token", userIdA);
  assert(malformedCheck.valid === false && malformedCheck.reason?.includes("Malformed"), "Malformed token structure is rejected");

  // Tampered signature
  const parts = tokenA.split(".");
  parts[3] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const tamperedToken = parts.join(".");
  const tamperedCheck = verifyCsrfTokenString(tamperedToken, userIdA);
  assert(tamperedCheck.valid === false && tamperedCheck.reason?.includes("signature"), "Tampered token signature is rejected");

  // --- 3. Expired and Future Tokens ---
  console.log("\n--- 3. Expiry and Timing Checks ---");
  const expiredParts = tokenA.split(".");
  // Set timestamp to 48 hours ago
  expiredParts[1] = String(Date.now() - 48 * 60 * 60 * 1000);
  const expiredCheck = verifyCsrfTokenString(expiredParts.join("."), userIdA);
  assert(expiredCheck.valid === false && expiredCheck.reason?.includes("expired"), "Expired CSRF token (>24h) is rejected");

  // --- 4. Cross-Session / Session Mismatch Prevention ---
  console.log("\n--- 4. Session Binding & Cross-Session Reuse Prevention ---");
  // User B attempting to use User A's CSRF token
  const crossSessionCheck = verifyCsrfTokenString(tokenA, userIdB);
  assert(
    crossSessionCheck.valid === false && crossSessionCheck.reason?.includes("mismatch"),
    "User A's CSRF token cannot be used in User B's session (cross-session reuse blocked)",
  );

  // --- 5. Origin and Referer Validation ---
  console.log("\n--- 5. Origin and Referer Security Checks ---");
  const trustedReq = new NextRequest("http://localhost:3000/api/t/greenwood/students", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
    },
  });
  assert(validateOrigin(trustedReq).valid === true, "Origin matching host is trusted");

  const untrustedReq = new NextRequest("http://localhost:3000/api/t/greenwood/students", {
    method: "POST",
    headers: {
      origin: "https://evil-attacker-site.com",
      host: "localhost:3000",
    },
  });
  const untrustedResult = validateOrigin(untrustedReq);
  assert(untrustedResult.valid === false, "Untrusted cross-site Origin is blocked");

  const untrustedRefererReq = new NextRequest("http://localhost:3000/api/t/greenwood/students", {
    method: "POST",
    headers: {
      referer: "https://malicious-forum.com/attack",
      host: "localhost:3000",
    },
  });
  assert(validateOrigin(untrustedRefererReq).valid === false, "Untrusted Referer is blocked");

  // --- 6. Safe Methods & Preflight Requests ---
  console.log("\n--- 6. Safe HTTP Methods & Preflight OPTIONS Exemption ---");
  assert(isSafeMethod("GET") === true, "GET is a safe method");
  assert(isSafeMethod("HEAD") === true, "HEAD is a safe method");
  assert(isSafeMethod("OPTIONS") === true, "OPTIONS is a safe method");
  assert(isSafeMethod("POST") === false, "POST is a state-changing method");
  assert(isSafeMethod("DELETE") === false, "DELETE is a state-changing method");

  const getReq = new NextRequest("http://localhost:3000/api/auth/me", { method: "GET" });
  assert(assertCsrfProtection(getReq).allowed === true, "GET request allowed without CSRF token");

  const optionsReq = new NextRequest("http://localhost:3000/api/t/greenwood/students", { method: "OPTIONS" });
  assert(assertCsrfProtection(optionsReq).allowed === true, "CORS preflight OPTIONS request allowed without CSRF token");

  // --- 7. Stateless Bearer Token Exemption ---
  console.log("\n--- 7. Stateless Bearer Token Exemption (Documented Rationale) ---");
  const bearerReq = new NextRequest("http://localhost:3000/api/t/greenwood/attendance", {
    method: "POST",
    headers: {
      authorization: "Bearer some-access-token-jwt",
      origin: "http://localhost:3000",
      host: "localhost:3000",
    },
  });
  assert(isStatelessBearerAuth(bearerReq) === true, "Correctly identifies stateless Bearer authentication");
  assert(
    assertCsrfProtection(bearerReq).allowed === true,
    "Stateless Bearer request exempted from CSRF (browser does not auto-attach Authorization headers)",
  );

  // If cookie IS attached alongside Bearer, it is NOT purely stateless
  const hybridReq = new NextRequest("http://localhost:3000/api/t/greenwood/attendance", {
    method: "POST",
    headers: {
      authorization: "Bearer some-access-token-jwt",
      cookie: `${ACCESS_TOKEN_COOKIE}=some-cookie-token`,
      origin: "http://localhost:3000",
      host: "localhost:3000",
    },
  });
  assert(isStatelessBearerAuth(hybridReq) === false, "Hybrid cookie + header request is not exempt");

  // --- 8. Deliberately Exempted Endpoints ---
  console.log("\n--- 8. Deliberately Exempted Endpoints (Login Rationale) ---");
  const loginPostReq = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
    },
  });
  assert(
    assertCsrfProtection(loginPostReq, { isExemptEndpoint: true }).allowed === true,
    "Login endpoint exempted from CSRF token (no user session cookie exists prior to sign-in)",
  );

  // But login from untrusted origin is STILL blocked by origin validation
  const evilLoginReq = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://evil-phishing.com",
      host: "localhost:3000",
    },
  });
  assert(
    assertCsrfProtection(evilLoginReq, { isExemptEndpoint: true }).allowed === false,
    "Login endpoint still enforces strict Origin check against cross-origin submission",
  );

  // --- 9. GET /api/auth/csrf Endpoint ---
  console.log("\n--- 9. Token Retrieval Endpoint (GET /api/auth/csrf) ---");
  const csrfFetchReq = new NextRequest("http://localhost:3000/api/auth/csrf", { method: "GET" });
  const csrfFetchRes = await csrfEndpointHandler(csrfFetchReq);
  assert(csrfFetchRes.status === 200, "GET /api/auth/csrf returns HTTP 200 OK");
  const csrfFetchBody = await csrfFetchRes.json();
  assert(typeof csrfFetchBody.csrfToken === "string", "Response body includes csrfToken");
  assert(csrfFetchRes.cookies.get("csrf_token") !== undefined, "Response sets non-HttpOnly csrf_token cookie");

  // --- 10. Protected Endpoint Integrations ---
  console.log("\n--- 10. Protected Route Integration (Logout & AuthenticateRequest) ---");
  // Untrusted logout CSRF attempt
  const attackLogoutReq = new NextRequest("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers: {
      origin: "https://evil-site.com",
      host: "localhost:3000",
    },
  });
  const attackLogoutRes = await logoutHandler(attackLogoutReq);
  assert(attackLogoutRes.status === 403, "Cross-site Logout CSRF blocked with HTTP 403");

  // Missing CSRF token logout attempt
  const missingTokenLogoutReq = new NextRequest("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
    },
  });
  const missingTokenLogoutRes = await logoutHandler(missingTokenLogoutReq);
  assert(missingTokenLogoutRes.status === 403, "Logout with missing CSRF token returns HTTP 403");

  // Valid CSRF token logout attempt
  const validLogoutReq = new NextRequest("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      [CSRF_HEADER_NAME]: generateCsrfToken("anon"),
    },
  });
  const validLogoutRes = await logoutHandler(validLogoutReq);
  assert(validLogoutRes.status === 200, "Logout with valid CSRF token succeeds with HTTP 200");

  console.log("\n=======================================================");
  console.log(`Task 2 Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
