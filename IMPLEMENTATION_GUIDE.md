# QRating Enterprise Refactoring - Implementation Guide

**Status:** Phase-based implementation roadmap  
**Last Updated:** May 2026

---

## Quick Start

This document provides a phase-by-phase implementation guide for transforming QRating into an enterprise-grade workflow platform.

### Files Created

1. **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Complete architectural design
2. **workflowEngine.js** - Workflow state machine and rejection logic
3. **repositories/index.js** - Repository pattern implementation
4. **services/domain/index.js** - Service layer (Inspection, Review, Response, Audit)
5. **database/migrations/migration-runner.js** - Database migrations
6. **controllers/refactored-examples.js** - Simplified controller examples

---

## Phase 1: Foundation (Weeks 1-2)

### Goal
Build architectural foundation without breaking existing code. All changes are additive.

### Tasks

#### 1.1 Create Folder Structure
```bash
# Create new directories
mkdir -p backend/src/api/{mobile,reviewer,admin,shared}
mkdir -p backend/src/services/workflow
mkdir -p backend/src/services/domain
mkdir -p backend/src/repositories/base
mkdir -p backend/src/models/dto
mkdir -p backend/src/models/validation-schemas
mkdir -p backend/src/events
mkdir -p backend/tests/integration/workflows
```

#### 1.2 Implement Base Repository
- [ ] Copy `BaseRepository` from [repositories/index.js](../backend/src/repositories/index.js) to `backend/src/repositories/base/BaseRepository.js`
- [ ] Create `InspectionRepository extends BaseRepository`
- [ ] Create `ResponseRepository extends BaseRepository`
- [ ] Wire repositories with singleton pattern in `backend/src/repositories/index.js`

**Testing:**
```javascript
// Test basic CRUD
const inspectionRepo = new InspectionRepository(db, logger);
const inspection = await inspectionRepo.findById(1);
expect(inspection).toBeDefined();
```

#### 1.3 Add State Constants
- [ ] Create `backend/src/config/workflow.js` with:
  - All state enums (INSPECTION_STATES, QUERY_STATES, etc.)
  - Transition rules
  - Rejection levels
- [ ] Create `backend/src/models/Entity.js` defining domain entities

#### 1.4 Create Audit Tables
```sql
-- Run migration 001 and 003 from migration-runner.js
-- These are non-breaking - add columns and new tables
```

**Effort:** 20% dev time  
**Risk:** Low - all additive  
**Rollback:** Delete new files/folders, revert migrations

---

## Phase 2: Workflow Engine (Weeks 3-4)

### Goal
Implement and test state machine before using in services.

### Tasks

#### 2.1 Implement Workflow Engine
- [ ] Copy `workflowEngine.js` to `backend/src/services/workflow/`
- [ ] Implement tests in `backend/tests/unit/services/workflow.test.js`
- [ ] Test all state transitions
- [ ] Test rejection manager logic

**Key Tests:**
```javascript
test('BlocksInvalidTransition', () => {
  const engine = new WorkflowEngine();
  const validation = engine.validateTransition(
    INSPECTION_STATES.COMPLETED,
    INSPECTION_STATES.DRAFTED
  );
  expect(validation.valid).toBe(false);
});

test('AllowsPartialRejection', () => {
  const manager = new RejectionManager(engine, repos);
  const rejection = await manager.rejectItems(inspectionId, {
    level: REJECTION_LEVELS.QUERY,
    affectedIds: [1, 2],
    comments: 'Verify photos'
  });
  expect(rejection).toBeDefined();
});
```

#### 2.2 Add State Migration
```sql
-- Run migration 002 from migration-runner.js
-- Adds state columns and rejection tracking tables
```

#### 2.3 Implement EditabilityValidator
- [ ] Copy `EditabilityValidator` from `workflowEngine.js`
- [ ] Test editability logic for each inspection state

