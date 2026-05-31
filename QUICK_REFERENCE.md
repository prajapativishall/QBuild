# QRating Refactoring - Quick Reference

**TL;DR:** Transform monolithic controllers → clean layered architecture with explicit workflows  
**Duration:** 16 weeks (7 phases)  
**Risk Level:** Low (phased approach with feature flags)

---

## The Problem

```
CURRENT STATE:
Controller { SQL + Logic + Validation + Formatting + State Management }
                    ↓ Hard to test, maintain, extend

DESIRED STATE:
Controller → Service → Repository → Database
     ↑         ↑          ↑
  HTTP      Business    Data Access
  only      logic only   only
```

---

## The Solution: 5 Key Patterns

| Pattern | What | Why |
|---------|------|-----|
| **Repository** | Data access abstraction | Testable, centralized queries |
| **Service** | Business logic layer | Reusable, non-HTTP, testable |
| **Workflow** | State machine | Explicit rules, prevents bugs |
| **DTO** | Data transfer objects | Clean API contracts |
| **Audit** | All changes logged | Compliance, debugging |

---

## Quick Comparison

### Before
```javascript
// Controller is 500+ lines
async submitInspection(req, res) {
  // Validate project access
  // Check all queries answered
  // Update database
  // Calculate scores
  // Log action
  // Return formatted response
}
```

### After
```javascript
// Controller is 20 lines
async submit(req, res, next) {
  try {
    const result = await inspectionService.submitForReview(id, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error); // Middleware handles formatting
  }
}
```

---

## Phases at a Glance

```
Week 1-2   Week 3-4    Week 5-7    Week 8-9   Week 10-11  Week 12-13  Week 14-16
Phase 1    Phase 2     Phase 3     Phase 4    Phase 5     Phase 6     Phase 7
────────   ────────    ────────    ────────   ────────    ────────    ────────
Foundation Workflow    Services    APIs       Files       Frontend    Testing
Repos      Engine      Migration   Restructure Abstraction Improve     Optimize
Low Risk   Low Risk    Medium      Medium     Low         Low         Low
```

---

## State Machine (Core Design)

### Inspection States
```
DRAFT → SUBMITTED → UNDER_REVIEW ┌─→ APPROVED → COMPLETED
                      ↓          │
                 PARTIALLY_REJECTED → (re-fix, resubmit)
                      ↓          │
                 FULLY_REJECTED ─┘
                      ↓
                    DRAFT (restart)
```

### Rejection Levels
```
Query     → One response rejected, others OK, inspector fixes that query
Subdomain → All queries in subdomain rejected, inspector refixes subdomain
Domain    → All queries in domain rejected, inspector refixes domain
Inspection→ Entire inspection rejected, restart from DRAFT
```

### Editability Rules
| State | Can Edit |
|-------|----------|
| DRAFT | Everything |
| SUBMITTED | Nothing |
| UNDER_REVIEW | Nothing |
| PARTIALLY_REJECTED | Only rejected items |
| FULLY_REJECTED | Everything |
| APPROVED | Nothing |
| COMPLETED | Nothing |

---

## New Database Objects

| Type | Name | Purpose |
|------|------|---------|
| Table | `rejections` | Track who rejected what when |
| Table | `rejection_details` | Feedback per rejected item |
| Table | `audit_log` | All state changes |
| Table | `file_uploads` | File metadata |
| Table | `inspection_summary` | Cached stats |
| Index | `idx_inspections_state` | Fast state queries |
| Index | `idx_responses_state_inspection` | Fast response queries |

---

## 3 Key Services

### InspectionService
```javascript
createDraft(projectId, userId)      // Create DRAFT
submitForReview(id, userId)         // Submit & validate
resubmitAfterRejection(id, userId)  // Fix + resubmit
getEditableState(id, userId)        // What can be edited
```

### ReviewService
```javascript
startReview(id, reviewerId)         // Start review
approveInspection(id, reviewerId)   // Approve all
rejectItems(id, data, reviewerId)   // Reject specific items
getReviewQueue()                    // Get pending
```

### ResponseService
```javascript
submitResponse(inspection, query, data, userId)  // Save answer
updateResponse(response, updates, userId)        // Edit answer
```

---

## New API Organization

### Before (Scattered)
```
POST /api/inspections/submit
POST /api/inspections/review
POST /api/inspections/approve
POST /api/queries/respond
GET  /api/dashboard
```

### After (Organized by Role)
```
Mobile/Inspector APIs:
  POST /api/mobile/inspections/:id/submit
  GET  /api/mobile/inspections/:id/status
  POST /api/mobile/inspections/:id/queries/:qid/respond

Reviewer APIs:
  GET  /api/reviewer/queue
  POST /api/reviewer/inspections/:id/reject-items
  POST /api/reviewer/inspections/:id/approve

Admin APIs:
  GET  /api/admin/reports/completion
```

---

## Testing New Code

### Unit Test (Service)
```javascript
test('BlocksSubmitIfQueriesEmpty', async () => {
  responseRepoMock.findUnanswered.mockResolvedValue([{id: 1}]);
  
  await expect(service.submitForReview(id, userId))
    .rejects.toThrow('Cannot submit: 1 queries unfilled');
});
```

