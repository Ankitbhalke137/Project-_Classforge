import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfter: number;
  reason?: string;
}

export interface RateLimitOptions {
  maxAttempts: number;
  windowSeconds: number;
}

export interface RateLimitStore {
  increment(key: string, windowSeconds: number): Promise<{ count: number; resetSeconds: number }>;
  reset(key: string): Promise<void>;
}

/**
 * In-memory sliding window rate limiter store.
 * Used for testing, development, and as a resilient fallback if the shared store fails.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, windowSeconds: number): Promise<{ count: number; resetSeconds: number }> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.expiresAt <= now) {
      const expiresAt = now + windowSeconds * 1000;
      this.store.set(key, { count: 1, expiresAt });
      return { count: 1, resetSeconds: windowSeconds };
    }

    entry.count += 1;
    const resetSeconds = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
    return { count: entry.count, resetSeconds };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * PostgreSQL-backed distributed rate limit store.
 * Works across multiple application instances sharing the database.
 * Uses atomic upsert so concurrent login requests don't cause race conditions.
 */
export class PostgresRateLimitStore implements RateLimitStore {
  private initialized = false;

  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS login_rate_limits (
          key VARCHAR(255) PRIMARY KEY,
          points INT NOT NULL,
          expire_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      this.initialized = true;
    } catch (err) {
      // If table already exists or another worker created it concurrently
      this.initialized = true;
    }
  }

  async increment(key: string, windowSeconds: number): Promise<{ count: number; resetSeconds: number }> {
    await this.ensureTable();

    const now = new Date();
    const newExpireAt = new Date(now.getTime() + windowSeconds * 1000);

    // Atomic upsert: if existing entry is expired, reset points to 1 and expire_at to newExpireAt.
    // Otherwise increment points and preserve the original expire_at.
    const result = await prisma.$queryRaw<Array<{ points: number; expire_at: Date }>>`
      INSERT INTO login_rate_limits (key, points, expire_at)
      VALUES (${key}, 1, ${newExpireAt})
      ON CONFLICT (key) DO UPDATE
      SET points = CASE
        WHEN login_rate_limits.expire_at < NOW() THEN 1
        ELSE login_rate_limits.points + 1
      END,
      expire_at = CASE
        WHEN login_rate_limits.expire_at < NOW() THEN ${newExpireAt}
        ELSE login_rate_limits.expire_at
      END
      RETURNING points, expire_at;
    `;

    if (!result || result.length === 0) {
      return { count: 1, resetSeconds: windowSeconds };
    }

    const { points, expire_at } = result[0];
    const diffMs = new Date(expire_at).getTime() - Date.now();
    const resetSeconds = Math.max(1, Math.ceil(diffMs / 1000));

    return { count: points, resetSeconds };
  }

  async reset(key: string): Promise<void> {
    try {
      await this.ensureTable();
      await prisma.$executeRaw`DELETE FROM login_rate_limits WHERE key = ${key}`;
    } catch {
      // Ignore cleanup error
    }
  }
}

// Configurable settings via environment variables
export const RATE_LIMIT_CONFIG = {
  // Max login attempts per normalized account in the window
  ACCOUNT_MAX_ATTEMPTS: Number(process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS ?? 5),
  // Max login attempts per IP across all accounts (protects against credential stuffing)
  IP_MAX_ATTEMPTS: Number(process.env.RATE_LIMIT_IP_MAX_ATTEMPTS ?? 20),
  // Window size in seconds (default: 15 minutes)
  WINDOW_SECONDS: Number(process.env.RATE_LIMIT_LOGIN_WINDOW_SEC ?? 900),
  // Preferred store: "postgres" | "memory" | "auto"
  STORE: process.env.RATE_LIMIT_STORE ?? "auto",
  // Failure policy: "fallback" (fall back to in-memory) | "fail_closed"
  ON_STORE_ERROR: (process.env.RATE_LIMIT_ON_STORE_ERROR ?? "fallback") as "fallback" | "fail_closed",
  // Proxy trust setting: only trust X-Forwarded-For if explicitly configured
  TRUST_PROXY: process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1",
};

