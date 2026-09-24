import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

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

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const user = await db.user.findUnique({
    where: { id: ctx.user.id },
    include: { organization: true },
  });
  if (!user) return err("Non authentifié", 401);
  return ok({ user, organization: user.organization });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const userData: Record<string, unknown> = {};
  const orgData: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(body)) {
    if (USER_FIELDS.has(k)) userData[k] = v;
    else if (ORG_FIELDS.has(k)) orgData[k] = v;
  }

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

  // Better Auth manages the session cookie automatically.
  return ok({ user, organization: user.organization });
}
