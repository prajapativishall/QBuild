# QRating Database Table Audit

**Date:** May 2026  
**Purpose:** Identify which tables are actively used vs. candidates for cleanup

---

## Summary

| Status | Count |
|--------|-------|
| ✅ **Active (in use)** | 17 |
| ⚠️ **Legacy (can drop)** | 9 |
| **Total** | **26** |

---

## ✅ ACTIVE TABLES (Keep)

These tables are actively referenced in the backend codebase for CRUD operations, queries, and business logic.

| # | Table | Purpose | Referenced In |
|---|-------|---------|---------------|
| 1 | `users` | User accounts, authentication, roles (admin, inspector, reviewer, manager, viewer) | authController, all controllers, project.service, reviewService |
| 2 | `projects` | Core project entity — name, client details, status, description | project.controller, project.service, all dashboards |
| 3 | `domains` | Inspection domain categories (Safety, Quality, etc.) | domain.controller, mobile.controller, weightage.controller |
| 4 | `sub_domains` | Sub-categories under domains | sub_domain.controller, mobile.controller, weightage.controller |
| 5 | `queries` | Question bank (independent question text) | query.controller, query.service, mobile.controller |
| 6 | `sub_domain_queries` | Junction linking sub_domains ↔ queries with type/order | query.controller, query.service, project.controller |
| 7 | `domain_sub_domains` | Weightage mapping between domains ↔ sub_domains | domain.controller, scoring.service |
| 8 | `inspections` | Inspection lifecycle — status, approval_status, reviewer/manager IDs, dates, notes | mobile.controller, manager.controller, reviewer.controller, scoring.controller |
| 9 | `phases` | Phase metadata — description, start_date, end_date, assigned users, inspection_id | project.controller (createPhase/updatePhase/getPhaseConfiguration/getProjectPhases) |
| 10 | `project_queries` | Project-specific query assignments with phase_number, domain, sub-domain | project.controller, response.service, query.service |
| 11 | `phase_domains` | Domain weightage per project phase | project.controller, mobile.controller, manager.controller, weightage.controller |
| 12 | `phase_domain_sub_domains` | Sub-domain weightage per project phase | project.controller, mobile.controller, manager.controller, weightage.controller |
| 13 | `phase_queries` | Query-to-phase assignments with weightage | project.controller, mobile.controller, manager.controller, response.service |
| 14 | `responses` | Inspection query responses — YES/NO/NA, NC type, photos, comments | response.controller, response.service, mobile.controller |
| 15 | `inspection_configurations` | Inspector/reviewer assignment per inspection | mobile.controller |
| 16 | `inspection_subdomain_submissions` | Sub-domain submission tracking (submitted_by, is_rejected) | mobile.controller, project.controller |
| 17 | `inspection_rejection_history` | Rejection audit trail — who rejected what, when, why | project.controller, manager.controller |

---

## ⚠️ LEGACY / UNUSED TABLES (Can be dropped)

These tables are either **not referenced in any business logic**, **replaced by newer tables**, or **only exist in database.sql but not in db.js auto-schema**.

### 1. `scaffolds` — ❌ Drop (Unused)
- **Purpose:** Template library for rapid project setup
- **Created in:** db.js (line 875) — `CREATE TABLE IF NOT EXISTS scaffolds`
- **Referenced in backend code:** ❌ **None** — only schema creation
- **Referenced in frontend:** Layout.jsx has a sidebar link to `/scaffolds`, but the API endpoint (`scaffoldApi` in api.js) contains only placeholder stubs: *"All scaffold-related endpoints and functionality have been deleted"*
- **Verdict:** Feature was started but never completed. Safe to drop.

### 2. `scaffold_domains` — ❌ Drop (Unused)
- **Purpose:** Domains within a scaffold template
- **Created in:** db.js (line 889)
- **Referenced in backend code:** ❌ **None**
- **Verdict:** Belongs to the incomplete scaffold feature. Safe to drop.

### 3. `scaffold_sub_domains` — ❌ Drop (Unused)
- **Purpose:** Sub-domains within a scaffold template
- **Created in:** db.js (line 904)
- **Referenced in backend code:** ❌ **None**
- **Verdict:** Belongs to the incomplete scaffold feature. Safe to drop.

