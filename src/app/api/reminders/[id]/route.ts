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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const item = await db.reminder.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!item) return err("Relance introuvable", 404);
  return ok(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.reminder.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Relance introuvable", 404);

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.trigger === "string" && ALLOWED_TRIGGERS.includes(body.trigger)) {
    data.trigger = body.trigger;
  }
  if (typeof body.daysOffset === "number") data.daysOffset = body.daysOffset;
  if (typeof body.channel === "string" && ALLOWED_CHANNELS.includes(body.channel)) {
    data.channel = body.channel;
  }
  if (typeof body.active === "boolean") data.active = body.active;
  if ("emailTemplateId" in body) {
    const tid = body.emailTemplateId;
    if (tid) {
      const tpl = await db.emailTemplate.findFirst({
        where: { id: tid, organizationId: ctx.user.organizationId },
      });
      if (!tpl) return err("Modèle d'email introuvable", 404);
    }
    data.emailTemplateId = tid ?? null;
  }

  const updated = await db.reminder.update({ where: { id }, data });
  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.reminder.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Relance introuvable", 404);
  await db.reminder.delete({ where: { id } });
  return ok({ deleted: true });
}
