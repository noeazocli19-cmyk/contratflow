"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  LogIn,
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Users,
  FileText,
  PenTool,
  FolderKanban,
  Receipt,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Register from "@/components/auth/Register";
import Landing from "@/components/landing/Landing";

const HIGHLIGHTS = [
  { icon: Users, label: "Prospects", color: "text-cyan-600" },
  { icon: FileText, label: "Propositions", color: "text-amber-600" },
  { icon: PenTool, label: "Contrats", color: "text-emerald-600" },
  { icon: FolderKanban, label: "Projets", color: "text-rose-600" },
  { icon: Receipt, label: "Factures", color: "text-cyan-600" },
  { icon: CreditCard, label: "Paiements", color: "text-emerald-600" },
];

export default function Login() {
  // Detect ?invite=TOKEN in URL on mount and auto-switch to register-in-invite mode.
  // Done in the useState initializer to avoid setState-in-effect cascade renders.
  const [inviteToken, setInviteToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    const invite = url.searchParams.get("invite");
    return invite && invite.length > 0 ? invite : null;
  });
  const [mode, setMode] = useState<"landing" | "login" | "register" | "forgot" | "reset">(() => {
    if (typeof window === "undefined") return "landing";
    const url = new URL(window.location.href);
    const invite = url.searchParams.get("invite");
    return invite && invite.length > 0 ? "register" : "landing";
  });
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Clean the ?invite= param from the URL once on mount (no state update).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("invite")) {
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  if (mode === "landing") {
    return (
      <Landing
        onShowLogin={() => setMode("login")}
        onShowRegister={() => setMode("register")}
      />
    );
  }
  if (mode === "register") {
    return (
      <Register
        inviteToken={inviteToken}
        onSwitchToLogin={() => setMode("login")}
        onBackToLanding={() => setMode("landing")}
      />
    );
  }
  if (mode === "forgot") {
    return (
      <ForgotPasswordForm
        onBackToLogin={() => setMode("login")}
        onTokenIssued={(token) => {
          setResetToken(token);
          setMode("reset");
        }}
      />
    );
  }
  if (mode === "reset") {
    return (
      <ResetPasswordForm
        token={resetToken}
        onBackToLogin={() => setMode("login")}
      />
    );
  }
  return (
    <LoginForm
      onSwitchToRegister={() => setMode("register")}
      onSwitchToForgot={() => setMode("forgot")}
      onBackToLanding={() => setMode("landing")}
    />
  );
}