### Integration Test (Full Workflow)
```javascript
test('InspectorSubmit → ReviewerReject → Resubmit', async () => {
  // 1. Submit
  await inspectionService.submitForReview(id, userId);
  
  // 2. Reject
  await reviewService.rejectItems(id, {
    rejectionLevel: 'QUERY',
    affectedIds: [111, 112]
  }, reviewerId);
  
  // 3. Resubmit
  await inspectionService.resubmitAfterRejection(id, userId);
});
```

---

## Migration Strategy

### Week 1-2: Can Deploy Immediately
- New folder structure ✓
- BaseRepository ✓
- Audit logging ✓
- **All backward compatible**

### Week 3-4: Still Backward Compatible
- WorkflowEngine ✓
- State validation ✓
- Feature flag OFF ✓
- **Old code still works**

### Week 5-7: Feature Flag Controlled
- New services alongside old ✓
- Compare outputs ✓
- Flip flag when ready ✓
- **Easy rollback via flag**

### Week 8+: Gradual Client Migration
- Deprecation headers ✓
- Support both APIs ✓
- Client updates over time ✓
- **No forced migration**

---

## Repository Pattern

### BaseRepository (Reusable)
```javascript
class BaseRepository {
  findById(id)
  findAll(filters, pagination)
  create(data)
  update(id, data)
  delete(id)
  count(filters)
}

// Every data entity gets a repo
class InspectionRepository extends BaseRepository {
  // Inherit basic CRUD
  // Add domain-specific methods
  findByCreator(userId)
  findByState(state)
  findWithHierarchy(id)
}
```

---

## Service Example

### Before (500 lines in controller)
```javascript
async submitInspection(req, res) {
  const userId = req.user.id;
  const inspectionId = req.params.id;
  
  // Validate ownership
  // Check state
  // Validate all fields filled
  // Update database
  // Audit log
  // Format response
  // Return
}
```

### After (Split across layers)
```javascript
// Controller (10 lines)
async submit(req, res, next) {
  const result = await inspectionService.submitForReview(id, userId);
  res.json({success: true, data: result});
}

// Service (30 lines)
async submitForReview(inspectionId, userId) {
  const inspection = await this.repo.findById(inspectionId);
  if (!this.workflow.canTransition(inspection.state, 'SUBMITTED')) {
    throw error;
  }
  const unanswered = await this.responseRepo.findUnanswered(inspectionId);
  if (unanswered.length) throw error;
  
  const updated = await this.repo.update(inspectionId, {state: 'SUBMITTED'});
  await this.auditService.log({action: 'SUBMITTED', ...});
  return updated;
}

// Repository (10 lines)
async update(id, data) {
  const [result] = await this.db.execute(
    `UPDATE ${this.table} SET ... WHERE id=?`, [...values, id]
  );
  return this.findById(id);
}
```

---

## Getting Started Checklist

**This Week:**
- [ ] Review these documents
- [ ] Schedule architecture review (1 hour)
- [ ] Get buy-in from team leads

**Next Week (Phase 1 Start):**
- [ ] Create folder structure
- [ ] Copy BaseRepository code
- [ ] Write repository tests
- [ ] Deploy to staging

**Deployment:**
- [ ] Dev environment test
- [ ] Staging test with feature flag OFF
- [ ] Production deploy (still using old code)
- [ ] Monitor 1 week

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test Coverage | > 70% |
| Dashboard Response | < 200ms |
| API Response | < 100ms |
| Audit Trail Gaps | 0 |
| Rejection Accuracy | 100% |
| Code Duplication | 0 |
| Cyclomatic Complexity | < 10 |

---

## Common Questions

**Q: Will this break existing systems?**  
A: No. Phase 1-2 are additive. Phase 3 uses feature flags. Old code remains.

**Q: How long will it take?**  
A: ~4 months total, but features can ship during migration via feature flags.

**Q: Do we need to rewrite everything?**  
A: No. Migrate one endpoint at a time, gradually over weeks.

**Q: What if we find issues?**  
A: Feature flag lets you toggle back to old code in seconds.

**Q: How do we test this?**  
A: Unit tests for services, integration tests for workflows, performance tests for queries.

**Q: What about the database?**  
A: Migrations are non-breaking. Add columns, not remove. Existing data works.

---

## Key Files

| File | Purpose |
|------|---------|
| ARCHITECTURE.md | Complete design (100+ pages) |
| IMPLEMENTATION_GUIDE.md | Step-by-step migration |
| REFACTORING_SUMMARY.md | This level of detail |
| workflowEngine.js | State machine code |
| repositories/index.js | Repository examples |
| services/domain/index.js | Service examples |
| migrations/migration-runner.js | Database changes |
| refactored-examples.js | Controller examples |

---

## Next Conversation

**Suggest we discuss:**
1. ✅ Does this architecture align with your goals?
2. ✅ Any concerns about the phased approach?
3. ✅ Timeline: Can you allocate 25% dev time for 4 months?
4. ✅ Should we start Phase 1 next week?

---

**Ready to transform QRating!** 🚀
