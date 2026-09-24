"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  FileSpreadsheet,
  Receipt,
  Mail,
  Bell,
  LayoutTemplate,
  Sparkles,
  Wand2,
  Eye,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Client, Proposal, Quote, Invoice } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// ─────────────────────────────────────────────────────────────────────────────
// Local types (no shared types for templates yet)
// ─────────────────────────────────────────────────────────────────────────────

type ProposalTemplate = {
  id: string;
  name: string;
  description: string | null;
  title: string;
  problem: string | null;
  solution: string | null;
  deliverables: string | null;
  timeline: string | null;
  amount: number;
  conditions: string | null;
  options: string | null;
  notes: string | null;
  defaultItems: string | null;
  createdAt: string;
  updatedAt: string;
};

type QuoteTemplate = {
  id: string;
  name: string;
  description: string | null;
  terms: string | null;
  notes: string | null;
  discount: number;
  taxRate: number;
  defaultItems: string | null;
  createdAt: string;
  updatedAt: string;
};

type InvoiceTemplate = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  terms: string | null;
  notes: string | null;
  discount: number;
  taxRate: number;
  defaultItems: string | null;
  createdAt: string;
  updatedAt: string;
};

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: string;
  createdAt: string;
  updatedAt: string;
};

type Reminder = {
  id: string;
  name: string;
  trigger: string;
  daysOffset: number;
  channel: string;
  emailTemplateId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type Item = {
  title: string;
  description: string;
  qty: number;
  unitPrice: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants / labels
// ─────────────────────────────────────────────────────────────────────────────

const TABS: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "proposals", label: "Propositions", icon: FileText },
  { value: "quotes", label: "Devis", icon: FileSpreadsheet },
  { value: "invoices", label: "Factures", icon: Receipt },
  { value: "emails", label: "Emails", icon: Mail },
  { value: "reminders", label: "Relances", icon: Bell },
];

const EMAIL_TYPES: { value: string; label: string }[] = [
  { value: "CUSTOM", label: "Personnalisé" },
  { value: "WELCOME", label: "Bienvenue" },
  { value: "PROPOSAL_SENT", label: "Proposition envoyée" },
  { value: "CONTRACT_SENT", label: "Contrat envoyé" },
  { value: "INVOICE_SENT", label: "Facture envoyée" },
  { value: "REMINDER_DUE", label: "Relance échéance" },
  { value: "REMINDER_OVERDUE", label: "Relance retard" },
  { value: "RECEIPT", label: "Reçu" },
];

const EMAIL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EMAIL_TYPES.map((t) => [t.value, t.label]),
);

const REMINDER_TRIGGERS: { value: string; label: string; hint: string }[] = [
  { value: "INVOICE_DUE_SOON", label: "Facture à échoir", hint: "Échéance proche" },
  { value: "INVOICE_OVERDUE", label: "Facture en retard", hint: "Échéance dépassée" },
  { value: "CONTRACT_UNSIGNED", label: "Contrat non signé", hint: "Contrat en attente" },
  { value: "PROPOSAL_EXPIRING", label: "Proposition expirant", hint: "Expiration proche" },
];

const REMINDER_CHANNELS: { value: string; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "IN_APP", label: "In-app" },
];

const REMINDER_TRIGGER_LABELS: Record<string, string> = Object.fromEntries(
  REMINDER_TRIGGERS.map((t) => [t.value, t.label]),
);
const REMINDER_CHANNEL_LABELS: Record<string, string> = Object.fromEntries(
  REMINDER_CHANNELS.map((c) => [c.value, c.label]),
);

const INVOICE_TYPES = [
  { value: "DEPOSIT", label: "Acompte" },
  { value: "MILESTONE", label: "Étape" },
  { value: "FINAL", label: "Finale" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseItems(raw: string | null | undefined): Item[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((it: any) => ({
        title: String(it?.title ?? ""),
        description: String(it?.description ?? ""),
        qty: typeof it?.qty === "number" ? it.qty : 1,
        unitPrice: typeof it?.unitPrice === "number" ? it.unitPrice : 0,
      }));
    }
  } catch {
    // ignore
  }
  return [];
}

function clientLabel(c?: Client): string {
  if (!c) return "—";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return c.company ? `${name} · ${c.company}` : name;
}

function truncate(s: string, n = 140): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default-items editor (used by proposal / quote / invoice templates)
// ─────────────────────────────────────────────────────────────────────────────

