"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import {
  formatCurrency,
  formatDate,
  initials,
  CONTRACT_STATUS_LABELS,
} from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import type { Contract, Client, Signature, Org } from "@/lib/types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  CheckCircle,
  AlertTriangle,
  FileText,
  Printer,
  Building2,
  User,
  Calendar,
  PenTool,
  Lock,
} from "lucide-react";

type Props = { token: string };

type ContractData = {
  contract: Contract;
  client: Client;
  signatures: Signature[];
  organization: Org;
};

export default function ContractPortal({ token }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);

  // Sign form state
  const [signedBy, setSignedBy] = useState("");
  const [signedByEmail, setSignedByEmail] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [agreed, setAgreed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ContractData>(`/api/public/contract/${token}`);
      setData(res);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Lien invalide ou expiré";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitSign() {
    if (!signedBy.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez saisir votre nom complet.",
        variant: "destructive",
      });
      return;
    }
    if (!signedByEmail.trim() || !/^\S+@\S+\.\S+$/.test(signedByEmail)) {
      toast({
        title: "Email invalide",
        description: "Veuillez saisir une adresse e-mail valide.",
        variant: "destructive",
      });
      return;
    }
    if (!signatureData.trim()) {
      toast({
        title: "Signature requise",
        description: "Tapez votre nom complet comme signature.",
        variant: "destructive",
      });
      return;
    }
    if (!agreed) {
      toast({
        title: "Acceptation requise",
        description: "Vous devez cocher la case d'acceptation des termes.",
        variant: "destructive",
      });
      return;
    }

    setSigning(true);
    try {
      await api.post(`/api/public/contract/${token}/sign`, {
        signedBy: signedBy.trim(),
        signedByEmail: signedByEmail.trim(),
        signatureData: signatureData.trim(),
      });
      setSigned(true);
      toast({
        title: "Contrat signé",
        description: "Votre signature a été enregistrée.",
      });
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Impossible d'enregistrer la signature";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSigning(false);
    }
  }

  // --- Success screen ----------------------------------------------------
  if (signed && data) {
    return (
      <PortalShell
        footer={`Contrat envoyé par ${data.organization.name} · ContractFlow`}
      >
        <SuccessCard
          icon={<CheckCircle className="size-12 text-emerald-500" />}
          title="Contrat signé !"
          message={`Un projet et une facture d'acompte ont été créés automatiquement. ${data.organization.name} vous contactera prochainement.`}
        />
      </PortalShell>
    );
  }

  // --- Error state --------------------------------------------------------
  if (error) {
    return (
      <PortalShell footer="ContractFlow">
        <ErrorCard />
      </PortalShell>
    );
  }

  // --- Loading state ------------------------------------------------------
  if (loading || !data) {
    return (
      <PortalShell footer="ContractFlow">
        <LoadingShell />
      </PortalShell>
    );
  }

  const { contract, client, signatures, organization } = data;
  const isSigned = contract.status === "SIGNED" || signatures.length > 0;
  const clientFullName = [client.firstName, client.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <PortalShell
      footer={`Contrat envoyé par ${organization.name} · ContractFlow`}
    >
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Org branding header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <OrgAvatar name={organization.name} logoUrl={organization.logoUrl} />
            <div className="leading-tight">
              <div className="font-semibold text-foreground">
                {organization.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {organization.email ?? "Contrat de prestation"}
              </div>
            </div>
          </div>
          <Badge
            className={`${statusBadgeClass(contract.status)} text-xs px-3 py-1`}
            variant="outline"
          >
            {CONTRACT_STATUS_LABELS[contract.status]}
          </Badge>
        </div>

        {/* Status banner */}
        <StatusBanner contract={contract} signatures={signatures} />

        {/* Main card */}
        <Card className="shadow-sm">
          <CardContent className="px-5 sm:px-8 py-6 sm:py-8 space-y-6">
            {/* Title */}
            <header className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Contrat · {contract.number}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {contract.title}
              </h1>
            </header>

            <Separator />

            {/* De / À */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="size-3.5" /> Prestataire
                </div>
                <div className="font-semibold">{organization.name}</div>
                {organization.email && (
                  <div className="text-sm text-muted-foreground">
                    {organization.email}
                  </div>
                )}
                {organization.address && (
                  <div className="text-sm text-muted-foreground">
                    {organization.address}
                  </div>
                )}
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <User className="size-3.5" /> Client
                </div>
                <div className="font-semibold">{clientFullName}</div>
                {client.company && (
                  <div className="text-sm text-muted-foreground">
                    {client.company}
                  </div>
                )}
                {client.email && (
                  <div className="text-sm text-muted-foreground">
                    {client.email}
                  </div>
                )}
              </div>
            </section>

            {/* Contract body */}
            <section className="space-y-2.5">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <FileText className="size-4 text-muted-foreground" />
                Corps du contrat
              </h2>
              <div className="rounded-lg border bg-muted/20 p-4 sm:p-6 max-h-[480px] overflow-y-auto">
                <div className="space-y-1">{renderMarkdownish(contract.content)}</div>
              </div>
            </section>

            {/* Key facts */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KeyFact
                label="Montant"
                value={formatCurrency(contract.amount, contract.currency)}
              />
              <KeyFact
                label="Durée"
                value={contract.duration ?? "—"}
              />
              <KeyFact
                label="Début"
                value={formatDate(contract.startDate)}
              />
              <KeyFact
                label="Fin"
                value={formatDate(contract.endDate)}
              />
            </section>

            {/* Conditions */}
            {contract.conditions?.trim() && (
              <section className="space-y-2.5">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Lock className="size-4 text-muted-foreground" />
                  Conditions particulières
                </h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 pl-6">
                  {contract.conditions}
                </p>
              </section>
            )}

            <Separator />

            {/* Sign section or signature block */}
            {isSigned ? (
              <SignatureBlock signatures={signatures} />
            ) : (
              <SignSection
                signedBy={signedBy}
                setSignedBy={setSignedBy}
                signedByEmail={signedByEmail}
                setSignedByEmail={setSignedByEmail}
                signatureData={signatureData}
                setSignatureData={setSignatureData}
                agreed={agreed}
                setAgreed={setAgreed}
                signing={signing}
                onSubmit={submitSign}
              />
            )}

            {/* Print */}
            <div className="flex justify-center pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.print()}
                className="text-muted-foreground"
              >
                <Printer className="size-4" />
                Télécharger PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <FileText className="size-3" />
          Contrat {contract.number} · {organization.name}
        </div>
      </div>
    </PortalShell>
  );
}

// --- Sign section --------------------------------------------------------
function SignSection({
  signedBy,
  setSignedBy,
  signedByEmail,
  setSignedByEmail,
  signatureData,
  setSignatureData,
  agreed,
  setAgreed,
  signing,
  onSubmit,
}: {
  signedBy: string;
  setSignedBy: (v: string) => void;
  signedByEmail: string;
  setSignedByEmail: (v: string) => void;
  signatureData: string;
  setSignatureData: (v: string) => void;
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  signing: boolean;
  onSubmit: () => void;
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <PenTool className="size-4" />
          Signer le contrat
        </h2>
        <p className="text-sm text-muted-foreground">
          Pour signer, veuillez remplir les informations ci-dessous. Votre nom
          tapé ci-dessous constitue votre signature électronique.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cf-signed-by">Nom complet</Label>
          <Input
            id="cf-signed-by"
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            placeholder="Prénom Nom"
            className="h-11"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-signed-email">Email</Label>
          <Input
            id="cf-signed-email"
            type="email"
            value={signedByEmail}
            onChange={(e) => setSignedByEmail(e.target.value)}
            placeholder="vous@exemple.com"
            className="h-11"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cf-signature">Taper votre nom comme signature</Label>
        <input
          id="cf-signature"
          type="text"
          value={signatureData}
          onChange={(e) => setSignatureData(e.target.value)}
          placeholder="Votre nom complet"
          className="font-serif italic text-xl h-14 w-full rounded-md border bg-background px-4 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        <p className="text-xs text-muted-foreground">
          Saisissez votre nom tel qu'il apparaîtra sur le contrat signé.
        </p>
      </div>

      <label
        htmlFor="cf-agreed"
        className="flex items-start gap-2.5 cursor-pointer select-none rounded-md border bg-muted/30 p-3 text-sm"
      >
        <Checkbox
          id="cf-agreed"
          checked={agreed}
          onCheckedChange={(v) => setAgreed(v === true)}
          className="mt-0.5 size-5"
        />
        <span className="leading-relaxed">
          J'ai lu et j'accepte les termes du contrat. Je reconnais que la saisie
          de mon nom constitue une signature électronique valant acceptation.
        </span>
      </label>

      <Button
        size="lg"
        onClick={onSubmit}
        disabled={signing}
        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <PenTool className="size-4" />
        {signing ? "Signature en cours…" : "Signer le contrat"}
      </Button>
    </section>
  );
}

// --- Signature block (after signed) --------------------------------------
function SignatureBlock({ signatures }: { signatures: Signature[] }) {
  if (!signatures.length) return null;
  const sig = signatures[0];
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <CheckCircle className="size-4 text-emerald-600" />
        Contrat signé
      </h2>
      <div className="rounded-lg border bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Signé par
            </div>
            <div className="font-serif italic text-2xl text-foreground">
              {sig.signatureData || sig.signedBy}
            </div>
            <div className="text-sm text-muted-foreground">
              {sig.signedBy} · {sig.signedByEmail}
            </div>
          </div>
          <div className="text-sm text-muted-foreground sm:text-right">
            <Calendar className="inline size-3.5 mr-1" />
            {formatDate(sig.signedAt, true)}
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Helpers --------------------------------------------------------------

function PortalShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="mt-auto border-t bg-background/80 backdrop-blur py-4 px-4 text-center text-xs text-muted-foreground">
        {footer}
      </footer>
    </div>
  );
}

function OrgAvatar({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="size-10 rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="size-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
      {initials(name) || "CF"}
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Card>
        <CardContent className="px-5 sm:px-8 py-6 sm:py-8 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-px w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorCard() {
  return (
    <div className="max-w-md mx-auto w-full px-4 py-20">
      <Card className="border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40">
        <CardContent className="px-6 py-10 text-center space-y-4">
          <div className="mx-auto size-14 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
            <AlertTriangle className="size-7 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Lien invalide ou expiré</h2>
            <p className="text-sm text-muted-foreground">
              Ce contrat n'est plus accessible ou le lien est incorrect.
              Contactez votre prestataire pour obtenir un nouveau lien.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SuccessCard({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="max-w-md mx-auto w-full px-4 py-20">
      <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40">
        <CardContent className="px-6 py-10 text-center space-y-4">
          <div className="mx-auto flex items-center justify-center">
            {icon}
          </div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function KeyFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold truncate">{value}</div>
    </div>
  );
}

function StatusBanner({
  contract,
  signatures,
}: {
  contract: Contract;
  signatures: Signature[];
}) {
  const status = contract.status;
  let cls = "bg-muted/40 border-border text-foreground";
  let icon = <FileText className="size-4" />;
  let text = "En attente de signature";

  if (status === "SIGNED" || signatures.length > 0) {
    cls =
      "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-300";
    icon = <CheckCircle className="size-4" />;
    text = `Contrat signé le ${formatDate(signatures[0]?.signedAt ?? contract.signedAt)}${
      signatures[0]?.signedBy ? ` par ${signatures[0].signedBy}` : ""
    }`;
  } else if (status === "EXPIRED") {
    cls =
      "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300";
    icon = <AlertTriangle className="size-4" />;
    text = "Contrat expiré";
  } else if (status === "CANCELED") {
    cls =
      "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-300";
    icon = <AlertTriangle className="size-4" />;
    text = "Contrat annulé";
  } else if (status === "DRAFT") {
    cls = "bg-muted/40 border-border text-muted-foreground";
    text = "Brouillon — non envoyé";
  }

  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium ${cls}`}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}

function statusBadgeClass(status: string) {
  const ref: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground border-border",
    SENT:
      "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/40",
    VIEWED:
      "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/40",
    SIGNED:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40",
    EXPIRED:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40",
    CANCELED:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40",
  };
  return ref[status] ?? "bg-muted text-muted-foreground border-border";
}

// --- Minimal markdown-ish renderer -------------------------------------
function renderMarkdownish(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("### ")) {
      return (
        <h3 key={i} className="text-base font-semibold mt-4 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2 key={i} className="text-lg font-semibold mt-5 mb-1">
          {renderInline(line.slice(3))}
        </h2>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h1 key={i} className="text-xl font-bold mt-6 mb-2">
          {renderInline(line.slice(2))}
        </h1>
      );
    }
    if (line.trim() === "") {
      return <div key={i} className="h-2.5" aria-hidden />;
    }
    return (
      <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
        {renderInline(line)}
      </p>
    );
  });
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