**Test Cases:**
- [x] DRAFT state: everything editable
- [x] SUBMITTED: partially locked
- [x] UNDER_REVIEW: fully locked
- [x] PARTIALLY_REJECTED: only rejected items editable
- [x] FULLY_REJECTED: everything editable (restart)

#### 2.4 Event System (Optional for Phase 2)
- [ ] Create `backend/src/events/eventBus.js` (simple pub/sub)
- [ ] Wire workflow events (inspection.submitted, inspection.rejected, etc.)
- [ ] Create handlers: `onInspectionSubmitted.js`, `onRejected.js`, etc.

**Effort:** 25% dev time  
**Risk:** Low-Medium (isolated testing)  
**Rollback:** Disable event bus, keep old logic

---

## Phase 3: Service Layer (Weeks 5-7)

### Goal
Move business logic from controllers into services. Run new and old logic in parallel initially.

### Tasks

#### 3.1 Implement Core Services
- [ ] Create `backend/src/services/domain/InspectionService.js`
  - `createDraft()`
  - `submitForReview()`
  - `resubmitAfterRejection()`
  - `getEditableState()`
- [ ] Create `backend/src/services/domain/ReviewService.js`
  - `startReview()`
  - `approveInspection()`
  - `rejectItems()`
- [ ] Create `backend/src/services/domain/ResponseService.js`
  - `submitResponse()`
  - `updateResponse()`
- [ ] Create `backend/src/services/domain/AuditService.js`
  - `log()`
  - `getTrail()`

**Service Tests:**
```javascript
test('InspectionService.submitForReview validates requirements', async () => {
  const inspection = { id: 1, state: DRAFT };
  const unanswered = [{ id: 1 }, { id: 2 }];
  
  // Mock unanswered query
  responseRepoMock.findUnanswered.mockResolvedValue(unanswered);
  
  await expect(service.submitForReview(1, userId))
    .rejects.toThrow('unfilled');
});
```

#### 3.2 Create DTOs & Validation Schemas
- [ ] Create `backend/src/models/dto/inspectionDTOs.js`
  - `InspectionDTO`
  - `InspectionWithHierarchyDTO`
  - `EditableStateDTO`
- [ ] Create `backend/src/models/validation-schemas/inspection.schema.js` (Joi)
- [ ] Create validation middleware

#### 3.3 Migrate Largest Controller First
**Strategy:** Run new and old logic in parallel

```javascript
// In existing controller - OLD LOGIC
async submitInspection(req, res) {
  // Old code... still works
  
  // NEW LOGIC - Test simultaneously
  if (process.env.USE_NEW_SERVICES === 'true') {
    const result = await inspectionService.submitForReview(id, userId);
    // Log comparison for validation
  }
}
```

Steps:
1. Refactor `backend/src/controllers/mobile/inspectionController.js`
2. Create new version calling `InspectionService`
3. Add feature flag: `USE_NEW_INSPECTION_SERVICE`
4. Compare outputs in test environment
5. Flip flag to true when confident
6. Remove old code

#### 3.4 Repeat for Other Controllers
- [ ] Review controller → `ReviewService`
- [ ] Response controller → `ResponseService`
- [ ] Scoring controller (consolidate duplicates first)

**Effort:** 30% dev time  
**Risk:** Medium (requires endpoint testing)  
**Testing Strategy:**
- Run new code on feature flag
- Compare responses before/after
- Gradually enable for real requests
- Roll back via feature flag if issues

**Rollback:** Disable feature flags, keep new code dormant

---

## Phase 4: API Restructuring (Weeks 8-9)

### Goal
Organize routes by responsibility. Minimal client impact with deprecation notices.

### Tasks

#### 4.1 Create New Route Sets
- [ ] `backend/src/api/mobile/inspection.routes.js`
- [ ] `backend/src/api/mobile/response.routes.js`
- [ ] `backend/src/api/mobile/dashboard.routes.js`
- [ ] `backend/src/api/reviewer/review.routes.js`
- [ ] `backend/src/api/reviewer/approval.routes.js`
- [ ] `backend/src/api/admin/management.routes.js`

