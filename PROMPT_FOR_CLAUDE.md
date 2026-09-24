# Prompt pour Claude — Intégration SaasPay + Finalisation ContractFlow

> **Copie-colle l'intégralité de ce fichier** dans une nouvelle conversation Claude pour finaliser ContractFlow.
> Ce prompt contient le contexte complet du projet, ce qui est fait, et ce qu'il reste à intégrer.

---

## CONTEXTE — Contrat de handoff

Je travaille sur **ContractFlow**, un SaaS multi-tenant (Next.js 16 + Prisma) qui permet aux freelances et petites agences de gérer tout leur cycle commercial : Prospect → Client → Proposition → Devis → Contrat → Signature → Projet → Facture → Paiement.

Le code est **déjà écrit à 95 %** (auth Better Auth, multi-tenant, prospects, clients, propositions, devis, contrats + signature électronique, projets Kanban, factures, paiements, documents, notifications, rapports, modèles, relances, équipe/rôles, journal d'audit, portails publics client/proposition/devis/contrat/facture, page d'accueil marketing, etc.).

### Stack technique (NON NÉGOCIABLE)

- **Framework** : Next.js 16 (App Router) + TypeScript 5
- **DB** : **Neon** (Postgres serverless) via **Prisma 6**
- **Package manager** : **pnpm** (pas bun, pas npm)
- **Auth** : **Better Auth** (`better-auth` package) — config dans `src/lib/auth.ts`, route catch-all `/api/auth/[...all]/route.ts`
- **Paiement** : **SaasPay** (à intégrer — voir ci-dessous)
- **UI** : Tailwind 4 + shadcn/ui + Lucide
- **State** : Zustand (client) + TanStack Query-ready

### Ce qui marche déjà

- **Better Auth** installé et configuré (`src/lib/auth.ts`) avec :
  - Prisma adapter (postgresql)
  - Email/password + password reset + change password
  - Sessions en DB (cookies httpOnly + secure + SameSite=Strict en prod)
  - Champs additionnels user (role, organizationId, onboardingStep, phone, avatarUrl)
  - Hooks pour social (Google/GitHub) — à activer avec client ID/secret
  - Hooks pour email verification (à activer une fois l'envoi d'emails configuré)
- Route catch-all Better Auth : `/api/auth/[...all]/route.ts` (expose /sign-in/email, /sign-up/email, /sign-out, /get-session, /forget-password, /reset-password, /change-password, etc.)
- **Wrappers legacy** qui gardent les endpoints existants fonctionnels :
  - POST /api/auth/login → wrap signInEmail
  - POST /api/auth/register → wrap signUpEmail + création Organization + Subscription
  - GET /api/auth/me → renvoie user + organization
  - POST /api/auth/logout → wrap signOut
  - POST /api/auth/forgot-password → wrap forgetPassword (avec devToken en dev)
  - POST /api/auth/reset-password → wrap resetPassword
  - POST /api/auth/change-password → wrap changePassword
- Toutes les routes API sous `src/app/api/` (CRUD complet sur tous les modules)
- Multi-tenant (chaque org est isolée par `organizationId`)
- Workflows automatisés : signature contrat → projet + acompte + échéancier créés ; paiement reçu → statut facture + notification
- Portails publics tokenisés (proposition, devis, contrat, facture, client unifié)
- Journal d'audit (toutes les actions sensibles sont tracées)
- Rate limiting middleware (`src/middleware.ts`)
- Security headers (CSP, HSTS, X-Frame-Options)
- Validation de la force des mots de passe
- Limites d'abonnement (FREE/PRO/AGENCY avec vérification 402)
- Page d'accueil marketing + page de pricing
- **Modèles Prisma pour Better Auth** : User, Account, Session, Verification (+ 31 modèles métier)

---

## CE QUE JE VEUX QUE TU FAISES

### TÂCHE 1 — Migrer la base de données vers Neon

