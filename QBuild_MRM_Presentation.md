# QBuild Quality Rating System
## MRM (Management Review Meeting) — Business Flow & Requirements

---

## 1. Executive Summary

**QBuild** is a full-stack Quality Inspection & Rating Management System designed to digitize and streamline site inspection workflows. It replaces manual paper-based processes with a structured, auditable, multi-level approval system accessible via both **Web** and **Mobile** platforms.

### Business Problem Solved
- ❌ Paper-based inspections are slow, error-prone, and hard to track
- ❌ No centralized repository for inspection data across projects
- ❌ Difficult to enforce quality standards consistently
- ❌ No traceable audit trail for accountability
- ❌ Manual scoring is inconsistent and time-consuming

### Solution Delivered
- ✅ End-to-end digitized inspection lifecycle
- ✅ Mobile-first field inspection app with offline support
- ✅ Configurable scoring with weightages and automatic calculation
- ✅ Multi-level review workflow (Inspector → Reviewer → Manager)
- ✅ Complete audit trail with granular rejection tracking
- ✅ Photo evidence capture and management

---

## 2. Core Business Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INSPECTION LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌─────────────┐  │
│  │ PHASE    │    │ DOMAIN   │    │ SUB-     │    │ QUERIES     │  │
│  │ CREATION │───▶│ CONFIG   │───▶│ DOMAIN   │───▶│ (QUESTIONS) │  │
│  │          │    │          │    │ CONFIG   │    │             │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────┬──────┘  │
│                                                          │         │
│                                                          ▼         │
│                                          ┌────────────────────────┐│
│                                          │  INSPECTOR RESPONDS   ││
│                                          │  • YES / NO / N/A     ││
│                                          │  • NC Type (if NO)    ││
│                                          │  • Photos (if NO)     ││
│                                          │  • Comments           ││
│                                          └───────────┬────────────┘│
│                                                       │             │
│                                                       ▼             │
│                                          ┌────────────────────────┐│
│                                          │  SUBMIT FOR REVIEW    ││
│                                          └───────────┬────────────┘│
│                                                       │             │
│                                                       ▼             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              REVIEWER APPROVAL WORKFLOW                      │   │
│  │                                                              │   │
│  │  ┌──────────┐     ┌─────────────┐     ┌──────────────────┐  │   │
│  │  │  APPROVE │────▶│  MANAGER    │────▶│  SCORING ENGINE  │  │   │
│  │  │  (Whole) │     │  REVIEW     │     │  (Auto-Calculate)│  │   │
│  │  └──────────┘     └─────────────┘     └──────────────────┘  │   │
│  │                                                              │   │
│  │  ┌──────────────┐                                            │   │
│  │  │  REJECT      │───▶ Inspector resubmits                    │   │
│  │  │  • Whole     │                                            │   │
│  │  │  • Domain    │                                            │   │
│  │  │  • Sub-domain│                                            │   │
│  │  │  • Single Q  │                                            │   │
│  │  └──────────────┘                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. System Architecture (3-Tier)

```
┌─────────────────────────────────────────────────────────────┐
│                   MOBILE APP (Flutter)                       │
│  • Field Inspections • Photo Capture • Offline Support      │
│  • Push Notifications (planned)                             │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (JSON)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               BACKEND API (Node.js + Express)                │
│  • Authentication (JWT) • RBAC • Validation                 │
│  • Workflow Engine • Scoring Engine • Audit Trail           │
└──────────────────────────┬──────────────────────────────────┘
                           │ SQL
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (MySQL 8.0)                      │
│  • 25+ Tables • Connection Pooling • Indexed Queries        │
│  • Auto-migration • UTF8mb4 charset                         │
└─────────────────────────────────────────────────────────────┘

          ┌─────────────────────────────────────┐
          │       WEB FRONTEND (React + Vite)    │
          │  • Admin Dashboard                  │
          │  • Manager Dashboard                │
          │  • Reviewer Dashboard               │
          │  • Project Management               │
          │  • Reports & Spider Charts          │
          │  • User Management                  │
          └─────────────────────────────────────┘
```

---

## 4. Business Requirements Implemented

### BR-1: Multi-Level Approval Workflow
| Requirement | Implementation | Status |
|-------------|---------------|--------|
| Inspector submits inspection for review | Mobile app → Submit → Status: `submitted` | ✅ |
| Reviewer can approve/reject with comments | Web reviewer dashboard | ✅ |
| Granular rejection (query/domain/inspection) | Partial rejection with cascade logic | ✅ |
| Manager final approval | Manager dashboard → Final approve/reject | ✅ |
| Automatic scoring after manager approval | Scoring service triggers on approve | ✅ |

### BR-2: Role-Based Access Control
| Role | Privileges |
|------|-----------|
| **Admin** | Full access, user management, system configuration |
| **Manager** | Create projects, assign users, final approval, reports |
| **Reviewer** | Review inspections, approve/reject, provide feedback |
| **Inspector** | Field inspections, response submission, photo upload |
| **Viewer** | Read-only dashboard and reports |