#### 4.2 Register New Routes in App
```javascript
// backend/src/app.js

// NEW APIS
app.use('/api/mobile', require('./api/mobile/inspection.routes'));
app.use('/api/mobile', require('./api/mobile/response.routes'));
app.use('/api/reviewer', requireRole('reviewer'), require('./api/reviewer/review.routes'));
app.use('/api/admin', requireRole('admin'), require('./api/admin/management.routes'));

// OLD APIS (with deprecation notice)
app.use('/api/v1', deprecationWarning, require('./routes/old-routes'));
```

#### 4.3 Add Deprecation Warnings
```javascript
// Middleware to warn clients
const deprecationWarning = (req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', new Date(Date.now() + 90*24*60*60*1000).toUTCString());
  res.setHeader('Link', '<http://docs.qrating.local/migration>; rel="deprecation"');
  next();
};
```

#### 4.4 Update Clients
- [ ] Update web frontend: change API endpoints
- [ ] Update mobile app: change API endpoints
- [ ] Verify all endpoints working

#### 4.5 Sunset Old Endpoints
- After 1-2 months: remove old endpoints
- Keep backward compat in services if needed

**Effort:** 15% dev time  
**Risk:** Medium (requires client coordination)  
**Rollback:** Keep old routes, support both

---

## Phase 5: File Storage Refactor (Weeks 10-11)

### Goal
Abstract file handling for local + S3 support.

### Tasks

#### 5.1 Implement Storage Service
- [ ] Create `backend/src/services/file/storageService.js`
- [ ] Implement `LocalStorageBackend`
- [ ] Implement `S3StorageBackend` (optional)
- [ ] Create `FileRepository` for metadata

#### 5.2 Create File Tracking Migration
```sql
-- Run migration 004 from migration-runner.js
-- Creates file_uploads table with metadata
```

#### 5.3 Migrate File Handling
- [ ] Create upload controller using new `StorageService`
- [ ] Migrate existing file uploads to new service
- [ ] Test local and S3 backends
- [ ] Add cleanup service for deleted inspections

**Example Usage:**
```javascript
// OLD WAY
const filePath = path.join(uploadDir, filename);
await fs.writeFile(filePath, buffer);

// NEW WAY
const fileService = new StorageService(storageBackend);
const result = await fileService.uploadInspectionPhoto(buffer, {
  inspectionId: 1,
  queryId: 100,
  fileName: 'photo.jpg'
});
// Returns {fileId: 123, url: '/uploads/...'}
```

#### 5.4 Add S3 Support (Optional)
- [ ] Configure AWS SDK or MinIO compatible S3
- [ ] Implement `S3StorageBackend`
- [ ] Test failover between local/S3
- [ ] Add environment-based backend selection

**Effort:** 20% dev time  
**Risk:** Low-Medium (file operations critical)  
**Rollback:** Switch storage backend via config

---

## Phase 6: Frontend Improvements (Weeks 12-13)

### Task A: React Web Frontend

#### 6A.1 Implement Global State Management
```javascript
// src/context/InspectionContext.jsx
const [state, dispatch] = useReducer(inspectionReducer, initialState);

// Reduce prop-drilling for:
// - Current inspection
// - Editable state
// - Rejections
// - Edit history
```

#### 6A.2 Refactor Query Response Component
```javascript
// Old: Assuming all queries editable
<QueryResponse query={query} onSubmit={handleSubmit} />

// New: Check editability from context
const {editableState} = useInspection();
const canEdit = editableState.queries[queryId]?.editable;
```

#### 6A.3 Implement Rejection Handling
- [ ] Display rejection details
- [ ] Show which items to fix
- [ ] Highlight rejected queries

**Effort:** 25% dev time

### Task B: Flutter Mobile

#### 6B.1 Add Inspection Sync Service
```dart
class InspectionSyncService {
  /// Merge local changes with server state
  /// Preserves unsync'd responses on resubmission
}
```

