import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

// Allowed keys per model — onboarding steps push partial updates.
const USER_FIELDS = new Set(["name", "phone", "avatarUrl"]);
const ORG_FIELDS = new Set([
  "name",
  "logoUrl",
  "email",
  "phone",
  "address",
  "country",
  "currency",
  "website",
  "industry",
  "taxRate",
  "taxId",
  "legalForm",
  "defaultPaymentTerms",
]);

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const { step, fields } = body as {
    step?: number;
    fields?: Record<string, unknown>;
  };

  if (typeof step !== "number" || step < 1 || step > 9)
    return err("Étape invalide", 400);
  if (!fields || typeof fields !== "object")
    return err("Champs invalides", 400);

  const userData: Record<string, unknown> = {};
  const orgData: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(fields)) {
    if (USER_FIELDS.has(k)) userData[k] = v;
    else if (ORG_FIELDS.has(k)) orgData[k] = v;
  }

  userData.onboardingStep = Math.max(ctx.user.onboardingStep, step);

  if (Object.keys(orgData).length > 0) {
    await db.organization.update({
      where: { id: ctx.user.organizationId },
      data: orgData,
    });
  }

  const user = await db.user.update({
    where: { id: ctx.user.id },
    data: userData,
    include: { organization: true },
  });

  // Better Auth manages the session cookie automatically — no need to re-sign.
  return ok({ user, organization: user.organization });
}
