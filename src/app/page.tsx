"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import Shell from "@/components/app/Shell";
import Login from "@/components/auth/Login";
import Register from "@/components/auth/Register";
import Onboarding from "@/components/app/Onboarding";

import Dashboard from "@/components/app/Dashboard";
import Prospects from "@/components/app/Prospects";
import Clients from "@/components/app/Clients";
import ClientDetail from "@/components/app/ClientDetail";
import Proposals from "@/components/app/Proposals";
import ProposalDetail from "@/components/app/ProposalDetail";
import Quotes from "@/components/app/Quotes";
import Contracts from "@/components/app/Contracts";
import ContractDetail from "@/components/app/ContractDetail";
import Projects from "@/components/app/Projects";
import ProjectDetail from "@/components/app/ProjectDetail";
import Invoices from "@/components/app/Invoices";
import InvoiceDetail from "@/components/app/InvoiceDetail";
import Payments from "@/components/app/Payments";
import Documents from "@/components/app/Documents";
import Reports from "@/components/app/Reports";
import Settings from "@/components/app/Settings";
import Notifications from "@/components/app/Notifications";
import Templates from "@/components/app/Templates";
import AuditLog from "@/components/app/AuditLog";

import ProposalPortal from "@/components/portal/ProposalPortal";
import ContractPortal from "@/components/portal/ContractPortal";
import InvoicePortal from "@/components/portal/InvoicePortal";
import QuotePortal from "@/components/portal/QuotePortal";
import ClientPortal from "@/components/portal/ClientPortal";

export default function Home() {
  const {
    user,
    org,
    authLoaded,
    view,
    portal,
    refreshAuth,
    setPortal,
  } = useStore();

  // Detect portal via query on first load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const kind = url.searchParams.get("portal");
    const token = url.searchParams.get("token");
    if (kind && token) {
      setPortal({
        kind: kind as
          | "proposal"
          | "contract"
          | "invoice"
          | "quote"
          | "client",
        token,
      });
    }
    void refreshAuth();
  }, [refreshAuth, setPortal]);

  // Refresh auth if cookie changes (e.g., after login)
  useEffect(() => {
    if (!authLoaded) void refreshAuth();
  }, [authLoaded, refreshAuth]);

  // 1. Public portal (no auth required)
  if (portal) {
    if (portal.kind === "proposal") return <ProposalPortal token={portal.token} />;
    if (portal.kind === "contract") return <ContractPortal token={portal.token} />;
    if (portal.kind === "invoice") return <InvoicePortal token={portal.token} />;
    if (portal.kind === "quote") return <QuotePortal token={portal.token} />;
    if (portal.kind === "client") return <ClientPortal token={portal.token} />;
  }

  // 2. Loading auth
  if (!authLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold animate-pulse">
            CF
          </div>
          <div className="text-sm text-muted-foreground">Chargement de ContractFlow…</div>
        </div>
      </div>
    );
  }

  // 3. Not authenticated → login/register
  if (!user || !org) {
    return <Login />;
  }

  // 4. Onboarding incomplete
  if (user.onboardingStep < 9) {
    return <Onboarding />;
  }

  // 5. Main app shell with current view
  return (
    <Shell>
      <div className="flex-1 p-4 sm:p-6">
        {renderView(view)}
      </div>
    </Shell>
  );
}

function renderView(view: string) {
  switch (view) {
    case "dashboard":
      return <Dashboard />;
    case "prospects":
      return <Prospects />;
    case "clients":
      return <Clients />;
    case "client-detail":
      return <ClientDetail />;
    case "proposals":
      return <Proposals />;
    case "proposal-detail":
      return <ProposalDetail />;
    case "quotes":
      return <Quotes />;
    case "contracts":
      return <Contracts />;
    case "contract-detail":
      return <ContractDetail />;
    case "projects":
      return <Projects />;
    case "project-detail":
      return <ProjectDetail />;
    case "invoices":
      return <Invoices />;
    case "invoice-detail":
      return <InvoiceDetail />;
    case "payments":
      return <Payments />;
    case "documents":
      return <Documents />;
    case "reports":
      return <Reports />;
    case "audit":
      return <AuditLog />;
    case "templates":
      return <Templates />;
    case "settings":
      return <Settings />;
    case "notifications":
      return <Notifications />;
    case "onboarding":
      return <Onboarding />;
    default:
      return <Dashboard />;
  }
}