#### 6B.2 Implement Offline-Safe Pattern
- [ ] Cache inspection state locally
- [ ] Sync on network available
- [ ] Handle conflicts gracefully
- [ ] Show sync status to user

#### 6B.3 Refactor Query Response Screen
```dart
// Check editability before showing input
bool canEdit = await inspectionService.canEditQuery(inspectionId, queryId);

if (!canEdit) {
  showReadOnlyMessage();
}
```

**Effort:** 25% dev time

---

## Phase 7: Testing & Optimization (Weeks 14-16)

### 7.1 Integration Tests for Workflows
```javascript
describe('InspectionLifecycle', () => {
  test('InspectorCanSubmitAndReviewerCanApprove', async () => {
    // 1. Inspector creates draft
    let inspection = await inspectionService.createDraft(projectId, userId);
    expect(inspection.state).toBe('DRAFT');

    // 2. Fill responses
    await responseService.submitResponse(...);

    // 3. Submit for review
    inspection = await inspectionService.submitForReview(inspectionId, userId);
    expect(inspection.state).toBe('SUBMITTED');

    // 4. Reviewer starts review
    inspection = await reviewService.startReview(inspectionId, reviewerId);
    expect(inspection.state).toBe('UNDER_REVIEW');

    // 5. Reviewer approves
    inspection = await reviewService.approveInspection(inspectionId, reviewerId);
    expect(inspection.state).toBe('APPROVED');
  });

  test('PartialRejectionAllowsResubmission', async () => {
    // Reject specific queries
    const rejection = await reviewService.rejectItems(inspectionId, {
      level: 'QUERY',
      affectedIds: [111, 112],
      comments: 'Need photos'
    });

    // Verify editability
    const editable = await inspectionService.getEditableState(inspectionId, userId);
    expect(editable.queries[111].editable).toBe(true);
    expect(editable.queries[113].editable).toBe(false);

    // Resubmit rejected queries
    await responseService.updateResponse(111, {value: 'YES'}, userId);

    // Resubmit
    inspection = await inspectionService.resubmitAfterRejection(inspectionId, userId);
    expect(inspection.state).toBe('UNDER_REVIEW');
  });
});
```

### 7.2 Performance Tests
```javascript
describe('DashboardPerformance', () => {
  test('FetchInspectionListIn<100ms', async () => {
    const start = performance.now();
    const inspections = await inspectionRepo.findByCreator(userId, {}, {limit: 100});
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  test('FetchInspectionHierarchyIn<200ms', async () => {
    const start = performance.now();
    const inspection = await inspectionRepo.findWithHierarchy(inspectionId);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200);
  });
});
```

### 7.3 Load Tests
- Test 100 concurrent inspections
- Test bulk rejection scenarios
- Test dashboard with 1000+ inspections

### 7.4 Audit Trail Verification
- All state changes logged
- No gaps in timeline
- Reviewer actions verified
- Timestamps correct

**Effort:** 25% dev time  
**Deliverable:** Test suite with >70% coverage

---

## Migration Checklist

### Phase 1 ✓
- [ ] Create folder structure
- [ ] Implement BaseRepository
- [ ] Create state constants
- [ ] Add audit logging
- [ ] Test basic repository CRUD
- [ ] **Deploy to staging**

### Phase 2 ✓
- [ ] Implement WorkflowEngine
- [ ] Test all transitions
- [ ] Add rejection manager
- [ ] Implement editability validator
- [ ] Test with real data
- [ ] **Deploy to staging with feature flag OFF**

### Phase 3 ✓
- [ ] Create InspectionService
- [ ] Create ReviewService, ResponseService
- [ ] Create DTOs and validation
- [ ] Migrate controllers one by one
- [ ] 100% endpoint test coverage
- [ ] Feature flag testing
- [ ] **Gradual rollout with feature flag**

### Phase 4 ✓
- [ ] Create new API routes
- [ ] Register routes in app
- [ ] Add deprecation headers
- [ ] Update clients
- [ ] Verify backward compat
- [ ] **Sunset old endpoints**

