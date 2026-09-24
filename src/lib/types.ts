// Shared client/server types for ContractFlow

export type Org = {
  id: string;
  name: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  currency: string;
  website: string | null;
  industry: string | null;
  taxRate: number;
  taxId: string | null;
  legalForm: string | null;
  defaultPaymentTerms: number;
};

export type User = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  organizationId: string;
  onboardingStep: number;
  organization?: Org;
};

export type ProspectStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "CONVERTED"
  | "LOST";

export type Prospect = {
  id: string;
  organizationId: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  sector: string | null;
  source: string | null;
  status: ProspectStatus;
  notes: string | null;
  potentialValue: number;
  contactedAt: string | null;
  nextActionAt: string | null;
  convertedClientId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Client = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  taxId: string | null;
  notes: string | null;
  portalToken: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProposalItem = {
  id: string;
  title: string;
  description: string | null;
  qty: number;
  unitPrice: number;
};

export type Proposal = {
  id: string;
  clientId: string;
  number: string;
  title: string;
  problem: string | null;
  solution: string | null;
  deliverables: string | null;
  timeline: string | null;
  amount: number;
  currency: string;
  conditions: string | null;
  options: string | null;
  validUntil: string | null;
  notes: string | null;
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REFUSED" | "EXPIRED";
  publicToken: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  refusedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ProposalItem[];
  client?: Client;
};

export type QuoteItem = {
  id: string;
  title: string;
  description: string | null;
  qty: number;
  unitPrice: number;
};

export type Quote = {
  id: string;
  clientId: string;
  number: string;
  issueDate: string;
  expirationDate: string | null;
  notes: string | null;
  terms: string | null;
  discount: number;
  taxRate: number;
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REFUSED" | "EXPIRED";
  publicToken: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  refusedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: QuoteItem[];
  client?: Client;
};

export type Contract = {
  id: string;
  clientId: string;
  proposalId: string | null;
  number: string;
  title: string;
  content: string;
  amount: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  duration: string | null;
  conditions: string | null;
  status: "DRAFT" | "SENT" | "VIEWED" | "SIGNED" | "EXPIRED" | "CANCELED";
  publicToken: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  signatures?: Signature[];
  project?: Project | null;
  paymentPlan?: PaymentPlan | null;
};

export type Signature = {
  id: string;
  signedBy: string;
  signedByEmail: string;
  signedAt: string;
  ipAddress: string | null;
  signatureData: string | null;
};

export type Project = {
  id: string;
  clientId: string;
  contractId: string | null;
  name: string;
  description: string | null;
  budget: number;
  startDate: string | null;
  endDate: string | null;
  status: "TODO" | "IN_PROGRESS" | "PAUSED" | "DONE" | "CANCELED";
  progress: number;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  tasks?: Task[];
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: "TODO" | "DOING" | "REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  assigneeId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceItem = {
  id: string;
  title: string;
  description: string | null;
  qty: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  clientId: string;
  projectId: string | null;
  contractId: string | null;
  number: string;
  type: "DEPOSIT" | "MILESTONE" | "FINAL";
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  terms: string | null;
  discount: number;
  taxRate: number;
  status: "DRAFT" | "SENT" | "VIEWED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELED";
  publicToken: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  client?: Client;
};

export type Payment = {
  id: string;
  clientId: string;
  invoiceId: string | null;
  amount: number;
  method: "CASH" | "TRANSFER" | "CARD" | "MOBILE_MONEY" | "OTHER";
  reference: string | null;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  paidAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  invoice?: Invoice | null;
};

export type Installment = {
  id: string;
  paymentPlanId: string;
  label: string;
  amount: number;
  dueDate: string | null;
  invoiceId: string | null;
  status: "UPCOMING" | "PAID" | "OVERDUE";
  order: number;
  invoice?: Invoice | null;
};

export type PaymentPlan = {
  id: string;
  contractId: string;
  totalAmount: number;
  installments?: Installment[];
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type TimelineEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  proposalId?: string | null;
  contractId?: string | null;
  projectId?: string | null;
  invoiceId?: string | null;
};

export type Document = {
  id: string;
  name: string;
  type: string;
  mime: string | null;
  size: number;
  url: string | null;
  createdAt: string;
  clientId?: string | null;
  projectId?: string | null;
  contractId?: string | null;
  invoiceId?: string | null;
  proposalId?: string | null;
};

export type DashboardData = {
  revenue: {
    thisMonth: number;
    collected: number;
    pending: number;
    overdue: number;
  };
  pipeline: {
    prospects: number;
    proposalsSent: number;
    proposalsViewed: number;
    contractsSent: number;
    contractsSigned: number;
  };
  projects: {
    active: number;
    done: number;
    late: number;
  };
  invoices: {
    draft: number;
    sent: number;
    paid: number;
    overdue: number;
  };
  activity: TimelineEvent[];
  revenueSeries: { month: string; amount: number }[];
  notifications: Notification[];
};

export type ReportData = {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  revenueByMonth: { month: string; amount: number }[];
  invoicesByStatus: { status: string; count: number; amount: number }[];
  topClients: { id: string; name: string; total: number }[];
  acceptanceRate: number;
  contractValue: number;
};
