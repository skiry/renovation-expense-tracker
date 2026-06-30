# 🏠 Renovation Expense Tracker

A personal-use web app to track home renovation expenses across an entire apartment. Replaces an Excel spreadsheet with a mobile-first PWA that supports multi-workspace authentication, drag-and-drop priority lists, detailed per-item cost breakdowns, photo attachments, and Romanian Lei / Euro with automatic BNR exchange rate conversion.

Built as an Azure Static Web App (React frontend + Azure Functions API + Cosmos DB + Blob Storage).

---

## ✨ Features

- 🔐 **Multi-workspace** authentication via simple access codes — one master code + create-your-own codes (min 6 chars). Codes are stored as Cosmos documents; auth happens via an `x-access-code` header.
- 👥 **Multi-user per workspace** — each access code can host multiple named users (e.g. "Bogdan", "Ioana"). After entering the code, you pick (or create) a user; that identity attaches to every change you make.
- 📊 **Dashboard** with sticky Priority / Non-Priority tabs, drag-and-drop reordering inside the active tab, summary card (Total + Spent for the current tab), magnifier search across expense titles AND sub-expense names, and a "hide paid items" toggle (auto-hidden when no paid items).
- 📝 **Expense detail** page with inline-edit title, priority and paid toggles, description, photos.
- 🧮 **Estimated vs. detailed price mode** — switch per item. Estimated mode uses your rough estimate; detailed mode sums a list of named sub-expenses (each with own currency and paid flag).
- 💵 **Multi-currency** (RON / EUR) with conversion to RON for all totals. Exchange rate fetched daily from BNR's public XML and cached server-side for 24h.
- � **Attachments** — up to 30 per item (images + documents like PDF, Word, Excel, CSV, TXT). Images are compressed in the browser (max 1920px, ~80% JPEG quality); documents upload as-is. Stored in Azure Blob Storage and served as 7-day SAS URLs.
- 🕐 **Audit history** — every create / update / delete / photo action is logged with the user's name and a per-field diff. History page groups entries by day, with `Important` / `Detailed` filter and click-to-expand modal showing before → after values.
- 🔔 **Web push notifications** — opt-in from Settings (or via the dismissible Dashboard banner). When another user creates/deletes an expense or changes a "meaningful" price (estimated price for items in *estimated* mode, sub-expense price for items in *detailed* mode), every other subscriber in the workspace gets a push. Works on Android Chrome, desktop Chrome/Firefox/Edge, and iOS 16.4+ **only when the app is installed to the Home Screen**.
- 🌗 **Theme switcher** (system default · light · dark) — persisted in localStorage.
- 📱 **Installable PWA** with custom icons (favicon, Apple Touch, maskable).
- 🛜 **Offline reading** via service worker — app shell precached, last API responses kept as fallback. New writes still require connectivity.
- 🔄 **Multi-user concurrency** — Cosmos DB ETag with `If-Match` headers; clients see "modified by someone else" toast on 412 and auto-refresh. Background polling every 20s (focused tab only) keeps everyone in sync.
- 🇷🇴 **Romanian UI**, mobile-first responsive layout.

## 🧱 Tech stack

**Frontend** — React 18 · TypeScript · Vite 5 · Tailwind CSS · shadcn/ui (Radix primitives) · TanStack Query · Zustand · @dnd-kit · lucide-react · sonner · browser-image-compression

**Backend** — Azure Functions (Node 20 + TypeScript, v4 programming model) · @azure/cosmos · @azure/storage-blob

**Hosting** — Azure Static Web Apps (Free plan) · GitHub Actions for CI/CD

**Storage** — Azure Cosmos DB for NoSQL (Serverless) · Azure Blob Storage

---

## 📁 Project structure

```
RenovationExpenseTracker/
├── web/                          # React frontend (deployed as the SWA app)
│   ├── public/                   # Static assets (icons, manifest, sw.js, staticwebapp.config.json)
│   └── src/
│       ├── components/ui/        # shadcn-style primitives
│       ├── pages/                # Login, UserSelect, Dashboard, ExpenseDetail, History, Settings, NotFound
│       ├── services/             # api.ts (MockApi + HttpApi), mockData.ts
│       ├── hooks/                # useExpenses.ts (React Query hooks)
│       ├── store/                # auth, ui, theme (Zustand stores)
│       ├── utils/calculations.ts
│       └── lib/utils.ts
├── api/                          # Azure Functions backend
│   └── src/
│       ├── functions/            # auth, users, expenses, details, photos, exchangeRate, history
│       ├── services/             # cosmos, blob, bnr, audit
│       ├── middleware/auth.ts
│       └── shared/
├── .github/workflows/            # SWA CI/CD
├── DEV_SETUP.md                  # Step-by-step setup guide (English)
├── initial_instructions.md       # Quick reference for Phase 2 Azure setup
└── README.md
```

---

## 🚀 Local setup

### Prerequisites

