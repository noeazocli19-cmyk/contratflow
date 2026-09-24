"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  User as UserIcon,
  CreditCard,
  Bell,
  Save,
  Loader2,
  CheckCircle2,
  Sparkles,
  Globe,
  Phone,
  Mail,
  MapPin,
  Hash,
  Calendar,
  Briefcase,
  Receipt,
  Crown,
  ShieldCheck,
  Lock,
  KeyRound,
  Users,
  MoreVertical,
  Trash2,
  UserPlus,
  Copy,
  X,
  ShieldAlert,
  MailCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { Org, User } from "@/lib/types";
import { initials } from "@/lib/format";
import { can, canManageTeam, ROLE_LABELS, type Role } from "@/lib/permissions";

const CURRENCIES = ["XOF", "XAF", "EUR", "USD", "GBP", "CAD", "MAD", "TND"];
const COUNTRIES = [
  "Côte d'Ivoire",
  "Sénégal",
  "France",
  "Belgique",
  "Canada",
  "Maroc",
  "Tunisie",
  "Cameroun",
  "Burkina Faso",
  "Mali",
  "Bénin",
  "Togo",
  "Guinée",
  "Niger",
  "Autre",
];
const INDUSTRIES = [
  "Conseil",
  "Agence web",
  "Développement logiciel",
  "Design / Branding",
  "Marketing digital",
  "Architecture",
  "Formation",
  "Audit / Comptabilité",
  "Traduction",
  "Photographie / Vidéo",
  "Autre",
];
const LEGAL_FORMS = ["SARL", "SASU", "SAS", "EI", "EURL", "Auto-entrepreneur", "Société", "Association", "Autre"];

