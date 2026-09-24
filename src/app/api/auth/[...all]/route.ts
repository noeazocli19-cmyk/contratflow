// Better Auth — catch-all route handler
// This exposes ALL Better Auth endpoints under /api/auth/* (except the legacy
// wrappers at /api/auth/login, /api/auth/register, /api/auth/me, /api/auth/logout,
// /api/auth/forgot-password, /api/auth/reset-password, /api/auth/change-password — those
// are sibling folders that take priority over the [...all] catch-all).
//
// Better Auth endpoints served here:
//   POST /api/auth/sign-up/email        { email, password, name }
//   POST /api/auth/sign-in/email        { email, password }
//   POST /api/auth/sign-out
//   GET  /api/auth/get-session
//   POST /api/auth/forget-password      { email, redirectURL }
//   POST /api/auth/reset-password       { token, newPassword }
//   POST /api/auth/change-password      { currentPassword, newPassword, newPasswordConfirm }
//   POST /api/auth/send-verification-email
//   POST /api/auth/verify-email         { token }
//   GET  /api/auth/session              (alias)
//   ... and more (see https://www.better-auth.com/docs/api-reference)

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