- **Node.js 18+** (Node 20 recommended)
- **npm 9+**
- **Git**
- For running the real API locally: [**Azure Functions Core Tools v4**](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
  ```powershell
  npm install -g azure-functions-core-tools@4 --unsafe-perm true
  ```

### Option 1 — Frontend with mock backend (fastest)

Everything runs in the browser; data is stored in `localStorage`. No Azure resources required. Perfect for UI iteration and demos.

```powershell
cd web
npm install        # first time only
npm run dev        # http://localhost:5173
```

Default access code (preloaded with sample data): **`1234`**.

### Option 2 — Full stack: frontend + real API + Azure resources

Use this when you want to test the real API against your Cosmos DB and Blob Storage.

**1. Configure the API locally**

```powershell
cd api
npm install
Copy-Item local.settings.json.example local.settings.json
```

Edit `api/local.settings.json` and fill in:

| Key | Value |
|---|---|
| `MASTER_ACCESS_CODE` | Your local admin code, e.g. `testlocal` |
| `COSMOS_CONNECTION` | Cosmos DB primary connection string (Azure Portal → your account → Keys) |
| `COSMOS_DB_NAME` | Usually `reno` |
| `BLOB_CONNECTION` | Storage account connection string (Azure Portal → your account → Access keys → key1) |
| `BLOB_CONTAINER` | Usually `expense-photos` |

> 💡 `local.settings.json` is git-ignored, so your secrets won't be committed.

**2. Start the Functions host**

```powershell
cd api
npm run build      # compiles TS → dist/
func start         # http://localhost:7071
```

**3. Start the frontend in real-API mode (in a second terminal)**

```powershell
cd web
$env:VITE_USE_MOCK="false"
npm run dev        # http://localhost:5173
```

Vite proxies `/api/*` to `http://127.0.0.1:7071`, so the frontend just calls `/api/...` and the rest is transparent.

> ⚠️ The first `verifyAccessCode` call also bootstraps the master workspace into Cosmos if it doesn't exist yet.

**One-liner shortcut (Windows):** spawn both terminals at once from the repo root:

```powershell
Start-Process cmd -ArgumentList "/k", "cd api && npm run build && func start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd web; `$env:VITE_USE_MOCK='false'; npm run dev"
```

`cmd` is used for the API to sidestep PowerShell's default execution policy (which can block `func.ps1`). If you'd rather use only PowerShell, either run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once in an admin shell, or pass `-ExecutionPolicy Bypass` to the second `Start-Process` call.

**Troubleshooting: "Port 7071 is unavailable"** — a stale `func` process is still listening. Find and kill it:

```powershell
Get-NetTCPConnection -LocalPort 7071 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

## 🔀 Switching between mock and Azure backend

The frontend picks its API implementation at **build time** from `import.meta.env.VITE_USE_MOCK`:

| Mode | Default | How to force |
|---|---|---|
| Mock (localStorage) | `npm run dev` (development) | `VITE_USE_MOCK=true npm run build` |
| Real API (`/api/*`) | `npm run build` (production) | `VITE_USE_MOCK=false npm run dev` |

> ⚠️ **Vite reads `VITE_*` only at build time.** Setting `VITE_USE_MOCK` in Azure SWA Application Settings has no effect — those are runtime env vars exposed only to the Functions API. The frontend baked its choice in during GitHub Actions build.

For local dev with the real API in another terminal:

```powershell
$env:VITE_USE_MOCK="false"; npm run dev   # PowerShell
VITE_USE_MOCK=false npm run dev           # bash/zsh
```

When switching, delete the mock data from localStorage:

1. DevTools → Application → Local Storage → site URL.
2. Delete keys `reno-mock-data-v1`, `reno-auth`.

---

## 🛠️ Available scripts

### `web/`

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build → `web/dist/` |
| `npm run preview` | Serve the production build locally |

### `api/`

| Command | Description |
|---|---|
| `npm run build` | TypeScript compile → `api/dist/` |
| `npm start` | Build + run Functions host (`func start`) |
| `npm run clean` | Delete `api/dist/` |

---

## 🌐 Deployment

CI/CD via GitHub Actions (`.github/workflows/azure-static-web-apps-*.yml`).

Every push to `main`:

1. Checks out the repo on Ubuntu.
2. Calls `Azure/static-web-apps-deploy@v1` with:
   - `app_location: ./web`
   - `api_location: api`
   - `output_location: dist`
3. Oryx auto-detects Vite + tsc, runs `npm install && npm run build` in both `web/` and `api/`, deploys the artifacts.
4. Static Web Apps swaps the new bundle in.

Feature branches and PRs get preview environments at `https://<swa-name>-<branch>.<region>.azurestaticapps.net`.

For full Azure resource setup (Cosmos DB, Storage Account, SWA with all secrets), see [`DEV_SETUP.md`](DEV_SETUP.md).

---

## 🤝 Multi-user behavior

- Each access code is its own data island in Cosmos DB (a "workspace").
- Inside a workspace you can create multiple named users. After entering the code on `/login`, the user picker at `/login/user` lets you select or create your identity — that name is then attached to every change you make.
- Concurrent edits use **ETag optimistic concurrency**: PATCH requests include `If-Match`; on mismatch the API returns 412 and the UI shows a toast + auto-refetches.
- Background **polling** every 20 seconds (focused tab only) keeps everyone within the same workspace in near-real-time sync.
- The **History page** (🕐 icon in the header) shows the audit log: who did what, when, with the before → after values for each changed field. Filter `Important` shows only price changes that matter (estimated price when the item is in estimated mode, sub-expense price when in detailed mode) plus create/delete. Filter `Detailed` shows everything.

## 💸 Cost

With Cosmos DB on Serverless + Blob Storage Standard LRS + SWA Free plan, expect **~$0.40/month** for personal use (a few hundred requests per day, a few hundred MB of photos). Most of the cost (~75%) comes from polling — which is automatically paused when the tab is not focused.

---

## 📄 License

Private project — see [`DEV_SETUP.md`](DEV_SETUP.md) for the full walkthrough if you'd like to build a similar app.
