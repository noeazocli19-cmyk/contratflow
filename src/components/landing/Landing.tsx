"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Users,
  FileText,
  PenTool,
  FolderKanban,
  Receipt,
  CreditCard,
  Sparkles,
  Shield,
  Zap,
  Globe,
  TrendingUp,
  Clock,
  Bell,
  UserPlus,
  LayoutDashboard,
  Star,
  Quote,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const FLOW = [
  { icon: UserPlus, label: "Prospect", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40" },
  { icon: Users, label: "Client", color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40" },
  { icon: FileText, label: "Proposition", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  { icon: PenTool, label: "Contrat", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  { icon: FolderKanban, label: "Projet", color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
  { icon: Receipt, label: "Facture", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40" },
  { icon: CreditCard, label: "Paiement", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
];

const FEATURES = [
  { icon: Users, title: "CRM intégré", description: "Suivez vos prospects, convertissez-les en clients, ne perdez aucune opportunité.", color: "text-cyan-600" },
  { icon: FileText, title: "Propositions professionnelles", description: "Créez des propositions structurées, envoyez un lien sécurisé, suivez les consultations.", color: "text-amber-600" },
  { icon: PenTool, title: "Contrats & signature électronique", description: "Modèles réutilisables, variables dynamiques, signature en ligne 100 % légale.", color: "text-emerald-600" },
  { icon: FolderKanban, title: "Projets Kanban", description: "Suivez vos livrables avec un tableau Kanban drag-and-drop, par projet et par client.", color: "text-rose-600" },
  { icon: Receipt, title: "Facturation automatique", description: "Générez factures d'acompte, factures finales, échéanciers. Calculs automatiques.", color: "text-cyan-600" },
  { icon: CreditCard, title: "Suivi des paiements", description: "Encaissez par Mobile Money, virement, espèces. Relances automatiques.", color: "text-emerald-600" },
  { icon: Bell, title: "Notifications intelligentes", description: "Proposition consultée, contrat signé, paiement reçu, facture en retard — soyez alerté.", color: "text-violet-600" },
  { icon: TrendingUp, title: "Rapports & finances", description: "Chiffre d'affaires, encaissements, impayés, taux d'acceptation, top clients.", color: "text-amber-600" },
  { icon: Shield, title: "Sécurité & multi-tenant", description: "Vos données isolées par organisation. Liens publics tokenisés. Aucun partage entre comptes.", color: "text-emerald-600" },
];

const PLANS = [
  {
    name: "Free",
    price: "0",
    period: "/ mois",
    description: "Pour démarrer",
    features: [
      "Jusqu'à 3 clients",
      "5 propositions / mois",
      "3 contrats actifs",
      "1 utilisateur",
      "Portails clients sécurisés",
    ],
    cta: "Commencer gratuitement",
    highlight: false,
  },
  {
    name: "Pro",
    price: "12 000",
    period: " F CFA / mois",
    description: "Pour les freelances actifs",
    features: [
      "Clients illimités",
      "Propositions & contrats illimités",
      "Projets & Kanban",
      "Factures & paiements illimités",
      "Modèles réutilisables",
      "Relances automatiques",
      "1 utilisateur",
    ],
    cta: "Essayer 14 jours",
    highlight: true,
    badge: "Le plus populaire",
  },
  {
    name: "Agency",
    price: "29 000",
    period: " F CFA / mois",
    description: "Pour les petites agences",
    features: [
      "Tout Pro, et en plus :",
      "Jusqu'à 5 membres d'équipe",
      "Permissions par rôle",
      "Stockage documents 10 Go",
      "Rapports avancés & export PDF",
      "Support prioritaire",
    ],
    cta: "Demander une démo",
    highlight: false,
  },
];

const TESTIMONIALS = [
  { name: "Awa D.", role: "Designer freelance, Dakar", text: "Avant j'utilisais 4 outils différents. Maintenant je gère tout depuis ContractFlow. Mes clients adorent pouvoir signer en un clic.", initials: "AD" },
  { name: "Koffi A.", role: "Développeur, Cotonou", text: "Le parcours Prospect → Paiement est fluide. La signature électronique crée automatiquement le projet et l'acompte. Un gain de temps énorme.", initials: "KA" },
  { name: "Carla M.", role: "Agence marketing, Abidjan", text: "Enfin un outil pensé pour l'Afrique de l'Ouest : Mobile Money, FCFA, relances automatiques. Mon équipe a tout centralisé.", initials: "CM" },
];

const STATS = [
  { value: "47", label: "pays ciblés" },
  { value: "12 min", label: "du prospect au paiement" },
  { value: "100 %", label: "sécurisé & multi-tenant" },
  { value: "FCFA", label: "native dès le départ" },
];

export default function Landing({ onShowLogin, onShowRegister }: { onShowLogin: () => void; onShowRegister: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">CF</div>
            <div className="font-semibold text-lg tracking-tight">ContractFlow</div>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Fonctionnalités</a>
            <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Tarifs</a>
            <a href="#temoignages" className="hover:text-foreground transition-colors">Témoignages</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onShowLogin} className="hidden sm:inline-flex">Se connecter</Button>
            <Button size="sm" onClick={onShowRegister} className="gap-1.5">Essayer gratuit <ArrowRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50/60 via-amber-50/30 to-background dark:from-emerald-950/20 dark:via-amber-950/10" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_30rem_at_top,theme(colors.emerald.200/30),transparent)] dark:bg-[radial-gradient(45rem_30rem_at_top,theme(colors.emerald.900/20),transparent)]" />
        <div className="container mx-auto max-w-7xl px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 gap-1.5 px-3 py-1 rounded-full bg-background/70 backdrop-blur border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" /> SaaS pour freelances & petites agences
            </Badge>
            <h1 className="text-balance text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              De la proposition<br />
              <span className="bg-gradient-to-r from-emerald-600 via-amber-600 to-rose-600 bg-clip-text text-transparent">au paiement</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground text-balance leading-relaxed">
              Centralisez tout votre cycle commercial dans un seul outil pensé pour l'Afrique de l'Ouest.
              Envoyez. Faites signer. Facturez. Encaissez.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={onShowRegister} className="gap-2 text-base h-12 px-7 shadow-md">Démarrer gratuitement <ArrowRight className="h-4 w-4" /></Button>
              <Button size="lg" variant="outline" onClick={onShowLogin} className="gap-2 text-base h-12 px-7">Voir la démo</Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Sans carte bancaire · 14 jours d'essai · Annulez à tout moment
            </p>
          </div>
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label} className="text-center rounded-xl border bg-card/50 backdrop-blur p-4">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-amber-600 bg-clip-text text-transparent">{s.value}</div>
                <div className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="py-20 sm:py-24 border-b bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <Badge variant="secondary" className="mb-3 gap-1.5"><Zap className="h-3.5 w-3.5" /> Workflow automatisé</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Un seul parcours, du prospect au paiement</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              ContractFlow fait circuler les informations automatiquement entre les modules. Aucune ressaisie. Aucune perte.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
            {FLOW.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="relative">
                  <Card className="p-4 text-center hover:shadow-md transition-shadow border-border/60">
                    <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${step.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-medium">{step.label}</div>
                  </Card>
                  {i < FLOW.length - 1 && (
                    <ChevronRight className="hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
            <Card className="p-5 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-500 mb-2"><PenTool className="h-4 w-4" /><span className="text-sm font-semibold">Contrat signé</span></div>
              <p className="text-sm text-muted-foreground leading-relaxed">ContractFlow crée automatiquement le projet, l'échéancier et la facture d'acompte. Vous êtes notifié instantanément.</p>
            </Card>
            <Card className="p-5 border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 mb-2"><CreditCard className="h-4 w-4" /><span className="text-sm font-semibold">Paiement reçu</span></div>
              <p className="text-sm text-muted-foreground leading-relaxed">La facture passe à « payée », l'échéance est soldée, un reçu est émis. Le dashboard financier se met à jour tout seul.</p>
            </Card>
            <Card className="p-5 border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/10">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-500 mb-2"><Clock className="h-4 w-4" /><span className="text-sm font-semibold">Facture en retard</span></div>
              <p className="text-sm text-muted-foreground leading-relaxed">Le statut change automatiquement, une notification vous alerte, une relance peut être programmée.</p>
            </Card>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 sm:py-24 border-b">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <Badge variant="secondary" className="mb-3 gap-1.5"><LayoutDashboard className="h-3.5 w-3.5" /> Tout-en-un</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Remplacez 5 outils par un seul</h2>
            <p className="mt-4 text-muted-foreground text-lg">CRM, propositions, contrats, projet, facturation — dans une seule expérience cohérente.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="p-6 hover:shadow-lg hover:border-foreground/20 transition-all duration-300 group">
                  <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/5 ${f.color} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* PORTAL PREVIEW */}
      <section className="py-20 sm:py-24 border-b bg-gradient-to-b from-muted/40 to-background">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-3 gap-1.5"><Globe className="h-3.5 w-3.5" /> Portail client</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Vos clients valident sans créer de compte</h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Un lien sécurisé, et votre client consulte, accepte, signe et paie depuis son téléphone. Tout est tracé automatiquement dans votre ContractFlow.
              </p>
              <ul className="space-y-3">
                {[
                  "Proposition : consultation, acceptation, refus tracés",
                  "Contrat : signature électronique avec IP, date, identité",
                  "Facture : paiement par Mobile Money, virement, carte, espèces",
                  "Aucune inscription requise côté client",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Card className="p-6 sm:p-8 shadow-xl border-2 border-emerald-200 dark:border-emerald-900/50">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">SN</div>
                  <div>
                    <div className="text-sm font-semibold">Studio Nova</div>
                    <div className="text-[11px] text-muted-foreground">Contrat CONTRAT-2026-002</div>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">En attente</Badge>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 mb-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Contrat</div>
                <div className="font-semibold mb-2">Boutique en ligne Kora Fashion</div>
                <div className="text-2xl font-bold text-emerald-600">1 200 000 F CFA</div>
                <div className="text-xs text-muted-foreground mt-1">3 semaines · 50% à la signature · 50% à la livraison</div>
              </div>
              <div className="space-y-2">
                <Button className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white"><PenTool className="h-4 w-4 mr-2" /> Signer le contrat</Button>
                <Button variant="outline" className="w-full h-11">Télécharger PDF</Button>
              </div>
              <Separator className="my-4" />
              <div className="text-[11px] text-muted-foreground text-center">Lien sécurisé envoyé par Studio Nova · ContractFlow</div>
            </Card>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 sm:py-24 border-b">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <Badge variant="secondary" className="mb-3 gap-1.5"><Star className="h-3.5 w-3.5" /> Tarifs transparents</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Un prix pensé pour les indépendants</h2>
            <p className="mt-4 text-muted-foreground text-lg">Sans engagement. Annulez à tout moment. Tarifs en FCFA.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <Card key={plan.name} className={`relative p-6 sm:p-7 flex flex-col ${plan.highlight ? "border-emerald-300 dark:border-emerald-800 shadow-xl ring-2 ring-emerald-200 dark:ring-emerald-900/50" : ""}`}>
                {plan.badge && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white">{plan.badge}</Badge>}
                <div className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-5">{plan.description}</p>
                <Separator className="mb-5" />
                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /><span>{feat}</span></li>
                  ))}
                </ul>
                <Button variant={plan.highlight ? "default" : "outline"} className="w-full h-11" onClick={plan.name === "Free" ? onShowRegister : onShowLogin}>{plan.cta}</Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="temoignages" className="py-20 sm:py-24 border-b bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <Badge variant="secondary" className="mb-3 gap-1.5"><Quote className="h-3.5 w-3.5" /> Témoignages</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Conçu par et pour les freelances</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="p-6">
                <div className="flex gap-0.5 mb-4">{Array.from({ length: 5 }).map((_, i) => (<Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />))}</div>
                <p className="text-sm leading-relaxed mb-5 italic text-foreground/90">« {t.text} »</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 text-white text-xs font-bold">{t.initials}</div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 sm:py-24">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 p-10 sm:p-14 text-center text-white shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(30rem_15rem_at_top,rgba(255,255,255,0.15),transparent)]" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Prêt à remplacer tous vos outils ?</h2>
              <p className="text-emerald-50 text-lg mb-8 max-w-2xl mx-auto">Rejoignez les freelances et petites agences qui gèrent tout leur cycle commercial depuis ContractFlow.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" onClick={onShowRegister} className="bg-white text-emerald-700 hover:bg-emerald-50 h-12 px-7 text-base font-semibold shadow-lg">Créer mon compte gratuit <ArrowRight className="h-4 w-4 ml-1.5" /></Button>
                <Button size="lg" variant="outline" onClick={onShowLogin} className="border-white/40 text-white hover:bg-white/10 h-12 px-7 text-base">Se connecter à ma démo</Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t bg-background">
        <div className="container mx-auto max-w-7xl px-4 py-10">
          <div className="grid gap-8 md:grid-cols-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">CF</div>
                <span className="font-semibold">ContractFlow</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">De la proposition au paiement, gérez tout votre client depuis un seul endroit.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Fonctionnalités</a></li>
                <li><a href="#workflow" className="hover:text-foreground">Workflow</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Tarifs</a></li>
                <li><a href="#temoignages" className="hover:text-foreground">Témoignages</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Ressources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground">Guide du freelance</a></li>
                <li><a href="#" className="hover:text-foreground">Modèles de contrats</a></li>
                <li><a href="#" className="hover:text-foreground">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Société</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">À propos</a></li>
                <li><a href="#" className="hover:text-foreground">Mentions légales</a></li>
                <li><a href="#" className="hover:text-foreground">Confidentialité</a></li>
                <li><a href="#" className="hover:text-foreground">CGV</a></li>
              </ul>
            </div>
          </div>
          <Separator className="mb-6" />
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-muted-foreground">
            <div>© {new Date().getFullYear()} ContractFlow. Tous droits réservés.</div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3 text-emerald-600" /> Multi-tenant sécurisé</Badge>
              <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3 text-emerald-600" /> Afrique de l'Ouest</Badge>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
