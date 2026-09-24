"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  initials,
  PROJECT_STATUS_LABELS,
  STATUS_COLOR,
  TASK_STATUS_LABELS,
} from "@/lib/format";
import type {
  Client,
  Document as DocFile,
  Invoice,
  Project,
  Task,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  User as UserIcon,
  Wallet,
  FileText,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

const COLUMNS: { key: Task["status"]; label: string; accent: string; dot: string }[] = [
  { key: "TODO", label: "À faire", accent: "border-l-4 border-l-neutral-400", dot: "bg-neutral-400" },
  { key: "DOING", label: "En cours", accent: "border-l-4 border-l-cyan-500", dot: "bg-cyan-500" },
  { key: "REVIEW", label: "À valider", accent: "border-l-4 border-l-amber-500", dot: "bg-amber-500" },
  { key: "DONE", label: "Terminé", accent: "border-l-4 border-l-emerald-500", dot: "bg-emerald-500" },
];

const PRIORITY_LABELS: Record<Task["priority"], string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
};

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  LOW: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  HIGH: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

type ProjectFull = Project & { client?: Client; tasks?: Task[] };

function clientName(c?: Client) {
  if (!c) return "—";
  const full = `${c.firstName} ${c.lastName}`.trim();
  return c.company ? `${full} (${c.company})` : full;
}