### 4. `scaffold_queries` — ❌ Drop (Unused)
- **Purpose:** Queries within a scaffold template
- **Created in:** db.js (line 920)
- **Referenced in backend code:** ❌ **None**
- **Verdict:** Belongs to the incomplete scaffold feature. Safe to drop.

### 5. `checklist_items` — ❌ Drop (Legacy — Replaced)
- **Purpose:** Legacy checklist items from earlier system version
- **Created in:** database.sql (not in db.js — only auto-migrates columns to existing table)
- **Referenced in:** checklistController.js (legacy endpoints), response.service.js (legacy joins)
- **Note:** The `responses` table is the modern replacement. `checklist_items` uses the old `checklist_responses` join pattern.
- **Verdict:** Legacy table from before the `queries` + `responses` system existed. The `checklistController.js` is likely dead code.

### 6. `checklist_responses` — ❌ Drop (Legacy — Replaced)
- **Purpose:** Legacy response storage from earlier version
- **Created in:** database.sql (not in db.js — only auto-migrates columns to existing table)
- **Referenced in:** checklistController.js (legacy), project.controller.js (spider chart queries), scoring.service.js
- **Note:** The `responses` table is the modern replacement. However, some spider chart and scoring queries still join with `checklist_responses` — **must migrate these queries to `responses` before dropping**.
- **Verdict:** Can drop only after migrating spider chart queries to use `responses` table.

### 7. `project_domains` — ❌ Drop (Legacy — Replaced by `phase_domains`)
- **Purpose:** Old domain-project mapping (without phase support)
- **Created in:** database.sql only — **NOT in db.js auto-schema**
- **Referenced in:** project.service.js (delete + insert during project creation — lines 765, 779)
- **Note:** Replaced by `phase_domains` which supports multi-phase projects
- **Verdict:** Legacy table from before phased projects. Must remove the delete/insert references in project.service.js first.

### 8. `project_domain_sub_domains` — ❌ Drop (Legacy — Replaced by `phase_domain_sub_domains`)
- **Purpose:** Old sub-domain-project mapping (without phase support)
- **Created in:** database.sql only — **NOT in db.js auto-schema**
- **Referenced in:** project.service.js (delete + insert during project creation — lines 764, 824)
- **Note:** Replaced by `phase_domain_sub_domains` which supports multi-phase projects
- **Verdict:** Legacy table. Must remove the delete/insert references in project.service.js first.

### 9. `inspection_subdomains` — ❌ Drop (Unused)
- **Purpose:** Unknown/undefined — appears to be an early design table
- **Created in:** database.sql only — **NOT in db.js auto-schema**
- **Referenced in backend code:** ❌ **None**
- **Verdict:** Completely unused. Safe to drop immediately.

---

## Final Drop Recommendation Order

| Priority | Table | Risk | Prerequisite |
|----------|-------|------|-------------|
| 1 | `inspection_subdomains` | None | None — drop immediately |
| 2 | `scaffolds`, `scaffold_domains`, `scaffold_sub_domains`, `scaffold_queries` | None | None — drop immediately |
| 3 | `project_domains`, `project_domain_sub_domains` | Low | Remove delete/insert lines 764-765, 779, 824 from project.service.js |
| 4 | `checklist_items`, `checklist_responses` | Medium | Migrate spider chart queries in project.controller.js and scoring.service.js to use `responses` table |

---

## SQL Commands to Drop

```sql
-- Priority 1: Completely unused
DROP TABLE IF EXISTS inspection_subdomains;

-- Priority 2: Scaffold feature was never completed
DROP TABLE IF EXISTS scaffold_queries;
DROP TABLE IF EXISTS scaffold_sub_domains;
DROP TABLE IF EXISTS scaffold_domains;
DROP TABLE IF EXISTS scaffolds;

-- Priority 3: Legacy project tables replaced by phase_*
DROP TABLE IF EXISTS project_domain_sub_domains;
DROP TABLE IF EXISTS project_domains;

-- Priority 4: Legacy checklist system replaced by queries + responses
-- (Only after migrating queries — requires code changes first)
DROP TABLE IF EXISTS checklist_responses;
DROP TABLE IF EXISTS checklist_items;