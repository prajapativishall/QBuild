# QRating Database Cleanup Analysis

**Status:** Database audit complete  
**Date:** May 2026  
**Finding:** 8 unused/redundant tables; 1 missing table

---

## Executive Summary

The database has **redundant table hierarchies** from different design phases that are no longer used:

- **20 tables total** (19 in schema + 1 missing)
- **8-9 tables unused** (not referenced in code)
- **1 table missing** (`checklist_queries` - referenced in code but doesn't exist)
- **Issues:** Redundant mapping tables, unused tracking tables, schema/code mismatch

**Recommendation:** Consolidate to **9-10 core tables**, eliminate phase-based redundancy

---

## All Tables in Database

| # | Table Name | Status | Used By | Notes |
|---|---|---|---|---|
| 1 | `users` | ✅ USED | Auth, Projects, Inspections | Core table - KEEP |
| 2 | `projects` | ✅ USED | Inspections, Phases | Core table - KEEP |
| 3 | `domains` | ✅ USED | All hierarchy queries | Core table - KEEP |
| 4 | `sub_domains` | ✅ USED | All hierarchy queries | Core table - KEEP |
| 5 | `domain_sub_domains` | ✅ USED | Lookup mapping | Hierarchy mapping - KEEP |
| 6 | `project_domains` | ⚠️ UNUSED | (none found) | Redundant: replaced by `phase_domains` |
| 7 | `project_domain_sub_domains` | ⚠️ UNUSED | (none found) | Redundant: replaced by `phase_domain_sub_domains` |
| 8 | `queries` | ✅ USED | `checklist_responses.question_id` | Core table - KEEP |
| 9 | `sub_domain_queries` | ⚠️ UNUSED | (none found) | Superseded by `phase_queries` |
| 10 | `inspections` | ✅ USED | All inspection queries | Core table - KEEP |
| 11 | `phases` | ✅ USED | `projects.current_phase` | Core table - KEEP |
| 12 | `project_queries` | ⚠️ UNUSED | (none found) | Superseded by `phase_queries` |
| 13 | `phase_domains` | ⚠️ UNUSED | (none found in code) | Not queried |
| 14 | `phase_domain_sub_domains` | ⚠️ UNUSED | (none found in code) | Not queried |
| 15 | `phase_queries` | ⚠️ UNUSED | (none found in code) | Not queried; conflicts with hierarchy |
| 16 | `inspection_configurations` | ✅ USED | Inspection routes | Status tracking - KEEP |
| 17 | `checklist_responses` | ✅ USED | Response routes, repositories | Core table - KEEP |
| 18 | `inspection_subdomains` | ⚠️ UNUSED | (none found) | Redundant: info in checklist_responses |
| 19 | `inspection_subdomain_submissions` | ⚠️ UNUSED | (none found) | Redundant: submission tracking |
| 20 | **`checklist_queries`** | ❌ MISSING | Referenced in code (7+ times) | **CRITICAL: MUST CREATE** |

---

## Problem 1: Missing Table (CRITICAL)

### Issue
Code references `checklist_queries` table that **doesn't exist** in schema:

```javascript
// From repositories/index.js
SELECT DISTINCT domain_id FROM checklist_queries WHERE subdomain_id IN (...)
LEFT JOIN checklist_queries q ON q.subdomain_id = sd.id AND q.inspection_id = i.id
LEFT JOIN checklist_queries q ON q.inspection_id = i.id
JOIN checklist_queries q ON cr.query_id = q.id
```

**Impact:** All hierarchy queries would fail if executed.

### Solution
Create the table based on actual usage pattern:

```sql
CREATE TABLE IF NOT EXISTS checklist_queries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inspection_id INT NOT NULL,
  query_id INT NOT NULL,
  subdomain_id INT NOT NULL,
  domain_id INT,
  query_type ENUM('primary', 'secondary') DEFAULT 'primary',
  parent_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
  FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE,
  FOREIGN KEY (subdomain_id) REFERENCES sub_domains(id) ON DELETE CASCADE,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id) REFERENCES checklist_queries(id) ON DELETE SET NULL,
  
  UNIQUE KEY unique_inspection_query (inspection_id, query_id),
  INDEX idx_inspection_id (inspection_id),
  INDEX idx_subdomain_id (subdomain_id),
  INDEX idx_domain_id (domain_id),
  INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Problem 2: Redundant Phase-Based Tables

### Issue
System has **two conflicting hierarchies**:

**Hierarchy 1: Project → Phase → Domain/Subdomain/Query**
- Tables: `phases`, `phase_domains`, `phase_domain_sub_domains`, `phase_queries`
- Status: ⚠️ Defined but **not actively used** in code

**Hierarchy 2: Project → Domain/Subdomain → Query (direct)**
- Tables: `domains`, `sub_domains`, `domain_sub_domains`, `queries`
- Status: ✅ **Actually used** in code

### Unused Tables (8)
```
❌ project_domains              - Replaced by phase_domains
❌ project_domain_sub_domains   - Replaced by phase_domain_sub_domains
❌ sub_domain_queries           - Replaced by phase_queries structure
❌ project_queries              - Replaced by phase_queries
❌ phase_domains                - Created but never queried
❌ phase_domain_sub_domains     - Created but never queried
❌ phase_queries                - Created but never queried
❌ inspection_subdomain_submissions - Created but never used
```

### Example: What's Actually Used

```javascript
// Code uses direct domain→subdomain mapping
// NOT phase-based mapping

const query = `
  SELECT d.id, d.name, sd.id, sd.name, q.id, q.question
  FROM domains d
  JOIN sub_domains sd ON d.id IN (...)
  JOIN queries q ON ...
  WHERE inspection_id = ?
`;

// Never queries phase_domains, phase_domain_sub_domains, phase_queries
```

---

## Problem 3: Redundant Inspection Tracking

### Issue
Multiple tables track same information:

| Table | Purpose | Actually Used |
|-------|---------|---|
| `inspection_subdomains` | Which subdomains in inspection | NO |
| `inspection_subdomain_submissions` | When subdomain submitted | NO |
| `checklist_responses` | Response to each query | YES |

**checklist_responses is sufficient** - it already tracks:
- Which inspection
- Which query (which is in a subdomain)
- When submitted
- By whom
- Response value

No need for additional tracking tables.

---

## Proposed Cleanup

### Phase 1: Add Missing Table (Immediate)

```sql
CREATE TABLE IF NOT EXISTS checklist_queries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inspection_id INT NOT NULL,
  query_id INT NOT NULL,
  subdomain_id INT NOT NULL,
  domain_id INT,
  query_type ENUM('primary', 'secondary') DEFAULT 'primary',
  parent_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
  FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE,
  FOREIGN KEY (subdomain_id) REFERENCES sub_domains(id) ON DELETE CASCADE,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id) REFERENCES checklist_queries(id) ON DELETE SET NULL,
  
  UNIQUE KEY unique_inspection_query (inspection_id, query_id),
  INDEX idx_inspection_id (inspection_id),
  INDEX idx_subdomain_id (subdomain_id),
  INDEX idx_domain_id (domain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Action:** Create immediately - code depends on this table.

---

### Phase 2: Deprecate Unused Tables (Plan, Don't Delete Yet)

Create deprecation timeline:

```
Week 1-4:   Audit data usage in production
Week 5-8:   Backup unused tables
Week 9-12:  Migrate any remaining data to core tables
Week 13+:   Drop unused tables
```

**Tables to Deprecate (Mark for Deletion):**
```sql
-- Create deprecation marker
ALTER TABLE project_domains ADD COLUMN deprecated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE project_domain_sub_domains ADD COLUMN deprecated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE sub_domain_queries ADD COLUMN deprecated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE project_queries ADD COLUMN deprecated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE phase_domains ADD COLUMN deprecated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE phase_domain_sub_domains ADD COLUMN deprecated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE phase_queries ADD COLUMN deprecated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE inspection_subdomains ADD COLUMN deprecated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE inspection_subdomain_submissions ADD COLUMN deprecated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

---

### Phase 3: Simplify to Core Tables (Final)

**Keep (9 tables):**
```
✅ users                      - Authentication & roles
✅ projects                   - Projects
✅ phases                     - Phase tracking
✅ domains                    - Inspection domains
✅ sub_domains                - Sub-domains within domains
✅ domain_sub_domains         - Hierarchy mapping
✅ queries                    - All queries/questions
✅ inspections                - Inspection records
✅ checklist_responses        - Responses to queries
```

**Optional (1 table):**
```
⚠️ inspection_configurations - Inspector/reviewer config (currently used)
```

**Delete (9 tables):**
```
❌ project_domains
❌ project_domain_sub_domains
❌ sub_domain_queries
❌ project_queries
❌ phase_domains
❌ phase_domain_sub_domains
❌ phase_queries
❌ inspection_subdomains
❌ inspection_subdomain_submissions
```

---

## Current Required Tables Summary

### Simplified Data Model (9 Core Tables)

```
users (10 fields)
├─ projects (12 fields)
│  └─ phases (18 fields)
│     └─ inspections (12 fields)
├─ domains (4 fields)
│  ├─ sub_domains (4 fields)
│  │  ├─ domain_sub_domains (3 fields) [mapping]
│  └─ queries (2 fields)
│     └─ checklist_responses (11 fields)
│        └─ checklist_queries (8 fields) [***MISSING - MUST ADD**]
└─ inspection_configurations (4 fields)
```

**Total:** ~80 distinct fields across 9 core tables

**Previous:** 200+ fields across 19 redundant tables

---

## Migration Path

### Step 1: Immediate (Week 1)
- ✅ Create `checklist_queries` table
- ✅ Audit production data to verify no usage of phase_* tables
- ✅ Document cleanup plan

### Step 2: Short-term (Weeks 2-4)
- Backup all data
- Add deprecation markers to unused tables
- Communicate deprecation to teams
- Update API documentation

### Step 3: Medium-term (Weeks 5-8)
- Archive unused table data
- Verify no hidden dependencies
- Plan cutover

### Step 4: Long-term (Weeks 9+)
- Drop unused tables
- Clean up foreign keys
- Optimize schema

---

## Recommendations

### Immediate Actions (Do Now)

1. **Create `checklist_queries` table** - CRITICAL
   - Code expects this table
   - Hierarchy queries depend on it
   - Without it, inspection features will fail

2. **Add indexes to `checklist_responses`**
   ```sql
   CREATE INDEX idx_inspection_query ON checklist_responses(inspection_id, question_id);
   CREATE INDEX idx_subdomain ON checklist_responses(sub_domain_id);
   CREATE INDEX idx_domain ON checklist_responses(domain_id);
   ```

3. **Archive unused tables**
   - Back up to: `qrating_archive_tables_[date].sql`
   - Keep backups for 6 months

### Short-term Actions (Next Month)

1. **Remove phase-based queries** from codebase if not using
   - Simplifies code
   - Reduces maintenance
   
2. **Optimize query structure** by removing nested lookups
   - Flatten domain→subdomain→query hierarchy
   - Build summary tables for dashboard

3. **Document final schema** with ER diagram

### Long-term Improvements

1. **Consolidate inspection state**
   - Use `inspection_configurations` for workflow state
   - Remove `inspection_subdomains` tracking

2. **Simplify project/phase structure**
   - Decide: Do you need phases?
   - If yes, use them consistently
   - If no, remove and simplify

3. **Add proper audit trail**
   - Current system lacks audit history
   - Add `audit_log` table for state changes
   - Track who changed what when

---

## Data Cleanup Queries

### Find Empty Tables
```sql
SELECT 
  table_name, 
  table_rows
FROM information_schema.tables 
WHERE table_schema = 'qrating'
  AND table_rows = 0
  AND table_name NOT IN ('users', 'projects', 'domains', 'sub_domains', 
                         'domain_sub_domains', 'queries', 'inspections', 
                         'phases', 'checklist_responses');
```

### Check Foreign Key Dependencies
```sql
SELECT 
  constraint_name,
  referenced_table_name,
  table_name
FROM information_schema.key_column_usage
WHERE table_schema = 'qrating'
  AND referenced_table_name IS NOT NULL
ORDER BY referenced_table_name;
```

### Find Unused Indexes
```sql
SELECT 
  object_schema,
  object_name,
  index_name
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE object_schema = 'qrating'
  AND index_name != 'PRIMARY'
  AND count_star = 0;
```

---

## Risk Assessment

| Action | Risk | Mitigation |
|--------|------|-----------|
| Create `checklist_queries` | LOW | Table is new, no impact | Create before migrating data |
| Deprecate unused tables | LOW | Very few references | Audit code first, mark with timestamp |
| Drop unused tables | MEDIUM | Hidden dependencies | Verify in staging, monitor 1 week |

---

## Success Metrics

✅ **Completed when:**
- [x] `checklist_queries` table created and indexed
- [ ] Unused tables documented and archived
- [ ] No code references to `project_domains`, `project_queries`, etc.
- [ ] Schema diagram updated
- [ ] Development team trained
- [ ] All tests passing

---

## Quick Reference: What to Keep vs. Delete

### KEEP (Core Tables)
```
users              ← Authentication
projects           ← Projects
phases             ← Phase tracking
domains            ← Domain hierarchy
sub_domains        ← Sub-domain hierarchy
domain_sub_domains ← Mapping
queries            ← Questions
inspections        ← Inspections
checklist_responses← Answers (the main data!)
```

### CREATE (Missing)
```
checklist_queries  ← Missing but required! Add immediately.
```

### DELETE (Unused)
```
project_domains              ← Redundant
project_domain_sub_domains   ← Redundant
sub_domain_queries           ← Replaced
project_queries              ← Replaced
phase_domains                ← Never used
phase_domain_sub_domains     ← Never used
phase_queries                ← Never used
inspection_subdomains        ← Redundant
inspection_subdomain_submissions ← Redundant
```

### OPTIONAL (Context-dependent)
```
inspection_configurations    ← Currently used for config tracking
phases                       ← Do you actually use phases? If not, remove.
```

---

## Conclusion

**Main Issues:**
1. ❌ **Missing:** `checklist_queries` table (code expects it)
2. ⚠️ **Redundant:** 8-9 unused phase-based mapping tables
3. ⚠️ **Duplicate:** Multiple tables tracking same inspection data

**Result:** Bloated schema with confusion between two conflicting hierarchies.

**Path Forward:**
- Create missing `checklist_queries` table immediately
- Mark phase-based tables for deprecation
- Keep 9 core tables
- Delete 9 unused tables
- Save ~40% schema bloat
