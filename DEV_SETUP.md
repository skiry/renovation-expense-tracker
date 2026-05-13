# DEV_SETUP — Renovation Expense Tracker

A complete, beginner-friendly walkthrough of every step taken to build this app. Follow it 1:1 to build a similar Azure Static Web App with Cosmos DB, Blob Storage, and an Azure Functions API.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Git setup](#2-git-setup)
3. [Functional requirements](#3-functional-requirements)
4. [Tech decisions](#4-tech-decisions)
5. [App scaffolding](#5-app-scaffolding)
6. [Frontend implementation](#6-frontend-implementation)
7. [Backend (Azure Functions) implementation](#7-backend-azure-functions-implementation)
8. [Running locally](#8-running-locally)
9. [Azure resource setup](#9-azure-resource-setup)
10. [Deployment](#10-deployment)
11. [PWA & offline support](#11-pwa--offline-support)
12. [Switching between mock and Azure backend](#12-switching-between-mock-and-azure-backend)
13. [Application Insights (monitoring)](#13-application-insights-monitoring)
14. [Budgets & cost alerts](#14-budgets--cost-alerts)

---

## 1. Prerequisites

Install on your dev machine:

- **Node.js 18+** (Node 20 recommended for full PWA service-worker tooling).
  Verify: `node --version`
- **npm 9+** (ships with Node).
- **Git**. Verify: `git --version`
- **GitHub CLI** (optional, makes repo creation a one-liner): https://cli.github.com/
- **Visual Studio Code** (recommended editor).
- **Azure Functions Core Tools v4** (for running the API locally):
  ```powershell
  npm install -g azure-functions-core-tools@4 --unsafe-perm true
  ```
- An **Azure account** (free tier is plenty): https://azure.microsoft.com/free/

---

## 2. Git setup

From the project root:

```bash
git init
git add .
git commit -m "Initial scaffolding"
```

Push to a new private GitHub repo:

```bash
# With GitHub CLI
gh repo create renovation-expense-tracker --private --source=. --remote=origin --push

# Without GitHub CLI — create the repo on github.com first, then:
git remote add origin https://github.com/<your-user>/renovation-expense-tracker.git
git branch -M main
git push -u origin main
```

For ongoing work use feature branches:

```bash
git checkout -b feature/<short-description>
# ...changes...
git add . && git commit -m "feat: ..."
git push -u origin feature/<short-description>
```

> 🔐 **Never commit secrets.** The root `.gitignore` already blocks `local.settings.json`, `.env*`, `node_modules`, and `dist`.

---

## 3. Functional requirements

The app helps a homeowner track renovation expenses across an entire apartment, replacing a spreadsheet that's awkward to edit on a phone.

**Core features:**

- **Multi-workspace authentication** via short access codes. The master code is set once via SWA application settings; anyone can create additional workspaces (each isolated) by picking a code of 6+ characters, validated unique.
- **Multiple named users per workspace.** After typing the code, the user picks (or creates) a named identity (e.g. "Bogdan", "Ioana"); that identity attaches to every action.
- **Audit history** — every create / update / delete on expenses, sub-expenses and photos is logged with the user's name, timestamp, and a per-field diff. The History page groups entries by day with an `Important` / `Detailed` filter.
- **Expense items** with title, estimated price (RON or EUR), priority flag, optional description, optional photos.
- **Detailed price breakdown** per item: list of sub-expenses (`name, price, currency, paid?`). Each item can be in *Estimated* mode (uses estimated price) or *Detailed* mode (sums sub-expenses). User toggles modes on the item detail page.
- **Mark as paid** — at the whole-item level *or* individually per sub-expense.
- **Dashboard** with sticky `Priority` / `Non-Priority` tabs (default Priority), per-tab Total + Spent summary, magnifier search across expense titles AND sub-expense names. The "Hide paid items" toggle only appears when there is at least one paid item in the current tab.
- **Drag & drop** ordering inside the active tab.
- **Photos** — up to 20 per item, compressed in the browser before upload, stored in Azure Blob Storage and served as time-limited SAS URLs.
- **Theme switcher** (system default / light / dark).
- **PWA**: installable on phones with full icon set; service worker provides offline-read support.
- **Romanian UI**, mobile-first responsive layout.

**Spent-calculation rules** (centralized in `web/src/utils/calculations.ts`):

- If item `isPaid === true` → contributes its display price (estimated or detailed depending on mode) to *Spent*.
- Else → contributes the sum of its sub-expenses where `isPaid === true`, **regardless of the item's display mode**.
- Display price comes from `priceMode`:
  - `estimated` → `estimatedPrice` (converted to RON).
  - `detailed` → sum of `details[]` (each converted to RON).

**Multi-user concurrency:**

- **Optimistic concurrency** with Cosmos DB ETag — PATCH requests include `If-Match`; conflicts return HTTP 412 and the client refetches.
- **Polling** every 20s on focused tab via React Query `refetchInterval`. Cosmos DB Serverless makes this essentially free.

---

## 4. Tech decisions

| Concern | Choice | Why |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Mature ecosystem, great mobile support |
| Build tool | Vite 5 | Fast HMR, simple config, native ESM |
| Styling | Tailwind CSS + shadcn/ui | Utility-first, accessible Radix primitives, easy theming |
| Routing | React Router v6 | De-facto SPA router |
| Server state | TanStack Query v5 | Caching, refetch, polling, conflict handling |
| UI state | Zustand + `persist` | Tiny, ideal for auth/theme/UI flags |
| Drag & drop | @dnd-kit | Keyboard accessible, touch-friendly |
| Image compression | browser-image-compression | Smaller blob uploads ⇒ lower storage costs |
| Toasts | sonner | Minimal, accessible |
| PWA / offline | Custom service worker | Manually written for Node 18 compatibility |
| Backend runtime | Azure Functions Node 20 + TypeScript (v4 model) | Native SWA integration |
| Database | Cosmos DB for NoSQL (Serverless) | Pay-per-request, generous limits, simple SDK |
| File storage | Azure Blob Storage (private, SAS-served) | Cheap, scalable, integrated SDK |
| Hosting | Azure Static Web Apps (Free) | Built-in GitHub Actions, managed Functions, free TLS |

---

## 5. App scaffolding

The project was created manually (rather than via `npm create vite@latest`, which requires Node 20+).

### Folder layout

```
RenovationExpenseTracker/
├── web/                       # React frontend (the SWA app)
│   ├── public/                # Static assets (icons, manifest, sw.js)
│   └── src/
│       ├── components/ui/     # shadcn-style primitives (button, card, dialog, popover, …)
│       ├── components/AppLayout.tsx
│       ├── pages/             # Login, Dashboard, ExpenseDetail, Settings, NotFound
│       ├── services/          # api.ts (MockApi + HttpApi), mockData.ts
│       ├── hooks/             # useExpenses.ts (React Query hooks)
│       ├── store/             # auth, ui, theme (Zustand stores)
│       ├── utils/             # calculations.ts
│       ├── lib/utils.ts       # cn, formatRon, slugifyTitle, …
│       ├── types.ts
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       └── vite-env.d.ts
├── api/                       # Azure Functions backend
│   └── src/
│       ├── functions/         # auth, expenses, details, photos, exchangeRate
│       ├── services/          # cosmos, blob, bnr
│       ├── middleware/auth.ts
│       └── shared/            # types, slug, responses, transformers
├── .github/workflows/         # SWA CI/CD (auto-generated)
├── staticwebapp.config.json
└── …
```

### Key dependency installs

```bash
cd web
npm install
```

```bash
cd api
npm install
```

### Tailwind setup

- `web/tailwind.config.js` — `darkMode: ['class']`, custom colors mapped to CSS variables.
- `web/postcss.config.js` — wires Tailwind + autoprefixer.
- `web/src/index.css` — `@tailwind base/components/utilities`, `:root` light vars, `.dark` overrides, and `@media (prefers-color-scheme: dark) :root.theme-system { … }` for system mode.

### shadcn/ui-style primitives

Hand-written in `web/src/components/ui/` (we skipped the shadcn CLI):
`button`, `card`, `input`, `textarea`, `label`, `switch`, `badge`, `dialog`, `separator`, `popover` (also exports `<InfoTooltip>`).

---

## 6. Frontend implementation

### State / data flow

```
Components ─► React Query hooks (useExpenses.ts) ─► api (services/api.ts)
                                                     │
                                                     ├─ MockApi  (localStorage; default for POC)
                                                     └─ HttpApi  (calls /api/* — Azure Functions)
```

Selected at runtime via `import.meta.env.VITE_USE_MOCK` (default `'true'`; set to `'false'` for the real API).

### Routing

- `/login` — public. Type the access code, or switch to "Create code" (min 6 chars).
- `/login/user` — public-after-code. Pick or create a named user for this session.
- `/` — Dashboard (requires code + user).
- `/expense/:id` — Expense detail (requires code + user).
- `/history` — Audit log (requires code + user).
- `/settings` — Settings (requires code + user).
- `*` — NotFound page.

`ProtectedRoute` checks `useAuthStore().accessCode` AND `userId`. If only the code is set, it redirects to `/login/user`. If neither is set, it redirects to `/login`. Visiting `/login` or `/login/user` while already authenticated bounces to the dashboard.

### Stores (Zustand)

We dropped the `persist` middleware and read/write `localStorage` synchronously in each store factory. This guarantees the very first React render already has the persisted values populated, preventing redirect flicker through `/login` on reload.

- `auth.ts` — `{ accessCode, userId, userName, setAccessCode, setUser, clearUser, logout }`. Keys: `reno-auth-code`, `reno-auth-user-id`, `reno-auth-user-name`.
- `ui.ts` — `{ hidePaid }` → key `reno-ui-hide-paid`.
- `theme.ts` — `{ theme: 'light'|'dark'|'system' }` → key `reno-theme`. Default `system`. `applyTheme()` sets classes on `document.documentElement`.

> ⚠️ Selectors that return an *object* would create a new reference on every render and cause infinite re-renders inside React Query mutation hooks. Always select primitives separately (`s => s.accessCode`, `s => s.userId`) and combine them locally.

### Mock storage

`MockApi` persists everything (workspaces, expenses, photos as data URLs, exchange rate) under the localStorage key `reno-mock-data-v1`. Sample data is seeded on first run from `services/mockData.ts`.

### ID generation

Expense IDs are slug-based for human-friendliness:

- `slugifyTitle("Vopsire pereți living")` → `"vopsire-pereti"` (first 2 words, lowercase, diacritics stripped).
- `uniqueSlug(base, existingIds)` adds `-2`, `-3`, … on collision.

### Calculations

All money math in `src/utils/calculations.ts`:

- `convertToRon(amount, currency, eurToRon)`
- `displayPriceRon(expense, eurToRon)` — applies the estimated/detailed mode.
- `spentForExpense(expense, eurToRon)` — applies the paid-vs-sub-expense rules.
- `computeTotals(expenses, eurToRon)` — aggregates for the dashboard.

### Images

- `<input type="file" multiple accept="image/*">` — opens the native phone gallery / camera.
- `imageCompression(file, { maxWidthOrHeight: 1920, maxSizeMB: 0.7, initialQuality: 0.8 })` shrinks each picked file before upload.
- Mock mode stores them as data URLs (capped at ~5 MB by localStorage).
- Real mode uploads to Blob via the API; the API saves the blob name and returns a 7-day read SAS URL.

### Optimistic concurrency on the client

- The API includes `_etag` on every expense response.
- The frontend includes that `_etag` in subsequent PATCHes; `HttpApi.updateExpense()` lifts it out of the payload and sets the `If-Match` header.
- A 412 response is mapped to a `ConflictError` in `services/api.ts`; mutations catch it via React Query's `onError` and emit a `toast.warning(...)` + invalidate queries to refetch.

---

## 7. Backend (Azure Functions) implementation

### Why the v4 programming model

The v4 model uses code-based function registration (`app.http(...)`) instead of per-folder `function.json` files. It's the recommended approach for new TypeScript projects.

### Folder layout

```
api/
├── host.json                  # Functions host config + extension bundle
├── package.json               # main = "dist/index.js"
├── tsconfig.json              # outDir = dist, target ES2022, module CommonJS
├── local.settings.json.example
├── .funcignore
└── src/
    ├── index.ts               # registers all functions
    ├── functions/             # auth, expenses, details, photos, exchangeRate
    ├── services/              # cosmos, blob, bnr
    ├── middleware/auth.ts
    └── shared/                # types, slug, responses, transformers
```

### Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/verify` | Verify an access code (existence + isMaster). |
| POST | `/api/auth/create` | Create a new workspace (6+ chars, unique). |
| GET | `/api/users` | List users in the workspace. |
| POST | `/api/users` | Create a new user (name 1-40 chars, unique within workspace). |
| DELETE | `/api/users/{id}` | Delete a user (their history entries keep the name snapshot). |
| GET | `/api/expenses` | List all expenses for the workspace. |
| POST | `/api/expenses` | Create a new expense (slug-based ID). |
| GET | `/api/expenses/{id}` | Get one expense (returns `_etag`). |
| PATCH | `/api/expenses/{id}` | Update an expense (sends `If-Match`). |
| DELETE | `/api/expenses/{id}` | Delete an expense + its photos. |
| POST | `/api/expenses/reorder` | Bulk reorder (not audited). |
| POST | `/api/expenses/{id}/details` | Add a sub-expense. |
| PATCH | `/api/expenses/{id}/details/{detailId}` | Update a sub-expense. |
| DELETE | `/api/expenses/{id}/details/{detailId}` | Delete a sub-expense. |
| POST | `/api/expenses/{id}/photos` | Upload a photo (multipart). |
| DELETE | `/api/expenses/{id}/photos/{photoId}` | Delete a photo (blob + Cosmos record). |
| GET | `/api/history?limit=50&before=<iso>` | Paginated audit log for the workspace. |
| GET, POST | `/api/exchange-rate` | Get cached BNR rate; POST forces refresh. |

All mutation endpoints require an additional `x-user-id` header that must match one of the workspace's users; the value is recorded into the audit log.

> ⚙️ Functions runtime can't have two registrations sharing the same route, even with different HTTP methods. Whenever we needed several methods per URL (e.g., `GET` + `PATCH` + `DELETE` on `/expenses/{id}`), we register a single handler with `methods: [...]` and dispatch by `request.method`.

### Auth middleware

`src/middleware/auth.ts → authenticate(request)` reads `x-access-code` from headers and looks up the workspace in Cosmos. If the code equals `MASTER_ACCESS_CODE` and the master workspace doesn't exist yet, it's bootstrapped on the spot (`isMaster: true`). Returns either an `AuthContext { accessCode, workspace }` or an `HttpResponseInit` for the 401 short-circuit.

### Cosmos DB client

Singleton `CosmosClient` initialized from `COSMOS_CONNECTION`. Three containers:

- `workspaces` (PK `/id`) — stores access codes + their nested `users[]` array.
- `expenses` (PK `/workspaceId`) — one document per expense, sub-expenses and photo metadata inline.
- `history` (PK `/workspaceId`) — audit log. Created lazily by the API on the first write via `containers.createIfNotExists`, so you don't need to provision it manually.

ETag-based concurrency uses:

```ts
await container.item(id, partitionKey).replace(doc, {
  accessCondition: etag ? { type: 'IfMatch', condition: etag } : undefined,
});
```

On 412, the API responds with HTTP 412 + `{ error: 'Resource was modified by another user' }`.

### Audit service

Every mutation in the API calls a helper in `services/audit.ts` after the DB update succeeds. The helper:

- Computes a per-field diff (`{ from, to }`) for `expense.update` / `detail.update`.
- Snapshots `price` + `currency` on `expense.create` / `expense.delete` / `detail.create` / `detail.delete` (so the UI can show the amount even after deletion).
- Stores the parent expense's `priceMode` at write time, enabling the front-end's `Important` filter to know whether a sub-expense price change is "meaningful" for that expense.
- Writes are fire-and-forget — a failing audit write must never block a user's primary action; it's logged via `console.warn` and the request still returns success.

### Blob client

Singleton `BlobServiceClient` initialized from `BLOB_CONNECTION` (parses out account name and key). Uploads use `uploadData(buffer, { blobHTTPHeaders: { blobContentType, blobCacheControl: 'public, max-age=31536000' } })`. Read URLs are generated as 7-day SAS via `generateBlobSASQueryParameters`. The container stays **private**; nothing is accessible without a valid SAS.

### BNR fetcher

`src/services/bnr.ts → getEurToRon()` fetches `https://www.bnr.ro/nbrfxrates.xml` (5s timeout via `AbortSignal.timeout`), regex-parses the EUR rate, and caches it in-memory for 24h. On network failure it returns the last cached value, else a hardcoded fallback (5.00 RON/EUR).

### Node 18 quirks

Cosmos SDK uses the Web Crypto API (`globalThis.crypto`). Node 18.16 doesn't expose it globally, so `src/index.ts` polyfills:

```ts
if (!globalThis.crypto) {
  globalThis.crypto = require('crypto').webcrypto;
}
```

Node 18.17+ and Node 20 don't need this; Azure Functions on SWA run Node 20 in production.

---

## 8. Running locally

### Frontend only (mock backend)

```powershell
cd web
npm install      # first time
npm run dev      # http://localhost:5173, default code: 1234
```

### Full stack (frontend + real API + Azure resources)

**Terminal 1 — API:**

```powershell
cd api
npm install
Copy-Item local.settings.json.example local.settings.json
# Edit local.settings.json: fill in COSMOS_CONNECTION, BLOB_CONNECTION, MASTER_ACCESS_CODE, …
npm run build
func start       # http://localhost:7071
```

**Terminal 2 — Frontend:**

```powershell
cd web
$env:VITE_USE_MOCK="false"
npm run dev      # http://localhost:5173
```

Vite proxies `/api/*` to `http://127.0.0.1:7071` (configured in `vite.config.ts`). Use `127.0.0.1` instead of `localhost` so the proxy works on IPv4-only `func` hosts.

To reset local mock data: in DevTools → Application → Local Storage, delete `reno-*` keys.

---

## 9. Azure resource setup

### A. Tooling

```powershell
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

### B. Cosmos DB (Serverless)

1. Azure Portal → **Create a resource** → **Azure Cosmos DB** → **Azure Cosmos DB for NoSQL**.
2. Settings:
   - Resource group: create new `rg-reno-tracker`.
   - Account name: `cosmos-reno-<unique>`.
   - Region: `West Europe` (or closest).
   - **Capacity mode: Serverless** (pay-per-request, no minimum, ideal for low/sporadic traffic).
3. Networking tab → Connectivity method: **All networks**. (Cosmos managed Functions in SWA don't have a fixed outbound IP, so VNET / IP-allow-listing isn't practical for the Free plan. Authentication via the connection-string key is what secures access.)
4. After creation → **Data Explorer** → **New Database** id `reno`.
5. Inside `reno` → **New Container** twice:
   - id `workspaces`, partition key `/id`.
   - id `expenses`, partition key `/workspaceId`.
6. Sidebar → **Settings → Keys** → copy **PRIMARY CONNECTION STRING**.

### C. Storage Account (Blob)

1. Create a resource → **Storage account**.
2. Settings:
   - Resource group: `rg-reno-tracker`.
   - Storage account name: `streno<unique>` (lowercase, 3–24 chars).
   - Region: same as Cosmos.
   - Performance: `Standard`.
   - Redundancy: `LRS` (cheapest).
3. After creation → **Containers** → **+ Container** → name `expense-photos`, public access level: **Private**.
4. **Security + networking → Access keys** → copy **key1 → Connection string**.

### D. Static Web App

1. Create a resource → **Static Web App**.
2. Settings:
   - Resource group: `rg-reno-tracker`.
   - Name: `swa-reno-tracker`.
   - Plan: **Free**.
   - Region: closest to your users (West Europe).
   - **Source:** GitHub → authorize → choose your repo + branch `main`.
   - **Build presets:** Custom
     - App location: `/web`
     - Api location: `api`
     - Output location: `dist`
3. SWA auto-commits `.github/workflows/azure-static-web-apps-*.yml` to your repo. The first build may fail until you push the API code.

### E. Application settings (secrets) in the SWA

Static Web App → **Settings → Environment variables / Configuration → Application settings**. Add:

| Name | Value |
|---|---|
| `MASTER_ACCESS_CODE` | Your private admin code (something stronger than `1234`, e.g., `RENOMASTER-XXXX`) |
| `COSMOS_CONNECTION` | Cosmos primary connection string |
| `COSMOS_DB_NAME` | `reno` |
| `BLOB_CONNECTION` | Storage account connection string |
| `BLOB_CONTAINER` | `expense-photos` |
| `VITE_USE_MOCK` | `false` |

> The `VITE_USE_MOCK=false` is essential — without it, the production frontend would still use the in-browser mock and never call your real API.

---

## 10. Deployment

### Workflow file

The auto-generated workflow needs two tweaks after SWA commits it:

```yaml
app_location: "./web"
api_location: "api"
output_location: "dist"   # Vite outputs to dist/, not build/
```

### Build pipeline (Oryx)

On each push to `main`, GitHub Actions:

1. Checks out the repo.
2. Calls `Azure/static-web-apps-deploy@v1`.
3. SWA's build agent (Oryx) auto-detects:
   - `web/` → Vite + tsc → runs `npm install && npm run build`.
   - `api/` → Node Functions → runs `npm install && npm run build`.
4. Deploys both artifacts; the platform routes `/api/*` to the managed Functions host.

### Preview environments

PRs and feature branches get auto-deployed to a URL like `https://<swa-name>-<branch>.<region>.azurestaticapps.net`. These share the same application settings as production (unless you override per environment).

---

## 11. PWA & offline support

### Manifest & icons

- `web/public/manifest.webmanifest` — name, short_name, theme/background color, start_url, display=standalone, icons (192, 512, 512-maskable).
- `web/public/favicon-32.png`, `favicon-64.png`, `apple-touch-icon.png`, `pwa-192.png`, `pwa-512.png`, `pwa-512-maskable.png` — generated by `System.Drawing` from a source PNG.
- `web/index.html` declares all icon links so iOS Safari, Android Chrome, and desktop browsers pick the right size.

### Service worker

`web/public/sw.js` — registered in `main.tsx` only in production builds. Caching strategies:

| Resource | Cache | Strategy |
|---|---|---|
| App shell (HTML, icons, manifest) | `reno-static-v1` | Precache on install |
| Same-origin JS/CSS/images | `reno-runtime-v1` | Stale-while-revalidate |
| `/api/*` GETs | `reno-api-v1` | Network-first, cache fallback |
| Cross-origin images (Blob SAS) | `reno-runtime-v1` | Cache-first |

Mutations (`POST`, `PATCH`, `DELETE`) are never cached — they're passed straight through.

When you ship a new release, bump `SW_VERSION` in `sw.js` to invalidate stale caches.

---

## 12. Switching between mock and Azure backend

The frontend reads `import.meta.env.VITE_USE_MOCK` at **build time**:

| Scenario | Default | Override |
|---|---|---|
| Local dev with mock (UI iteration) | mock (because `npm run dev` runs in dev mode) | none needed |
| Local dev with real API | mock | `$env:VITE_USE_MOCK="false"; npm run dev` (PowerShell) or `VITE_USE_MOCK=false npm run dev` (bash) |
| Production (Azure) build | real API (because `npm run build` runs in prod mode) | none needed |

> ⚠️ **`VITE_USE_MOCK` cannot be set via Azure SWA Application Settings.** Those settings are runtime-only and apply to the Functions API. Vite freezes the value during GitHub Actions build. If you ever needed a non-default value in production, you'd inject it as a GitHub Actions env var in the workflow YAML, or commit a `.env.production` file.

Polling (`refetchInterval: 20s` on focused tab) automatically activates whenever `IS_MOCK === false`.

---

## 13. Application Insights (monitoring)

Optional but recommended. Azure Application Insights captures HTTP request traces, exception stack traces, dependency timings (Cosmos / Blob), and offers a live metrics stream — for free under the 5 GB/month ingest cap, which this app won't approach.

### A. Create the resource (≈5 min)

1. Azure Portal → **Create a resource** → **Application Insights**.
2. Settings:
   - Resource group: `rg-reno-tracker`.
   - Name: `appi-reno-tracker`.
   - Region: same as SWA.
   - Resource Mode: **Workspace-based**.
   - Log Analytics Workspace: let Azure create a new one.
3. Create.

### B. Copy the connection string (≈1 min)

Open the new App Insights resource → **Overview** → look for **Connection String** under Essentials (or Settings → Properties). Format:
```
InstrumentationKey=...;IngestionEndpoint=https://...;LiveEndpoint=https://...;
```

### C. Wire it into the SWA (≈2 min)

Static Web App → **Settings → Environment variables** → **Add**:

| Name | Value |
|---|---|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | (paste the connection string) |

Save. SWA automatically restarts the Functions host, which detects the env var and instruments every HTTP request via the built-in Azure Functions Application Insights integration. No code changes required.

### D. Verify

Use the app (sign in, add or modify an expense). Within 1–2 minutes:

- Application Insights → **Investigate → Transaction search** → see calls to `/api/*` with status, duration, dependency calls to Cosmos & Blob.
- Application Insights → **Investigate → Failures** → grouped errors with stack traces.
- Application Insights → **Investigate → Live Metrics** → real-time view useful when debugging.
- Application Insights → **Logs** → custom KQL queries, e.g.:
  ```kql
  requests
  | order by timestamp desc
  | take 50
  ```

### Sampling

`api/host.json` already enables sampling so noise is kept low without losing useful signals:

```json
"applicationInsights": {
  "samplingSettings": { "isEnabled": true, "excludedTypes": "Request" }
}
```

To disable telemetry, simply delete `APPLICATIONINSIGHTS_CONNECTION_STRING` from the SWA app settings.

---

## 14. Budgets & cost alerts

Spend protection is essentially free. Set a generous monthly cap and have Azure email you long before you actually hit it.

### A. Create a budget (≈5 min)

1. Azure Portal → **Cost Management** (top search bar) → open it for your subscription.
2. **Budgets** in the side menu → **+ Add**.
3. Settings:
   - **Scope**: `Resource group` → `rg-reno-tracker` (or the whole subscription if you prefer).
   - **Name**: `budget-reno-tracker`.
   - **Reset period**: `Monthly`.
   - **Start date**: current month (default).
   - **Expiration date**: leave default (≈5 years).
   - **Amount**: `5` (USD/EUR depending on your billing currency — at typical usage this app costs well under $1/month, so $5 leaves plenty of headroom).
4. **Next**.

### B. Alert thresholds

In the same wizard, add three alert conditions to get notified well before overspending:

| % of budget | Type | Email |
|---|---|---|
| 50 | Actual | your email |
| 80 | Actual | your email |
| 100 | Forecasted | your email |

- **Actual** alerts fire when you've already consumed the threshold.
- **Forecasted** alerts fire when Azure predicts you'll exceed it by month-end — a useful early warning.

You can skip Action Groups entirely and just use the **Alert recipients (email)** field. Action Groups are only needed for SMS, voice calls, or wiring alerts into Azure Mobile push / webhooks.

### C. (Optional) Cost anomaly alerts

Cost Management → **Cost alerts** → **+ Add** → **Anomaly**. Catches unexpected spikes versus your historical baseline. Free, recommended.

### What budgets do *not* do

Budgets **alert** but do not stop services automatically. A hard spending cap only exists on Visual Studio / Azure for Students subscriptions, not on pay-as-you-go. If you ever get an alert, investigate in **Cost analysis** (which service spiked) and react manually (e.g., delete a runaway resource).

### Realistic cost expectation

| Service | Monthly estimate |
|---|---|
| Cosmos DB Serverless | ~$0.20 |
| Blob Storage (Standard LRS) | ~$0.20 |
| Static Web App (Free) | $0.00 |
| Application Insights | $0.00 |
| **Total** | **~$0.40 / month** |

A $5 budget gives you ~12× headroom; if you ever cross 50%, something is very wrong (e.g., spam traffic or a misconfiguration) and you'll have time to react.
