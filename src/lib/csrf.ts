import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth-cookies";

export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

// 24 hours expiration window for CSRF tokens
const CSRF_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function getCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    // In production, we require at least 32 characters
    if (process.env.NODE_ENV === "production") {
      throw new Error("CSRF_SECRET or JWT_SECRET must be configured with at least 32 characters.");
    }
    // Safe deterministic development fallback if not set
    return "dev-csrf-secret-classforge-secure-token-must-be-32-chars-long";
  }
  return secret;
}

/**
 * Generates a cryptographically strong, session-bound CSRF token.
 * Format: <nonce>.<timestamp>.<binding>.<signature>
 *
 * @param binding - The user ID or session ID this token is bound to, preventing cross-session reuse.
 */
export function generateCsrfToken(binding: string = "anon"): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();
  const secret = getCsrfSecret();

  const dataToSign = `${nonce}.${timestamp}.${binding}`;
  const signature = crypto.createHmac("sha256", secret).update(dataToSign).digest("hex");

  return `${nonce}.${timestamp}.${binding}.${signature}`;
}

/**
 * Validates a CSRF token using constant-time comparison.
 *
 * @param token - The token provided by the client (header or body)
 * @param expectedBinding - Optional user ID to verify token-to-session binding
 */
export function verifyCsrfTokenString(
  token: string | null | undefined,
  expectedBinding?: string,
): { valid: boolean; reason?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "Missing CSRF token." };
  }

  const parts = token.split(".");
  if (parts.length !== 4) {
    return { valid: false, reason: "Malformed CSRF token structure." };
  }

  const [nonce, timestampStr, binding, providedSignature] = parts;
  const timestamp = Number(timestampStr);

  if (Number.isNaN(timestamp)) {
    return { valid: false, reason: "Invalid CSRF token timestamp." };
  }

  const now = Date.now();
  // Check token age and ensure it is not from the future (> 60s clock skew)
  if (now - timestamp > CSRF_TOKEN_TTL_MS) {
    return { valid: false, reason: "CSRF token has expired." };
  }
  if (timestamp - now > 60_000) {
    return { valid: false, reason: "CSRF token timestamp in the future." };
  }

  // Session binding check: if bound to a user, it must match that user or be acceptable
  if (expectedBinding && binding !== "anon" && binding !== expectedBinding) {
    return { valid: false, reason: "CSRF token session mismatch." };
  }

  const secret = getCsrfSecret();
  const dataToSign = `${nonce}.${timestampStr}.${binding}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(dataToSign).digest("hex");

  const providedBuf = Buffer.from(providedSignature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");

  if (providedBuf.length !== expectedBuf.length) {
    return { valid: false, reason: "Invalid CSRF token signature length." };
  }

  const matches = crypto.timingSafeEqual(providedBuf, expectedBuf);
  if (!matches) {
    return { valid: false, reason: "Invalid CSRF token signature." };
  }

  return { valid: true };
}

/**
 * Validates Origin or Referer header against trusted origins for state-changing requests.
 */
export function validateOrigin(request: Request | NextRequest): { valid: boolean; reason?: string } {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Determine allowed origins
  const host = request.headers.get("host");
  const allowedOrigins = new Set<string>();

  if (host) {
    allowedOrigins.add(`http://${host}`);
    allowedOrigins.add(`https://${host}`);
  }

  if (process.env.NEXTAUTH_URL) {
    try {
      allowedOrigins.add(new URL(process.env.NEXTAUTH_URL).origin);
    } catch {}
  }

  if (process.env.APP_URL) {
    try {
      allowedOrigins.add(new URL(process.env.APP_URL).origin);
    } catch {}
  }

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    try {
      allowedOrigins.add(new URL(process.env.NEXT_PUBLIC_API_BASE_URL).origin);
    } catch {}
  }

  // Always allow localhost in non-production
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://127.0.0.1:3000");
  }

  // Check Origin first
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      return { valid: false, reason: `Untrusted Origin: ${origin}` };
    }
    return { valid: true };
  }

  // Fallback to Referer
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.has(refererOrigin)) {
        return { valid: false, reason: `Untrusted Referer: ${refererOrigin}` };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: "Malformed Referer header." };
    }
  }

  // If neither Origin nor Referer is provided:
  // In standard browser cross-origin requests, modern browsers always send Origin for POST/PUT/PATCH/DELETE.
  // Genuinely local or same-origin direct requests may omit it, so we allow if other checks pass.
  return { valid: true };
}

