// POST /api/auth/register — thin wrapper around Better Auth's signUpEmail.
// Body: { email, password, name, orgName }
// Returns: { user, organization } (with session cookie set automatically)
// Side effects: creates Organization + Subscription (FREE plan) + links user to org.

import { NextRequest } from "next/server";
import { ok, err, audit } from "@/lib/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const { email, password, name, orgName } = body as {
    email?: string;
    password?: string;
    name?: string;
    orgName?: string;
  };

  if (!email || !EMAIL_RE.test(email)) return err("Email invalide", 400);
  if (!password || password.length < 8) return err("Mot de passe : au moins 8 caractères", 400);
  if (!name || name.trim().length < 2) return err("Nom requis (2 caractères min)", 400);
  if (!orgName || orgName.trim().length < 2) return err("Nom d'organisation requis", 400);

  try {
    const hdrs = new Headers(req.headers);
    const result = await auth.api.signUpEmail({
      body: { email, password, name, role: "OWNER", onboardingStep: 1 },
      headers: hdrs,
    });

    const userId = result.user.id;

    // Create the organization + subscription (FREE plan by default)
    const org = await db.organization.create({
      data: {
        name: orgName.trim(),
        currency: "XOF",
        defaultPaymentTerms: 7,
        subscription: {
          create: {
            plan: "FREE",
            status: "ACTIVE",
            seats: 1,
          },
        },
      },
    });

    // Link the user to the organization
    await db.user.update({
      where: { id: userId },
      data: { organizationId: org.id, role: "OWNER" },
    });

    const fullUser = await db.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    await audit(org.id, userId, "USER_REGISTERED", userId, `Inscription de ${email}`, {
      email,
      orgName,
    });

    return ok({ user: fullUser, organization: org }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur d'inscription";
    if (msg.toLowerCase().includes("already")) return err("Email déjà utilisé", 409);
    return err(msg, 400);
  }
}