### BR-3: Configurable Scoring & Weightage
- Domains can be assigned weightages (must sum to 100%)
- Sub-domains within each domain can be weighted independently
- Scoring formula: `(YES / (YES + NO)) × 10` (out of 10)
- N/A responses are excluded from scoring
- Invalid sub-domains (any PRIMARY = NO/NA) have weight redistributed
- Grades: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

### BR-4: Photo Evidence Management
- Camera/gallery integration in mobile app
- Multiple photos per query
- Photos stored with URL references in database
- Photos persisted across resubmissions (recently fixed bug)
- Displayed in reviewer/manager review screens

### BR-5: Audit Trail
| Event | Stored Data |
|-------|------------|
| Inspection creation | Created by, timestamp, project |
| Response submission | Inspector, value, timestamp |
| Approval | Approver role, timestamp, notes |
| Rejection | Rejection type, scope, reason, snapshot of responses |
| Resubmission | Updated responses, restored editability |

### BR-6: Phased Project Support
- Projects can have multiple phases (Phase 1, Phase 2, etc.)
- Each phase has independent domain/sub-domain/query configuration
- Phase 1 inspection must complete before Phase 2 begins
- Spider charts generated per phase

---

## 5. Business Process Flow (End-to-End)

### Step 1: Project Setup (Manager/Admin)
```
Manager creates project → Sets client details → Assigns inspector/reviewer
    → Configures phase 1 → Adds domains with weightages
    → Adds sub-domains with weightages → Links queries
```

### Step 2: Inspector Mobile App
```
Receives inspection assignment → Accepts → Opens domain
    → Opens sub-domain → Answers queries (YES/NO/NA)
    → Captures photos (if NO) → Adds comments → Submits sub-domain
    → Submits all domains → Final submission for review
```

### Step 3: Reviewer Web Review
```
Dashboard shows pending inspections → Opens inspection
    → Reviews all responses & photos → Decision:
        • APPROVE: Inspection proceeds to manager
        • REJECT ENTIRE: Inspector must redo everything
        • REJECT DOMAIN: Only that domain needs re-inspection
        • REJECT SUB-DOMAIN: Only that section needs fixes
        • REJECT QUERY: Only specific question needs correction
```

### Step 4: Inspector Resubmission
```
Receives rejection notification → Opens rejected items
    → Fixes only rejected items (others locked)
    → Resubmits for review
```

### Step 5: Manager Final Approval
```
Reviews approved-by-reviewer inspections → Final check
    → APPROVE: Triggers scoring engine → Spider chart generated
    → REJECT: Sent back to reviewer
```

### Step 6: Reporting & Analytics
```
View spider charts per project/phase
    → View domain-wise scores
    → Export reports (JSON/CSV)
    → Track project completion status
```

---

## 6. Recent Technical Fixes (Evidence of Maturity)

| Issue | Fix Applied | Impact |
|-------|------------|--------|
| 500 error on projects page | Fixed wrong column references (`question_id` → `query_id`) | Projects page loads correctly |
| YES responses appearing as N/A | Fixed LEFT JOIN condition (removed `r.domain_id` requirement) | Reviewer sees correct responses |
| Cascade overwriting YES answers | Added skip logic - cascade only applies to unanswered secondaries | Inspector answers preserved |
| Photos lost on resubmission | Mobile app now preserves existing photos in submission payload | Photos survive resubmission cycle |

---

## 7. Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | **Node.js + Express** | REST API server |
| Database | **MySQL 8.0** | Data persistence |
| Web Frontend | **React + Vite + Tailwind CSS** | Desktop browser interface |
| Mobile | **Flutter/Dart** | Android/iOS field app |
| Auth | **JWT + bcrypt** | Authentication & security |
| Scoring | **Custom engine** | Automated quality rating |
| Deployment | **PM2**, Docker-ready | Production hosting |

---

## 8. Key Metrics & Capabilities

| Metric | Capability |
|--------|-----------|
| Inspection lifecycle | 6 states (Draft → Submitted → Reviewed → Approved/Rejected → Resubmitted → Completed) |
| Rejection levels | 4 levels (Query, Sub-domain, Domain, Inspection) |
| User roles | 5 roles (Admin, Manager, Reviewer, Inspector, Viewer) |
| Scoring precision | 2 decimal places with grade mapping |
| Photo storage | URL-based, multiple per query |
| Audit trail | Complete history with snapshot restoration |
| Multi-phase | Unlimited phases per project |

---

## 9. Value Proposition

| For | Benefit |
|-----|---------|
| **Inspectors** | Mobile app for field use, photo capture, offline capable |
| **Reviewers** | Structured review interface, granular rejection, audit trail |
| **Managers** | Dashboard analytics, spider charts, final approval control |
| **Organization** | Standardized quality process, complete traceability, data-driven decisions |

---

*Prepared for MRM — Management Review Meeting*  
*QBuild System v1.0*