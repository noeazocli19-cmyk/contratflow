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

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.emailTemplate.findMany({
    where: { organizationId: ctx.user.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  const { name, subject, body: bodyText, type } = body || {};

  if (!name || !subject || !bodyText) {
    return err("name, subject et body sont requis", 400);
  }

  const finalType = ALLOWED_TYPES.includes(type) ? type : "CUSTOM";

  const created = await db.emailTemplate.create({
    data: {
      organizationId: ctx.user.organizationId,
      name,
      subject,
      body: bodyText,
      type: finalType,
    },
  });
  return ok(created, 201);
}
