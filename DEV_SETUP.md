# DEV_SETUP — Renovation Expense Tracker

A complete, beginner-friendly walkthrough of every step taken to build this app, so you can follow it 1:1 to build a similar Azure Static Web App with Cosmos DB and Blob Storage.

> 📝 **Status legend:** ✅ done · 🚧 in progress · ⏳ pending (Phase 2 / Azure)

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Git setup](#2-git-setup)
3. [Functional requirements](#3-functional-requirements)
4. [Tech decisions](#4-tech-decisions)
5. [App scaffolding](#5-app-scaffolding)
6. [Frontend implementation](#6-frontend-implementation)
7. [Running locally](#7-running-locally)
8. [Azure setup](#8-azure-setup) ⏳
9. [Backend (Azure Functions) implementation](#9-backend-azure-functions-implementation) ⏳
10. [Deployment](#10-deployment) ⏳
11. [Switching between mock and Azure backend](#11-switching-between-mock-and-azure-backend) ⏳

---

## 1. Prerequisites

Install on your dev machine:

- **Node.js 18+** (Node 20+ recommended for full PWA service worker build).
  Check: `node --version`
- **npm 9+** (comes with Node).
- **Git** (any recent version). Check: `git --version`
- A code editor — **Visual Studio Code** is recommended.
- For Phase 2 (Azure):
  - An **Azure account** (free tier is enough). Sign up: https://azure.microsoft.com/free/
  - **Azure Functions Core Tools v4** for local API testing: https://learn.microsoft.com/azure/azure-functions/functions-run-local
  - **Azure Static Web Apps CLI** (optional, for local SWA emulation): `npm i -g @azure/static-web-apps-cli`

---

## 2. Git setup ✅

```bash
# From the project folder
git init
git add .
git commit -m "Initial scaffolding"

# Push to a new GitHub repo
gh repo create renovation-expense-tracker --private --source=. --remote=origin
git push -u origin main
```

> If you don't have the GitHub CLI (`gh`), create the repo from https://github.com/new, then:
> ```bash
> git remote add origin https://github.com/<your-user>/renovation-expense-tracker.git
> git branch -M main
> git push -u origin main
> ```

For ongoing work, use feature branches:

```bash
git checkout -b feature/<short-description>
# ...changes...
git add . && git commit -m "feat: description"
git push -u origin feature/<short-description>
```

---

## 3. Functional requirements ✅

The app helps a homeowner track renovation expenses across an entire apartment, replacing a spreadsheet that's awkward to edit on a phone.

**Core features:**

- **Multi-workspace authentication** via short access codes. The "master" code is set once via Static Web App secrets; anyone can create additional workspaces (each isolated) by picking a code (min 6 chars, validated unique).
- **Expense items** with: title, estimated price (RON or EUR), priority flag, optional description, optional photos.
- **Detailed price breakdown** per item: list of sub-expenses (`name, price, currency, paid?`). Each item can be in *Estimated* mode (uses estimated price) or *Detailed* mode (sums sub-expenses). User toggles between modes on the item detail page.
- **Mark as paid** — both at the whole-item level, or individually per sub-expense.
- **Dashboard totals** in RON: priority total, non-priority total, grand total, *spent so far*. EUR amounts are converted using BNR daily exchange rate.
- **Drag & drop** ordering inside priority and non-priority sections.
- **Photos**: up to 20 per item, compressed in browser before upload, stored in Azure Blob Storage (data URLs in mock mode).
- **Theme**: light/dark/system (default light).
- **PWA**: installable on phones with proper manifest.
- **Romanian UI**, mobile-first responsive layout.

**Spent calculation rules** (centralized in `src/utils/calculations.ts`):

- If item `isPaid === true` → contributes its display price (estimated or detailed depending on mode) to *Spent*.
- Else → contributes the sum of its sub-expenses where `isPaid === true`, **regardless of the item's display mode**.
- Display price uses `mode`:
  - `estimated` → `estimatedPrice` (converted to RON).
  - `detailed` → sum of `details[]` (each converted to RON).

**Multi-user concurrency strategy** (Phase 2):

- **Optimistic concurrency** with Cosmos DB ETag — patches sent with `If-Match` header, conflicts return HTTP 412 and the client refetches.
- **Polling** every 20s on focused tab via React Query `refetchInterval`. Free-tier Cosmos DB makes this essentially free.

---

## 4. Tech decisions ✅

| Concern | Choice | Why |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Mature, huge ecosystem, great mobile support. |
| Build tool | Vite 5 | Fast HMR, simple config, native ESM. |
| Styling | Tailwind CSS + shadcn/ui | Utility-first, accessible primitives, easy to customize. |
| Routing | React Router v6 | De facto for client-side routing in React. |
| Server state | TanStack Query (React Query) v5 | Caching, refetch, optimistic updates, polling. |
| UI state | Zustand (with persist middleware) | Tiny, no boilerplate, works great for auth/theme/UI flags. |
| Drag & drop | @dnd-kit | Keyboard accessible, touch-friendly, modular. |
| Image compression | browser-image-compression | Reduces file size before upload to keep blob costs low. |
| Toasts | sonner | Elegant, minimal API. |
| PWA | vite-plugin-pwa | Auto manifest + service worker; needs Node 20+ to bundle SW. |
| Backend | Azure Functions Node 20 + TypeScript | Native integration with Azure Static Web Apps. |
| Storage | Cosmos DB (NoSQL API) + Azure Blob Storage | Generous free tier, simple SDKs, scales globally. |
| Hosting | Azure Static Web Apps | Free tier covers small apps, integrated with GitHub Actions. |

---

## 5. App scaffolding ✅

We did **not** use `npm create vite@latest` because the latest `create-vite` requires Node ≥20 and we're on 18. Instead, we created the project files manually with pinned, Node-18-compatible dependency versions.

### Folder structure created

```
RenovationExpenseTracker/
├── web/                      # React frontend (this is the SWA app)
│   ├── public/               # Static assets (favicon.svg, manifest.webmanifest)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           # shadcn-style primitives (button, card, input, dialog, popover, …)
│   │   │   └── AppLayout.tsx # Sticky header with logo + Settings + Logout
│   │   ├── pages/            # Login, Dashboard, ExpenseDetail, Settings
│   │   ├── services/         # api.ts (MockApi + HttpApi), mockData.ts
│   │   ├── hooks/            # useExpenses.ts (React Query hooks)
│   │   ├── store/            # auth, ui, theme (Zustand stores)
│   │   ├── utils/            # calculations.ts
│   │   ├── lib/              # utils.ts (cn, formatRon, slugifyTitle, …)
│   │   ├── types.ts
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── vite-env.d.ts
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.ts
├── api/                      # Azure Functions (Phase 2)  ⏳
├── staticwebapp.config.json  # SWA routing rules + headers
├── README.md
└── DEV_SETUP.md              # ← this file
```

### Key dependency installs (web/)

```bash
cd web
npm install
```

`package.json` already pins:

- `react`, `react-dom`, `react-router-dom`
- `@tanstack/react-query`, `zustand`
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `@radix-ui/react-{dialog,label,popover,separator,slot,switch}` — primitives behind shadcn/ui
- `class-variance-authority`, `clsx`, `tailwind-merge` — class composition
- `lucide-react` — icons
- `sonner` — toasts
- `browser-image-compression` — client-side image shrinking
- `tailwindcss`, `tailwindcss-animate`, `postcss`, `autoprefixer`
- `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`
- `typescript`, `@types/*`

### Tailwind setup

- `tailwind.config.js` — `darkMode: ['class']`, custom colors mapped to CSS variables (`--background`, `--foreground`, …).
- `postcss.config.js` — wires Tailwind + autoprefixer.
- `src/index.css` — `@tailwind base/components/utilities`, plus `:root` light vars, `.dark` overrides, and `@media (prefers-color-scheme: dark) :root.theme-system { … }` for system mode.

### shadcn/ui-style primitives

Rather than adding the shadcn CLI, we hand-wrote the small set we actually use:
`button.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `label.tsx`, `switch.tsx`, `badge.tsx`, `dialog.tsx`, `separator.tsx`, `popover.tsx` (which also exports a reusable `<InfoTooltip>`).

---

## 6. Frontend implementation ✅

### State / data flow

```
Components ─► React Query hooks (useExpenses.ts) ─► api (services/api.ts)
                                                     │
                                                     ├─ MockApi  (uses localStorage; default for POC)
                                                     └─ HttpApi  (calls /api/* — Azure Functions in Phase 2)
```

The choice between the two is controlled by `import.meta.env.VITE_USE_MOCK`. Default = `'true'`. Set to `'false'` to switch to the real API.

### Routing

- `/login` — public
- `/` — Dashboard (protected)
- `/expense/:id` — Expense detail (protected)
- `/settings` — Settings (protected)

`ProtectedRoute` checks `useAuthStore().accessCode` and redirects to `/login` if missing.

### Stores (Zustand, persisted)

- `auth.ts` — `{ accessCode, setAccessCode, logout }` → key `reno-auth`
- `ui.ts` — `{ hidePaid }` → key `reno-ui`
- `theme.ts` — `{ theme: 'light'|'dark'|'system' }` → key `reno-theme`. `applyTheme()` sets classes on `document.documentElement`.

### Mock storage

`MockApi` persists everything (workspaces, expenses, photos as data URLs, exchange rate) under the localStorage key `reno-mock-data-v1`. Sample data is seeded on first run from `src/services/mockData.ts`.

### ID generation

Expense IDs are slug-based for human-friendliness:

- `slugifyTitle("Vopsire pereți living")` → `"vopsire-pereti"` (first 2 words, lowercase, diacritics stripped)
- `uniqueSlug(base, existingIds)` adds `-2`, `-3`, … on collision.

### Calculations

All money math in `src/utils/calculations.ts`:

- `convertToRon(amount, currency, eurToRon)`
- `displayPriceRon(expense, eurToRon)` — applies the estimated/detailed mode.
- `spentForExpense(expense, eurToRon)` — applies the paid-vs-detail-bifa rules.
- `computeTotals(expenses, eurToRon)` — aggregates for the dashboard.

### Images

- `<input type="file" multiple accept="image/*">` — opens the native phone gallery / camera.
- `imageCompression(file, { maxWidthOrHeight: 1920, maxSizeMB: 0.7, initialQuality: 0.8 })` shrinks each picked file before upload.
- Mock mode stores them as data URLs (capped at ~5 MB localStorage). Real mode will upload to Blob via the API.

---

## 7. Running locally ✅

```bash
cd web
npm install            # only first time
npm run dev            # http://localhost:5173
```

Default access code (matches the seeded master workspace): **`1234`**.

Useful scripts:

- `npm run build` — production build into `web/dist/`.
- `npm run preview` — serve the production build for smoke testing.
- `ENABLE_PWA=true npm run build` — also bundle the service worker (requires Node ≥20).

To wipe local data and restart with fresh seed:

1. Open DevTools → Application → Local Storage → http://localhost:5173.
2. Delete keys `reno-mock-data-v1`, `reno-auth`, `reno-ui`, `reno-theme`.
3. Reload.

---

## 8. Azure setup ⏳

> This section will be filled in step by step as we provision Azure resources.

Outline of what we'll do:

1. **Create a resource group** (e.g., `rg-reno-tracker`).
2. **Cosmos DB**:
   - Account: NoSQL API, free tier enabled.
   - Database: `reno`.
   - Containers:
     - `workspaces`, partition key `/id`.
     - `expenses`, partition key `/workspaceId`.
   - Copy the **PRIMARY CONNECTION STRING** from the Keys blade.
3. **Storage Account**:
   - Standard LRS, hot tier, public access disabled.
   - Container: `expense-photos`, private access. We'll generate user-delegated SAS URLs from the API for photo access.
   - Copy a connection string from Access Keys.
4. **Static Web App**:
   - Plan: Free.
   - Source: GitHub (the repo created in §2).
   - Build presets:
     - App location: `web`
     - API location: `api`
     - Output location: `dist`
5. **Application settings (env vars) on the SWA**:
   | Name | Value |
   |---|---|
   | `MASTER_ACCESS_CODE` | (your private master code, e.g., `1234` or anything stronger) |
   | `COSMOS_CONNECTION` | (paste from step 2) |
   | `COSMOS_DB_NAME` | `reno` |
   | `BLOB_CONNECTION` | (paste from step 3) |
   | `BLOB_CONTAINER` | `expense-photos` |
   | `VITE_USE_MOCK` | `false` |

---

## 9. Backend (Azure Functions) implementation ⏳

To be filled in. Will include:

- `api/host.json`, `api/local.settings.json`, `api/package.json`.
- HTTP-triggered functions for every endpoint listed in `README.md → API endpoints`.
- A small auth middleware reading `x-access-code` and verifying against Cosmos.
- Cosmos client wrapped in a service (`expensesService`, `workspacesService`).
- Blob client wrapped in a service (`photoService`) that uploads with `application/jpeg`, `Cache-Control: public, max-age=31536000`, returning **user-delegated SAS** URLs valid 7 days (or proxying via the API).
- BNR fetch with in-memory 24h cache.

---

## 10. Deployment ⏳

- A `.github/workflows/azure-static-web-apps.yml` is auto-created when you link the SWA to GitHub. It builds `web/` and `api/` on each push to `main`.
- Branch deploys: pushing to a feature branch creates a "preview" environment URL that mirrors the production app with the *same* environment variables (you can override per branch).

---

## 11. Switching between mock and Azure backend ⏳

The frontend selects the API implementation at build time via `VITE_USE_MOCK`:

- **Mock mode (default for local dev):** `VITE_USE_MOCK=true` (or unset). All data lives in `localStorage`. Useful for offline demos and rapid UI iteration.
- **Real mode (production / staging):** `VITE_USE_MOCK=false`. Calls go to `/api/*` which the SWA routes to Azure Functions.

Locally you can run the real API too:

```bash
# Terminal 1 — backend
cd api
npm install
func start

# Terminal 2 — frontend
cd web
VITE_USE_MOCK=false npm run dev   # or set in .env.local
```

Vite's dev server proxies `/api` to `http://localhost:7071` (configured in `vite.config.ts`).
