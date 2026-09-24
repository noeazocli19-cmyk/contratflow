// ContractFlow — security middleware
// - Rate limiting on /api/auth/* and /api/saaspay/* (in-memory, per-IP)
// - Security headers (CSP, HSTS, X-Frame-Options, etc.)
// - Bot/abuse protection on auth endpoints

import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiter (in-memory, per-IP, sliding window)
// ─────────────────────────────────────────────────────────────────────────────
type RateBucket = { count: number; resetAt: number };
const buckets = new Map<string, RateBucket>();
const RATE_LIMITS: Record<string, { windowMs: number; max: number }> = {
  "/api/auth/login": { windowMs: 60_000, max: 10 },
  "/api/auth/register": { windowMs: 60_000, max: 5 },
  "/api/auth/forgot-password": { windowMs: 60_000, max: 3 },
  "/api/auth/reset-password": { windowMs: 60_000, max: 5 },
  "/api/saaspay/checkout": { windowMs: 60_000, max: 10 },
  "/api/saaspay/webhook": { windowMs: 60_000, max: 60 }, // SaaSPay can retry fast
  "/api/waitlist": { windowMs: 60_000, max: 10 },
  "/api/ai/proposal": { windowMs: 60_000, max: 5 }, // AI is expensive
};

function getRateKey(req: NextRequest, path: string): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `${ip}:${path}`;
}

function checkRate(path: string, key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const limit = RATE_LIMITS[path];
  if (!limit) return { allowed: true, remaining: 999, resetAt: Date.now() + 60_000 };

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { allowed: true, remaining: limit.max - 1, resetAt: now + limit.windowMs };
  }

  if (bucket.count >= limit.max) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit.max - bucket.count, resetAt: bucket.resetAt };
}

// Periodic cleanup of expired buckets (every 5 min)
let lastCleanup = Date.now();
function cleanupBuckets() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60_000) return;
  lastCleanup = now;
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Security headers
// ─────────────────────────────────────────────────────────────────────────────
function securityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self 'https://checkout.saaspay.com')");
  res.headers.set("X-XSS-Protection", "1; mode=block");

  // HSTS only in production (HTTPS)
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // CSP — allows SaaSPay checkout in iframe (for embedded payment)
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.saaspay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.saaspay.com https://checkout.saaspay.com",
      "frame-src 'self' https://checkout.saaspay.com",
      "form-action 'self' https://checkout.saaspay.com",
      "base-uri 'self'",
    ].join("; "),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main middleware
// ─────────────────────────────────────────────────────────────────────────────
export function middleware(req: NextRequest) {
  cleanupBuckets();

  const { pathname } = req.nextUrl;

  // Rate-limit sensitive paths
  for (const path of Object.keys(RATE_LIMITS)) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      const key = getRateKey(req, path);
      const r = checkRate(path, key);
      if (!r.allowed) {
        const res = NextResponse.json(
          { error: "Trop de requêtes. Réessaye dans quelques minutes." },
          { status: 429 },
        );
        res.headers.set("Retry-After", String(Math.ceil((r.resetAt - Date.now()) / 1000)));
        securityHeaders(res);
        return res;
      }
    }
  }

  // Continue
  const res = NextResponse.next();
  securityHeaders(res);
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
