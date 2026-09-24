import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

const ALLOWED_TRIGGERS = [
  "INVOICE_DUE_SOON",
  "INVOICE_OVERDUE",
  "CONTRACT_UNSIGNED",
  "PROPOSAL_EXPIRING",
];

const ALLOWED_CHANNELS = ["EMAIL", "SMS", "WHATSAPP", "IN_APP"];

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.reminder.findMany({
    where: { organizationId: ctx.user.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  const { name, trigger, daysOffset, channel, emailTemplateId, active } =
    body || {};

  if (!name || !trigger) {
    return err("name et trigger sont requis", 400);
  }
  if (!ALLOWED_TRIGGERS.includes(trigger)) {
    return err("Trigger invalide", 400);
  }

  // Validate email template tenancy if provided
  if (emailTemplateId) {
    const tpl = await db.emailTemplate.findFirst({
      where: { id: emailTemplateId, organizationId: ctx.user.organizationId },
    });
    if (!tpl) return err("Modèle d'email introuvable", 404);
  }

  const finalChannel =
    typeof channel === "string" && ALLOWED_CHANNELS.includes(channel)
      ? channel
      : "EMAIL";

  const created = await db.reminder.create({
    data: {
      organizationId: ctx.user.organizationId,
      name,
      trigger,
      daysOffset: typeof daysOffset === "number" ? daysOffset : 0,
      channel: finalChannel,
      emailTemplateId: emailTemplateId ?? null,
      active: typeof active === "boolean" ? active : true,
    },
  });
  return ok(created, 201);
}
