# Initial instructions — Phase 2 (Azure setup)

Step-by-step actions you need to perform to move from the local POC to a fully-deployed Azure Static Web App with Cosmos DB and Blob Storage.

> Split: **Your steps** = clicks in Azure Portal + GitHub. **My steps** = code I'll write after you finish A–F.

---

## Your steps, in order

### A. Account & tooling (≈5 min)

1. Active Azure account ([azure.microsoft.com/free](https://azure.microsoft.com/free) — $200 credit + a permanent free tier for many services).
2. Install **Azure Functions Core Tools v4** so we can test the API locally:
   ```powershell
   npm install -g azure-functions-core-tools@4 --unsafe-perm true
   ```
3. *(Optional but useful)* **Azure CLI**: <https://aka.ms/installazurecli>

### B. Push to GitHub (≈5 min)

4. Create a private GitHub repo (e.g., `renovation-expense-tracker`).
5. Push the current code:
   ```powershell
   cd C:\Users\Skiry\Desktop\Work\RenovationExpenseTracker
   git init
   git add .
   git commit -m "POC: frontend mock complete"
   git branch -M main
   git remote add origin https://github.com/<your-user>/renovation-expense-tracker.git
   git push -u origin main
   ```

### C. Cosmos DB (≈10 min, free)

6. Azure Portal → **Create a resource** → **Azure Cosmos DB** → **Azure Cosmos DB for NoSQL**.
7. Settings:
   - **Resource group:** create new `rg-reno-tracker`.
   - **Account name:** `cosmos-reno-<something-unique>` (e.g., your name).
   - **Region:** `West Europe` (or the closest to you).
   - **Capacity mode:** `Provisioned throughput`.
   - **Apply Free Tier Discount:** ✅ YES (1000 RU/s + 25 GB free forever — only one account per subscription can use it).
8. After creation → **Data Explorer** → **New Database**:
   - Database id: `reno`
   - Throughput: `Manual 1000 RU/s` (free with the free tier) or `Autoscale 1000 max`.
9. Inside database `reno` → **New Container** (twice):
   - Container 1: id `workspaces`, partition key `/id`.
   - Container 2: id `expenses`, partition key `/workspaceId`.
10. Sidebar → **Settings → Keys** → copy the **PRIMARY CONNECTION STRING** to a notepad.

### D. Storage Account for photos (≈5 min)

11. Create a resource → **Storage account**.
12. Settings:
    - Resource group: `rg-reno-tracker` (same one).
    - Storage account name: `streno<unique>` (3–24 lowercase chars/digits).
    - Region: same as Cosmos.
    - Performance: `Standard`.
    - Redundancy: `LRS` (cheapest).
13. After creation → **Containers** → **+ Container** → name `expense-photos`, public access level: **Private**.
14. **Security + networking → Access keys** → copy **key1 → Connection string** to your notepad.

### E. Static Web App (≈10 min)

15. Create a resource → **Static Web App**.
16. Settings:
    - Resource group: `rg-reno-tracker`.
    - Name: `swa-reno-tracker`.
    - Plan: **Free**.
    - Region: an Azure region for the API (e.g., `West Europe`).
    - **Source:** GitHub → authorize → choose your repo + branch `main`.
    - **Build presets:** Custom
      - **App location:** `/web`
      - **Api location:** `/api`
      - **Output location:** `dist`
17. The SWA will automatically commit a workflow `.github/workflows/azure-static-web-apps-*.yml` to your repo. The first build will fail because `api/` doesn't exist yet — that's fine.

### F. Configure SWA secrets (≈5 min)

18. Static Web App → **Settings → Environment variables / Configuration** → **Application settings** → add:

    | Name | Value |
    |---|---|
    | `MASTER_ACCESS_CODE` | your private master code (e.g., `1234` for POC, or something stronger like `RENOMASTER2026`) |
    | `COSMOS_CONNECTION` | (paste from step 10) |
    | `COSMOS_DB_NAME` | `reno` |
    | `BLOB_CONNECTION` | (paste from step 14) |
    | `BLOB_CONTAINER` | `expense-photos` |
    | `VITE_USE_MOCK` | `false` |

### G. Tell me when you're done 🎯

Once A–F are checked, send me a message with:
- ✅ "Done, everything is created"
- The SWA URL (from the portal, e.g. `https://swa-reno-tracker-...azurestaticapps.net`) — optional, just for info.

---

## My steps (after you confirm)

1. Create `api/` with Azure Functions Node 20 + TS:
   - All endpoints (`/api/auth/*`, `/api/expenses`, `/api/expenses/:id`, `/api/expenses/:id/details`, `/api/expenses/:id/photos`, `/api/exchange-rate`).
   - Auth middleware that reads `x-access-code` and validates against Cosmos.
   - Cosmos DB client with **ETag-based optimistic concurrency** (Phase 2 strategy B).
   - Blob client that uploads compressed photos → returns SAS URL valid 7 days.
   - BNR fetcher with 24h in-memory cache.
   - Auto bootstrap: on the first request, create workspace `MASTER_ACCESS_CODE` with `isMaster=true` if it doesn't exist.
2. Enable **polling** in React Query (strategy C, 20s).
3. Add `If-Match` headers + UI "Expense was modified" on 412 Conflict.
4. Add `staticwebapp.config.json` route protection.
5. Verify local build with `func start` + `VITE_USE_MOCK=false`.
6. Update `README.md` + `DEV_SETUP.md` with the real steps.

---

## ⚠️ Important notes

- **Cosmos DB free tier:** make sure to tick "Apply Free Tier Discount" at creation time. Only ONE account per subscription can have free tier — if you already use it elsewhere, you'll pay ~$24/month for minimum throughput.
- **Estimated total cost** (with free tier + light traffic): **$0–3/month** (storage account ≈$0.10 + minimal bandwidth).
- **Do NOT commit connection strings to the repo!** Only put them in the SWA Application Settings.
