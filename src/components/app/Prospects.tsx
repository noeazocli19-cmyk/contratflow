"use client";

import { useEffect, useMemo, useState } from "react";
import {
  UserPlus,
  Search,
  Pencil,
  Trash2,
  ArrowRightLeft,
  MoreVertical,
  Loader2,
  Users,
  TrendingUp,
  Percent,
  Mail,
  Phone,
  Building2,
  CalendarClock,
  AlertTriangle,
  Inbox,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import {
  formatCurrency,
  formatDate,
  PROSPECT_STATUS_LABELS,
  STATUS_COLOR,
} from "@/lib/format";
import type { Prospect } from "@/lib/types";

type StatusFilter = "ALL" | keyof typeof PROSPECT_STATUS_LABELS;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "NEW", label: "Nouveau" },
  { value: "CONTACTED", label: "Contacté" },
  { value: "QUALIFIED", label: "Qualifié" },
  { value: "PROPOSAL_SENT", label: "Proposition envoyée" },
  { value: "NEGOTIATION", label: "Négociation" },
  { value: "CONVERTED", label: "Converti" },
  { value: "LOST", label: "Perdu" },
];

type FormState = {
  name: string;
  company: string;
  email: string;
  phone: string;
  sector: string;
  source: string;
  potentialValue: string;
  status: Prospect["status"];
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  sector: "",
  source: "",
  potentialValue: "",
  status: "NEW",
  notes: "",
};

