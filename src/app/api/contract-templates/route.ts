import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.contractTemplate.findMany({
    where: { organizationId: ctx.user.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  const { name, description, content, defaultAmount, currency } = body || {};
  if (!name || !content) {
    return err("name et content sont requis", 400);
  }
  const created = await db.contractTemplate.create({
    data: {
      organizationId: ctx.user.organizationId,
      name,
      description: description ?? null,
      content,
      defaultAmount: typeof defaultAmount === "number" ? defaultAmount : 0,
      currency: currency ?? "XOF",
    },
  });
  return ok(created, 201);
}
