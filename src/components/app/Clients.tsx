"use client";

import { useEffect, useMemo, useState } from "react";
import {
  UserPlus,
  Search,
  Pencil,
  Trash2,
  MoreVertical,
  Loader2,
  Mail,
  Phone,
  Building2,
  MapPin,
  Users,
  AlertTriangle,
  Inbox,
  Hash,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { formatDate, initials, timeAgo } from "@/lib/format";
import type { Client } from "@/lib/types";

type FormState = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  taxId: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  address: "",
  country: "",
  taxId: "",
  notes: "",
};

export default function Clients() {
  const { navigate, bump, tick } = useStore();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<Client[]>("/api/clients")
      .then((d) => {
        if (active) setClients(d || []);
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
    if (!q) return clients;
    return clients.filter((c) => {
      const full = `${c.firstName} ${c.lastName}`.toLowerCase();
      return (
        full.includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
      );
    });
  }, [clients, query]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(c: Client, e?: React.MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    setEditing(c);
    setForm({
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company || "",
      email: c.email || "",
      phone: c.phone || "",
      address: c.address || "",
      country: c.country || "",
      taxId: c.taxId || "",
      notes: c.notes || "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError("Le prénom et le nom sont requis.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        country: form.country.trim() || null,
        taxId: form.taxId.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const updated = await api.patch<Client>(`/api/clients/${editing.id}`, payload);
        setClients((arr) => arr.map((c) => (c.id === updated.id ? updated : c)));
        toast({ title: "Client mis à jour", description: `${updated.firstName} ${updated.lastName}` });
      } else {
        const created = await api.post<Client>("/api/clients", payload);
        setClients((arr) => [created, ...arr]);
        toast({ title: "Client créé", description: `${created.firstName} ${created.lastName}` });
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

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/api/clients/${toDelete.id}`);
      setClients((arr) => arr.filter((c) => c.id !== toDelete.id));
      toast({ title: "Client supprimé", description: `${toDelete.firstName} ${toDelete.lastName}` });
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
          <h2 className="text-xl font-semibold tracking-tight">Clients</h2>
          <p className="text-sm text-muted-foreground">
            Gérez votre portefeuille client et accédez à leur historique.
          </p>
        </div>
        <Button onClick={openCreate}>
          <UserPlus className="h-4 w-4" />
          Nouveau client
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (nom, société, email…)"
          className="pl-8 h-9"
        />
      </div>

      {/* Content */}
      {loading ? (
        <ClientsSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-rose-500 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" onClick={bump}>
            Réessayer
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={openCreate} hasFilter={query.trim() !== ""} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              onClick={() => navigate("client-detail", { id: c.id })}
              onEdit={(e) => openEdit(c, e)}
              onDelete={(e) => {
                e?.stopPropagation();
                e?.preventDefault();
                setToDelete(c);
              }}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le client" : "Nouveau client"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Mettez à jour les informations du client."
                : "Renseignez les informations de votre nouveau client."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom *">
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="Ex. Aïcha"
                  autoFocus
                />
              </Field>
              <Field label="Nom *">
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Ex. Diallo"
                />
              </Field>
              <Field label="Société" className="sm:col-span-2">
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Ex. Acme SARL"
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
              <Field label="Adresse" className="sm:col-span-2">
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Rue, ville…"
                />
              </Field>
              <Field label="Pays">
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="Ex. Sénégal"
                />
              </Field>
              <Field label="Identifiant fiscal">
                <Input
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  placeholder="N° fiscal"
                />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Préférences, contexte commercial…"
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
                {editing ? "Enregistrer" : "Créer le client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Le client{" "}
              <span className="font-medium text-foreground">
                {toDelete ? `${toDelete.firstName} ${toDelete.lastName}` : ""}
              </span>{" "}
              et tout l'historique associé (propositions, contrats, projets, factures) seront
              définitivement supprimés.
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

function ClientCard({
  client,
  onClick,
  onEdit,
  onDelete,
}: {
  client: Client;
  onClick: () => void;
  onEdit: (e?: React.MouseEvent) => void;
  onDelete: (e?: React.MouseEvent) => void;
}) {
  const full = `${client.firstName} ${client.lastName}`;
  return (
    <Card
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="p-4 gap-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all py-4"
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-sm font-semibold">
            {initials(full)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{full}</p>
          {client.company && (
            <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {client.company}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Client depuis {timeAgo(client.createdAt)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Actions"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1.5 text-sm">
        {client.email && (
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.phone}</span>
          </div>
        )}
        {client.address && (
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.address}</span>
          </div>
        )}
        {client.taxId && (
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <Hash className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.taxId}</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t text-[11px] text-muted-foreground flex items-center justify-between">
        <span>Créé le {formatDate(client.createdAt)}</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Voir →</span>
      </div>
    </Card>
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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300 mb-4">
          {hasFilter ? <Inbox className="h-8 w-8" /> : <Users className="h-8 w-8" />}
        </div>
        <p className="text-base font-medium">
          {hasFilter ? "Aucun client trouvé" : "Aucun client pour le moment"}
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {hasFilter
            ? "Essayez d'ajuster votre recherche."
            : "Ajoutez votre premier client pour démarrer votre portefeuille."}
        </p>
        {!hasFilter && (
          <Button onClick={onCreate} className="mt-4">
            <UserPlus className="h-4 w-4" />
            Créer un client
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ClientsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full" />
      ))}
    </div>
  );
}
