# QBuild Quality Rating System — Complete Documentation

---

**Version:** 1.0  
**Last Updated:** May 2026  
**Author:** Architecture & Engineering Team  
**Repository:** [https://github.com/prajapativishall/QBuild](https://github.com/prajapativishall/QBuild)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technical Documentation](#2-technical-documentation)
3. [Architecture Deep Dive](#3-architecture-deep-dive)
4. [Handover Documentation](#4-handover-documentation)
5. [User Manual](#5-user-manual)
6. [Skills Required](#6-skills-required)
7. [Troubleshooting & FAQ](#7-troubleshooting--faq)
8. [Appendices](#8-appendices)

---

## 1. PROJECT OVERVIEW

### 1.1 What is QBuild?

QBuild is a **Quality Rating & Inspection Management System** — a full-stack enterprise application that enables structured inspection workflows with multi-level approval. It allows inspectors to perform site inspections, reviewers to approve/reject inspections, and managers to oversee quality across projects.

The platform consists of three components:
- **Backend API** (Node.js / Express / MySQL) — REST API server
- **Web Frontend** (React + Vite + Tailwind CSS) — Desktop browser interface
- **Mobile App** (Flutter / Dart) — Android/iOS inspection app

### 1.2 Core Business Workflow

```
Inspector → Creates Inspection → Fills Responses → Submits
    ↕
Reviewer → Reviews Inspection → Approves OR Rejects (partially/fully)
    ↕
Manager → Reviews Approved Inspections → Final Approval
    ↕
Reports & Analytics → Dashboard & Export
```

### 1.3 Key Features

| Feature | Description |
|---------|-------------|
| Inspection Management | Create, edit, submit inspections with structured checklists |
| Multi-Level Approval | Reviewer approval → Manager approval workflow |
| Partial Rejection | Reject specific queries/subdomains without full rejection |
| RBAC | Role-Based Access Control (Admin, Manager, Reviewer, Inspector, Viewer) |
| Mobile-First | Dedicated Flutter app for field inspections |
| Photo Upload | Attach site photos to inspection responses |
| Scoring & Weightage | Automated scoring with configurable domain/subdomain weightage |
| Dashboard Analytics | Real-time inspection metrics and performance tracking |
| Audit Trail | Complete history of all state changes and actions |
| Query Management | Manage reusable question bank for inspections |
| Phased Projects | Support for multi-phase project inspections |

### 1.4 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Backend Runtime** | Node.js (v16+) |
| **Web Framework** | Express.js |
| **Database** | MySQL 8.0+ (mysql2 driver, connection pooling) |
| **Authentication** | JWT (bcrypt password hashing) |
| **Security** | Helmet, CORS, Rate Limiting |
| **Logging** | Winston, Morgan |
| **Validation** | Express Validator |
| **Web Frontend** | React 18 + Vite + Tailwind CSS |
| **Mobile** | Flutter / Dart |
| **Process Manager** | PM2 (production) |
| **Containerization** | Docker (optional) |

---

## 2. TECHNICAL DOCUMENTATION

### 2.1 Project Structure

```
QBuild/
├── backend/                          # Node.js API Server
│   ├── src/
│   │   ├── app.js                    # Express application entry point
│   │   ├── config/
│   │   │   └── db.js                 # Database connection pool & schema management
│   │   ├── controllers/              # HTTP request handlers
│   │   │   ├── authController.js
│   │   │   ├── project.controller.js
│   │   │   ├── domain.controller.js
│   │   │   ├── sub_domain.controller.js
│   │   │   ├── query.controller.js
│   │   │   ├── checklistController.js
│   │   │   ├── scoring.controller.js
│   │   │   ├── reviewer.controller.js
│   │   │   ├── manager.controller.js
│   │   │   ├── mobile.controller.js
│   │   │   ├── response.controller.js
│   │   │   └── weightage.controller.js
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT authentication middleware
│   │   │   ├── errorHandler.js       # Global error handling
│   │   │   ├── rbac.js               # Role-based access middleware
│   │   │   └── validation.js         # Input validation middlewares
│   │   ├── models/
│   │   │   └── User.js               # User model
│   │   ├── repositories/
│   │   │   └── index.js              # Repository pattern base classes
│   │   ├── routes/                   # Express route definitions
│   │   │   ├── auth.routes.js
│   │   │   ├── project.routes.js
│   │   │   ├── domain.routes.js
│   │   │   ├── sub_domain.routes.js
│   │   │   ├── query.routes.js
│   │   │   ├── checklist.routes.js
│   │   │   ├── inspection.routes.js
│   │   │   ├── response.routes.js
│   │   │   ├── scoring.routes.js
│   │   │   ├── reviewer.routes.js
│   │   │   ├── manager.routes.js
│   │   │   ├── mobile.routes.js
│   │   │   ├── user.routes.js
│   │   │   ├── weightage.routes.js
│   │   │   └── weightageManagement.routes.js
│   │   ├── services/
│   │   │   ├── project.service.js
│   │   │   ├── domain.service.js
│   │   │   ├── sub_domain.service.js
│   │   │   ├── query.service.js
│   │   │   ├── scoring.service.js
│   │   │   ├── response.service.js
│   │   │   ├── reviewService.js
│   │   │   ├── weightageValidation.service.js
│   │   │   ├── workflow/
│   │   │   │   └── workflowEngine.js  # State machine & rejection engine
│   │   │   └── domain/
│   │   │       └── index.js           # Domain service layer (InspectionService, ReviewService, ResponseService, AuditService)
│   │   ├── utils/
│   │   │   └── logger.js             # Winston logging configuration
│   │   └── workflow/
│   │       └── reviewWorkflow.js     # Review workflow business logic
│   ├── database/
│   │   └── (schema files, migrations)
│   ├── tests/                        # Jest test files
│   ├── migrations/                   # Database migration scripts
│   └── package.json
│
├── QBuild-Web/                      # React Web Frontend
│   ├── src/
│   │   ├── App.jsx                   # Root React component
│   │   ├── main.jsx                  # Application entry
│   │   ├── api/
│   │   │   └── axios.js              # Axios HTTP client configuration
│   │   ├── components/               # Reusable React components
│   │   │   ├── Header.jsx
│   │   │   ├── Layout.jsx
│   │   │   ├── ProjectCard.jsx
│   │   │   ├── CreateInspectionForm.jsx
│   │   │   ├── SpiderChart.jsx
│   │   │   ├── PhaseChartModal.jsx
│   │   │   ├── PhaseManagement.jsx
│   │   │   ├── PhaseManagementModal.jsx
│   │   │   └── QueryManagementModal.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Authentication state context
│   │   ├── hooks/
│   │   │   └── useAuth.js            # Auth hook
│   │   ├── pages/                    # Page-level components
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ManagerDashboard.jsx
│   │   │   ├── ReviewerDashboard.jsx
│   │   │   ├── ScoreDashboard.jsx
│   │   │   ├── Projects.jsx
│   │   │   ├── ProjectDetails.jsx
│   │   │   ├── Domains.jsx
│   │   │   ├── SubDomains.jsx
│   │   │   ├── Inspections.jsx
│   │   │   ├── InspectionForm.jsx
│   │   │   ├── Queries.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── UserManagement.jsx
│   │   │   ├── MobileChecklistAccept.jsx
│   │   │   ├── MobileDashboard.jsx
│   │   │   ├── MobileInspection.jsx
│   │   │   ├── ManagerInspectionReview.jsx
│   │   │   └── ReviewerInspectionReview.jsx
│   │   ├── routes/
│   │   │   └── AppRoutes.jsx         # Route definitions
│   │   ├── services/
│   │   │   ├── api.js                # Backend API service layer
│   │   │   └── responseService.js    # Response-specific API calls
│   │   └── styles/                   # CSS stylesheets
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
│
├── QBuild-Mobile/                   # Flutter Mobile App
│   ├── lib/
│   │   ├── main.dart                 # App entry point
│   │   └── screens/
│   │       ├── dashboard_screen.dart
│   │       ├── inbox_screen.dart
│   │       ├── inspection_domains_screen.dart
│   │       ├── inspection_list_screen.dart
│   │       ├── inspection_queries_screen.dart
│   │       └── rejected_inbox_screen.dart
│   └── pubspec.yaml
│
├── .env.example                      # Environment template
├── ARCHITECTURE.md                   # Full architecture design document
├── REFACTORING_SUMMARY.md            # Refactoring plan summary
├── IMPLEMENTATION_GUIDE.md           # Step-by-step 7-phase migration plan
├── DEPLOYMENT.md                     # Deployment instructions
├── TESTING.md                        # Testing guide
├── QUICK_REFERENCE.md                # Quick architectural reference
├── DATABASE_CLEANUP.md               # Database cleanup instructions
├── package.json                      # Workspace root
└── README.md                         # Project README
```

### 2.2 Database Schema

The database uses MySQL 8.0 with utf8mb4 charset. Key tables include:

| Table | Purpose |
|-------|---------|
| `users` | User accounts, authentication, roles |
| `projects` | Project information, client details |
| `phases` | Multi-phase project tracking |
| `domains` | Inspection domains (e.g., Safety, Quality) |
| `sub_domains` | Sub-categories under domains |
| `queries` | Question bank (independent of domains) |
| `sub_domain_queries` | Junction: sub_domain ↔ query with type/order |
| `project_queries` | Project-specific query assignments (with phase) |
| `phase_domains` | Domain weightage per project phase |
| `phase_domain_sub_domains` | Sub-domain weightage per project phase |
| `inspections` | Core inspection records with state/approval tracking |
| `responses` | Inspection query responses with photos/comments |
| `checklist_items` | Legacy checklist items |
| `checklist_responses` | Legacy checklist responses with rejection tracking |
| `inspection_subdomain_submissions` | Sub-domain submission tracking |
| `inspection_rejection_history` | Audit trail for rejections |
| `inspection_configurations` | Inspector/reviewer assignment |
| `scaffolds` | Scaffolding library templates |
| `scaffold_domains` / `scaffold_sub_domains` / `scaffold_queries` | Scaffolding structure |

### 2.3 API Endpoints Reference

#### Authentication
```
POST /api/auth/register       — Register new user
POST /api/auth/login          — User login (returns JWT)
POST /api/auth/refresh        — Refresh access token
```

#### User Management
```
GET    /api/users/profile                — Get current user
PUT    /api/users/profile                — Update profile
POST   /api/users/change-password        — Change password
GET    /api/users/admin/users            — List all users (Admin)
GET    /api/users/admin/users/:userId    — Get user by ID
PUT    /api/users/admin/users/:userId    — Update user
DELETE /api/users/admin/users/:userId    — Delete user
```

#### Projects
```
GET    /api/projects                     — List projects (filtered by access)
POST   /api/projects                     — Create project
GET    /api/projects/:projectId          — Get project details
PUT    /api/projects/:projectId          — Update project
DELETE /api/projects/:projectId          — Delete project
GET    /api/projects/:projectId/users    — List project users
POST   /api/projects/:projectId/users/assign — Assign user to project
```

#### Domains & Sub-Domains
```
GET    /api/domains                 — List domains
POST   /api/domains                 — Create domain
GET    /api/sub_domains             — List sub-domains
POST   /api/sub_domains             — Create sub-domain
```

#### Inspections
```
GET    /api/inspections                         — List inspections
POST   /api/inspections                         — Create inspection
GET    /api/inspections/:id                     — Get inspection details
PUT    /api/inspections/:id                     — Update inspection
DELETE /api/inspections/:id                     — Delete inspection
```

#### Mobile APIs (Inspector)
```
GET    /api/mobile/inspections              — List inspector's inspections
POST   /api/mobile/inspections              — Create inspection (draft)
GET    /api/mobile/inspections/:id          — Get inspection data
POST   /api/mobile/inspections/:id/submit   — Submit for review
POST   /api/mobile/dashboard                — Inspector dashboard data
```

#### Reviewer APIs
```
GET    /api/reviewer/queue                        — Get pending inspections
GET    /api/reviewer/inspections/:id              — Get full inspection for review
POST   /api/reviewer/inspections/:id/approve      — Approve inspection
POST   /api/reviewer/inspections/:id/reject       — Reject inspection
```

#### Manager APIs
```
GET    /api/manager/pending               — List pending manager approvals
GET    /api/manager/inspections/:id       — Get inspection for manager review
POST   /api/manager/inspections/:id/approve — Manager approve
POST   /api/manager/inspections/:id/reject  — Manager reject
```

#### Scoring & Weightage
```
GET    /api/scoring/calculate/:inspectionId  — Calculate inspection scores
GET    /api/weightage                       — List weightage rules
POST   /api/weightage                       — Create weightage rule
```

#### Health & System
```
GET    /health       — Server health check (includes DB status)
GET    /api          — API information
GET    /test         — Test endpoint
```

### 2.4 State Machine Design

#### Inspection States
```
DRAFT → SUBMITTED → UNDER_REVIEW ┌─→ APPROVED → COMPLETED
                       ↓         │
                  PARTIALLY_REJECTED → resubmit → UNDER_REVIEW
                       ↓         │
                  FULLY_REJECTED ──→ DRAFT (restart)
```

#### Query States (for partial rejection)
```
PENDING → [APPROVED | REJECTED]
REJECTED → [RESUBMITTED | PENDING]
RESUBMITTED → [APPROVED | REJECTED]
```

#### Rejection Levels
| Level | Scope | Effect |
|-------|-------|--------|
| QUERY | Single response | Only that query needs fix |
| SUBDOMAIN | All queries in subdomain | All queries in subdomain need fix |
| DOMAIN | All queries in domain | Entire domain needs re-inspection |
| INSPECTION | Entire inspection | Full restart from DRAFT |

#### Editability Rules
| State | Inspector Can Edit |
|-------|-------------------|
| DRAFT | Everything |
| SUBMITTED | Nothing (awaiting review) |
| UNDER_REVIEW | Nothing (being reviewed) |
| PARTIALLY_REJECTED | Only rejected items |
| FULLY_REJECTED | Everything (restart) |
| APPROVED | Nothing (locked) |
| COMPLETED | Nothing (archived) |

### 2.5 Workflow Engine (Core Business Logic)

The `workflowEngine.js` is the heart of the platform's state management. It implements:

- **WorkflowEngine** — Validates and executes state transitions
- **RejectionManager** — Handles multi-level rejection with cascading state changes
- **EditabilityValidator** — Determines what the inspector can edit based on current state

All state transitions are validated against defined transition rules before execution, preventing illegal state changes.

### 2.6 Security Architecture

#### Authentication Flow
1. User logs in with email + password
2. Server validates credentials (bcrypt hash comparison)
3. Server issues JWT access token + refresh token
4. Client includes JWT in `Authorization: Bearer <token>` header
5. Middleware validates JWT on protected routes

#### Authorization (RBAC)
- Middleware checks user role against route permissions
- Roles: `admin` | `manager` | `reviewer` | `inspector` | `viewer`
- Admins have global access; others are scoped to assigned projects

#### Security Measures
| Measure | Implementation |
|---------|---------------|
| Password Hashing | bcrypt (12 rounds) |
| JWT Signing | HS256 with configurable secret |
| CORS | Configurable whitelist of origins |
| Rate Limiting | express-rate-limit (disabled during dev) |
| Helmet | Security headers (disabled during dev) |
| Input Validation | express-validator on all inputs |
| SQL Injection | Parameterized queries (mysql2) |
| Process Hardening | Graceful shutdown, uncaught exception handling |

### 2.7 Testing Strategy

#### Backend Tests (Jest + Supertest)
```bash
cd backend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

#### Frontend Tests (Vitest + React Testing Library)
```bash
cd QBuild-Web
npm test              # Run all tests
npm run test:ui       # UI mode
npm run test:coverage # Coverage report
```

### 2.8 Deployment

#### Development
```bash
# Backend
cd backend && npm install && npm run dev    # Port 3000

# Web Frontend
cd QBuild-Web && npm install && npm run dev  # Port 5173
```

#### Production (PM2)
```bash
npm install -g pm2
pm2 start backend/src/app.js --name "qbuild-api"
```

#### Docker
```bash
# Backend
docker build -t qbuild-backend ./backend
docker run -p 3000:3000 qbuild-backend

# Frontend
docker build -t qbuild-frontend ./QBuild-Web
docker run -p 80:80 qbuild-frontend
```

#### Environment Variables (backend/.env)
```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=qbuild
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
```

---

## 3. ARCHITECTURE DEEP DIVE

### 3.1 Architecture Layers

```
┌─────────────────────────────────────────────────┐
│            HTTP Controllers (thin)               │
│     Request parsing, response formatting         │
├─────────────────────────────────────────────────┤
│              Service Layer (logic)               │
│   Business rules, orchestration, workflows       │
├─────────────────────────────────────────────────┤
│            Repository Layer (data)               │
│   Data access abstraction, query building        │
├─────────────────────────────────────────────────┤
│              Database (MySQL)                    │
│   Schema, indexes, connection pooling            │
└─────────────────────────────────────────────────┘
```

### 3.2 Current Architecture Status

The project is **mid-refactoring**. Current state:

✅ **Completed:**
- Core API endpoints (auth, projects, inspections, queries, responses, scoring)
- Multi-level approval workflow (reviewer → manager)
- Partial rejection tracking
- Flutter mobile app (inspection creation, submission)
- React web frontend (multiple dashboards, inspection management)
- Database schema with auto-migration
- Workflow engine design (workflowEngine.js)
- Documentation suite (ARCHITECTURE.md, REFACTORING_SUMMARY.md, etc.)

🔧 **Planned (Refactoring Roadmap):**
1. **Foundation** — Repository pattern, audit tables, folder structure
2. **Workflow Engine** — State machine integration, rejection management
3. **Service Layer** — Business logic migration from controllers to services
4. **API Restructuring** — Organization by responsibility (mobile/reviewer/admin)
5. **File Storage** — Abstract file handling (local/S3)
6. **Frontend Improvements** — React context, rejection UI, Flutter sync
7. **Testing & Optimization** — Integration tests, performance, load tests

### 3.3 Data Flow Examples

#### Inspection Submission Flow
```
1. Mobile App → POST /api/mobile/inspections/:id/submit
2. Controller validates JWT auth (auth middleware)
3. Controller checks RBAC (inspector role)
4. Controller validates request body
5. Service layer: 
   a. Fetch inspection from DB
   b. Validate all queries have responses
   c. Update inspection state to SUBMITTED
   d. Log audit trail
6. Controller formats response → JSON
7. Response returned to client
```

#### Review Approval Flow
```
1. Web App → POST /api/reviewer/inspections/:id/approve
2. Controller validates JWT auth
3. Controller checks RBAC (reviewer role)
4. Service layer:
   a. Fetch inspection (must be UNDER_REVIEW)
   b. Calculate final score based on weightage
   c. Update state to APPROVED
   d. Set reviewer_id, reviewed_at
   e. Log audit trail
   f. Trigger notification (if event bus is enabled)
5. Return success response
```

### 3.4 Database Indexing Strategy

Key indexes for query optimization:

| Table | Index | Purpose |
|-------|-------|---------|
| inspections | (project_id, status) | Filter inspections by project |
| inspections | (approval_status) | Pending approval queries |
| inspections | (reviewer_id) | Reviewer queue |
| inspections | (phase) | Phase-specific queries |
| responses | (inspection_id, query_id) | Unique response lookups |
| responses | (nc_type) | Non-conformance filtering |
| users | (email) | Login lookups |
| projects | (status) | Active/completed filtering |
| project_queries | (project_id, phase_number, query_id) | Query assignments |

---

## 4. HANDOVER DOCUMENTATION

### 4.1 Project Context

**Purpose:** QBuild is a quality inspection management system built for construction/manufacturing sites where inspectors perform structured inspections, reviewers approve/reject them, and managers track quality metrics.

**Current Phase:** Active development with ongoing architectural refactoring toward enterprise-grade patterns.

**Key Stakeholders:**
- **End Users:** Site inspectors, quality reviewers, project managers, administrators
- **Development Team:** Backend (Node.js), Frontend (React), Mobile (Flutter)
- **DevOps:** Deployment on VPS/Docker with PM2

### 4.2 Running the System Locally

```bash
# Prerequisites: Node.js v16+, MySQL 8.0+, npm

# 1. Clone and install
git clone https://github.com/prajapativishall/QBuild.git
cd QBuild/backend && npm install
cd ../QBuild-Web && npm install

# 2. Setup database
mysql -u root -p -e "CREATE DATABASE qbuild CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p qbuild < backend/migrations/init.sql

# 3. Configure environment
cp .env.example backend/.env   # Edit DB credentials + JWT secret

# 4. Start backend (terminal 1)
cd backend && npm run dev

# 5. Start frontend (terminal 2)
cd QBuild-Web && npm run dev

# 6. Access
Web App: http://localhost:5173
API:     http://localhost:3000
Health:  http://localhost:3000/health
```

### 4.3 Database Maintenance

```bash
# Backup
mysqldump -u root -p qbuild > backup_$(date +%Y%m%d).sql

# Restore
mysql -u root -p qbuild < backup.sql

# Check connection pool
mysqladmin -u root -p status

# Monitor slow queries
mysql -u root -p -e "SET GLOBAL slow_query_log = 'ON';"
mysql -u root -p -e "SET GLOBAL long_query_time = 2;"
```

### 4.4 Common Maintenance Tasks

| Task | Command/Action |
|------|---------------|
| View logs | `tail -f backend/logs/app.log` |
| Restart backend | `pm2 restart qbuild-api` |
| Monitor PM2 | `pm2 monit` or `pm2 status` |
| Check DB health | `curl http://localhost:3000/health` |
| Run migrations | `mysql -u root -p qbuild < backend/migrations/<script>.sql` |
| Clear uploads | `rm -rf backend/uploads/*` (with caution) |

### 4.5 Known Issues & Gotchas

1. **Helmet & Rate Limiting are disabled** during development — enable in production
2. **Schema auto-migration** in `db.js` `ensureSchema()` runs on every startup — review before production
3. **CORS config** must include all frontend URLs (comma-separated)
4. **Upload directory** `backend/uploads/` must have write permissions
5. **Flutter mobile** needs the backend URL configured in API service
6. **Database migrations** in `backend/migrations/` are separate from auto-migrations
7. **Refactoring in progress** — some controllers still contain business logic that should be in services

### 4.6 Onboarding Checklist for New Developers

- [ ] Read `README.md` for project overview
- [ ] Read `ARCHITECTURE.md` for design principles
- [ ] Read `QUICK_REFERENCE.md` for TL;DR
- [ ] Run the system locally (Section 4.2 above)
- [ ] Examine `backend/src/services/workflow/workflowEngine.js` — core business logic
- [ ] Review `backend/src/app.js` — route registration
- [ ] Review `backend/src/config/db.js` — database layer
- [ ] Review `backend/src/middleware/auth.js` — authentication flow
- [ ] Review `QBuild-Web/src/services/api.js` — frontend API integration
- [ ] Run existing tests: `cd backend && npm test`
- [ ] Check `IMPLEMENTATION_GUIDE.md` for planned refactoring phases

---

## 5. USER MANUAL

### 5.1 Roles & Responsibilities

| Role | Capabilities |
|------|-------------|
| **Admin** | Full system access: manage users, projects, domains, queries; can view all data |
| **Manager** | Manage projects, assign users, review + approve inspections, generate reports |
| **Reviewer** | Review submitted inspections, approve/reject (partial or full), provide comments |
| **Inspector** | Create inspections, fill responses, submit for review, resubmit after rejection |
| **Viewer** | View inspection results, dashboard, reports (read-only) |

### 5.2 Web Application Guide

#### Login
1. Open the application URL in a browser
2. Enter your email and password
3. Click **Login**
4. You will be redirected to your role-specific dashboard

#### Dashboard
- **Inspector Dashboard:** Shows your inspections (drafts, submitted, rejected). Quick actions to create new inspections.
- **Reviewer Dashboard:** Shows inspections pending review. Filter by project/priority.
- **Manager Dashboard:** Shows approvals pending, project statistics, team performance.
- **Admin Dashboard:** System-wide overview, user activity, project completion rates.

#### Managing Projects (Manager/Admin)
1. Navigate to **Projects** from the sidebar
2. Click **+ New Project** to create
3. Fill in: Project name, description, client details, phase info
4. Assign users: Go to project details → **Assign Users** → select role
5. Configure domains and weightage per phase

#### Creating an Inspection (Inspector)
1. Navigate to **Inspections** → **+ New Inspection**
2. Select project and phase
3. The system loads all domains/sub-domains/questions for that phase
4. For each query, provide:
   - **Response:** Yes/No (or predefined options)
   - **NC Type:** Conformance type (Critical/Major/Minor/OFI)
   - **Inspector Comment:** Observations
   - **Additional Remarks:** Special instructions
   - **Photos:** Upload site photos (click to capture/select)
5. Save as **Draft** or **Submit** for review

#### Reviewing an Inspection (Reviewer)
1. From Dashboard, click on a pending inspection
2. Review each query response, photos, comments
3. **Actions:**
   - **Approve All:** Mark inspection as approved
   - **Reject Specific:** Select queries/domains to reject with comments
   - **Reject Entire:** Reject the whole inspection
4. After review, the inspector is notified (in-app)

#### Manager Review (Manager)
1. View inspections approved by reviewer
2. Perform final review
3. **Approve** finalizes the inspection
4. **Reject** sends back to reviewer

#### Viewing Reports
1. Navigate to **Reports**
2. Select project, phase, date range
3. View:
   - **Spider Chart:** Domain-wise performance visualization
   - **Score Card:** Weighted scoring breakdown
   - **Export:** Download as CSV/PDF

### 5.3 Mobile Application Guide (Flutter)

#### Installation
- Android: Download APK from distribution channel
- iOS: Install via TestFlight or App Store

#### Login
1. Open the app
2. Enter credentials (same as web)
3. Biometric login (if enabled)

#### Offline Mode
- Inspections are cached locally
- Create/edit inspections without internet
- Changes sync automatically when connectivity is restored

#### Creating Field Inspection
1. Tap **+** button on dashboard
2. Select project → phase
3. Navigate through domains → sub-domains → queries
4. For each query:
   - Select response (YES/NO/NA)
   - Take photo (camera integration)
   - Add notes
5. **Submit** when complete

#### Review (Mobile)
- View assigned inspections in Inbox
- Review responses with photos
- Approve/reject with comments

---

## 6. SKILLS REQUIRED

### 6.1 Role-Based Skill Requirements

#### Backend Developer (Node.js)

| Skill | Level Required | Why Needed |
|-------|---------------|------------|
| **Node.js & Express** | Advanced | Core platform — APIs, middleware, routing |
| **JavaScript (ES6+)** | Advanced | All backend code is JavaScript |
| **MySQL & SQL** | Advanced | Database design, queries, indexing, optimization |
| **JWT & Authentication** | Proficient | Token-based auth, refresh tokens, session management |
| **REST API Design** | Proficient | API structure, versioning, error handling |
| **Security Best Practices** | Proficient | CORS, Helmet, rate limiting, input validation |
| **Winston/Morgan** | Proficient | Logging, debugging, monitoring |
| **Testing (Jest)** | Proficient | Unit tests, integration tests, mocking |
| **PM2 / Docker** | Proficient | Deployment, process management |
| **TypeScript** | Beneficial | Future migration planned |
| **Message Queues** | Beneficial | BullMQ/Redis for background processing (future) |
| **Event-Driven Architecture** | Beneficial | Future event system implementation |

#### Frontend Developer (React)

| Skill | Level Required | Why Needed |
|-------|---------------|------------|
| **React 18+** | Advanced | Core frontend framework |
| **JavaScript/ES6+** | Advanced | All frontend logic |
| **Vite** | Proficient | Build tool, HMR, configuration |
| **Tailwind CSS** | Proficient | Styling framework |
| **Axios** | Proficient | HTTP client, API integration |
| **React Router** | Proficient | Client-side routing |
| **React Context API** | Proficient | State management (AuthContext) |
| **Vitest / Testing Library** | Proficient | Component testing |
| **REST API Integration** | Proficient | Consuming backend APIs |
| **Git** | Proficient | Version control |

#### Flutter Mobile Developer

| Skill | Level Required | Why Needed |
|-------|---------------|------------|
| **Flutter & Dart** | Advanced | Core mobile framework |
| **REST API Integration** | Proficient | Backend communication |
| **Offline Data Storage** | Proficient | SQLite / Hive for offline support |
| **Camera/Image Picker** | Proficient | Photo capture for inspections |
| **Push Notifications** | Proficient | Future notification system |
| **State Management** | Proficient | Provider / Riverpod / Bloc |
| **Git** | Proficient | Version control |

#### Full-Stack / DevOps

| Skill | Level Required | Why Needed |
|-------|---------------|------------|
| **Linux Administration** | Proficient | Server management |
| **MySQL Administration** | Proficient | DB setup, backup, optimization |
| **Docker** | Proficient | Containerization |
| **CI/CD (GitHub Actions)** | Proficient | Automated testing & deployment |
| **NGINX** | Beneficial | Reverse proxy, SSL termination |
| **Cloud Platforms** | Beneficial | AWS/GCP/Azure deployment |
| **Monitoring Tools** | Beneficial | Grafana, Prometheus, Sentry |

### 6.2 General Skills (All Roles)

| Skill | Importance | Reason |
|-------|-----------|--------|
| **Git & GitHub** | Critical | Version control, collaboration |
| **Code Review** | Critical | Quality assurance, knowledge sharing |
| **Agile/Scrum** | Important | Sprint planning, task management |
| **Documentation** | Important | Maintaining project docs |
| **Problem Solving** | Critical | Debugging, optimization |
| **Communication** | Important | Cross-team coordination |

### 6.3 Learning Resources

#### Backend
- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [JWT Introduction](https://jwt.io/introduction)
- [Jest Testing](https://jestjs.io/docs/getting-started)

#### Frontend
- [React Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Router](https://reactrouter.com/)
- [Vitest](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

#### Mobile
- [Flutter Documentation](https://docs.flutter.dev/)
- [Dart Language Tour](https://dart.dev/guides/language/language-tour)
- [Flutter REST API](https://docs.flutter.dev/data-and-backend/networking)

#### DevOps
- [Docker Get Started](https://docs.docker.com/get-started/)
- [PM2 Runtime](https://pm2.keymetrics.io/docs/usage/pm2-doc-single-page/)
- [GitHub Actions](https://docs.github.com/en/actions)

---

## 7. TROUBLESHOOTING & FAQ

### 7.1 Common Issues

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| API returns 401 | Invalid/expired JWT | Login again to get new token |
| CORS error | Missing origin in CORS config | Add origin to CORS_ORIGIN in .env |
| Database connection failed | Wrong credentials or MySQL not running | Check .env, start MySQL service |
| Port already in use | Another process on the port | Change PORT in .env or kill the process |
| Module not found | Missing npm install | Run `npm install` in the relevant directory |
| Schema auto-migration error | Table already exists with different schema | Check logs, manually fix the schema |
| Image upload fails | Missing uploads directory | Create `backend/uploads/` directory |
| Mobile sync fails | Backend URL misconfigured | Check API endpoint configuration in Flutter |

### 7.2 FAQ

**Q: How do I add a new user?**  
A: Admin users can create users via the User Management page, or via `POST /api/auth/register`.

**Q: How do I assign a reviewer to an inspection?**  
A: Inspections are assigned through project configurations. Ensure the reviewer has access to the project.

**Q: Can I customize the questions for each project?**  
A: Yes. Questions are managed via the Queries module. Project-scoped queries via `project_queries` table.

**Q: How is scoring calculated?**  
A: Each domain and sub-domain has configurable weightage. Scores are calculated as weighted averages of responses, considering NC types.

**Q: Is offline mobile support available?**  
A: Basic offline caching is implemented. Full offline-first with conflict resolution is planned for future releases.

**Q: How do I generate reports?**  
A: Go to Reports page → select criteria → generate. CSV export is available. PDF generation is planned.

---

## 8. APPENDICES

### 8.1 A — Configuration Files

#### backend/.env (template)
```env
NODE_ENV=development
PORT=3000
HOST=localhost
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=qbuild
DB_CONNECTION_LIMIT=10
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5173
CORS_CREDENTIALS=false
LOG_LEVEL=info
```

#### QBuild-Web/.env (template)
```env
VITE_API_URL=http://localhost:3000/api
```

### 8.2 B — Useful Commands

```bash
# Git
git status                         # Check status
git log --oneline --graph          # Visual commit history
git diff                           # Uncommitted changes

# Database
mysql -u root -p -e "SHOW DATABASES"
mysql -u root -p qbuild -e "SHOW TABLES"
mysql -u root -p qbuild -e "DESCRIBE inspections"

# Node.js
node --version
npm --version
npm outdated                       # Check outdated packages
npm audit                          # Security audit

# PM2
pm2 list                           # Running processes
pm2 logs qbuild-api               # Live logs
pm2 stop qbuild-api               # Stop
pm2 delete qbuild-api             # Remove
```

### 8.3 C — Glossary

| Term | Definition |
|------|-----------|
| **Inspection** | A formal examination of a site/project against predefined criteria |
| **Domain** | A high-level category (e.g., Safety, Quality, Environment) |
| **Sub-Domain** | A sub-category within a domain (e.g., Fire Safety under Safety) |
| **Query** | An individual question/checklist item in an inspection |
| **Response** | The inspector's answer to a query (Yes/No/NA) plus supporting data |
| **NC Type** | Non-Conformance type: Critical, Major, Minor, OFI (Opportunity For Improvement) |
| **Weightage** | Configurable importance score for domains/sub-domains affecting final score |
| **Phase** | A project phase (multi-phase projects supported) |
| **RBAC** | Role-Based Access Control |
| **JWT** | JSON Web Token for stateless authentication |
| **Scaffolding** | Pre-built template library for rapid project setup |
| **PM2** | Production process manager for Node.js apps |

---

*End of QBuild Full Documentation*