### Phase 5 ✓
- [ ] Implement StorageService
- [ ] Create file migration
- [ ] Test local + S3
- [ ] Add cleanup logic
- [ ] **Deploy file storage refactor**

### Phase 6 ✓
- [ ] React: Create InspectionContext
- [ ] React: Refactor components
- [ ] Flutter: Add sync service
- [ ] Flutter: Offline support
- [ ] **Update both clients**

### Phase 7 ✓
- [ ] Integration tests
- [ ] Performance tests
- [ ] Load tests
- [ ] Audit verification
- [ ] **Production release**

---

## Getting Started Today

### Step 1: Create Folders (1 hour)
```bash
bash src/create-folders.sh  # See script below
```

### Step 2: Copy Base Files (2 hours)
Copy from examples:
- `repositories/index.js` → `src/repositories/`
- `workflowEngine.js` → `src/services/workflow/`
- Don't integrate yet—just copy

### Step 3: Run Database Migrations (30 min)
```javascript
const { MigrationRunner } = require('./database/migrations/migration-runner');
const runner = new MigrationRunner(db, logger);

// Run only migrations 001, 002, 003 in Phase 1
await runner.runUp('003_add_audit_trail.sql');
```

### Step 4: Write Tests (3 hours)
Start with repository tests:
```javascript
describe('InspectionRepository', () => {
  test('findById returns inspection', async () => {
    const r = new InspectionRepository(db, logger);
    const inspection = await r.findById(1);
    expect(inspection.id).toBe(1);
  });
});
```

### Step 5: Plan Review
Schedule 1-2 hour architecture review with team:
- Walk through repository pattern
- Discuss service responsibilities
- Review state machine design
- Address questions

---

## Key Success Factors

✅ **Phased Approach**
- Don't try to do everything at once
- Each phase is independently deployable
- Allows learning and adjustment

✅ **Backward Compatibility**
- New code runs alongside old code
- Feature flags for gradual rollout
- Easy rollback at any point

✅ **Heavy Testing**
- Test each layer in isolation
- Integration tests for workflows
- Load tests before production

✅ **Team Buy-In**
- Share architecture design early
- Get feedback on patterns
- Pair program migrations

✅ **Documentation**
- Document why architectural decisions
- Keep ADRs (Architecture Decision Records)
- Update API docs

---

## Common Pitfalls to Avoid

❌ **Rewriting Everything at Once**
- Too risky, too slow
- Use phased approach instead

❌ **Skipping Tests**
- Business logic untested = bugs in production
- Test each service layer

❌ **Not Updating Both Frontends**
- Web and mobile need simultaneous updates
- Plan client releases together

❌ **Over-Engineering**
- Start simple, add features as needed
- Don't build for hypothetical scenarios

❌ **Ignoring Data Migration**
- Old inspections need state initialized
- Handle mixed old/new data

---

## Script: Create Folders

```bash
#!/bin/bash
# create-folders.sh

mkdir -p backend/src/api/{mobile,reviewer,admin,shared}
mkdir -p backend/src/services/workflow
mkdir -p backend/src/services/domain
mkdir -p backend/src/repositories/base
mkdir -p backend/src/models/{dto,validation-schemas}
mkdir -p backend/src/events/{handlers}
mkdir -p backend/tests/{unit/services,integration/workflows}

echo "✓ Folder structure created"
```

---

## Next Steps

1. **Review** this guide with team
2. **Schedule** Phase 1 kickoff
3. **Create** folder structure
4. **Copy** base files
5. **Start** with repository tests
6. **Plan** first sprint

---

## Support & Questions

**Documentation:** See [ARCHITECTURE.md](../ARCHITECTURE.md)  
**Examples:** See `backend/src/services/domain/index.js`  
**Tests:** See `backend/tests/integration/workflows/`

---

**Ready to transform QRating into an enterprise-grade platform!**
