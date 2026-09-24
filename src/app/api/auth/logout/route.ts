// POST /api/auth/logout — clears the Better Auth session.

import { ok } from "@/lib/server";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";

export async function POST() {
  try {
    await auth.api.signOut({ headers: await nextHeaders() });
  } catch {
    // ignore — even if session is already invalid
  }
  return ok({ ok: true });
}
