import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

const ALLOWED_TYPES = [
  "WELCOME",
  "PROPOSAL_SENT",
  "CONTRACT_SENT",
  "INVOICE_SENT",
  "REMINDER_DUE",
  "REMINDER_OVERDUE",
  "RECEIPT",
  "CUSTOM",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const item = await db.emailTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!item) return err("Modèle introuvable", 404);
  return ok(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.emailTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Modèle introuvable", 404);

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["name", "subject", "body"]) {
    if (k in body) data[k] = body[k];
  }
  if (typeof body.type === "string" && ALLOWED_TYPES.includes(body.type)) {
    data.type = body.type;
  }

  const updated = await db.emailTemplate.update({ where: { id }, data });
  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.emailTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Modèle introuvable", 404);
  await db.emailTemplate.delete({ where: { id } });
  return ok({ deleted: true });
}
