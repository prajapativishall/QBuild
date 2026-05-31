# QRating Enterprise Refactoring - Complete Summary

**Version:** 1.0  
**Date:** May 2026  
**Author:** Architecture Team  

---

## Executive Summary

This is a **complete architectural refactoring plan** for transforming QRating from a monolithic inspection system into an **enterprise-grade workflow platform** with:

✅ **Explicit state management** - All states defined, validated, audited  
✅ **Flexible rejection support** - At query, subdomain, domain, and inspection levels  
✅ **Clean architecture** - Controllers→Services→Repositories→Database  
✅ **Maintainability** - Clear responsibilities, testable layers, documented patterns  
✅ **Scalability** - Optimized queries, separate analytics, file abstraction  
✅ **Low risk migration** - 7-phase approach with feature flags, backward compatibility  

### Key Deliverables

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Complete architectural design (folder structure, patterns, benefits) |
| [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) | Step-by-step 7-phase migration plan |
| `workflowEngine.js` | State machine, rejection logic, editability validation |
| `repositories/index.js` | Base repository pattern + 4 specialized repositories |
| `services/domain/index.js` | InspectionService, ReviewService, ResponseService, AuditService |
| `migrations/migration-runner.js` | 5 database migrations (states, rejections, audit, files, analytics) |
| `refactored-examples.js` | Simplified controller examples |

---

## Problem Statement

### Current Issues

**Architectural:**
1. ❌ Controllers are bloated (SQL + business logic + validation + formatting)
2. ❌ Workflow states are implicit and scattered
3. ❌ Partial rejection logic is complex and error-prone
4. ❌ Editability rules are in frontend (should be backend)
5. ❌ No audit trail for compliance

**Operational:**
6. ❌ Dashboard queries are heavy and hardcoded
7. ❌ File handling is tightly coupled to HTTP
8. ❌ Testing is difficult (no dependency injection)
9. ❌ APIs are not clearly separated by responsibility
10. ❌ No clear state transition validation

---

## Solution Design

### Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│     HTTP Controllers (Routing, parsing, responses)  │
├─────────────────────────────────────────────────────┤
│  Services (Business logic, orchestration, workflows)│
├─────────────────────────────────────────────────────┤
│  Repositories (Data access, queries, persistence)   │
├─────────────────────────────────────────────────────┤
│  Database (MySQL with optimized schema & indexes)   │
└─────────────────────────────────────────────────────┘
```

### State Machine Design

**Inspection Lifecycle:**
```
DRAFT → SUBMITTED → UNDER_REVIEW → { APPROVED → COMPLETED
                                   { PARTIALLY_REJECTED → UNDER_REVIEW
                                   { FULLY_REJECTED → DRAFT
```

**Rejection Levels:**
- **Query Level:** Single response rejected, others unaffected
- **Subdomain Level:** All queries in subdomain rejected
- **Domain Level:** All subdomains in domain rejected
- **Inspection Level:** Entire inspection rejected, restart required

### Key Patterns

#### 1. Repository Pattern
- **What:** Abstraction layer for data access
- **Why:** Testable (mock repositories), centralized queries, database independence
- **Example:** `const inspection = await inspectionRepo.findByCreator(userId)`

#### 2. Service Layer
- **What:** Business logic, orchestration, cross-concern handling
- **Why:** Controllers stay thin, logic is testable, reusable across APIs
- **Example:** `const result = await inspectionService.submitForReview(id, userId)`

#### 3. Workflow Engine
- **What:** State machine validating transitions and preventing illegal states
- **Why:** Explicit state rules, prevents bugs, auditable changes
- **Example:** `.validateTransition(current, target)` or let engine throw

#### 4. DTO Pattern
- **What:** Data transfer objects separating API contracts from DB schema
- **Why:** API can evolve independently, clean responses, validation boundary
- **Example:** `InspectionDTO` vs raw `inspection` table

#### 5. Audit Trail
- **What:** Every state change is logged with actor, timestamp, details
- **Why:** Compliance, debugging, understanding what happened
- **Example:** `User:5 REJECTED Inspection:100 at 2026-05-14 10:30:45`

---

## Database Changes

### New Columns (Migration 001)
```sql
inspections:
  - state (ENUM: DRAFT, SUBMITTED, UNDER_REVIEW, ...)
  - submitted_at, submitted_by
  - review_started_at, reviewed_by
  - approved_at, approved_by
  - resubmitted_at, resubmitted_by
  
checklist_responses:
  - state (ENUM: PENDING, APPROVED, REJECTED, RESUBMITTED)
  - rejected_at, reviewed_by
  - confidence (0-100)
```

### New Tables (Migrations 002-005)

| Table | Purpose |
|-------|---------|
| `rejections` | Track rejection events with level and affected items |
| `rejection_details` | Detailed feedback per rejected item |
| `audit_log` | All state changes and actions |
| `review_history` | Reviewer-specific history |
| `file_uploads` | File metadata and storage location |
| `inspection_summary` | Denormalized data for fast dashboard queries |
| `inspector_analytics` | Cached performance metrics |
| `reviewer_analytics` | Cached reviewer metrics |

### Performance Improvements

**Indexes Added:**
- `inspections(state, created_at DESC)` - Filter and sort queries
- `checklist_responses(state, inspection_id)` - Status queries
- `rejections(inspection_id, created_at DESC)` - History queries
- `audit_log(entity_type, entity_id, created_at DESC)` - Trail queries

**Data Denormalization:**
- `inspection_summary` - Precalculated stats (total queries, answered, rejected, scores)
- `inspector_analytics` - Aggregated inspector performance
- `reviewer_analytics` - Aggregated reviewer metrics

---

## Service Layer Breakdown

### InspectionService
**Responsibility:** Inspector-facing operations and lifecycle

| Method | Purpose |
|--------|---------|
| `createDraft(projectId, userId)` | Create initial DRAFT inspection |
| `getInspection(id, userId)` | Get with hierarchy and stats |
| `getEditableState(id, userId)` | What can inspector edit now |
| `submitForReview(id, userId)` | Transition to SUBMITTED (validates filled) |
| `resubmitAfterRejection(id, userId)` | Resubmit after PARTIAL_REJECTED |

### ReviewService
**Responsibility:** Reviewer operations and approvals

| Method | Purpose |
|--------|---------|
| `startReview(id, reviewerId)` | Mark SUBMITTED → UNDER_REVIEW |
| `approveInspection(id, reviewerId)` | Mark UNDER_REVIEW → APPROVED |
| `rejectItems(id, rejectionData, reviewerId)` | Reject at any level |
| `getReviewQueue(projectId, pagination)` | Get SUBMITTED inspections |
| `getReviewData(id)` | Full inspection data for review |

### ResponseService
**Responsibility:** Query responses and answers

| Method | Purpose |
|--------|---------|
| `submitResponse(inspectionId, queryId, data, userId)` | Create response |
| `updateResponse(responseId, updates, userId)` | Edit response (before submit) |

### AuditService
**Responsibility:** Audit trail and compliance

| Method | Purpose |
|--------|---------|
| `log(entry)` | Log an action |
| `getTrail(entityType, entityId)` | Get full audit trail |
| `getUserActivity(userId, pagination)` | All actions by user |
| `generateComplianceReport(inspectionId)` | Audit summary |

---

## API Organization

### Mobile APIs (Inspector)
```
POST   /api/mobile/inspections              Create draft
GET    /api/mobile/inspections              List inspector's
GET    /api/mobile/inspections/:id          Get one
POST   /api/mobile/inspections/:id/submit   Submit for review
POST   /api/mobile/inspections/:id/resubmit Resubmit after rejection
GET    /api/mobile/inspections/:id/status   Get editable state

POST   /api/mobile/inspections/:id/queries/:qid/respond  Submit response
PUT    /api/mobile/inspections/:id/queries/:qid/respond  Update response
GET    /api/mobile/inspections/:id/responses             List all responses

POST   /api/mobile/upload                   Upload photo
GET    /api/mobile/dashboard                Inspector dashboard
```

### Reviewer APIs
```
GET    /api/reviewer/queue                  Get SUBMITTED inspections
GET    /api/reviewer/inspections/:id        Get full review data
POST   /api/reviewer/inspections/:id/start-review      Mark UNDER_REVIEW
POST   /api/reviewer/inspections/:id/approve          Approve all
POST   /api/reviewer/inspections/:id/reject-items     Reject specific items
GET    /api/reviewer/audit/:inspectionId              Audit trail
GET    /api/reviewer/dashboard                        Stats
```

### Admin APIs
```
GET    /api/admin/reports/completion       Completion metrics
GET    /api/admin/reports/scoring          Scoring analytics
GET    /api/admin/users/performance        User performance
```

---

## Workflow Transitions & Rules

### State Machines

**Inspection:**
```javascript
const TRANSITIONS = {
  DRAFT: [SUBMITTED],
  SUBMITTED: [UNDER_REVIEW, DRAFT],
  UNDER_REVIEW: [PARTIALLY_REJECTED, FULLY_REJECTED, APPROVED],
  PARTIALLY_REJECTED: [UNDER_REVIEW],
  FULLY_REJECTED: [DRAFT],
  APPROVED: [COMPLETED],
  COMPLETED: []
}
```

**Query:**
```javascript
const TRANSITIONS = {
  PENDING: [APPROVED, REJECTED],
  APPROVED: [],
  REJECTED: [RESUBMITTED, PENDING],
  RESUBMITTED: [APPROVED, REJECTED]
}
```

### Rejection Logic

```javascript
// Example: Reject 3 queries
const rejection = await reviewService.rejectItems(inspectionId, {
  rejectionLevel: 'QUERY',
  affectedIds: [111, 112, 113],
  comments: 'Missing photo evidence'
});

// Sets inspection state: PARTIALLY_REJECTED (inspector can fix)
// Marks those 3 queries as REJECTED
// Still-approved queries remain unchanged
// Inspector can edit ONLY those 3 queries
```

### Editability Rules

| Inspection State | Inspector Can Edit |
|---|---|
| DRAFT | Everything |
| SUBMITTED | Nothing (awaiting review) |
| UNDER_REVIEW | Nothing (actively reviewed) |
| PARTIALLY_REJECTED | Only rejected items + their parent levels |
| FULLY_REJECTED | Everything (restart) |
| APPROVED | Nothing (locked) |
| COMPLETED | Nothing (archived) |

---

## Implementation Approach

### Phase-Based Rollout (16 weeks)

| Phase | Duration | Goal | Risk |
|-------|----------|------|------|
| 1 | Weeks 1-2 | Foundation (repos, audit tables) | Low |
| 2 | Weeks 3-4 | Workflow engine + validation | Low |
| 3 | Weeks 5-7 | Services (business logic migration) | Medium |
| 4 | Weeks 8-9 | API restructuring | Medium |
| 5 | Weeks 10-11 | File storage abstraction | Low |
| 6 | Weeks 12-13 | Frontend improvements | Low |
| 7 | Weeks 14-16 | Testing & optimization | Low |

### Risk Mitigation

**Feature Flags:**
```javascript
// Run new code alongside old
if (process.env.USE_NEW_SERVICES === 'true') {
  result = await newInspectionService.submitForReview(...);
} else {
  result = await oldController.submitInspection(...);
}
```

**Backward Compatibility:**
- Keep old endpoints, add deprecation headers
- Support both old and new data formats
- Gradual client migration

**Rollback Plan:**
- Disable feature flags → old code works
- Revert migrations if needed (with rollback scripts)
- Keep old code for 1-2 sprints before deletion

---

## Testing Strategy

### Unit Tests
- **What:** Test individual services, repositories, utility functions
- **Coverage:** Aim for 80%+ line coverage
- **Tools:** Jest, mocks

**Example:**
```javascript
test('BlocksSubmitIfQueriesUnanswered', async () => {
  responseRepoMock.findUnanswered.mockResolvedValue([{id: 1}]);
  
  await expect(service.submitForReview(inspectionId, userId))
    .rejects.toThrow('Cannot submit: 1 queries still unfilled');
});
```

### Integration Tests
- **What:** Test workflows end-to-end
- **Focus:** State transitions, rejection flow, editability
- **Tools:** Jest with test database

**Example:**
```javascript
test('PartialRejectionWorkflow', async () => {
  // Inspector submits
  await service.submitForReview(inspectionId, userId);
  
  // Reviewer rejects 2 queries
  await service.rejectItems(inspectionId, {
    rejectionLevel: 'QUERY',
    affectedIds: [111, 112]
  }, reviewerId);
  
  // Check editability
  const editable = await service.getEditableState(inspectionId, userId);
  expect(editable.queries[111].editable).toBe(true);
  
  // Resubmit
  await service.resubmitAfterRejection(inspectionId, userId);
});
```

### Performance Tests
- **What:** Measure query performance, response times
- **Targets:**
  - Dashboard < 200ms
  - Inspection fetch < 100ms
  - List queries < 150ms

### Load Tests
- 100 concurrent inspections
- Bulk rejection scenarios
- High-volume dashboard queries

---

## File Structure

### After Refactor

```
backend/
├── src/
│   ├── api/                    # API routes by responsibility
│   │   ├── mobile/             # Inspector endpoints
│   │   ├── reviewer/           # Reviewer endpoints
│   │   ├── admin/              # Admin endpoints
│   │   └── shared/             # Auth, projects, etc
│   │
│   ├── services/               # Business logic
│   │   ├── workflow/           # State machine + rejection
│   │   ├── domain/             # Inspection, Review, Response
│   │   └── file/               # File handling
│   │
│   ├── repositories/           # Data access
│   │   ├── base/               # Abstract BaseRepository
│   │   ├── InspectionRepository
│   │   ├── ResponseRepository
│   │   └── ...
│   │
│   ├── models/                 # DTOs & schemas
│   │   ├── dto/
│   │   └── validation-schemas/
│   │
│   ├── middleware/             # Auth, validation, errors
│   ├── events/                 # Event system
│   └── config/                 # Constants, configuration
│
├── database/
│   ├── migrations/             # 5 migration scripts
│   ├── seeders/                # Initial data
│   └── schema.sql
│
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
```

---

## Configuration

### Environment Variables

```bash
# Database
DB_HOST=localhost
DB_USER=qrating
DB_PASSWORD=***
DB_NAME=qrating

# File Storage
STORAGE_TYPE=local              # local, s3
UPLOAD_DIR=/var/uploads
UPLOAD_MAX_SIZE=10485760        # 10MB

# S3 (if used)
S3_BUCKET=qrating-files
S3_REGION=us-east-1
S3_ACCESS_KEY=***
S3_SECRET_KEY=***

# Features
USE_NEW_SERVICES=false          # Feature flag for Phase 3
USE_NEW_APIS=false              # Feature flag for Phase 4
USE_AUDIT_TRAIL=true            # Audit logging

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

---

## Success Metrics

### Code Quality
- [ ] Test coverage > 70%
- [ ] Cyclomatic complexity < 10 per function
- [ ] No code duplication
- [ ] All architectural patterns followed

### Performance
- [ ] Dashboard loads < 200ms
- [ ] API response times < 100ms
- [ ] Handles 100+ concurrent users
- [ ] Database queries optimized

### Operational
- [ ] All state transitions logged
- [ ] No audit gaps
- [ ] Rejection tracking complete
- [ ] File cleanup working

### User Experience
- [ ] Editability rules enforced
- [ ] Clear rejection feedback
- [ ] Offline support (mobile)
- [ ] No regression in features

---

## Key Takeaways

### What Changes
✅ **Internal Structure:** Controllers→Services→Repositories  
✅ **State Management:** Explicit state machine  
✅ **Rejection System:** Multi-level with partial support  
✅ **Audit Trail:** Full compliance logging  
✅ **APIs:** Organized by responsibility  

### What Stays the Same
✅ **User Experience:** No breaking changes to UI  
✅ **Database:** Backward compatible migrations  
✅ **Features:** All current features work same way  
✅ **Client APIs:** Old endpoints supported with deprecation  

### Why This Matters
✅ **Maintainability:** Clear code boundaries, easy to fix bugs  
✅ **Scalability:** Optimized queries, better performance  
✅ **Testability:** Mockable dependencies, isolated testing  
✅ **Compliance:** Full audit trail for regulations  
✅ **Team Velocity:** Clear patterns = faster development  

---

## Next Steps

### For Leaders
1. **Review** architecture with team
2. **Approve** phased approach
3. **Allocate** dev resources (roughly 25% for 4 months)
4. **Plan** integration with feature releases

### For Architects
1. **Validate** design with team
2. **Refine** based on feedback
3. **Document** ADRs (Architecture Decision Records)
4. **Prepare** for Code Review #1

### For Developers
1. **Read** ARCHITECTURE.md and IMPLEMENTATION_GUIDE.md
2. **Study** code examples
3. **Ask** clarifying questions
4. **Prepare** for Phase 1 kickoff

---

## References

- **ARCHITECTURE.md** - Full design details
- **IMPLEMENTATION_GUIDE.md** - Step-by-step instructions
- **workflowEngine.js** - State machine code
- **repositories/index.js** - Repository pattern code
- **services/domain/index.js** - Service layer code
- **migrations/migration-runner.js** - Database changes

---

## Support

**Questions?** Discussion this design with the team.  
**Issues?** Open an ADR (Architecture Decision Record) for discussion.  
**Ready?** Start Phase 1!

---

**Transform QRating into an Enterprise-Grade Workflow Platform** 🚀
