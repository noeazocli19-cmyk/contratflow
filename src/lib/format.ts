// Formatting helpers (currency, dates, labels)

const CURRENCY_LOCALE: Record<string, string> = {
  XOF: "fr-FR",
  XAF: "fr-FR",
  EUR: "fr-FR",
  USD: "en-US",
  GBP: "en-GB",
};

export function formatCurrency(amount: number, currency = "XOF") {
  const locale = CURRENCY_LOCALE[currency] || "fr-FR";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "XOF" || currency === "XAF" ? 0 : 2,
    }).format(amount || 0);
  } catch {
    return `${Math.round(amount || 0).toLocaleString()} ${currency}`;
  }
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n || 0);
}

export function formatDate(date: string | Date | null | undefined, withTime = false) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat("fr-FR", opts).format(d);
}

export function timeAgo(date: string | Date | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days} j`;
  return formatDate(d);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Labels

export const PROSPECT_STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  PROPOSAL_SENT: "Proposition envoyée",
  NEGOTIATION: "Négociation",
  CONVERTED: "Converti",
  LOST: "Perdu",
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyée",
  VIEWED: "Consultée",
  ACCEPTED: "Acceptée",
  REFUSED: "Refusée",
  EXPIRED: "Expirée",
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  VIEWED: "Consulté",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  EXPIRED: "Expiré",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  VIEWED: "Consulté",
  SIGNED: "Signé",
  EXPIRED: "Expiré",
  CANCELED: "Annulé",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  TODO: "À démarrer",
  IN_PROGRESS: "En cours",
  PAUSED: "En pause",
  DONE: "Terminé",
  CANCELED: "Annulé",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "À faire",
  DOING: "En cours",
  REVIEW: "À valider",
  DONE: "Terminé",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyée",
  VIEWED: "Consultée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELED: "Annulée",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  TRANSFER: "Virement",
  CARD: "Carte",
  MOBILE_MONEY: "Mobile Money",
  OTHER: "Autre",
};

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Acompte",
  MILESTONE: "Étape",
  FINAL: "Finale",
};

// Color tokens (for badges)
export const STATUS_COLOR: Record<string, string> = {
  // generic neutral defaults handled in components
  NEW: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  CONTACTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  QUALIFIED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  PROPOSAL_SENT: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  NEGOTIATION: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  CONVERTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  LOST: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  VIEWED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  REFUSED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  EXPIRED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  SIGNED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  OVERDUE: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  UPCOMING: "bg-muted text-muted-foreground",
};
