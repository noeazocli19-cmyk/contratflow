import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

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

  const org = await db.organization.findUnique({
    where: { id: ctx.user.organizationId },
  });
  if (!org) return err("Organisation introuvable", 404);
  return ok(org);
}

export async function PATCH(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ORG_FIELDS.has(k)) data[k] = v;
  }
  if (Object.keys(data).length === 0) return err("Aucun champ valide", 400);

  const org = await db.organization.update({
    where: { id: ctx.user.organizationId },
    data,
  });
  return ok(org);
}
