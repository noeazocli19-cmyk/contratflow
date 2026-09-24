"use client";

import { useState } from "react";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  SkipForward,
  User,
  Briefcase,
  Building,
  Image as ImageIcon,
  Coins,
  FileText,
  Globe,
  UserPlus,
  ClipboardList,
  Mail,
  Phone,
  MapPin,
  Hash,
  Link2,
  Building2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";

const TOTAL = 9;

const JOB_TYPES = ["Développeur", "Designer", "Studio", "Consultant", "Agence web", "Autre"];
const CURRENCIES = ["XOF", "EUR", "USD", "GBP"];

const STEP_LABELS = [
  "Votre nom",
  "Votre métier",
  "Votre entreprise",
  "Logo",
  "Devise",
  "Informations de facturation",
  "Profil professionnel",
  "Premier client",
  "Première proposition",
];

const STEP_ICONS = [
  User,
  Briefcase,
  Building,
  ImageIcon,
  Coins,
  FileText,
  Globe,
  UserPlus,
  ClipboardList,
];

type DataState = {
  name: string;
  jobType: string;
  orgName: string;
  logoUrl: string;
  currency: string;
  address: string;
  country: string;
  taxId: string;
  billingEmail: string;
  billingPhone: string;
  website: string;
  industry: string;
  legalForm: string;
  clientFirstName: string;
  clientLastName: string;
  clientCompany: string;
  clientEmail: string;
  clientPhone: string;
  proposalTitle: string;
  proposalAmount: string;
};

