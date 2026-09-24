import { NextRequest } from "next/server";
import { getCtx, ok, err, nextNumber, timeline } from "@/lib/server";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

// POST /api/contract-templates/:id/instantiate
// Body: { clientId, amount?, startDate?, endDate? }
// Creates a contract from the template, replacing template variables.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const template = await db.contractTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!template) return err("Modèle introuvable", 404);

  const body = await req.json();
  const { clientId, startDate, endDate } = body || {};
  if (!clientId) return err("clientId est requis", 400);

  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.user.organizationId },
  });
  if (!client) return err("Client introuvable", 404);

  const amount =
    typeof body.amount === "number"
      ? body.amount
      : template.defaultAmount ?? 0;
  const currency = template.currency ?? "XOF";

  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : null;

  // Replace template variables
  const client_name = `${client.firstName} ${client.lastName}`.trim();
  const company_name = client.company || client_name;
  const project_name = template.name;
  const amount_str = formatCurrency(amount, currency);
  const start_date_str = formatDate(start);
  const end_date_str = end ? formatDate(end) : "";

  const content = template.content
    .replace(/\{\{client_name\}\}/g, client_name)
    .replace(/\{\{company_name\}\}/g, company_name)
    .replace(/\{\{project_name\}\}/g, project_name)
    .replace(/\{\{amount\}\}/g, amount_str)
    .replace(/\{\{start_date\}\}/g, start_date_str)
    .replace(/\{\{end_date\}\}/g, end_date_str);

  const number = await nextNumber(ctx.user.organizationId, "contract");

  const created = await db.contract.create({
    data: {
      organizationId: ctx.user.organizationId,
      clientId,
      number,
      title: template.name,
      content,
      amount,
      currency,
      startDate: start,
      endDate: end,
    },
    include: { client: true },
  });

  await timeline(
    client.id,
    "CONTRACT_CREATED",
    `Contrat ${created.number} créé depuis le modèle « ${template.name} »`,
    { contractId: created.id },
  );

  return ok(created, 201);
}