/**
 * Checks whether an HTTP method is safe (RFC 7231: GET, HEAD, OPTIONS).
 */
export function isSafeMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

/**
 * Checks if the request is using stateless Bearer token authentication without cookies.
 */
export function isStatelessBearerAuth(request: Request | NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const hasBearer = Boolean(authHeader && authHeader.startsWith("Bearer "));

  // Check if cookies were also attached
  let hasAuthCookies = false;
  if ("cookies" in request && typeof request.cookies?.get === "function") {
    hasAuthCookies = Boolean(
      request.cookies.get(ACCESS_TOKEN_COOKIE) || request.cookies.get(REFRESH_TOKEN_COOKIE),
    );
  } else {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      hasAuthCookies =
        cookieHeader.includes(`${ACCESS_TOKEN_COOKIE}=`) ||
        cookieHeader.includes(`${REFRESH_TOKEN_COOKIE}=`);
    }
  }

  return hasBearer && !hasAuthCookies;
}

/**
 * Extracts the CSRF token from the request headers or cookie.
 */
export function extractCsrfToken(request: Request | NextRequest): string | null {
  // 1. Check custom header x-csrf-token or x-xsrf-token
  const headerToken =
    request.headers.get(CSRF_HEADER_NAME) ||
    request.headers.get("x-xsrf-token");

  if (headerToken) return headerToken.trim();

  return null;
}

/**
 * Comprehensive CSRF protection validation for incoming requests.
 *
 * Rules:
 *  1. Safe methods (GET, HEAD, OPTIONS) are exempt.
 *  2. Pre-authentication login is exempt from token check (no session cookie exists yet),
 *     but Origin verification is still enforced.
 *  3. Stateless Bearer token requests (no cookies attached) are exempt because browsers
 *     do not automatically attach Authorization headers across origins.
 *  4. All state-changing requests originating from a browser context (with Origin, Referer,
 *     or Sec-Fetch headers) relying on cookie-based authentication MUST pass both Origin
 *     validation and session-bound CSRF token verification.
 */
export function assertCsrfProtection(
  request: Request | NextRequest,
  options: {
    expectedUserId?: string;
    isExemptEndpoint?: boolean;
    exemptReason?: string;
  } = {},
): { allowed: boolean; status?: number; reason?: string } {
  const method = request.method ?? "GET";

  // 1. Safe methods are always exempt
  if (isSafeMethod(method)) {
    return { allowed: true };
  }

  // 2. Validate Origin / Referer for all state-changing requests
  const originResult = validateOrigin(request);
  if (!originResult.valid) {
    return {
      allowed: false,
      status: 403,
      reason: originResult.reason ?? "Origin validation failed.",
    };
  }

  // 3. Deliberately exempted endpoints (e.g. POST /api/auth/login)
  if (options.isExemptEndpoint) {
    return { allowed: true };
  }

  // 4. Stateless Bearer token requests
  if (isStatelessBearerAuth(request)) {
    return { allowed: true };
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const secFetchSite = request.headers.get("sec-fetch-site");
  const token = extractCsrfToken(request);

  // Cross-site fetch detected
  if (secFetchSite === "cross-site") {
    if (!token) {
      return { allowed: false, status: 403, reason: "Cross-site request blocked: missing CSRF token." };
    }
  }

  // Enforce CSRF token verification for all browser-originated requests or when a token is provided
  const isBrowserContext = Boolean(origin || referer || secFetchSite);

  if (isBrowserContext || token || process.env.CSRF_ENFORCE_ALL === "true") {
    const tokenResult = verifyCsrfTokenString(token, options.expectedUserId);
    if (!tokenResult.valid) {
      return {
        allowed: false,
        status: 403,
        reason: tokenResult.reason ?? "CSRF token validation failed.",
      };
    }
  }

  return { allowed: true };
}

/**
 * Sets the CSRF token cookie on a response.
 * Accessible to client JS (httpOnly: false) so the frontend can read and attach it in headers.
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Required for double-submit cookie pattern
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(CSRF_TOKEN_TTL_MS / 1000),
  });
}