Le fichier `prisma/schema.prisma` est déjà configuré pour Postgres + Neon avec `directUrl` :

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Étapes à faire :
1. Crée un projet sur https://console.neon.tech
2. Copie les **deux** URLs de connexion (pooled + direct) dans `.env` :
   - `DATABASE_URL` = "Pooled connection string" (avec `?sslmode=require&pgbouncer=true`)
   - `DIRECT_URL` = "Direct connection string" (avec `?sslmode=require`)
3. Configure **Better Auth** :
   - `BETTER_AUTH_SECRET` : génère avec `openssl rand -base64 32`
   - `BETTER_AUTH_URL` : ton URL publique (en prod : `https://app.tondomaine.com`)
   - `JWT_SECRET` : même valeur que `BETTER_AUTH_SECRET` (backward compat)
4. Génère le client Prisma + pousse le schéma :
   ```bash
   pnpm install
   pnpm prisma generate
   pnpm prisma db push   # créera toutes les tables sur Neon (35 modèles)
   ```
5. Lance le seed pour avoir des données de démo :
   ```bash
   pnpm db:seed   # = tsx prisma/seed.ts — crée l'org "Studio Nova", 4 clients, 6 prospects, etc.
   ```
   Le seed crée maintenant le User **ET** l'Account credential Better Auth (le user peut se connecter via `demo@contractflow.app` / `demodemo`).
6. Vérifie que `pnpm dev` démarre et que l'app fonctionne.

### TÂCHE 2 — Intégrer SaasPay (PRIORITÉ MAXIMALE)

#### Le besoin
Je veux que mes utilisateurs paient un **abonnement mensuel de 2000 FCFA** pour accéder au plan PRO. Le paiement se fait via **SaasPay** (passerelle de paiement africaine — Mobile Money + carte).

#### Ce qui est déjà en place

**1. Modèle de données** (`prisma/schema.prisma`) :
```prisma
model SaaSPayOrder {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(...)
  amount          Float                  // 2000
  currency        String   @default("XOF")
  reference       String   @unique       // ex: CF-1234567890-ABC123
  status          String   @default("PENDING") // PENDING | PAID | FAILED | CANCELED | REFUNDED
  checkoutUrl     String?                // URL de checkout hébergée SaasPay
  customerEmail   String?
  customerPhone   String?
  paidAt          DateTime?
  rawPayload      String?  // JSON: payload complet du webhook (audit)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**2. Module d'intégration** (`src/lib/saaspay.ts`) — contient déjà :
- `createCheckout(input)` → crée une commande en DB + (stub) génère une URL de checkout
- `getOrderStatus(reference)` → (stub) renvoie le statut depuis la DB
- `verifyWebhookSignature(payload, signature)` → (stub) accepte tout en dev
- `markOrderPaid(reference, payload)` → marque la commande payée + active l'abonnement (PRO/AGENCY) + définit `renewsAt`

**3. Routes API** déjà créées :
- `POST /api/saaspay/checkout` — auth requise, body `{ plan: 'PRO' | 'AGENCY' }` → renvoie `{ reference, checkoutUrl, amount, currency }`
- `GET /api/saaspay/return?ref=XXX&status=success|cancel` — redirect après paiement
- `POST /api/saaspay/webhook` — public, vérifie signature, marque payé
- `GET /api/saaspay/status?ref=XXX` — auth requise, pour polling frontend

**4. Variables d'environnement** (voir `.env.example`) :
```
SAASPAY_API_KEY="sk_test_xxxxxxxxxxxxxxxxxxxx"
SAASPAY_SECRET_KEY="sk_secret_xxxxxxxxxxxxxxxxxxxx"
SAASPAY_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxx"
SAASPAY_API_BASE="https://api.saaspay.com/v1"
SAASPAY_CHECKOUT_BASE="https://checkout.saaspay.com"
SAASPAY_MERCHANT_ID="merchant_xxxxxxxxxxxxxxxx"
SAAS_PLAN_PRICE_FCFA=2000
SAAS_PLAN_CURRENCY=XOF
SAAS_PLAN_INTERVAL=MONTHLY
```

#### Ce que tu dois faire — intégration réelle

**IMPORTANT** : Je n'ai pas encore la documentation officielle de SaasPay. Quand tu auras accès à leur API (https://saaspay.com/docs ou via leur support), remplace les **stubs** dans `src/lib/saaspay.ts` par les **vrais appels HTTP**.

Plus précisément, remplace ces 3 fonctions :

```ts
// 1. createCheckout — remplace le stub par un vrai fetch POST /checkout
export async function createCheckout(input: SaasPayCheckoutInput): Promise<SaasPayCheckoutResult> {
  // ...envoie la requête à ${API_BASE}/checkout avec Authorization: Bearer ${API_KEY}
  // ...récupère checkout_url dans la réponse
  // ...persiste la commande en DB (déjà fait dans le code existant)
}