function ItemsEditor({
  items,
  onChange,
}: {
  items: Item[];
  onChange: (items: Item[]) => void;
}) {
  function update(idx: number, patch: Partial<Item>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function add() {
    onChange([...items, { title: "", description: "", qty: 1, unitPrice: 0 }]);
  }
  function remove(idx: number) {
    onChange(items.length === 1 ? items : items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Lignes par défaut</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="size-3.5" /> Ajouter
        </Button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="grid grid-cols-12 gap-2 rounded-md border bg-muted/20 p-2"
          >
            <div className="col-span-12 sm:col-span-5">
              <Input
                placeholder="Titre"
                value={it.title}
                onChange={(e) => update(idx, { title: e.target.value })}
              />
            </div>
            <div className="col-span-6 sm:col-span-3">
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Qté"
                value={it.qty}
                onChange={(e) => update(idx, { qty: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-5 sm:col-span-3">
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Prix unit."
                value={it.unitPrice}
                onChange={(e) => update(idx, { unitPrice: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-1 flex items-center justify-end">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => remove(idx)}
                aria-label="Supprimer la ligne"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="col-span-12">
              <Input
                placeholder="Description (optionnelle)"
                value={it.description}
                onChange={(e) => update(idx, { description: e.target.value })}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Aucune ligne. Cliquez sur « Ajouter » pour en créer.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Templates() {
  const [tab, setTab] = useState("proposals");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modèles</h1>
          <p className="text-sm text-muted-foreground">
            Réutilisez vos propositions, devis, factures, emails et relances
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-fit max-w-full overflow-x-auto justify-start gap-0.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="min-w-fit px-3 text-xs whitespace-nowrap"
              >
                <Icon className="size-3.5" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="proposals">
          <ProposalTemplatesTab />
        </TabsContent>
        <TabsContent value="quotes">
          <QuoteTemplatesTab />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoiceTemplatesTab />
        </TabsContent>
        <TabsContent value="emails">
          <EmailTemplatesTab />
        </TabsContent>
        <TabsContent value="reminders">
          <RemindersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared empty state + delete dialog
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  label,
  hint,
  onCreate,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  onCreate: () => void;
}) {
  return (
    <Card className="p-10 flex flex-col items-center justify-center text-center">
      <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{label}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-md">{hint}</p>
      <Button className="mt-4" onClick={onCreate}>
        <Plus className="size-4" /> Nouveau modèle
      </Button>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  busy: boolean;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {busy ? "Suppression…" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Instantiate dialog — shared by proposal/quote/invoice templates
// ─────────────────────────────────────────────────────────────────────────────

function InstantiateDialog({
  open,
  onClose,
  onCreated,
  endpoint,
  template,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (created: { id: string; number: string }) => void;
  endpoint: string;
  template: { id: string; name: string } | null;
  kind: "proposal" | "quote" | "invoice";
}) {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<Client[]>("/api/clients")
      .then((c) => {
        setClients(c);
        if (c.length > 0) setClientId(c[0].id);
      })
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les clients";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [open, toast]);

  async function submit() {
    if (!template) return;
    if (!clientId) {
      toast({ title: "Client requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { clientId };
      const created = await api.post<{ id: string; number: string }>(endpoint, body);
      toast({
        title:
          kind === "proposal"
            ? "Proposition créée"
            : kind === "quote"
              ? "Devis créé"
              : "Facture créée",
        description: `${created.number} — depuis le modèle « ${template.name} »`,
      });
      onCreated(created);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la création";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const labels = {
    proposal: { title: "Créer une proposition", cta: "Créer la proposition" },
    quote: { title: "Créer un devis", cta: "Créer le devis" },
    invoice: { title: "Créer une facture", cta: "Créer la facture" },
  }[kind];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4" /> {labels.title}
          </DialogTitle>
          <DialogDescription>
            Modèle : <strong>{template?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={loading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loading ? "Chargement…" : "Sélectionner"} />
              </SelectTrigger>
              <SelectContent>
                {clients.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    Aucun client
                  </SelectItem>
                )}
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {clientLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={submitting || !template}>
            {submitting ? "Création…" : labels.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to render a date input
function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Proposal Templates Tab
// ─────────────────────────────────────────────────────────────────────────────

type ProposalForm = {
  name: string;
  description: string;
  title: string;
  problem: string;
  solution: string;
  deliverables: string;
  timeline: string;
  amount: string;
  conditions: string;
  options: string;
  notes: string;
  items: Item[];
};

const EMPTY_PROPOSAL_FORM: ProposalForm = {
  name: "",
  description: "",
  title: "",
  problem: "",
  solution: "",
  deliverables: "",
  timeline: "",
  amount: "0",
  conditions: "",
  options: "",
  notes: "",
  items: [],
};

function ProposalTemplatesTab() {
  const { tick, navigate, bump } = useStore();
  const { toast } = useToast();
  const [items, setItems] = useState<ProposalTemplate[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ProposalTemplate | null>(null);
  const [form, setForm] = useState<ProposalForm>(EMPTY_PROPOSAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProposalTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [instantiateTarget, setInstantiateTarget] = useState<ProposalTemplate | null>(null);

  function load() {
    api
      .get<ProposalTemplate[]>("/api/proposal-templates")
      .then(setItems)
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les modèles";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
        setItems([]);
      });
  }

  useEffect(() => {
    load();
  }, [tick]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_PROPOSAL_FORM });
    setEditOpen(true);
  }
  function openEdit(t: ProposalTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || "",
      title: t.title,
      problem: t.problem || "",
      solution: t.solution || "",
      deliverables: t.deliverables || "",
      timeline: t.timeline || "",
      amount: String(t.amount || 0),
      conditions: t.conditions || "",
      options: t.options || "",
      notes: t.notes || "",
      items: parseItems(t.defaultItems),
    });
    setEditOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.title.trim()) {
      toast({ title: "Nom et titre requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        title: form.title.trim(),
        problem: form.problem.trim() || null,
        solution: form.solution.trim() || null,
        deliverables: form.deliverables.trim() || null,
        timeline: form.timeline.trim() || null,
        amount: parseFloat(form.amount) || 0,
        conditions: form.conditions.trim() || null,
        options: form.options.trim() || null,
        notes: form.notes.trim() || null,
        defaultItems: JSON.stringify(
          form.items
            .filter((it) => it.title.trim())
            .map((it) => ({
              title: it.title,
              description: it.description || undefined,
              qty: it.qty,
              unitPrice: it.unitPrice,
            })),
        ),
      };
      if (editing) {
        await api.patch(`/api/proposal-templates/${editing.id}`, body);
        toast({ title: "Modèle mis à jour", description: body.name });
      } else {
        await api.post("/api/proposal-templates", body);
        toast({ title: "Modèle créé", description: body.name });
      }
      setEditOpen(false);
      load();
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/proposal-templates/${deleteTarget.id}`);
      toast({ title: "Modèle supprimé", description: deleteTarget.name });
      setDeleteTarget(null);
      load();
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button onClick={openNew}>
          <Plus className="size-4" /> Nouveau modèle
        </Button>
      </div>

      {items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          label="Aucun modèle de proposition"
          hint="Créez des modèles réutilisables pour vos propositions commerciales : problème, solution, livrables, budget…"
          onCreate={openNew}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((t) => {
            const parsedItems = parseItems(t.defaultItems);
            return (
              <Card key={t.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.title}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {formatCurrency(t.amount)}
                  </Badge>
                </div>
                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {t.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  {parsedItems.length > 0 && (
                    <Badge variant="secondary">{parsedItems.length} lignes</Badge>
                  )}
                  <span>·</span>
                  <span>Créé le {formatDate(t.createdAt)}</span>
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    onClick={() => setInstantiateTarget(t)}
                    className="flex-1"
                  >
                    <Wand2 className="size-3.5" /> Utiliser
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => openEdit(t)}
                    aria-label="Modifier"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => setDeleteTarget(t)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!saving) setEditOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              {editing ? "Modifier le modèle" : "Nouveau modèle de proposition"}
            </DialogTitle>
            <DialogDescription>
              Renseignez les champs standards. Les lignes par défaut seront copiées
              lors de l&apos;instanciation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pt-name">Nom du modèle *</Label>
                <Input
                  id="pt-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Proposition prestation standard"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-amount">Montant par défaut</Label>
                <Input
                  id="pt-amount"
                  type="number"
                  min={0}
                  step="any"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pt-title">Titre de la proposition *</Label>
              <Input
                id="pt-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Refonte du site web…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pt-desc">Description</Label>
              <Input
                id="pt-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Idéale pour les missions de courte durée…"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pt-problem">Problème</Label>
                <Textarea
                  id="pt-problem"
                  rows={3}
                  value={form.problem}
                  onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-solution">Solution</Label>
                <Textarea
                  id="pt-solution"
                  rows={3}
                  value={form.solution}
                  onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pt-deliv">Livrables</Label>
                <Textarea
                  id="pt-deliv"
                  rows={3}
                  value={form.deliverables}
                  onChange={(e) => setForm((f) => ({ ...f, deliverables: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-timeline">Chronologie</Label>
                <Textarea
                  id="pt-timeline"
                  rows={3}
                  value={form.timeline}
                  onChange={(e) => setForm((f) => ({ ...f, timeline: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pt-conditions">Conditions</Label>
                <Textarea
                  id="pt-conditions"
                  rows={3}
                  value={form.conditions}
                  onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-options">Options</Label>
                <Textarea
                  id="pt-options"
                  rows={3}
                  value={form.options}
                  onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pt-notes">Notes internes</Label>
              <Textarea
                id="pt-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <ItemsEditor
              items={form.items}
              onChange={(items) => setForm((f) => ({ ...f, items }))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer le modèle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instantiate */}
      <InstantiateDialog
        open={!!instantiateTarget}
        onClose={() => setInstantiateTarget(null)}
        kind="proposal"
        template={instantiateTarget}
        endpoint={
          instantiateTarget
            ? `/api/proposal-templates/${instantiateTarget.id}/instantiate`
            : ""
        }
        onCreated={(created) => {
          setInstantiateTarget(null);
          bump();
          // Fetch the created proposal to get clientId for navigation context
          api
            .get<Proposal>(`/api/proposals/${created.id}`)
            .then(() => navigate("proposal-detail", { id: created.id }))
            .catch(() => navigate("proposals"));
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
        title="Supprimer le modèle ?"
        description={`Le modèle « ${deleteTarget?.name ?? ""} » sera définitivement supprimé.`}
        busy={deleting}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote Templates Tab
// ─────────────────────────────────────────────────────────────────────────────

type QuoteForm = {
  name: string;
  description: string;
  terms: string;
  notes: string;
  discount: string;
  taxRate: string;
  items: Item[];
};

const EMPTY_QUOTE_FORM: QuoteForm = {
  name: "",
  description: "",
  terms: "",
  notes: "",
  discount: "0",
  taxRate: "0",
  items: [],
};

function QuoteTemplatesTab() {
  const { tick, navigate, bump } = useStore();
  const { toast } = useToast();
  const [items, setItems] = useState<QuoteTemplate[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<QuoteTemplate | null>(null);
  const [form, setForm] = useState<QuoteForm>(EMPTY_QUOTE_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuoteTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [instantiateTarget, setInstantiateTarget] = useState<QuoteTemplate | null>(null);
  const [expirationDate, setExpirationDate] = useState("");

  function load() {
    api
      .get<QuoteTemplate[]>("/api/quote-templates")
      .then(setItems)
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les modèles";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
        setItems([]);
      });
  }

  useEffect(() => {
    load();
  }, [tick]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_QUOTE_FORM });
    setEditOpen(true);
  }
  function openEdit(t: QuoteTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || "",
      terms: t.terms || "",
      notes: t.notes || "",
      discount: String(t.discount || 0),
      taxRate: String(t.taxRate || 0),
      items: parseItems(t.defaultItems),
    });
    setEditOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Nom requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        terms: form.terms.trim() || null,
        notes: form.notes.trim() || null,
        discount: Number(form.discount) || 0,
        taxRate: Number(form.taxRate) || 0,
        defaultItems: JSON.stringify(
          form.items
            .filter((it) => it.title.trim())
            .map((it) => ({
              title: it.title,
              description: it.description || undefined,
              qty: it.qty,
              unitPrice: it.unitPrice,
            })),
        ),
      };
      if (editing) {
        await api.patch(`/api/quote-templates/${editing.id}`, body);
        toast({ title: "Modèle mis à jour", description: body.name });
      } else {
        await api.post("/api/quote-templates", body);
        toast({ title: "Modèle créé", description: body.name });
      }
      setEditOpen(false);
      load();
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/quote-templates/${deleteTarget.id}`);
      toast({ title: "Modèle supprimé", description: deleteTarget.name });
      setDeleteTarget(null);
      load();
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button onClick={openNew}>
          <Plus className="size-4" /> Nouveau modèle
        </Button>
      </div>

      {items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          label="Aucun modèle de devis"
          hint="Créez des modèles de devis réutilisables avec lignes, remise et TVA par défaut."
          onCreate={openNew}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((t) => {
            const parsedItems = parseItems(t.defaultItems);
            return (
              <Card key={t.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {t.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {t.discount > 0 && (
                    <Badge variant="secondary">Remise {t.discount}%</Badge>
                  )}
                  {t.taxRate > 0 && (
                    <Badge variant="secondary">TVA {t.taxRate}%</Badge>
                  )}
                  {parsedItems.length > 0 && (
                    <Badge variant="secondary">{parsedItems.length} lignes</Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Créé le {formatDate(t.createdAt)}
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    onClick={() => {
                      setInstantiateTarget(t);
                      setExpirationDate("");
                    }}
                    className="flex-1"
                  >
                    <Wand2 className="size-3.5" /> Utiliser
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => openEdit(t)}
                    aria-label="Modifier"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => setDeleteTarget(t)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit / create */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!saving) setEditOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-4" />
              {editing ? "Modifier le modèle" : "Nouveau modèle de devis"}
            </DialogTitle>
            <DialogDescription>
              Les lignes par défaut seront copiées lors de l&apos;instanciation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="qt-name">Nom du modèle *</Label>
              <Input
                id="qt-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Devis site vitrine"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qt-desc">Description</Label>
              <Input
                id="qt-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qt-discount">Remise (%)</Label>
                <Input
                  id="qt-discount"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={form.discount}
                  onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qt-tax">TVA (%)</Label>
                <Input
                  id="qt-tax"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={form.taxRate}
                  onChange={(e) => setForm((f) => ({ ...f, taxRate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qt-terms">Conditions</Label>
              <Textarea
                id="qt-terms"
                rows={3}
                value={form.terms}
                onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qt-notes">Notes internes</Label>
              <Textarea
                id="qt-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <ItemsEditor
              items={form.items}
              onChange={(items) => setForm((f) => ({ ...f, items }))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer le modèle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instantiate */}
      <Dialog
        open={!!instantiateTarget}
        onOpenChange={(o) => {
          if (o) setExpirationDate("");
          else setInstantiateTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-4" /> Créer un devis
            </DialogTitle>
            <DialogDescription>
              Modèle : <strong>{instantiateTarget?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <InstantiateQuoteBody
            template={instantiateTarget}
            expirationDate={expirationDate}
            setExpirationDate={setExpirationDate}
            onCreated={(created) => {
              setInstantiateTarget(null);
              bump();
              api
                .get<Quote>(`/api/quotes/${created.id}`)
                .then(() => navigate("quotes"))
                .catch(() => navigate("quotes"));
            }}
          />
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
        title="Supprimer le modèle ?"
        description={`Le modèle « ${deleteTarget?.name ?? ""} » sera définitivement supprimé.`}
        busy={deleting}
      />
    </div>
  );
}

// Inner body for quote instantiate dialog (handles client select + submit)
function InstantiateQuoteBody({
  template,
  expirationDate,
  setExpirationDate,
  onCreated,
}: {
  template: QuoteTemplate | null;
  expirationDate: string;
  setExpirationDate: (v: string) => void;
  onCreated: (created: { id: string; number: string }) => void;
}) {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<Client[]>("/api/clients")
      .then((c) => {
        setClients(c);
        if (c.length > 0) setClientId(c[0].id);
      })
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les clients";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  async function submit() {
    if (!template) return;
    if (!clientId) {
      toast({ title: "Client requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { clientId };
      if (expirationDate) body.expirationDate = expirationDate;
      const created = await api.post<{ id: string; number: string }>(
        `/api/quote-templates/${template.id}/instantiate`,
        body,
      );
      toast({
        title: "Devis créé",
        description: `${created.number} — depuis le modèle « ${template.name} »`,
      });
      onCreated(created);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la création";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Client *</Label>
          <Select value={clientId} onValueChange={setClientId} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loading ? "Chargement…" : "Sélectionner"} />
            </SelectTrigger>
            <SelectContent>
              {clients.length === 0 && (
                <SelectItem value="__none__" disabled>
                  Aucun client
                </SelectItem>
              )}
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {clientLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DateField
          id="qt-exp"
          label="Date d'expiration (optionnelle)"
          value={expirationDate}
          onChange={setExpirationDate}
        />
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={() => onCreated({ id: "", number: "" })}>
          Annuler
        </Button>
        <Button onClick={() => void submit()} disabled={submitting || !template}>
          {submitting ? "Création…" : "Créer le devis"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice Templates Tab
// ─────────────────────────────────────────────────────────────────────────────

type InvoiceForm = {
  name: string;
  description: string;
  type: string;
  terms: string;
  notes: string;
  discount: string;
  taxRate: string;
  items: Item[];
};

const EMPTY_INVOICE_FORM: InvoiceForm = {
  name: "",
  description: "",
  type: "FINAL",
  terms: "",
  notes: "",
  discount: "0",
  taxRate: "0",
  items: [],
};

function InvoiceTemplatesTab() {
  const { tick, navigate, bump } = useStore();
  const { toast } = useToast();
  const [items, setItems] = useState<InvoiceTemplate[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceTemplate | null>(null);
  const [form, setForm] = useState<InvoiceForm>(EMPTY_INVOICE_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [instantiateTarget, setInstantiateTarget] = useState<InvoiceTemplate | null>(null);

  function load() {
    api
      .get<InvoiceTemplate[]>("/api/invoice-templates")
      .then(setItems)
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les modèles";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
        setItems([]);
      });
  }

  useEffect(() => {
    load();
  }, [tick]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_INVOICE_FORM });
    setEditOpen(true);
  }
  function openEdit(t: InvoiceTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || "",
      type: t.type || "FINAL",
      terms: t.terms || "",
      notes: t.notes || "",
      discount: String(t.discount || 0),
      taxRate: String(t.taxRate || 0),
      items: parseItems(t.defaultItems),
    });
    setEditOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Nom requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        terms: form.terms.trim() || null,
        notes: form.notes.trim() || null,
        discount: Number(form.discount) || 0,
        taxRate: Number(form.taxRate) || 0,
        defaultItems: JSON.stringify(
          form.items
            .filter((it) => it.title.trim())
            .map((it) => ({
              title: it.title,
              description: it.description || undefined,
              qty: it.qty,
              unitPrice: it.unitPrice,
            })),
        ),
      };
      if (editing) {
        await api.patch(`/api/invoice-templates/${editing.id}`, body);
        toast({ title: "Modèle mis à jour", description: body.name });
      } else {
        await api.post("/api/invoice-templates", body);
        toast({ title: "Modèle créé", description: body.name });
      }
      setEditOpen(false);
      load();
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/invoice-templates/${deleteTarget.id}`);
      toast({ title: "Modèle supprimé", description: deleteTarget.name });
      setDeleteTarget(null);
      load();
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button onClick={openNew}>
          <Plus className="size-4" /> Nouveau modèle
        </Button>
      </div>

      {items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          label="Aucun modèle de facture"
          hint="Créez des modèles de factures (acompte, étape, finale) avec lignes, remise et TVA."
          onCreate={openNew}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((t) => {
            const parsedItems = parseItems(t.defaultItems);
            const typeLabel =
              INVOICE_TYPES.find((x) => x.value === t.type)?.label || t.type;
            return (
              <Card key={t.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {t.description}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline">{typeLabel}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {t.discount > 0 && (
                    <Badge variant="secondary">Remise {t.discount}%</Badge>
                  )}
                  {t.taxRate > 0 && (
                    <Badge variant="secondary">TVA {t.taxRate}%</Badge>
                  )}
                  {parsedItems.length > 0 && (
                    <Badge variant="secondary">{parsedItems.length} lignes</Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Créé le {formatDate(t.createdAt)}
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    onClick={() => setInstantiateTarget(t)}
                    className="flex-1"
                  >
                    <Wand2 className="size-3.5" /> Utiliser
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => openEdit(t)}
                    aria-label="Modifier"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => setDeleteTarget(t)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit / create */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!saving) setEditOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-4" />
              {editing ? "Modifier le modèle" : "Nouveau modèle de facture"}
            </DialogTitle>
            <DialogDescription>
              Les lignes par défaut seront copiées lors de l&apos;instanciation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="it-name">Nom du modèle *</Label>
                <Input
                  id="it-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Facture finale standard"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="it-desc">Description</Label>
              <Input
                id="it-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="it-discount">Remise (%)</Label>
                <Input
                  id="it-discount"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={form.discount}
                  onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="it-tax">TVA (%)</Label>
                <Input
                  id="it-tax"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={form.taxRate}
                  onChange={(e) => setForm((f) => ({ ...f, taxRate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="it-terms">Conditions</Label>
              <Textarea
                id="it-terms"
                rows={3}
                value={form.terms}
                onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="it-notes">Notes internes</Label>
              <Textarea
                id="it-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <ItemsEditor
              items={form.items}
              onChange={(items) => setForm((f) => ({ ...f, items }))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer le modèle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instantiate */}
      <Dialog
        open={!!instantiateTarget}
        onOpenChange={(o) => {
          if (!o) setInstantiateTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-4" /> Créer une facture
            </DialogTitle>
            <DialogDescription>
              Modèle : <strong>{instantiateTarget?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <InstantiateInvoiceBody
            template={instantiateTarget}
            onCreated={(created) => {
              setInstantiateTarget(null);
              bump();
              api
                .get<Invoice>(`/api/invoices/${created.id}`)
                .then(() => navigate("invoice-detail", { id: created.id }))
                .catch(() => navigate("invoices"));
            }}
          />
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
        title="Supprimer le modèle ?"
        description={`Le modèle « ${deleteTarget?.name ?? ""} » sera définitivement supprimé.`}
        busy={deleting}
      />
    </div>
  );
}

function InstantiateInvoiceBody({
  template,
  onCreated,
}: {
  template: InvoiceTemplate | null;
  onCreated: (created: { id: string; number: string }) => void;
}) {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<Client[]>("/api/clients")
      .then((c) => {
        setClients(c);
        if (c.length > 0) setClientId(c[0].id);
      })
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les clients";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  async function submit() {
    if (!template) return;
    if (!clientId) {
      toast({ title: "Client requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { clientId };
      if (dueDate) body.dueDate = dueDate;
      const created = await api.post<{ id: string; number: string }>(
        `/api/invoice-templates/${template.id}/instantiate`,
        body,
      );
      toast({
        title: "Facture créée",
        description: `${created.number} — depuis le modèle « ${template.name} »`,
      });
      onCreated(created);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la création";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Client *</Label>
          <Select value={clientId} onValueChange={setClientId} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loading ? "Chargement…" : "Sélectionner"} />
            </SelectTrigger>
            <SelectContent>
              {clients.length === 0 && (
                <SelectItem value="__none__" disabled>
                  Aucun client
                </SelectItem>
              )}
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {clientLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DateField
          id="it-due"
          label="Date d'échéance (optionnelle)"
          value={dueDate}
          onChange={setDueDate}
        />
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={() => onCreated({ id: "", number: "" })}>
          Annuler
        </Button>
        <Button onClick={() => void submit()} disabled={submitting || !template}>
          {submitting ? "Création…" : "Créer la facture"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Templates Tab
// ─────────────────────────────────────────────────────────────────────────────

type EmailForm = {
  name: string;
  subject: string;
  body: string;
  type: string;
};

const EMPTY_EMAIL_FORM: EmailForm = {
  name: "",
  subject: "",
  body: "",
  type: "CUSTOM",
};

function EmailTemplatesTab() {
  const { tick, bump } = useStore();
  const { toast } = useToast();
  const [items, setItems] = useState<EmailTemplate[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<EmailForm>(EMPTY_EMAIL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<EmailTemplate | null>(null);

  function load() {
    api
      .get<EmailTemplate[]>("/api/email-templates")
      .then(setItems)
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les modèles";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
        setItems([]);
      });
  }

  useEffect(() => {
    load();
  }, [tick]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_EMAIL_FORM });
    setEditOpen(true);
  }
  function openEdit(t: EmailTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      subject: t.subject,
      body: t.body,
      type: t.type || "CUSTOM",
    });
    setEditOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      toast({ title: "Nom, sujet et corps requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        subject: form.subject.trim(),
        body: form.body.trim(),
        type: form.type,
      };
      if (editing) {
        await api.patch(`/api/email-templates/${editing.id}`, body);
        toast({ title: "Modèle mis à jour", description: body.name });
      } else {
        await api.post("/api/email-templates", body);
        toast({ title: "Modèle créé", description: body.name });
      }
      setEditOpen(false);
      load();
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/email-templates/${deleteTarget.id}`);
      toast({ title: "Modèle supprimé", description: deleteTarget.name });
      setDeleteTarget(null);
      load();
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button onClick={openNew}>
          <Plus className="size-4" /> Nouveau modèle
        </Button>
      </div>

      {items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Mail}
          label="Aucun modèle d'email"
          hint="Créez des emails types pour vos envois automatiques (proposition, contrat, facture, relance…)."
          onCreate={openNew}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((t) => (
            <Card key={t.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-sm text-foreground/80 truncate">
                    {t.subject}
                  </div>
                </div>
                <Badge variant="outline">{EMAIL_TYPE_LABELS[t.type] || t.type}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                {truncate(t.body, 180)}
              </p>
              <div className="text-[10px] text-muted-foreground">
                Créé le {formatDate(t.createdAt)}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewTarget(t)}
                  className="flex-1"
                >
                  <Eye className="size-3.5" /> Aperçu
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => openEdit(t)}
                  aria-label="Modifier"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  onClick={() => setDeleteTarget(t)}
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit / create */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!saving) setEditOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4" />
              {editing ? "Modifier le modèle d'email" : "Nouveau modèle d'email"}
            </DialogTitle>
            <DialogDescription>
              Utilisez des variables <code>{"{{client_name}}"}</code>,{" "}
              <code>{"{{invoice_number}}"}</code> dans le sujet et le corps.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="et-name">Nom *</Label>
                <Input
                  id="et-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Email proposition envoyée"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-subject">Sujet *</Label>
              <Input
                id="et-subject"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Votre proposition {{proposal_number}}"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-body">Corps *</Label>
              <Textarea
                id="et-body"
                rows={10}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Bonjour {{client_name}},…"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer le modèle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog
        open={!!previewTarget}
        onOpenChange={(o) => {
          if (!o) setPreviewTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-4" /> Aperçu
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{previewTarget?.name}</span>
              {" · "}
              <Badge variant="outline">
                {EMAIL_TYPE_LABELS[previewTarget?.type ?? ""] || previewTarget?.type}
              </Badge>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Sujet</div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                {previewTarget?.subject}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Corps</div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap font-mono">
                {previewTarget?.body}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewTarget(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
        title="Supprimer le modèle ?"
        description={`Le modèle « ${deleteTarget?.name ?? ""} » sera définitivement supprimé.`}
        busy={deleting}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reminders Tab — list + create/edit + preview
// ─────────────────────────────────────────────────────────────────────────────

type ReminderForm = {
  name: string;
  trigger: string;
  daysOffset: string;
  channel: string;
  emailTemplateId: string;
  active: boolean;
};

const EMPTY_REMINDER_FORM: ReminderForm = {
  name: "",
  trigger: "INVOICE_DUE_SOON",
  daysOffset: "0",
  channel: "EMAIL",
  emailTemplateId: "",
  active: true,
};

type PreviewItem = {
  type: string;
  target: { id: string; number: string; dueDate?: string | null; daysLate?: number; client?: string };
  reminder: { id: string; name: string; channel: string };
};

function RemindersTab() {
  const { tick, bump, navigate } = useStore();
  const { toast } = useToast();
  const [items, setItems] = useState<Reminder[] | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [form, setForm] = useState<ReminderForm>(EMPTY_REMINDER_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  function load() {
    Promise.all([
      api.get<Reminder[]>("/api/reminders"),
      api.get<EmailTemplate[]>("/api/email-templates"),
    ])
      .then(([r, t]) => {
        setItems(r);
        setEmailTemplates(t);
      })
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les relances";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
        setItems([]);
      });
  }

  useEffect(() => {
    load();
  }, [tick]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_REMINDER_FORM });
    setEditOpen(true);
  }
  function openEdit(t: Reminder) {
    setEditing(t);
    setForm({
      name: t.name,
      trigger: t.trigger,
      daysOffset: String(t.daysOffset || 0),
      channel: t.channel || "EMAIL",
      emailTemplateId: t.emailTemplateId || "",
      active: t.active,
    });
    setEditOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.trigger) {
      toast({ title: "Nom et trigger requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        trigger: form.trigger,
        daysOffset: Number(form.daysOffset) || 0,
        channel: form.channel,
        emailTemplateId: form.emailTemplateId || null,
        active: form.active,
      };
      if (editing) {
        await api.patch(`/api/reminders/${editing.id}`, body);
        toast({ title: "Relance mise à jour", description: body.name });
      } else {
        await api.post("/api/reminders", body);
        toast({ title: "Relance créée", description: body.name });
      }
      setEditOpen(false);
      load();
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: Reminder, value: boolean) {
    try {
      await api.patch(`/api/reminders/${t.id}`, { active: value });
      setItems((prev) =>
        prev ? prev.map((r) => (r.id === t.id ? { ...r, active: value } : r)) : prev,
      );
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la mise à jour";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/reminders/${deleteTarget.id}`);
      toast({ title: "Relance supprimée", description: deleteTarget.name });
      setDeleteTarget(null);
      load();
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  function openPreview() {
    setPreviewOpen(true);
    setPreview(null);
    api
      .get<PreviewItem[]>("/api/reminders/preview")
      .then(setPreview)
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger l'aperçu";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      });
  }

  function previewTargetNav(item: PreviewItem) {
    if (item.type === "INVOICE_DUE_SOON" || item.type === "INVOICE_OVERDUE") {
      navigate("invoice-detail", { id: item.target.id });
    } else if (item.type === "CONTRACT_UNSIGNED") {
      navigate("contract-detail", { id: item.target.id });
    } else if (item.type === "PROPOSAL_EXPIRING") {
      navigate("proposal-detail", { id: item.target.id });
    }
    setPreviewOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={openPreview}>
          <Sparkles className="size-4" /> Aperçu des relances
        </Button>
        <Button onClick={openNew}>
          <Plus className="size-4" /> Nouvelle relance
        </Button>
      </div>

      {items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          label="Aucune relance configurée"
          hint="Configurez des rappels automatiques pour les factures à échoir, en retard, contrats non signés, propositions expirant…"
          onCreate={openNew}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y">
            {items.map((t) => {
              const triggerLabel =
                REMINDER_TRIGGER_LABELS[t.trigger] || t.trigger;
              const channelLabel =
                REMINDER_CHANNEL_LABELS[t.channel] || t.channel;
              const linkedTemplate = emailTemplates.find(
                (e) => e.id === t.emailTemplateId,
              );
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 p-4"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md",
                      t.active
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Bell className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="outline">{triggerLabel}</Badge>
                      <span>·</span>
                      <span>
                        {t.daysOffset > 0
                          ? `+${t.daysOffset} j`
                          : t.daysOffset < 0
                            ? `${t.daysOffset} j`
                            : "le jour même"}
                      </span>
                      <span>·</span>
                      <span>{channelLabel}</span>
                      {linkedTemplate && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[200px]">
                            Email : {linkedTemplate.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {t.active ? "Active" : "Inactive"}
                      </span>
                      <Switch
                        checked={t.active}
                        onCheckedChange={(v) => void toggleActive(t, v)}
                        aria-label="Activer la relance"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => openEdit(t)}
                      aria-label="Modifier"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(t)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Edit / create */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!saving) setEditOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-4" />
              {editing ? "Modifier la relance" : "Nouvelle relance"}
            </DialogTitle>
            <DialogDescription>
              Configurez quand et comment déclencher cette relance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rt-name">Nom *</Label>
              <Input
                id="rt-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Facture à échoir J-3"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rt-trigger">Déclencheur *</Label>
              <Select
                value={form.trigger}
                onValueChange={(v) => setForm((f) => ({ ...f, trigger: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TRIGGERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} — {t.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rt-offset">Décalage (jours)</Label>
                <Input
                  id="rt-offset"
                  type="number"
                  step="1"
                  value={form.daysOffset}
                  onChange={(e) => setForm((f) => ({ ...f, daysOffset: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground">
                  Négatif = avant l&apos;événement. Positif = après.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rt-channel">Canal</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rt-email">Modèle d'email (optionnel)</Label>
              <Select
                value={form.emailTemplateId || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    emailTemplateId: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucun —</SelectItem>
                  {emailTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
              <Switch
                id="rt-active"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label htmlFor="rt-active" className="text-sm cursor-pointer">
                Relance active
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer la relance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog
        open={previewOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPreviewOpen(false);
            setPreview(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4" /> Aperçu des relances
            </DialogTitle>
            <DialogDescription>
              Liste des factures, contrats et propositions qui déclencheraient une
              relance à l&apos;instant T.
            </DialogDescription>
          </DialogHeader>

          {preview === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : preview.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <Bell className="size-6 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Aucune relance à déclencher pour le moment. Tout est à jour !
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {preview.map((p, i) => {
                const triggerLabel = REMINDER_TRIGGER_LABELS[p.type] || p.type;
                const days = p.target.daysLate ?? 0;
                const daysLabel =
                  days > 0
                    ? `${days} j de retard`
                    : days < 0
                      ? `dans ${Math.abs(days)} j`
                      : "aujourd'hui";
                return (
                  <Card
                    key={i}
                    className="p-3 cursor-pointer hover:bg-muted/40 transition"
                    onClick={() => previewTargetNav(p)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{triggerLabel}</Badge>
                          <span className="font-mono text-sm">{p.target.number}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {p.target.client ? `${p.target.client} · ` : ""}
                          {daysLabel}
                          {p.target.dueDate &&
                            ` · échéance ${formatDate(p.target.dueDate)}`}
                        </div>
                        <div className="mt-1 text-xs">
                          <span className="text-muted-foreground">Relance : </span>
                          <span className="font-medium">{p.reminder.name}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            ({REMINDER_CHANNEL_LABELS[p.reminder.channel] || p.reminder.channel})
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
        title="Supprimer la relance ?"
        description={`La relance « ${deleteTarget?.name ?? ""} » sera définitivement supprimée.`}
        busy={deleting}
      />
    </div>
  );
}