export default function Onboarding() {
  const user = useStore((s) => s.user);
  const org = useStore((s) => s.org);
  const refreshAuth = useStore((s) => s.refreshAuth);
  const navigate = useStore((s) => s.navigate);
  const { toast } = useToast();

  const [step, setStep] = useState<number>(() =>
    Math.max(1, Math.min(TOTAL, (user?.onboardingStep ?? 0) + 1))
  );

  const [data, setData] = useState<DataState>({
    name: user?.name ?? "",
    jobType: "",
    orgName: org?.name ?? "",
    logoUrl: org?.logoUrl ?? "",
    currency: org?.currency ?? "XOF",
    address: org?.address ?? "",
    country: org?.country ?? "",
    taxId: org?.taxId ?? "",
    billingEmail: org?.email ?? "",
    billingPhone: org?.phone ?? "",
    website: org?.website ?? "",
    industry: org?.industry ?? "",
    legalForm: org?.legalForm ?? "",
    clientFirstName: "",
    clientLastName: "",
    clientCompany: "",
    clientEmail: "",
    clientPhone: "",
    proposalTitle: "",
    proposalAmount: "",
  });

  const [loading, setLoading] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setField<K extends keyof DataState>(key: K, value: DataState[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function validateStep(): boolean {
    const e: Record<string, string> = {};
    if (step === 1 && !data.name.trim()) e.name = "Votre nom est requis";
    if (step === 2 && !data.jobType) e.jobType = "Sélectionnez votre métier";
    if (step === 3 && !data.orgName.trim())
      e.orgName = "Le nom de l'entreprise est requis";
    if (step === 5 && !data.currency) e.currency = "Sélectionnez une devise";
    if (step === 8) {
      if (!data.clientFirstName.trim()) e.clientFirstName = "Prénom requis";
      if (!data.clientLastName.trim()) e.clientLastName = "Nom requis";
    }
    if (step === 9) {
      if (!createdClientId)
        e.proposalTitle =
          "Créez d'abord un client à l'étape précédente (ou passez cette étape)";
      if (!data.proposalTitle.trim()) e.proposalTitle = "Titre requis";
      const amt = parseFloat(data.proposalAmount);
      if (!data.proposalAmount || isNaN(amt) || amt < 0)
        e.proposalAmount = "Montant invalide";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function onboardingFields(): Record<string, unknown> {
    switch (step) {
      case 1:
        return { name: data.name };
      case 2:
        return { jobType: data.jobType };
      case 3:
        return { orgName: data.orgName };
      case 4:
        return { logoUrl: data.logoUrl };
      case 5:
        return { currency: data.currency };
      case 6:
        return {
          address: data.address,
          country: data.country,
          taxId: data.taxId,
          billingEmail: data.billingEmail,
          phone: data.billingPhone,
        };
      case 7:
        return {
          website: data.website,
          industry: data.industry,
          legalForm: data.legalForm,
        };
      default:
        return {};
    }
  }

  async function saveStep(skip: boolean) {
    setLoading(true);
    try {
      if (step >= 1 && step <= 7) {
        await api.post("/api/onboarding", {
          step,
          fields: skip ? {} : onboardingFields(),
        });
        if (!skip) toast({ title: "Étape enregistrée" });
      } else if (step === 8) {
        if (!skip) {
          const res = await api.post<{ id: string }>("/api/clients", {
            firstName: data.clientFirstName,
            lastName: data.clientLastName,
            company: data.clientCompany || undefined,
            email: data.clientEmail || undefined,
            phone: data.clientPhone || undefined,
          });
          setCreatedClientId(res.id);
          toast({
            title: "Client créé",
            description: `${data.clientFirstName} ${data.clientLastName}`,
          });
        }
      } else if (step === 9) {
        if (!skip && createdClientId) {
          await api.post("/api/proposals", {
            clientId: createdClientId,
            title: data.proposalTitle,
            amount: parseFloat(data.proposalAmount) || 0,
            currency: data.currency,
          });
          toast({ title: "Proposition créée" });
        }
        await api.post("/api/onboarding/complete");
        await refreshAuth();
        toast({
          title: "Configuration terminée",
          description: "Bienvenue sur ContractFlow",
        });
        navigate("dashboard");
        return;
      }
      setStep((s) => Math.min(TOTAL, s + 1));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Erreur lors de la sauvegarde";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function onNext() {
    if (!validateStep()) return;
    void saveStep(false);
  }

  function onSkip() {
    void saveStep(true);
  }

  function onBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  const progress = Math.round((step / TOTAL) * 100);
  const StepIcon = STEP_ICONS[step - 1];

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header with progress */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              CF
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">
                ContractFlow
              </div>
              <div className="text-xs text-muted-foreground">
                Configuration initiale
              </div>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              Étape{" "}
              <span className="font-semibold text-foreground">{step}</span> /{" "}
              {TOTAL}
            </div>
          </div>
          <Progress value={progress} className="h-1.5" />
          <div className="mt-2 text-xs text-muted-foreground">
            {STEP_LABELS[step - 1]}
          </div>
        </div>
      </header>

      {/* Step content */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <StepIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                {STEP_LABELS[step - 1]}
              </h1>
              <p className="text-sm text-muted-foreground">
                {stepSubtitle(step)}
              </p>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm">
            {renderStep()}
          </div>
        </div>
      </main>

      {/* Sticky footer */}
      <footer className="border-t bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={onBack}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onSkip}
              disabled={loading}
            >
              <SkipForward className="h-4 w-4" />
              Passer
            </Button>
            <Button onClick={onNext} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {step === TOTAL ? "Finalisation…" : "Sauvegarde…"}
                </>
              ) : step === TOTAL ? (
                <>
                  <Check className="h-4 w-4" />
                  Terminer
                </>
              ) : (
                <>
                  Continuer
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );

  function renderStep() {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <FieldLabel label="Votre nom complet" htmlFor="onb-name" error={errors.name}>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="onb-name"
                  value={data.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Awa Diallo"
                  className="pl-8"
                  disabled={loading}
                  aria-invalid={!!errors.name}
                />
              </div>
            </FieldLabel>
            <p className="text-sm text-muted-foreground">
              Ce nom apparaîtra sur vos propositions et signatures.
            </p>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <FieldLabel label="Quel est votre métier ?" htmlFor="onb-jobtype" error={errors.jobType}>
              <Select
                value={data.jobType}
                onValueChange={(v) => setField("jobType", v)}
                disabled={loading}
              >
                <SelectTrigger id="onb-jobtype" className="w-full" aria-invalid={!!errors.jobType}>
                  <SelectValue placeholder="Sélectionnez…" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldLabel>
            <p className="text-sm text-muted-foreground">
              Nous adaptons certains libellés en fonction de votre activité.
            </p>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <FieldLabel label="Nom de votre entreprise" htmlFor="onb-orgname" error={errors.orgName}>
              <div className="relative">
                <Building className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="onb-orgname"
                  value={data.orgName}
                  onChange={(e) => setField("orgName", e.target.value)}
                  placeholder="Mon agence"
                  className="pl-8"
                  disabled={loading}
                  aria-invalid={!!errors.orgName}
                />
              </div>
            </FieldLabel>
            <p className="text-sm text-muted-foreground">
              Affiché sur vos documents clients et factures.
            </p>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <FieldLabel label="URL du logo" htmlFor="onb-logo" error={errors.logoUrl}>
              <div className="relative">
                <ImageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="onb-logo"
                  type="url"
                  value={data.logoUrl}
                  onChange={(e) => {
                    setField("logoUrl", e.target.value);
                    setLogoError(false);
                  }}
                  placeholder="https://…/logo.png"
                  className="pl-8"
                  disabled={loading}
                />
              </div>
            </FieldLabel>
            <div className="flex items-center gap-4 rounded-lg border border-dashed p-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold overflow-hidden shrink-0">
                {data.logoUrl && !logoError ? (
                  <img
                    src={data.logoUrl}
                    alt="Aperçu du logo"
                    className="h-full w-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <span>CF</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {data.logoUrl && !logoError
                  ? "Aperçu de votre logo."
                  : data.logoUrl && logoError
                    ? "Image introuvable. Vérifiez l'URL."
                    : "Saisissez une URL d'image pour voir l'aperçu."}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Optionnel. Vous pourrez l'ajouter plus tard dans les paramètres.
            </p>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <FieldLabel label="Devise principale" htmlFor="onb-currency" error={errors.currency}>
              <Select
                value={data.currency}
                onValueChange={(v) => setField("currency", v)}
                disabled={loading}
              >
                <SelectTrigger id="onb-currency" className="w-full" aria-invalid={!!errors.currency}>
                  <SelectValue placeholder="Sélectionnez…" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldLabel>
            <p className="text-sm text-muted-foreground">
              Utilisée par défaut pour vos propositions, devis et factures.
            </p>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <FieldLabel label="Adresse" htmlFor="onb-address">
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="onb-address"
                    value={data.address}
                    onChange={(e) => setField("address", e.target.value)}
                    placeholder="Rue, ville, code postal"
                    className="pl-8"
                    disabled={loading}
                  />
                </div>
              </FieldLabel>
              <FieldLabel label="Pays" htmlFor="onb-country">
                <Input
                  id="onb-country"
                  value={data.country}
                  onChange={(e) => setField("country", e.target.value)}
                  placeholder="Sénégal"
                  disabled={loading}
                />
              </FieldLabel>
              <FieldLabel label="N° fiscal / TVA" htmlFor="onb-taxid">
                <div className="relative">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="onb-taxid"
                    value={data.taxId}
                    onChange={(e) => setField("taxId", e.target.value)}
                    placeholder="NINEA, SIRET, TVA…"
                    className="pl-8"
                    disabled={loading}
                  />
                </div>
              </FieldLabel>
              <FieldLabel label="Email de facturation" htmlFor="onb-billing-email">
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="onb-billing-email"
                    type="email"
                    value={data.billingEmail}
                    onChange={(e) => setField("billingEmail", e.target.value)}
                    placeholder="facturation@exemple.com"
                    className="pl-8"
                    disabled={loading}
                  />
                </div>
              </FieldLabel>
              <FieldLabel label="Téléphone" htmlFor="onb-billing-phone">
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="onb-billing-phone"
                    value={data.billingPhone}
                    onChange={(e) => setField("billingPhone", e.target.value)}
                    placeholder="+221 …"
                    className="pl-8"
                    disabled={loading}
                  />
                </div>
              </FieldLabel>
            </div>
            <p className="text-sm text-muted-foreground">
              Ces informations apparaîtront sur vos factures et documents officiels.
            </p>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <FieldLabel label="Site web" htmlFor="onb-website">
                <div className="relative">
                  <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="onb-website"
                    type="url"
                    value={data.website}
                    onChange={(e) => setField("website", e.target.value)}
                    placeholder="https://votre-site.com"
                    className="pl-8"
                    disabled={loading}
                  />
                </div>
              </FieldLabel>
              <FieldLabel label="Secteur d'activité" htmlFor="onb-industry">
                <Input
                  id="onb-industry"
                  value={data.industry}
                  onChange={(e) => setField("industry", e.target.value)}
                  placeholder="Technologie, Marketing, Conseil…"
                  disabled={loading}
                />
              </FieldLabel>
              <FieldLabel label="Forme juridique" htmlFor="onb-legalform">
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="onb-legalform"
                    value={data.legalForm}
                    onChange={(e) => setField("legalForm", e.target.value)}
                    placeholder="SARL, EI, SAS…"
                    className="pl-8"
                    disabled={loading}
                  />
                </div>
              </FieldLabel>
            </div>
            <p className="text-sm text-muted-foreground">
              Ces informations enrichissent votre profil entreprise.
            </p>
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <FieldLabel label="Prénom" htmlFor="onb-cl-fn" error={errors.clientFirstName} required>
                <Input
                  id="onb-cl-fn"
                  value={data.clientFirstName}
                  onChange={(e) => setField("clientFirstName", e.target.value)}
                  placeholder="Mamadou"
                  disabled={loading}
                  aria-invalid={!!errors.clientFirstName}
                />
              </FieldLabel>
              <FieldLabel label="Nom" htmlFor="onb-cl-ln" error={errors.clientLastName} required>
                <Input
                  id="onb-cl-ln"
                  value={data.clientLastName}
                  onChange={(e) => setField("clientLastName", e.target.value)}
                  placeholder="Sow"
                  disabled={loading}
                  aria-invalid={!!errors.clientLastName}
                />
              </FieldLabel>
              <FieldLabel label="Entreprise" htmlFor="onb-cl-company">
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="onb-cl-company"
                    value={data.clientCompany}
                    onChange={(e) => setField("clientCompany", e.target.value)}
                    placeholder="SowCorp SARL"
                    className="pl-8"
                    disabled={loading}
                  />
                </div>
              </FieldLabel>
              <FieldLabel label="Email" htmlFor="onb-cl-email">
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="onb-cl-email"
                    type="email"
                    value={data.clientEmail}
                    onChange={(e) => setField("clientEmail", e.target.value)}
                    placeholder="mamadou@sowcorp.com"
                    className="pl-8"
                    disabled={loading}
                  />
                </div>
              </FieldLabel>
              <FieldLabel label="Téléphone" htmlFor="onb-cl-phone">
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="onb-cl-phone"
                    value={data.clientPhone}
                    onChange={(e) => setField("clientPhone", e.target.value)}
                    placeholder="+221 …"
                    className="pl-8"
                    disabled={loading}
                  />
                </div>
              </FieldLabel>
            </div>
            {createdClientId && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Client créé — vous pouvez passer à l'étape suivante.
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Ajoutez votre premier client pour démarrer. Vous pourrez en créer
              d'autres ensuite.
            </p>
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            {!createdClientId && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Aucun client n'a été créé à l'étape précédente. Vous pouvez
                  passer cette étape et créer une proposition plus tard.
                </span>
              </div>
            )}
            <FieldLabel label="Titre de la proposition" htmlFor="onb-prop-title" error={errors.proposalTitle} required>
              <Input
                id="onb-prop-title"
                value={data.proposalTitle}
                onChange={(e) => setField("proposalTitle", e.target.value)}
                placeholder="Refonte du site vitrin"
                disabled={loading || !createdClientId}
                aria-invalid={!!errors.proposalTitle}
              />
            </FieldLabel>
            <FieldLabel label="Montant estimé" htmlFor="onb-prop-amount" error={errors.proposalAmount} required>
              <div className="relative">
                <Coins className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="onb-prop-amount"
                  type="number"
                  min="0"
                  step="any"
                  value={data.proposalAmount}
                  onChange={(e) => setField("proposalAmount", e.target.value)}
                  placeholder="1500000"
                  className="pl-8"
                  disabled={loading || !createdClientId}
                  aria-invalid={!!errors.proposalAmount}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {data.currency}
                </span>
              </div>
            </FieldLabel>
            <p className="text-sm text-muted-foreground">
              Vous pourrez compléter le détail (description, items, conditions)
              depuis la page Propositions.
            </p>
          </div>
        );

      default:
        return null;
    }
  }
}

function stepSubtitle(step: number): string {
  switch (step) {
    case 1:
      return "Personnalisez votre identité sur ContractFlow.";
    case 2:
      return "Quelques questions pour adapter l'expérience.";
    case 3:
      return "Comment s'appelle votre structure ?";
    case 4:
      return "Ajoutez votre logo (optionnel).";
    case 5:
      return "Choisissez la devise de vos documents.";
    case 6:
      return "Informations qui figureront sur vos factures.";
    case 7:
      return "Quelques informations sur votre activité.";
    case 8:
      return "Créez votre premier client.";
    case 9:
      return "Lancez votre première proposition commerciale.";
    default:
      return "";
  }
}

function FieldLabel({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-rose-600 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
