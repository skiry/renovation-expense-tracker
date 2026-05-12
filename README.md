# Renovation Expense Tracker

Aplicație web (PWA) pentru evidența cheltuielilor de renovare a unui apartament. Frontend React + TypeScript, hostat pe Azure Static Web Apps. Backend pe Azure Functions cu storage în Cosmos DB și Azure Blob Storage.

## Status

**Faza 1 – POC local (în lucru)**: aplicația rulează 100% local cu date mock în `localStorage`. Toate feature-urile sunt funcționale: login multi-workspace, dashboard cu totaluri, drag&drop, detalii element, sub-cheltuieli, poze comprimate, switch estimativ/detaliat, monedă RON+EUR cu conversie BNR, mod întunecat automat, PWA instalabil.

**Faza 2 – Azure** (după aprobare): se vor înlocui mock services-urile cu Azure Functions + Cosmos DB + Blob Storage.

## Rulare locală

Necesită Node 18+ și npm.

```powershell
cd web
npm install
npm run dev
```

Aplicația pornește pe http://localhost:5173.

**Cod de acces demo:** `1234` (preîncărcat cu date sample). Poți crea coduri noi (min 6 caractere) din ecranul de login.

## Structură

```
RenovationExpenseTracker/
├── web/                     # Frontend React + Vite + TS
│   ├── src/
│   │   ├── components/      # UI primitives (shadcn/ui) + AppLayout
│   │   ├── pages/           # Login, Dashboard, ExpenseDetail, Settings
│   │   ├── services/        # api.ts (Mock + Http), mockData.ts
│   │   ├── hooks/           # React Query hooks (useExpenses)
│   │   ├── store/           # Zustand: auth, ui
│   │   ├── utils/           # calculations.ts
│   │   ├── lib/utils.ts     # cn(), formatRon, uid
│   │   └── types.ts
│   └── package.json
├── api/                     # Azure Functions (Phase 2 – TBD)
├── staticwebapp.config.json
└── README.md
```

## Modele de date (Cosmos DB plan)

- Container `workspaces` (partition key `/id`): `{ id, createdAt, isMaster, settings }`
- Container `expenses` (partition key `/workspaceId`): `{ id, workspaceId, title, estimatedPrice, estimatedCurrency, description?, isPriority, isPaid, priceMode, order, details[], photos[], createdAt, updatedAt }`

## Logica de calcul

- **Preț afișat per element** = estimativ (dacă mode=estimated) sau suma `details[]` în RON (dacă mode=detailed)
- **Cheltuit per element** = preț afișat (dacă element.isPaid) altfel suma sub-intrărilor bifate ca achitate (indiferent de mode)
- **Totaluri dashboard** = `priorityTotal + nonPriorityTotal = grandTotal`; `spentTotal` separat

## Pasul următor pentru deploy pe Azure

1. **Resurse Azure de creat:**
   - Cosmos DB account (NoSQL API) cu database `reno` și containerele `workspaces`, `expenses`
   - Storage Account cu container `expense-photos` (acces blob privat, signed URLs prin API)
   - Static Web App (planul Free e suficient)
2. **Secrets în Static Web App Configuration:**
   - `MASTER_ACCESS_CODE` – codul tău (ex: 1234)
   - `COSMOS_CONNECTION` – connection string Cosmos DB
   - `BLOB_CONNECTION` – connection string Storage Account
3. **GitHub Actions deploy:** la push pe main, SWA build-uiește `web/` și deploy-uiește, plus API-ul din `api/`.
4. **Switch la real:** setează `VITE_USE_MOCK=false` în SWA app settings (build env).

## Tech stack

- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS, shadcn/ui, Radix UI, Lucide icons
- **State:** TanStack Query, Zustand (cu persist)
- **Drag & drop:** @dnd-kit
- **Image compression:** browser-image-compression
- **Toasts:** sonner
- **PWA:** vite-plugin-pwa
- **Backend (Phase 2):** Azure Functions Node 20 + TypeScript, @azure/cosmos, @azure/storage-blob
