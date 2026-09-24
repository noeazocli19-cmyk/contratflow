// ContractFlow — subscription plans
// Single plan: 2000 FCFA / month (configurable via env SAAS_PLAN_PRICE_FCFA)
// Payment provider: SaasPay (see src/lib/saaspay.ts)

import { db } from "@/lib/db";

export const PLAN_PRICE_FCFA = Number(process.env.SAAS_PLAN_PRICE_FCFA || 2000);
export const PLAN_CURRENCY = process.env.SAAS_PLAN_CURRENCY || "XOF";
export const PLAN_INTERVAL = process.env.SAAS_PLAN_INTERVAL || "MONTHLY";

export const PLANS = {
  FREE: {
    name: "Découverte",
    price: 0,
    maxClients: 3,
    maxProposalsPerMonth: 5,
    maxContracts: 3,
    maxActiveProjects: 3,
    maxInvoicesPerMonth: 10,
    maxMembers: 1,
    storageMb: 50,
    automations: false,
    templates: false,
    pdfExport: false,
    reminders: false,
    customBranding: false,
    aiAssistant: false,
    recurringInvoices: false,
    referralProgram: false,
  },
  PRO: {
    name: "Pro",
    price: PLAN_PRICE_FCFA, // 2000 FCFA
    maxClients: Infinity,
    maxProposalsPerMonth: Infinity,
    maxContracts: Infinity,
    maxActiveProjects: Infinity,
    maxInvoicesPerMonth: Infinity,
    maxMembers: 1,
    storageMb: 1024 * 5, // 5 Go
    automations: true,
    templates: true,
    pdfExport: true,
    reminders: true,
    customBranding: true,
    aiAssistant: true,
    recurringInvoices: true,
    referralProgram: true,
  },
  AGENCY: {
    name: "Agency",
    price: PLAN_PRICE_FCFA * 3, // 6000 FCFA — same SaaSPay payment, but unlocks team
    maxClients: Infinity,
    maxProposalsPerMonth: Infinity,
    maxContracts: Infinity,
    maxActiveProjects: Infinity,
    maxInvoicesPerMonth: Infinity,
    maxMembers: 5,
    storageMb: 10240, // 10 Go
    automations: true,
    templates: true,
    pdfExport: true,
    reminders: true,
    customBranding: true,
    aiAssistant: true,
    recurringInvoices: true,
    referralProgram: true,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type LimitKey = keyof typeof PLANS["FREE"];

export async function getPlanLimits(organizationId: string) {
  const sub = await db.subscription.findUnique({ where: { organizationId } });
  const plan = (sub?.plan as PlanKey) || "FREE";
  return PLANS[plan];
}

export async function checkLimit(
  organizationId: string,
  limit: LimitKey,
  currentCount?: number,
): Promise<{ ok: boolean; current: number; max: number; plan: string }> {
  const limits = await getPlanLimits(organizationId);
  const max = limits[limit] as number;
  if (max === Infinity) {
    return { ok: true, current: currentCount || 0, max: Infinity as unknown as number, plan: limits.name };
  }
  if ((currentCount || 0) >= max) {
    return { ok: false, current: currentCount || 0, max, plan: limits.name };
  }
  return { ok: true, current: currentCount || 0, max, plan: limits.name };
}

export function planPrice(plan: PlanKey): number {
  return PLANS[plan].price;
}
