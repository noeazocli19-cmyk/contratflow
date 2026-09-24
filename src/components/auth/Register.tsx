"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  UserPlus,
  Mail,
  Lock,
  User,
  Building,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Users,
  FileText,
  PenTool,
  FolderKanban,
  Receipt,
  CreditCard,
  MailCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";

const HIGHLIGHTS = [
  { icon: Users, label: "Prospects", color: "text-cyan-600" },
  { icon: FileText, label: "Propositions", color: "text-amber-600" },
  { icon: PenTool, label: "Contrats", color: "text-emerald-600" },
  { icon: FolderKanban, label: "Projets", color: "text-rose-600" },
  { icon: Receipt, label: "Factures", color: "text-cyan-600" },
  { icon: CreditCard, label: "Paiements", color: "text-emerald-600" },
];

type InvitationPreview = {
  email: string;
  role: string;
  organizationName: string;
  expiresAt: string;
};

export default function Register({
  inviteToken,
  onSwitchToLogin,
  onBackToLanding,
}: {
  inviteToken?: string | null;
  onSwitchToLogin?: () => void;
  onBackToLanding?: () => void;
}) {
  const isInviteMode = !!inviteToken;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    orgName?: string;
  }>({});
  const { toast } = useToast();
  const refreshAuth = useStore((s) => s.refreshAuth);

  // In invite mode, fetch the invitation preview (email + org name).
  useEffect(() => {
    if (!inviteToken) return;
    let active = true;
    setPreviewLoading(true);
    setPreviewError(null);
    api
      .get<InvitationPreview>(
        `/api/invitations/preview?token=${encodeURIComponent(inviteToken)}`,
      )
      .then((p) => {
        if (!active) return;
        setPreview(p);
        setEmail(p.email);
      })
      .catch((e) => {
        if (!active) return;
        const msg =
          e instanceof ApiError ? e.message : "Invitation invalide";
        setPreviewError(msg);
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [inviteToken]);

  function validate() {
    const e: typeof errors = {};
    if (!isInviteMode && !orgName.trim())
      e.orgName = "Nom de l'organisation requis";
    if (!name.trim()) e.name = "Nom requis";
    // Email is locked in invite mode (we still validate the form value).
    if (!email.trim()) e.email = "Email requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email invalide";
    if (!password) e.password = "Mot de passe requis";
    else if (password.length < 6) e.password = "Au moins 6 caractères";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function doRegister() {
    setLoading(true);
    try {
      if (isInviteMode) {
        await api.post("/api/invitations/accept", {
          token: inviteToken,
          name,
          password,
        });
      } else {
        await api.post("/api/auth/register", {
          email,
          password,
          name,
          orgName,
        });
      }
      await refreshAuth();
      toast({
        title: isInviteMode ? "Invitation acceptée" : "Compte créé",
        description: isInviteMode
          ? "Bienvenue dans votre nouvelle organisation."
          : "Bienvenue ! Configurons votre espace.",
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Erreur lors de l'inscription";
      toast({
        title: isInviteMode ? "Invitation échouée" : "Inscription échouée",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    void doRegister();
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="grid flex-1 md:grid-cols-2">
        {/* Left: form */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center gap-3 mb-8">
              <button
                type="button"
                onClick={onBackToLanding}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity"
                aria-label="Retour à l'accueil"
              >
                CF
              </button>
              <div>
                <div className="text-lg font-semibold leading-tight">
                  ContractFlow
                </div>
                <div className="text-xs text-muted-foreground">
                  De la proposition au paiement
                </div>
              </div>
            </div>

            {isInviteMode ? (
              <>
                <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
                  <MailCheck className="h-5 w-5 text-emerald-600" />
                  Accepter l'invitation
                </h1>
                <p className="text-sm text-muted-foreground mb-6">
                  Rejoignez l'équipe en quelques secondes.
                </p>

                {previewLoading ? (
                  <div className="rounded-md border bg-card p-3 mb-4 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Vérification de l'invitation…
                  </div>
                ) : previewError ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 text-rose-800 p-3 mb-4 text-sm dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                    {previewError}
                  </div>
                ) : preview ? (
                  <div className="rounded-md border bg-card p-3 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Building className="h-3.5 w-3.5" />
                      Organisation
                    </div>
                    <div className="font-medium">{preview.organizationName}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Rôle proposé : <span className="font-medium">{preview.role}</span>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold mb-1">Créer mon compte</h1>
                <p className="text-sm text-muted-foreground mb-6">
                  Lancez votre activité commerciale en quelques minutes.
                </p>
              </>
            )}

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nom complet</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Awa Diallo"
                    className="pl-8"
                    disabled={loading}
                    aria-invalid={!!errors.name}
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-rose-600">{errors.name}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="pl-8"
                    disabled={loading || isInviteMode}
                    aria-invalid={!!errors.email}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-rose-600">{errors.email}</p>
                )}
                {isInviteMode && (
                  <p className="text-xs text-muted-foreground">
                    Email verrouillé par l'invitation.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-8 pr-9"
                    disabled={loading}
                    aria-invalid={!!errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-600">{errors.password}</p>
                )}
              </div>

              {!isInviteMode && (
                <div className="space-y-1.5">
                  <Label htmlFor="orgName">Nom de l'organisation</Label>
                  <div className="relative">
                    <Building className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="orgName"
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Mon agence"
                      className="pl-8"
                      disabled={loading}
                      aria-invalid={!!errors.orgName}
                    />
                  </div>
                  {errors.orgName && (
                    <p className="text-xs text-rose-600">{errors.orgName}</p>
                  )}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isInviteMode ? "Acceptation…" : "Création…"}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    {isInviteMode ? "Accepter l'invitation" : "Créer mon compte"}
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-sm text-muted-foreground text-center">
              Déjà un compte ?{" "}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-foreground font-medium hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Se connecter
              </button>
            </div>
          </div>
        </div>

        {/* Right: highlights (hidden on mobile) */}
        <div className="hidden md:flex flex-col justify-center bg-primary text-primary-foreground px-12 lg:px-20 py-16">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider opacity-80 mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Tout le cycle commercial
            </div>
            <h2 className="text-3xl font-semibold leading-tight mb-3">
              De la proposition au paiement
            </h2>
            <p className="opacity-80 mb-8">
              ContractFlow centralise votre relation client, vos ventes et votre
              facturation dans un seul outil pensé pour les freelances et les
              petites agences.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {HIGHLIGHTS.map((h) => (
                <div
                  key={h.label}
                  className="flex items-center gap-2 rounded-md bg-primary-foreground/10 px-3 py-2.5"
                >
                  <h.icon className={`h-4 w-4 ${h.color}`} />
                  <span className="text-sm font-medium">{h.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm opacity-80">
              <CheckCircle2 className="h-4 w-4" />
              Sans engagement · Données sécurisées
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-auto border-t bg-background px-4 py-3 text-xs text-muted-foreground text-center">
        © ContractFlow — De la proposition au paiement
      </footer>
    </div>
  );
}
