import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const item = await db.contract.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: {
      client: true,
      signatures: true,
      project: true,
      invoices: true,
      paymentPlan: {
        include: {
          installments: {
            include: { invoice: true },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });
  if (!item) return err("Contrat introuvable", 404);
  return ok(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const body = await req.json();
  const existing = await db.contract.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Contrat introuvable", 404);

  const data: any = {};
  const allowed = [
    "title",
    "content",
    "amount",
    "currency",
    "duration",
    "conditions",
    "status",
  ];
  for (const k of allowed) {
    if (k in body) data[k] = body[k];
  }
  if ("startDate" in body) {
    data.startDate = body.startDate ? new Date(body.startDate) : null;
  }
  if ("endDate" in body) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }

  const updated = await db.contract.update({
    where: { id },
    data,
    include: { client: true },
  });
  return ok(updated);
}
