// Waitlist endpoints — pre-launch signups from the landing page.

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/server";
import { db } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  // Public: count of waitlist entries (for social proof on landing)
  const count = await db.waitlistEntry.count();
  return ok({ count });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const email = String(body.email || "").trim().toLowerCase();
  const name = body.name ? String(body.name).trim() : null;
  const company = body.company ? String(body.company).trim() : null;
  const source = body.source ? String(body.source) : "landing";
  const referralCode = body.referralCode ? String(body.referralCode) : null;

  if (!EMAIL_RE.test(email)) return err("Email invalide", 400);

  const existing = await db.waitlistEntry.findUnique({ where: { email } });
  if (existing) {
    return ok({ id: existing.id, status: existing.status, message: "Vous êtes déjà inscrit !" });
  }

  const entry = await db.waitlistEntry.create({
    data: { email, name, company, source, referralCode },
  });

  return ok({ id: entry.id, status: entry.status, message: "Bienvenue sur la liste d'attente !" }, 201);
}
