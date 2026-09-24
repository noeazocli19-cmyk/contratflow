// ContractFlow demo seed — idempotent.
// Run with: bun prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const db = new PrismaClient();

function token(n = 24) {
  return randomBytes(n).toString("hex");
}

async function main() {
  // 1. Org + demo user
  let org = await db.organization.findFirst({ where: { name: "Studio Nova" } });
  if (!org) {
    org = await db.organization.create({
      data: {
        name: "Studio Nova",
        email: "hello@studionova.app",
        phone: "+229 01 96 00 00 00",
        address: "Cotonou, Bénin",
        country: "Bénin",
        currency: "XOF",
        website: "https://studionova.app",
        industry: "Studio créatif & web",
        taxRate: 0,
        legalForm: "Auto-entreprise",
        defaultPaymentTerms: 7,
      },
    });
  }

  const email = "demo@contractflow.app";
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        passwordHash: bcrypt.hashSync("demodemo", 12),
        name: "Jean Nova",
        phone: "+229 01 96 00 00 00",
        role: "OWNER",
        organizationId: org.id,
        onboardingStep: 9,
        // Better Auth credential account — allows login via auth.api.signInEmail
        accounts: {
          create: {
            accountId: email,
            providerId: "credential",
            password: bcrypt.hashSync("demodemo", 12),
          },
        },
      },
    });
  }

  await db.subscription.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      plan: "PRO",
      status: "ACTIVE",
      seats: 2,
      renewsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
    update: {},
  });

  // 2. Clients
  const clientDefs = [
    { firstName: "Koffi", lastName: "Adjoua", company: "ABC Construction", email: "koffi@abcconstruction.bj", phone: "+229 01 97 11 11 11", country: "Bénin", address: "Cotonou", sector: "Construction" },
    { firstName: "Awa", lastName: "Diallo", company: "Kora Fashion", email: "awa@korafashion.com", phone: "+221 77 123 45 67", country: "Sénégal", address: "Dakar", sector: "Mode" },
    { firstName: "Patrick", lastName: "Houessou", company: "TechBenin", email: "patrick@techbenin.com", phone: "+229 01 96 22 22 22", country: "Bénin", address: "Cotonou", sector: "Tech" },
    { firstName: "Carla", lastName: "Mavrick", company: "Mavrick Consulting", email: "carla@mavrick.co", phone: "+225 07 00 00 00 00", country: "Côte d'Ivoire", address: "Abidjan", sector: "Conseil" },
  ];

  const clients: { id: string; firstName: string; lastName: string; company: string | null; email: string | null; sector?: string }[] = [];
  for (const c of clientDefs) {
    let client = await db.client.findFirst({ where: { organizationId: org.id, company: c.company || "" } });
    if (!client) {
      const { sector: _sector, ...clientData } = c;
      void _sector;
      client = await db.client.create({
        data: { ...clientData, organizationId: org.id, portalToken: token() },
      });
    }
    clients.push(client);
  }

  // 3. Prospects (some converted → linked to clients above, some unconverted)
  const prospectDefs = [
    { name: "Yasmine Touré", company: "Bella Studio", status: "NEW", potentialValue: 800000, source: "Site web" },
    { name: "Olivier Kouamé", company: "Kouamé SARL", status: "CONTACTED", potentialValue: 1500000, source: "Référence", nextActionAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3) },
    { name: "Fatou Ndiaye", company: "Ndiaye Immo", status: "QUALIFIED", potentialValue: 2200000, source: "LinkedIn" },
    { name: "Brice Aholou", company: "Aholou Logistique", status: "PROPOSAL_SENT", potentialValue: 3200000, source: "Salon" },
    { name: "Nadia Benali", company: "Benali Déco", status: "NEGOTIATION", potentialValue: 1200000, source: "Instagram" },
    { name: "Éric Moudouti", company: "Moudouti Photo", status: "LOST", potentialValue: 600000, source: "Référence" },
  ];
  for (const p of prospectDefs) {
    const exists = await db.prospect.findFirst({ where: { organizationId: org.id, name: p.name } });
    if (!exists) {
      await db.prospect.create({
        data: { ...p, organizationId: org.id, contactedAt: p.status !== "NEW" ? new Date() : null },
      });
    }
  }

  // 4. Proposals
  const client1 = clients[0];
  const client2 = clients[1];
  const client3 = clients[2];
  const client4 = clients[3];

  async function makeProposal(opts: {
    client: typeof client1;
    number: string;
    title: string;
    problem: string;
    solution: string;
    deliverables: string;
    timeline: string;
    amount: number;
    status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REFUSED" | "EXPIRED";
    items: { title: string; description?: string; qty?: number; unitPrice: number }[];
  }) {
    const existing = await db.proposal.findFirst({ where: { organizationId: org.id, number: opts.number } });
    if (existing) return existing;
    return db.proposal.create({
      data: {
        organizationId: org.id,
        clientId: opts.client.id,
        number: opts.number,
        title: opts.title,
        problem: opts.problem,
        solution: opts.solution,
        deliverables: opts.deliverables,
        timeline: opts.timeline,
        amount: opts.amount,
        currency: org.currency,
        conditions: "Paiement : 30% à l'acceptation, 70% à la livraison.\nProposition valable 30 jours.",
        validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        status: opts.status,
        publicToken: token(),
        sentAt: opts.status !== "DRAFT" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 5) : null,
        viewedAt: opts.status === "VIEWED" || opts.status === "ACCEPTED" || opts.status === "REFUSED" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 4) : null,
        acceptedAt: opts.status === "ACCEPTED" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) : null,
        refusedAt: opts.status === "REFUSED" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) : null,
        items: { create: opts.items },
      },
    });
  }

  const prop1 = await makeProposal({
    client: client1,
    number: "PROP-2026-001",
    title: "Création du site web ABC Construction",
    problem:
      "ABC Construction a besoin d'un site vitrine professionnel pour présenter ses réalisations, capter des leads et rassurer les donneurs d'ordres publics.",
    solution:
      "Nous concevons un site sur mesure, responsive, optimisé SEO, avec une galerie de projets, un formulaire de devis et une intégration WhatsApp.",
    deliverables:
      "- Site vitrine 5 pages\n- Design responsive\n- Formulaire de devis\n- Intégration WhatsApp\n- Optimisation SEO de base\n- Formation à la mise à jour",
    timeline: "4 semaines après validation de l'acompte.",
    amount: 1500000,
    status: "ACCEPTED",
    items: [
      { title: "UX / UI Design", qty: 1, unitPrice: 400000 },
      { title: "Développement Frontend", qty: 1, unitPrice: 700000 },
      { title: "Intégration & SEO", qty: 1, unitPrice: 400000 },
    ],
  });

  const prop2 = await makeProposal({
    client: client2,
    number: "PROP-2026-002",
    title: "Boutique en ligne Kora Fashion",
    problem:
      "Kora Fashion souhaite vendre ses créations en ligne avec une boutique élégante et un tunnel de paiement adapté à l'Afrique de l'Ouest.",
    solution:
      "Nous déployons une boutique Shopify personnalisée + intégration Mobile Money (Wave, Orange Money) et livraison auto.",
    deliverables:
      "- Boutique Shopify\n- Thème sur-mesure\n- Intégration Mobile Money\n- Réglages SEO & marketing\n- Formation",
    timeline: "3 semaines.",
    amount: 1200000,
    status: "VIEWED",
    items: [
      { title: "Design boutique", qty: 1, unitPrice: 500000 },
      { title: "Développement & intégration paiement", qty: 1, unitPrice: 700000 },
    ],
  });

  const prop3 = await makeProposal({
    client: client3,
    number: "PROP-2026-003",
    title: "Refonte plateforme SaaS TechBenin",
    problem:
      "La plateforme actuelle de TechBenin est lente et le parcours utilisateur obsolète. Besoin d'une refonte complète.",
    solution:
      "Refonte de l'interface en Next.js, design system, performances optimisées et accessibilité.",
    deliverables: "- Refonte UI\n- Design system\n- Optimisation perfs\n- Tests",
    timeline: "8 semaines.",
    amount: 3500000,
    status: "DRAFT",
    items: [
      { title: "Audit & design system", qty: 1, unitPrice: 800000 },
      { title: "Refonte application", qty: 1, unitPrice: 2000000 },
      { title: "Tests & mise en production", qty: 1, unitPrice: 700000 },
    ],
  });

  // 5. Contract (from accepted proposal)
  async function makeContract(opts: {
    number: string;
    client: typeof client1;
    proposalId?: string | null;
    title: string;
    content: string;
    amount: number;
    startDate: Date;
    endDate: Date;
    duration: string;
    status: "DRAFT" | "SENT" | "VIEWED" | "SIGNED" | "EXPIRED" | "CANCELED";
  }) {
    const existing = await db.contract.findFirst({ where: { organizationId: org.id, number: opts.number } });
    if (existing) return existing;
    return db.contract.create({
      data: {
        organizationId: org.id,
        clientId: opts.client.id,
        proposalId: opts.proposalId ?? null,
        number: opts.number,
        title: opts.title,
        content: opts.content,
        amount: opts.amount,
        currency: org.currency,
        startDate: opts.startDate,
        endDate: opts.endDate,
        duration: opts.duration,
        conditions: "Acompte de 30% à la signature. Solde à la livraison.",
        status: opts.status,
        publicToken: token(),
        sentAt: opts.status !== "DRAFT" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 4) : null,
        viewedAt: opts.status === "VIEWED" || opts.status === "SIGNED" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) : null,
        signedAt: opts.status === "SIGNED" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) : null,
      },
    });
  }

  const contract1 = await makeContract({
    number: "CONTRAT-2026-001",
    client: client1,
    proposalId: prop1.id,
    title: "Contrat de prestation — Création site web ABC Construction",
    content: `# Contrat de prestation

**Entre les soussignés :**

- **Studio Nova** (le Prestataire), situé à Cotonou, Bénin
- **ABC Construction**, représentée par {{client_name}} (le Client)

## Article 1 — Objet
Le Prestataire s'engage à réaliser pour le Client la prestation suivante : **{{project_name}}**.

## Article 2 — Montant
Le montant total de la prestation est de **{{amount}}**, payable selon l'échéancier suivant :
- 30% d'acompte à la signature
- 70% à la livraison

## Article 3 — Durée
La prestation débute le {{start_date}} pour une durée de {{duration}}.

## Article 4 — Livrables
Conformément à la proposition PROP-2026-001.

## Article 5 — Conditions générales
Toute modification fera l'objet d'un avenant. Le présent contrat est régi par le droit béninois.

Signé électroniquement via ContractFlow.`,
    amount: 1500000,
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 26),
    duration: "4 semaines",
    status: "SIGNED",
  });

  await db.signature.create({
    data: {
      contractId: contract1.id,
      signedBy: `${client1.firstName} ${client1.lastName}`,
      signedByEmail: client1.email || "",
      signedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      ipAddress: "196.41.0.1",
      userAgent: "Mozilla/Chrome",
      signatureData: "Koffi Adjoua",
    },
  }).catch(() => {});

  const contract2 = await makeContract({
    number: "CONTRAT-2026-002",
    client: client2,
    proposalId: null,
    title: "Contrat — Boutique en ligne Kora Fashion",
    content: `# Contrat — Boutique en ligne

**Prestataire** : Studio Nova

**Client** : Awa Diallo (Kora Fashion)

Le Prestataire réalise la boutique en ligne « Boutique en ligne Kora Fashion » pour un montant de 1 200 000 F CFA.

## Échéances
- 50% à la signature (600 000 F CFA)
- 50% à la livraison (600 000 F CFA)

## Durée
3 semaines à compter du 24 septembre 2026.

## Conditions générales
Toute modification fera l'objet d'un avenant. Le présent contrat est régi par le droit sénégalais.`,
    amount: 1200000,
    startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 24),
    duration: "3 semaines",
    status: "SENT",
  });

  // 6. Payment plan + installments (contract1, signed)
  const plan = await db.paymentPlan.create({
    data: {
      contractId: contract1.id,
      totalAmount: 1500000,
      installments: {
        create: [
          { label: "Acompte 30%", amount: 450000, dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), order: 0, status: "PAID" },
          { label: "Solde 70%", amount: 1050000, dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 26), order: 1, status: "UPCOMING" },
        ],
      },
    },
  });

  // 7. Project (from signed contract)
  const project = await db.project.create({
    data: {
      organizationId: org.id,
      clientId: client1.id,
      contractId: contract1.id,
      name: "Site web ABC Construction",
      description: "Refonte du site vitrine ABC Construction.",
      budget: 1500000,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 26),
      status: "IN_PROGRESS",
      progress: 35,
      tasks: {
        create: [
          { title: "Wireframes & maquettes", status: "DONE", priority: "HIGH", order: 0 },
          { title: "Validation design client", status: "DONE", priority: "HIGH", order: 0 },
          { title: "Intégration page d'accueil", status: "DOING", priority: "HIGH", order: 0 },
          { title: "Développement galerie projets", status: "TODO", priority: "MEDIUM", order: 0 },
          { title: "Formulaire de devis + WhatsApp", status: "TODO", priority: "MEDIUM", order: 0 },
          { title: "Optimisation SEO", status: "TODO", priority: "LOW", order: 0 },
          { title: "Tests & mise en ligne", status: "REVIEW", priority: "HIGH", order: 0 },
        ],
      },
    },
  });

  // 8. Invoices
  async function makeInvoice(opts: {
    number: string;
    client: typeof client1;
    project?: { id: string } | null;
    contract?: { id: string } | null;
    type: "DEPOSIT" | "MILESTONE" | "FINAL";
    items: { title: string; qty?: number; unitPrice: number }[];
    status: "DRAFT" | "SENT" | "VIEWED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELED";
    issueOffsetDays: number;
    dueOffsetDays?: number;
    paidAt?: Date;
    sentAt?: Date;
  }) {
    const existing = await db.invoice.findFirst({ where: { organizationId: org.id, number: opts.number } });
    if (existing) return existing;
    const sub = opts.items.reduce((s, it) => s + (it.qty ?? 1) * it.unitPrice, 0);
    return db.invoice.create({
      data: {
        organizationId: org.id,
        clientId: opts.client.id,
        projectId: opts.project?.id ?? null,
        contractId: opts.contract?.id ?? null,
        number: opts.number,
        type: opts.type,
        issueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * opts.issueOffsetDays),
        dueDate: opts.dueOffsetDays != null ? new Date(Date.now() + 1000 * 60 * 60 * 24 * opts.dueOffsetDays) : null,
        status: opts.status,
        publicToken: token(),
        sentAt: opts.sentAt ?? (opts.status !== "DRAFT" ? new Date(Date.now() - 1000 * 60 * 60 * 24 * opts.issueOffsetDays) : null),
        viewedAt: ["VIEWED", "PARTIALLY_PAID", "PAID"].includes(opts.status) ? new Date(Date.now() - 1000 * 60 * 60 * 24 * (opts.issueOffsetDays - 1)) : null,
        paidAt: opts.paidAt ?? (opts.status === "PAID" ? new Date() : null),
        items: { create: opts.items },
      },
    });
  }

  const inv1 = await makeInvoice({
    number: "INV-2026-0001",
    client: client1,
    project: { id: project.id },
    contract: { id: contract1.id },
    type: "DEPOSIT",
    items: [{ title: "Acompte 30% — Site ABC Construction", unitPrice: 450000 }],
    status: "PAID",
    issueOffsetDays: 2,
    dueOffsetDays: 5,
    paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  });

  const inv2 = await makeInvoice({
    number: "INV-2026-0002",
    client: client1,
    project: { id: project.id },
    contract: { id: contract1.id },
    type: "FINAL",
    items: [{ title: "Solde 70% — Site ABC Construction", unitPrice: 1050000 }],
    status: "DRAFT",
    issueOffsetDays: 0,
  });

  const inv3 = await makeInvoice({
    number: "INV-2026-0003",
    client: client3,
    project: null,
    contract: null,
    type: "FINAL",
    items: [
      { title: "Maintenance mensuelle", unitPrice: 250000 },
      { title: "Hébergement", unitPrice: 50000 },
    ],
    status: "OVERDUE",
    issueOffsetDays: 35,
    dueOffsetDays: -5,
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 35),
  });

  const inv4 = await makeInvoice({
    number: "INV-2026-0004",
    client: client4,
    project: null,
    contract: null,
    type: "FINAL",
    items: [{ title: "Audit marketing & stratégie", unitPrice: 800000 }],
    status: "SENT",
    issueOffsetDays: 3,
    dueOffsetDays: 4,
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  });

  const inv5 = await makeInvoice({
    number: "INV-2026-0005",
    client: client2,
    project: null,
    contract: null,
    type: "DEPOSIT",
    items: [{ title: "Acompte 50% — Boutique Kora Fashion", unitPrice: 600000 }],
    status: "PARTIALLY_PAID",
    issueOffsetDays: 10,
    dueOffsetDays: -1,
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
  });

  // Link installment[0] to inv1
  await db.installment.updateMany({ where: { paymentPlanId: plan.id, order: 0 }, data: { invoiceId: inv1.id } });

  // 9. Payments
  async function makePayment(opts: { amount: number; client: typeof client1; invoice?: { id: string } | null; method: "CASH" | "TRANSFER" | "CARD" | "MOBILE_MONEY" | "OTHER"; daysAgo: number; reference: string }) {
    return db.payment.create({
      data: {
        organizationId: org.id,
        clientId: opts.client.id,
        invoiceId: opts.invoice?.id ?? null,
        amount: opts.amount,
        method: opts.method,
        reference: opts.reference,
        status: "CONFIRMED",
        paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * opts.daysAgo),
        note: opts.reference,
      },
    });
  }

  await makePayment({ amount: 450000, client: client1, invoice: { id: inv1.id }, method: "MOBILE_MONEY", daysAgo: 1, reference: "MOB-77123" });
  await makePayment({ amount: 300000, client: client2, invoice: { id: inv5.id }, method: "TRANSFER", daysAgo: 5, reference: "VIR-0921" });
  await makePayment({ amount: 600000, client: client3, invoice: { id: inv3.id }, method: "CASH", daysAgo: 30, reference: "CASH-0093" });

  // 10. Notifications
  const notifs = [
    { type: "CONTRACT_SIGNED", title: "Contrat signé", message: "ABC Construction a signé le contrat CONTRAT-2026-001.", link: "contract-detail:CONTRAT-2026-001" },
    { type: "PAYMENT_RECEIVED", title: "Paiement reçu", message: "Acompte de 450 000 FCFA reçu de ABC Construction.", link: "payments" },
    { type: "INVOICE_OVERDUE", title: "Facture en retard", message: "La facture INV-2026-0003 pour TechBenin est en retard.", link: "invoices" },
    { type: "PROPOSAL_VIEWED", title: "Proposition consultée", message: "Kora Fashion a consulté la proposition PROP-2026-002.", link: "proposals" },
  ];
  for (const n of notifs) {
    const exists = await db.notification.findFirst({ where: { organizationId: org.id, title: n.title, message: n.message } });
    if (!exists) {
      await db.notification.create({
        data: { organizationId: org.id, ...n, read: n.type === "PROPOSAL_VIEWED" ? false : false },
      });
    }
  }

  // 11. Timeline events for client1
  const tEvents = [
    { type: "LEAD_CREATED", message: "Prospect converti en client" },
    { type: "PROPOSAL_SENT", message: "Proposition PROP-2026-001 envoyée", proposalId: prop1.id },
    { type: "PROPOSAL_VIEWED", message: "Proposition consultée par le client", proposalId: prop1.id },
    { type: "CONTRACT_SIGNED", message: "Contrat CONTRAT-2026-001 signé", contractId: contract1.id },
    { type: "DEPOSIT_PAID", message: "Acompte de 450 000 FCFA payé" },
    { type: "PROJECT_STARTED", message: "Projet Site web ABC Construction démarré", projectId: project.id },
  ];
  for (let i = 0; i < tEvents.length; i++) {
    const e = tEvents[i];
    const exists = await db.timelineEvent.findFirst({ where: { clientId: client1.id, message: e.message } });
    if (!exists) {
      await db.timelineEvent.create({
        data: {
          clientId: client1.id,
          proposalId: e.proposalId ?? null,
          contractId: e.contractId ?? null,
          projectId: e.projectId ?? null,
          type: e.type,
          message: e.message,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * (tEvents.length - i)),
        },
      });
    }
  }

  console.log("Seed complete. Login: demo@contractflow.app / demodemo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
