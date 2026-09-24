// ContractFlow — Better Auth configuration
// (https://www.better-auth.com/docs)
//
// Better Auth handles:
//   - Email/password sign-up & sign-in
//   - Session management (cookies, secure in production)
//   - Password reset / forgot-password flow
//   - OAuth/social logins (Google, GitHub, etc.) — see `social` below
//   - Email verification
//
// Endpoints exposed at /api/auth/[...all]:
//   POST /api/auth/sign-up/email
//   POST /api/auth/sign-in/email
//   POST /api/auth/sign-out
//   GET  /api/auth/get-session
//   POST /api/auth/forget-password
//   POST /api/auth/reset-password
//   POST /api/auth/change-password
//   POST /api/auth/send-verification-email
//   POST /api/auth/verify-email
//   ... and more (see Better Auth docs)
//
// We also keep the legacy endpoints (/api/auth/login, /api/auth/register, /api/auth/me,
// /api/auth/logout, /api/auth/forgot-password, /api/auth/reset-password, /api/auth/change-password)
// as THIN WRAPPERS that call Better Auth's internal API so the frontend doesn't need changes.
//
// ─────────────────────────────────────────────────────────────────────────────
// CONFIG (env vars)
// ─────────────────────────────────────────────────────────────────────────────
//   BETTER_AUTH_SECRET       — long random string (use `openssl rand -base64 32`)
//   BETTER_AUTH_URL          — your app's public URL (https://app.contractflow.com)
//   JWT_SECRET               — kept for backward compat (legacy helpers below)
//
// ─────────────────────────────────────────────────────────────────────────────
// Migrating existing users
// ─────────────────────────────────────────────────────────────────────────────
// Existing users have a `passwordHash` (bcrypt $2b$...) on the User model.
// Better Auth stores passwords in the `Account.password` field.
// Migration script: see prisma/migrate-to-better-auth.ts (run once after deployment).

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";

const APP_URL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const SECRET = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || "dev-better-auth-secret-change-me";
const IS_PROD = process.env.NODE_ENV === "production";

// ─────────────────────────────────────────────────────────────────────────────
// Better Auth instance
// ─────────────────────────────────────────────────────────────────────────────
export const auth = betterAuth({
  appName: "ContractFlow",
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  secret: SECRET,
  baseURL: APP_URL,
  trustedOrigins: [APP_URL, "https://checkout.saaspay.com"],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // set to true in production once email is configured
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh session every 24h
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // cache session for 5 min to reduce DB hits
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "OWNER",
        required: false,
      },
      organizationId: {
        type: "string",
        required: false,
      },
      onboardingStep: {
        type: "number",
        defaultValue: 0,
        required: false,
      },
      // keep these legacy fields accessible on the user object
      phone: { type: "string", required: false },
      avatarUrl: { type: "string", required: false },
    },
  },
  advanced: {
    useSecureCookies: IS_PROD,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: IS_PROD ? "strict" : "lax",
      secure: IS_PROD,
    },
    cookiePrefix: "cf",
  },
  // ───────────────────────────────────────────────────────────────────────────
  // Social providers (configure when ready)
  // ───────────────────────────────────────────────────────────────────────────
  social: {
    google: {
      enabled: false, // set to true and add Google client ID/secret in .env
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
    github: {
      enabled: false,
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    },
  },
  // ───────────────────────────────────────────────────────────────────────────
  // Email — for verification, password reset, etc.
  // (Use a transactional email provider in production — Resend, Postmark, etc.)
  // ───────────────────────────────────────────────────────────────────────────
  emailVerification: {
    enabled: false, // enable once email transport is configured
    sendVerificationEmail: async ({ user, token }) => {
      // TODO: send email with link: `${APP_URL}/?verify=${token}`
      console.log(`[email] Verification link for ${user.email}: ${APP_URL}/?verify=${token}`);
    },
  },
  sendResetPassword: async ({ user, token }) => {
    // TODO: send email with link: `${APP_URL}/?reset=${token}`
    console.log(`[email] Reset link for ${user.email}: ${APP_URL}/?reset=${token}`);
  },
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;

// ─────────────────────────────────────────────────────────────────────────────
// Legacy helpers (used by existing route handlers — they wrap Better Auth)
// ─────────────────────────────────────────────────────────────────────────────

import { headers as nextHeaders } from "next/headers";
import { cookies as nextCookies } from "next/headers";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "cf.session_token"; // Better Auth's cookie name with our prefix

export type SessionPayload = {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
};

// Hash a password using the same scheme Better Auth uses (bcryptjs)
export function hashPassword(plain: string) {
  return bcrypt.hashSync(plain, 12);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compareSync(plain, hash);
}

// getCurrentUser — used by all authenticated API routes
// Reads the Better Auth session and returns the user + organization.
export async function getCurrentUser() {
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session?.user) return null;

    // Fetch the full user from our DB (with organization) since Better Auth's session.user
    // doesn't include relations like `organization`.
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true },
    });
    if (!user) return null;

    return {
      user,
      session,
    };
  } catch (e) {
    console.error("getCurrentUser error:", e);
    return null;
  }
}

// Set a session cookie manually (used by legacy wrappers / migration)
// In Better Auth, sessions are created via auth.api.signInEmail, not this helper.
// Kept for backward compat with existing code that calls setSessionCookie.
export async function setSessionCookie(_payload: SessionPayload) {
  // No-op — Better Auth manages cookies via its own API.
  // Use auth.api.signInEmail instead.
  console.warn("setSessionCookie is deprecated — use Better Auth's auth.api.signInEmail instead.");
}

export async function clearSessionCookie() {
  try {
    // Sign out via Better Auth
    await auth.api.signOut({ headers: await nextHeaders() });
  } catch {
    // Fallback: manually clear the cookie
    const store = await nextCookies();
    store.delete(SESSION_COOKIE);
  }
}

// Password strength validator (kept for backward compat)
export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  ok: boolean;
  issues: string[];
};

export function checkPasswordStrength(pw: string): PasswordStrength {
  const issues: string[] = [];
  if (pw.length < 8) issues.push("Au moins 8 caractères");
  if (!/[a-z]/.test(pw)) issues.push("Une lettre minuscule");
  if (!/[A-Z]/.test(pw)) issues.push("Une lettre majuscule");
  if (!/\d/.test(pw)) issues.push("Un chiffre");
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push("Un caractère spécial");

  let score = 4 - Math.min(issues.length, 4);
  if (pw.length < 6) score = 0;
  return { score: score as 0 | 1 | 2 | 3 | 4, ok: issues.length === 0 && pw.length >= 8, issues };
}