// Singletons
const memoryStore = new MemoryRateLimitStore();
const postgresStore = new PostgresRateLimitStore();

/**
 * Returns the active rate limit store based on configuration.
 */
export function getRateLimitStore(): RateLimitStore {
  if (RATE_LIMIT_CONFIG.STORE === "memory") {
    return memoryStore;
  }
  return postgresStore;
}

/**
 * Resolves the client IP address in a security-conscious manner.
 * Does NOT trust client-supplied X-Forwarded-For values unless TRUST_PROXY is explicitly enabled.
 */
export function getClientIp(request: Request | NextRequest): string {
  // If request has ip property (NextRequest in certain environments)
  if ("ip" in request && typeof (request as unknown as { ip?: string }).ip === "string") {
    const nextIp = (request as unknown as { ip?: string }).ip;
    if (nextIp) return nextIp;
  }

  if (RATE_LIMIT_CONFIG.TRUST_PROXY) {
    // Cloudflare / Vercel trusted headers
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();

    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      // Split and take the first (client) or trusted hop
      const ips = forwarded.split(",").map((ip) => ip.trim()).filter(Boolean);
      if (ips.length > 0) {
        return ips[0];
      }
    }
  }

  // Fallback to local / connection identifier
  return "127.0.0.1";
}

/**
 * Normalizes email identifier: lowercase and trimmed.
 * Invalid or malformed strings are converted to a safe placeholder.
 */
export function normalizeAccountIdentifier(rawIdentifier?: unknown): string | null {
  if (typeof rawIdentifier !== "string") return null;
  const clean = rawIdentifier.trim().toLowerCase();
  if (!clean || clean.length > 254) return null;
  return clean;
}

/**
 * Hashes an identifier for logging purposes without exposing the actual email.
 */
export function hashIdentifierForAudit(identifier: string): string {
  return crypto.createHash("sha256").update(identifier).digest("hex").slice(0, 12);
}

/**
 * Rate limits login attempts for an incoming request.
 * Enforces dual limits:
 *  1. Per client IP (protects against distributed username enumeration / stuffing)
 *  2. Per account identifier (protects specific user against brute force)
 *  3. Per IP + account combination
 *
 * Runs BEFORE expensive password verification (bcrypt).
 */