function LoginForm({
  onSwitchToRegister,
  onSwitchToForgot,
  onBackToLanding,
}: {
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void;
  onBackToLanding: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { toast } = useToast();
  const refreshAuth = useStore((s) => s.refreshAuth);

  function validate() {
    const e: { email?: string; password?: string } = {};
    if (!email.trim()) e.email = "Email requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email invalide";
    if (!password) e.password = "Mot de passe requis";
    else if (password.length < 6) e.password = "Au moins 6 caractères";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function doLogin(emailVal: string, passwordVal: string) {
    setLoading(true);
    try {
      await api.post("/api/auth/login", { email: emailVal, password: passwordVal });
      await refreshAuth();
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur ContractFlow",
      });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Erreur de connexion";
      toast({
        title: "Connexion échouée",
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
    void doLogin(email, password);
  }

  function onDemo() {
    setEmail("demo@contractflow.app");
    setPassword("demodemo");
    void doLogin("demo@contractflow.app", "demodemo");
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

            <h1 className="text-2xl font-semibold mb-1">Connexion</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Accédez à votre espace de gestion commercial.
            </p>

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="pl-8"
                    disabled={loading}
                    aria-invalid={!!errors.email}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-rose-600">{errors.email}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  <button
                    type="button"
                    onClick={onSwitchToForgot}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    <KeyRound className="h-3 w-3" />
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
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

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connexion…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Se connecter
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={onDemo}
                className="w-full"
              >
                <Sparkles className="h-4 w-4" />
                Essayer le compte démo
              </Button>
            </form>

            <div className="mt-6 text-sm text-muted-foreground text-center">
              Pas encore de compte ?{" "}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-foreground font-medium hover:underline inline-flex items-center gap-1"
              >
                Créer un compte
                <ArrowRight className="h-3.5 w-3.5" />
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

/* ---------------- Forgot password ---------------- */

function ForgotPasswordForm({
  onBackToLogin,
  onTokenIssued,
}: {
  onBackToLogin: () => void;
  onTokenIssued: (token: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email invalide");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ message: string; devToken?: string }>(
        "/api/auth/forgot-password",
        { email: email.trim() },
      );
      toast({
        title: "Demande envoyée",
        description: res.message,
      });
      if (res.devToken) {
        onTokenIssued(res.devToken);
      } else {
        // No user with this email — go back to login with neutral message.
        toast({
          title: "Vérification terminée",
          description:
            "Si cet email existe, un lien de réinitialisation a été envoyé.",
        });
        onBackToLogin();
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Erreur lors de la demande";
      setError(msg);
      toast({
        title: "Erreur",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              CF
            </div>
            <div>
              <div className="text-lg font-semibold leading-tight">
                ContractFlow
              </div>
              <div className="text-xs text-muted-foreground">
                Récupération du mot de passe
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            Mot de passe oublié
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Saisissez votre email : nous vous enverrons un lien de réinitialisation.
          </p>

          <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2.5 mb-4 text-xs flex items-start gap-2 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              En production, ce lien serait envoyé par email. Dans cet
              environnement de démonstration, le jeton est affiché directement
              après envoi pour vous permettre de réinitialiser.
            </span>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="pl-8"
                  disabled={loading}
                  aria-invalid={!!error}
                />
              </div>
              {error && <p className="text-xs text-rose-600">{error}</p>}
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Envoi…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Envoyer le lien de réinitialisation
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-sm text-muted-foreground text-center">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-foreground font-medium hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-auto border-t bg-background px-4 py-3 text-xs text-muted-foreground text-center">
        © ContractFlow — De la proposition au paiement
      </footer>
    </div>
  );
}

/* ---------------- Reset password ---------------- */

function ResetPasswordForm({
  token,
  onBackToLogin,
}: {
  token: string | null;
  onBackToLogin: () => void;
}) {
  const [tokenInput, setTokenInput] = useState(token || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    token?: string;
    password?: string;
    confirm?: string;
  }>({});
  const { toast } = useToast();
  const refreshAuth = useStore((s) => s.refreshAuth);

  useEffect(() => {
    if (token) setTokenInput(token);
  }, [token]);

  function validate() {
    const e: typeof errors = {};
    if (!tokenInput.trim()) e.token = "Jeton requis";
    if (!password) e.password = "Mot de passe requis";
    else if (password.length < 6) e.password = "Au moins 6 caractères";
    if (confirm !== password) e.confirm = "Les mots de passe ne correspondent pas";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", {
        token: tokenInput.trim(),
        password,
      });
      await refreshAuth();
      toast({
        title: "Mot de passe réinitialisé",
        description: "Vous êtes maintenant connecté(e).",
      });
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Erreur de réinitialisation";
      toast({
        title: "Réinitialisation échouée",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              CF
            </div>
            <div>
              <div className="text-lg font-semibold leading-tight">
                ContractFlow
              </div>
              <div className="text-xs text-muted-foreground">
                Réinitialisation du mot de passe
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            Nouveau mot de passe
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>

          <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2.5 mb-4 text-xs flex items-start gap-2 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              En production, ce jeton aurait été envoyé par email. En mode
              démonstration, le jeton est pré-rempli ci-dessous.
            </span>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="reset-token">Jeton de réinitialisation</Label>
              <div className="relative">
                <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reset-token"
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Jeton reçu par email"
                  className="pl-8 font-mono text-xs"
                  disabled={loading}
                  aria-invalid={!!errors.token}
                />
              </div>
              {errors.token && (
                <p className="text-xs text-rose-600">{errors.token}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reset-password">Nouveau mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reset-password"
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

            <div className="space-y-1.5">
              <Label htmlFor="reset-confirm">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reset-confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="pl-8"
                  disabled={loading}
                  aria-invalid={!!errors.confirm}
                />
              </div>
              {errors.confirm && (
                <p className="text-xs text-rose-600">{errors.confirm}</p>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Réinitialisation…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Réinitialiser et me connecter
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-sm text-muted-foreground text-center">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-foreground font-medium hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-auto border-t bg-background px-4 py-3 text-xs text-muted-foreground text-center">
        © ContractFlow — De la proposition au paiement
      </footer>
    </div>
  );
}