// 2. getOrderStatus — remplace le stub par un vrai fetch GET /orders/:reference
export async function getOrderStatus(reference: string): Promise<SaasPayOrderStatus> {
  // ...appelle ${API_BASE}/orders/${reference}
  // ...mappe le statut SaasPay → notre enum (PAID/FAILED/CANCELED/...)
}

// 3. verifyWebhookSignature — remplace le stub par le vrai schéma HMAC de SaasPay
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  // ...calcule HMAC-SHA256(payload, WEBHOOK_SECRET)
  // ...comparation à temps constant
}
```

**Convention d'API attendue** (à valider avec SaasPay) :
- POST `/checkout` → body `{ reference, amount, currency, customer_email, customer_phone, success_url, cancel_url, webhook_url, metadata }` → réponse `{ checkout_url, id }`
- GET `/orders/:reference` → `{ status: 'success'|'failed'|'canceled'|'pending', amount, currency, paid_at }`
- POST `/webhook` (reçu par nous) → headers `X-SaaSPay-Signature: <hmac>`, body JSON contenant `{ reference, status, ... }`

**Si le schéma d'API SaasPay est différent**, adapte `src/lib/saaspay.ts` + `src/app/api/saaspay/webhook/route.ts` en conséquence. Le but est de garder l'interface publique (`createCheckout`, `getOrderStatus`, `markOrderPaid`) stable pour ne pas casser le reste de l'app.

#### Frontend — bouton "Passer à Pro"

Ajoute dans `src/components/app/Settings.tsx` (onglet "Abonnement") :
- Un bouton "Payer 2000 FCFA / mois" qui appelle `POST /api/saaspay/checkout { plan: 'PRO' }`
- Au retour, redirige vers `checkoutUrl` (SaaSPay hébergé)
- Après paiement, l'utilisateur revient sur `/api/saaspay/return` qui active l'abonnement
- Affiche un statut "Paiement en cours..." avec polling sur `/api/saaspay/status`
- Toast de succès quand l'abonnement est actif

#### Webhook — configuration SaasPay

Dans le dashboard SaasPay, configure le webhook URL :
```
https://ton-domaine.com/api/saaspay/webhook
```
Et note le `WEBHOOK_SECRET` qu'ils te donnent, à mettre dans `.env`.

### TÂCHE 3 — Sécuriser l'espace admin (encore plus)

Ce qui est déjà fait :
- ✅ **Better Auth** gère les sessions (cookies httpOnly + secure + SameSite=Strict en prod)
- ✅ Rate limiting sur auth + saaspay + ai + waitlist (`src/middleware.ts`)
- ✅ Security headers (CSP, X-Frame-Options DENY, HSTS en prod, Permissions-Policy, Referrer-Policy)
- ✅ bcrypt cost factor 12 (côté Better Auth via le password hasher)
- ✅ Password strength validator (8+ chars + casse + chiffre + spécial)
- ✅ Permissions par rôle (OWNER/ADMIN/MEMBER) avec helper `can()` + `assertCan()`
- ✅ Journal d'audit (toutes les actions sensibles tracées)
- ✅ Multi-tenant strict (chaque query filtre par `organizationId`)

Ce que tu peux ajouter :
1. **2FA / TOTP** pour les OWNERs — Better Auth a un plugin `twoFactor` (`better-auth/plugins`)
   - Active le plugin dans `src/lib/auth.ts`
   - Ajoute le setup QR code dans Settings → Sécurité
2. **OAuth social** — dé-commente `google.enabled = true` / `github.enabled = true` dans `src/lib/auth.ts` après avoir ajouté les client ID/secret dans `.env`
3. **Email verification** — active `emailVerification.enabled = true` dans `src/lib/auth.ts` après avoir branché un transport email (Resend recommandé)
4. **Suspicious activity detection** : si > 5 logins échoués depuis une IP → blocage 1h + notification (Better Auth a `rateLimit` option)
5. **Session versioning** — ajoute `user.sessionVersion` et compare avec le JWT (permet de révoquer toutes les sessions d'un user)
6. **Logging structuré** (Pino) pour les erreurs 5xx + envoi Sentry en prod

### TÂCHE 4 — Rendre le SaaS "intéressant"

Des features déjà préparées dans le schéma mais pas encore câblées en UI :

1. **Générateur de propositions par IA** — `POST /api/ai/proposal` (déjà créé, utilise `z-ai-web-dev-sdk`)
   - Ajoute un bouton "Générer avec l'IA" dans le dialog de création de proposition
   - L'utilisateur saisit un brief + budget + délai → l'IA propose titre, problème, solution, livrables, montant

2. **Programme de parrainage** — `GET/POST /api/referral` (déjà créé)
   - Chaque user a un code de parrainage `?ref=CODE`
   - 20 % de commission sur le 1er paiement du filleul
   - Affiche sur la landing page + dans le dashboard

3. **Liste d'attente** — `POST /api/waitlist` (déjà créé)
   - Formulaire d'inscription sur la landing page
   - Affiche le compteur "X personnes sur la liste d'attente"

4. **Factures récurrentes** — `GET/POST /api/recurring-invoices` (déjà créé)
   - Pour les freelances qui facturent mensuellement (retainer, maintenance)
   - Cron quotidien qui génère les factures quand `nextRunAt <= now`

5. **Gamification** — `Streak` model déjà en place
   - Compte les jours consécutifs d'activité
   - Badges pour 7j / 30j / 100j
   - Affiche dans le dashboard

6. **Export PDF réel** — actuellement `window.print()` ; pour un vrai PDF :
   - Installe `@react-pdf/renderer` ou `pdf-lib`
   - Crée `src/app/api/invoices/:id/pdf/route.ts` qui génère un PDF serveur
   - Idem pour proposals/contracts/reports

### TÂCHE 5 — Déploiement production

- **Vercel** : connecte le repo, set les env vars (DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, SAASPAY_*), déploiement auto
- **Domaine** : configure ton domaine dans Vercel, mets à jour `NEXT_PUBLIC_APP_URL` et `BETTER_AUTH_URL`
- **SaasPay webhook** : mets à jour l'URL du webhook avec le domaine de prod
- **Cron jobs** (Vercel cron) :
  - `0 8 * * *` → `POST /api/cron/reminder-check` (envoie les relances du jour)
  - `0 9 * * *` → `POST /api/cron/recurring-invoices` (génère les factures récurrentes)
  - `0 10 * * *` → `POST /api/cron/streak-update` (met à jour les streaks)

---

## STRUCTURE DU PROJET (fais `tree -L 3 -I 'node_modules|.next|.git'` pour voir)

```
contractflow/
├── .env.example                      ← Variables d'env à copier (Neon + Better Auth + SaasPay)
├── .env                              ← À remplir
├── CONTRACT.md                       ← Contrat de build détaillé
├── PROMPT_FOR_CLAUDE.md              ← CE FICHIER
├── worklog.md                        ← Journal de construction complet
├── package.json                      ← pnpm scripts (dev, build, db:push, db:seed)
├── prisma/
│   ├── schema.prisma                 ← 35 modèles (Postgres + Neon + Better Auth)
│   └── seed.ts                       ← Données de démo (crée User + Account Better Auth)
├── src/
│   ├── middleware.ts                 ← Rate limiting + security headers
│   ├── app/
│   │   ├── page.tsx                  ← Route unique (SPA + portails publics)
│   │   ├── layout.tsx                ← Root layout
│   │   ├── globals.css               ← Tailwind 4 + print CSS
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...all]/route.ts ← Better Auth catch-all (sign-up, sign-in, etc.)
│   │       │   ├── login/route.ts   ← wrapper legacy
│   │       │   ├── register/route.ts
│   │       │   ├── me/route.ts
│   │       │   ├── logout/route.ts
│   │       │   ├── forgot-password/route.ts
│   │       │   ├── reset-password/route.ts
│   │       │   └── change-password/route.ts
│   │       ├── onboarding/
│   │       ├── organization/
│   │       ├── settings/
│   │       ├── dashboard/
│   │       ├── search/
│   │       ├── reports/
│   │       ├── notifications/
│   │       ├── prospects/, clients/, proposals/, quotes/, contracts/
│   │       ├── templates (contract/proposal/quote/invoice/email)
│   │       ├── reminders/, projects/, invoices/, payments/, documents/
│   │       ├── members/, invitations/, audit/, subscription/
│   │       ├── saaspay/              ← checkout, return, webhook, status ← À REMPLIR
│   │       ├── ai/proposal/          ← Générateur IA
│   │       ├── waitlist/, referral/, recurring-invoices/
│   │       └── public/               ← Portails clients (sans auth)
│   │           ├── proposal/[token]/
│   │           ├── quote/[token]/
│   │           ├── contract/[token]/
│   │           ├── invoice/[token]/
│   │           └── client/[token]/
│   ├── components/
│   │   ├── ui/                       ← shadcn/ui (48 composants)
│   │   ├── auth/                     ← Login, Register (utilisent Better Auth via wrappers)
│   │   ├── landing/                  ← Landing page marketing
│   │   ├── portal/                   ← 5 portails publics
│   │   ├── shared/                   ← PrintButton
│   │   └── app/                      ← Shell + 22 vues métier
│   ├── lib/
│   │   ├── auth.ts                   ← Better Auth config + helpers legacy (getCurrentUser, checkPasswordStrength)
│   │   ├── saaspay.ts                ← INTÉGRATION À COMPLÉTER
│   │   ├── plans.ts                  ← Plans FREE/PRO(2000)/AGENCY
│   │   ├── permissions.ts            ← can(role, perm)
│   │   ├── server.ts                 ← Helpers backend (ok, err, audit, notify, getCtx via Better Auth)
│   │   ├── api.ts, db.ts, store.ts, types.ts, format.ts
│   └── hooks/                        (use-mobile, use-toast)
├── worklog.md                        ← Journal de construction
├── CONTRACT.md                       ← Contrat de build détaillé
└── PROMPT_FOR_CLAUDE.md              ← CE FICHIER
```

---

## DEMANDE FINALE À CLAUDE

1. **Avant tout**, lis `/home/z/my-project/CONTRACT.md` et `/home/z/my-project/worklog.md` pour comprendre ce qui a été fait.
2. **Configure Neon** (Tâche 1) — c'est bloquant pour tout le reste.
3. **Intègre SaasPay** (Tâche 2) — c'est la priorité #1. Demande-moi de te donner la documentation SaasPay si tu n'as pas accès à leur API. En attendant, le stub fonctionne en mode dev (checkout fake, webhook accepte tout).
4. **Renforce la sécurité admin** (Tâche 3) — au moins 2FA via Better Auth plugin + session versioning.
5. **Câble les features "intéressantes"** (Tâche 4) — en particulier l'IA proposal generator (un bouton dans le dialog de création de proposition).
6. **Déploie en production** (Tâche 5) — Vercel + cron jobs.

**Important** :
- Ne change pas la stack (Next.js 16 + Prisma + Neon + pnpm + shadcn/ui + Better Auth)
- Ne réécris pas les modules qui marchent déjà (Better Auth est déjà en place — utilise-le, ne reviens pas à un JWT custom)
- Utilise `pnpm` pour toutes les commandes
- Garde le code en TypeScript strict
- Tous les texts UI en français
- Couleurs : PAS d'indigo/bleu (utilise emerald, amber, rose, cyan, violet, neutral)

Donne-moi à la fin :
- Le nombre de lignes modifiées
- La liste des nouveaux fichiers créés
- Les env vars à ajouter/modifier
- Les commandes à lancer pour déployer
