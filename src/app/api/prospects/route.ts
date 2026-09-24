import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.prospect.findMany({
    where: { organizationId: ctx.user.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
    return err("Le nom est requis", 400);
  }
  const data: any = {
    organizationId: ctx.user.organizationId,
    name: body.name.trim(),
    company: body.company ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    sector: body.sector ?? null,
    source: body.source ?? null,
    status: body.status ?? "NEW",
    notes: body.notes ?? null,
    potentialValue: typeof body.potentialValue === "number" ? body.potentialValue : 0,
    contactedAt: body.contactedAt ? new Date(body.contactedAt) : null,
    nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
  };
  const created = await db.prospect.create({ data });
  return ok(created, 201);
}
