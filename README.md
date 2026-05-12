# 🏠 Renovation Expense Tracker

A personal-use web app to track home renovation expenses across an entire apartment. Replaces an Excel spreadsheet with a mobile-first PWA that supports multi-workspace authentication, drag-and-drop priority lists, detailed per-item cost breakdowns, photo attachments, and Romanian Lei / Euro with automatic BNR exchange rate conversion.

Built as an Azure Static Web App (React frontend + Azure Functions API + Cosmos DB + Blob Storage).

---

## ✨ Features

- 🔐 **Multi-workspace** authentication via simple access codes — one master code + create-your-own codes (min 6 chars). Codes are stored as Cosmos documents; auth happens via an `x-access-code` header.
- 📊 **Dashboard** with priority and non-priority sections, drag-and-drop reordering, summary card (priority / non-priority / grand total / spent), and a "hide paid items" toggle.
- 📝 **Expense detail** page with inline-edit title, priority and paid toggles, description, photos.
- 🧮 **Estimated vs. detailed price mode** — switch per item. Estimated mode uses your rough estimate; detailed mode sums a list of named sub-expenses (each with own currency and paid flag).
- 💵 **Multi-currency** (RON / EUR) with conversion to RON for all totals. Exchange rate fetched daily from BNR's public XML and cached server-side for 24h.
- 📷 **Photos** — up to 20 per item, compressed in the browser (max 1920px, ~80% JPEG quality) before uploading to Azure Blob Storage. Served as 7-day SAS URLs.
- 🌗 **Theme switcher** (light default · dark · system) — persisted in localStorage.
- 📱 **Installable PWA** with custom icons (favicon, Apple Touch, maskable).
- 🛜 **Offline reading** via service worker — app shell precached, last API responses kept as fallback. New writes still require connectivity.
- 🔄 **Multi-user concurrency** — Cosmos DB ETag with `If-Match` headers; clients see "modified by someone else" toast on 412 and auto-refresh. Background polling every 20s keeps everyone in sync.
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
│   ├── public/                   # Static assets (icons, manifest, sw.js)
│   └── src/
│       ├── components/ui/        # shadcn-style primitives
│       ├── pages/                # Login, Dashboard, ExpenseDetail, Settings, NotFound
│       ├── services/             # api.ts (MockApi + HttpApi), mockData.ts
│       ├── hooks/                # useExpenses.ts (React Query hooks)
│       ├── store/                # auth, ui, theme (Zustand stores)
│       ├── utils/calculations.ts
│       └── lib/utils.ts
├── api/                          # Azure Functions backend
│   └── src/
│       ├── functions/            # auth, expenses, details, photos, exchangeRate
│       ├── services/             # cosmos, blob, bnr
│       ├── middleware/auth.ts
│       └── shared/
├── .github/workflows/            # SWA CI/CD
├── staticwebapp.config.json
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

---

## 🔀 Switching between mock and Azure backend

The frontend picks its API implementation at build time from the environment variable `VITE_USE_MOCK`.

| `VITE_USE_MOCK` | Mode | API source |
|---|---|---|
| `true` (default) | Mock | `localStorage` via `MockApi` |
| `false` | Real | `/api/*` via `HttpApi` (Azure Functions) |

In production this is configured per environment in **Azure Static Web App → Configuration → Application settings** (set to `false`). In local dev you can override per terminal:

```powershell
$env:VITE_USE_MOCK="false"; npm run dev   # PowerShell
VITE_USE_MOCK=false npm run dev           # bash/zsh
```

When switching, you may want to delete the mock data from localStorage:

1. DevTools → Application → Local Storage → `http://localhost:5173`
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

- Each workspace (access code) is its own data island in Cosmos DB.
- Concurrent edits use **ETag optimistic concurrency**: PATCH requests include `If-Match`; on mismatch the API returns 412 and the UI shows a toast + auto-refetches.
- Background **polling** every 20 seconds (focused tab only) keeps everyone within the same workspace in near-real-time sync.

## 💸 Cost

With Cosmos DB on Serverless + Blob Storage Standard LRS + SWA Free plan, expect **$0–1/month** for personal use (a few hundred requests per day, a few hundred MB of photos).

---

## 📄 License

Private project — see [`DEV_SETUP.md`](DEV_SETUP.md) for the full walkthrough if you'd like to build a similar app.