export default function ProjectDetail() {
  const { params, navigate, org, user, tick, bump } = useStore();
  const { toast } = useToast();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectFull | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // tab state
  const [tab, setTab] = useState("kanban");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoading(true);
    api
      .get<ProjectFull>(`/api/projects/${projectId}`)
      .then((data) => {
        if (!active) return;
        setProject(data);
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      })
      .catch((e) => {
        if (!active) return;
        toast({
          title: "Erreur",
          description:
            e instanceof ApiError ? e.message : "Impossible de charger le projet.",
          variant: "destructive",
        });
        setProject(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId, tick, toast]);

  if (!projectId) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("projects")} className="w-fit">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <Card className="p-8 text-center border-dashed">
          <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
          <p className="mt-2 text-sm text-muted-foreground">Aucun projet sélectionné.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("projects")} className="w-fit">
          <ArrowLeft className="h-4 w-4" /> Retour aux projets
        </Button>
        <Card className="p-8 text-center border-dashed">
          <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
          <p className="mt-2 font-semibold">Projet introuvable</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ce projet n'existe pas ou a été supprimé.
          </p>
        </Card>
      </div>
    );
  }

  const tasksByCol = (status: Task["status"]) => tasks.filter((t) => t.status === status);
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const progress =
    project.progress ?? (tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    // Determine target column
    let targetStatus: Task["status"] | null = null;
    if (COLUMNS.some((c) => c.key === overId)) {
      targetStatus = overId as Task["status"];
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) targetStatus = overTask.status;
    }
    if (!targetStatus || targetStatus === draggedTask.status) return;

    // Optimistic update
    const prevTasks = tasks;
    setTasks((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, status: targetStatus as Task["status"] } : t)),
    );

    try {
      await api.patch(`/api/projects/${projectId}/tasks/${activeId}`, {
        status: targetStatus,
      });
      toast({
        title: "Tâche déplacée",
        description: `« ${draggedTask.title} » → ${TASK_STATUS_LABELS[targetStatus]}`,
      });
      bump();
    } catch (err) {
      setTasks(prevTasks);
      toast({
        title: "Erreur",
        description:
          err instanceof ApiError ? err.message : "Impossible de déplacer la tâche.",
        variant: "destructive",
      });
    }
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Top: back + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("projects")} className="w-fit">
          <ArrowLeft className="h-4 w-4" /> Retour aux projets
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Modifier
          </Button>
          <Button variant="outline" size="sm" className="text-rose-600" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
        </div>
      </div>

      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5" />
              {clientName(project.client)}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                {project.budget ? formatCurrency(project.budget, org?.currency) : "—"}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(project.startDate)} → {formatDate(project.endDate)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={STATUS_COLOR[project.status] || "bg-muted text-muted-foreground"}>
              {PROJECT_STATUS_LABELS[project.status] || project.status}
            </Badge>
            <div className="w-40">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Statut"
          value={PROJECT_STATUS_LABELS[project.status] || project.status}
          icon={<ClipboardList className="h-5 w-5" />}
          color={STATUS_COLOR[project.status] || "bg-muted text-muted-foreground"}
        />
        <StatCard
          label="Progression"
          value={`${progress}%`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          progress={progress}
        />
        <StatCard
          label="Budget"
          value={project.budget ? formatCurrency(project.budget, org?.currency) : "—"}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="Tâches"
          value={`${doneTasks} / ${tasks.length}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="kanban">Tableau Kanban</TabsTrigger>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <KanbanBoard
            projectId={projectId}
            tasks={tasks}
            tasksByCol={tasksByCol}
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            activeTask={activeTask}
            assigneeName={user?.name}
            assigneeId={user?.id}
          />
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab project={project} currency={org?.currency} navigate={navigate} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab projectId={projectId} currency={org?.currency} navigate={navigate} />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <EditProjectDialog
        projectId={projectId}
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        onSaved={(updated) => {
          setProject({ ...project, ...updated });
          bump();
        }}
      />

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les tâches liées seront également supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-600/90"
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                setDeleting(true);
                try {
                  await api.del(`/api/projects/${projectId}`);
                  toast({ title: "Projet supprimé" });
                  bump();
                  navigate("projects");
                } catch (err) {
                  toast({
                    title: "Erreur",
                    description:
                      err instanceof ApiError ? err.message : "Impossible de supprimer.",
                    variant: "destructive",
                  });
                } finally {
                  setDeleting(false);
                  setDeleteOpen(false);
                }
              }}
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------- Stat card ---------------- */

function StatCard({
  label,
  value,
  icon,
  color,
  progress,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
  progress?: number;
}) {
  return (
    <Card className="p-4 gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
      {typeof progress === "number" ? (
        <Progress value={progress} className="h-1.5" />
      ) : color ? (
        <Badge className={color}>{value}</Badge>
      ) : null}
    </Card>
  );
}

/* ---------------- Kanban ---------------- */

function KanbanBoard({
  projectId,
  tasks,
  tasksByCol,
  sensors,
  onDragStart,
  onDragEnd,
  activeTask,
  assigneeName,
  assigneeId,
}: {
  projectId: string;
  tasks: Task[];
  tasksByCol: (status: Task["status"]) => Task[];
  sensors: ReturnType<typeof useSensors>;
  onDragStart: (e: DragStartEvent) => void;
  onDragEnd: (e: DragEndEvent) => void;
  activeTask: Task | null;
  assigneeName?: string;
  assigneeId?: string;
}) {
  const [addCol, setAddCol] = useState<Task["status"] | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);

  return (
    <>
      {tasks.length === 0 ? (
        <Card className="p-8 border-dashed text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-semibold">Aucune tâche. Créez la première tâche.</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cliquez sur « Ajouter une tâche » dans une colonne pour démarrer.
          </p>
          <Button className="mt-4" onClick={() => setAddCol("TODO")}>
            <Plus className="h-4 w-4" /> Ajouter une tâche
          </Button>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <div className="flex gap-4 min-w-max">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.key}
                  col={col}
                  tasks={tasksByCol(col.key)}
                  onAdd={() => setAddCol(col.key)}
                  onClickTask={(t) => setEditTask(t)}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeTask ? <TaskCardView task={activeTask} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add task dialog */}
      {addCol && (
        <TaskDialog
          mode="create"
          projectId={projectId}
          defaultStatus={addCol}
          assigneeName={assigneeName}
          assigneeId={assigneeId}
          open={true}
          onOpenChange={(o) => !o && setAddCol(null)}
          onSaved={() => {
            setAddCol(null);
          }}
        />
      )}

      {/* Edit / view task dialog */}
      {editTask && (
        <TaskDialog
          mode="edit"
          projectId={projectId}
          task={editTask}
          assigneeName={assigneeName}
          assigneeId={assigneeId}
          open={true}
          onOpenChange={(o) => !o && setEditTask(null)}
          onSaved={() => {
            setEditTask(null);
          }}
        />
      )}
    </>
  );
}

function KanbanColumn({
  col,
  tasks,
  onAdd,
  onClickTask,
}: {
  col: { key: Task["status"]; label: string; accent: string; dot: string };
  tasks: Task[];
  onAdd: () => void;
  onClickTask: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] w-[280px] rounded-lg bg-muted/40 border ${col.accent} ${
        isOver ? "ring-2 ring-primary/40 bg-muted/60" : ""
      } transition-colors`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
          <span className="text-sm font-semibold">{col.label}</span>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onAdd}
          aria-label="Ajouter une tâche"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 min-h-[120px] max-h-[60vh] overflow-y-auto cf-scroll">
          {tasks.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
              Déposez une tâche ici
            </div>
          ) : (
            tasks.map((t) => (
              <SortableTaskCard key={t.id} task={t} onClick={() => onClickTask(t)} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={isDragging ? "opacity-50" : ""}>
      <TaskCardView task={task} onClick={onClick} dragging={isDragging} />
    </div>
  );
}

function TaskCardView({
  task,
  onClick,
  dragging,
}: {
  task: Task;
  onClick?: () => void;
  dragging?: boolean;
}) {
  const user = useStore((s) => s.user);

  const assigneeInitials =
    task.assigneeId && user?.id === task.assigneeId ? initials(user.name) : "?";

  return (
    <div
      onClick={(e) => {
        // Avoid triggering click after drag
        if (dragging) return;
        e.stopPropagation();
        onClick?.();
      }}
      className={`group rounded-md border bg-card p-3 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer ${
        dragging ? "cursor-grabbing" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight line-clamp-2">{task.title}</p>
        <Badge className={PRIORITY_COLOR[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
      </div>
      {task.description ? (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
      ) : null}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {formatDate(task.dueDate)}
        </span>
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
            {assigneeInitials}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}

/* ---------------- Task dialog (create / edit / view) ---------------- */

function TaskDialog({
  mode,
  projectId,
  task,
  defaultStatus,
  assigneeName,
  assigneeId,
  open,
  onOpenChange,
  onSaved,
}: {
  mode: "create" | "edit";
  projectId: string;
  task?: Task;
  defaultStatus?: Task["status"];
  assigneeName?: string;
  assigneeId?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { bump } = useStore();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<Task["status"]>(task?.status ?? defaultStatus ?? "TODO");
  const [priority, setPriority] = useState<Task["priority"]>(task?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [assignee, setAssignee] = useState<string>(task?.assigneeId ?? assigneeId ?? "");

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus(task?.status ?? defaultStatus ?? "TODO");
      setPriority(task?.priority ?? "MEDIUM");
      setDueDate(task?.dueDate ? task.dueDate.slice(0, 10) : "");
      setAssignee(task?.assigneeId ?? assigneeId ?? "");
      setConfirmDelete(false);
    }
  }, [open, task, defaultStatus, assigneeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast({
        title: "Titre requis",
        description: "Veuillez saisir un titre pour la tâche.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        await api.post(`/api/projects/${projectId}/tasks`, {
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          assigneeId: assignee || undefined,
        });
        toast({ title: "Tâche créée" });
      } else if (task) {
        await api.patch(`/api/projects/${projectId}/tasks/${task.id}`, {
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        });
        toast({ title: "Tâche mise à jour" });
      }
      bump();
      onSaved();
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof ApiError ? err.message : "Impossible d'enregistrer la tâche.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    setSubmitting(true);
    try {
      await api.del(`/api/projects/${projectId}/tasks/${task.id}`);
      toast({ title: "Tâche supprimée" });
      bump();
      onSaved();
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof ApiError ? err.message : "Impossible de supprimer la tâche.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{mode === "create" ? "Nouvelle tâche" : "Modifier la tâche"}</DialogTitle>
              <DialogDescription>
                {mode === "create"
                  ? "Ajoutez une tâche à votre projet."
                  : "Modifiez les informations de la tâche."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="task-title">
                  Titre <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Préparer la maquette…"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="task-desc">Description</Label>
                <Textarea
                  id="task-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Détails, contexte, critères d'acceptation…"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="task-status">Statut</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as Task["status"])}>
                    <SelectTrigger id="task-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="task-priority">Priorité</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
                    <SelectTrigger id="task-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Basse</SelectItem>
                      <SelectItem value="MEDIUM">Moyenne</SelectItem>
                      <SelectItem value="HIGH">Haute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="task-due">Échéance</Label>
                  <Input
                    id="task-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="task-assignee">Responsable</Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger id="task-assignee" className="w-full">
                      <SelectValue placeholder="Non assigné" />
                    </SelectTrigger>
                    <SelectContent>
                      {!assigneeId ? (
                        <SelectItem value="__none" disabled>
                          Aucun membre
                        </SelectItem>
                      ) : (
                        <SelectItem value={assigneeId}>
                          {assigneeName || "Moi"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className={mode === "edit" ? "justify-between" : ""}>
              {mode === "edit" && task ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-rose-600"
                  onClick={() => setConfirmDelete(true)}
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              ) : null}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Enregistrement…" : mode === "create" ? "Créer" : "Enregistrer"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete task confirm */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-600/90"
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {submitting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------- Overview tab ---------------- */

function OverviewTab({
  project,
  currency,
  navigate,
}: {
  project: ProjectFull;
  currency?: string;
  navigate: ReturnType<typeof useStore.getState>["navigate"];
}) {
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<DocFile[]>(`/api/documents?projectId=${project.id}`)
      .then((d) => active && setDocuments(Array.isArray(d) ? d : []))
      .catch(() => active && setDocuments([]))
      .finally(() => active && setLoadingDocs(false));
    return () => {
      active = false;
    };
  }, [project.id]);

  const doneTasks = (project.tasks ?? []).filter((t) => t.status === "DONE").length;
  const total = project.tasks?.length ?? 0;
  const progress =
    project.progress ?? (total ? Math.round((doneTasks / total) * 100) : 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-6 lg:col-span-2">
        <h3 className="font-semibold mb-3">Description</h3>
        {project.description ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Aucune description.</p>
        )}
        <Separator className="my-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow label="Budget" value={project.budget ? formatCurrency(project.budget, currency) : "—"} />
          <InfoRow label="Progression" value={`${progress}%`} />
          <InfoRow label="Date de début" value={formatDate(project.startDate)} />
          <InfoRow label="Date de fin" value={formatDate(project.endDate)} />
          <InfoRow label="Client" value={clientName(project.client)} />
          <InfoRow label="Créé le" value={formatDate(project.createdAt)} />
        </div>

        <Separator className="my-4" />
        <div className="flex flex-wrap gap-2">
          {project.client ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("client-detail", { id: project.client!.id })}
            >
              <ExternalLink className="h-4 w-4" /> Fiche client
            </Button>
          ) : null}
          {project.contractId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("contract-detail", { id: project.contractId! })}
            >
              <FileText className="h-4 w-4" /> Contrat lié
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-3 inline-flex items-center gap-2">
          <FileText className="h-4 w-4" /> Documents
        </h3>
        {loadingDocs ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aucun document lié.</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto cf-scroll">
            {documents.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border p-2.5 hover:bg-accent transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.type} · {formatDate(d.createdAt)}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

/* ---------------- Invoices tab ---------------- */

function InvoicesTab({
  projectId,
  currency,
  navigate,
}: {
  projectId: string;
  currency?: string;
  navigate: ReturnType<typeof useStore.getState>["navigate"];
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<Invoice[]>("/api/invoices")
      .then((d) => {
        if (!active) return;
        const all = Array.isArray(d) ? d : [];
        setInvoices(all.filter((i) => i.projectId === projectId));
      })
      .catch(() => active && setInvoices([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <Receipt className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="mt-2 font-semibold">Aucune facture liée</p>
        <p className="text-sm text-muted-foreground mt-1">
          Les factures associées à ce projet apparaîtront ici.
        </p>
      </Card>
    );
  }

  // Compute total per invoice if items available
  function invoiceTotal(inv: Invoice) {
    const items = inv.items ?? [];
    const subtotal = items.reduce((s, it) => s + (it.qty || 0) * (it.unitPrice || 0), 0);
    const discount = (subtotal * (inv.discount || 0)) / 100;
    const taxed = subtotal - discount;
    const tax = (taxed * (inv.taxRate || 0)) / 100;
    return subtotal - discount + tax;
  }

  return (
    <Card className="p-0 overflow-hidden">
      <ul className="divide-y">
        {invoices.map((inv) => (
          <li key={inv.id}>
            <button
              onClick={() => navigate("invoice-detail", { id: inv.id })}
              className="w-full flex flex-wrap items-center gap-3 p-4 hover:bg-accent transition-colors text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{inv.number}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.client ? clientName(inv.client) : "—"} · {formatDate(inv.issueDate)}
                </p>
              </div>
              <span className="text-sm font-medium">
                {formatCurrency(invoiceTotal(inv), currency)}
              </span>
              <Badge className={STATUS_COLOR[inv.status] || "bg-muted text-muted-foreground"}>
                {inv.status}
              </Badge>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Edit project dialog ---------------- */

function EditProjectDialog({
  projectId,
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: ProjectFull;
  onSaved: (patch: Partial<Project>) => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [budget, setBudget] = useState(project.budget ? String(project.budget) : "");
  const [startDate, setStartDate] = useState(project.startDate ? project.startDate.slice(0, 10) : "");
  const [endDate, setEndDate] = useState(project.endDate ? project.endDate.slice(0, 10) : "");
  const [status, setStatus] = useState<Project["status"]>(project.status);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
      setBudget(project.budget ? String(project.budget) : "");
      setStartDate(project.startDate ? project.startDate.slice(0, 10) : "");
      setEndDate(project.endDate ? project.endDate.slice(0, 10) : "");
      setStatus(project.status);
    }
  }, [open, project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Nom requis",
        description: "Le nom du projet est obligatoire.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        budget: budget ? Number(budget) : null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        status,
      };
      const updated = await api.patch<Project>(`/api/projects/${projectId}`, payload);
      toast({ title: "Projet mis à jour" });
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof ApiError ? err.message : "Impossible de modifier le projet.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Modifier le projet</DialogTitle>
            <DialogDescription>Modifiez les informations principales du projet.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nom du projet</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-budget">Budget</Label>
                <Input
                  id="edit-budget"
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Statut</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Project["status"])}>
                  <SelectTrigger id="edit-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-start">Date de début</Label>
                <Input
                  id="edit-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-end">Date de fin</Label>
                <Input
                  id="edit-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