export default function Prospects() {
  const { org, navigate, bump, tick } = useStore();
  const { toast } = useToast();

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<Prospect | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<Prospect[]>("/api/prospects")
      .then((d) => {
        if (active) setProspects(d || []);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) return;
        setError(e?.message || "Erreur de chargement");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tick]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prospects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.company || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.phone || "").toLowerCase().includes(q)
      );
    });
  }, [prospects, statusFilter, query]);

  const stats = useMemo(() => {
    const total = prospects.length;
    const totalPotential = prospects.reduce((s, p) => s + (p.potentialValue || 0), 0);
    const converted = prospects.filter((p) => p.status === "CONVERTED").length;
    const rate = total === 0 ? 0 : Math.round((converted / total) * 100);
    return { total, totalPotential, converted, rate };
  }, [prospects]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(p: Prospect) {
    setEditing(p);
    setForm({
      name: p.name,
      company: p.company || "",
      email: p.email || "",
      phone: p.phone || "",
      sector: p.sector || "",
      source: p.source || "",
      potentialValue: p.potentialValue ? String(p.potentialValue) : "",
      status: p.status,
      notes: p.notes || "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Le nom est requis.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        sector: form.sector.trim() || null,
        source: form.source.trim() || null,
        potentialValue: form.potentialValue ? Number(form.potentialValue) : 0,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const updated = await api.patch<Prospect>(`/api/prospects/${editing.id}`, payload);
        setProspects((arr) => arr.map((p) => (p.id === updated.id ? updated : p)));
        toast({ title: "Prospect mis à jour", description: updated.name });
      } else {
        const created = await api.post<Prospect>("/api/prospects", payload);
        setProspects((arr) => [created, ...arr]);
        toast({ title: "Prospect créé", description: created.name });
      }
      bump();
      setFormOpen(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function convert(p: Prospect) {
    setConvertingId(p.id);
    try {
      const res = await api.post<{ client: { id: string; firstName: string; lastName: string } }>(
        `/api/prospects/${p.id}/convert`,
      );
      toast({
        title: "Prospect converti en client",
        description: `${res.client.firstName} ${res.client.lastName}`,
      });
      bump();
      navigate("client-detail", { id: res.client.id });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la conversion";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setConvertingId(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/api/prospects/${toDelete.id}`);
      setProspects((arr) => arr.filter((p) => p.id !== toDelete.id));
      toast({ title: "Prospect supprimé", description: toDelete.name });
      bump();
      setToDelete(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Prospects</h2>
          <p className="text-sm text-muted-foreground">
            Suivez et convertissez vos opportunités commerciales.
          </p>
        </div>
        <Button onClick={openCreate}>
          <UserPlus className="h-4 w-4" />
          Nouveau prospect
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total prospects"
          value={String(stats.total)}
          icon={Users}
          tone="violet"
          hint="Tous statuts confondus"
        />
        <SummaryCard
          title="Valeur potentielle"
          value={formatCurrency(stats.totalPotential, org?.currency)}
          icon={TrendingUp}
          tone="emerald"
          hint="Cumul des opportunités"
        />
        <SummaryCard
          title="Taux de conversion"
          value={`${stats.rate}%`}
          icon={Percent}
          tone="cyan"
          hint={`${stats.converted} prospect(s) converti(s)`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (nom, société, email…)"
            className="pl-8 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-56 h-9">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <ProspectsSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-rose-500 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" onClick={bump}>
            Réessayer
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          onCreate={openCreate}
          hasFilter={statusFilter !== "ALL" || query.trim() !== ""}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Société</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Valeur potentielle</TableHead>
                  <TableHead>Prochaine action</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.company || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        {p.email && <span className="text-xs">{p.email}</span>}
                        {p.phone && <span className="text-xs">{p.phone}</span>}
                        {!p.email && !p.phone && <span>—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[p.status]}>
                        {PROSPECT_STATUS_LABELS[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(p.potentialValue, org?.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(p.nextActionAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ProspectActions
                        prospect={p}
                        onEdit={() => openEdit(p)}
                        onConvert={() => convert(p)}
                        onDelete={() => setToDelete(p)}
                        converting={convertingId === p.id}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden grid gap-3">
            {filtered.map((p) => (
              <Card key={p.id} className="p-4 gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{p.name}</p>
                      <Badge className={STATUS_COLOR[p.status]}>
                        {PROSPECT_STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    {p.company && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {p.company}
                      </p>
                    )}
                  </div>
                  <ProspectActions
                    prospect={p}
                    onEdit={() => openEdit(p)}
                    onConvert={() => convert(p)}
                    onDelete={() => setToDelete(p)}
                    converting={convertingId === p.id}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <InfoChip icon={Mail} label={p.email || "—"} />
                  <InfoChip icon={Phone} label={p.phone || "—"} />
                  <InfoChip
                    icon={TrendingUp}
                    label={formatCurrency(p.potentialValue, org?.currency)}
                  />
                  <InfoChip icon={CalendarClock} label={formatDate(p.nextActionAt)} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Créé le {formatDate(p.createdAt)}</span>
                  {p.source && <span className="truncate">Source : {p.source}</span>}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le prospect" : "Nouveau prospect"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Mettez à jour les informations du prospect."
                : "Renseignez les informations de votre nouvelle opportunité."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom *" className="sm:col-span-2">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex. Aïcha Diallo"
                  autoFocus
                />
              </Field>
              <Field label="Société">
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Ex. Acme SARL"
                />
              </Field>
              <Field label="Secteur">
                <Input
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  placeholder="Ex. Fintech"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemple.com"
                />
              </Field>
              <Field label="Téléphone">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+221 …"
                />
              </Field>
              <Field label="Source">
                <Input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="Ex. Site web, LinkedIn…"
                />
              </Field>
              <Field label="Valeur potentielle">
                <Input
                  type="number"
                  min={0}
                  value={form.potentialValue}
                  onChange={(e) => setForm({ ...form, potentialValue: e.target.value })}
                  placeholder="0"
                />
              </Field>
              <Field label="Statut" className="sm:col-span-2">
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as Prospect["status"] })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROSPECT_STATUS_LABELS) as Prospect["status"][]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {PROSPECT_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Contexte, besoins exprimés, prochaine étape…"
                  rows={3}
                />
              </Field>
            </div>
            {formError && (
              <p className="text-sm text-rose-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Enregistrer" : "Créer le prospect"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le prospect ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Le prospect{" "}
              <span className="font-medium text-foreground">{toDelete?.name}</span> sera
              définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Sub components ---------- */

const TONE_BG: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  neutral: "bg-muted text-muted-foreground",
};

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_BG;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </p>
          <p className="text-2xl font-semibold tracking-tight truncate">{value}</p>
          {hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function InfoChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0 rounded-md border px-2 py-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function ProspectActions({
  prospect,
  onEdit,
  onConvert,
  onDelete,
  converting,
}: {
  prospect: Prospect;
  onEdit: () => void;
  onConvert: () => void;
  onDelete: () => void;
  converting: boolean;
}) {
  const isConverted = prospect.status === "CONVERTED" || !!prospect.convertedClientId;
  return (
    <div className="flex items-center justify-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onConvert}
            disabled={isConverted || converting}
            className={isConverted ? "opacity-50" : ""}
          >
            <ArrowRightLeft className="h-4 w-4" />
            {isConverted ? "Déjà converti" : "Convertir en client"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function EmptyState({
  onCreate,
  hasFilter,
}: {
  onCreate: () => void;
  hasFilter: boolean;
}) {
  return (
    <Card className="py-12">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300 mb-4">
          {hasFilter ? <Inbox className="h-8 w-8" /> : <UserPlus className="h-8 w-8" />}
        </div>
        <p className="text-base font-medium">
          {hasFilter ? "Aucun prospect trouvé" : "Aucun prospect pour le moment"}
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {hasFilter
            ? "Essayez d'ajuster votre recherche ou votre filtre de statut."
            : "Commencez par créer votre premier prospect pour suivre votre pipeline commercial."}
        </p>
        <Button onClick={onCreate} className="mt-4">
          <UserPlus className="h-4 w-4" />
          Créer un prospect
        </Button>
      </CardContent>
    </Card>
  );
}

function ProspectsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Card className="hidden md:block py-0">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
      <div className="md:hidden grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}