export async function checkLoginRateLimit(
  request: Request | NextRequest,
  rawAccountIdentifier?: unknown,
  customStore?: RateLimitStore,
): Promise<RateLimitResult> {
  const store = customStore ?? getRateLimitStore();
  const clientIp = getClientIp(request);
  const normalizedAccount = normalizeAccountIdentifier(rawAccountIdentifier);

  const ipKey = `rl:login:ip:${clientIp}`;
  const accountKey = normalizedAccount ? `rl:login:acc:${normalizedAccount}` : null;
  const pairKey = normalizedAccount ? `rl:login:pair:${clientIp}:${normalizedAccount}` : null;

  try {
    return await evaluateRateLimits(store, ipKey, accountKey, pairKey);
  } catch (error) {
    // Log structured security alert without sensitive data
    console.error("[SECURITY] Rate limit store failure during login attempt", {
      clientIp,
      hasAccount: Boolean(normalizedAccount),
      policy: RATE_LIMIT_CONFIG.ON_STORE_ERROR,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    if (RATE_LIMIT_CONFIG.ON_STORE_ERROR === "fail_closed") {
      return {
        allowed: false,
        limit: RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS,
        remaining: 0,
        resetSeconds: 60,
        retryAfter: 60,
        reason: "Rate limiting service temporarily unavailable.",
      };
    }

    // Fallback: evaluate using resilient in-memory store so this server instance still blocks brute force
    try {
      return await evaluateRateLimits(memoryStore, ipKey, accountKey, pairKey);
    } catch {
      // Extreme fallback
      return {
        allowed: true,
        limit: RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS,
        remaining: 1,
        resetSeconds: 60,
        retryAfter: 0,
      };
    }
  }
}

async function evaluateRateLimits(
  store: RateLimitStore,
  ipKey: string,
  accountKey: string | null,
  pairKey: string | null,
): Promise<RateLimitResult> {
  const windowSec = RATE_LIMIT_CONFIG.WINDOW_SECONDS;

  // 1. Increment IP counter
  const ipResult = await store.increment(ipKey, windowSec);
  if (ipResult.count > RATE_LIMIT_CONFIG.IP_MAX_ATTEMPTS) {
    return {
      allowed: false,
      limit: RATE_LIMIT_CONFIG.IP_MAX_ATTEMPTS,
      remaining: 0,
      resetSeconds: ipResult.resetSeconds,
      retryAfter: ipResult.resetSeconds,
      reason: "Too many login attempts from this IP address.",
    };
  }

  // 2. If account is provided, check account counter
  if (accountKey && pairKey) {
    const accResult = await store.increment(accountKey, windowSec);
    if (accResult.count > RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS) {
      return {
        allowed: false,
        limit: RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS,
        remaining: 0,
        resetSeconds: accResult.resetSeconds,
        retryAfter: accResult.resetSeconds,
        reason: "Too many login attempts for this account.",
      };
    }

    const pairResult = await store.increment(pairKey, windowSec);
    if (pairResult.count > RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS) {
      return {
        allowed: false,
        limit: RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS,
        remaining: 0,
        resetSeconds: pairResult.resetSeconds,
        retryAfter: pairResult.resetSeconds,
        reason: "Too many login attempts.",
      };
    }

    const minRemaining = Math.max(
      0,
      Math.min(
        RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS - accResult.count,
        RATE_LIMIT_CONFIG.IP_MAX_ATTEMPTS - ipResult.count,
      ),
    );

    return {
      allowed: true,
      limit: RATE_LIMIT_CONFIG.ACCOUNT_MAX_ATTEMPTS,
      remaining: minRemaining,
      resetSeconds: Math.max(accResult.resetSeconds, ipResult.resetSeconds),
      retryAfter: 0,
    };
  }

  // Malformed or missing account: only IP is tracked
  const remaining = Math.max(0, RATE_LIMIT_CONFIG.IP_MAX_ATTEMPTS - ipResult.count);
  return {
    allowed: true,
    limit: RATE_LIMIT_CONFIG.IP_MAX_ATTEMPTS,
    remaining,
    resetSeconds: ipResult.resetSeconds,
    retryAfter: 0,
  };
}

/**
 * Resets account and pair limits upon successful login.
 */
export async function resetLoginRateLimit(
  request: Request | NextRequest,
  rawAccountIdentifier?: unknown,
  customStore?: RateLimitStore,
): Promise<void> {
  const store = customStore ?? getRateLimitStore();
  const clientIp = getClientIp(request);
  const normalized = normalizeAccountIdentifier(rawAccountIdentifier);
  if (!normalized) return;

  const accountKey = `rl:login:acc:${normalized}`;
  const pairKey = `rl:login:pair:${clientIp}:${normalized}`;

  try {
    await Promise.all([store.reset(accountKey), store.reset(pairKey)]);
  } catch {
    // Non-fatal
  }
}

/**
 * Creates a standardized 429 Too Many Requests response with proper headers.
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const response = NextResponse.json(
    {
      message: "Too many login attempts. Please try again later.",
      retryAfter: result.retryAfter,
    },
    { status: 429 },
  );

  response.headers.set("Retry-After", String(result.retryAfter));
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", "0");
  response.headers.set("X-RateLimit-Reset", String(Math.floor(Date.now() / 1000) + result.resetSeconds));

  return response;
}
