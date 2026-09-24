"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import type { Document, Client, Project, Contract, Invoice, Proposal } from "@/lib/types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  FileArchive,
  FileText,
  Receipt,
  CreditCard,
  PenTool,
  Plus,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  FolderArchive,
  Filter,
  Link as LinkIcon,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PROPOSAL: "Proposition",
  QUOTE: "Devis",
  CONTRACT: "Contrat",
  INVOICE: "Facture",
  RECEIPT: "Reçu",
  FILE: "Fichier",
};

const DOCUMENT_TYPE_TABS: { value: string; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "PROPOSAL", label: "Propositions" },
  { value: "QUOTE", label: "Devis" },
  { value: "CONTRACT", label: "Contrats" },
  { value: "INVOICE", label: "Factures" },
  { value: "RECEIPT", label: "Reçus" },
  { value: "FILE", label: "Fichiers" },
];

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  PROPOSAL: FileText,
  QUOTE: FileText,
  CONTRACT: PenTool,
  INVOICE: Receipt,
  RECEIPT: CreditCard,
  FILE: FileArchive,
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  PROPOSAL: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  QUOTE: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  CONTRACT: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  INVOICE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  RECEIPT: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  FILE: "bg-muted text-muted-foreground",
};

function clientFull(c: Client | undefined | null): string {
  if (!c) return "—";
  return `${c.firstName} ${c.lastName}`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Documents() {
  const { tick, bump } = useStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Document[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  const [typeTab, setTypeTab] = useState("ALL");
  const [assocFilter, setAssocFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Document[]>("/api/documents").catch(() => [] as Document[]),
      api.get<Client[]>("/api/clients").catch(() => [] as Client[]),
      api.get<Project[]>("/api/projects").catch(() => [] as Project[]),
      api.get<Contract[]>("/api/contracts").catch(() => [] as Contract[]),
      api.get<Invoice[]>("/api/invoices").catch(() => [] as Invoice[]),
      api.get<Proposal[]>("/api/proposals").catch(() => [] as Proposal[]),
    ]).then(([d, c, p, ct, i, pr]) => {
      if (!active) return;
      setDocs(d);
      setClients(c);
      setProjects(p);
      setContracts(ct);
      setInvoices(i);
      setProposals(pr);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [tick]);

  // Lookup maps for association resolution
  const lookup = useMemo(() => {
    const clientsM: Record<string, Client> = {};
    clients.forEach((c) => (clientsM[c.id] = c));
    const projectsM: Record<string, Project> = {};
    projects.forEach((p) => (projectsM[p.id] = p));
    const contractsM: Record<string, Contract> = {};
    contracts.forEach((c) => (contractsM[c.id] = c));
    const invoicesM: Record<string, Invoice> = {};
    invoices.forEach((i) => (invoicesM[i.id] = i));
    const proposalsM: Record<string, Proposal> = {};
    proposals.forEach((p) => (proposalsM[p.id] = p));
    return { clientsM, projectsM, contractsM, invoicesM, proposalsM };
  }, [clients, projects, contracts, invoices, proposals]);

  function resolveAssoc(doc: Document): string {
    if (doc.clientId) {
      const c = lookup.clientsM[doc.clientId];
      if (c) return `Client · ${clientFull(c)}`;
    }
    if (doc.projectId) {
      const p = lookup.projectsM[doc.projectId];
      if (p) return `Projet · ${p.name}`;
    }
    if (doc.contractId) {
      const c = lookup.contractsM[doc.contractId];
      if (c) return `Contrat · ${c.number}`;
    }
    if (doc.invoiceId) {
      const i = lookup.invoicesM[doc.invoiceId];
      if (i) return `Facture · ${i.number}`;
    }
    if (doc.proposalId) {
      const p = lookup.proposalsM[doc.proposalId];
      if (p) return `Proposition · ${p.number}`;
    }
    return "Sans association";
  }

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (typeTab !== "ALL" && d.type !== typeTab) return false;
      if (assocFilter !== "ALL") {
        const [kind, id] = assocFilter.split(":");
        if (kind === "client" && d.clientId !== id) return false;
        if (kind === "project" && d.projectId !== id) return false;
        if (kind === "contract" && d.contractId !== id) return false;
        if (kind === "invoice" && d.invoiceId !== id) return false;
        if (kind === "proposal" && d.proposalId !== id) return false;
      }
      return true;
    });
  }, [docs, typeTab, assocFilter]);

  async function handleDelete(doc: Document) {
    try {
      await api.del(`/api/documents/${doc.id}`);
      toast({ title: "Document supprimé" });
      setDeleteTarget(null);
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  }

  function openUrl(doc: Document) {
    if (!doc.url) {
      toast({ title: "Aucune URL", description: "Ce document n'a pas d'URL associée.", variant: "destructive" });
      return;
    }
    window.open(doc.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Bibliothèque de documents liés à vos clients, projets et factures.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Ajouter un document
            </Button>
          </DialogTrigger>
          {createOpen && (
            <AddDocumentDialog
              clients={clients}
              projects={projects}
              contracts={contracts}
              invoices={invoices}
              proposals={proposals}
              onClose={() => setCreateOpen(false)}
              onDone={() => {
                setCreateOpen(false);
                bump();
              }}
            />
          )}
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Tabs value={typeTab} onValueChange={setTypeTab} className="flex-1">
          <TabsList className="overflow-x-auto">
            {DOCUMENT_TYPE_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={assocFilter} onValueChange={setAssocFilter}>
            <SelectTrigger className="w-full md:w-72">
              <SelectValue placeholder="Toutes les associations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les associations</SelectItem>
              {clients.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Clients</SelectLabel>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={`client:${c.id}`}>
                      {clientFull(c)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {projects.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Projets</SelectLabel>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={`project:${p.id}`}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {contracts.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Contrats</SelectLabel>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={`contract:${c.id}`}>
                      {c.number} · {c.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {invoices.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Factures</SelectLabel>
                  {invoices.map((i) => (
                    <SelectItem key={i.id} value={`invoice:${i.id}`}>
                      {i.number}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {proposals.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Propositions</SelectLabel>
                  {proposals.map((p) => (
                    <SelectItem key={p.id} value={`proposal:${p.id}`}>
                      {p.number} · {p.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <FolderArchive className="h-10 w-10" />
            </div>
            <div>
              <div className="font-semibold">Aucun document</div>
              <div className="text-sm text-muted-foreground max-w-md mt-1">
                Ajoutez un document via une URL et associez-le à un client, projet ou facture.
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Ajouter un document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => {
            const Icon = TYPE_ICON[doc.type] || FileArchive;
            return (
              <Card key={doc.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="flex items-start gap-3 text-left flex-1 min-w-0"
                      onClick={() => openUrl(doc)}
                      title={doc.url ? "Ouvrir le document" : "Aucune URL"}
                    >
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{doc.name}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</div>
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {doc.url && (
                          <DropdownMenuItem onClick={() => openUrl(doc)}>
                            <ExternalLink className="h-4 w-4" /> Ouvrir
                          </DropdownMenuItem>
                        )}
                        {doc.url && (
                          <DropdownMenuItem
                            onClick={() => {
                              navigator.clipboard?.writeText(doc.url!).catch(() => {});
                              toast({ title: "URL copiée" });
                            }}
                          >
                            <LinkIcon className="h-4 w-4" /> Copier l&apos;URL
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(doc)}
                        >
                          <Trash2 className="h-4 w-4" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={TYPE_BADGE_CLASS[doc.type] || "bg-muted text-muted-foreground"}>
                      {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      {resolveAssoc(doc)}
                    </span>
                  </div>
                  {doc.url && (
                    <div className="text-xs text-muted-foreground truncate" title={doc.url}>
                      {doc.url}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le document {deleteTarget?.name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le document sera retiré de votre bibliothèque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add document dialog
// ─────────────────────────────────────────────────────────────────────────────

function AddDocumentDialog({
  clients,
  projects,
  contracts,
  invoices,
  proposals,
  onClose,
  onDone,
}: {
  clients: Client[];
  projects: Project[];
  contracts: Contract[];
  invoices: Invoice[];
  proposals: Proposal[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState("FILE");
  const [url, setUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [contractId, setContractId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Nom requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/documents", {
        name: name.trim(),
        type,
        url: url || undefined,
        clientId: clientId || undefined,
        projectId: projectId || undefined,
        contractId: contractId || undefined,
        invoiceId: invoiceId || undefined,
        proposalId: proposalId || undefined,
      });
      toast({ title: "Document ajouté" });
      onDone();
    } catch (e2) {
      const msg = e2 instanceof ApiError ? e2.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Ajouter un document</DialogTitle>
        <DialogDescription>
          Renseignez une URL (PDF, lien externe, etc.) et associez le document à une entité (optionnel).
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Nom *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Proposition ABC - v2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              type="url"
            />
          </div>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
          Associations (optionnel)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {clientFull(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Projet</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {projects
                  .filter((p) => !clientId || p.clientId === clientId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Contrat</Label>
            <Select value={contractId} onValueChange={setContractId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {contracts
                  .filter((c) => !clientId || c.clientId === clientId)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.number}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Facture</Label>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {invoices
                  .filter((i) => !clientId || i.clientId === clientId)
                  .map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.number}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Proposition</Label>
            <Select value={proposalId} onValueChange={setProposalId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {proposals
                  .filter((p) => !clientId || p.clientId === clientId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number} · {p.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
