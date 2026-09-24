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
  const item = await db.proposal.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: { items: true, client: true },
  });
  if (!item) return err("Proposition introuvable", 404);
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
  const existing = await db.proposal.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Proposition introuvable", 404);

  const data: any = {};
  const allowed = [
    "title",
    "problem",
    "solution",
    "deliverables",
    "timeline",
    "amount",
    "currency",
    "conditions",
    "options",
    "notes",
    "status",
  ];
  for (const k of allowed) {
    if (k in body) data[k] = body[k];
  }
  if ("validUntil" in body) {
    data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
  }

  const updated = await db.proposal.update({
    where: { id },
    data,
    include: { items: true, client: true },
  });
  return ok(updated);
}
