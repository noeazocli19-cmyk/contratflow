"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  PROJECT_STATUS_LABELS,
  STATUS_COLOR,
} from "@/lib/format";
import type { Client, Contract, Project } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderKanban, Plus, FolderOpen, CalendarDays, Wallet, ListChecks } from "lucide-react";

type ProjectWithClient = Project & { client?: Client };

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "ALL", label: "Tous" },
  { key: "TODO", label: "À démarrer" },
  { key: "IN_PROGRESS", label: "En cours" },
  { key: "PAUSED", label: "En pause" },
  { key: "DONE", label: "Terminé" },
  { key: "CANCELED", label: "Annulé" },
];

function clientName(c?: Client) {
  if (!c) return "—";
  const full = `${c.firstName} ${c.lastName}`.trim();
  return c.company ? `${full} (${c.company})` : full;
}

export default function Projects() {
  const { tick, navigate, org, bump } = useStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [activeTab, setActiveTab] = useState("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [clientId, setClientId] = useState("");
  const [contractId, setContractId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<ProjectWithClient[]>("/api/projects")
      .then((data) => {
        if (!active) return;
        setProjects(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!active) return;
        toast({
          title: "Erreur",
          description: e instanceof ApiError ? e.message : "Impossible de charger les projets.",
          variant: "destructive",
        });
        setProjects([]);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [tick, toast]);

  // Load clients + contracts when opening the create dialog
  useEffect(() => {
    if (!createOpen) return;
    api
      .get<Client[]>("/api/clients")
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => setClients([]));
    api
      .get<Contract[]>("/api/contracts")
      .then((d) => setContracts(Array.isArray(d) ? d : []))
      .catch(() => setContracts([]));
  }, [createOpen]);

  // SIGNED contracts not yet linked to a project (for the current client)
  const availableContracts = useMemo(() => {
    const usedContractIds = new Set(
      projects.map((p) => p.contractId).filter(Boolean) as string[],
    );
    return contracts.filter(
      (c) => c.status === "SIGNED" && !usedContractIds.has(c.id),
    );
  }, [contracts, projects]);

  const filtered = useMemo(() => {
    if (activeTab === "ALL") return projects;
    return projects.filter((p) => p.status === activeTab);
  }, [projects, activeTab]);

  function resetForm() {
    setClientId("");
    setContractId("");
    setName("");
    setDescription("");
    setBudget("");
    setStartDate("");
    setEndDate("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !clientId) {
      toast({
        title: "Champs requis",
        description: "Veuillez renseigner le nom du projet et le client.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        clientId,
        name: name.trim(),
        description: description.trim() || undefined,
        budget: budget ? Number(budget) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      if (contractId) payload.contractId = contractId;
      const created = await api.post<Project>("/api/projects", payload);
      toast({
        title: "Projet créé",
        description: `« ${created.name} » a été créé.`,
      });
      resetForm();
      setCreateOpen(false);
      bump();
      navigate("project-detail", { id: created.id });
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof ApiError ? err.message : "Impossible de créer le projet.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-6 w-6" />
            Projets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivez l'avancement de vos missions et tâches.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nouveau projet
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Nouveau projet</DialogTitle>
                <DialogDescription>
                  Renseignez les informations principales du projet.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="client">
                    Client <span className="text-rose-500">*</span>
                  </Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger id="client" className="w-full">
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          Aucun client
                        </SelectItem>
                      ) : (
                        clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {clientName(c)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="contract">Contrat signé (optionnel)</Label>
                  <Select value={contractId} onValueChange={setContractId}>
                    <SelectTrigger id="contract" className="w-full">
                      <SelectValue placeholder="Aucun (projet hors contrat)" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContracts.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          Aucun contrat signé disponible
                        </SelectItem>
                      ) : (
                        availableContracts
                          .filter((c) => !clientId || c.clientId === clientId)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.number} — {c.title}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Seuls les contrats signés non encore liés à un projet sont affichés.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="name">
                    Nom du projet <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Refonte du site web…"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Objectifs, périmètre, livrables…"
                    rows={3}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="budget">Budget ({org?.currency || "XOF"})</Label>
                  <Input
                    id="budget"
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">Date de début</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endDate">Date de fin</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={submitting}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Création…" : "Créer le projet"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b pb-2">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === "ALL"
              ? projects.length
              : projects.filter((p) => p.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              {tab.label}
              <span
                className={
                  "rounded-full px-1.5 text-[10px] " +
                  (isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground")
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 gap-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} hasProjects={projects.length > 0} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} currency={org?.currency} onClick={() => navigate("project-detail", { id: p.id })} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  currency,
  onClick,
}: {
  project: ProjectWithClient;
  currency?: string;
  onClick: () => void;
}) {
  const tasks = project.tasks ?? [];
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const progress = project.progress ?? (tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="p-4 gap-3 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight truncate">{project.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {clientName(project.client)}
          </p>
        </div>
        <Badge className={STATUS_COLOR[project.status] || "bg-muted text-muted-foreground"}>
          {PROJECT_STATUS_LABELS[project.status] || project.status}
        </Badge>
      </div>

      {project.description ? (
        <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progression</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
        <span className="inline-flex items-center gap-1">
          <Wallet className="h-3.5 w-3.5" />
          {project.budget ? formatCurrency(project.budget, currency) : "—"}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(project.endDate)}
        </span>
        <span className="inline-flex items-center gap-1">
          <ListChecks className="h-3.5 w-3.5" />
          {tasks.length} {tasks.length > 1 ? "tâches" : "tâche"}
        </span>
      </div>
    </Card>
  );
}

function EmptyState({ onCreate, hasProjects }: { onCreate: () => void; hasProjects: boolean }) {
  return (
    <Card className="p-8 border-dashed text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <FolderOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-semibold">
        {hasProjects ? "Aucun projet dans cette catégorie" : "Aucun projet pour l'instant"}
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        {hasProjects
          ? "Essayez un autre filtre ou créez un nouveau projet pour cette catégorie."
          : "Créez votre premier projet pour suivre l'avancement des tâches et la facturation."}
      </p>
      <Button className="mt-4" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Nouveau projet
      </Button>
    </Card>
  );
}