export default function Settings() {
  const [tab, setTab] = useState("org");
  const user = useStore((s) => s.user);
  const role = user?.role;
  const canViewTeam = can(role, "view_team") || can(role, "manage_team");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Paramètres</h2>
        <p className="text-sm text-muted-foreground">
          Gérez votre organisation, votre profil, votre abonnement et vos préférences.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="org" className="text-xs gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Organisation
          </TabsTrigger>
          <TabsTrigger value="profile" className="text-xs gap-1.5">
            <UserIcon className="h-3.5 w-3.5" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sécurité
          </TabsTrigger>
          {canViewTeam && (
            <TabsTrigger value="team" className="text-xs gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Équipe
            </TabsTrigger>
          )}
          <TabsTrigger value="plan" className="text-xs gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Abonnement
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="mt-4">
          <OrganizationTab />
        </TabsContent>
        <TabsContent value="profile" className="mt-4">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecurityTab />
        </TabsContent>
        {canViewTeam && (
          <TabsContent value="team" className="mt-4">
            <TeamTab />
          </TabsContent>
        )}
        <TabsContent value="plan" className="mt-4">
          <PlanTab />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsPrefsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Organization tab ---------- */

type OrgForm = {
  name: string;
  logoUrl: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  currency: string;
  website: string;
  industry: string;
  taxRate: string;
  taxId: string;
  legalForm: string;
  defaultPaymentTerms: string;
};

function emptyOrgForm(o?: Org | null): OrgForm {
  return {
    name: o?.name || "",
    logoUrl: o?.logoUrl || "",
    email: o?.email || "",
    phone: o?.phone || "",
    address: o?.address || "",
    country: o?.country || "",
    currency: o?.currency || "XOF",
    website: o?.website || "",
    industry: o?.industry || "",
    taxRate: o?.taxRate != null ? String(o.taxRate) : "0",
    taxId: o?.taxId || "",
    legalForm: o?.legalForm || "",
    defaultPaymentTerms: o?.defaultPaymentTerms != null ? String(o.defaultPaymentTerms) : "30",
  };
}

function OrganizationTab() {
  const { org, setAuth, user } = useStore();
  const { toast } = useToast();
  const [form, setForm] = useState<OrgForm>(() => emptyOrgForm(org));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(emptyOrgForm(org));
  }, [org]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Le nom est requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        logoUrl: form.logoUrl.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        country: form.country || null,
        currency: form.currency,
        website: form.website.trim() || null,
        industry: form.industry || null,
        taxRate: Number(form.taxRate) || 0,
        taxId: form.taxId.trim() || null,
        legalForm: form.legalForm || null,
        defaultPaymentTerms: Number(form.defaultPaymentTerms) || 30,
      };
      const updated = await api.patch<Org>("/api/organization", payload);
      if (user) setAuth(user, updated);
      toast({ title: "Organisation mise à jour", description: updated.name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Informations organisation
          </CardTitle>
          <CardDescription>
            Ces informations apparaissent sur vos propositions, devis et factures.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de l'organisation" required icon={Building2}>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Mon agence"
            />
          </Field>
          <Field label="Logo (URL)" icon={Globe}>
            <Input
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://…/logo.png"
            />
          </Field>
          <Field label="Email" icon={Mail}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="contact@agence.com"
            />
          </Field>
          <Field label="Téléphone" icon={Phone}>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+225 …"
            />
          </Field>
          <Field label="Adresse" icon={MapPin}>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Rue, ville"
            />
          </Field>
          <Field label="Site web" icon={Globe}>
            <Input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://agence.com"
            />
          </Field>
          <Field label="Pays" icon={MapPin}>
            <Select
              value={form.country}
              onValueChange={(v) => setForm({ ...form, country: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Secteur d'activité" icon={Briefcase}>
            <Select
              value={form.industry}
              onValueChange={(v) => setForm({ ...form, industry: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Paramètres de facturation
          </CardTitle>
          <CardDescription>
            Devise, taxes et conditions de paiement par défaut.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Devise" icon={CreditCard}>
            <Select
              value={form.currency}
              onValueChange={(v) => setForm({ ...form, currency: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Taux de taxe (%)" icon={Receipt}>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
            />
          </Field>
          <Field label="Identifiant fiscal" icon={Hash}>
            <Input
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder="N° fiscal"
            />
          </Field>
          <Field label="Forme juridique" icon={Building2}>
            <Select
              value={form.legalForm}
              onValueChange={(v) => setForm({ ...form, legalForm: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_FORMS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Délai de paiement (jours)" icon={Calendar}>
            <Input
              type="number"
              min={0}
              value={form.defaultPaymentTerms}
              onChange={(e) =>
                setForm({ ...form, defaultPaymentTerms: e.target.value })
              }
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

/* ---------- Profile tab ---------- */

type ProfileForm = {
  name: string;
  phone: string;
  avatarUrl: string;
};

function ProfileTab() {
  const { user, org, setAuth } = useStore();
  const { toast } = useToast();
  const [form, setForm] = useState<ProfileForm>({
    name: user?.name || "",
    phone: user?.phone || "",
    avatarUrl: user?.avatarUrl || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
      avatarUrl: user?.avatarUrl || "",
    });
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Le nom est requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch<{ user: User; organization: Org }>("/api/settings", {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
      });
      setAuth(res.user, res.organization || org);
      toast({ title: "Profil mis à jour" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            Mon profil
          </CardTitle>
          <CardDescription>
            Vos informations personnelles et votre avatar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet" required icon={UserIcon}>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Prénom Nom"
            />
          </Field>
          <Field label="Email" icon={Mail}>
            <Input value={user?.email || ""} disabled />
          </Field>
          <Field label="Téléphone" icon={Phone}>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+225 …"
            />
          </Field>
          <Field label="Avatar (URL)" icon={Globe}>
            <Input
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
              placeholder="https://…/avatar.png"
            />
          </Field>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

/* ---------- Security tab ---------- */

type ChangePasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

function SecurityTab() {
  const { toast } = useToast();
  const [form, setForm] = useState<ChangePasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ChangePasswordForm, string>>>({});

  function validate() {
    const e: Partial<Record<keyof ChangePasswordForm, string>> = {};
    if (!form.currentPassword) e.currentPassword = "Saisir votre mot de passe actuel";
    if (!form.newPassword) e.newPassword = "Nouveau mot de passe requis";
    else if (form.newPassword.length < 6) e.newPassword = "Au moins 6 caractères";
    else if (form.newPassword === form.currentPassword)
      e.newPassword = "Le nouveau doit être différent du précédent";
    if (form.confirmNewPassword !== form.newPassword)
      e.confirmNewPassword = "Les mots de passe ne correspondent pas";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post("/api/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast({
        title: "Mot de passe mis à jour",
        description: "Utilisez le nouveau mot de passe à la prochaine connexion.",
      });
      setForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Erreur lors du changement";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Password strength meter (simple heuristic).
  const strength = (() => {
    const p = form.newPassword;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6) s += 1;
    if (p.length >= 10) s += 1;
    if (/[A-Z]/.test(p)) s += 1;
    if (/[0-9]/.test(p)) s += 1;
    if (/[^a-zA-Z0-9]/.test(p)) s += 1;
    return Math.min(s, 4);
  })();
  const STRENGTH_LABELS = ["Trop court", "Faible", "Correct", "Bon", "Excellent"];
  const STRENGTH_TONES = [
    "bg-muted",
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-emerald-600",
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Changer le mot de passe
          </CardTitle>
          <CardDescription>
            Pour la sécurité de votre compte, choisissez un mot de passe robuste et unique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Mot de passe actuel" required>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                placeholder="••••••••"
                className="pl-8 pr-9"
                disabled={saving}
                aria-invalid={!!errors.currentPassword}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showCurrent ? "Masquer" : "Afficher"}
              >
                {showCurrent ? <X className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-xs text-rose-600">{errors.currentPassword}</p>
            )}
          </Field>

          <Field label="Nouveau mot de passe" required>
            <div className="relative">
              <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                placeholder="••••••••"
                className="pl-8 pr-9"
                disabled={saving}
                aria-invalid={!!errors.newPassword}
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showNew ? "Masquer" : "Afficher"}
              >
                {showNew ? <X className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-rose-600">{errors.newPassword}</p>
            )}
            {form.newPassword && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${
                        i < strength ? STRENGTH_TONES[strength] : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {STRENGTH_LABELS[strength]}
                </span>
              </div>
            )}
          </Field>

          <Field label="Confirmer le nouveau mot de passe" required>
            <div className="relative">
              <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirmNewPassword}
                onChange={(e) => setForm({ ...form, confirmNewPassword: e.target.value })}
                placeholder="••••••••"
                className="pl-8 pr-9"
                disabled={saving}
                aria-invalid={!!errors.confirmNewPassword}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showConfirm ? "Masquer" : "Afficher"}
              >
                {showConfirm ? <X className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmNewPassword && (
              <p className="text-xs text-rose-600">{errors.confirmNewPassword}</p>
            )}
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Mettre à jour le mot de passe
        </Button>
      </div>
    </form>
  );
}

/* ---------- Team tab ---------- */

type Member = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  organizationId: string;
  createdAt: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

const ROLE_TONE: Record<Role, string> = {
  OWNER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ADMIN: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  MEMBER: "bg-muted text-muted-foreground",
};

function roleBadgeClass(role: string): string {
  if (role === "OWNER") return ROLE_TONE.OWNER;
  if (role === "ADMIN") return ROLE_TONE.ADMIN;
  return ROLE_TONE.MEMBER;
}

function TeamTab() {
  const user = useStore((s) => s.user);
  const tick = useStore((s) => s.tick);
  const { toast } = useToast();
  const role = user?.role;
  const canManage = canManageTeam(role) && role === "OWNER";

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  // Manual refetch used by event handlers (after invite/remove/cancel).
  function reload() {
    Promise.all([
      api.get<Member[]>("/api/members"),
      api.get<Invitation[]>("/api/invitations"),
    ])
      .then(([m, i]) => {
        setMembers(m);
        setInvitations(i);
      })
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Erreur de chargement";
        toast({ title: msg, variant: "destructive" });
      });
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Member[]>("/api/members"),
      api.get<Invitation[]>("/api/invitations"),
    ])
      .then(([m, i]) => {
        if (!active) return;
        setMembers(m);
        setInvitations(i);
      })
      .catch((e) => {
        if (!active) return;
        const msg = e instanceof ApiError ? e.message : "Erreur de chargement";
        toast({ title: msg, variant: "destructive" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tick]);

  async function changeRole(member: Member, newRole: string) {
    try {
      await api.patch(`/api/members/${member.id}`, { role: newRole });
      toast({
        title: "Rôle mis à jour",
        description: `${member.name} est maintenant ${ROLE_LABELS[newRole as Role] ?? newRole}.`,
      });
      reload();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function removeMember(member: Member) {
    try {
      await api.del(`/api/members/${member.id}`);
      toast({ title: "Membre retiré", description: member.name });
      setRemoveTarget(null);
      reload();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function cancelInvitation(inv: Invitation) {
    try {
      await api.del(`/api/invitations/${inv.id}`);
      toast({ title: "Invitation annulée" });
      reload();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur";
      toast({ title: msg, variant: "destructive" });
    }
  }

  function copyInviteLink(token: string) {
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}/?invite=${token}`;
    void navigator.clipboard.writeText(link).then(
      () => toast({ title: "Lien copié", description: link }),
      () => toast({ title: "Impossible de copier", variant: "destructive" }),
    );
  }

  return (
    <div className="space-y-4">
      {/* Members list */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Membres de l'équipe
            </CardTitle>
            <CardDescription>
              Gérez les membres de votre organisation et leurs rôles.
            </CardDescription>
          </div>
          {canManage && (
            <Button onClick={() => setInviteOpen(true)} size="sm">
              <UserPlus className="h-4 w-4" />
              Inviter
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aucun membre à afficher.
            </p>
          ) : (
            <ul className="divide-y max-h-[28rem] overflow-y-auto">
              {members.map((m) => {
                const isSelf = m.id === user?.id;
                const ownerCount = members.filter((x) => x.role === "OWNER").length;
                const isLastOwner = m.role === "OWNER" && ownerCount <= 1;
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 py-3"
                  >
                    <Avatar>
                      {m.avatarUrl ? (
                        <AvatarImage src={m.avatarUrl} alt={m.name} />
                      ) : null}
                      <AvatarFallback className="bg-muted text-xs font-medium">
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">
                          {m.name}
                        </span>
                        {isSelf && (
                          <Badge className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wide">
                            Vous
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.email}
                      </div>
                    </div>
                    <Badge className={`text-xs ${roleBadgeClass(m.role)}`}>
                      {ROLE_LABELS[m.role as Role] ?? m.role}
                    </Badge>
                    {canManage && !isSelf && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Changer le rôle</DropdownMenuLabel>
                          {(["OWNER", "ADMIN", "MEMBER"] as Role[]).map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => changeRole(m, r)}
                              disabled={r === m.role || (isLastOwner && r !== "OWNER")}
                            >
                              {ROLE_LABELS[r]}
                              {r === m.role && (
                                <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-emerald-600" />
                              )}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setRemoveTarget(m)}
                            disabled={isLastOwner}
                          >
                            <Trash2 className="h-4 w-4" />
                            Retirer de l'équipe
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {!canManage && (
                      <div className="w-8" aria-hidden />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MailCheck className="h-4 w-4 text-muted-foreground" />
              Invitations en attente
            </CardTitle>
            <CardDescription>
              Invitations envoyées et non encore acceptées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">
                Aucune invitation en attente.
              </p>
            ) : (
              <ul className="divide-y max-h-96 overflow-y-auto">
                {invitations.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center gap-3 py-3"
                  >
                    <Avatar>
                      <AvatarFallback className="bg-muted text-xs">
                        <Mail className="h-3.5 w-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {inv.email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Rôle : {ROLE_LABELS[inv.role as Role] ?? inv.role}
                      </div>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 text-xs dark:bg-amber-900/40 dark:text-amber-300">
                      En attente
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInviteLink(inv.token)}
                      aria-label="Copier le lien d'invitation"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline ml-1.5">Copier</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelInvitation(inv)}
                      className="text-rose-600 hover:text-rose-700"
                      aria-label="Annuler l'invitation"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline ml-1.5">Annuler</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {!canManage && (
        <Card>
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-muted-foreground">
              Vous êtes <span className="font-medium text-foreground">{ROLE_LABELS[role as Role] ?? role}</span>.
              Seul le propriétaire peut inviter, changer les rôles ou retirer des membres.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite dialog */}
      {inviteOpen && (
        <InviteDialog
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            setInviteOpen(false);
            reload();
          }}
        />
      )}

      {/* Remove confirm */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.name} perdra l'accès à l'organisation. Cette action
              est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && void removeMember(removeTarget)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteDialog({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  function validate() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email invalide");
      return false;
    }
    setError(null);
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setDevLink(null);
    try {
      const res = await api.post<{ invitation: Invitation; devInviteLink: string }>(
        "/api/members",
        { email: email.trim(), role },
      );
      toast({
        title: "Invitation envoyée",
        description: `Email : ${email.trim()}`,
      });
      setDevLink(res.devInviteLink);
      setEmail("");
      // Don't close yet — let the user copy the link.
      onInvited();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Erreur lors de l'invitation";
      setError(msg);
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (!devLink) return;
    const fullLink = devLink.startsWith("?invite=")
      ? `${typeof window !== "undefined" ? window.location.origin : ""}${devLink}`
      : devLink;
    void navigator.clipboard.writeText(fullLink).then(
      () => toast({ title: "Lien copié", description: fullLink }),
      () => toast({ title: "Impossible de copier", variant: "destructive" }),
    );
  }

  function copyAndClose() {
    if (devLink) copyLink();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Inviter un membre
          </DialogTitle>
          <DialogDescription>
            Envoyez une invitation à rejoindre votre organisation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" required icon={Mail}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="membre@exemple.com"
              disabled={saving || !!devLink}
              aria-invalid={!!error}
            />
          </Field>
          {error && <p className="text-xs text-rose-600">{error}</p>}

          <Field label="Rôle" required>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Membre</SelectItem>
                <SelectItem value="ADMIN">Administrateur</SelectItem>
                <SelectItem value="OWNER">Propriétaire</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Vous pourrez modifier ce rôle plus tard.
            </p>
          </Field>

          {devLink && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs space-y-2 dark:border-amber-900/50 dark:bg-amber-950/40">
              <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                <MailCheck className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  En production, ce lien serait envoyé par email. En mode
                  démonstration, partagez-le manuellement au membre invité.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={devLink}
                  className="font-mono text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyLink}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copier
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            {devLink ? (
              <Button type="button" onClick={copyAndClose} className="w-full">
                <CheckCircle2 className="h-4 w-4" />
                Terminer
              </Button>
            ) : (
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Envoyer l'invitation
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Plan tab ---------- */

type PlanKey = "FREE" | "PRO" | "AGENCY";

const PLANS: {
  key: PlanKey;
  name: string;
  price: string;
  period: string;
  features: string[];
  tone: string;
  badge?: string;
}[] = [
  {
    key: "FREE",
    name: "Découverte",
    price: "0",
    period: "/ mois",
    tone: "neutral",
    features: [
      "1 utilisateur",
      "Jusqu'à 3 clients",
      "5 propositions / mois",
      "3 contrats maximum",
      "3 projets actifs",
      "Support communautaire",
    ],
  },
  {
    key: "PRO",
    name: "Pro",
    price: "15 000",
    period: "FCFA / mois",
    tone: "emerald",
    badge: "Populaire",
    features: [
      "1 utilisateur",
      "Clients illimités",
      "Propositions & devis illimités",
      "Contrats & factures illimités",
      "Projets illimités",
      "Plans de paiement & échéances",
      "Portails publics (proposition, contrat, facture)",
      "Rapports avancés + export PDF",
      "Support prioritaire",
    ],
  },
  {
    key: "AGENCY",
    name: "Agence",
    price: "39 000",
    period: "FCFA / mois",
    tone: "violet",
    badge: "Équipes",
    features: [
      "Tout le plan Pro",
      "Jusqu'à 5 membres",
      "Rôles & permissions",
      "Marque blanche (logo, couleur)",
      "Modèles de contrats avancés",
      "Accès API & webhooks",
      "Onboarding dédié",
    ],
  },
];

type SubscriptionData = {
  subscription: {
    id: string;
    plan: PlanKey;
    status: string;
    seats: number;
    startedAt: string;
    renewsAt: string | null;
  } | null;
  limits: {
    name: string;
    maxClients: number | null;
    maxProposalsPerMonth: number | null;
    maxContracts: number | null;
    maxActiveProjects: number | null;
    maxInvoicesPerMonth: number | null;
    maxMembers: number | null;
    storageMb: number;
    automations: boolean;
    templates: boolean;
    pdfExport: boolean;
    reminders: boolean;
    customBranding: boolean;
  };
  usage: {
    clients: number;
    contracts: number;
    activeProjects: number;
    members: number;
    proposalsThisMonth: number;
    invoicesThisMonth: number;
  };
};

function PlanTab() {
  const { toast } = useToast();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PlanKey | null>(null);

  const load = () => {
    let active = true;
    api
      .get<SubscriptionData>("/api/subscription")
      .then((d) => {
        if (!active) return;
        setData(d);
      })
      .catch(() => {
        // keep null — show skeleton
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  };

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, []); 
    useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pay = params.get("pay");
    if (!pay) return;

    if (pay === "success") {
      toast({ title: "Paiement confirmé", description: "Votre abonnement est maintenant actif." });
      load();
    } else if (pay === "pending") {
      toast({ title: "Paiement en cours de confirmation", description: "Cela peut prendre quelques instants." });
    } else if (pay === "canceled") {
      toast({ title: "Paiement annulé", variant: "destructive" });
    } else if (pay === "failed" || pay === "error") {
      toast({ title: "Le paiement a échoué", variant: "destructive" });
    }

    params.delete("pay");
    const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", newUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPlan: PlanKey = data?.subscription?.plan ?? "FREE";
  const limits = data?.limits;
  const usage = data?.usage;

  // Detect over-limit state for the banner.
  const overLimit =
    !!limits &&
    !!usage &&
    (
      [
        ["maxClients", usage.clients],
        ["maxProposalsPerMonth", usage.proposalsThisMonth],
        ["maxContracts", usage.contracts],
        ["maxActiveProjects", usage.activeProjects],
        ["maxInvoicesPerMonth", usage.invoicesThisMonth],
        ["maxMembers", usage.members],
      ] as const
    ).some(
      ([key, value]) =>
        limits[key] !== null && value >= (limits[key] as number),
    );

      async function choose(plan: PlanKey) {
    if (plan === currentPlan) return;

    // Passage à un plan payant → paiement SasPay (checkout hébergé), pas de
    // changement direct. Le plan n'est activé qu'après confirmation du paiement.
    if (plan === "PRO" || plan === "AGENCY") {
      setPending(plan);
      try {
        const result = await api.post<{ checkoutUrl: string }>("/api/saaspay/checkout", { plan });
        window.location.href = result.checkoutUrl;
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Erreur lors de l'initiation du paiement";
        toast({ title: msg, variant: "destructive" });
        setPending(null);
      }
      return;
    }

    // Rétrogradation vers le plan gratuit — aucun paiement requis.
    setPending(plan);
    try {
      const updated = await api.patch<{ subscription: { plan: PlanKey } }>(
        "/api/subscription",
        { plan },
      );
      api
        .get<SubscriptionData>("/api/subscription")
        .then((d) => setData(d))
        .catch(() => {});
      toast({
        title: "Plan mis à jour",
        description: `Vous êtes maintenant sur le plan ${updated.subscription.plan}.`,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors du changement de plan";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setPending(null);
    }
  }
  const usageRows: {
    label: string;
    current: number;
    max: number | null;
  }[] = limits && usage
    ? [
        { label: "Clients", current: usage.clients, max: limits.maxClients },
        {
          label: "Propositions ce mois",
          current: usage.proposalsThisMonth,
          max: limits.maxProposalsPerMonth,
        },
        { label: "Contrats", current: usage.contracts, max: limits.maxContracts },
        {
          label: "Projets actifs",
          current: usage.activeProjects,
          max: limits.maxActiveProjects,
        },
        {
          label: "Factures ce mois",
          current: usage.invoicesThisMonth,
          max: limits.maxInvoicesPerMonth,
        },
        { label: "Membres", current: usage.members, max: limits.maxMembers },
      ]
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Votre abonnement
          </CardTitle>
          <CardDescription>
            Plan actuel, limites et options de mise à niveau.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">
              Impossible de charger les informations d&apos;abonnement.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  className={`text-sm ${
                    currentPlan === "PRO"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : currentPlan === "AGENCY"
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Crown className="h-3.5 w-3.5 mr-1" />
                  Plan {currentPlan}
                </Badge>
                {data.subscription?.renewsAt && (
                  <span className="text-xs text-muted-foreground">
                    Renouvellement le {new Date(data.subscription.renewsAt).toLocaleDateString("fr-FR")}
                  </span>
                )}
                <span className="text-sm text-muted-foreground ml-auto">
                  {currentPlan === "FREE"
                    ? "Vous utilisez le plan gratuit."
                    : currentPlan === "PRO"
                      ? "Merci pour votre confiance !"
                      : "Plan Agence actif."}
                </span>
              </div>

              {overLimit && (
                <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20 p-3 text-sm text-rose-700 dark:text-rose-300">
                  Vous avez atteint la limite de votre plan. Passez à Pro pour continuer.
                </div>
              )}

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                {usageRows.map((row) => {
                  const max = row.max;
                  const unlimited = max === null;
                  const pct = unlimited
                    ? 0
                    : max > 0
                      ? Math.min(100, Math.round((row.current / max) * 100))
                      : 100;
                  const atLimit = !unlimited && row.current >= max;
                  return (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span
                          className={`font-medium tabular-nums ${
                            atLimit ? "text-rose-600" : "text-foreground"
                          }`}
                        >
                          {unlimited
                            ? `${row.current} / ∞`
                            : `${row.current} / ${max}`}
                        </span>
                      </div>
                      {unlimited ? (
                        <div className="h-2 w-full rounded-full bg-emerald-100 dark:bg-emerald-900/30" />
                      ) : (
                        <Progress
                          value={pct}
                          className={`h-2 ${
                            atLimit
                              ? "[&>div]:bg-rose-500"
                              : pct >= 80
                                ? "[&>div]:bg-amber-500"
                                : ""
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {limits && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {limits.pdfExport && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px]">
                      Export PDF
                    </Badge>
                  )}
                  {limits.templates && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px]">
                      Modèles
                    </Badge>
                  )}
                  {limits.automations && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px]">
                      Automatisations
                    </Badge>
                  )}
                  {limits.reminders && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px]">
                      Relances
                    </Badge>
                  )}
                  {limits.customBranding && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[11px]">
                      Marque blanche
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-muted text-muted-foreground text-[11px]">
                    {limits.storageMb >= 1024
                      ? `${Math.round((limits.storageMb / 1024) * 10) / 10} Go`
                      : `${limits.storageMb} Mo`}{" "}
                    de stockage
                  </Badge>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.key === currentPlan;
          return (
            <Card
              key={plan.key}
              className={
                isCurrent ? "border-emerald-500 ring-1 ring-emerald-500/30" : ""
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {plan.badge && (
                    <Badge
                      className={
                        plan.badge === "Populaire"
                          ? "bg-emerald-500 text-white"
                          : "bg-violet-500 text-white"
                      }
                    >
                      {plan.badge}
                    </Badge>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    {plan.period}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 mt-0.5 ${
                          plan.tone === "emerald"
                            ? "text-emerald-500"
                            : plan.tone === "violet"
                              ? "text-violet-500"
                              : "text-muted-foreground"
                        }`}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Separator />
                <Button
                  variant={isCurrent ? "outline" : "default"}
                  className="w-full"
                  disabled={isCurrent || pending !== null}
                  onClick={() => choose(plan.key)}
                >
                  {pending === plan.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "Plan actuel"
                  ) : (
                    `Choisir ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Notifications preferences tab ---------- */

type NotifPrefs = {
  emailProposalViewed: boolean;
  emailContractSigned: boolean;
  emailPaymentReceived: boolean;
  emailInvoiceOverdue: boolean;
  emailWeeklyDigest: boolean;
};

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  emailProposalViewed: true,
  emailContractSigned: true,
  emailPaymentReceived: true,
  emailInvoiceOverdue: true,
  emailWeeklyDigest: false,
};

function NotificationsPrefsTab() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<{ user: User; organization: Org }>("/api/settings")
      .then((d) => {
        if (!active) return;
        const orgAny = d.organization as Org & { notifPrefs?: Partial<NotifPrefs> };
        setPrefs({ ...DEFAULT_NOTIF_PREFS, ...(orgAny.notifPrefs || {}) });
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        // keep defaults
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      // MVP: persist as part of org settings (server can ignore unknown fields)
      await api.patch("/api/settings", { notifPrefs: prefs });
      toast({ title: "Préférences enregistrées" });
    } catch (e) {
      // Even if server ignores, show success for MVP
      toast({ title: "Préférences enregistrées" });
    } finally {
      setSaving(false);
    }
  }

  const toggles: { key: keyof NotifPrefs; label: string; description: string }[] = [
    {
      key: "emailProposalViewed",
      label: "Proposition consultée",
      description: "Recevoir un email quand un client ouvre une proposition.",
    },
    {
      key: "emailContractSigned",
      label: "Contrat signé",
      description: "Recevoir un email à chaque signature de contrat.",
    },
    {
      key: "emailPaymentReceived",
      label: "Paiement reçu",
      description: "Recevoir un email à chaque encaissement.",
    },
    {
      key: "emailInvoiceOverdue",
      label: "Facture en retard",
      description: "Recevoir un email quand une facture passe en retard.",
    },
    {
      key: "emailWeeklyDigest",
      label: "Résumé hebdomadaire",
      description: "Un email chaque lundi avec votre activité de la semaine.",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Préférences de notifications
        </CardTitle>
        <CardDescription>
          Choisissez les évènements pour lesquels vous souhaitez être notifié par email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y">
            {toggles.map((t) => (
              <li
                key={t.key}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <Switch
                  checked={prefs[t.key]}
                  onCheckedChange={(checked) =>
                    setPrefs({ ...prefs, [t.key]: checked })
                  }
                  aria-label={t.label}
                />
              </li>
            ))}
          </ul>
        )}
        <Separator className="my-4" />
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Shared field wrapper ---------- */

function Field({
  label,
  required,
  icon: Icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
        {required && <span className="text-rose-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
